# @buildpad/cli

## 1.8.1

### Patch Changes

- c9c8473: `buildpad upgrade` now installs npm dependencies that a new component or lib-module version introduces. Previously it copied the new source but never checked the registry-declared `dependencies`, so an upgrade could leave the app with unresolvable imports (e.g. rich-text-markdown 1.8.0 added `@tiptap/extension-table`, `tiptap-markdown` and `marked`). Missing deps are now detected after upgrading, pinned to their tested ranges, and installed with the package manager the app's lockfile implies — with confirmation, or automatically under `--yes`; `--dry-run` lists what would be installed. The dependency pin map moved to a shared util used by both `add` and `upgrade`, and gained pins for `@tiptap/extension-table`, `tiptap-markdown` and `marked`.

## 1.8.0

## 1.7.0

### Minor Changes

- 6db435b: `add` no longer silently keeps stale copies of already-installed components.
  When a requested component or a transitive `registryDependencies` entry is
  installed at a version older than the registry's `lastChangedIn` for it:

  - **Unmodified copy** (every recorded file matches its install-time sha256, or
    is missing from disk) → refreshed in place automatically, with an info line.
    This makes one-step installs like `add users-routes` pick up updated
    dependencies (e.g. `system-permissions`) instead of leaving the old copy.
  - **Locally edited copy** → kept untouched, with a warning that names the
    versions and points at `npx buildpad upgrade <name>` (three-way merge).
    A direct interactive `add <name>` additionally offers an explicit
    discard-and-overwrite prompt.

  Up-to-date and pre-tracking (v1 / no install record) components keep the
  previous skip behavior. Lib modules are unchanged (they already self-heal on
  missing files); content-stale lib modules remain a `buildpad upgrade` concern.

- 90dc795: New users-management module: `@buildpad/ui-users` package with the full RBAC
  admin surface — `UsersManager`/`UserDetail` (role assignment, status, static
  token, direct policy attachment), `RolesManager`/`RoleDetail` (hierarchy,
  scope-assignment rules, membership management, policy attachment), and
  `PoliciesManager`/`PolicyDetail` (access flags + per-collection permissions
  matrix via `system-permissions`). Adds `useUsers`/`useRoles`/`usePolicies`/
  `useAccess` hooks and `parseDaaSError` to `@buildpad/hooks`, `User`/`Role`/
  `Policy`/`Access` types to `@buildpad/types`, and the `users-management`
  component + `users-routes` lib module (six page templates) to the registry.
  Ships a Playwright e2e suite (`playwright.users.config.ts`, `test:users:*`
  scripts) with an API-tier module-flow + RBAC-matrix spec and a Storybook-tier
  smoke spec, verified against a live DaaS4 instance.

## 1.6.0

### Minor Changes

- Add the `form-builder` component and `forms-routes` module scaffolds for the new Dynamic Form Builder (`/forms`, `/forms/new`, `/forms/[id]`, `/forms/[id]/fill`), standardized on "form" terminology with breadcrumbs and improved empty/creation UX. The `AuthenticatedShell` header now derives a breadcrumb from the route for pages not in the sidebar nav.

## 1.5.0

### Minor Changes

- 94604c9: Add a packaged Files management module so consumers don't have to hand-build the `/files` Studio experience.

  - New `@buildpad/ui-files` package: `FileManager` (drag-and-drop upload, import-from-URL, folders, grid/list views, search, bulk delete) and `FileDetail` (metadata edit + image/video/audio/PDF preview), shipped as the `file-manager` registry component.
  - New `useFolders` hook and `tags`/`location` support on `useFiles` file metadata.
  - New CLI scaffolds: `files-routes` (the `/files` and `/files/[id]` pages) plus `/api/files/import`, `/api/folders`, and `/api/folders/[id]` proxy routes.

- 94604c9: Bring the Files module to feature parity with the DaaS Studio.

  - **RBAC gating**: `FileManager`/`FileDetail` accept a `filesCollection` prop (default `daas_files`) and gate upload, new folder, delete, and edit via `usePermissions` (admin bypass; optimistic while loading).
  - **List view**: select-all header checkbox and a per-row actions menu (Edit / Download / Delete); file cards show a category badge with an image-error fallback; upload progress bar.
  - **File detail**: two-column layout adding a read-only info panel (`FileInfoPanel` — id+copy, MIME, size, dimensions, duration, storage, timestamps), move-to-folder selector, focal-point X/Y for images, replace-file, open-in-new-tab, and signed-URL download.
  - **Folder rename** UI (reuses the folder dialog).
  - **Data layer**: `useFiles` gains `replaceFile` and `getDownloadUrl`, `updateFile` accepts focal point, and the file view-model carries `storage`/`duration`/`focal_point_*`.
  - New `/api/files/[id]/download` proxy route template.

## 1.4.1

## 1.4.0

### Minor Changes

- Bootstrap now renders `AuthenticatedShell` by default: the generated `app/(authenticated)/layout.tsx` wraps pages in the app shell, and the home page is scaffolded at `app/(authenticated)/page.tsx` so `/` shows the header + sidebar after login.
- `api-routes` now depends on `design-system`, so the shell component is always present when the auth layout is installed.

## 1.3.1

### Patch Changes

- Fix scaffolded `app/layout.tsx` not importing `@mantine/dates/styles.css` — the `datetime` calendar rendered unstyled/inline. `@mantine/dates` + `dayjs` are now always installed.

## 1.3.0

### Minor Changes

- Add `buildpad upgrade --design` and make the design foundation a registry-tracked `design-system` lib module (design tokens, globals, theme, ColorSchemeToggle, AuthenticatedShell). `init`/`bootstrap` install it tracked; `outdated` reports it; three-way merge preserves local token edits.
- Generalize `upgrade` to handle lib modules (not just components), with an adoption path for projects that predate tracking.
- Fix bootstrap gap: install the `external-oauth` module during `--with-api`/`--all` so the api-routes auth handlers can resolve `@/lib/oauth/*` (previously `next dev` failed with "Can't resolve '@/lib/oauth/config'").
- build-registry now stamps lib modules with version/lastChangedIn; registry.json is bundled into the CLI for offline `init`.

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
