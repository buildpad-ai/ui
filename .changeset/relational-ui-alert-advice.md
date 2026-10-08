---
"@buildpad/utils": major
"@buildpad/services": major
"@buildpad/ui-interfaces": major
---

The relational missing-provider alert (`interfaces.relationalUI.missingProvider.message`, en + id) no longer tells developers to render the field inside a VForm: a plain VForm supplies only itself (the form renderer), not CollectionForm / CollectionList. It now points to CollectionForm, `CollectionsRelationalProvider` (around the field or the VForm) or the `components` prop, and names the form-renderer slot "VForm". `ListO2M`, `ListM2M` and `ListM2A` only report components for actions the field would otherwise offer (enable flags, create / select / update permissions, unique and singleton guards), so users without those permissions no longer see the alert. Docs and JSDoc now say what a VForm supplies.
