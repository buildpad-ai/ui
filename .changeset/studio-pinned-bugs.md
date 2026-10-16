---
"@buildpad/ui-collections": minor
"@buildpad/ui-table": minor
"@buildpad/ui-form": minor
"@buildpad/ui-interfaces": minor
"@buildpad/services": minor
"@buildpad/hooks": minor
"@buildpad/utils": minor
---

Content list, item form and relational fields: the defects the BuildPad Studio's browser tests pinned.

**Permissions fail closed** (`CollectionList`, `CollectionForm`)

- An empty `/api/permissions/me` access map (a user with no grants at all, or a failed permissions request) gave full access: Create and Delete were enabled in the list and the create form (also `/users/new`) was editable. An empty map now grants a non-administrator nothing; an administrator (`isAdmin`) keeps full access. No new UI is shown for a failed permissions request; the list and form simply have no write controls.

**List** (`CollectionList`, `FilterPanel`, `VTable`)

- Right-clicking a column header no longer crashes the page ("Menu component was not found in the tree"); the Sort / Alignment / Hide field menu opens.
- The list's own "Clear all" also clears the filter panel: reopening it no longer shows (and re-sends) the old rules. `FilterPanel` now follows a `value` changed outside it.
- A filter switched from "Is null" (or another no-value operator) to an operator that takes a value starts with an empty value instead of sending `true`.
- Clearing a number filter's value no longer breaks the list (it sent `_eq: ""`); an empty value is null, as on a new rule.
- "Select all" on another page adds that page to the selection instead of replacing it, and the header checkbox describes the rows on the page shown. Clearing it removes only that page's rows.
- Refresh also updates the "(filtered from N)" total.
- Resizing a column no longer reloads the rows on every pointer move.
- Releasing a column resize inside its header no longer sorts the column, and clicking a column's "Reorder column" grip no longer sorts it.
- A failed field load shows "Failed to load collection fields." instead of "No visible fields found … Verify the collection exists" (`FieldsService.readAll` no longer turns a failed request into an empty field list). The message no longer carries a developer hint about the Storybook host.
- Column headers of fields with `meta.translations` use the translation for a new optional `locale` prop.

**Item form** (`CollectionForm`, `VForm`)

- "Save and Stay" keeps the edited item open: it no longer calls `onSuccess` (whose host left the page).
- "Save and Create New" on a create form starts an empty form; it kept the saved values and the success banner, and the next Create made the same item again.
- "Save as Copy" only creates the copy. It used to save the edits into the original first, and left them there when the copy failed.
- Typing a field's loaded value back makes the form unedited again (Save and "Discard Changes" are disabled), and a reverted field keeps its value after another field is saved.
- A failed save shows the backend's own message instead of `API error: 500 - {"error":"…"}`, and DaaS validation errors are listed per field. `apiRequest` now throws an `ApiRequestError` (exported) whose message is unchanged and which also carries `status`, `body`, `errors` and `detail`.
- Ctrl/⌘+S runs "Save and Stay" and Ctrl/⌘+Shift+S "Save and Create New", as the save options menu shows (with `showSaveOptions`).
- The save options and these shortcuts check required fields first, as the Create / Save button does; nothing is sent while a field is invalid.
- Field labels follow a new optional `locale` prop (forwarded to `VForm`). `VForm`'s own `locale` now takes effect (every field was named with its first translation), and a locale without a region (`id`) matches a translation with one (`id-ID`).
- A user field named `sort` is shown in the form (it was hidden by its name).
- Retrying a create whose junction write failed no longer creates the item a second time, and no retry writes a junction row twice.
- A files field's picks, uploads and removals are written when the item is saved (after it is created, for a new item): Cancel undoes them, and files picked while creating an item are no longer dropped. A `Files` field outside the form that saves its item writes at once, as before (new `ItemSaveHostProvider` / `useSavedByItemHost` in `@buildpad/services/relational-ui-context`).

**Relational fields** (`SelectDropdownM2O`, `ListM2A`, `useRelationM2A`)

- The M2O "Create New" dialog is a create form for the related collection (the relational UI context's `CollectionForm`); the new item becomes the field's value. It was a stub. The `createModal.notImplemented` string is no longer shown and is deprecated.
- Enter in the M2O search box no longer saves the whole item.
- The M2O Select dialog (modal layout) lists the related items when it opens, and a slow answer no longer replaces newer search results.
- An M2A field names its collections by their name, not by their display template ("{{text}}").
- M2A rows and their Remove / Undo buttons are no longer announced as disabled: the drag attributes are on the drag handle.

**Item keys** (`ItemsService`)

- A primary key holding "/" (or "?", "#", "%") is encoded in the item URL, so such an item can be opened, saved and deleted. An app routing to items by key decodes the key from its URL before passing it on.
