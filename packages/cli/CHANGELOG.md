# @buildpad/cli

## 1.2.0

### Minor Changes

- Ship a generic `AuthenticatedShell` app-shell template (`.bp-*` design-token styles) in the scaffold, alongside the schema-driven `ContentLayout`.
- Fix `buildpad init`/`bootstrap` producing a project that fails `next dev` with "Cannot resolve '@supabase/ssr'": the minimal scaffold now declares the always-installed auth layer (`@supabase/ssr`, `@supabase/supabase-js`, `jose`).
- npm publishing support with remote GitHub-raw registry resolver (auto-detects local vs published).

## 1.1.0

### Minor Changes

- **Version realignment to 1.x.** Consumer manifests written before per-package versioning recorded component versions as `1.0.0`, while packages were versioned `0.1.x`–`0.2.0` — so `npx buildpad outdated` could never detect updates (`1.0.0 >= 0.2.0`). All packages now release in lockstep from `1.1.0` so the upgrade mechanism works for every existing install.

### Patch Changes

- `buildpad --version` now reads the version from `package.json` instead of a hardcoded string, so it can no longer drift from the published version.

## 0.2.0

### Minor Changes

- **`upgrade` command** — safely update installed components to the latest registry version. Per-file behaviour is driven by `--strategy`:
  - `overwrite` — replace file in-place (also the effect of `--yes`)
  - `new-file` — write upstream version as `<file>.new`, leave the original untouched
  - `three-way` — attempt a `diff3` merge; falls back to `.new` on conflict or when the base cannot be fetched offline
  - `prompt` (default TTY) — ask per file: skip / overwrite / write .new

- **`changelog` command** — print the CHANGELOG.md slice for a package or component since the installed version. Accepts either a package name (`@buildpad/ui-interfaces`) or a component name (`input`).

- **`migrate` command** — one-shot migration for v1 `buildpad.json` manifests. Re-fetches and re-transforms each installed component and lib module at its recorded version, computes SHA-256 checksums, and writes them into the v2 `components` / `lib` maps without touching any consumer file. Idempotent.

- **`buildpad.json` schema v2** — the manifest now tracks:
  - `schemaVersion: 2`
  - `components: Record<string, ComponentInstall>` with per-file `sha256` checksums
  - `lib: Record<string, ComponentInstall>` (same structure for lib modules)
  - `packageVersions: Record<string, string>` — one entry per source package

- **Stable origin header** — removed the volatile `@buildpad-date` field from the injected file header. Date-of-installation is now recorded only in `buildpad.json` (`installedAt`). This makes SHA-256 hashes reproducible: two identical installs on different days produce identical checksums.

- **`status` command** — now compares the SHA-256 of every installed file on disk (minus origin header) against the value recorded in `buildpad.json`. Reports `[pristine]` or `[modified]` per file.

- **`outdated` command** — upgraded to per-package semver comparison using the `packages` map in registry v2. Skips components whose files are byte-identical to the registry even when the package version bumped (`lastChangedIn` gating).

- **`add` command** — now records `files[].sha256` (hash of transformed content minus origin header) and updates `packageVersions` on every install.

- **Registry v2 resolver additions** — `fetchSourceAtVersion`, `buildPackageTag`, `buildVersionedSourceUrl`, `CHANGELOG_BASE_URL` for fetching historical source and changelog slices.

### Patch Changes

- `transformer.ts` gains `stripOriginHeader` and `hashTransformed` helpers. Hashing rule: strip header block → normalise CRLF→LF → trim trailing whitespace + single trailing newline → SHA-256.
- `three-way-merge.ts` wraps `node-diff3` with CRLF normalisation and standard git conflict markers (`<<<<<<< HEAD` / `=======` / `>>>>>>> upstream`).
- `checksum.ts` gains `inferSourcePackage` (maps registry path prefix → `@buildpad/*` package name) and `resolvePackageVersion` (per-package version lookup with graceful fallback).
- `validate.ts` now checks that every recorded `files[].sha256` is a valid 64-character hex string and warns when `packageVersions` is missing entries for installed components.
