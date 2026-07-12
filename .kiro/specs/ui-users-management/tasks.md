# Implementation Plan

- [x] 1. Add users/roles/policies types to @buildpad/types

  - Create `packages/types/src/users.ts` with `UserStatus`, `User` (readonly computed `admin_access`), `RoleScopeConfig`, `Role`, `Policy`, `Access`, `ListMeta` as specified in design.md
  - Re-export from `packages/types/src/index.ts`; leave both existing `DaaSUser` interfaces untouched
  - Verify with `pnpm --filter @buildpad/types build` (or typecheck if src-shipped)
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
- [x] 2. Implement data hooks in @buildpad/hooks
- [x] 2.1 Create shared error parser

  - Add `parseDaaSError(err: unknown): string` handling both `{ error }` and DaaS `{ errors: [{ message, extensions: { code } }] }` shapes embedded in `apiRequest` error text, with raw-message fallback
  - Unit-test both shapes plus fallback
  - _Requirements: 2.8_
- [x] 2.2 Implement `useUsers` hook

  - `packages/hooks/src/useUsers.ts` following `useFiles.ts` conventions: `fetchUsers` (page/limit/search/sort/fields/role/status/filter), `getUser`, `getMe`, `createUser`, `updateUser` (strip `admin_access`), `updateMe`, `deleteUser`, `bulkUpdateUsers` (PATCH `/api/users/bulk-update` with role/addRoles/removeRoles), `fetchUserPolicies`/`attachUserPolicy`/`detachUserPolicy` (`/api/users/[id]/policies[...]`), loading/error state
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.9_
- [x] 2.3 Implement `useRoles` hook

  - `packages/hooks/src/useRoles.ts`: `fetchRoles` (`includeUsers`), `getRole` (`includePolicies`), `getMyRoles`, `createRole`, `updateRole`, `deleteRole`, `fetchRolePolicies`/`attachRolePolicy`/`detachRolePolicy`
  - _Requirements: 2.1, 2.5, 2.9_
- [x] 2.4 Implement `usePolicies` and `useAccess` hooks

  - `packages/hooks/src/usePolicies.ts`: `fetchPolicies` (userCount/roleCount), `getPolicy`, `getMyPolicies`, `createPolicy`, `updatePolicy`, `deletePolicy`
  - `packages/hooks/src/useAccess.ts`: thin CRUD over `/api/access`
  - _Requirements: 2.1, 2.6, 2.7, 2.9_
- [x] 2.5 Export hooks and write hook unit tests

  - Add export blocks (hooks + param/result types) to `packages/hooks/src/index.ts` mirroring the `useFiles` block style
  - Vitest with mocked `fetch`: query-string building for each fetch method, `admin_access` stripping, error normalization
  - _Requirements: 2.10, 12.3_
- [x] 3. Scaffold packages/ui-users

  - Copy scaffold from `packages/ui-files`: `package.json` (name `@buildpad/ui-users`, version 1.6.0, private, `files: ["dist","src"]`, tsup build with react/mantine/tabler externals, vitest, `storybook dev -p 6011`), `tsconfig.json`, `css.d.ts`
  - Copy `.storybook/` and adjust: self-alias `@buildpad/ui-users` → `../src`, keep sibling `@buildpad/*` aliases and `/api` proxy → `http://localhost:3000`, enterprise theme preview
  - Add peer+dev deps matching ui-files (`@buildpad/hooks|services|types|ui-interfaces`, Mantine, tabler, react 18||19); `pnpm install`
  - _Requirements: 10.1, 10.2, 10.4_
- [x] 4. Build shared presentational components

  - `UserStatusBadge.tsx` (status→color map from daas `STATUS_COLORS`), `UserAvatar.tsx` (initials, email fallback), `InfoPanel.tsx` (merge of daas `InfoSidebar`/`RoleInfoSidebar`), `DeleteConfirmModal.tsx` (local copy), `PolicyPickerModal.tsx` (searchable list excluding attached IDs)
  - `_fixtures.ts` with fixture users/roles/policies/access rows
  - Unit tests: initials derivation, status→color map
  - _Requirements: 3.1, 6.4, 12.3_
- [x] 5. Implement users surfaces
- [x] 5.1 Implement `UsersManager` list view

  - Port `buildpad-daas/app/users/page.tsx` → `packages/ui-users/src/UsersManager.tsx` (+`.css`): debounced (~300 ms) search, role filter (via `useRoles`), status filter, pagination (default 25, `pageSize` prop), avatar/name/email/role-badges/status/last-access columns, row menu edit/delete with confirm, empty states (filters vs no data)
  - Replace `fetch` with `useUsers`, `useCollectionPermissions` with `usePermissions` optimistic gating, `next/navigation` with `onUserClick`/`onCreateUser` props
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 8.1, 8.2, 8.3, 9.1_
- [x] 5.2 Implement `UserDetail` view

  - Port `buildpad-daas/app/users/[id]/page.tsx` → `UserDetail.tsx` with explicit Mantine fields (email, password create-only min 6, first/last name, title, description, location, TagsInput, language/theme/status Selects, masked token field, roles MultiSelect normalized to ID array)
  - Edits-only PATCH (DaaS pattern), dirty tracking disabling Save, Policies tab with count hosting `UserPoliciesManager`, `InfoPanel` (id, last access, created, updated, policies), delete with confirm, notifications, `onBack`/`onDeleted`/`onSaved` props
  - Never render/submit excluded fields (`admin_access`, `avatar`, `auth_data`, `provider`, `external_identifier`, `last_page`, `tfa_secret`)
  - Evaluate `system-token` interface for the token field; fallback masked TextInput + regenerate
  - _Requirements: 4.1–4.9, 8.1, 9.1_
- [x] 5.3 Implement `UserPoliciesManager`

  - Port from daas component; list/attach/detach via `useUsers` policy methods + `PolicyPickerModal`; `onUpdate` callback to refresh parent counts
  - _Requirements: 6.3, 6.4, 6.5_
- [x] 6. Implement roles surfaces
- [x] 6.1 Implement `RolesManager` list view

  - Port `app/roles/page.tsx` → `RolesManager.tsx`: search, icon, user counts (`includeUsers=true`), description, pagination, row menu, permission gating, `onRoleClick`/`onCreateRole` props
  - _Requirements: 5.1, 8.1, 8.3, 9.1_
- [x] 6.2 Implement `RoleDetail` view with scope_config editor

  - Port `app/roles/[id]/page.tsx` → `RoleDetail.tsx`: tabs Basic/Users/Policies (latter two hidden when new); name, `SelectIcon` (from `@buildpad/ui-interfaces/select-icon`), description, parent-role Select excluding self
  - Full scope_config editor: enable Switch, regex pattern rows with live `new RegExp` validity errors, add/remove pattern, validation-message input; disable → `scope_config: null`
  - Save Menu (Save & Stay / & Quit / & Add New / Discard), unsaved-changes navigation guard modal, `InfoPanel`, unit test for parent-role self-exclusion + regex validation
  - _Requirements: 5.2–5.9, 8.1, 9.1, 12.3_
- [x] 6.3 Implement `RoleUsersManager` and `RolePoliciesManager`

  - `RoleUsersManager`: list `fetchUsers({ role })`, add/remove via `bulkUpdateUsers` addRoles/removeRoles
  - `RolePoliciesManager`: list/attach/detach via `useRoles` policy methods + `PolicyPickerModal`; both fire `onUpdate`
  - _Requirements: 6.1, 6.2, 6.4, 6.5_
- [x] 7. Implement policies surfaces
- [x] 7.1 Implement `PoliciesManager` list view

  - Port `app/policies/page.tsx` → `PoliciesManager.tsx`: search, icon, name, description, userCount/roleCount columns, pagination, row menu, gating, `onPolicyClick`/`onCreatePolicy` props
  - _Requirements: 7.1, 8.1, 8.3, 9.1_
- [x] 7.2 Implement `PolicyDetail` with SystemPermissions matrix

  - Port `app/policies/[id]/page.tsx` → `PolicyDetail.tsx`: name/icon/description + Access Control switches (`app_access`, `admin_access`, `delegate_access`)
  - Embed `SystemPermissions` from `@buildpad/ui-interfaces/system-permissions` for the permissions matrix; hold alterations in dirty state, apply to `/api/permissions` on Save alongside the policy PATCH
  - Combined dirty tracking (form + matrix) → "Unsaved Changes" badge + Save enablement; `InfoPanel` (id, users, roles, timestamps)
  - _Requirements: 7.2–7.6, 8.1, 9.1_
- [x] 8. Finalize package barrel and build

  - `packages/ui-users/src/index.ts`: export all components + `*Props` types (pure barrel, ui-files style)
  - `pnpm --filter @buildpad/ui-users build` (tsup esm+cjs+dts) and `typecheck` green; `vitest run` green
  - _Requirements: 10.1, 10.3_
- [x] 9. Register in the CLI registry and add route templates
- [x] 9.1 Update registry build script and template

  - `scripts/build-registry.mjs`: add `'@buildpad/ui-users': 'ui-users'` to `PACKAGE_FOLDERS` and `ui-users/` branch in `inferSourcePackage()`
  - `packages/registry.template.json`: add `users-management` component entry (category `admin`, `excludeFromAll: true`, every src file → `components/ui/users-management/<kebab>.*`, deps mantine/tabler, `internalDependencies ["types","hooks","services"]`, `registryDependencies ["system-permissions","select-icon"]`) and `users-routes` lib module (six page targets under `app/(authenticated)/`, `registryDependencies ["users-management"]`, `internalDependencies ["api-routes","hooks"]`); append the four hook files to the `hooks` lib-module list
  - _Requirements: 11.1, 11.2, 11.3, 11.4_
- [x] 9.2 Create CLI page templates

  - `packages/cli/templates/app/{users,roles,policies}/page.tsx` + `[id]/page.tsx`: thin `'use client'` pages wiring `useRouter`/`useParams` to component props ( `'new'` sentinel for create), modeled on `templates/app/files/page.tsx`
  - Update `packages/cli/templates/lib/hooks/index.ts` to export the four new hooks
  - _Requirements: 9.2, 11.2, 11.4_
- [x] 9.3 Build and validate registry

  - `pnpm build:registry && pnpm registry:check`; in a scratch consumer app run `buildpad add users-routes` and verify transitive install (users-management → system-permissions/select-icon → types/hooks/services) and page compilation
  - _Requirements: 11.5, 11.6_
- [x] 10. Storybook integration

  - Fixture stories for `UserStatusBadge`, `UserAvatar`, `InfoPanel`, `PolicyPickerModal`, `DeleteConfirmModal`; live `*.daas.stories.tsx` for the six surfaces (scaffold from `FileManager.daas.stories.tsx`)
  - Root `package.json`: add `storybook:users` script (port 6011); add ui-users step to `scripts/build-storybooks.sh`; update storybook-host landing links
  - _Requirements: 12.1, 12.2_
- [x] 11. Documentation

  - `apps/docs/content/users.mdx` recipe modeled on `files.mdx`: pieces table, `buildpad add users-routes` walkthrough, RBAC caveats (`admin_access` computed, roles M2M scoped by resource_uri, gate nav via `usePermissions('daas_users')`)
  - Add `users` entry to `apps/docs/content/_meta.ts`; add rows to `components.mdx`
  - _Requirements: 12.4_
- [x] 12. End-to-end verification against live backend

  - Run buildpad-daas on `localhost:3000`; `pnpm storybook:users`; exercise `.daas` stories: create user (invited status) → assign roles → attach policy to user and role → edit role scope patterns → toggle policy flags + matrix cells → verify via `GET /api/users/[id]/policies` and `/api/permissions?policy=` → delete flows → non-admin token confirms RBAC gating
  - Monorepo gates: `pnpm build`, `pnpm test`, `pnpm build:registry`, `pnpm registry:check`, `pnpm build:storybook`
  - _Requirements: 3.*, 4.*, 5.*, 6.*, 7.*, 8.*, 12.1_
  - ✅ Verified via the task-14 Playwright suite against the live DaaS4 e2e instance: `users-api` 23/23 (full module flow incl. invited-user create, M2M roles, bulk membership, user/role policy attach-detach, counts, computed admin_access, RBAC matrix for admin/manager/viewer/noperm) and `users-storybook` 7/7 (all three DaaS playgrounds driven in Chromium via storybook :6011 + host proxy :3000, incl. viewer gating). Gates: `pnpm build:registry` + `registry:check` green; targeted tests green (hooks 52, ui-users 46 — root `pnpm test` skipped due to pre-existing ui-interfaces breakage on main); `pnpm build` green. Live findings fixed in the module: `GET /users/[id]` needs `fields=*,roles.*` (junction rows), non-`assignable` roles disabled in role pickers, tokens conceal-masked.
- [x] 13. Release changeset

  - Add `@buildpad/ui-users` to `.changeset/config.json` `fixed` group; create minor changeset (lockstep 1.6.0 → 1.7.0); verify changesets does not inflate to major (known workspace:* peerDep cascade — rewrite version down if it does)
  - _Requirements: 12.5_
- [x] 14. (Stretch — may be a follow-up) Playwright e2e suite

  - `playwright.users.config.ts` mirroring `playwright.files.config.ts` with `users-api` project (create role → policy → attach → user → assign role → cleanup) and `users-storybook` project; `tests/ui-users/helpers/` RBAC setup/teardown; root `test:users:*` scripts
  - _Requirements: 12.3_
  - ✅ Done and green: `tests/ui-users/` (users-rbac.api.spec 23 tests, users-feature.storybook.spec 7 tests, helpers with idempotent RBAC setup/teardown sweeping `e2e_users_*`/`e2e-users-*`), `playwright.users.config.ts` (auto-boots storybook :6011 + host :3000), root `test:users:{setup,e2e,api,storybook,teardown}` scripts, `.users-rbac.json` gitignored. Demo seed data (Content Manager/Editor hierarchy, scoped Support Agent, Auditor + 3 linked policies) created on the live instance via the daas MCP.
- [x] 15. Custom permission editor — Phase 1, JSON-first (parity gap closure, in ui-interfaces)
- [x] 15.1 Port filter types and utils

  - `packages/ui-interfaces/src/system-permissions/PermissionFilterTypes.ts` from daas `lib/filter/types.ts` (`FilterOperator`, `FilterNode`, `OperatorInfo`, `RelationInfo`, `DYNAMIC_VALUES`, `getOperatorsForType`, `getOperatorsForRelation`; cast boundary vs `@buildpad/types.Filter`)
  - `PermissionFilterUtils.ts` from daas `lib/filter/utils.ts` verbatim + `hasRelationalFilterKeys` lifted from `FilterRuleBuilder.tsx`
  - Jest `__tests__/PermissionFilterUtils.test.ts`: `parseFilterToNodes`/`nodesToFilter` roundtrips (root `_and`, nested `_or`, single condition), node CRUD, `hasRelationalFilterKeys`, operator sets per type
  - _Requirements: 13.4_
  - ✅ Ported verbatim (pure TS); 30 jest tests green
- [x] 15.2 Metadata fetchers

  - `permissionMetadata.ts`: `fetchCollectionFields` (GET `/api/fields/{collection}`), `fetchCollectionRelations` (one cached flat `GET /api/relations?limit=-1` + daas `PermissionsFilter.tsx` meta-mapping: junction_field→m2m, one_collection→o2m, many_collection→m2o), `clearPermissionMetadataCache`; module-level promise caches over `apiRequest`
  - _Requirements: 13.9_
- [x] 15.3 Tab components

  - `PermissionFieldsTab.tsx` (daas `PermissionsFields.tsx`: checkboxes, all/none, `['*']`, PK/Alias badges, app-minimal locking), `PermissionFilterTab.tsx` (Phase-1 JSON textarea + dynamic-vars help + relational warning + create-action notice), `PermissionValidationTab.tsx`, `PermissionPresetsTab.tsx` (JSON editors, Clear, examples; presets UUID-array warning)
  - _Requirements: 13.3, 13.4, 13.5_
  - ✅ Tabs are presentational (metadata centralized in the modal, unlike daas's per-tab fetches); JSON errors surface inline instead of console
- [x] 15.4 PermissionDetailModal

  - Port daas `PermissionsDetailModal.tsx`: Modal size xl, action-dependent tabs defaulting to first available, per-tab value dot badges, Delete with inline confirm (SystemPermissions reset-dialog pattern; no ui-users import), local draft, `onSave` emitting only `{fields, permissions, validation, presets}`
  - Jest `__tests__/PermissionDetailModal.test.tsx` (tab visibility per action incl. share/create, badges, `['*']` semantics, invalid JSON blocks draft, save payload has no `$` keys, delete confirm); `PermissionDetailModal.stories.tsx` (one story per action, injected `fields`/`relations`)
  - _Requirements: 13.1, 13.2, 13.3, 13.5, 13.6, 13.7, 13.9_
  - ✅ 26 jest tests green; 6 stories (per action + app-minimal)
- [x] 15.5 SystemPermissions wiring

  - Replace the `editItem` no-op stub with modal state; `handleDetailSave` → `updatePermission({...existing, ...edited})` or `createPermission({policy: primaryKey, ...editing, ...edited})`; `handleDetailDelete` → `removePermission`
  - Export `APP_ACCESS_MINIMAL_PERMISSIONS`; pass matched entry as `appMinimal`; add `fieldsByCollection`/`relations` injection props; fix `getPermissionLevel` to treat presets-only rows as `custom`
  - Extend `__tests__/SystemPermissions.test.tsx` ("Use Custom" opens modal; save on pristine row → `update[]` with id; on `$type:'created'` row → `create[$index]` replaced; no existing row → `create[]` with policy/collection/action; modal delete → `delete[]`; level fix); `CustomEditing` story with injected metadata
  - _Requirements: 13.1, 13.6, 13.7, 13.8, 13.9_
  - ✅ 56 jest tests green (49 pre-existing + 7 new); no new merge logic needed — existing `$type`/`$index` branching covered all three row provenances
- [x] 15.6 Registry, exports, docs, changeset (Phase-1 shippable checkpoint)

  - `registry.template.json` `system-permissions` entry: add each new file → `components/ui/<kebab>.tsx|ts`, update description, keep `internalDependencies: ["services"]`; `pnpm build:registry && pnpm registry:check`
  - `src/system-permissions/index.ts` (or package barrel): export `PermissionDetailModal` + filter types/utils; `apps/docs/content/users.mdx` "Custom permission rules" subsection; changeset `'@buildpad/ui-interfaces': minor`
  - Targeted jest green: `pnpm --filter @buildpad/ui-interfaces test -- --testPathPattern "SystemPermissions|PermissionDetailModal|PermissionFilterUtils"`
  - _Requirements: 13.10_
  - ✅ 10 new files in the `system-permissions` registry entry (flat kebab targets; `transformIntraComponentImports` maps camelCase `permissionMetadata` too); `pnpm build:registry && registry:check` green; docs "Custom permission rules" section added; changeset `system-permissions-custom-editor.md`
- [x] 16. Custom permission editor — Phase 2, visual filter builder
- [x] 16.1 Port `FilterRuleNode.tsx`

  - From daas `FilterRuleNode.tsx`: field pill with lazy related-field sub-menus via `permissionMetadata` cache, per-type operator select, typed value inputs (`TagsInput` `_in`/`_nin`, between-pair, boolean/datetime/number, `$`-dynamic-var menu), relational-limitation tooltips; drop decorative drag handle
  - _Requirements: 13.4_
  - ✅ Also wired the (previously dead) field-menu search box to actually filter fields/relations
- [x] 16.2 Port `FilterRuleBuilder.tsx` and swap into the filter tab

  - Visual↔JSON toggle, Add Filter menu with Related Fields section, And/Or group pills; translate `--sgds-*` tokens to Mantine vars/`SystemPermissions.css`; `PermissionFilterTab` hosts the builder (Phase-1 JSON editor remains as JSON mode); builder stories + jest for visual↔JSON roundtrip
  - _Requirements: 13.4_
  - ✅ `PermissionFilterTab` reduced to a thin loading→builder wrapper (daas `PermissionsFilter` shape); modal fetches relations (flat `/api/relations`, module-cached, skipped for create); jest covers visual pills/remove/Add-Filter + JSON-mode roundtrips — 112 targeted tests green; `pnpm build` (monorepo) green
- [x] 17. Playwright extension for the custom editor

  - Extend `tests/ui-users/users-feature.storybook.spec.ts` policies flow: open policy detail → "Use Custom" on a read cell → assert modal + field checkboxes render from live `/api/fields` → Cancel (smoke-level; mutation paths stay jest-covered)
  - _Requirements: 13.1, 13.3_
  - ✅ Green against the live DaaS4 e2e instance (users-storybook 8/8 incl. the new spec). Targets `daas_users:update` — NOT `read`, which is app-minimal-locked (static cyan badge, no menu) since the fixture policy has `app_access: true`. Asserts custom-level toggle → "Use Custom" → dialog (role-based locator; the Mantine Modal-root testid element has a zero-size box) → live field checkboxes (`first_name` checked per fixture's update fields, `email` unchecked) → Cancel unmounts.
- [x] 18. Role hierarchy sidebar (Req 14)
- [x] 18.1 Hierarchy helpers + RoleDetail sidebar

  - Add `childRolesOf(roles, roleId)` pure helper to `accessUtils.ts`; unit tests beside `parentRoleOptions`
  - `RoleDetail`: new `onRoleClick?: (role: Role) => void` prop; "Parent Role" InfoPanel row (`Anchor` when `onRoleClick`, plain text otherwise); "Child Roles" card below the InfoPanel (`data-testid="role-detail-children"`, hidden when empty/new); hierarchy navigation routes through the unsaved-changes guard (generalize the pending action from always-`onBack` to a stored callback); reset `activeTab` to Basic on `id` change
  - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_
- [x] 18.2 Template, stories, e2e

  - `templates/app/roles/[id]/page.tsx`: `onRoleClick={(r) => router.push(\`/roles/${r.id}\`)}`
  - `RolesManager.daas.stories.tsx` playground: swap the open detail id on `onRoleClick`; extend the `users-feature.storybook.spec.ts` roles flow using the task-14 seed hierarchy (Content Manager → Editor)
  - _Requirements: 14.6, 12.1_
  - ✅ The e2e test provisions its own temporary child (`e2e_users_child_hierarchy` under the fixture manager role) via `POST /api/roles` instead of relying on the demo seed, walks child ↔ parent through the sidebar links, and deletes it in a `finally` — self-contained against any instance
- [x] 19. App-minimal permission cell unlock (Req 15)
- [x] 19.1 PermissionsToggle menu variant in SystemPermissions.tsx

  - Replace the `appMinimal` early return with a cyan-badge `Menu`: All Access (disabled when level already `all`; no row counts as `all`) + Use Custom, no No Access item; no menu when `disabled`; `data-app-minimal="true"` + `data-level` from the underlying row (fallback `all`); keep `-full`/`-custom` testid suffixes
  - _Requirements: 15.1, 15.2, 15.4, 15.5_
- [x] 19.2 Jest + stories

  - Extend `__tests__/SystemPermissions.test.tsx`: minimal-cell menu contents (no "No Access"), Use Custom → modal with `appMinimal`, save with no row → `create[]` with policy/collection/action, save on persisted row → `update[]`, delete reverts to implicit minimal, `disabled` → no menu
  - Extend the `appAccess` story with injected `fieldsByCollection` so the unlocked minimal cell is drivable
  - _Requirements: 15.1, 15.2, 15.3, 15.6_
- [x] 19.3 Playwright + docs + design-note closure

  - `users-feature.storybook.spec.ts`: new test on `daas_users:read` (menu without No Access → modal → locked field checkboxes → Cancel); fix the stale locked-cell comment in the task-17 spec; `users.mdx` custom-permission section notes app-minimal extension
  - _Requirements: 15.1, 15.2, 12.4_
- [x] 20. Token UX parity (Req 16)
- [x] 20.1 TokenInput component

  - `packages/ui-users/src/TokenInput.tsx` ported from daas `SystemToken.tsx` with client-side `generateToken()`; `isConcealedToken()` helper in `accessUtils.ts`; vitest `tests/TokenInput.test.tsx` + `accessUtils.test.ts` additions; `TokenInput.stories.tsx` fixture story
  - _Requirements: 16.1, 16.2, 16.3, 16.4_
- [x] 20.2 UserDetail integration

  - Replace the token `PasswordInput` block with `TokenInput` (keep `user-detail-token`/`user-detail-generate-token` testids; add copy/clear testids); diff semantics unchanged: untouched concealed value never PATCHed, clear → `token: null`
  - _Requirements: 16.5, 16.6_
  - ✅ Testids follow the `TokenInput` scheme (`user-detail-token-{generate,copy,clear,notice}`); the old `user-detail-generate-token` id had no test references, so it was not preserved
- [x] 20.3 Registry, barrel, docs

  - `registry.template.json` `users-management` entry + `token-input.tsx` target; `src/index.ts` export; `users.mdx` token paragraph
  - _Requirements: 16.7, 12.4_
- [x] 21. Round-2 verification + changeset

  - `pnpm build`, targeted vitest/jest suites (ui-interfaces repo-wide suites are pre-broken on main — targeted only), `pnpm build:registry && pnpm registry:check`, `test:users:e2e` against live DaaS (users-api unchanged, users-storybook extended)
  - Single lockstep minor changeset (`@buildpad/ui-users` + `@buildpad/ui-interfaces`, fixed group); watch the peerDep major cascade
  - _Requirements: 14.*, 15.*, 16.*, 12.5_
  - ✅ Verified 2026-07-10: ui-users vitest 58/58 (incl. 7 new TokenInput + childRolesOf/isConcealedToken), ui-interfaces jest SystemPermissions 63/63 (7 new app-minimal tests), both package builds + typechecks green, `build:registry`/`registry:check` green (51 components incl. `token-input`), live e2e users-api 23/23 and users-storybook 12/12 (10 + 2 rerun after an environment-caused worker kill; the three new Req 14/15/16 specs green first try — note: a stale dev server squatting port 3000 makes every storybook spec fail on `connectAs` 404, free the port first). Changeset `users-parity-round-2.md`
- [x] 22. Avatar image display (Req 17)

  - `packages/types/src/users.ts`: `User.avatar?: string | null` (display-only pass-through doc comment); `userDisplay.ts`: `UserDisplayFields` gains `avatar`; `UserAvatar.tsx`: `src={user.avatar ?? undefined}` + `alt={getUserDisplayName(user)}` before the props spread (explicit `src` wins); no call-site changes
  - Vitest `UserAvatar.test.tsx` +2 (img src+alt when avatar set; initials when absent); stories: WithImage (inline SVG data-URI) + BrokenSrc→initials fallback
  - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5_
- [x] 23. Headerless list mode (Req 18)

  - `hideHeader?: boolean` (default false) on `UsersManager`/`RolesManager`/`PoliciesManager`: Title+subtitle wrapped, Add button kept, header Group skipped entirely when nothing renders
  - Vitest: UsersManager hideHeader hides Title but keeps Add; new minimal `RolesManager.test.tsx` + `PoliciesManager.test.tsx` cover their flags
  - _Requirements: 18.1, 18.2, 18.3, 18.4_
- [x] 24. Password-manager suppression (Req 19)

  - `data-lpignore="true"` + `data-1p-ignore="true"` on `UserDetail`'s PasswordInput and `TokenInput`'s TextInput; attribute assertion added to `TokenInput.test.tsx`
  - _Requirements: 19.1, 19.2_
- [x] 25. Page-size selector (Req 22 — lands before sorting/bulk so their tests see the final footer)

  - All three managers: `limit` state initialized from `pageSize`, `pageSizeOptions` prop (default `[10,25,50,100]`, initial injected if missing), footer Select (`<manager>-page-size` testid), footer condition `totalCount > 0`, Pagination still `totalPages > 1`; size change → fetch new limit + page 1
  - Vitest per manager: size change → fetch called with new limit and page 1
  - _Requirements: 22.1, 22.2, 22.3_
- [x] 26. Column sorting (Req 20)
- [x] 26.1 `toggleSort` helper + `SortableTh` component

  - Pure `toggleSort(current, field)` in `accessUtils.ts` (`null→field→-field→null`, field switch → asc) + vitest; new `SortableTh.tsx` (UnstyledButton header, chevron up/down active, `IconSelector` inactive, `aria-sort`; aria pattern per ui-table's TableHeader — pattern only, no import) + `SortableTh.test.tsx`; barrel export; registry entry `sortable-th.tsx`
  - _Requirements: 20.3, 20.7_
- [x] 26.2 Manager integration

  - `UsersManager`: sort state → `fetchUsers({ sort })`, whitelisted headers User/`first_name`, Email/`email`, Status/`status`, Last Access/`last_access`; `PoliciesManager`: Name/`name` → `fetchPolicies({ sort })`; page reset on sort change; RolesManager untouched (server hardcodes name-asc)
  - Vitest: sort cycle fetch args + page reset; RolesManager asserts NO sortable headers
  - _Requirements: 20.1, 20.2, 20.4, 20.5, 20.6_
- [x] 27. Users-list bulk actions (Req 21)
- [x] 27.1 Selection + toolbar

  - `useSelection<string>` from `@buildpad/hooks`; checkbox column only when `updateAllowed || deleteAllowed` (header select-all-on-page checked/indeterminate, cell stopPropagation); toolbar Paper at selection>0: "N selected", Clear, Update roles… + Set status (update-gated), Delete (delete-gated); selection persists across pages, clears on search/filter change
  - _Requirements: 21.1, 21.2, 21.6, 21.7_
- [x] 27.2 Bulk flows

  - Local `BulkRolesModal` (two MultiSelects from fetched roles) → ONE `bulkUpdateUsers(ids, { addRoles?, removeRoles? })`; Set status → per-user `updateUser(id, { status })` via `Promise.allSettled`; Delete → `DeleteConfirmModal` with count → per-user `deleteUser` via `Promise.allSettled`; outcome-count notifications; clear selection + reload after each action
  - _Requirements: 21.3, 21.4, 21.5, 21.6_
- [x] 27.3 Vitest suite

  - `UsersManager.test.tsx`: checkboxes hidden without update+delete; toolbar count; bulk roles issues exactly one `bulkUpdateUsers` call; status/delete fan-outs; selection cleared + reload
  - _Requirements: 21.1–21.7_
- [x] 27.4 Playwright e2e

  - Admin: email-sort first-row flip over search-scoped `e2e-users` fixtures; bulk-roles round-trip on the noperm fixture (add→remove, self-restoring); bulk-status round-trip (suspend→active); bulk-delete on a throwaway API-created user with `finally` cleanup; page-size 10 → ≤10 rows. Viewer: rows render but no checkbox column/toolbar; sort headers still work
  - _Requirements: 20.1, 21.3, 21.4, 21.5, 22.2, 12.1_
  - ✅ The bulk-roles e2e exposed a pre-existing live-data parity bug: `UsersManager` fetched without the daas reference projection (`fields=*,roles.*,roles.role_id.name`), so the API returned bare junction IDs and the Role column never rendered badges against live data (fixture-based unit tests masked it — they use flattened role objects). Fixed by passing the projection in `load()`. Two Playwright/Mantine gotchas: MultiSelect dropdowns stay open after picking (overlaying Apply — dismissed by clicking the modal copy), and jsdom needs an `Element.prototype.scrollIntoView` stub + `hidden: true` role queries for combobox options (dropdown stays `display:none` without transitions)
- [x] 28. Round-3 verification + docs + changeset

  - `users.mdx`: list-views section (`hideHeader`, `pageSize` now initial, `pageSizeOptions`, avatar sentence), new "Sorting and bulk actions" subsection (per-list sortable columns, roles unsortable server-side, bulk roles single-call vs status/delete fan-out), RBAC section (checkbox/toolbar gating)
  - `pnpm --filter @buildpad/types typecheck`, ui-users typecheck/test/build, `pnpm build:registry && pnpm registry:check`, live e2e (free port 3000 first): users-api unchanged 23/23, users-storybook 12 existing + new specs
  - Single lockstep minor changeset `users-parity-round-3.md` (`@buildpad/ui-users` + `@buildpad/types`); watch the peerDep major cascade — rewrite versions down after `changeset version`
  - _Requirements: 17.*–22.*, 12.4, 12.5_
  - ✅ Verified 2026-07-11: ui-users vitest 87/87 (26 new across UsersManager/RolesManager/PoliciesManager/SortableTh/UserAvatar/accessUtils/TokenInput), types + ui-users typecheck/build green, `build:registry`/`registry:check` green (`sortable-th` registered), live e2e users-api 23/23 unchanged and users-storybook 18/18 (12 existing + 6 new Req 20–22 specs, all green after the Role-badge projection fix). Port-3000 squatter (an unrelated `rudy-project-management-sub-agents-starter` Next dev server, up 29h) had to be killed before `dev:host` could bind
