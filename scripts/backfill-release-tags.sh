#!/usr/bin/env bash
#
# Backfill one plain `v<version>` tag per historical release.
#
# WHY
#   The CLI pins every source fetch to `v<its own version>`, and `upgrade`
#   resolves a file's diff3 base from the ref recorded in buildpad.json. Both
#   need the tag to exist. Releases published before publish.yml started
#   creating these tags have only the changesets per-package tags
#   (`@buildpad/hooks@1.9.0`), whose names contain `/` and `@` and are
#   ambiguous in a raw-CDN path.
#
#   Backfilling makes `buildpad migrate` exact for every existing v2 manifest:
#   it can fetch registry.json at `v<recorded version>` and copy out the real
#   upstream hashes, instead of falling back to the current hashes and marking
#   every file `pending`.
#
# HOW
#   Every release's per-package tags point at a single commit (verified: all
#   17 historical releases have exactly one distinct target commit), so the
#   mapping is derived from the repo rather than hardcoded — except 1.11.0,
#   which was published to npm by the now-removed "quick publish" path and has
#   no changesets tag at all. Its anchor is the commit that set
#   packages/cli/package.json to 1.11.0.
#
# USAGE
#   scripts/backfill-release-tags.sh                     # dry run
#   scripts/backfill-release-tags.sh --create            # create locally
#   scripts/backfill-release-tags.sh --push [remote]     # push what is missing
#   scripts/backfill-release-tags.sh --create --push [remote]
#
#   Default remote is `github`. Idempotent and safe to re-run: an existing tag
#   pointing at a DIFFERENT commit is reported and left alone (never moved), and
#   only tags the remote lacks are pushed. --create and --push are independent,
#   so a creation run and a later push run both work.

set -euo pipefail

CREATE=false
PUSH=false
REMOTE="github"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --create) CREATE=true; shift ;;
    --push)   PUSH=true; shift ;;
    -h|--help) sed -n '2,32p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) REMOTE="$1"; shift ;;
  esac
done

# The one release with no changesets tag to derive from (see HOW above).
UNTAGGED_RELEASE_VERSION="1.11.0"
UNTAGGED_RELEASE_COMMIT="fe319957e17d0467286266d294cf71efcc09fa46"

# Tags that need creating locally.
declare -a TO_CREATE=()
# Every tag that SHOULD exist on the remote — whether we create it here or it
# already exists locally from an earlier --create run. Keeping these separate
# is what lets `--create` and `--push` be run as two steps: pushing must not
# depend on having just created the tag in the same invocation.
declare -a WANTED=()

collect() {
  local version="$1" commit="$2" note="${3:-}"
  local tag="v${version}"

  if git rev-parse -q --verify "refs/tags/${tag}" >/dev/null; then
    local existing
    existing="$(git rev-list -n1 "${tag}")"
    if [[ "${existing}" == "${commit}" ]]; then
      echo "  = ${tag} already exists locally at ${commit:0:7}"
      WANTED+=("${tag}")
    else
      echo "  ! ${tag} already exists at ${existing:0:7}, NOT ${commit:0:7} — left alone"
    fi
    return
  fi

  echo "  + ${tag} -> ${commit:0:7}${note:+  (${note})}"
  TO_CREATE+=("${tag}:${commit}")
  WANTED+=("${tag}")
}

echo "Release tags to backfill:"

# Derive every version that has at least one @buildpad/* changesets tag.
for version in $(git tag | grep -oE '@[0-9]+\.[0-9]+\.[0-9]+$' | tr -d '@' | sort -uV); do
  # `mapfile` is bash 4+; macOS ships bash 3.2, so read into an array by hand.
  commits=()
  while IFS= read -r line; do
    [[ -n "${line}" ]] && commits+=("${line}")
  done < <(
    git tag | grep -E "^@buildpad/.*@${version}$" | while read -r t; do git rev-list -n1 "$t"; done | sort -u
  )
  if [[ ${#commits[@]} -eq 0 ]]; then
    continue
  fi
  if [[ ${#commits[@]} -gt 1 ]]; then
    echo "  ! ${version}: per-package tags point at ${#commits[@]} different commits — skipped, resolve by hand"
    printf '      %s\n' "${commits[@]}"
    continue
  fi
  collect "${version}" "${commits[0]}"
done

# 1.11.0: published without any tag.
if git cat-file -e "${UNTAGGED_RELEASE_COMMIT}^{commit}" 2>/dev/null; then
  collect "${UNTAGGED_RELEASE_VERSION}" "${UNTAGGED_RELEASE_COMMIT}" "no changesets tag; anchored to the cli version bump"
else
  echo "  ! ${UNTAGGED_RELEASE_VERSION}: anchor commit ${UNTAGGED_RELEASE_COMMIT:0:7} not found in this checkout"
fi

if [[ ${#WANTED[@]} -eq 0 ]]; then
  echo
  echo "Nothing to do."
  exit 0
fi

if [[ "${CREATE}" != true && "${PUSH}" != true ]]; then
  echo
  echo "Dry run — ${#TO_CREATE[@]} tag(s) would be created, ${#WANTED[@]} would be pushed."
  echo "Re-run with --create to apply, --create --push to also publish them."
  exit 0
fi

if [[ "${CREATE}" == true && ${#TO_CREATE[@]} -gt 0 ]]; then
  echo
  for entry in "${TO_CREATE[@]}"; do
    tag="${entry%%:*}"
    commit="${entry#*:}"
    git tag -a "${tag}" "${commit}" -m "Release ${tag#v} (backfilled)"
    echo "created ${tag}"
  done
fi

if [[ "${PUSH}" != true ]]; then
  echo
  echo "${#WANTED[@]} tag(s) ready locally. Push them with:"
  echo "  scripts/backfill-release-tags.sh --push ${REMOTE}"
  exit 0
fi

# Push only what the remote is actually missing, so re-runs are quiet and a
# partially-completed push can simply be repeated.
missing=()
for tag in "${WANTED[@]}"; do
  if git ls-remote --exit-code --tags "${REMOTE}" "refs/tags/${tag}" >/dev/null 2>&1; then
    echo "  = ${tag} already on ${REMOTE}"
  else
    missing+=("${tag}")
  fi
done

if [[ ${#missing[@]} -eq 0 ]]; then
  echo
  echo "All ${#WANTED[@]} tag(s) are already on ${REMOTE}. Nothing to push."
  exit 0
fi

echo
echo "Pushing ${#missing[@]} tag(s) to ${REMOTE}..."
git push "${REMOTE}" "${missing[@]}"
echo "Pushed ${#missing[@]} tag(s) to ${REMOTE}."
