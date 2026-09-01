# @buildpad/hooks

## 2.1.0

### Patch Changes

- @buildpad/services@2.1.0
- @buildpad/types@2.1.0
- @buildpad/utils@2.1.0

## 2.0.0

### Patch Changes

- @buildpad/services@2.0.0
- @buildpad/types@2.0.0
- @buildpad/utils@2.0.0

## 1.11.1

### Patch Changes

- 585362e: Batch of low/medium audit fixes across the relational stack.

  - All four relation item hooks (M2A, M2O, MultipleM2M, O2M) guard loadItems with a per-call request id, so an out-of-order response from a superseded call can no longer overwrite state with stale data.
  - ListO2M: editing a staged-created ($temp\_) row merges into its changeset.create entry instead of staging an update the backend can't resolve.
  - ListM2MInterface: the render-prop placeholder resolves {{field}} templates via the shared renderTemplate instead of printing the raw template string.
  - useRelationM2MItems requests the resolved junction PK field instead of a literal "id".
  - field-interface-mapper reads M2A allowed collections from snake_case `allowed_collections` (real DaaS storage) with camelCase fallback.
  - CollectionForm passes the loaded item's initial data (not schema defaults) as VForm initialValues.
  - ListM2M: header comment now documents that only junction-level operations are local-first; related-item edits persist immediately.

- 4a53873: useRelationM2AItems: alias the real junction primary key onto `.id` for fetched items, not just locally-created ones (R6.1/R6.2/R6.5).

  `displayItems` already aliased the real junction PK onto `.id` for locally-created items, but fetched items just spread the raw junction row through — so for any junction table whose PK isn't literally a column named `id`, `.id` was `undefined` on every fetched row. `ListM2A`'s React keys, drag-and-drop sortable ids, data-testids, and `JunctionItemForm`'s `junctionPrimaryKey` all read `.id` directly, so this silently broke React reconciliation and drag/drop for any non-`id`-named junction PK while leaving the actual save path unaffected (`removeItem`/`updateItem`/reorder already correctly resolved the real PK via `junctionPrimaryKeyField`, never `.id`).

- 2b8413c: ListM2A: drag reorder now works end-to-end and paginated sets are handled safely.

  - Multi-position drags previously looped moveItemUp/moveItemDown against stale state within one tick, staging only a single-position swap. handleDragEnd now computes the full reordered array once (arrayMove) and stages it with a single reorderItems call.
  - `useRelationM2AItems.displayItems` now orders items by the (possibly locally-staged) sort value. Staged reorders previously changed nothing observable: the list snapped back to fetch order and the emitted replace-mode payload — whose order is what the backend persists — kept the old order.
  - reorderItems/moveItemUp/moveItemDown accept a `pageOffset` so any future cross-page reorder writes global sort values instead of page-local 1..N.
  - Drag is now gated on `totalCount <= limit` (all pages, not the current page's row count) — reordering a paginated M2A emits a payload containing only the loaded page, which replace-mode would persist by deleting the other pages' junction rows. The drag-disabled notice uses the same condition, so paginated lists explain why drag is off instead of silently hiding the handles.

- 12f823c: ListM2M: paginated reorder writes global sort values, staged creates render only on the last page, and the broken batch-edit trigger is disabled.

  - `reorderItems`/`moveItemUp`/`moveItemDown` in useRelationMultipleM2M accept a `pageOffset` (ListM2M passes `(currentPage - 1) * limit`), so reordering on page 2+ no longer collides with every other page's 1..N sorts. The staged updates are emitted in the ChangesItem and persist on save.
  - `displayItems` now orders by the (possibly staged) sort value, so an arrow reorder is visible immediately instead of only after a server round-trip.
  - Locally staged creates previously rendered on every page (the hook appends all of `changes.create` to whatever page is fetched); ListM2M now shows them only on the last page, where totalCount already accounts for them.
  - The batch-edit button opened `CollectionForm(mode='edit', id=undefined)` — an empty broken form with no batch-apply logic behind it. It is now disabled with an explanatory tooltip until a real batch-edit flow exists.

- 2be8218: Fix ListM2M arrow-reorder misalignment with staged creates (N2).

  `moveItemUp`/`moveItemDown` in `useRelationMultipleM2M` recomputed their own "visible" array from the hook's unfiltered `displayItems` (includes every staged create, globally sorted), while `ListM2M` passed an `index` from its own page-local `visibleItems` (staged creates hidden on any page that isn't the last). Whenever a staged create existed, the two arrays disagreed and the arrow reorder moved the wrong item. Both functions now take the caller's exact page-local array instead of an index they re-derive differently — this is a breaking change to their signature (`(pageItems, index, pageOffset?)` instead of `(index, pageOffset?)`).

- 1226ec5: ListM2M: resolve the display-template label immediately when picking or creating an item, not just after save+reload.

  Picking an item via "Add Existing" only ever staged `{ [junctionField]: { id } }` locally, so a display template referencing e.g. `name` had nothing to resolve against and rendered a blank label until the parent form was saved and the list reloaded — most visible when adding a relation on a brand-new, unsaved parent, where no reload ever happens.

  The select modal has already loaded the rows it is showing, so `BulkAction.action` now receives them alongside the selected ids (`(selectedIds, selectedRows?)` — a new optional parameter, so existing bulk actions are unaffected), and the modal's list is asked for whatever fields the display template needs. `ListM2M` passes those rows to `selectItems`, which keeps them in display-only state so the label resolves immediately, with no extra request and no await between the click and the modal closing. "Create New" does the same with the record `CollectionForm` just returned.

  The staged junction payload deliberately stays reference-only (exactly the related primary key): `CollectionForm` distinguishes "link this existing row" from "deep-create a new one" by that object carrying nothing else, so display fields must never be merged into it. A regression test in `@buildpad/hooks` now pins that contract against the same flatten logic the save path uses.

- 944c25c: useRelationM2MItems: resolve the junction table's real primary key on every path, and fix the defects that surfaced once its per-row URLs started working.

  The junction PK is the identity behind every per-row URL this hook builds. For a junction whose PK column isn't literally named `id`, reading `.id` resolved to `undefined` and the request silently targeted `/api/items/{collection}/undefined` — which a string-PK backend answers 2xx, so the UI reported a delete or reorder that never happened.

  **The PK is now resolved once, defensively** (`relationInfo?.junctionPrimaryKeyField?.field ?? 'id'`, matching the sibling hooks) and used everywhere:

  - `loadItems` aliases it onto `.id`, but **guarded**: a row whose PK column is absent from the response is passed through untouched. Writing `undefined` over a real `id` would collapse every row onto one identity and point every URL at `/undefined` — worse than the bug the alias fixes. This is the rule `useRelationMultipleM2M` already documents.
  - `createJunctionItem` returns the created row aliased, and `selectItems` now returns the **server rows** rather than the request bodies it had built — those carried no primary key of any name, so a caller could never remove what it had just added, even when the PK was named `id`.
  - `removeItem` and `updateSortOrder` resolve the PK themselves rather than trusting `.id`, reject a row that has none instead of requesting `/undefined`, and encode it into the path.

  **Other defects fixed in the same paths:**

  - `loadItems` always fetches the related collection's primary key and the sort field, not just the junction PK. Without the related PK, `selectedPrimaryKeys` came back empty whenever the caller's `fields` omitted it, so the "already linked" filter excluded nothing and the user re-linked rows the junction already had.
  - `totalCount` is inferred from page fullness instead of `meta.total_count`, which on this DaaS build is the unfiltered count of the whole junction table — it reported every junction row in the database as this parent's count, producing phantom pages. The sibling hooks, FileManager and Upload all carry the same note.
  - `search` is sent whenever it is supplied. It was gated behind an optional `enableSearchFilter` that defaults to undefined, so a caller passing `search` alone had it discarded with no error.
  - `sortDirection` applies to the configured sort field, not only to a caller-supplied one, and a bare `sortField` is prefixed with the junction field exactly as `fields` entries are — otherwise it asked the backend to sort the junction table by a column that only exists on the related one.
  - `updateSortOrder` takes a `pageOffset` (defaulting to the last load's offset). Numbering rows 1..N per page collided with the previous page's values, so a reorder on page 2 interleaved the two pages on the next sorted load.
  - `selectItems` and `updateSortOrder` use `Promise.allSettled`. These are independent writes, so a rejection partway through still left the earlier rows committed while the UI reported total failure — and the retry duplicated them.
  - `moveItemUp`/`moveItemDown` bound both ends of the index. An index past the end — a row removed, or the page shrunk between render and click — used to fall through, writing `undefined` into the copied array and renumbering the real rows before throwing on it.
  - Mutations refresh the list, so `items`, `totalCount` and `selectedPrimaryKeys` are no longer stale behind a success toast, and newly linked rows are given a sort value instead of a NULL that made them clump.
  - `selectedPrimaryKeys` keeps a related key of `0`, which `.filter(Boolean)` discarded.
  - Overlapping loads are sequenced with a request-generation guard, so an older response can no longer overwrite a newer one.

  **useRelationM2A** now detects the junction table's primary key instead of hardcoding `{ field: 'id' }` at both relation-info construction sites. That hardcode made the junction-PK alias already shipped for M2A a no-op on exactly the junctions it was written for, and the test covering it hand-built the relation info, bypassing the producer.

  The hook's README examples are corrected: they documented `addItem` and `reorderItems`, which it does not return, and called `removeItem(tag.id)` with a bare id where the signature takes a junction row — reading `.id` off a string yields `undefined`, so the one documented path produced the very `/undefined` request this change eliminates, on every junction table.

- 1523349: M2M: alias the junction PK onto `.id`, fix the junction save path, and make ListM2M refetch on a record switch.

  - **Junction updates are no longer silently dropped on save.** `CollectionForm`'s M2M flush read the junction row's PK as a hardcoded `entry.id`, while the hook keys its staged update entries by the junction's real PK column. For any junction table whose PK isn't named `id`, every staged update (reorder, junction-field edit) was skipped and the save still reported success. The junction PK is now resolved from the schema and read by name, and a key mismatch throws instead of skipping.
  - **`useRelationMultipleM2M` aliases the junction PK onto `.id` for fetched items** (previously only locally-created ones got it), so `ListM2M`'s React keys, DnD sortable ids and drag-end matching work for junctions whose PK isn't `id`. The alias is applied after local edits are overlaid (a staged edit can carry its own `id`) and falls back to the row's existing `id` when the PK column is absent from the response, rather than overwriting every row's identity with `undefined`.
  - **Staged changes are discarded when the parent record changes.** Previously they survived, so navigating between records without a remount let record 1's staged links and deletions ride onto record 2 — and saving record 2 also mutated record 1.
  - **`existingItemCount` is inferred from page fullness** instead of `meta.total_count`, which on this backend is the unfiltered collection count. It reported the whole junction table as one parent's count, which disabled drag-and-drop entirely, hid staged creates behind a bogus page count, and rendered phantom pagination.
  - **`ListM2M` refetches when `primaryKey` switches to another record** (the load-signature dedupe omitted it, so the previous record's rows stayed on screen), and clears them when switching to an unsaved parent. `refreshKey` is compared separately from the signature so a record switch that also clears `value` doesn't fire the same query twice. Page, search and selection reset on the switch, and a failed load no longer poisons the dedupe permanently.
  - **Multi-select assigns distinct sort values.** Every id in one batch previously got the same value, losing the chosen order on save.
  - **The select modal's "already linked" exclusion covers every page**, not just the loaded one — it was offering items already linked elsewhere, staging duplicate links.
  - Smaller fixes: a guarded load no longer strands the loading state, and the junction-fields form is hidden for not-yet-saved rows rather than fetching a `$new-` sentinel id.

- 925e201: useRelationM2M/useRelationO2M resolve real primary keys instead of hardcoding "id", and ListO2M keys rows by the resolved PK.

  - `relatedPrimaryKeyField`, `junctionPrimaryKeyField` (M2M) and `relatedPrimaryKeyField`, `parentPrimaryKeyField` (O2M) were hardcoded to `id`/`uuid` (junction: `id`/`integer`). They are now detected from the collection schema (`is_primary_key`), the same way useRelationM2A already does, with the old values as a graceful fallback when the schema can't be read.
  - `useRelationO2MItems` and ListO2M now key every read/write off the resolved PK field. Hardcoded `.id` made removeItem/deleteItem/reorderItems hit `/api/items/{collection}/undefined` (silent no-ops) and corrupted staged-change matching, React keys, and checkbox selection for any related collection whose PK isn't literally `id`.
  - `resolveRelationFields` drops the bootstrap `"id"` default from `fields=` queries when the resolved PK isn't `id` — that placeholder referenced a column that doesn't exist on such collections and 500'd the request. (Overlaps in intent with PR #99's M2M-side fix; reconcile when both land.)
  - Known limit, unchanged here: ListO2M's emitted payload entries still key items by a literal `id` property. That backend-contract check has since been done (see the ListO2M changeset in this same release): the literal `id` is what the relation writer actually reads, because `directus_relations.many_primary` is always `"id"` in practice — so this shape is correct, and supporting a non-`id` PK on the write path needs a backend change rather than a client one.

- Updated dependencies [585362e]
- Updated dependencies [89f532b]
- Updated dependencies [c67c651]
- Updated dependencies [ddbc1bd]
- Updated dependencies [50a4057]
- Updated dependencies [577eda9]
  - @buildpad/utils@1.11.1
  - @buildpad/services@1.11.1
  - @buildpad/types@1.11.1

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
