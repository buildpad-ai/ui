#!/usr/bin/env bash
#
# Cut a full lockstep release from a local checkout.
#
# This is the SAME flow publish.yml runs, done by hand because GitHub Actions
# cannot open the Version PR in this repo. It is not the old "quick publish":
# it bumps versions, writes changelogs, regenerates the registry, tags the
# release, and only then publishes. A release produced this way is
# indistinguishable from a CI one.
#
# ── The ordering matters ──────────────────────────────────────────────────
#
# The tag is pushed BEFORE npm, which is the reverse of what publish.yml does.
#
# Since the pinned-fetch change, the CLI resolves every source file from
# `v<its own version>`. A published @buildpad/cli@X.Y.Z with no matching
# `vX.Y.Z` tag is not degraded, it is BRICKED: `add`, `upgrade`, `outdated`
# and `list` all 404 on registry.json and exit 1. npm publishes cannot be
# undone after 72h (and unpublishing is disruptive before that); pushing a tag
# is free and reversible. So the irreversible step goes last, once everything
# it depends on is already live.
#
# ── Usage ─────────────────────────────────────────────────────────────────
#
#   scripts/release-local.sh                 # preflight + show the plan, change nothing
#   scripts/release-local.sh --execute       # do it, prompting before the publish
#   scripts/release-local.sh --execute --yes # no prompts (CI-ish)
#
#   Options:
#     --remote <name>   git remote to push to (default: github)
#     --otp <code>      npm one-time password, if your account has 2FA
#
# Safe to re-run: every step checks whether it has already been done, so a
# failure partway through is resumed by running the same command again.

set -euo pipefail

EXECUTE=false
ASSUME_YES=false
REMOTE="github"
OTP=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --execute) EXECUTE=true; shift ;;
    --yes|-y)  ASSUME_YES=true; shift ;;
    --remote)  REMOTE="$2"; shift 2 ;;
    --otp)     OTP="$2"; shift 2 ;;
    -h|--help) sed -n '2,36p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

RED=$'\033[31m'; GRN=$'\033[32m'; YEL=$'\033[33m'; DIM=$'\033[2m'; BLD=$'\033[1m'; OFF=$'\033[0m'
ok()   { echo "  ${GRN}✓${OFF} $*"; }
warn() { echo "  ${YEL}!${OFF} $*"; }
die()  { echo; echo "${RED}✗ $*${OFF}" >&2; echo; exit 1; }
step() { echo; echo "${BLD}$*${OFF}"; }

confirm() {
  $ASSUME_YES && return 0
  local reply
  read -r -p "  $1 [y/N] " reply < /dev/tty
  [[ "$reply" == "y" || "$reply" == "Y" ]]
}

# ─────────────────────────────────────────────────────────────────────────
step "Preflight"
# ─────────────────────────────────────────────────────────────────────────

command -v node >/dev/null || die "node not found. This machine keeps it off the default PATH:
    export PATH=\"/opt/homebrew/opt/node@24/bin:\$PATH\""
command -v pnpm >/dev/null || die "pnpm not found (same PATH note as above)."
ok "node $(node -v), pnpm $(pnpm -v)"

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
[[ "$BRANCH" == "main" ]] || die "on '$BRANCH', expected 'main'.
    A release must be cut from main so the tag points at a commit that is on main:
      git checkout main && git pull $REMOTE main"

git fetch "$REMOTE" --quiet
LOCAL="$(git rev-parse HEAD)"
UPSTREAM="$(git rev-parse "$REMOTE/main")"
if [[ "$LOCAL" != "$UPSTREAM" ]]; then
  if git merge-base --is-ancestor "$LOCAL" "$UPSTREAM"; then
    die "main is behind $REMOTE/main. Fast-forward first:  git pull $REMOTE main"
  else
    die "local main has commits $REMOTE/main does not (or has diverged).
    Push or rebase before releasing — the tag must point at a commit that exists on the remote."
  fi
fi
ok "on main, in sync with $REMOTE/main ($(git rev-parse --short HEAD))"

if [[ -n "$(git status --porcelain)" ]]; then
  echo
  git status --short | sed 's/^/      /'
  die "working tree is dirty.

    A release commit must contain the version bump and nothing else. Commit or
    discard the above first.

    If these are rebuilt \`packages/*/dist\` files: they are tracked here but the
    path is also gitignored, so a plain \`git add\` warns. Use -u (tracked only):
      git add -u packages && git commit -m 'chore: rebuild dist'
    or discard them — they regenerate on the next build:
      git checkout -- packages"
fi
ok "working tree clean"

shopt -s nullglob
CHANGESETS=(.changeset/*.md)
PENDING=()
for f in "${CHANGESETS[@]}"; do
  [[ "$(basename "$f")" == "README.md" ]] && continue
  PENDING+=("$f")
done
shopt -u nullglob
CURRENT="$(node -p "require('./packages/cli/package.json').version")"

# Two legitimate ways to be here:
#
#   bump   — changesets are pending, versions still at the last release
#   resume — a previous run already bumped (which CONSUMES the changesets) but
#            did not finish publishing. This is the common case: step 4 waits on
#            the CDN and step 5 builds, and either can fail. Without this branch
#            the "no pending changesets" check would strand a half-finished
#            release with no way to complete it except by hand.
#
# The two are told apart by asking npm whether the local version already exists.
version_on_npm() {
  local v="$1"
  curl -sf "https://registry.npmjs.org/@buildpad%2fcli/${v}" >/dev/null 2>&1
}

if [[ ${#PENDING[@]} -gt 0 ]]; then
  MODE="bump"
  ok "${#PENDING[@]} pending changeset(s): $(printf '%s ' "${PENDING[@]#.changeset/}")"
elif version_on_npm "$CURRENT"; then
  die "nothing to release.

    No pending changesets, and @buildpad/cli@${CURRENT} is already on npm.
    Add a changeset for the next release:  pnpm changeset"
else
  MODE="resume"
  warn "no pending changesets, but @buildpad/cli@${CURRENT} is not on npm yet"
  warn "resuming a partially-completed release of ${CURRENT}"
fi

# npm auth.
#
# `npm whoami` is a HINT, not the gate. A granular access token can carry
# publish rights to @buildpad/* while lacking the user-read scope `whoami`
# needs, so whoami returns 401 for a token that publishes perfectly well —
# gating on it would refuse to release for a correctly-configured operator.
# npm itself is the authority, and it decides at step 6.
#
# Token VALUES are never read or printed here; only the presence of a config
# line is checked. (npm 10+ also redacts auth keys from `npm config get`.)
if NPM_USER="$(npm whoami 2>/dev/null)"; then
  ok "npm authenticated as ${NPM_USER}"
elif grep -qs "_authToken" "${HOME}/.npmrc" "${ROOT}/.npmrc" 2>/dev/null || [[ -n "${NPM_TOKEN:-}" ]]; then
  warn "an npm auth token is configured, but \`npm whoami\` returned 401"
  warn "typical of a granular access token; npm will verify publish rights at step 6"
else
  die "npm has no credentials configured.

    Set them up yourself (this script never handles your token):
      npm login
    or, for a granular access token:
      npm config set //registry.npmjs.org/:_authToken <token>

    Then re-run. Note that \`npm whoami\` failing is NOT on its own a problem —
    granular tokens often cannot answer it."
fi

# ─────────────────────────────────────────────────────────────────────────
step "Verifying the tree builds and is self-consistent"
# ─────────────────────────────────────────────────────────────────────────

echo "${DIM}  pnpm --filter @buildpad/cli test${OFF}"
pnpm --filter @buildpad/cli test >/dev/null 2>&1 || die "CLI tests fail. Fix before releasing."
ok "CLI tests pass"

echo "${DIM}  pnpm registry:check${OFF}"
pnpm registry:check >/dev/null 2>&1 || die "registry.json is out of sync with the sources.
    Run: pnpm build:registry"
ok "registry.json in sync"

if ! $EXECUTE; then
  step "Plan (dry run — nothing has changed) — mode: ${MODE}"
  if [[ "$MODE" == "bump" ]]; then
    echo "  1. pnpm version:packages       bump all 13 lockstep packages, write CHANGELOGs,"
    echo "                                 regenerate registry.json at the new version"
  else
    echo "  1. ${DIM}(skipped — already at ${CURRENT})${OFF}"
  fi
  cat <<PLAN
  2. verify                      registry.version == cli version, registry:check
  3. commit + push               release commit -> $REMOTE/main (no-op if already pushed)
  4. push tag v<version>          ${BLD}before npm${OFF} — a published CLI whose tag is missing
                                 cannot fetch anything at all; blocks until the raw
                                 CDN serves it
  5. pnpm build                  build everything from the bumped sources
  6. changeset publish           ${BLD}irreversible${OFF} — @buildpad/cli + @buildpad/mcp to npm
  7. push package tags           the changesets @buildpad/<pkg>@<v> tags

  Re-run with --execute to perform this.
PLAN
  exit 0
fi

# ─────────────────────────────────────────────────────────────────────────
step "1. Version bump"
# ─────────────────────────────────────────────────────────────────────────

if [[ "$MODE" == "bump" ]]; then
  pnpm version:packages
  NEW="$(node -p "require('./packages/cli/package.json').version")"
  [[ "$NEW" != "$CURRENT" ]] || die "version did not change (still $CURRENT).
    \`changeset version\` did not run. If it printed \"Too many arguments passed to
    changesets\", the version:packages script is malformed."
  ok "${CURRENT} → ${NEW}"
else
  NEW="$CURRENT"
  warn "already at ${NEW}, skipping the bump"
fi
TAG="v${NEW}"

# ─────────────────────────────────────────────────────────────────────────
step "2. Verifying the bump"
# ─────────────────────────────────────────────────────────────────────────

REG_V="$(node -p "require('./packages/registry.json').version")"
[[ "$REG_V" == "$NEW" ]] || die "registry.json says '$REG_V' but the CLI is '$NEW'.

    These must match: the CLI records registry.version as \`release\` in the
    consumer's buildpad.json, and pins its fetches to v<cli version>.
    Run: pnpm build:registry"
ok "registry.json version == ${NEW}"

MCP_V="$(node -p "require('./packages/mcp-server/package.json').version")"
[[ "$MCP_V" == "$NEW" ]] || die "@buildpad/mcp is at '$MCP_V', expected '$NEW' (lockstep group broken)."
ok "@buildpad/mcp == ${NEW}"

pnpm registry:check >/dev/null 2>&1 || die "registry:check fails after the bump."
ok "registry:check passes on the bumped tree"

# ─────────────────────────────────────────────────────────────────────────
step "3. Commit and push the release commit"
# ─────────────────────────────────────────────────────────────────────────

if [[ -n "$(git status --porcelain)" ]]; then
  git add -A
  git commit -q -m "chore(release): version packages to ${NEW}"
  ok "committed $(git rev-parse --short HEAD)"
else
  warn "nothing to commit, assuming already committed"
fi

if [[ "$(git rev-parse HEAD)" != "$(git rev-parse "$REMOTE/main" 2>/dev/null || echo none)" ]]; then
  git push "$REMOTE" HEAD:main
  git fetch "$REMOTE" --quiet
  ok "pushed to $REMOTE/main"
else
  warn "already pushed"
fi

# ─────────────────────────────────────────────────────────────────────────
step "4. Tag the release (before npm — see the header)"
# ─────────────────────────────────────────────────────────────────────────

if git rev-parse -q --verify "refs/tags/${TAG}" >/dev/null; then
  warn "${TAG} already exists locally"
else
  git tag -a "${TAG}" -m "Release ${NEW}"
  ok "created ${TAG}"
fi

if git ls-remote --exit-code --tags "$REMOTE" "refs/tags/${TAG}" >/dev/null 2>&1; then
  warn "${TAG} already on ${REMOTE}"
else
  git push "$REMOTE" "${TAG}"
  ok "pushed ${TAG} to ${REMOTE}"
fi

# The CDN is what the CLI actually reads. Confirm the tag resolves there before
# putting a CLI on npm that depends on it.
echo "${DIM}  waiting for raw.githubusercontent.com to serve ${TAG}...${OFF}"
RAW="https://raw.githubusercontent.com/buildpad-ai/ui/${TAG}/packages/registry.json"
for attempt in 1 2 3 4 5 6 7 8 9 10; do
  CODE="$(curl -s -o /dev/null -w '%{http_code}' "$RAW" || echo 000)"
  [[ "$CODE" == "200" ]] && break
  sleep 3
done
[[ "$CODE" == "200" ]] || die "the raw CDN still returns HTTP ${CODE} for ${TAG}.

    Do NOT publish to npm until this returns 200 — a CLI at ${NEW} would be
    unable to fetch anything. Check the tag reached ${REMOTE}, then re-run."
CDN_V="$(curl -s "$RAW" | node -pe "JSON.parse(require('fs').readFileSync(0,'utf8')).version" 2>/dev/null || echo '?')"
[[ "$CDN_V" == "$NEW" ]] || die "the CDN serves registry version '${CDN_V}' at ${TAG}, expected '${NEW}'."
ok "${TAG} live on the CDN, registry version ${CDN_V}"

# ─────────────────────────────────────────────────────────────────────────
step "5. Build"
# ─────────────────────────────────────────────────────────────────────────

pnpm build >/dev/null 2>&1 || die "build failed. The release commit and tag are already pushed;
    fix the build, then re-run this script — it will resume at the publish step."
ok "all packages built"

# ─────────────────────────────────────────────────────────────────────────
step "6. Publish to npm"
# ─────────────────────────────────────────────────────────────────────────

echo "  About to publish, which ${BLD}cannot be undone${OFF}:"
node -e "
for (const p of ['cli','mcp-server']) {
  const j = require('./packages/'+p+'/package.json');
  if (!j.private) console.log('    ' + j.name + '@' + j.version);
}
"
if ! confirm "Publish these to npm?"; then
  echo
  echo "  Stopped before publishing. Everything up to and including the tag is"
  echo "  already pushed, which is a safe state. Re-run to resume."
  exit 0
fi

PUBLISH_ARGS=()
[[ -n "$OTP" ]] && PUBLISH_ARGS+=(--otp "$OTP")
pnpm changeset publish "${PUBLISH_ARGS[@]}"
ok "published"

# ─────────────────────────────────────────────────────────────────────────
step "7. Push the per-package tags changeset publish created"
# ─────────────────────────────────────────────────────────────────────────

git push "$REMOTE" --tags
ok "tags pushed"

# ─────────────────────────────────────────────────────────────────────────
step "Done — verifying what landed"
# ─────────────────────────────────────────────────────────────────────────

for p in cli mcp; do
  LATEST="$(curl -s "https://registry.npmjs.org/-/package/@buildpad%2f${p}/dist-tags" \
    | node -pe "try{JSON.parse(require('fs').readFileSync(0,'utf8')).latest}catch(e){'?'}")"
  if [[ "$LATEST" == "$NEW" ]]; then ok "@buildpad/${p} latest = ${LATEST}"
  else warn "@buildpad/${p} latest = ${LATEST} (npm may take a moment to update)"; fi
done

cat <<NEXT

${BLD}Smoke test from an empty directory:${OFF}
  cd \$(mktemp -d) && npm init -y >/dev/null && npx @buildpad/cli@${NEW} list | head

${BLD}Tell consumers:${OFF}
  This is a breaking release — buildpad.json moves to schema v3.
  npx @buildpad/cli@latest migrate
NEXT
