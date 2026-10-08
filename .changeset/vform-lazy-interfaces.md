---
"@buildpad/ui-form": major
"@buildpad/ui-interfaces": major
"@buildpad/utils": major
"@buildpad/cli": major
"@buildpad/mcp": major
---

VForm loads heavy interface components on demand and no longer imports the components barrel.

- New `vform` file `components/ui/vform/components/interface-components.tsx`: `EAGER_INTERFACE_COMPONENTS` (the light controls, imported statically, each from its own file) and `LAZY_INTERFACE_COMPONENTS` (`RichTextHTML`, `RichTextMarkdown`, `InputBlockEditor`, `SelectIcon`, `Map`, `AutocompleteAPI`, `CollectionItemDropdown`, `File`, `FileImage`, `Files`, `ListO2M`, `ListM2M`, `ListM2A`, each behind `React.lazy(() => import(…))`). A form bundles only the eager table; before, `FormFieldInterface` imported `@/components/ui` and with it every installed component.
- `FormFieldInterface` reads the interface manifest instead of its own tables: the component name comes from the new `getRenderedInterfaceEntry(type)` (an entry id or a deprecated type literal), the csv normalisation from the `csvMultiValue` flag. While a lazy component loads, the field shows a skeleton of the manifest's `fallbackHeight` in its own Suspense boundary. A `client-only` component (the block editor) is not rendered until the page has hydrated; VForm now loads `input-block-editor.tsx` directly, not the `next/dynamic` wrapper.
- A component the tables do not name is looked up on demand in the components barrel, as before: `SystemPermissions` (which `vform` does not install) and a project's own interfaces (`my-widget` → `MyWidget`) keep rendering, and an unknown one still shows the "Interface component not found" alert. A failed component load is reported by the field's error boundary.
- `FormGroupField` imports the three group interfaces from their own files.
- `@buildpad/utils` exports `getRenderedInterfaceEntry` (also from the consumer utils barrel).
- Monorepo: `@buildpad/ui-interfaces` gains the subpath exports `./input-hash`, `./select-dropdown-m2o`, `./select-multiple-dropdown` and `./select-multiple-checkbox-tree`, so each interface can be imported by the path its registry component installs under.

How stored records render does not change: every interface id resolves to the same component with the same props. Tests that render a lazy interface through VForm must now wait for it (`findBy…`). Upgrade the whole project (`buildpad upgrade`) with the 3.0 CLI; see docs/MIGRATION-3.0.md.
