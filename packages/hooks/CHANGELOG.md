# @buildpad/hooks

## 1.10.1

### Patch Changes

- @buildpad/services@1.10.1
- @buildpad/types@1.10.1
- @buildpad/utils@1.10.1

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

### Patch Changes

- Updated dependencies [5981327]
  - @buildpad/types@1.10.0
  - @buildpad/services@1.10.0
  - @buildpad/utils@1.10.0

## 1.9.3

### Patch Changes

- @buildpad/services@1.9.3
- @buildpad/types@1.9.3
- @buildpad/utils@1.9.3

## 1.9.2

### Patch Changes

- @buildpad/services@1.9.2
- @buildpad/types@1.9.2
- @buildpad/utils@1.9.2

## 1.9.1

### Patch Changes

- @buildpad/services@1.9.1
- @buildpad/types@1.9.1
- @buildpad/utils@1.9.1

## 1.9.0

### Patch Changes

- @buildpad/services@1.9.0
- @buildpad/types@1.9.0
- @buildpad/utils@1.9.0

## 1.8.1

### Patch Changes

- @buildpad/services@1.8.1
- @buildpad/types@1.8.1
- @buildpad/utils@1.8.1

## 1.8.0

### Patch Changes

- @buildpad/services@1.8.0
- @buildpad/types@1.8.0
- @buildpad/utils@1.8.0

## 1.7.0

### Minor Changes

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

### Patch Changes

- Updated dependencies [90dc795]
  - @buildpad/types@1.8.0
  - @buildpad/services@1.8.0
  - @buildpad/utils@1.8.0

## 1.6.0

### Patch Changes

- @buildpad/services@1.6.0
- @buildpad/types@1.6.0
- @buildpad/utils@1.6.0

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

### Patch Changes

- @buildpad/services@1.5.0
- @buildpad/types@1.5.0
- @buildpad/utils@1.5.0

## 1.4.1

### Patch Changes

- Updated dependencies
  - @buildpad/services@1.4.1
  - @buildpad/types@1.4.1
  - @buildpad/utils@1.4.1

## 1.4.0

### Patch Changes

- Released in lockstep; no functional changes.

## 1.3.1

### Patch Changes

- Released in lockstep; no functional changes.

## 1.3.0

### Patch Changes

- Released in lockstep; no functional changes.

## 1.2.0

### Patch Changes

- Released in lockstep; no functional changes.

## 1.1.0

### Minor Changes

- **Version realignment to 1.x.** Consumer manifests written before per-package versioning recorded component versions as `1.0.0`, while packages were versioned `0.1.x`–`0.2.0` — so `npx buildpad outdated` could never detect updates (`1.0.0 >= 0.2.0`). All packages now release in lockstep from `1.1.0` so the upgrade mechanism works for every existing install.

### Patch Changes

- `useRelationM2OItem.loadItem`: when the relation targets a non-`id` column, the selected item is loaded via a filter query (`filter[<targetField>][_eq]=<value>&limit=1`) instead of the by-id path route, which failed for values containing `/` or `:` (e.g. a `uri_path`). Relations targeting `id` are unchanged.

## 0.2.0

### Patch Changes

- Established per-package semver baseline. This package now carries its own independent version tracked via Changesets. Future releases will record component-level changes here so `npx buildpad outdated` and `npx buildpad changelog` can surface the relevant diff.
