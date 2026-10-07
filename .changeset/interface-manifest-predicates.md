---
"@buildpad/hooks": major
"@buildpad/ui-collections": major
"@buildpad/ui-interfaces": major
"@buildpad/cli": major
"@buildpad/mcp": major
---

`collection-form`, `collection-list`, `list-m2a`'s `JunctionItemForm` and the relation hooks read interface ids through the interface manifest's predicates instead of their own id lists. Each accepts exactly the ids it accepted before:

- `CollectionForm` and `CollectionList`: their two copies of `NON_FLAT_RELATIONAL_SPECIALS` + `NON_FLAT_RELATIONAL_INTERFACES` became one utils helper, `isNonFlatRelationalField()` (an m2a/m2m/o2m special, or the list-o2m/list-m2m/list-m2a interfaces); the two `selfPersistingInterfaces` sets became `isSelfPersistingInterface()` (files); the alias-field presentation check became `isRenderedPresentationInterface()` (presentation-divider, presentation-notice).
- `JunctionItemForm` keeps any `presentation-*` alias field through `isPresentationLikeInterface()`.
- `useRelationO2M`, `useRelationM2M` and `useRelationM2A` check the field through `isRelationListInterface()` (`one-to-many` is still accepted by `useRelationO2M`).

These files import the predicates from the utils barrel (`@/lib/buildpad/utils`), so they need the 3.0 utils lib: upgrade the whole project.
