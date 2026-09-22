# @buildpad/services

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
