---
"@buildpad/services": major
"@buildpad/utils": major
"@buildpad/ui-interfaces": major
"@buildpad/ui-form": major
"@buildpad/ui-collections": major
"@buildpad/ui-forms": major
"@buildpad/cli": major
"@buildpad/mcp": major
---

Break the ui-form → ui-interfaces → ui-collections → ui-form package cycle with a relational UI context.

- New lib file `lib/buildpad/services/relational-ui-context.tsx` (`@buildpad/services/relational-ui-context`): `RelationalUIProvider`, `useRelationalUI`, `mergeRelationalUI`, `missingRelationalUI` and structural slot types for `CollectionForm`, `CollectionList` and `FormRenderer` (VForm). Nested providers merge; `defaults` only fill slots nothing above supplies. Also re-exported from the services barrel.
- `ListO2M`, `ListM2M`, `ListM2A` and `JunctionItemForm` no longer import `@buildpad/ui-collections` / `@buildpad/ui-form`. They take those components from a new optional `components` prop, then the relational provider, and render each in its own Suspense boundary (new `components/ui/list-m2a/relational-slots.tsx`). With no provider they render a translated alert (`interfaces.relationalUI`, en + id) and hide the create / select / edit actions whose dialog component is missing; listing, removing and reordering still work.
- `CollectionForm` supplies `{ CollectionForm, CollectionList (React.lazy), FormRenderer: VForm }` to the fields it renders; `VForm` supplies `{ FormRenderer: VForm }`. Both only fill slots a provider above did not choose. `collection-form` now declares `collection-list` as a registry dependency.
- New `CollectionsRelationalProvider` (exported from `collection-form`) for standalone relational interfaces and standalone `VForm`s with relational fields. The CLI's `/content` layout template and `FormPreview`'s offline VForm use it.
- Standalone `<ListO2M>` / `<ListM2M>` / `<ListM2A>` and plain `<VForm>`s with relational fields must now be wrapped in a provider (or given `components`) to create, select or edit related items. See docs/MIGRATION-3.0.md.
- Monorepo: `@buildpad/ui-interfaces` drops its peer/dev dependencies on `@buildpad/ui-collections` and `@buildpad/ui-form`; the root build is utils first, then `pnpm -r build`; `packages/ui-collections/dist` is no longer committed; `pnpm graph:check` allows no package cycle.
