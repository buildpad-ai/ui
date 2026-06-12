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
│  2. Fetches source files from GitHub raw CDN                     │
│  3. Transforms imports & copies to user's project                │
└────────────────┬─────────────────────────────────────────────────┘
                 │ fetch()
                 ▼
┌──────────────────────────────────────────────────────────────────┐
│      GitHub raw.githubusercontent.com                            │
│      microbuild-ui/ui/main/packages/…                            │
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

Search for `microbuild-ui/ui` across:
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
2. Pick bump type: `patch` (bug fix), `minor` (new feature), `major` (breaking)
3. Write a summary

A `.changeset/<random-name>.md` file is created — commit it.

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
- Git tags are created (e.g., `@buildpad/cli@0.2.0`)

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

### Quick publish (skip changesets)

For a one-off publish without the changeset flow, use a granular access token:

```bash
# Build
pnpm build

# Publish CLI
cd packages/cli
echo "//registry.npmjs.org/:_authToken=YOUR_GRANULAR_TOKEN" > .npmrc
npm publish --access public
rm .npmrc

# Publish MCP server
cd ../mcp-server
echo "//registry.npmjs.org/:_authToken=YOUR_GRANULAR_TOKEN" > .npmrc
npm publish --access public
rm .npmrc
```

> **Note:** Always clean up `.npmrc` files after publishing to avoid committing tokens.
>
> The packages are published as `@buildpad/cli` and `@buildpad/mcp` on npmjs.com under the `@buildpad` organization.

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
3. Sets `lastChangedIn` from git history (so `outdated` can skip "package bumped but file is byte-identical" cases)
4. Writes `packages/registry.json` with `schemaVersion: 2`

**Why SHA256 on untransformed source:** The CLI transforms imports based on each consumer's alias config. By hashing the raw source in the registry and letting the CLI hash the transformed local file, we avoid per-consumer hash drift while still detecting local modifications.

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
2. **Fetches `registry.json`** from GitHub raw URL:
   ```
   https://raw.githubusercontent.com/microbuild-ui/ui/main/packages/registry.json
   ```
3. **Fetches individual source files** (e.g., `types/src/core.ts`) from the same base URL
4. **Transforms imports** and writes files to the user's project

### Overriding the registry URL

```bash
BUILDPAD_REGISTRY_URL=https://your-cdn.com/packages npx @buildpad/cli add input
```

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

Lockstep does **not** make `buildpad outdated` noisy: each component's `lastChangedIn` is derived from git tags by `scripts/build-registry.mjs`, so components whose files didn't change keep their older `lastChangedIn` and consumers stay "up to date".

> **⚠️ Version floor: never release below `1.1.0`.** Consumer `buildpad.json` manifests written before per-package versioning recorded every component at `1.0.0`, and the CLI's outdated check is `semverGte(installed, lastChangedIn)`. The `0.1.x`–`0.2.0` series was therefore invisible to all existing consumers — upgrades silently never triggered. Versions must only move forward from `1.1.0`.

Also bump the top-level `"version"` in `packages/registry.template.json` to the release version — v1 manifests compare against it directly, and `changeset version` does not touch it.

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

- [ ] Replace `microbuild-ui/ui` with actual repo path (if different)
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
