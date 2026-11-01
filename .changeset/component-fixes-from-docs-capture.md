---
"@buildpad/types": patch
"@buildpad/utils": patch
"@buildpad/services": patch
"@buildpad/ui-form": patch
"@buildpad/ui-collections": patch
"@buildpad/ui-files": patch
---

Fixes found while capturing the docs screenshots:

- `DaaSProvider` loads the current user when `config.url` is `''` (same-origin requests through the app's `/api` proxy). It skipped the request because the empty URL was treated as unset, so `isAdmin` stayed `false` and `/forms/new` hid "Start from scratch" from admins.
- Form builder forms show each titled section's heading on the rendered form, as a `presentation-divider` at the top of the section. `group-raw` sections drew no title.
- A form builder field's label override (or schema note) is the field's label on the rendered form, as it is in the builder, through the new `FieldMeta.name`. It was shown as a help tooltip beside the column name instead.
- VForm no longer draws a field label above a `presentation-divider`: the divider's title is its heading.
- `FilterPanel` rule rows wrap instead of overflowing narrow hosts such as the form builder's conditions editor.
- `FileInfoPanel` no longer nests a `<p>` inside a `<p>` in its ID row.
