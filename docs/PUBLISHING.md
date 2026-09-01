# Publishing & Release Workflow

This guide covers how to publish `@buildpad/cli` and `@buildpad/mcp` to npm so end-users can run:

```bash
npx @buildpad/cli@latest init
npx @buildpad/cli@latest add button
```

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                      npm registry                                │
│  @buildpad/cli        – binary: npx @buildpad/cli            │
│  @buildpad/mcp        – binary: npx buildpad-mcp             │
└────────────────┬─────────────────────────────────────────────────┘
                 │
   User runs:    │  npx @buildpad/cli add input
                 │
                 ▼
┌──────────────────────────────────────────────────────────────────┐
│                    @buildpad/cli (npm)                          │
│                                                                  │
│  1. Loads registry.json (local if in monorepo, remote otherwise) │
│  2. Fetches source files from GitHub raw CDN, PINNED to the      │
│     `v<its own version>` release tag                             │
│  3. Transforms imports & copies to user's project                │
└────────────────┬─────────────────────────────────────────────────┘
                 │ fetch()
                 ▼
┌──────────────────────────────────────────────────────────────────┐
│      GitHub raw.githubusercontent.com                            │
│      buildpad-ai/ui/v<cli version>/packages/…                    │
│                                                                  │
│  registry.json        ← component manifest                      │
│  types/src/core.ts    ← source files                             │
│  hooks/src/useAuth.ts                                            │
│  ui-interfaces/src/…                                             │
└──────────────────────────────────────────────────────────────────┘
```

## Prerequisites

1. **npm account** — you're already logged in (`npm whoami`)
2. **npm org** — create `@buildpad` org on [npmjs.com](https://www.npmjs.com/org/create) (free for public packages)
3. **GitHub repo** — push this monorepo to GitHub
4. **GitHub secret** — add `NPM_TOKEN` to your repo's Actions secrets

---

## Branch Strategy

```
main  ←── stable, always publishable
  │
  ├── feat/new-component    ← feature branches
  ├── fix/datetime-bug
  └── chore/update-deps
```

| Branch | Purpose | Publishes? |
|--------|---------|------------|
| `main` | Stable release branch | Yes (via Changesets) |
| `feat/*`, `fix/*`, `chore/*` | Development branches | No (PR only) |

### Workflow

1. Create a feature branch from `main`
2. Make changes
3. Run `pnpm changeset` to describe what changed
4. Open a PR to `main`
5. CI runs build + tests
6. Merge PR → Changesets bot opens a "Version Packages" PR
7. Merge the version PR → packages are published to npm automatically

---

## One-Time Setup

### 1. Replace placeholder repository URL

Search for `buildpad-ai/ui` across:
- [packages/mcp-server/package.json](packages/mcp-server/package.json) → `repository.url` (package name: `@buildpad/mcp`)
- [packages/cli/src/resolver.ts](packages/cli/src/resolver.ts) → `DEFAULT_REGISTRY_URL`
- [.github/workflows/publish.yml](.github/workflows/publish.yml)

### 2. Create the npm org

```bash
# Check you're logged in
npm whoami

# The @buildpad scope must exist. If you haven't created it:
# Go to https://www.npmjs.com/org/create → org name: buildpad
```

### 3. Install dependencies

```bash
pnpm install
```

### 4. Generate a Granular Access Token

npm requires a **granular access token** to publish scoped packages (even with 2FA disabled).

1. Go to [npmjs.com → Access Tokens → Generate New Token](https://www.npmjs.com/settings/~/tokens)
2. Select **"Granular Access Token"**
3. Configure:
   - **Token name**: e.g. `buildpad-publish`
   - **Expiration**: choose an appropriate duration
   - **Packages and scopes**: select **"Only select packages and scopes"** → add `@buildpad`
   - **Permissions**: **Read and write**
4. Click **Generate token** and copy it

> **Important:** Legacy/Automation tokens may be rejected. Always use a **Granular** token.

#### For local publishing

Create a temporary `.npmrc` in the package directory:

```bash
echo "//registry.npmjs.org/:_authToken=YOUR_GRANULAR_TOKEN" > .npmrc
npm publish --access public
rm .npmrc  # Clean up after publishing
```

#### For GitHub Actions CI

1. Go to your GitHub repo → Settings → Secrets and variables → Actions
2. Add secret: `NPM_TOKEN` = your granular token

---

## Day-to-Day Release Workflow

### Step 1: Make changes on a feature branch

```bash
git checkout -b feat/new-datetime-picker
# ... make changes ...
```

### Step 2: Add a changeset

```bash
pnpm changeset
```

This prompts you to:
1. Select changed packages (`@buildpad/cli`, `@buildpad/mcp`)
2. Pick a bump type — see the table below
3. Write a summary

A `.changeset/<random-name>.md` file is created — commit it.

#### Bump types

Pick by **what changed**, not by how the change feels:

| bump | when |
|---|---|
| `major` | a breaking change to a published API or a consumer-visible contract |
| `minor` | any release that changes component source — **the default** |
| `patch` | docs, templates, MCP server, or CLI fixes only; no component source change |

`minor` is the default because it is the signal consumers read. A bug fix in
`packages/ui-collections/src/CollectionForm.tsx` is still `minor` — the
severity of the change does not matter, only whether there is new component
source to pull. This is the one place the convention departs from ordinary
semver habit, where a bug fix would be `patch`.

Two facts make the bump type a labelling decision rather than a functional
one, so getting it wrong is cheap to correct but easy to let drift:

- All 13 packages ship in lockstep (a single `fixed` group in
  `.changeset/config.json`), so every release moves every package to the same
  version. Changesets takes the **maximum** bump across all pending
  changesets — one `minor` in the queue makes the whole release a minor.
- Staleness is content-based, not version-based. `buildpad outdated` compares
  each file's `sourceSha256` against the manifest (see
  `packages/cli/src/utils/staleness.ts`); `lastChangedIn` in the registry is
  display data only. Consumers get the right answer regardless of what the
  version number says.

Nothing enforces this yet — the `registry:check` bump-type guard is deferred —
so it is applied by hand at review time.

### Step 3: Push and open a PR

```bash
git add .
git commit -m "feat: add new datetime picker"
git push -u origin feat/new-datetime-picker
```

Open a PR to `main`. CI will run automatically.

### Step 4: Merge to main

After review, merge the PR. The Changesets GitHub Action will:
- Detect unreleased changeset files
- Open a **"chore: version packages"** PR that bumps versions in `package.json` and updates CHANGELOGs

### Step 5: Merge the version PR

When you merge this PR:
- Changesets publishes to npm automatically
- Changesets creates one tag per package (e.g. `@buildpad/cli@2.0.0`)
- The workflow then creates **one plain `v<version>` tag** for the release
  (e.g. `v2.0.0`)

That plain tag is not cosmetic. The CLI pins every source fetch to
`v<its own version>`, so without it a published release is unreachable:
`add` cannot resolve its own sources and `upgrade` cannot resolve a diff3 base.
If a publish ever succeeds and the tag step does not, create the tag by hand at
the release commit before anyone installs that version.

---

## Manual Publishing (Alternative)

If you prefer not to use CI, publish manually:

```bash
# 1. Ensure you're on main and up to date
git checkout main && git pull

# 2. Add changeset (if not already done)
pnpm changeset

# 3. Apply version bumps
pnpm changeset version

# 4. Commit the version bump
git add .
git commit -m "chore: version packages"

# 5. Build all packages
pnpm build

# 6. Publish to npm
pnpm changeset publish

# 7. Push tags
git push --follow-tags
```

### Never publish outside this flow

There used to be a "quick publish" recipe here that ran `npm publish` directly
with a granular token. Do not do that, and do not reintroduce it.

A publish outside the workflow produces no `v<version>` tag, no changesets
tags, no CHANGELOG entry, and no commit that records the version. That is not
an inconvenience — it makes the release **unusable**. `@buildpad/cli@1.11.0`
was published this way: it exists on npm and nowhere in this repository, so
every consumer that installed it recorded `1.11.0` in `buildpad.json`, and
every three-way merge those consumers attempted degraded to a `.new` file
because no ref by that name could ever be found.

If a release must go out urgently, use the workflow_dispatch trigger on the
Publish workflow. It runs the same steps, tag included.

---

## What Gets Published

### `@buildpad/cli`

```
dist/
├── index.js          ← CLI entry point (bin: buildpad)
├── index.d.ts
├── templates/        ← scaffold templates (copied at build time)
│   ├── api/
│   ├── app/
│   ├── components/
│   ├── lib/
│   ├── middleware/
│   ├── supabase/
│   └── types/
└── ...
```

Users run:
```bash
npx @buildpad/cli@latest init        # scaffold project
npx @buildpad/cli@latest add input   # add component
npx @buildpad/cli@latest bootstrap   # full setup
```

### `@buildpad/mcp`

```
dist/
├── index.js          ← MCP server entry (bin: buildpad-mcp)
└── index.d.ts
```

Users configure in VS Code:
```json
{
  "mcp": {
    "servers": {
      "buildpad": {
        "command": "npx",
        "args": ["@buildpad/mcp@latest"]
      }
    }
  }
}
```

---

## Registry v2: Generated Artifact

`packages/registry.json` is **auto-generated** — never hand-edit it directly.

```
packages/registry.template.json   ← Hand-edited source (categories, aliases,
   │                                   dependencies, component metadata)
   │
   ▼  scripts/build-registry.mjs
   │
packages/registry.json            ← Generated artifact (includes versions,
                                     per-file SHA256 checksums, package map)
```

The generator (`scripts/build-registry.mjs`):
1. Reads all `packages/*/package.json` → produces a `packages` map with current semver and `changelogUrl`
2. For each component file, computes `sha256(source)` — the canonical hash of **untransformed** source bytes
3. Sets `lastChangedIn` from git history — **display data only** since manifest
   v3; no CLI decision reads it
4. Writes `packages/registry.json` with `schemaVersion: 2`

**Why SHA256 on untransformed source:** The CLI transforms imports based on each
consumer's alias config, so a hash of the *transformed* file differs per
consumer. The registry therefore hashes the raw source, and the CLI records
both: the registry's `sourceSha256` (to detect that **upstream** changed) and
its own hash of the transformed file (to detect that the **consumer** changed
it). Those two questions are independent, which is what lets `upgrade` leave a
locally-edited file alone when upstream did not move.

The root `package.json` wires this into the build (`ui-form` builds first — other packages need its `.d.ts`):
```json
{
  "scripts": {
    "build:registry": "node scripts/build-registry.mjs",
    "registry:check": "node scripts/build-registry.mjs --check",
    "build": "pnpm build:registry && pnpm --filter @buildpad/ui-form build && pnpm -r --filter '!@buildpad/ui-form' build"
  }
}
```

---

## How the Remote Registry Works

When `@buildpad/cli` is installed via npm (not running from the monorepo), it:

1. **Detects remote mode** — no `registry.json` exists next to the built CLI
2. **Resolves its ref** — `v<its own package.json version>`
3. **Fetches `registry.json`** from that ref:
   ```
   https://raw.githubusercontent.com/buildpad-ai/ui/v2.0.0/packages/registry.json
   ```
4. **Fetches individual source files** (e.g., `types/src/core.ts`) from the same ref
5. **Transforms imports** and writes files to the user's project, recording the
   ref in `buildpad.json`

### Why the fetch is pinned to a tag

The CLI used to read everything from `main`. The registry it read declared one
release version, but `main` moves between releases — so `add` copied
post-release content and recorded it under the *previous* release's version,
and `upgrade --three-way` then fetched a diff3 base older than what the
consumer actually had on disk. Merges ran against the wrong ancestor. Between
`1.10.0` and `1.11.1` that window covered 119 component and lib source files.

Pinning removes the window entirely:

- **Reproducible.** `npx @buildpad/cli@2.0.0 add input` resolves the same bytes
  on any day, on any machine.
- **Self-consistent.** The registry the CLI reads is always the registry built
  with that CLI, so schema compatibility holds by construction.
- **Cache-safe.** Tags are immutable, so no CDN cache can serve newer content.
- **Pin components by pinning the CLI.** There is no second version to manage.

`buildpad outdated` also asks npm for the `latest` dist-tag and prints a hint
when the running CLI is behind it — otherwise a pinned old CLI would honestly
report "up to date" against its own pinned registry forever. The check is
advisory and is skipped silently when npm is unreachable.

### Overriding the ref or the registry URL

```bash
# Read unreleased content from a branch (records ref: main in buildpad.json)
npx @buildpad/cli add input --ref main

# Same, via the environment
BUILDPAD_REF=main npx @buildpad/cli add input

# Point at a mirror or a local static server entirely
BUILDPAD_REGISTRY_URL=https://your-cdn.com/packages npx @buildpad/cli add input
```

Whatever a fetch actually resolved to is what gets recorded per file in
`buildpad.json`, so the next `upgrade` uses the true common ancestor.

### Local mode (development)

When running from the monorepo checkout (`pnpm cli add input`), the CLI detects `packages/registry.json` on disk and reads files locally — no network requests.

---

## Version Strategy

### Two classes of packages

| Type | Packages | Published to npm? | Versioned? |
|------|----------|-------------------|------------|
| **Publishable** | `@buildpad/cli`, `@buildpad/mcp` | Yes | Yes (semver) |
| **Private (source)** | `ui-interfaces`, `ui-form`, `ui-table`, `ui-collections`, `hooks`, `services`, `types`, `utils` | No (`private: true`) | Yes (semver via Changesets) |

Private source packages are **never published** — consumer apps get their source files copied via the CLI (Copy & Own model). However, they still carry semantic versions and `CHANGELOG.md` entries so the CLI can tell consumers exactly what changed.

### Lockstep semver (since 1.1.0)

All 10 `@buildpad/*` packages release **in lockstep** — same version, every release — via a single `fixed` group in `.changeset/config.json`. Components inherit the version of their source package:

```
@buildpad/ui-interfaces@1.1.0   ←  input, select-dropdown, datetime, …
@buildpad/ui-form@1.1.0         ←  vform
@buildpad/hooks@1.1.0           ←  useAuth, usePermissions, …
```

Lockstep does **not** make `buildpad outdated` noisy. Since manifest v3 the CLI
decides staleness by **content**, not by version: it compares the registry's
per-file `sourceSha256` with the hash recorded in `buildpad.json` at install
time. A lockstep bump that leaves a component's files byte-identical produces
no report for that component, whatever the version numbers say.

> **The old "version floor: never release below 1.1.0" rule is gone.** It
> existed only because staleness used to be `semverGte(installed, lastChangedIn)`,
> which made correctness depend on version arithmetic and on git tags being
> present when the registry was built. Nothing in the v3 path reads a version,
> a tag, or git history, so there is no floor to protect.

`lastChangedIn` is still written into the registry, but as **display data
only** — no CLI decision reads it.

Also bump the top-level `"version"` in `packages/registry.template.json` to the
release version. It is the registry's `release`, which the CLI records in
`buildpad.json` and shows in `outdated`; `changeset version` does not touch it.

### Changesets configuration

The `.changeset/config.json` is configured with `privatePackages` so Changesets bumps versions and writes `CHANGELOG.md` for private packages without trying to publish them:

```json
{
  "privatePackages": { "version": true, "tag": true }
}
```

This requires `@changesets/cli >= 2.27.10`.

### Fixed lockstep group

All 10 packages (publishable **and** private) are in one `fixed` group in changeset config — `pnpm changeset version` bumps them together to the same version. Do not remove packages from that group.

| Change | Bump | Example |
|--------|------|---------|
| Bug fix | `patch` | 1.1.0 → 1.1.1 |
| New component / feature | `minor` | 1.1.0 → 1.2.0 |
| Breaking CLI / component API change | `major` | 1.2.0 → 2.0.0 |

---

## Checklist Before First Publish

- [x] Repository URL points at `buildpad-ai/ui` (no rename redirect)
- [x] Create `@buildpad` org on npmjs.com
- [ ] Generate a **Granular Access Token** on npmjs.com (see "Generate a Granular Access Token" above)
- [ ] Add `NPM_TOKEN` secret to GitHub repo (using the granular token)
- [ ] Run `pnpm install` (installs `@changesets/cli`)
- [ ] Run `pnpm build` — verify CLI + MCP server build cleanly
- [ ] Test locally: `node packages/cli/dist/index.js list`
- [ ] Push to `main` and verify CI passes
- [ ] Run `pnpm changeset` → select packages → `patch` → "Initial release"
- [ ] Merge the resulting version PR
- [ ] Verify on npmjs.com: `@buildpad/cli` and `@buildpad/mcp` are published
- [ ] Test: `npx @buildpad/cli@latest init` in a fresh directory
