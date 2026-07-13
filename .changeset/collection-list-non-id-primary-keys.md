---
'@buildpad/ui-collections': patch
---

`CollectionList` and `CollectionForm` no longer assume every collection has an
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
