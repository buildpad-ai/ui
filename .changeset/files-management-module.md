---
"@buildpad/ui-files": minor
"@buildpad/hooks": minor
"@buildpad/cli": minor
---

Add a packaged Files management module so consumers don't have to hand-build the `/files` Studio experience.

- New `@buildpad/ui-files` package: `FileManager` (drag-and-drop upload, import-from-URL, folders, grid/list views, search, bulk delete) and `FileDetail` (metadata edit + image/video/audio/PDF preview), shipped as the `file-manager` registry component.
- New `useFolders` hook and `tags`/`location` support on `useFiles` file metadata.
- New CLI scaffolds: `files-routes` (the `/files` and `/files/[id]` pages) plus `/api/files/import`, `/api/folders`, and `/api/folders/[id]` proxy routes.
