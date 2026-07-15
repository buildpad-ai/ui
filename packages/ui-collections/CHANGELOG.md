# @buildpad/ui-collections

## 1.8.1

### Patch Changes

- @buildpad/services@1.8.1
- @buildpad/types@1.8.1
- @buildpad/ui-form@1.8.1
- @buildpad/ui-table@1.8.1
- @buildpad/utils@1.8.1

## 1.8.0

### Patch Changes

- @buildpad/ui-form@1.8.0
- @buildpad/services@1.8.0
- @buildpad/types@1.8.0
- @buildpad/ui-table@1.8.0
- @buildpad/utils@1.8.0

## 1.7.0

### Patch Changes

- c6dd470: `CollectionForm`'s split save button (Save + SaveOptions caret) no longer
  renders with a gap in host apps whose Mantine theme forces `Group` gap via
  `theme.components.Group.styles.root` — theme styles are applied inline and
  override the `gap={0}` prop, so the group now also sets an inline
  `style={{ gap: 0 }}`, which takes precedence over both.
- c6dd470: `CollectionList` and `CollectionForm` no longer assume every collection has an
  `id` primary key column. Both components now resolve the real PK from field
  metadata (`schema.is_primary_key`), falling back to `id`, with the
  `primaryKeyField` prop kept as an explicit override.

  Previously, on a collection whose PK is not named `id` (e.g. `code`, `sku`):

  - `CollectionList` injected `id` into the `fields` query parameter of every
    list request, so the DaaS API returned HTTP 500
    (`column <table>.id does not exist`) and the list never rendered.
  - The total record count used `aggregate[count]=id` and failed silently.
  - `CollectionForm` read the created record's key from `result.id`, breaking
    M2M relation persistence and copy-mode after create.

  `onItemClick` now also receives the item's primary key value as a second
  argument so consumers can navigate without hardcoding `item.id`.

- Updated dependencies [90dc795]
  - @buildpad/types@1.8.0
  - @buildpad/ui-form@1.8.0
  - @buildpad/ui-table@1.8.0
  - @buildpad/services@1.8.0
  - @buildpad/utils@1.8.0

## 1.6.0

### Patch Changes

- @buildpad/services@1.6.0
- @buildpad/types@1.6.0
- @buildpad/ui-form@1.6.0
- @buildpad/ui-table@1.6.0
- @buildpad/utils@1.6.0

## 1.5.0

### Patch Changes

- @buildpad/ui-table@1.5.0
- @buildpad/ui-form@1.5.0
- @buildpad/services@1.5.0
- @buildpad/types@1.5.0

## 1.4.1

### Patch Changes

- Updated dependencies
  - @buildpad/services@1.4.1
  - @buildpad/ui-form@1.4.1
  - @buildpad/ui-table@1.4.1
  - @buildpad/types@1.4.1

## 1.4.0

### Patch Changes

- Released in lockstep; no functional changes.

## 1.3.1

### Patch Changes

- Released in lockstep; no functional changes.

## 1.3.0

### Patch Changes

- Released in lockstep; no functional changes.

## 1.2.0

### Minor Changes

- Design-token and styling refinements across `ContentLayout`, `CollectionList`, and `ContentNavigation`.

## 1.1.0

### Minor Changes

- **Version realignment to 1.x.** Consumer manifests written before per-package versioning recorded component versions as `1.0.0`, while packages were versioned `0.1.x`–`0.2.0` — so `npx buildpad outdated` could never detect updates (`1.0.0 >= 0.2.0`). All packages now release in lockstep from `1.1.0` so the upgrade mechanism works for every existing install.

## 0.2.0

### Patch Changes

- Established per-package semver baseline. This package now carries its own independent version tracked via Changesets. Future releases will record component-level changes here so `npx buildpad outdated` and `npx buildpad changelog` can surface the relevant diff.
