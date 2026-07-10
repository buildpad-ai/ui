# Requirements Document

## Introduction

This feature adds a reusable users-management module to the buildpad-ui monorepo as a new package, `@buildpad/ui-users`, packaged like `packages/ui-files`. The module provides the complete administration surface for the three interdependent access-control domains of the DaaS backend — **users**, **roles**, and **policies** — at full feature parity with the reference admin UI that ships inside the buildpad-daas repo (`app/users`, `app/roles`, `app/policies`).

Downstream buildpad apps install the module through the buildpad CLI registry (shadcn-style source copy) as a single bundle: a `users-management` component entry plus a `users-routes` lib module that drops ready-made pages for `/users`, `/roles`, and `/policies` (list + detail each).

Parity boundary (verified against the daas source): the daas user form excludes `avatar`, `auth_data`, `provider`, `external_identifier`, `admin_access`, `last_page`, and `tfa_secret`, so avatar upload is out of scope. There is no invite-email endpoint (invite = create user with `status: 'invited'`). `admin_access` on users and roles is computed from attached policies and is never written.

## Requirements

### Requirement 1 — Shared types

**User Story:** As a buildpad developer, I want canonical TypeScript types for users, roles, policies, and access rows in `@buildpad/types`, so that hooks, components, and downstream apps share one contract with the DaaS API.

#### Acceptance Criteria

1. WHEN `@buildpad/types` is built THEN the package SHALL export `User`, `UserStatus`, `Role`, `RoleScopeConfig`, `Policy`, `Access`, and `ListMeta` from a new `packages/types/src/users.ts` re-exported via `src/index.ts`.
2. WHEN the `User` type is used THEN `admin_access` SHALL be declared `readonly` and documented as computed (never written to the API).
3. WHEN `UserStatus` is used THEN it SHALL be the union `'active' | 'suspended' | 'invited' | 'draft' | 'terminated'`.
4. WHEN the new types are added THEN the two existing `DaaSUser` interfaces (`packages/services/src/daas-context.tsx` and `packages/hooks/src/api.ts`) SHALL remain unchanged.
5. WHEN a list endpoint response is typed THEN `ListMeta` SHALL match the backend envelope `{ count, totalCount, page, pageSize, totalPages }`.

### Requirement 2 — Data hooks

**User Story:** As a buildpad developer, I want `useUsers`, `useRoles`, `usePolicies`, and `useAccess` hooks in `@buildpad/hooks`, so that any component can perform users/roles/policies CRUD through the shared DaaS context without hand-writing fetch calls.

#### Acceptance Criteria

1. WHEN a hook issues a request THEN it SHALL use `apiRequest` from `@buildpad/services` (which resolves auth headers via `getApiHeadersAsync`), never `config.token` directly and never the legacy `DaaSAPI` class.
2. WHEN `useUsers().fetchUsers` is called with `{ page, limit, search, sort, fields, role, status, filter }` THEN it SHALL call `GET /api/users` with those query params and resolve `{ users, total, totalPages }`.
3. WHEN `useUsers` is used THEN it SHALL expose `getUser`, `getMe`, `createUser`, `updateUser`, `updateMe`, `deleteUser`, `bulkUpdateUsers` (PATCH `/api/users/bulk-update`), `fetchUserPolicies`, `attachUserPolicy`, and `detachUserPolicy`.
4. WHEN `updateUser` receives a payload containing `admin_access` THEN the hook SHALL strip that field before sending the PATCH.
5. WHEN `useRoles` is used THEN it SHALL expose `fetchRoles` (supporting `includeUsers=true`), `getRole` (supporting `includePolicies=true`), `getMyRoles`, `createRole`, `updateRole`, `deleteRole`, `fetchRolePolicies`, `attachRolePolicy`, and `detachRolePolicy`.
6. WHEN `usePolicies` is used THEN it SHALL expose `fetchPolicies` (returning `userCount`/`roleCount` enrichment), `getPolicy`, `getMyPolicies`, `createPolicy`, `updatePolicy`, and `deletePolicy`.
7. WHEN `useAccess` is used THEN it SHALL expose thin CRUD over `/api/access` (`fetchAccess`, `createAccess`, `updateAccess`, `deleteAccess`).
8. WHEN the backend returns an error in either supported shape (`{ error }` or DaaS `{ errors: [{ message, extensions: { code } }] }`) THEN a shared `parseDaaSError` helper SHALL extract a human-readable message, falling back to the raw error text.
9. WHEN any hook operation is in flight THEN the hook SHALL expose `loading` and `error` state following the `useFiles.ts` conventions.
10. WHEN `@buildpad/hooks` is built THEN all four hooks and their param/result types SHALL be exported from `packages/hooks/src/index.ts`.

### Requirement 3 — Users list management

**User Story:** As an app administrator, I want a users list with search, filtering, and pagination, so that I can find and manage user accounts.

#### Acceptance Criteria

1. WHEN `UsersManager` renders THEN it SHALL display a paginated table (default page size 25, overridable via prop) with columns: user (avatar initials + name), email, role badges, status badge, and last access.
2. WHEN the administrator types in the search field THEN the component SHALL debounce input (~300 ms) and re-fetch with the `search` param.
3. WHEN the administrator selects a role or status filter THEN the list SHALL re-fetch filtered by that role/status.
4. WHEN a user row is clicked and the current user may update users THEN the component SHALL invoke the `onUserClick(user)` callback prop.
5. WHEN the current user lacks `create` permission on `daas_users` THEN the "Add User" button SHALL NOT be rendered.
6. WHEN the administrator confirms deletion in the delete-confirmation modal THEN the component SHALL call `DELETE /api/users/[id]` and refresh the list.
7. WHEN the list is empty THEN the component SHALL show an empty state distinguishing "no results for filters" from "no users yet".

### Requirement 4 — User create/edit

**User Story:** As an app administrator, I want to create and edit users with role assignment and policy attachment, so that I can control who can access the app and what they can do.

#### Acceptance Criteria

1. WHEN `UserDetail` renders in create mode THEN it SHALL show explicit Mantine fields for: email, password, first name, last name, title, description, location, tags, language, theme, status, token (masked), and roles (multi-select fed by `useRoles`).
2. WHEN a new user is saved without a password THEN the component SHALL block the save and show a validation error.
3. WHEN a password shorter than 6 characters is provided THEN the component SHALL block the save and show a validation error.
4. WHEN an existing user is saved THEN the component SHALL PATCH only the changed fields (edits-only, DaaS pattern), never the full form payload.
5. WHEN the user record loads THEN M2M `roles` entries (objects or IDs) SHALL be normalized to an array of role IDs for the multi-select.
6. WHEN there are no unsaved changes in edit mode THEN the Save button SHALL be disabled.
7. WHEN `UserDetail` renders an existing user THEN it SHALL show a Policies tab (with attached-policy count) hosting the user↔policy manager, and an info panel with user ID, last access, created, updated, and policy count.
8. WHEN the form renders THEN it SHALL NOT render or submit `admin_access`, `avatar`, `auth_data`, `provider`, `external_identifier`, `last_page`, or `tfa_secret`.
9. WHEN save or delete succeeds or fails THEN the component SHALL show a Mantine notification and invoke `onSaved`/`onDeleted`/`onBack` callbacks as appropriate.

### Requirement 5 — Roles list and detail management

**User Story:** As an app administrator, I want to manage roles including hierarchy and scope assignment rules, so that I can group users and control scoped role assignment.

#### Acceptance Criteria

1. WHEN `RolesManager` renders THEN it SHALL display a searchable, paginated table with role icon, name, user count (via `includeUsers=true`), and description.
2. WHEN `RoleDetail` renders THEN it SHALL show tabs: Basic Information, Users (with count), and Policies (with count); Users and Policies tabs SHALL be hidden in create mode.
3. WHEN the Basic tab renders THEN it SHALL provide name, icon picker (`SelectIcon` from `@buildpad/ui-interfaces`), description, and a parent-role select that excludes the role itself.
4. WHEN the administrator enables "Scope Assignment Rules" THEN the component SHALL render the `scope_config` editor: a list of regex pattern inputs with live per-pattern validity feedback, add/remove pattern controls, and a validation-message input.
5. WHEN a scope pattern is not a valid regular expression THEN the input SHALL display an "Invalid regex" error.
6. WHEN the administrator disables "Scope Assignment Rules" THEN `scope_config` SHALL be set to `null` on save.
7. WHEN saving THEN the component SHALL offer Save & Stay, Save & Quit, Save & Add New, and (when dirty) Discard Changes.
8. WHEN the administrator navigates away with unsaved changes THEN the component SHALL interpose an unsaved-changes confirmation dialog before invoking the navigation callback.
9. WHEN `RoleDetail` renders an existing role THEN it SHALL show an info panel with role ID, user count, policy count, and timestamps.

### Requirement 6 — Role membership and policy attachment

**User Story:** As an app administrator, I want to manage which users hold a role and which policies a role or user carries, so that I can administer effective access from either direction.

#### Acceptance Criteria

1. WHEN `RoleUsersManager` renders for a role THEN it SHALL list users holding that role (`fetchUsers({ role })`) and allow adding/removing users via `bulkUpdateUsers` with `addRoles`/`removeRoles`.
2. WHEN `RolePoliciesManager` renders THEN it SHALL list policies attached to the role (`GET /api/roles/[id]/policies`) and support attach (`POST` with `policyIds`) and detach (`DELETE .../policies/[policyId]`).
3. WHEN `UserPoliciesManager` renders THEN it SHALL list policies attached directly to the user and support attach/detach via `/api/users/[id]/policies[...]`.
4. WHEN attaching a policy THEN a shared `PolicyPickerModal` SHALL present a searchable policy list excluding already-attached policies.
5. WHEN an attach/detach completes THEN the parent detail view SHALL refresh its counts via an `onUpdate` callback.

### Requirement 7 — Policies list and detail management

**User Story:** As an app administrator, I want to manage policies with access flags and a per-collection permissions matrix, so that I can define what attached users and roles are allowed to do.

#### Acceptance Criteria

1. WHEN `PoliciesManager` renders THEN it SHALL display a searchable, paginated table with policy icon, name, description, user count, and role count.
2. WHEN `PolicyDetail` renders THEN it SHALL provide name, icon, description, and Access Control switches for `app_access`, `admin_access`, and `delegate_access`.
3. WHEN `PolicyDetail` renders an existing policy THEN it SHALL embed the permissions matrix by reusing `SystemPermissions` from `@buildpad/ui-interfaces/system-permissions` (not a port of the daas `PermissionsTable` family).
4. WHEN permissions are edited in the matrix THEN the alterations SHALL be tracked as dirty state and applied to `/api/permissions` on Save together with the policy form.
5. WHEN either the form fields or the permissions matrix has unsaved changes THEN the component SHALL show an "Unsaved Changes" indicator and enable Save.
6. WHEN `PolicyDetail` renders an existing policy THEN it SHALL show an info panel with policy ID, user count, role count, and timestamps.

### Requirement 8 — Permission-gated UI (RBAC)

**User Story:** As an app administrator, I want the module's actions gated by the current user's collection permissions, so that users only see actions they are allowed to perform.

#### Acceptance Criteria

1. WHEN any surface renders THEN create/update/delete affordances SHALL be gated via `usePermissions().canPerform(collection, action)` with admin bypass, using the optimistic pattern from `ui-files` (`permsLoading || isAdmin || canPerform(...)`).
2. WHEN gating is evaluated THEN the collection names SHALL default to `daas_users` / `daas_roles` / `daas_policies` and SHALL be overridable via props.
3. WHEN the current user may not update a collection THEN row click-through to the detail view SHALL be disabled for that collection's list.

### Requirement 9 — Framework-agnostic navigation

**User Story:** As a downstream app developer, I want the components to be routing-agnostic, so that I can wire them into any Next.js (or other React) app.

#### Acceptance Criteria

1. WHEN any `@buildpad/ui-users` component needs navigation THEN it SHALL invoke injected callback props (`onUserClick`, `onRoleClick`, `onPolicyClick`, `onCreate*`, `onBack`, `onDeleted`, `onSaved`) and SHALL NOT import `next/navigation`.
2. WHEN the CLI route templates are installed THEN the generated pages SHALL wire those callbacks to the consumer app's router (`useRouter`/`useParams`), following the `templates/app/files` pattern.

### Requirement 10 — Package scaffold

**User Story:** As a buildpad maintainer, I want `packages/ui-users` to mirror the `ui-files` package conventions, so that the monorepo stays consistent and the release pipeline works unchanged.

#### Acceptance Criteria

1. WHEN the package is created THEN `package.json` SHALL declare name `@buildpad/ui-users`, version `1.6.0` (lockstep), `private: true`, `"files": ["dist","src"]`, tsup build (esm+cjs+dts with react/mantine/tabler externals), vitest test script, and peer dependencies matching `ui-files` (Mantine core/hooks/notifications, `@buildpad/hooks|services|types|ui-interfaces`, tabler, react 18||19).
2. WHEN Storybook is run for the package THEN it SHALL use port **6011** with its own `.storybook/` config (self-alias to `../src`, `/api` proxy to `http://localhost:3000`, enterprise theme preview).
3. WHEN the package is built THEN `src/index.ts` SHALL export all components and their `*Props` types as a pure barrel.
4. WHEN components need styling beyond Mantine THEN they SHALL use per-component plain CSS files (no Tailwind), with a `css.d.ts` shim.

### Requirement 11 — Registry distribution and CLI install

**User Story:** As a downstream app developer, I want to install the whole module with one CLI command, so that users/roles/policies admin drops into my app ready to use.

#### Acceptance Criteria

1. WHEN the registry is built THEN `registry.template.json` SHALL contain a `users-management` component entry (category `admin`, `excludeFromAll: true`) mapping every `ui-users/src/*` file to `components/ui/users-management/<kebab>.*`, with `internalDependencies: ["types","hooks","services"]` and `registryDependencies: ["system-permissions","select-icon"]`.
2. WHEN the registry is built THEN a `users-routes` lib module SHALL map six page templates from `packages/cli/templates/app/{users,roles,policies}/` to `app/(authenticated)/{users,roles,policies}/page.tsx` and `[id]/page.tsx`, with `registryDependencies: ["users-management"]` and `internalDependencies: ["api-routes","hooks"]`.
3. WHEN `scripts/build-registry.mjs` runs THEN it SHALL recognize the new package via additions to `PACKAGE_FOLDERS` and `inferSourcePackage()`.
4. WHEN the `hooks` lib module is copied THEN it SHALL include the four new hook files, and `packages/cli/templates/lib/hooks/index.ts` SHALL export them.
5. WHEN `buildpad add users-routes` runs in a consumer app THEN it SHALL transitively install `users-management`, `system-permissions`, `select-icon`, and the `types`/`hooks`/`services` lib modules, and the pages SHALL compile.
6. WHEN `pnpm build:registry && pnpm registry:check` run THEN they SHALL pass.

### Requirement 12 — Storybook, docs, tests, release

**User Story:** As a buildpad maintainer, I want the module documented, storybooked, tested, and released in lockstep, so that it is discoverable and verifiable like every other package.

#### Acceptance Criteria

1. WHEN root `pnpm storybook:users` runs THEN the package's Storybook SHALL start on port 6011 with fixture stories for presentational pieces and `*.daas.stories.tsx` live stories for the six data-connected surfaces.
2. WHEN `scripts/build-storybooks.sh` runs THEN it SHALL build ui-users into the storybook-host output and the host landing page SHALL link to it.
3. WHEN `pnpm test` runs THEN vitest SHALL cover pure helpers (initials derivation, status→color map, parent-role exclusion, roles ID-normalization, scope-pattern regex validation) and hook query-string building plus `parseDaaSError` with mocked fetch.
4. WHEN docs are built THEN `apps/docs/content/users.mdx` SHALL document the module recipe (pieces table, `buildpad add users-routes` walkthrough, RBAC caveats) with entries added to `_meta.ts` and `components.mdx`.
5. WHEN the release is cut THEN `@buildpad/ui-users` SHALL be in the `.changeset/config.json` `fixed` group and version in lockstep (1.6.0 → 1.7.0 minor), with no npm publish (registry serves source from GitHub main).

### Requirement 13 — Custom permission editing (policies parity gap closure)

**User Story:** As an app administrator, I want to define custom per-permission rules (item filters, field access, validation, presets) from the permissions matrix, so that policies can express fine-grained access beyond all-or-nothing.

Context: the feature-parity audit against `buildpad-daas/app/policies` (2026-07-09) found one real gap — the daas custom-permission editor family (`PermissionsDetailModal` + `PermissionsFilter`/`Fields`/`Validation`/`Presets` + `FilterRuleBuilder`/`FilterRuleNode`, ~2,300 lines) has no counterpart in the port: `editItem` in `SystemPermissions` (`packages/ui-interfaces/src/system-permissions/SystemPermissions.tsx`) is a no-op stub, so the "Use Custom" menu item does nothing and `custom`-level permissions can be displayed but never created or edited. This requirement adds the editor to the `system-permissions` family in `@buildpad/ui-interfaces` (where the stub lives), so `PolicyDetail` gains it with no ui-users changes. Delivery is phased: Phase 1 ships the tabbed editor with JSON-based item-permission editing (full persistence parity); Phase 2 ports the visual filter-rule builder.

#### Acceptance Criteria

1. WHEN the administrator selects "Use Custom" on any C/R/U/D/S toggle in `SystemPermissions` THEN a `PermissionDetailModal` SHALL open for that collection/action, replacing the current no-op `editItem` stub.
2. WHEN the modal renders THEN its tabs SHALL be action-dependent — Item Permissions (read/update/delete/share), Field Permissions (create/read/update), Field Validation (create/update), Field Presets (create/update) — defaulting to the first available tab, with a value-indicator badge on each tab that holds a non-empty value.
3. WHEN the Field Permissions tab renders THEN it SHALL list the collection's fields as checkboxes (fetched from `GET /api/fields/{collection}`) with select all/none controls, `['*']` all-fields semantics, primary-key/alias badges, and app-access minimal fields locked when applicable.
4. WHEN the Item Permissions tab renders THEN it SHALL support the full Directus filter syntax — complete operator set, dynamic variables (`$CURRENT_USER`, `$CURRENT_ROLE`, `$CURRENT_ROLES`, `$CURRENT_POLICIES`, `$NOW`, `$CURRENT_RESOURCE_URI`), and relational-limitation warnings (`_has`, dot-notation, `_some`/`_none`) — as a JSON editor in Phase 1 and a visual rule-builder with a visual↔JSON toggle in Phase 2, and SHALL show a notice that filters do not apply to the create action.
5. WHEN the Field Validation or Field Presets tab renders THEN it SHALL provide a JSON editor with parse-error surfacing, a Clear control, and worked examples; the Presets tab SHALL additionally warn when a UUID field is assigned an array value (relational-array limitation).
6. WHEN the administrator saves the modal THEN it SHALL emit only `{ fields, permissions, validation, presets }` into the matrix's local alterations model — merging into `create[]`/`update[]` according to the row's `$type`/`$index` provenance — and SHALL NOT call the API directly; persistence SHALL remain on the host form's Save via the existing alterations contract (Req 7.4).
7. WHEN the administrator confirms Delete in the modal THEN the permission SHALL be removed through the same alterations model (`delete[]` for persisted rows, `create[]` splice for unsaved rows).
8. WHEN a permission row has only `presets` set (fields `['*']`, no filter, no validation) THEN `getPermissionLevel` SHALL report `custom`, not `all`.
9. WHEN field or relation metadata is needed THEN it SHALL be fetched via `apiRequest` from `GET /api/fields/{collection}` and the flat `GET /api/relations` (client-side matching, `useRelationM2O` precedent) with module-level caching, and the components SHALL accept `fields`/`relations`/`fieldsByCollection` injection props for tests and stories (mirroring the existing `collections` prop).
10. WHEN the registry is built THEN the `system-permissions` entry SHALL list every new editor file as a flat kebab-case target under `components/ui/` (PascalCase sources so the CLI transformer rewrites relative imports), with `internalDependencies: ["services"]` unchanged.
