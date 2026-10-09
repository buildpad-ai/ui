# @buildpad/services

## 3.1.0

### Patch Changes

- Updated dependencies [45feba0]
  - @buildpad/types@3.1.0
  - @buildpad/utils@3.1.0

## 3.0.0

### Major Changes

- 443b901: The relational missing-provider alert (`interfaces.relationalUI.missingProvider.message`, en + id) no longer tells developers to render the field inside a VForm: a plain VForm supplies only itself (the form renderer), not CollectionForm / CollectionList. It now points to CollectionForm, `CollectionsRelationalProvider` (around the field or the VForm) or the `components` prop, and names the form-renderer slot "VForm". `ListO2M`, `ListM2M` and `ListM2A` only report components for actions the field would otherwise offer (enable flags, create / select / update permissions, unique and singleton guards), so users without those permissions no longer see the alert. Docs and JSDoc now say what a VForm supplies.
- 60ae923: Break the ui-form → ui-interfaces → ui-collections → ui-form package cycle with a relational UI context.

  - New lib file `lib/buildpad/services/relational-ui-context.tsx` (`@buildpad/services/relational-ui-context`): `RelationalUIProvider`, `useRelationalUI`, `mergeRelationalUI`, `missingRelationalUI` and structural slot types for `CollectionForm`, `CollectionList` and `FormRenderer` (VForm). Nested providers merge; `defaults` only fill slots nothing above supplies. Also re-exported from the services barrel.
  - `ListO2M`, `ListM2M`, `ListM2A` and `JunctionItemForm` no longer import `@buildpad/ui-collections` / `@buildpad/ui-form`. They take those components from a new optional `components` prop, then the relational provider, and render each in its own Suspense boundary (new `components/ui/list-m2a/relational-slots.tsx`). With no provider they render a translated alert (`interfaces.relationalUI`, en + id) and hide the create / select / edit actions whose dialog component is missing; listing, removing and reordering still work.
  - `CollectionForm` supplies `{ CollectionForm, CollectionList (React.lazy), FormRenderer: VForm }` to the fields it renders; `VForm` supplies `{ FormRenderer: VForm }`. Both only fill slots a provider above did not choose. `collection-form` now declares `collection-list` as a registry dependency.
  - New `CollectionsRelationalProvider` (exported from `collection-form`) for standalone relational interfaces and standalone `VForm`s with relational fields. The CLI's `/content` layout template and `FormPreview`'s offline VForm use it.
  - Standalone `<ListO2M>` / `<ListM2M>` / `<ListM2A>` and plain `<VForm>`s with relational fields must now be wrapped in a provider (or given `components`) to create, select or edit related items. See docs/MIGRATION-3.0.md.
  - Monorepo: `@buildpad/ui-interfaces` drops its peer/dev dependencies on `@buildpad/ui-collections` and `@buildpad/ui-form`; the root build is utils first, then `pnpm -r build`; `packages/ui-collections/dist` is no longer committed; `pnpm graph:check` allows no package cycle.

### Minor Changes

- eddcba0: Permission filters fail closed.

  `filter-to-query` translated DaaS permission filters into Supabase queries by dropping whatever it could not express: an unknown operator, a relational path such as `{ owner: { id: { _eq: "$CURRENT_USER" } } }`, an `_in` whose value was not an array (every `_in: "$CURRENT_ROLES"`), or a dynamic variable it did not resolve. The query then ran without that restriction and returned every row — and static-token users run through the service-role client, so RLS did not catch it.

  Any filter the translator cannot enforce faithfully now throws `UnsupportedPermissionFilterError` (a 403 `PermissionError`). `getPermissionFilters` turns that into its deny-all filter; `applyFilterToQuery` throws it to the caller. Values inside `.or()` and `in.(…)` strings are quoted and escaped, closing a PostgREST filter-string injection.

  `$CURRENT_ROLES`, `$CURRENT_POLICIES` and `$NOW` are now resolved; `$CURRENT_USER.<field>`, `$NOW(<offset>)` and `$FOLLOW` deny.

  Behaviour changes to check against your permissions:

  - A filter that "worked" because part of it was silently dropped now denies.
  - `_contains` / `_ncontains` are substring matches, as the permission editor describes them. They were translated to array containment, which errors on text columns. `_nicontains`, `_istarts_with`, `_nistarts_with`, `_iends_with`, `_niends_with` and `_regex` are new.
  - `_empty` / `_nempty` match NULL or `''` (previously NULL only).
  - `_null` / `_nnull` require a boolean; `_eq: null` throws (use `_null`); an empty `_or: []` denies.
  - `$CURRENT_ROLE` for a user with no role denies (it resolved to `null`).

- b4030ca: More fail-closed fixes in `auth/enforcer` and `auth/session`, found while adding tests for them.

  - Only an explicit `true` grants: `check_permission` results and `admin_access` values such as `'false'`, `1` or `{}` used to count as granted/admin (in `enforcePermission`, `getUserPermissions`, `getPermissionFilters` and `isAdmin()`, which also returned the raw value).
  - `getUserPermissions` and `getPermissionFilters` ignored errors from the admin and policy lookups.
  - `getPermissionFilters` returned `undefined` — read by callers as "no filter", full access — for a permission row without a `permissions` key; any malformed row now denies.
  - `getAccessibleFields` passed a non-array RPC result through, so a bare `'*'` string granted every field.
  - An empty `Bearer ` token is rejected before any lookup.
  - The deny-all filter is now `id IS NULL AND id IS NOT NULL`. The old `id = '__DENY_ALL__'` made PostgREST answer 400 instead of an empty result on uuid and integer `id` columns.

  Known gap, not changed here: `daas_users.status` is only checked for static tokens, so a suspended user keeps a cookie/JWT session until it expires.

### Patch Changes

- Updated dependencies [9544e24]
- Updated dependencies [443b901]
- Updated dependencies [60ae923]
- Updated dependencies [3fd3c13]
- Updated dependencies [5147727]
- Updated dependencies [42ab7ff]
  - @buildpad/utils@3.0.0
  - @buildpad/types@3.0.0

## 2.6.0

### Patch Changes

- Updated dependencies [aa26d2b]
  - @buildpad/utils@2.6.0
  - @buildpad/types@2.6.0

## 2.5.0

### Patch Changes

- @buildpad/types@2.5.0
- @buildpad/utils@2.5.0

## 2.4.0

### Minor Changes

- eec0a9e: Fix the bugs and code smells reported by a SonarQube scan.

  Most of the changes are refactors with no change in behavior: unused imports, variables and callbacks removed; `Number.parseInt`/`Number.isNaN`, `RegExp#exec`, `Set` lookups and `??=` used where they apply; `node:` imports for Node built-ins (including the CLI's `lib/oauth/pkce.ts` template); and the two most complex functions, the MCP server's tool dispatcher and the CLI's `upgrade`, split into smaller functions. The changes you can see:

  - **`generateToken`** (`@buildpad/ui-users`) throws when `crypto.getRandomValues` is unavailable, instead of falling back to the predictable `Math.random()`.
  - **Keyboard access:** the header context-menu items in `CollectionList`, and the inline "all / none" and "reset" links in `SystemPermissions`, now respond to Enter and Space.
  - **Editable rows keep their input:** removing a scope-pattern row in `RoleDetail` or a condition row in `ConditionsEditor` no longer moves the cursor into another row's field.
  - **No more `[object Object]`:** an object value renders as JSON in `CollectionList`'s choice, uuid and collection-item-dropdown cells and in `formatFieldValue`. `ListM2M` builds no item link for an object key, `ListO2M` substitutes `null` for an object in a filter template, and `AutocompleteAPI` no longer gives every result the same value when `textPath` or `valuePath` resolves to an object.
  - **Sorting:** the `Tags` interface sorts alphabetically with `localeCompare`, so mixed-case and accented tags sort correctly.
  - **Relation hooks** use `isExistingItem` instead of the deprecated `isValidPrimaryKey`.
  - **Errors:** three failure paths log the caught error before they show their failure message.
  - **MCP server:** importing the module no longer starts the stdio server (`node dist/index.js` still does), and the tool handler is exported as `handleCallToolRequest`.

  Also adds tests, and `test:coverage` scripts with lcov output for SonarQube.

### Patch Changes

- Updated dependencies [eec0a9e]
  - @buildpad/types@2.4.0
  - @buildpad/utils@2.4.0

## 2.3.0

### Minor Changes

- b799724: Internationalization, phase 2.

  **Component i18n core** (`@buildpad/utils` → `lib/buildpad/i18n/*`, `@buildpad/services`, `@buildpad/hooks`): one `BuildpadTranslations` dictionary shape with English defaults and a bundled `id` catalog, `mergeTranslations` / `interpolate` / `formatCount` (Intl.PluralRules) helpers, and `BuildpadI18nProvider` + `useBuildpadI18n()` / `useBuildpadTranslations()` for locale, direction, pinned-time-zone `formatDate`, `formatNumber` and dictionary lookup. Without a provider every component keeps its English defaults and browser formatting, so existing consumers are untouched. Precedence is component prop > provider dictionary > defaults. `ListM2M`'s `translations` module now re-exports the shared `interfaces.listM2M` namespace (same API).

  **CLI shell — every scaffolded app is locale-ready** (`@buildpad/cli`): a new `i18n` lib module (`lib/i18n/*`: locale config, Accept-Language negotiation, server-loaded dictionaries, an app `I18nProvider` that also mounts `BuildpadI18nProvider`, `useLocaleRouter()` / `useSwitchLocale()`, content-translation query helpers, `components/LanguageSwitcher.tsx`). The root layout moves to `app/[lang]/layout.tsx` (`generateStaticParams`, `notFound()` for unknown locales, `<html lang dir>`, `DirectionProvider`); every page/layout entry of `api-routes`, `content-routes`, `files-routes`, `users-routes`, `forms-routes` and `scope-routes` is retargeted under `app/[lang]/`; `middleware.ts` redirects unprefixed requests to the negotiated locale before refreshing the session; `lib/supabase/middleware.ts` gates routes with the prefix stripped; the login page, app shell (`localeHref`, `stripLocale`, dictionary `labelKey`s, a built-in `LanguageSwitcher` and a `headerActions` slot) and all route pages use the dictionary and the locale-aware router. `app/api/auth/user` gains a field-restricted `PATCH` (language, theme, first_name, last_name, avatar) proxying DaaS `/users/me`, which is what the `LanguageSwitcher` uses to remember a locale choice across devices. `buildpad init|bootstrap --locales en,id [--default-locale en]` configures locales; `buildpad migrate i18n` moves an existing app onto `app/[lang]`; `upgrade` installs lib-module dependencies a release introduces; `validate` flags a duplicate root layout or a missing i18n module.

  **Every package reads its strings from the shared dictionary** (`ui-form`, `ui-table`, `ui-collections`, `ui-interfaces`, `ui-files`, `ui-users`, `ui-forms`, and the relation hooks in `@buildpad/hooks`): ~1,700 user-facing literals moved into `lib/buildpad/i18n/namespaces/*` with English defaults and a complete Bahasa Indonesia catalog. English output is unchanged; mount `BuildpadI18nProvider` (the CLI's `I18nProvider` does it) to render another locale. Main components gained a `translations` prop for per-instance overrides (VForm, VTable, CollectionList, CollectionForm, FileManager, UsersManager, FormBuilder, Upload, ListM2M/O2M/M2A, …); existing text props (`loadingText`, `noItemsText`, ListM2M `translations`) keep precedence. Dates and numbers shown by these components go through the provider's `formatDate`/`formatNumber` (browser locale and zone without a provider, pinned zone with one) — two visible differences: item counts are digit-grouped for the locale (`1,234 items`), and a cell holding an invalid date renders empty instead of "Invalid Date". The `DateTime` interface loads dayjs locale data on demand and localises its calendar. Storybook has a Locale toolbar (`en`, `id`, `ar` for RTL). `InterfaceErrorBoundary` is now a function-component wrapper around the class (same JSX usage). The ESLint rule `buildpad/no-untranslated-literal` guards the migrated packages. A dictionary slot counts as a plural entry only when every key is a CLDR category, so overriding `interfaces.selectRadio.other` no longer drops that namespace's sibling strings.

### Patch Changes

- Updated dependencies [b799724]
  - @buildpad/utils@2.3.0
  - @buildpad/types@2.3.0

## 2.2.0

### Patch Changes

- @buildpad/types@2.2.0
- @buildpad/utils@2.2.0

## 2.1.0

### Patch Changes

- @buildpad/types@2.1.0
- @buildpad/utils@2.1.0

## 2.0.0

### Patch Changes

- @buildpad/types@2.0.0
- @buildpad/utils@2.0.0

## 1.11.1

### Patch Changes

- Updated dependencies [585362e]
- Updated dependencies [89f532b]
- Updated dependencies [c67c651]
- Updated dependencies [ddbc1bd]
- Updated dependencies [50a4057]
- Updated dependencies [577eda9]
  - @buildpad/utils@1.11.1
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
  - @buildpad/utils@1.10.0

## 1.9.3

### Patch Changes

- @buildpad/types@1.9.3
- @buildpad/utils@1.9.3

## 1.9.2

### Patch Changes

- @buildpad/types@1.9.2
- @buildpad/utils@1.9.2

## 1.9.1

### Patch Changes

- @buildpad/types@1.9.1
- @buildpad/utils@1.9.1

## 1.9.0

### Patch Changes

- @buildpad/types@1.9.0
- @buildpad/utils@1.9.0

## 1.8.1

### Patch Changes

- @buildpad/types@1.8.1
- @buildpad/utils@1.8.1

## 1.8.0

### Patch Changes

- @buildpad/types@1.8.0
- @buildpad/utils@1.8.0

## 1.7.0

### Patch Changes

- Updated dependencies [90dc795]
  - @buildpad/types@1.8.0
  - @buildpad/utils@1.8.0

## 1.6.0

### Patch Changes

- @buildpad/types@1.6.0
- @buildpad/utils@1.6.0

## 1.5.0

### Patch Changes

- @buildpad/types@1.5.0

## 1.4.1

### Patch Changes

- fix(services): initialize `authLoading` to `autoFetchUser` in `DaaSProvider`

  `DaaSProvider` previously initialized `authLoading` to `false`, so during the
  first render window — before `/api/users/me` resolves — consumers observed
  `(authLoading=false, user=null)`, which auth-gated pages read as "signed out",
  flashing a false error before the user loaded. `authLoading` now initializes to
  `autoFetchUser` (identical on server and client, so no hydration mismatch), and
  an `else` branch sets it back to `false` when the provider won't fetch
  (auto-fetch off or no DaaS URL) so it never gets stuck on. The signed-out error
  now only appears once auth genuinely settles with no user.

  - @buildpad/types@1.4.1

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

## 0.2.0

### Patch Changes

- Established per-package semver baseline. This package now carries its own independent version tracked via Changesets. Future releases will record component-level changes here so `npx buildpad outdated` and `npx buildpad changelog` can surface the relevant diff.
