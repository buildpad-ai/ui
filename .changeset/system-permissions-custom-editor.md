---
'@buildpad/ui-interfaces': minor
---

Custom permission editing for `system-permissions`: the matrix's "Use Custom"
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
