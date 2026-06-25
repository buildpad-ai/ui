---
"@buildpad/ui-files": minor
"@buildpad/hooks": minor
"@buildpad/cli": minor
---

Bring the Files module to feature parity with the DaaS Studio.

- **RBAC gating**: `FileManager`/`FileDetail` accept a `filesCollection` prop (default `daas_files`) and gate upload, new folder, delete, and edit via `usePermissions` (admin bypass; optimistic while loading).
- **List view**: select-all header checkbox and a per-row actions menu (Edit / Download / Delete); file cards show a category badge with an image-error fallback; upload progress bar.
- **File detail**: two-column layout adding a read-only info panel (`FileInfoPanel` — id+copy, MIME, size, dimensions, duration, storage, timestamps), move-to-folder selector, focal-point X/Y for images, replace-file, open-in-new-tab, and signed-URL download.
- **Folder rename** UI (reuses the folder dialog).
- **Data layer**: `useFiles` gains `replaceFile` and `getDownloadUrl`, `updateFile` accepts focal point, and the file view-model carries `storage`/`duration`/`focal_point_*`.
- New `/api/files/[id]/download` proxy route template.
