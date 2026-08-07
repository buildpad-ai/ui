# @buildpad/ui-interfaces

## 1.10.1

### Patch Changes

- 7b415ad: ListO2M: fix three ways pending relational changes were lost.

  - Mounting the field with an existing value no longer emits `onChange([])`, which silently wiped the O2M value on the next save.
  - "Add Existing" on an unsaved parent now stages into a dedicated `link` bucket, so the picked item renders in the list and is emitted with the parent FK on save. It previously staged into `update`, which only patches items already loaded from the server, so the selection disappeared and was never saved. Links are emitted as a reference (`id` + FK) rather than the fetched display fields — echoing those back makes the API drop the entry when the display template contains a nested path such as `{{author_id.name}}`.
  - Staged creates now take their `$index` from a ref, so an interleaved create → edit → create no longer hands the same `$temp_` id to two rows (which made both disappear when either was removed).

  Un-staging the last pending change still emits `[]`, so the parent form drops the field edit instead of saving an item the user removed.

  - @buildpad/hooks@1.10.1
  - @buildpad/services@1.10.1
  - @buildpad/types@1.10.1
  - @buildpad/ui-collections@1.10.1
  - @buildpad/ui-form@1.10.1
  - @buildpad/utils@1.10.1

## 1.10.0

### Patch Changes

- 4976915: Widen `CollectionItemDropdown`'s `value` prop to accept what the component
  already normalizes.

  The prop was typed `CollectionItemDropdownValue | null`, but the normalization
  memo also handles a raw key (`string | number`), a JSON string, and a resolved
  item object. Under a strict consumer tsconfig the declared type narrowed
  `typeof value === 'string'` to `never`, so `value.trim()` failed to compile with
  `TS2339: Property 'trim' does not exist on type 'never'` — which broke
  `pnpm build` for `@buildpad/ui-interfaces` and, with it, every CI publish run
  since 1.9.2. Runtime behaviour is unchanged; only the declaration now matches
  the implementation.

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

- Updated dependencies [5981327]
  - @buildpad/types@1.10.0
  - @buildpad/services@1.10.0
  - @buildpad/hooks@1.10.0
  - @buildpad/ui-collections@1.10.0
  - @buildpad/utils@1.10.0
  - @buildpad/ui-form@1.10.0

## 1.9.3

### Patch Changes

- Updated dependencies [3c55e13]
  - @buildpad/ui-collections@1.9.3
  - @buildpad/ui-form@1.9.3
  - @buildpad/hooks@1.9.3
  - @buildpad/services@1.9.3
  - @buildpad/types@1.9.3
  - @buildpad/utils@1.9.3

## 1.9.2

### Patch Changes

- 0a7e18d: Resolve vertical scrolling issues on collections table and height/scroll-sync bugs on code input editor.
- Updated dependencies [0a7e18d]
  - @buildpad/ui-collections@1.9.2
  - @buildpad/ui-form@1.9.2
  - @buildpad/hooks@1.9.2
  - @buildpad/services@1.9.2
  - @buildpad/types@1.9.2
  - @buildpad/utils@1.9.2

## 1.9.1

### Patch Changes

- a453388: RichTextMarkdown: fix a crash when opening Source mode — react-textarea-autosize (behind Mantine's `autosize` Textarea) rejects `style.minHeight`; the height floor now comes from `minRows` alone. This fix was part of the Source-mode branch but missed the 1.9.0 merge window.
  - @buildpad/ui-form@1.9.1
  - @buildpad/ui-collections@1.9.1
  - @buildpad/hooks@1.9.1
  - @buildpad/services@1.9.1
  - @buildpad/types@1.9.1
  - @buildpad/utils@1.9.1

## 1.9.0

### Minor Changes

- 5bf4320: RichTextMarkdown: replace the rendered "Preview" toggle with an editable raw-Markdown "Source" mode. The WYSIWYG editor renders Markdown as you type (it is the preview), which made a separate Preview mode redundant and confusing. Source mode shows the underlying Markdown in a monospace textarea; edits flow through `onChange` immediately and re-parse into the rich editor when switching back. The `previewFont` prop is deprecated (kept for type compatibility, no effect).

### Patch Changes

- @buildpad/ui-form@1.9.0
- @buildpad/ui-collections@1.9.0
- @buildpad/hooks@1.9.0
- @buildpad/services@1.9.0
- @buildpad/types@1.9.0
- @buildpad/utils@1.9.0

## 1.8.1

### Patch Changes

- @buildpad/hooks@1.8.1
- @buildpad/services@1.8.1
- @buildpad/types@1.8.1
- @buildpad/ui-collections@1.8.1
- @buildpad/ui-form@1.8.1
- @buildpad/utils@1.8.1

## 1.8.0

### Minor Changes

- 5c1000a: RichTextMarkdown now persists and round-trips Markdown instead of HTML. It parses the `value` prop as Markdown on load, serializes the document back to Markdown through `onChange`, and renders the preview from Markdown. Adds GFM table support so tables round-trip as real table nodes (the toolbar "table" action now inserts a table node), and reinterprets Markdown source pasted from a rendered code fence instead of trapping the whole document in a single code block.

### Patch Changes

- @buildpad/ui-form@1.8.0
- @buildpad/ui-collections@1.8.0
- @buildpad/hooks@1.8.0
- @buildpad/services@1.8.0
- @buildpad/types@1.8.0
- @buildpad/utils@1.8.0

## 1.7.0

### Minor Changes

- 6db435b: Custom permission editing for `system-permissions`: the matrix's "Use Custom"
  menu item (previously a stub) now opens a tabbed `PermissionDetailModal` with
  action-dependent tabs — Item Permissions (Directus-filter JSON with dynamic
  variables and relational-limitation warnings), Field Permissions (checkbox
  field list with `['*']` semantics, PK/alias badges, app-minimal locking),
  Field Validation, and Field Presets (JSON editors with examples). Edits flow
  through the existing `PermissionAlterations` model and are persisted by the
  host form's Save — closing the last feature-parity gap with the buildpad-daas
  policies admin. Also fixes `getPermissionLevel` to report presets-only
  permissions as `custom`, exports `APP_ACCESS_MINIMAL_PERMISSIONS`, and adds
  `fieldsByCollection`/`relations` injection props plus ported filter
  types/utils (`parseFilterToNodes`, `nodesToFilter`, operator sets) and cached
  field/relation metadata fetchers. Also removes a double border on the matrix
  under themes that default `Table` to `withTableBorder: true` (the generated app
  theme and enterprise Storybook) — the matrix `Table` now opts out, matching the
  `Paper`-wrapped card edge like the other module tables.
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

- Updated dependencies [c6dd470]
- Updated dependencies [c6dd470]
- Updated dependencies [90dc795]
  - @buildpad/ui-collections@1.8.0
  - @buildpad/hooks@1.8.0
  - @buildpad/types@1.8.0
  - @buildpad/ui-form@1.8.0
  - @buildpad/services@1.8.0
  - @buildpad/utils@1.8.0

## 1.6.0

### Patch Changes

- @buildpad/hooks@1.6.0
- @buildpad/services@1.6.0
- @buildpad/types@1.6.0
- @buildpad/ui-collections@1.6.0
- @buildpad/ui-form@1.6.0
- @buildpad/utils@1.6.0

## 1.5.0

### Patch Changes

- Updated dependencies [94604c9]
- Updated dependencies [94604c9]
  - @buildpad/hooks@1.5.0
  - @buildpad/ui-collections@1.5.0
  - @buildpad/ui-form@1.5.0
  - @buildpad/services@1.5.0
  - @buildpad/types@1.5.0
  - @buildpad/utils@1.5.0

## 1.4.1

### Patch Changes

- Updated dependencies
  - @buildpad/services@1.4.1
  - @buildpad/hooks@1.4.1
  - @buildpad/ui-collections@1.4.1
  - @buildpad/ui-form@1.4.1
  - @buildpad/types@1.4.1
  - @buildpad/utils@1.4.1

## 1.4.0

### Patch Changes

- Released in lockstep; no functional changes.

## 1.3.1

### Patch Changes

- Rich-text components (`rich-text-html`, `rich-text-markdown`) now import `@mantine/tiptap/styles.css` so the editor is styled when used.

## 1.3.0

### Patch Changes

- Released in lockstep; no functional changes.

## 1.2.0

### Patch Changes

- Styling refinements across interface components (input-hash, system-token, map, shared stories).

## 1.1.0

### Minor Changes

- **Version realignment to 1.x.** Consumer manifests written before per-package versioning recorded component versions as `1.0.0`, while packages were versioned `0.1.x`–`0.2.0` — so `npx buildpad outdated` could never detect updates (`1.0.0 >= 0.2.0`). All packages now release in lockstep from `1.1.0` so the upgrade mechanism works for every existing install.

### Patch Changes

- `Input`: the text branch now coerces non-string primitives via `String(value)` instead of rendering an empty input, so numeric values display correctly.
- `InputCode`: non-string values (arrays/objects from `json`/`csv` fields) are normalized to pretty-printed JSON instead of crashing with `.split is not a function`; for structured fields (`type` json/csv or `language="json"`), valid JSON edits emit the parsed value so the stored type is preserved on save, while invalid JSON mid-edit stays editable and emits the raw string. `InputCodeProps.value`/`onChange` widen to `unknown`.
- `SelectDropdownM2O`: option selection and active-option comparison now use the relation's target field (`relatedPrimaryKeyField.field`) instead of unconditionally `item.id`, so relations targeting a unique non-PK column (e.g. a `uri_path`) save and highlight correctly.

## 0.2.0

### Patch Changes

- Established per-package semver baseline. This package now carries its own independent version tracked via Changesets. Future releases will record component-level changes here so `npx buildpad outdated` and `npx buildpad changelog` can surface the relevant diff.
