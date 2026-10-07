---
"@buildpad/ui-collections": major
"@buildpad/ui-forms": major
---

`CollectionsRelationalProvider` moves to its own module, `components/ui/collections-relational-provider.tsx` (a new file of the `collection-form` entry; still re-exported from `collection-form` and the package barrel). It now loads CollectionForm, CollectionList and VForm on demand (React.lazy), so a layout can wrap every page in it without bundling the form system. Its built-ins are passed as `defaults`: a bare provider nested under an app-level `RelationalUIProvider` / `CollectionsRelationalProvider` keeps the app's components instead of overriding them; its `components` prop still wins. `@buildpad/ui-collections` gains a `./CollectionForm` subpath export, which `FormPreview` now imports (installed as `@/components/ui/collection-form` instead of the `@/components/ui` barrel).
