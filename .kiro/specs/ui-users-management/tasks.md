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
