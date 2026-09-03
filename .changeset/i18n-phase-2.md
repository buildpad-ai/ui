---
"@buildpad/cli": minor
"@buildpad/utils": minor
"@buildpad/services": minor
"@buildpad/hooks": minor
"@buildpad/ui-interfaces": minor
"@buildpad/ui-form": minor
"@buildpad/ui-table": minor
"@buildpad/ui-collections": minor
"@buildpad/ui-files": minor
"@buildpad/ui-users": minor
"@buildpad/ui-forms": minor
---

Internationalization, phase 2.

**Component i18n core** (`@buildpad/utils` → `lib/buildpad/i18n/*`, `@buildpad/services`, `@buildpad/hooks`): one `BuildpadTranslations` dictionary shape with English defaults and a bundled `id` catalog, `mergeTranslations` / `interpolate` / `formatCount` (Intl.PluralRules) helpers, and `BuildpadI18nProvider` + `useBuildpadI18n()` / `useBuildpadTranslations()` for locale, direction, pinned-time-zone `formatDate`, `formatNumber` and dictionary lookup. Without a provider every component keeps its English defaults and browser formatting, so existing consumers are untouched. Precedence is component prop > provider dictionary > defaults. `ListM2M`'s `translations` module now re-exports the shared `interfaces.listM2M` namespace (same API).

**CLI shell — every scaffolded app is locale-ready** (`@buildpad/cli`): a new `i18n` lib module (`lib/i18n/*`: locale config, Accept-Language negotiation, server-loaded dictionaries, an app `I18nProvider` that also mounts `BuildpadI18nProvider`, `useLocaleRouter()` / `useSwitchLocale()`, content-translation query helpers, `components/LanguageSwitcher.tsx`). The root layout moves to `app/[lang]/layout.tsx` (`generateStaticParams`, `notFound()` for unknown locales, `<html lang dir>`, `DirectionProvider`); every page/layout entry of `api-routes`, `content-routes`, `files-routes`, `users-routes`, `forms-routes` and `scope-routes` is retargeted under `app/[lang]/`; `middleware.ts` redirects unprefixed requests to the negotiated locale before refreshing the session; `lib/supabase/middleware.ts` gates routes with the prefix stripped; the login page, app shell (`localeHref`, `stripLocale`, dictionary `labelKey`s, a built-in `LanguageSwitcher` and a `headerActions` slot) and all route pages use the dictionary and the locale-aware router. `app/api/auth/user` gains a field-restricted `PATCH` (language, theme, first_name, last_name, avatar) proxying DaaS `/users/me`, which is what the `LanguageSwitcher` uses to remember a locale choice across devices. `buildpad init|bootstrap --locales en,id [--default-locale en]` configures locales; `buildpad migrate i18n` moves an existing app onto `app/[lang]`; `upgrade` installs lib-module dependencies a release introduces; `validate` flags a duplicate root layout or a missing i18n module.

**Every package reads its strings from the shared dictionary** (`ui-form`, `ui-table`, `ui-collections`, `ui-interfaces`, `ui-files`, `ui-users`, `ui-forms`, and the relation hooks in `@buildpad/hooks`): ~1,700 user-facing literals moved into `lib/buildpad/i18n/namespaces/*` with English defaults and a complete Bahasa Indonesia catalog. English output is unchanged; mount `BuildpadI18nProvider` (the CLI's `I18nProvider` does it) to render another locale. Main components gained a `translations` prop for per-instance overrides (VForm, VTable, CollectionList, CollectionForm, FileManager, UsersManager, FormBuilder, Upload, ListM2M/O2M/M2A, …); existing text props (`loadingText`, `noItemsText`, ListM2M `translations`) keep precedence. Dates and numbers shown by these components go through the provider's `formatDate`/`formatNumber` (browser locale and zone without a provider, pinned zone with one) — two visible differences: item counts are digit-grouped for the locale (`1,234 items`), and a cell holding an invalid date renders empty instead of "Invalid Date". The `DateTime` interface loads dayjs locale data on demand and localises its calendar. Storybook has a Locale toolbar (`en`, `id`, `ar` for RTL). `InterfaceErrorBoundary` is now a function-component wrapper around the class (same JSX usage). The ESLint rule `buildpad/no-untranslated-literal` guards the migrated packages.
