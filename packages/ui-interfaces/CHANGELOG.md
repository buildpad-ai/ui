# @buildpad/ui-interfaces

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
