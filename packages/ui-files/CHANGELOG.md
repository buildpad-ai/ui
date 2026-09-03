# @buildpad/ui-files

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

### Patch Changes

- Updated dependencies [b799724]
- Updated dependencies [b272d96]
  - @buildpad/utils@2.3.0
  - @buildpad/services@2.3.0
  - @buildpad/hooks@2.3.0
  - @buildpad/ui-interfaces@2.3.0
  - @buildpad/types@2.3.0

## 2.2.0

### Patch Changes

- Updated dependencies [2b199c9]
  - @buildpad/hooks@2.2.0
  - @buildpad/ui-interfaces@2.2.0
  - @buildpad/services@2.2.0
  - @buildpad/types@2.2.0

## 2.1.0

### Patch Changes

- @buildpad/ui-interfaces@2.1.0
- @buildpad/hooks@2.1.0
- @buildpad/services@2.1.0
- @buildpad/types@2.1.0

## 2.0.0

### Patch Changes

- @buildpad/hooks@2.0.0
- @buildpad/services@2.0.0
- @buildpad/types@2.0.0
- @buildpad/ui-interfaces@2.0.0

## 1.11.1

### Patch Changes

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
  - @buildpad/services@1.11.1
  - @buildpad/types@1.11.1

## 1.10.0

### Patch Changes

- 2e6bee7: Fix the file library picker and file thumbnails across the file interfaces.

  **The library picker's search box did nothing.** `Upload`'s fetch effect
  deliberately excluded the search term from its dependencies
  (`}, [libraryOpen]); // Only trigger on libraryOpen change, not on search`), so
  typing updated the input and re-rendered but never refetched, and there was no
  client-side filtering either — the term had no effect through any path. Search is
  now a real fetch dependency, debounced 300ms via `useDebouncedValue`, with
  filtering done server-side through the DaaS `search` parameter. A second, dormant
  copy of the fetch logic that _did_ close over the search term was only reachable
  from the open handler, which also flipped `libraryOpen`, so opening the picker
  fired two competing requests; that duplication is gone.

  **Thumbnails requested a preset DaaS ignores.** `?key=system-small-cover` (and
  `system-large-*`) is silently discarded by DaaS, which then streams the
  **full-size original** — so no resizing happened and the browser downloaded
  multi-megabyte images to paint 40–120px squares. All asset URLs now pass explicit
  `width`/`height`/`fit` transform params, which do resize. In `FileImage` this was
  worse than wasteful: originals were base64-encoded behind a 5 MB guard, so a
  large photo reported "Image too large to preview" for an image rendering at
  220px.

  **Files were drawn as folders.** Every non-image fell back to `IconFolderOpen`,
  and `Files` rendered `IconFolder` for _every_ attached file with no thumbnail at
  all — videos, audio, PDFs and Markdown all looked like directories. Thumbnails
  now fall back to a per-category icon (image / video / audio / document / archive /
  code) matching `FileCard` in `@buildpad/ui-files`, and never to a folder glyph.
  The fallback also triggers on image load failure, so a file record whose binary is
  missing from storage still shows what kind of file it is instead of a broken
  image.

  **New exports, one shared picker.** The browser is extracted as
  `LibraryPickerModal` and the thumbnail as `FileThumbnail` (both exported from
  `@buildpad/ui-interfaces/upload`, along with the `LibraryFolder` type). `Files`
  had its own parallel library modal; it now renders the shared one and inherits
  search, pagination, thumbnails and layouts. The picker gains:

  - pagination with a page-size selector (12/24/48/96) and a result count
  - grid and list layouts, toggled by an icon control with visually-hidden labels
  - optional folder browsing with a breadcrumb, enabled by passing the new
    `onFetchLibraryFolders` prop (omit it for the previous flat library — no folder
    UI is rendered). `File`, `FileImage` and `Files` wire it through `useFolders`.
  - a distinct error state — a failed fetch previously rendered as an innocuous
    "No files found", hiding permission problems
  - keyboard-operable tiles (`role="button"`, Enter/Space) and a token-based focus
    ring
  - cancellation of superseded requests, so a slow earlier response can no longer
    overwrite a newer one

  New `Upload` props: `libraryPageSize`, `libraryDefaultView`,
  `onFetchLibraryFolders`.

  **Pagination no longer invents pages.** DaaS cannot report a _filtered_ total:
  `meta.total_count` is always the unfiltered collection count, `meta.filter_count`
  only ever equals the number of rows in the current page, and `aggregate[count]`
  is ignored. Trusting it produced clickable pages that were always empty — in
  `FileManager`, searching a 32-file library returned 18 rows but rendered a second
  page from `ceil(32/24)`. Note this also affects the folder root, which is itself a
  filtered query (`folder._null`). Both surfaces now only show a numeric total when
  nothing narrows the query: `LibraryPickerModal` falls back to Prev/Next, and
  `FileManager` derives its page count from observation (a full page implies at
  least one more, a short page is the last), so the pager may understate how many
  pages exist until you walk forward but never offers one that isn't there. Both
  step back automatically if a page comes back empty, which also covers deleting
  the last item on a page. `FileManager` gains a result count that omits the total
  while filtering rather than displaying a wrong one.

  **Registry metadata.** Three pre-existing declaration gaps that would break
  `buildpad add` installs: `file` and `file-image` import `@buildpad/hooks` and
  `@mantine/notifications` without declaring them, and `files` imports
  `@buildpad/utils` undeclared. `upload` also now declares its `types` lib
  dependency and its `@mantine/hooks` / `@mantine/notifications` /
  `@tabler/icons-react` packages.

  `File` now uses the shared `formatFileSize` from `@buildpad/types` instead of a
  local copy, so sizes render as `1.5 KB` / `0 B` rather than `1.5 KB` / `0 Bytes`.

- Updated dependencies [4976915]
- Updated dependencies [2e6bee7]
- Updated dependencies [5981327]
  - @buildpad/ui-interfaces@1.10.0
  - @buildpad/types@1.10.0
  - @buildpad/services@1.10.0
  - @buildpad/hooks@1.10.0

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

### Patch Changes

- Updated dependencies [6db435b]
- Updated dependencies [90dc795]
- Updated dependencies [e563c73]
  - @buildpad/ui-interfaces@1.8.0
  - @buildpad/hooks@1.8.0
  - @buildpad/types@1.8.0
  - @buildpad/services@1.8.0

## 1.6.0

### Patch Changes

- @buildpad/hooks@1.6.0
- @buildpad/services@1.6.0
- @buildpad/types@1.6.0
- @buildpad/ui-interfaces@1.6.0

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

- Updated dependencies [94604c9]
- Updated dependencies [94604c9]
  - @buildpad/hooks@1.5.0
  - @buildpad/ui-interfaces@1.5.0
  - @buildpad/services@1.5.0
  - @buildpad/types@1.5.0
