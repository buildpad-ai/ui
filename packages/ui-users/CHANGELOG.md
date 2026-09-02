# @buildpad/ui-users

## 2.2.0

### Patch Changes

- Updated dependencies [2b199c9]
  - @buildpad/hooks@2.2.0
  - @buildpad/ui-interfaces@2.2.0
  - @buildpad/ui-table@2.2.0
  - @buildpad/services@2.2.0
  - @buildpad/types@2.2.0

## 2.1.0

### Patch Changes

- @buildpad/ui-interfaces@2.1.0
- @buildpad/hooks@2.1.0
- @buildpad/services@2.1.0
- @buildpad/types@2.1.0
- @buildpad/ui-table@2.1.0

## 2.0.0

### Patch Changes

- @buildpad/hooks@2.0.0
- @buildpad/services@2.0.0
- @buildpad/types@2.0.0
- @buildpad/ui-interfaces@2.0.0
- @buildpad/ui-table@2.0.0

## 1.11.1

### Patch Changes

- 5802243: SelectIcon: forward extra props safely, accept both `autoFocus` spellings, and unify the unknown-icon fallback (S5.5, S5.7).

  **Prop forwarding (S5.5).** `SelectIcon` now forwards extra props to its trigger `<Button>`, so a consumer can pass `data-*` attributes and event handlers. Note this is a _new_ capability rather than parity: of the selection leaves, `SelectDropdown`, `SelectRadio`, `SelectMultipleCheckbox` and `SelectMultipleDropdown` take no rest props at all, and `Boolean`/`Toggle` forward a rest that is closed at the type level.

  Because `FormFieldInterface` passes DaaS schema metadata to every leaf — `type`, `collection`, `field`, `primaryKey`, `maxLength`, `nullable`, `defaultValue` — plus admin-authored `meta.options` spread unfiltered, forwarding has to be guarded:

  - Those metadata props are declared and destructured-and-discarded, mirroring the existing guard in `input/Input.tsx`, so none reach the DOM as invalid attributes.
  - `type` matters most. Mantine's `UnstyledButton` applies its `type: "button"` default _before_ its own rest spread, so a forwarded `type` wins — and `field.type` is a DaaS abstract type (`string`, `uuid`, …), never a valid button type. An invalid `button@type` falls back to `submit`, and `CollectionForm` renders fields inside `<form onSubmit={handleSave}>`, so the trigger would have saved the record when the user clicked merely to open the picker. `type="button"` is now pinned, and the forwarded value discarded.
  - The rest spread is declared first, so component-owned props always win: rest may add, never override.
  - The rest is typed (`SelectIconTriggerProps`) rather than an `[key: string]: unknown` index signature. An index signature would have disabled excess-property checking on every call site — `valeu`, `onChagne` would compile and ship to the DOM. `data-*` never needed it: TypeScript always permits non-identifier JSX attribute names.

  **Autofocus (S5.5).** Both `autoFocus` and `autofocus` are accepted. The form pipeline (`VForm` → `FormField` → `FormFieldInterface`) sends the lowercase spelling, so a camelCase-only prop would never have fired for the only in-repo caller.

  **Fallback glyph (S5.7).** The trigger's `renderIcon` and the read-only `IconDisplay` companion used different glyphs for the same "stored name with no `ICON_MAP` entry" condition. Both now use `DEFAULT_UNKNOWN_ICON` (`IconQuestionMark`) _with the same stroke and `aria-hidden`_ — sharing the component alone still left them at different stroke weights. The constant is exported from the package barrel so the two can't drift again. The trigger also surfaces the raw stored name via the icon's own SVG `<title>` (Tabler's built-in `title` prop, which reaches assistive tech) instead of a bare `?`; the picker grid does not, since its cells already carry a formatted title.

  **`@buildpad/ui-users`.** `IconDisplay`'s default fallback changed, and `RolesManager` was the one caller relying on it — every role with no icon would have rendered a question mark instead of a users-group glyph. It now passes `fallback={IconUsersGroup}` explicitly, matching how the policy surfaces already pass `fallback={IconShield}`.

- Updated dependencies [585362e]
- Updated dependencies [6d724ee]
- Updated dependencies [565448a]
- Updated dependencies [b8b5344]
- Updated dependencies [a22729a]
- Updated dependencies [50a4057]
- Updated dependencies [08127f0]
- Updated dependencies [d5c9eee]
- Updated dependencies [577eda9]
- Updated dependencies [c6baa06]
- Updated dependencies [4a53873]
- Updated dependencies [27a2515]
- Updated dependencies [6375036]
- Updated dependencies [2b8413c]
- Updated dependencies [0408b2c]
- Updated dependencies [12f823c]
- Updated dependencies [594c277]
- Updated dependencies [2be8218]
- Updated dependencies [1226ec5]
- Updated dependencies [1bf1731]
- Updated dependencies [46afe83]
- Updated dependencies [5056ef3]
- Updated dependencies [7b415ad]
- Updated dependencies [944c25c]
- Updated dependencies [1523349]
- Updated dependencies [ad9c415]
- Updated dependencies [1f2bcff]
- Updated dependencies [925e201]
- Updated dependencies [4a31fb5]
- Updated dependencies [24ebfc2]
- Updated dependencies [0ad17fc]
- Updated dependencies [432125d]
- Updated dependencies [2f6ad88]
- Updated dependencies [4becd38]
- Updated dependencies [5802243]
- Updated dependencies [4355c8e]
- Updated dependencies [79c22f7]
- Updated dependencies [af56a74]
- Updated dependencies [eb662e3]
- Updated dependencies [ee5bbd6]
- Updated dependencies [4aad6ac]
- Updated dependencies [a5478f4]
- Updated dependencies [e078a74]
- Updated dependencies [4355f4d]
  - @buildpad/hooks@1.11.1
  - @buildpad/ui-interfaces@1.11.1
  - @buildpad/ui-table@1.11.1
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

- Updated dependencies [4976915]
- Updated dependencies [2e6bee7]
- Updated dependencies [5981327]
  - @buildpad/ui-interfaces@1.10.0
  - @buildpad/types@1.10.0
  - @buildpad/services@1.10.0
  - @buildpad/hooks@1.10.0
  - @buildpad/ui-table@1.10.0

## 1.9.3

### Patch Changes

- @buildpad/ui-interfaces@1.9.3
- @buildpad/hooks@1.9.3
- @buildpad/services@1.9.3
- @buildpad/types@1.9.3

## 1.9.2

### Patch Changes

- Updated dependencies [0a7e18d]
  - @buildpad/ui-interfaces@1.9.2
  - @buildpad/hooks@1.9.2
  - @buildpad/services@1.9.2
  - @buildpad/types@1.9.2

## 1.9.1

### Patch Changes

- Updated dependencies [a453388]
  - @buildpad/ui-interfaces@1.9.1
  - @buildpad/hooks@1.9.1
  - @buildpad/services@1.9.1
  - @buildpad/types@1.9.1

## 1.9.0

### Patch Changes

- Updated dependencies [5bf4320]
  - @buildpad/ui-interfaces@1.9.0
  - @buildpad/hooks@1.9.0
  - @buildpad/services@1.9.0
  - @buildpad/types@1.9.0

## 1.8.1

### Patch Changes

- @buildpad/hooks@1.8.1
- @buildpad/services@1.8.1
- @buildpad/types@1.8.1
- @buildpad/ui-interfaces@1.8.1

## 1.8.0

### Patch Changes

- Updated dependencies [5c1000a]
  - @buildpad/ui-interfaces@1.8.0
  - @buildpad/hooks@1.8.0
  - @buildpad/services@1.8.0
  - @buildpad/types@1.8.0

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
- e563c73: Reuse consolidation and error surfacing from the ui-users conventions audit:

  - `IconDisplay` moves into `@buildpad/ui-interfaces/select-icon`, driven by
    `SelectIcon`'s full ~190-name icon map (previously ui-users shipped its own
    18-name copy, so most picked icons fell back to a generic glyph in the
    roles/policies lists). The map and picker also gain the security/identity
    names (`shield`, `verified_user`, `admin_panel_settings`, `policy`, `key`,
    `badge`, `supervised_user_circle`, …) under a new "Security & Identity"
    category — including the daas default role/policy icons, which were
    previously not pickable. ui-users re-exports `IconDisplay` unchanged.
  - `SystemToken` gains an optional `generate` prop (custom sync/async token
    producer replacing the `/api/utils/random/string` call),
    `data-lpignore`/`data-1p-ignore` password-manager suppression, daas wording
    ("Value Securely Saved", the copy-once notice), and copy feedback via
    notifications. ui-users' `TokenInput` is now a thin wrapper over it
    (client-side `generateToken()`), replacing the previous parallel port;
    `users-management` gains a `system-token` registry dependency.
  - The three list managers now share extracted chrome: `SearchInput`,
    `ListFooter` (owns the totalCount/totalPages footer gates), `ListEmptyState`,
    and `RowActionsMenu` — all exported and registry-listed.
  - Error surfacing: a failed list load renders a distinct "Failed to load …"
    state plus a red notification instead of masquerading as "no data yet", and
    a failed row delete toasts and keeps the confirm dialog open for retry.
  - Design-system compliance: `SystemToken` scopes its monospace face to the
    input element via `styles={{ input }}` — the previous root-level `style`
    leaked monospace into the label/description while the design-system theme's
    own TextInput input override forced the input back to sans (the exact
    inverse of intended). Scheme-static grays swapped for semantic tokens:
    `--mantine-color-default-border` (list footers, matching ui-collections),
    `--mantine-color-dimmed` (empty-state/count/key icons), and
    `--mantine-color-error` (load-failure icon).

### Patch Changes

- Updated dependencies [6db435b]
- Updated dependencies [90dc795]
- Updated dependencies [e563c73]
  - @buildpad/ui-interfaces@1.8.0
  - @buildpad/hooks@1.8.0
  - @buildpad/types@1.8.0
  - @buildpad/services@1.8.0
