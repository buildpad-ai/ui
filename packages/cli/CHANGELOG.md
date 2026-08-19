# @buildpad/cli

## 1.11.1

### Patch Changes

- 56c14ae: CLI: fix a broken relative import the transformer never rewrote, and an implicit-`any` in the external-OAuth callback template.

  `normalizeImportPaths` only rewrote relative imports whose _first_ path
  segment was PascalCase (e.g. `../Upload/Upload` → `./upload`). A sibling
  import like `../select-icon/SelectIcon` — where the folder is already
  kebab-case but the filename is still PascalCase — never matched, so it
  shipped unrewritten even though `select-icon` is delivered as the flat
  sibling `components/ui/select-icon.tsx`, not a `select-icon/SelectIcon.tsx`
  directory. This broke every component that imports from `select-icon`:
  `select-dropdown`, `select-multiple-checkbox`, `select-multiple-dropdown`,
  and `select-radio` all shipped a `TS2307: Cannot find module
'../select-icon/SelectIcon'` on a fresh install. Both the static
  `from '../select-icon/SelectIcon'` and dynamic
  `import('../select-icon/SelectIcon')` forms are now flattened to
  `./select-icon`.

  `auth-callback-oauth-route.ts` (installed by the `external-oauth` lib
  module) left `setAll(cookiesToSet)` without the parameter type its sibling
  templates (`lib/supabase/server.ts`, `lib/supabase/middleware.ts`) already
  carry, producing three `TS7006`/`TS7031` implicit-`any` errors under strict
  mode.

- f4473b4: Fix `buildpad upgrade --all` (and bare `--force`) silently skipping installed lib modules.

  `--all` only populated `targetComponents`, never `targetLibModules`, so lib-module files
  (`lib/buildpad/utils/index.ts`, `lib/buildpad/types/index.ts`, `design-system`, etc.) were
  never re-synced no matter what flags were passed — only named components were. This is why
  running `upgrade --all --force` after a barrel-export fix landed upstream did not pick up
  the fix: the export lives in a lib module, and `--all` never even attempted to touch it.

  `--all` and bare `--force` now also resolve `targetLibModules` from `config.installedLib`,
  matching how `--design` and the default (no-flag) outdated-detection path already do.

- 89f532b: CLI: deliver `conceal.ts`, close the stranded utils exports, and make the registry hash platform-independent.

  `utils/src/conceal.ts` was never registered as a `utils` lib file, so `buildpad add/upgrade utils` had no way to deliver it. Five registry-delivered files already imported it — `InputHash`, `SystemToken`, `FormFieldInterface`, `CollectionForm` and `FormField` — and failed to build in consumer projects. It is now registered as `lib/buildpad/conceal.ts` and re-exported from the utils barrel.

  The barrel had also drifted across three separate commits, not one. Alongside conceal's members it now re-exports `getDefaultValuesFromFields`, `resolveChoiceLabel`, `parseChoiceValues`, `splitCsvValue`, `InterfaceChoice`, `MISSING_FIELD_MARKER`, the auto-generation helpers, and the `interface-types` / `interface-registry` / `define-interface` modules — all of which ship to consumers but had no reachable export path.

  Also fixed, because the drift was undetectable rather than unlucky:

  - `computeFileSha256` now hashes line-ending-normalised content, and a `.gitattributes` pins `eol=lf`. Hashing raw bytes made the registry platform-dependent: generated on a CRLF checkout, its hashes could never match an LF checkout, so `pnpm registry:check` failed permanently and its output was pure noise. `registry:check` now passes.
  - CI runs build, typecheck and unit tests _before_ the registry check. Fail-fast meant the red check aborted the job before any of them ran.
  - `collectUndeclaredImports` now scans `registry.lib`, resolving relative imports in target space. It previously covered components only, which is why a barrel could re-export a module that was not a registry file at all.
  - `@buildpad/cli` is now a known package folder, so `cli/templates/*` files are no longer exempt from the version guard.
  - `build-registry.mjs` only self-executes when invoked directly. The previous guard was always true, so importing it — as the test suite does — rewrote the checked-in `registry.json`.
  - `buildpad upgrade <lib>` no longer reports "up to date" when a registered file is missing on disk. A module that gains a file could not be delivered by version comparison alone, because the version cannot move until a release.
  - `buildpad add` no longer rewrites existing lib files when a module gains one. Adding a file made the "already installed" check fail, and every consumer's customised copies were silently overwritten.
  - The CLI now verifies fetched sources against the registry's `sourceSha256` and warns on mismatch. The field was written but never read.
  - `useModuleAccessKeys` and `module-access-keys` are registered and exported, and the types barrel re-exports `module-access`. `buildpad add users-management` previously produced a project that could not build.

## 1.10.0

### Minor Changes

- 5981327: Add first-class support for **Module-Level Access** — application capability
  flags that are not tied to a collection — and retire the superseded
  `custom_permissions` approach.

  DaaS has two independent permission dimensions. Record-Level Access
  (`daas_permissions`) covers collection CRUD; Module-Level Access
  (`daas_policies.module_access`, keyed by the `daas_module_access_keys` registry)
  covers named capabilities like `reports:export`. The platform has shipped the
  second dimension, but this repo had no support for it at all — so every
  `hasModuleAccess(...)` call the agent skills instruct agents to write was a
  runtime error.

  **New API**

  - `@buildpad/types` — `ModuleAccessKey`, `ModuleAccessMap`,
    `MODULE_ACCESS_KEY_PATTERN`, `RESERVED_MODULE_ACCESS_NAMESPACES`, and
    `Policy.module_access`.
  - `@buildpad/services` — `PermissionsService.hasModuleAccess()` / `.moduleAccess`
    / `.ensureLoaded()`, plus `ModuleAccessKeysService` for registry CRUD (via the
    generic items API — DaaS exposes no dedicated route) and `buildModuleAccessTree`.
  - `@buildpad/hooks` — `usePermissions()` now returns `moduleAccess` and
    `hasModuleAccess`; new `useModuleAccess(key)`, `useModuleAccessMap()`, and
    `useModuleAccessKeys()`.
  - `@buildpad/ui-users` — `ModuleAccessPanel` (mounted as the "Module-Level
    Access" tab of `PolicyDetail`, beside the renamed "Record-Level Access" tab)
    and `ModuleAccessKeysManager` for the registry.
  - `@buildpad/cli` — `lib/module-access/enforce.ts` server guard
    (`enforceModuleAccess` → `ModuleAccessError(403)`) and the
    `/module-access-keys` page; both registered.
  - `@buildpad/mcp` — new `get_module_access_pattern` tool; `get_rbac_pattern`
    now returns a `moduleAccess` section pointing at it, so agents stop reaching
    for role-name checks on non-CRUD gates.

  **`hasModuleAccess` fails closed.** It returns `false` while loading and on
  error — deliberately unlike `canPerform`, which is optimistic. A capability flag
  gates something the user is presumed _not_ to have, so an unresolved state must
  never render the gated control. Render a skeleton while `loading` if flicker
  matters.

  **Permission caches are now scope-keyed.** DaaS resolves `/permissions/me`
  against the active Resource URI, so `PermissionsService`'s 30s cache keys on the
  `daas_resource_uri` cookie and `usePermissions` refetches when it changes.
  Without this a tenant switch served the previous tenant's permissions.

  **Removed:** `cli/templates/lib/permissions/custom.ts` and
  `cli/templates/components/CustomPermissionsEditor.tsx`. These implemented the
  superseded `custom_permissions` design and were non-functional against current
  DaaS — the column and the `/api/permissions/me/custom` endpoint they depend on
  do not exist. They were never in the registry, so `buildpad add` could not
  install them; no project can have them via tooling. Projects that copied them by
  hand should migrate to Module-Level Access (keys must be lowercased to satisfy
  the platform key format).

## 1.9.3

## 1.9.2

## 1.9.1

## 1.9.0

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
