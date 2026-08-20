---
"@buildpad/ui-collections": patch
---

CollectionForm: don't strip a manually-entered primary key just because it's named "id".

`SYSTEM_FIELDS`/`READ_ONLY_FIELDS` matched the primary key purely by name (`"id"`), so a collection whose PK type is a manually-entered string (`schema.is_primary_key: true`, `has_auto_increment: false`, no `uuid` special) had its `id` field silently dropped from the create/edit form and stripped from the save payload — even though the DaaS admin explicitly configured it as user-supplied. On create this produced a NOT NULL constraint violation on the PK column; in a collection where the PK is the only non-system field, it left a permanently empty form ("No editable fields found") with a permanently disabled submit button.

The resolved PK is now only treated as system-managed when it's actually auto-generated (`has_auto_increment` or a `uuid` special) — a manually-entered PK stays visible, writable, and part of the create/update payload, and edits to it now count toward `hasEdits`. Other system fields (`user_created`, `user_updated`, `date_created`, `date_updated`, `sort`) are unaffected.
