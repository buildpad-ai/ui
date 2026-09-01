# @buildpad/ui-files

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
