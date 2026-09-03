# Internationalization — Phase 2 (Buildpad UI)

**Status:** implemented on `feat/i18n-phase-2` — B1 core, Workstream A (CLI shell) and the B2/B3 package migration (every package + the relation hooks) are done; remaining: the `add-i18n` skill patch and Phase 3 items · **Owner:** Buildpad UI · **Depends on:** the `add-i18n` skill in `buildpad-ai/skills` (Phase 1)

## Why this phase exists

Phase 1 is a skill: it retrofits a generated app with `app/[lang]` routing, middleware locale negotiation, dictionaries, a `LanguageSwitcher`, and Directus-style content translations on DaaS. It works today, but three things only this repo can fix:

1. **Every generated app is English-only by default.** `buildpad bootstrap` produces `<html lang="en">`, a hardcoded login form, and route templates with no locale segment. The skill can restructure them afterwards, but that edits CLI-owned files (`middleware.ts`, `lib/supabase/middleware.ts`, `app/layout.tsx`, every page), which forks them from `buildpad upgrade`.
2. **Buildpad components carry hardcoded English chrome.** ~50 registry files ship literals (`"No results — try adjusting your search or filters"`, `"Drop files here"`, `"This field is required"`, aria-labels, notifications) with no override props, except `ListM2M`'s `translations` prop, `VTable`'s `loadingText`/`noItemsText`, and `VForm`'s `locale`. Copy & Own means a consumer who patches them diverges every file's checksum.
3. **Dates and numbers ignore the URL locale.** Bare `toLocaleDateString()` / `toLocaleString()` calls use the browser locale and produce hydration mismatches; the `DateTime` interface loads no dayjs locales and no Mantine `DatesProvider` exists.

**Goal:** a `buildpad bootstrap` app is locale-ready out of the box, and Buildpad components render in the app's locale without consumers editing copied files. Everything ships as additive props and context with English defaults — no breaking changes.

## Scope

| Workstream | What | Size | Ships with |
| --- | --- | --- | --- |
| **A. CLI shell** | `[lang]` routing, locale-aware middleware, `i18n` lib module, switcher in the shell | Small, high leverage (~1–2 weeks) | The `add-i18n` skill's "already prefixed" branch |
| **B. Component i18n** | Shared provider + string externalization + locale-aware formatting across packages | Large, incremental (~4–6 weeks, one package per PR) | Package minors; consumers pick up via `buildpad upgrade` |

**Not in this phase:** RTL audit (logical CSS, `dir` propagation beyond `DirectionProvider`), adopting the provider in the DaaS admin app, translating runtime-authored form-builder definitions, and Directus-parity `translations` on DaaS (interface + junction wizard + relation-writer branch + `deep` filter). These are Phase 3 candidates.

---

## Workstream A — CLI shell: `[lang]` by default

### A1. New lib module `i18n`

Add to `packages/registry.template.json` under `lib`:

| Source (`cli/templates/lib/i18n/`) | Target |
| --- | --- |
| `config.ts` | `lib/i18n/config.ts` |
| `negotiate.ts` | `lib/i18n/negotiate.ts` |
| `types.ts` | `lib/i18n/types.ts` |
| `dictionaries.ts` | `lib/i18n/dictionaries.ts` |
| `dictionaries/en.json` | `lib/i18n/dictionaries/en.json` |
| `provider.tsx` | `lib/i18n/provider.tsx` |
| `navigation.ts` | `lib/i18n/navigation.ts` |
| `content.ts` | `lib/i18n/content.ts` |
| `../components/LanguageSwitcher.tsx` | `components/LanguageSwitcher.tsx` |

Dependencies: `negotiator`, `@formatjs/intl-localematcher`, `server-only`; dev `@types/negotiator`. The file contents are the ones in the skill's `locale-routing.instructions.md` — the skill and the templates must stay byte-identical (add a CI check that diffs them, or make the skill reference point at the templates).

### A2. Route templates move under `[lang]`

- `packages/cli/src/commands/init.ts`: copy `app/layout.tsx` → `app/[lang]/layout.tsx` and `app/authenticated-page.tsx` → `app/[lang]/(authenticated)/page.tsx`. The layout template gains `generateStaticParams`, `notFound()` for unknown locales, `<html lang dir>`, `DirectionProvider`, and `<I18nProvider>`; CSS imports become `../globals.css`.
- `registry.template.json`: retarget every page/layout entry — `api-routes` (`app/(authenticated)/layout.tsx`, `app/login/page.tsx`), `content-routes`, `files-routes`, `users-routes`, `forms-routes`, `scope-routes` — from `app/…` to `app/[lang]/…`. All `app/api/**` targets stay unprefixed. Regenerate with `pnpm build:registry`.

### A3. Middleware templates

- `cli/templates/middleware/middleware.ts`: redirect unprefixed, non-`/api` requests to the negotiated locale **before** `updateSession` (so no refreshed cookie is lost), using `publicOrigin()`.
- `cli/templates/supabase/middleware.ts`: compare `publicRoutes` against `stripLocale(pathname)`; redirect to `/${locale}/login`.
- **Decision needed:** the CLI pins `next ^16.1.6` but still emits `middleware.ts`. Since both files are rewritten here, decide whether to adopt Next 16's `proxy.ts` naming in the same change (confirm current Next 16 behavior for `middleware.ts` first).

### A4. Scaffolded literals and the shell

- `cli/templates/api/login-page.tsx`: labels/validation from `useI18n()`; `router.push('/')` → `useLocaleRouter()`.
- `cli/templates/components/layout/AuthenticatedShell.tsx`: `navItems[].href` through `localeHref`, active matching on `stripLocale(pathname)`, and a `headerActions` slot (or a built-in `LanguageSwitcher` behind a prop). `DEFAULT_NAV_ITEMS` labels from the dictionary.
- `cli/templates/app/content/layout.tsx` and every route page: `useRouter()` → `useLocaleRouter()`.
- `cli/templates/app/authenticated-layout.tsx` unchanged in structure (Bug 22 still holds — `DaaSProviderWrapper` stays here, `I18nProvider` is in the root layout because it holds no auth state).

### A5. Install order

`add.ts --with-api`: `supabase-auth` → **`i18n`** → `api-routes` → `external-oauth`, because the login page and middleware import from `lib/i18n`. `init.ts` must install `i18n` before copying the `[lang]` layout. Record it in `buildpad.json` `installedLib`. `auth-user-route.ts` already proxies DaaS `/users/me`, whose payload carries `language` — no change, document it.

### A6. Upgrade path for existing apps

Moved targets are new files; old ones become orphans (`app/layout.tsx`, `app/login/page.tsx`, …). Add `buildpad migrate i18n` (in `migrate.ts`) that moves the files, rewrites the CSS relative imports, deletes orphans, and runs `add i18n`; document the manual equivalent in `docs/CLI.md`. Bump `lastChangedIn` on every retargeted entry.

### A7. Tests and acceptance

- CLI e2e: `bootstrap` → `pnpm build` passes; Playwright on the scaffolded app: `/` → `/en`, `Accept-Language: id` → `/id`, `NEXT_LOCALE` cookie wins, `/xx/login` 404, unauthenticated `/id/content` → `/id/login`, switcher navigates and sets the cookie.
- `pnpm registry:check` in sync; `buildpad validate` passes; `apps/storybook-host` unaffected.

---

## Workstream B — Component i18n

### B1. Design

```
packages/utils/src/i18n/
├── types.ts        BuildpadTranslations — one namespace per package:
│                   common · form (validation catalog) · table · collections · interfaces.{listM2M,listO2M,listM2A,upload,selectIcon,datetime,…} · files · users · forms
├── defaults.ts     English defaults (the only place literals are allowed)
├── merge.ts        deep merge: prop override > provider > defaults
├── interpolate.ts  the existing `{key}` convention from list-m2m/translations.ts
└── plural.ts       formatCount() on Intl.PluralRules (replaces the one/other special case)

packages/services/src/BuildpadI18nProvider.tsx   next to DaaSProvider
packages/hooks/src/useBuildpadI18n.ts            { locale, direction, t, translations, formatDate, formatNumber }
```

- **No provider → English defaults and the browser locale.** Storybook, tests, and every existing consumer keep working untouched.
- **Precedence:** component prop (`translations`, `noItemsText`, …) > provider dictionary > defaults. Existing props stay; `ListM2M`'s own `translations.ts` becomes a re-export of the shared `interfaces.listM2M` namespace.
- The `buildpad.*` namespace in the Phase 1 app dictionary is designed to be exactly this shape, so an app passes `dictionary.buildpad` to `BuildpadI18nProvider` once in its root layout.

### B2. Migration order (by duplication and blast radius)

1. `ui-form` — `ValidationErrors.tsx` default catalog and its duplicate in `FormField.tsx` → one `form.validation.*` namespace.
2. `ui-table` — `VTable` texts, `TableRow`/`TableHeader` aria-labels, date cells.
3. `ui-collections` — `CollectionList` empty states, `CollectionForm` `Create`/`Save`, toolbar search, `BulkActionsBar`, `ContentNavigation`, `FilterPanel`.
4. `ui-interfaces` — relational lists, `Upload`, `SelectIcon`, `DateTime` (see B3), then the long tail.
5. `ui-files`, 6. `ui-users`, 7. `ui-forms` (builder chrome only — authored form content is out of scope).
8. CLI templates (`login-page`, `AuthenticatedShell`, `scope-switcher`) consume the same provider.

Definition of done per package: no user-facing literal outside `defaults.ts` (add an ESLint rule scoped to `packages/*/src` for JSX text and `notifications.show` titles), Storybook renders the `id` locale, tests green.

### B3. Dates and numbers

- `useBuildpadI18n().formatDate/formatNumber` with explicit locale and a pinned `timeZone` (from the provider; default `UTC`).
- Replace bare `toLocaleDateString()`/`toLocaleString()` in `TableRow`, `CollectionList`, `FilesList`, `FileInfoPanel`, `RoleDetail`.
- `DateTime` interface: a dynamic-import map of dayjs locales for supported codes; the provider mounts Mantine `DatesProvider` (`locale`, `firstDayOfWeek`).

### B4. Storybook and tests

Global decorator in every `packages/*/.storybook/preview.tsx` wrapping `BuildpadI18nProvider`, a toolbar locale switch, and a per-locale visual snapshot for `CollectionList`, `CollectionForm`, `Upload`, and `DateTime`.

### B5. Distribution

- Add `utils/src/i18n/*.ts` to the `utils` lib module (targets `lib/buildpad/i18n/*`), the provider to `services`, the hook to `hooks`; the transformer's alias rewrite covers `@buildpad/utils/i18n`.
- Consumer dictionaries live outside copied files (`lib/i18n/dictionaries/*.json`), so upgrades never collide with translations.
- Rollout rules: additive only; one package per PR with a changelog entry; consumers with pristine copies upgrade silently, modified copies get the usual three-way merge prompt — batch releases so that happens once per package, not per string.

---

## Sequencing

1. **B1 design + provider** (unblocks everything; ~1 week).
2. **A1–A7** in one CLI release, together with the `add-i18n` skill update that detects `app/[lang]` and skips the retrofit.
3. **B2 packages** in order, one PR each; B3/B4 ride along with the package that owns the code.
4. `pnpm sync:skills` in `buildpad-platform` after each skill change so downloaded starters carry it.

## Risks

- **Hydration mismatches** from date/number formatting — mitigated by explicit locale + timeZone everywhere; lint for bare `toLocale*()`.
- **Install-order dependency** — the login page imports `useI18n` before the `i18n` module exists if the chain is wrong; the provider's default-English fallback keeps a broken order from crashing at runtime, the CLI order fix keeps it from failing at build.
- **Checksum churn** on `buildpad upgrade` for consumers who modified copied files — communicate per-package, ship `migrate i18n`.
- **Next 16 `proxy.ts` naming** — decide before A3 so the templates are only rewritten once.
- **Client bundle** — the app dictionary ships to the client (every Buildpad page is a client component); keep dictionaries to UI strings, never content.

## Decisions (taken while implementing)

1. **`middleware.ts` stays for this release.** Next 16.1 still accepts it; 16.3 prints a deprecation in favour of `proxy.ts`. Renaming the tracked file would leave existing apps with both `middleware.ts` (kept on disk by `upgrade`) and `proxy.ts`, which Next refuses. The template documents the identical `proxy.ts` body; `npx @next/codemod@canary middleware-to-proxy .` is the user-run path. Revisit when the CLI drops Next 16.1.
2. **Always-prefix.** `/` → `/<locale>`, no unprefixed default locale. An unknown first segment (`/xx/login`) is treated as a path and prefixed (`/en/xx/login`), which then 404s — so two-letter app routes keep working.
3. **Both.** `AuthenticatedShell` renders `LanguageSwitcher` in its header by default (`showLanguageSwitcher={false}` hides it; it renders nothing with one locale) and exposes a `headerActions` slot.
4. **`--locales` on `init`/`bootstrap`/`migrate i18n`**, rewriting marker-delimited blocks in `lib/i18n/config.ts` and `dictionaries.ts` and seeding `dictionaries/<code>.json` from `en.json`; editing those blocks by hand is equivalent.

Also decided: the app-level `I18nProvider` (lib/i18n) mounts `BuildpadI18nProvider` itself with the catalog Buildpad ships for the locale (`bundledTranslationsFor`) under the app's `buildpad.*` overrides, so the `i18n` lib module depends on `services`; `supabase-auth`, `design-system` and `api-routes` depend on `i18n`; `upgrade` installs lib dependencies a release introduces. Without a provider, components keep English defaults AND browser locale/time zone (no behaviour change for existing consumers); with a provider the time zone is pinned to UTC unless given.

## Status

| Item | State |
| --- | --- |
| B1 core (`utils/src/i18n`, `BuildpadI18nProvider`, `useBuildpadI18n`, tests) | done |
| A1–A6 (i18n module, `[lang]` templates, middleware, shell, install order, `migrate i18n`) | done |
| A7 (`packages/cli/tests/e2e/bootstrap-i18n.sh`: bootstrap → build → start → redirect assertions) | done, manual/nightly |
| B4 Storybook decorator (`packages/storybook-i18n.tsx`, Locale toolbar in every preview) | done |
| B2 ESLint rule `buildpad/no-untranslated-literal` (warn; error per migrated package via `I18N_MIGRATED`) | done |
| B2 package migration (`ui-form`, `ui-table`, `ui-collections`, `ui-interfaces`, `ui-files`, `ui-users`, `ui-forms`, relation hooks) + B3 dates | done — ~1,700 literals, all packages at lint error level (`I18N_MIGRATED`), `id` catalog complete |
| `add-i18n` skill update (already-prefixed default, `buildpad.*` = `BuildpadTranslations`) | patch in `docs/skill-patches/add-i18n-phase-2.patch`, to be applied in `buildpad-ai/skills` |
