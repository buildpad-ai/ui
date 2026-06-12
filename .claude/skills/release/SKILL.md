---
name: release
description: Cut a lockstep release of all @buildpad packages — version bump, changelogs, registry rebuild, tag, npm publish. Use when the user asks to release, publish packages, bump versions for a release, or cut a new version.
---

# Buildpad Release

Releases ALL `@buildpad/*` packages in **lockstep**: every package ships the same version, every release (single `fixed` group in `.changeset/config.json`). Only `@buildpad/cli` and `@buildpad/mcp` are published to npm; the other 8 are `private: true` registry-source packages whose version feeds `packages/registry.json` (per-component `version` / `lastChangedIn`) — that is what drives `npx buildpad outdated` / `upgrade` in consumer apps.

Authoritative reference: `docs/PUBLISHING.md`. This skill is the operational checklist; if the two disagree, reconcile them in the same PR.

## Version policy (why lockstep, why ≥ 1.1.0)

- Consumer `buildpad.json` manifests created before per-package versioning recorded every component at `1.0.0`. The upgrade check is `semverGte(installedVersion, lastChangedIn)` — any release below `1.0.0` is invisible to those consumers. **Never go below the highest version any consumer manifest may have recorded.** The floor is `1.1.0` (released 2026-06).
- Lockstep is not noisy for consumers: `lastChangedIn` is tag-derived per component, so unchanged components don't get flagged by `outdated`.
- The top-level `"version"` in `packages/registry.template.json` must match the release version (v1-manifest consumers compare against it directly; `changeset version` does NOT update it — do it manually).
- Consumers fetch `registry.json` and sources from `raw.githubusercontent.com/microbuild-ui/ui/main/...` — **a release is live the moment it lands on `main`**, independent of npm publish.

## Primary flow — CI via Changesets (preferred)

The pipeline is `.github/workflows/publish.yml` (changesets/action on pushes to `main`):

1. **During feature work:** every PR that changes package source includes a changeset (`pnpm changeset` — pick the affected packages; the fixed group bumps all together anyway; pick patch/minor/major per docs/PUBLISHING.md table).
2. **Pre-release checks on the release PR:**
   - `pnpm build:registry && pnpm registry:check` — registry.json regenerated and committed (the artifact on `main` is what consumers download).
   - `pnpm build` passes (builds registry, then `ui-form` first for its `.d.ts`, then the rest).
3. **Merge to `main`** → the changesets action opens a **"chore: version packages" PR** (bumps all 10 `package.json`s, writes CHANGELOGs).
4. **On that Version Packages PR, before merging:** bump `packages/registry.template.json` top-level `"version"` to the new version and re-run `pnpm build:registry`; commit both to the PR. Verify all 10 packages got the SAME version.
5. **Merge the Version Packages PR** → CI publishes `@buildpad/cli` + `@buildpad/mcp` to npm and creates git tags (per-package tags incl. private packages — `privatePackages.tag: true`). Tags are what `build-registry.mjs` uses to derive `lastChangedIn` in FUTURE releases — they are load-bearing, never skip them.

## Fallback flow — manual local release

Only when CI is unavailable or for a forced realignment (like 1.1.0 itself):

1. Clean tree on `main` (up to date). `pnpm registry:check` passes before starting.
2. Choose the version: `npm view @buildpad/cli versions` — new version > latest published, > every `packages/*/package.json`, and ≥ the consumer floor (see policy above).
3. Apply: `pnpm changeset version` (if changesets pending) or set `"version"` in all 10 `packages/*/package.json` by hand AND hand-write `## X.Y.Z` CHANGELOG entries (changesets heading format — `### Minor Changes` / `### Patch Changes` — the CLI's `changelog`/`upgrade` commands parse these).
4. Bump `packages/registry.template.json` top-level `"version"`. Do NOT touch root `package.json` or `apps/*` (private, not released).
5. `pnpm build:registry && pnpm registry:check && pnpm build`.
6. Sanity:
   - `node packages/cli/dist/index.js --version` prints the new version (reads `package.json`; any other output means a hardcoded version regressed).
   - `node -e "const r=require('./packages/registry.json'); console.log(r.version, r.packages['@buildpad/ui-interfaces'].version)"` — both equal the new version.
   - Targeted tests: `pnpm --filter @buildpad/utils test`, `pnpm --filter @buildpad/cli test` (the full `ui-interfaces` jest suite has known stale-import failures — run targeted suites only).
7. Commit `chore(release): vX.Y.Z`, then `pnpm changeset publish` (publishes public packages, tags all incl. private), then `git push --follow-tags`.
8. Verify: `npm view @buildpad/cli version`, `npm view @buildpad/mcp version`, `npx @buildpad/cli@latest --version`.

Note: if versions were bumped by hand with no changesets pending, merging to `main` makes CI's `changeset publish` step publish anyway (it publishes any public package whose version is ahead of npm) — so a manual bump merged to `main` self-publishes.

## Branch strategy

`main` is the release branch — CI publishes from it. Feature work on `feat/*`, `fix/*`, `chore/*` branches, PR into `main`. The long-lived `release` branch in this repo is **legacy** (it carries the old manual `chore: update package versions to 0.1.x` flow that caused the versioning mess) — do not release from it.

## Known failure modes (history of this repo — do not repeat)

- **Versions below consumer-recorded versions** (0.1.x/0.2.0 released while manifests said 1.0.0) → upgrades silently never detected. Always compare against the consumer floor, not just npm.
- **No git tags** on release commits → `lastChangedIn` degrades to "everything changed every release".
- **Hardcoded versions** in `packages/cli/src/index.ts` and `packages/mcp-server/src/index.ts` drifted from `package.json` for several releases. Both now read `package.json` at runtime — never reintroduce a literal.
- **`registry.template.json` top-level version left stale** (sat at 1.0.0 across releases) while package versions moved.
- **Manual per-package bumps on the `release` branch without tags or lockstep** — error-prone; use the changesets flow.
- **Forgetting `pnpm build:registry` before merge** → `main` serves a `registry.json` whose hashes/versions don't match the sources consumers download. `pnpm registry:check` in CI guards this — never bypass it.
