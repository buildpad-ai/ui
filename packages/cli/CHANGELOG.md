# @buildpad/cli

## 2.3.0

### Minor Changes

- b799724: Internationalization, phase 2.

  **Component i18n core** (`@buildpad/utils` → `lib/buildpad/i18n/*`, `@buildpad/services`, `@buildpad/hooks`): one `BuildpadTranslations` dictionary shape with English defaults and a bundled `id` catalog, `mergeTranslations` / `interpolate` / `formatCount` (Intl.PluralRules) helpers, and `BuildpadI18nProvider` + `useBuildpadI18n()` / `useBuildpadTranslations()` for locale, direction, pinned-time-zone `formatDate`, `formatNumber` and dictionary lookup. Without a provider every component keeps its English defaults and browser formatting, so existing consumers are untouched. Precedence is component prop > provider dictionary > defaults. `ListM2M`'s `translations` module now re-exports the shared `interfaces.listM2M` namespace (same API).

  **CLI shell — every scaffolded app is locale-ready** (`@buildpad/cli`): a new `i18n` lib module (`lib/i18n/*`: locale config, Accept-Language negotiation, server-loaded dictionaries, an app `I18nProvider` that also mounts `BuildpadI18nProvider`, `useLocaleRouter()` / `useSwitchLocale()`, content-translation query helpers, `components/LanguageSwitcher.tsx`). The root layout moves to `app/[lang]/layout.tsx` (`generateStaticParams`, `notFound()` for unknown locales, `<html lang dir>`, `DirectionProvider`); every page/layout entry of `api-routes`, `content-routes`, `files-routes`, `users-routes`, `forms-routes` and `scope-routes` is retargeted under `app/[lang]/`; `middleware.ts` redirects unprefixed requests to the negotiated locale before refreshing the session; `lib/supabase/middleware.ts` gates routes with the prefix stripped; the login page, app shell (`localeHref`, `stripLocale`, dictionary `labelKey`s, a built-in `LanguageSwitcher` and a `headerActions` slot) and all route pages use the dictionary and the locale-aware router. `app/api/auth/user` gains a field-restricted `PATCH` (language, theme, first_name, last_name, avatar) proxying DaaS `/users/me`, which is what the `LanguageSwitcher` uses to remember a locale choice across devices. `buildpad init|bootstrap --locales en,id [--default-locale en]` configures locales; `buildpad migrate i18n` moves an existing app onto `app/[lang]`; `upgrade` installs lib-module dependencies a release introduces; `validate` flags a duplicate root layout or a missing i18n module.

  **Every package reads its strings from the shared dictionary** (`ui-form`, `ui-table`, `ui-collections`, `ui-interfaces`, `ui-files`, `ui-users`, `ui-forms`, and the relation hooks in `@buildpad/hooks`): ~1,700 user-facing literals moved into `lib/buildpad/i18n/namespaces/*` with English defaults and a complete Bahasa Indonesia catalog. English output is unchanged; mount `BuildpadI18nProvider` (the CLI's `I18nProvider` does it) to render another locale. Main components gained a `translations` prop for per-instance overrides (VForm, VTable, CollectionList, CollectionForm, FileManager, UsersManager, FormBuilder, Upload, ListM2M/O2M/M2A, …); existing text props (`loadingText`, `noItemsText`, ListM2M `translations`) keep precedence. Dates and numbers shown by these components go through the provider's `formatDate`/`formatNumber` (browser locale and zone without a provider, pinned zone with one) — two visible differences: item counts are digit-grouped for the locale (`1,234 items`), and a cell holding an invalid date renders empty instead of "Invalid Date". The `DateTime` interface loads dayjs locale data on demand and localises its calendar. Storybook has a Locale toolbar (`en`, `id`, `ar` for RTL). `InterfaceErrorBoundary` is now a function-component wrapper around the class (same JSX usage). The ESLint rule `buildpad/no-untranslated-literal` guards the migrated packages. A dictionary slot counts as a plural entry only when every key is a CLDR category, so overriding `interfaces.selectRadio.other` no longer drops that namespace's sibling strings.

- b272d96: List managers persist search, filters, sort, and page in the URL by default.

  `UsersManager`, `RolesManager`, `PoliciesManager`, and `FileManager` now mirror
  their settled list state into the query string (`?search=…&role=…&status=…`,
  `?folder=…`, `?sort=-email&page=2`) via a new `useUrlListParams` hook in
  `@buildpad/hooks` — so a filtered view is shareable, reload-safe, and
  observable by URL-level integrations such as the micro-frontend bridge.
  Writes ride the managers' existing 300 ms search debounce, so there is no
  extra work per keystroke; browser Back/Forward and programmatic rewrites
  (dispatch the exported `URL_STATE_EVENT`) flow back into component state.

  **Next.js App Router apps must register a URL writer.** The hook has no
  framework imports (it must keep rendering in Storybook), so it writes through
  whatever the app registers with `registerUrlStateWriter`. The updated
  `DaaSProviderWrapper` template registers `router.replace`; without it the hook
  falls back to native `history.replaceState`, which the App Router ignores
  (`useSearchParams` never updates) and re-asserts its own URL over (observed on
  Next 16) — the parameters silently vanish. If you have customised
  `DaaSProviderWrapper`, add the registration by hand; in development the hook
  warns once when it detects Next.js and no writer. Consumers on `@/lib/buildpad/hooks`
  get the new exports from the regenerated barrel (`useUrlListParams`,
  `useHydrated`, `readUrlParam`, `readUrlIntParam`, `registerUrlStateWriter`,
  `URL_STATE_EVENT`).

  The managers are client-gated (`useHydrated`) while URL persistence is on:
  seeding state from the URL in `useState` initialisers would otherwise render
  differently on the server and the client, a hydration mismatch on every deep
  link. Until hydration they render the same loading shell they showed before
  their first fetch, so nothing meaningful is lost from server output.

  Two url-synced lists on one page (`urlParamPrefix`) merge additively even
  through an asynchronous router writer: the hook merges into the query it last
  asked to be written, not into a `location.search` that has not caught up yet.

  Defaults stay off the URL entirely; deep-linked `?folder=` ids rebuild their
  breadcrumb via the new `useFolders().fetchFolder`. Opt out per instance with
  `urlParams={false}` (embedded surfaces), or namespace with
  `urlParamPrefix="users-"` when two lists share a page.

## 2.2.0

## 2.1.0

### Patch Changes

- 5bec3a1: CLI: install `@tiptap/core` alongside `rich-text-markdown`, fixing a build-blocking TypeScript error.

  `rich-text-markdown.tsx` declares a module augmentation (`declare module '@tiptap/core' { ... }`) to add the `markdown` property to TipTap's `Storage` type, but `@tiptap/core` was never listed as a direct dependency for the component — only pulled in transitively via `@tiptap/react`/`@tiptap/starter-kit`. A transitive dependency isn't enough for TypeScript to resolve the module for augmentation, so every project that installed `rich-text-markdown` (including via `bootstrap`, which installs all components) failed `next build` with:

  ```
  error TS2664: Invalid module name in augmentation, module '@tiptap/core' cannot be found.
  error TS2339: Property 'markdown' does not exist on type 'Storage'.
  ```

  `@tiptap/core` is now registered as a direct dependency of `rich-text-markdown` in the registry, pinned in the CLI's `DEPENDENCY_VERSIONS` map, and recognized by `fix`'s known-package list. That last part matters on its own: without it, `buildpad fix` would emit `declare module '@tiptap/core';` as an untyped-package stub, which replaces the real module and breaks the very augmentation this fixes.

  Note `@tiptap/core` is a _peer_ dependency of `@tiptap/react`, not a transitive one, so whether it reaches `node_modules` at all depends on the package manager's auto-peer-install and hoisting behaviour — it was never something the app could rely on.

  The same component also imports `@tabler/icons-react` (for `IconCode`/`IconEdit`/`IconPhoto`/`IconTable`/`IconHeading`) without declaring it; that is registered now too.

## 2.0.0

### Major Changes

- 2d8b838: Versioning and upgrade redesign: content-based staleness, pinned fetches, manifest v3.

  **Breaking: `buildpad.json` moves to schema v3.** Run `npx buildpad migrate` once
  after upgrading the CLI. An older CLI refuses to read a v3 manifest rather than
  silently dropping fields it does not understand.

  The CLI used to decide that a component was stale by comparing version numbers
  (`installed.version >= component.lastChangedIn`). That made correctness depend on
  `lastChangedIn`, which the registry build derives from full git history plus the
  tags present at build time — so a missing tag, a shallow clone, or a release-PR
  step done in the wrong order produced wrong answers. It now compares content.

  ### What changed

  - **Staleness is a hash comparison.** The registry has always recorded each
    file's `sourceSha256`; the manifest now records the same hash at install time.
    A file is stale when the two differ, or when a previous upgrade left it
    unwritten. No version, tag, or git history is consulted, so the same inputs
    give the same answer on any machine on any day.

  - **Every remote fetch is pinned to `v<cli version>`,** not to `main`. Between
    `1.10.0` and `1.11.1`, 119 source files changed on `main` while the registry
    still declared `1.10.0` — so `add` copied post-release content and recorded it
    under the previous release, and `upgrade --three-way` then merged against an
    ancestor older than what was actually installed. `npx @buildpad/cli@X.Y.Z` now
    resolves the same bytes on any day. `--ref <git-ref>` (or `BUILDPAD_REF`)
    overrides it for development, and whatever a fetch resolved to is recorded.

  - **The diff3 base is exact.** Each file records the ref it was fetched from,
    and `upgrade` fetches the base from that ref instead of guessing a tag from a
    version number. When the ref is unreachable the CLI writes a `.new` file and
    marks the entry `pending` rather than merging against the wrong ancestor.

  - **A partial upgrade is no longer recorded as complete.** Skipping a file or
    writing a `.new` keeps the file's old upstream hash and marks it `pending`, so
    `outdated` keeps reporting it. Previously the component version was advanced
    regardless and the skipped file never surfaced again.

  - **No prompt when upstream did not move.** A locally-modified file whose
    upstream hash is unchanged is left alone. It used to be offered for overwrite
    with byte-identical content whenever any sibling file in the component changed.

  - **Files removed upstream are kept and reported,** not deleted — they are the
    consumer's code — and are dropped from tracking so they stop reporting stale.

  - **`outdated` reports per file** (`changed upstream`, `pending`, `new file`,
    `removed upstream`) and hints when the CLI itself is behind npm's `latest`,
    since a pinned CLI is otherwise honestly "up to date" against its own registry
    forever. The npm check is advisory and skipped when npm is unreachable.

  - **`buildpad migrate` converts v2 to v3** by fetching the registry at
    `v<recorded version>` and copying out the real upstream hashes. Where that tag
    is unreachable it falls back to the current hashes and marks the files
    `pending`, so a guessed baseline cannot pass unnoticed.

  ### Release pipeline

  - `publish.yml` regenerates `registry.json` inside the changesets `version` step,
    so the bot's commit carries a registry that matches the bumped versions. This
    was a manual step in the release PR; forgetting it failed `registry:check`,
    and doing it before the bump wrote wrong `lastChangedIn` values.
  - Each publish now pushes one plain `v<version>` tag. Without it a release is
    unreachable to the pinned CLI. `scripts/backfill-release-tags.sh` creates the
    tags for the 17 historical releases.
  - The "quick publish (skip changesets)" procedure is removed. It is how
    `@buildpad/cli@1.11.0` reached npm with no tag, no changelog, and no commit.

  ### Other

  - Repository URLs point at `buildpad-ai/ui`; fetches no longer rely on the
    GitHub rename redirect from `microbuild-ui/ui`.
  - The CLI's duplicate `inferSourcePackage` is removed — it had already drifted
    from the registry generator's copy (missing `ui-forms/` and `ui-users/`). The
    CLI reads `sourcePackage` from the registry.
  - `lastChangedIn` remains in the registry as display data; no decision reads it.
    The "never release below 1.1.0" version floor is no longer needed.

## 1.11.1

### Patch Changes

- 56c14ae: CLI: fix a broken relative import the transformer never rewrote, and an implicit-`any` in the external-OAuth callback template.

  `normalizeImportPaths` only rewrote relative imports whose _first_ path
  segment was PascalCase (e.g. `../Upload/Upload` → `./upload`). A sibling
  import like `../select-icon/SelectIcon` — where the folder is already
  kebab-case but the filename is still PascalCase — never matched, so it
  shipped unrewritten even though `select-icon` is delivered as the flat
  sibling `components/ui/select-icon.tsx`, not a `select-icon/SelectIcon.tsx`
  directory. This broke every component that imports from `select-icon`:
  `select-dropdown`, `select-multiple-checkbox`, `select-multiple-dropdown`,
  and `select-radio` all shipped a `TS2307: Cannot find module
'../select-icon/SelectIcon'` on a fresh install. Both the static
  `from '../select-icon/SelectIcon'` and dynamic
  `import('../select-icon/SelectIcon')` forms are now flattened to
  `./select-icon`.

  `auth-callback-oauth-route.ts` (installed by the `external-oauth` lib
  module) left `setAll(cookiesToSet)` without the parameter type its sibling
  templates (`lib/supabase/server.ts`, `lib/supabase/middleware.ts`) already
  carry, producing three `TS7006`/`TS7031` implicit-`any` errors under strict
  mode.

- f4473b4: Fix `buildpad upgrade --all` (and bare `--force`) silently skipping installed lib modules.

  `--all` only populated `targetComponents`, never `targetLibModules`, so lib-module files
  (`lib/buildpad/utils/index.ts`, `lib/buildpad/types/index.ts`, `design-system`, etc.) were
  never re-synced no matter what flags were passed — only named components were. This is why
  running `upgrade --all --force` after a barrel-export fix landed upstream did not pick up
  the fix: the export lives in a lib module, and `--all` never even attempted to touch it.

  `--all` and bare `--force` now also resolve `targetLibModules` from `config.installedLib`,
  matching how `--design` and the default (no-flag) outdated-detection path already do.

- 89f532b: CLI: deliver `conceal.ts`, close the stranded utils exports, and make the registry hash platform-independent.

  `utils/src/conceal.ts` was never registered as a `utils` lib file, so `buildpad add/upgrade utils` had no way to deliver it. Five registry-delivered files already imported it — `InputHash`, `SystemToken`, `FormFieldInterface`, `CollectionForm` and `FormField` — and failed to build in consumer projects. It is now registered as `lib/buildpad/conceal.ts` and re-exported from the utils barrel.

  The barrel had also drifted across three separate commits, not one. Alongside conceal's members it now re-exports `getDefaultValuesFromFields`, `resolveChoiceLabel`, `parseChoiceValues`, `splitCsvValue`, `InterfaceChoice`, `MISSING_FIELD_MARKER`, the auto-generation helpers, and the `interface-types` / `interface-registry` / `define-interface` modules — all of which ship to consumers but had no reachable export path.

  Also fixed, because the drift was undetectable rather than unlucky:

  - `computeFileSha256` now hashes line-ending-normalised content, and a `.gitattributes` pins `eol=lf`. Hashing raw bytes made the registry platform-dependent: generated on a CRLF checkout, its hashes could never match an LF checkout, so `pnpm registry:check` failed permanently and its output was pure noise. `registry:check` now passes.
  - CI runs build, typecheck and unit tests _before_ the registry check. Fail-fast meant the red check aborted the job before any of them ran.
  - `collectUndeclaredImports` now scans `registry.lib`, resolving relative imports in target space. It previously covered components only, which is why a barrel could re-export a module that was not a registry file at all.
  - `@buildpad/cli` is now a known package folder, so `cli/templates/*` files are no longer exempt from the version guard.
  - `build-registry.mjs` only self-executes when invoked directly. The previous guard was always true, so importing it — as the test suite does — rewrote the checked-in `registry.json`.
  - `buildpad upgrade <lib>` no longer reports "up to date" when a registered file is missing on disk. A module that gains a file could not be delivered by version comparison alone, because the version cannot move until a release.
  - `buildpad add` no longer rewrites existing lib files when a module gains one. Adding a file made the "already installed" check fail, and every consumer's customised copies were silently overwritten.
  - The CLI now verifies fetched sources against the registry's `sourceSha256` and warns on mismatch. The field was written but never read.
  - `useModuleAccessKeys` and `module-access-keys` are registered and exported, and the types barrel re-exports `module-access`. `buildpad add users-management` previously produced a project that could not build.

- c1ac731: CLI: stop CloudFront from caching authenticated pages, and fix every redirect and OAuth `redirect_uri` that was built from the server's internal address.

  Two template defects surfaced in production behind AWS Amplify/CloudFront:

  - `middleware.ts` never set `Cache-Control`, so CloudFront (and any shared cache) stored authenticated pages for a year with no `Vary: Cookie` — one signed-in user's response could be served to a different visitor. It now sets `Cache-Control: private, no-store, must-revalidate` on every response.
  - Redirect targets were built from `request.url` / `request.nextUrl.origin`, which behind a reverse proxy resolves to the compute process's own `localhost:3000` rather than the app's real public address. `NextResponse.redirect()` always emits an absolute `Location` header computed server-side — it is never resolved client-side by the browser — so every affected redirect sent users to `https://localhost:3000/...`.

  **New shared module: `lib/origin.ts`** (installed by `supabase-auth`, on which `api-routes` and `external-oauth` both depend). It exports:

  - `publicOrigin(request)` — resolves the app's real public origin, preferring `NEXT_PUBLIC_HOST_ORIGIN` / `HOST_ORIGIN`, then the first hop of `x-forwarded-host` / `host` (ignoring loopback addresses), then `request.nextUrl.origin`. The protocol falls back to the request's own rather than assuming `https`, so dev servers bound to a LAN IP or `127.0.0.1` keep working.
  - `publicUrl(request, path)` and `safeRelativePath(path)`.

  Set `NEXT_PUBLIC_HOST_ORIGIN` to your app's public origin (e.g. `https://app.example.com`) in production. Without it the resolution falls back to request headers, which are client-supplied unless your proxy overwrites them.

  All redirect and `redirect_uri` construction now goes through it:

  - `api/auth/logout` (`GET` and `POST`) — redirects and the IdP `post_logout_redirect_uri`.
  - `api/auth/callback` (both the Supabase-native and `external-oauth` versions) — every error redirect, plus the `redirect_uri` sent during token exchange.
  - `api/auth/oauth/[provider]` — the `redirect_uri` sent to the IdP's authorize endpoint. This one must byte-match the value the callback route sends and the URI registered with the provider, so external OAuth sign-in was broken behind a proxy in exactly the same way logout was.
  - `lib/supabase/middleware.ts` — the unauthenticated-user redirect to `/login`, which fires on every protected page load.

  Also fixes an open redirect in both callback routes: `?next=` (and the OAuth flow's `returnTo`) were resolved against a URL base, so `?next=https://evil.example` produced a redirect off-site. They are now constrained to absolute paths on the app's own origin.

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

## 1.9.3

## 1.9.2

## 1.9.1

## 1.9.0

## 1.8.1

### Patch Changes

- c9c8473: `buildpad upgrade` now installs npm dependencies that a new component or lib-module version introduces. Previously it copied the new source but never checked the registry-declared `dependencies`, so an upgrade could leave the app with unresolvable imports (e.g. rich-text-markdown 1.8.0 added `@tiptap/extension-table`, `tiptap-markdown` and `marked`). Missing deps are now detected after upgrading, pinned to their tested ranges, and installed with the package manager the app's lockfile implies — with confirmation, or automatically under `--yes`; `--dry-run` lists what would be installed. The dependency pin map moved to a shared util used by both `add` and `upgrade`, and gained pins for `@tiptap/extension-table`, `tiptap-markdown` and `marked`.

## 1.8.0

## 1.7.0

### Minor Changes

- 6db435b: `add` no longer silently keeps stale copies of already-installed components.
  When a requested component or a transitive `registryDependencies` entry is
  installed at a version older than the registry's `lastChangedIn` for it:

  - **Unmodified copy** (every recorded file matches its install-time sha256, or
    is missing from disk) → refreshed in place automatically, with an info line.
    This makes one-step installs like `add users-routes` pick up updated
    dependencies (e.g. `system-permissions`) instead of leaving the old copy.
  - **Locally edited copy** → kept untouched, with a warning that names the
    versions and points at `npx buildpad upgrade <name>` (three-way merge).
    A direct interactive `add <name>` additionally offers an explicit
    discard-and-overwrite prompt.

  Up-to-date and pre-tracking (v1 / no install record) components keep the
  previous skip behavior. Lib modules are unchanged (they already self-heal on
  missing files); content-stale lib modules remain a `buildpad upgrade` concern.

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

## 1.6.0

### Minor Changes

- Add the `form-builder` component and `forms-routes` module scaffolds for the new Dynamic Form Builder (`/forms`, `/forms/new`, `/forms/[id]`, `/forms/[id]/fill`), standardized on "form" terminology with breadcrumbs and improved empty/creation UX. The `AuthenticatedShell` header now derives a breadcrumb from the route for pages not in the sidebar nav.

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

## 1.4.1

## 1.4.0

### Minor Changes

- Bootstrap now renders `AuthenticatedShell` by default: the generated `app/(authenticated)/layout.tsx` wraps pages in the app shell, and the home page is scaffolded at `app/(authenticated)/page.tsx` so `/` shows the header + sidebar after login.
- `api-routes` now depends on `design-system`, so the shell component is always present when the auth layout is installed.

## 1.3.1

### Patch Changes

- Fix scaffolded `app/layout.tsx` not importing `@mantine/dates/styles.css` — the `datetime` calendar rendered unstyled/inline. `@mantine/dates` + `dayjs` are now always installed.

## 1.3.0

### Minor Changes

- Add `buildpad upgrade --design` and make the design foundation a registry-tracked `design-system` lib module (design tokens, globals, theme, ColorSchemeToggle, AuthenticatedShell). `init`/`bootstrap` install it tracked; `outdated` reports it; three-way merge preserves local token edits.
- Generalize `upgrade` to handle lib modules (not just components), with an adoption path for projects that predate tracking.
- Fix bootstrap gap: install the `external-oauth` module during `--with-api`/`--all` so the api-routes auth handlers can resolve `@/lib/oauth/*` (previously `next dev` failed with "Can't resolve '@/lib/oauth/config'").
- build-registry now stamps lib modules with version/lastChangedIn; registry.json is bundled into the CLI for offline `init`.

## 1.2.0

### Minor Changes

- Ship a generic `AuthenticatedShell` app-shell template (`.bp-*` design-token styles) in the scaffold, alongside the schema-driven `ContentLayout`.
- Fix `buildpad init`/`bootstrap` producing a project that fails `next dev` with "Cannot resolve '@supabase/ssr'": the minimal scaffold now declares the always-installed auth layer (`@supabase/ssr`, `@supabase/supabase-js`, `jose`).
- npm publishing support with remote GitHub-raw registry resolver (auto-detects local vs published).

## 1.1.0

### Minor Changes

- **Version realignment to 1.x.** Consumer manifests written before per-package versioning recorded component versions as `1.0.0`, while packages were versioned `0.1.x`–`0.2.0` — so `npx buildpad outdated` could never detect updates (`1.0.0 >= 0.2.0`). All packages now release in lockstep from `1.1.0` so the upgrade mechanism works for every existing install.

### Patch Changes

- `buildpad --version` now reads the version from `package.json` instead of a hardcoded string, so it can no longer drift from the published version.

## 0.2.0

### Minor Changes

- **`upgrade` command** — safely update installed components to the latest registry version. Per-file behaviour is driven by `--strategy`:

  - `overwrite` — replace file in-place (also the effect of `--yes`)
  - `new-file` — write upstream version as `<file>.new`, leave the original untouched
  - `three-way` — attempt a `diff3` merge; falls back to `.new` on conflict or when the base cannot be fetched offline
  - `prompt` (default TTY) — ask per file: skip / overwrite / write .new

- **`changelog` command** — print the CHANGELOG.md slice for a package or component since the installed version. Accepts either a package name (`@buildpad/ui-interfaces`) or a component name (`input`).

- **`migrate` command** — one-shot migration for v1 `buildpad.json` manifests. Re-fetches and re-transforms each installed component and lib module at its recorded version, computes SHA-256 checksums, and writes them into the v2 `components` / `lib` maps without touching any consumer file. Idempotent.

- **`buildpad.json` schema v2** — the manifest now tracks:

  - `schemaVersion: 2`
  - `components: Record<string, ComponentInstall>` with per-file `sha256` checksums
  - `lib: Record<string, ComponentInstall>` (same structure for lib modules)
  - `packageVersions: Record<string, string>` — one entry per source package

- **Stable origin header** — removed the volatile `@buildpad-date` field from the injected file header. Date-of-installation is now recorded only in `buildpad.json` (`installedAt`). This makes SHA-256 hashes reproducible: two identical installs on different days produce identical checksums.

- **`status` command** — now compares the SHA-256 of every installed file on disk (minus origin header) against the value recorded in `buildpad.json`. Reports `[pristine]` or `[modified]` per file.

- **`outdated` command** — upgraded to per-package semver comparison using the `packages` map in registry v2. Skips components whose files are byte-identical to the registry even when the package version bumped (`lastChangedIn` gating).

- **`add` command** — now records `files[].sha256` (hash of transformed content minus origin header) and updates `packageVersions` on every install.

- **Registry v2 resolver additions** — `fetchSourceAtVersion`, `buildPackageTag`, `buildVersionedSourceUrl`, `CHANGELOG_BASE_URL` for fetching historical source and changelog slices.

### Patch Changes

- `transformer.ts` gains `stripOriginHeader` and `hashTransformed` helpers. Hashing rule: strip header block → normalise CRLF→LF → trim trailing whitespace + single trailing newline → SHA-256.
- `three-way-merge.ts` wraps `node-diff3` with CRLF normalisation and standard git conflict markers (`<<<<<<< HEAD` / `=======` / `>>>>>>> upstream`).
- `checksum.ts` gains `inferSourcePackage` (maps registry path prefix → `@buildpad/*` package name) and `resolvePackageVersion` (per-package version lookup with graceful fallback).
- `validate.ts` now checks that every recorded `files[].sha256` is a valid 64-character hex string and warns when `packageVersions` is missing entries for installed components.
