---
"@buildpad/utils": minor
"@buildpad/ui-collections": minor
"@buildpad/ui-form": minor
"@buildpad/services": minor
"@buildpad/ui-interfaces": minor
---

Item routes, the item form's field rules, a failed permissions load and "Is empty" on json fields.

**Create route is `+`; a row keyed `new` opens for editing** (`isNewItem`, `ListM2A`)

- `isNewItem` knows only `+` (and its encoding `%2B`, and no key) as a new item. `"new"` is an item's key now: a row whose manually entered key is `new` opens for editing instead of an empty create form, and `isExistingItem("new")` is true.
- **Hosts:** route item creation to `/content/<collection>/+` (not `/new`) and pass that segment through `isNewItem`, as the content page template does. A link or bookmark to `…/new` now opens the item keyed `new` (usually "not found"). The Users, Roles, Policies, Workflows, Workflow assignments and Cron detail components still accept `new` as well as `+` for their own (uuid-keyed) pages.

**Item form checks the field rules before saving** (`CollectionForm`, `VForm`)

- `meta.required` and `meta.validation` (the filter rule a field's Validation tab stores) are checked before every save: the Create / Save button, the save options, and Ctrl/⌘+S and Ctrl/⌘+Shift+S. Nothing is sent while one fails; the form shows "Validation failed. Please fix the highlighted fields." and each failing field its message (the field's validation message for a failed rule, "This field is required" for a missing value). Conditions are applied first; hidden and read-only fields are not checked; a rule is checked when the field holds a value. The items API does not check these rules.
- New `validateItem(item, fields)` in `@buildpad/ui-form`. A `_regex` rule may be written as `/pattern/flags`.

**A failed permissions load shows a load error with Retry** (`CollectionList`, `CollectionForm`, `PermissionsService`)

- When `/api/permissions/me` fails, the list (rows still shown) and the item form (read-only) show "Your permissions could not be loaded, …" with a Retry button. Create, edit, delete and archive stay off, also for an administrator, until a load succeeds; Retry asks again. An empty map from a successful load still means no access, with no error.
- New `PermissionsService.loadMyCollectionAccess(forceRefresh?)`: the same cached request as `getMyCollectionAccess`, but it rejects when the request fails (`getMyCollectionAccess` still resolves to `{}`). New strings `collections.list.errors.permissionsLoadFailed` and `collections.form.errors.permissionsLoadFailed`.

**"Is empty" on a json field** (`applyFilterToQuery`)

- `applyFilterToQuery`, `applyFilter` and `applyFieldOperators` take an optional `{ jsonFields }` (the table's jsonb columns). On those, "Is empty" (`_empty`) matches NULL, `{}` and `[]`, and "Is not empty" none of them; comparing a jsonb column with `''` failed the request. Without it nothing changes.
