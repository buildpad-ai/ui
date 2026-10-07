# Migrating to Buildpad 3.0

Buildpad 3.0 is one lockstep major release of every `@buildpad/*` package and
of the sources the CLI copies into your project. This guide lists what changes
in the copied code and what you must do when you upgrade from 2.6.

How stored records render does **not** change in 3.0: a field renders with the
same interface, the same props and the same fallback as in 2.6.

## Upgrade everything at once

Run a plain upgrade, so every stale component and lib module is upgraded in
the same run:

```bash
npx @buildpad/cli@3 upgrade --three-way
```

The 3.0 sources import new lib files and new exports across entries.
Upgrading only some entries leaves the others on 2.6 code that does not
match.

**Do not run `upgrade <name>` for the first 3.0 upgrade.** In this release,
`upgrade <name>` upgrades only the named entry. It does not yet upgrade the
stale lib modules and components that entry imports, and it does not install
missing dependencies. The project then fails to compile. For example:

- `upgrade list-o2m` (or `list-m2m`, `vform`, `collection-form`) writes code
  that imports `@/lib/buildpad/services/relational-ui-context` and
  `./list-m2a/relational-slots`. The 2.6 services lib and `list-m2a` do not
  have these files (TS2307).
- `upgrade content-routes` writes a layout that imports
  `CollectionsRelationalProvider`, which a 2.6 `collection-form` does not
  export (TS2614).

Run the plain `upgrade` shown above. If you already ran `upgrade <name>`, run
the plain `upgrade` now to repair the project.

If you edited a copied file, `--three-way` merges your edits with the new
version. When the merge conflicts, the CLI keeps your file and writes the new
version next to it as `<file>.new`; merge the two by hand.

## Interface manifest (`lib/buildpad/interface-manifest.ts`)

The utils lib gains `interface-manifest.ts`: one data table with an entry per
field-interface id (its aliases, registry component, component export name,
compatible field types, group, behaviour flags, form-builder picker
descriptor and loading class). The interface tables that used to be kept by
hand are derived from it under their old names, with their old values.

What changes in your copied files:

- **`lib/buildpad/field-interface-mapper.ts`**: the legacy ids that were extra
  `case` labels (`textarea`, `wysiwyg`, `markdown`, `list-m2o` and the five
  `xtr-…`/`xtremax-…` workflow ids) are manifest aliases now, so their labels
  are gone from the switch. They render exactly as before. A new
  `resolveExplicitInterface` calls the switch (`getExplicitInterface`) twice
  at most:
  1. with the registry aliases resolved (`input-tags` → `tags`), which is the
     value the switch saw in 2.6;
  2. if no case matched, with the manifest renderer id
     (`normalizeInterfaceId()`: `textarea` → `input-multiline`).
  - If you added `case` labels of your own, they keep working. This includes
    a case for one of the legacy ids above, or for an id of your own such as
    an `xtremax-workflow-button-…` variant: step 1 reaches it before the
    manifest alias applies.
  - A case labelled with a registry alias (`input-tags`, `input-map`,
    `input-map-gl`) is not reached, as in 2.6. Put that logic in the case of
    the renderer id (`tags`, `map`).
  - If your edits sit next to a removed label, the 3-way merge may conflict.
    Keep your cases. You can keep or drop the removed alias labels: either
    way the id renders the same.
  - `REGISTRY_INTERFACE_ALIASES` is still exported with the same entries, but
    it is derived from the manifest and the mapper copies it once when the
    module loads. Changing the object at runtime has no effect any more; add
    a `case` instead.
- **`lib/buildpad/conceal.ts`, `lib/buildpad/interface-catalog.ts`**: the
  concealing set, `CHOICE_INTERFACES` and `PROVISIONABLE_INTERFACES` are
  derived from the manifest. `ProvisionableInterfaceGroup` is defined in the
  manifest and still exported from `interface-catalog` and the barrel.
- **`lib/buildpad/utils/index.ts`** (the utils barrel) exports the manifest
  and its helpers: `INTERFACE_MANIFEST`, `normalizeInterfaceId`,
  `getInterfaceManifestEntry`, `interfaceHasFlag`, `isPresentationInterface`,
  `isNonFlatRelationalInterface`, `isSelfPersistingInterface`,
  `isRelationListInterface` and the others, plus the field-level
  `isNonFlatRelationalField` from `field-interface-mapper`. If you edited the barrel and its
  merge conflicts, copy the `interface-manifest` export block from
  `index.ts.new`: the components below import these names from it.
- **`collection-form`, `collection-list`, `list-m2a` (`JunctionItemForm`) and
  the relation hooks** (`lib/buildpad/hooks/useRelationO2M.ts`,
  `useRelationM2M.ts`, `useRelationM2A.ts`) call those predicates instead of
  keeping their own id lists. Each accepts exactly the ids it accepted before.

Type changes (TypeScript only):

- `InterfaceGroup` gains `'system'` (the registry group of
  `system-permissions`). A `Record<InterfaceGroup, …>` of your own needs a
  `system` key.
- `InterfaceType` keeps all its members. `textarea`, `number`, `uuid` and
  `list-m2o` are marked `@deprecated`: `getFieldInterface` never returns them.

Deprecated (still exported):

- `interface-registry.ts` (`InterfaceRegistry`, `interfaceRegistry`,
  `getInterfaceRegistry`), `define-interface.ts` (`defineInterface`,
  `defineInterfaces`, `createInterfaceOption`, `createOptionGroup`,
  `InterfaceOptions`) and `load-interfaces.ts`. Nothing populates that
  registry and VForm never reads it. Use `INTERFACE_MANIFEST` for interface
  identity. These modules will be removed in a later major release.
- One small change comes with the new `'system'` group:
  `InterfaceRegistry.getGrouped(true)` now returns 8 groups instead of 7,
  and includes interfaces registered in the `system` group, which it used
  to drop. `getInterfacesForApi` names that group `"System"`.

## Relational dialogs come from a provider

In 2.6, `ListO2M`, `ListM2M` and `ListM2A` imported `CollectionForm` and
`CollectionList` from the components barrel, and `JunctionItemForm` imported
`VForm`. That made a package cycle (ui-form → ui-interfaces → ui-collections →
ui-form). In 3.0 they read those components from a React context instead.

New files (written on upgrade, nothing to do):

- `lib/buildpad/services/relational-ui-context.tsx` — `RelationalUIProvider`,
  `useRelationalUI` and the slot types. The components import it by its deep
  path, so an edited services barrel cannot break them; the barrel
  (`lib/buildpad/services/index.ts`) also re-exports it.
- `components/ui/list-m2a/relational-slots.tsx` — the shared loading boundary
  and missing-provider alert.
- `lib/buildpad/i18n/namespaces/interfaces/relational-ui.ts` — the alert and
  loading strings (`interfaces.relationalUI`, English and Indonesian).
- `components/ui/collections-relational-provider.tsx` (part of
  `collection-form`) — `CollectionsRelationalProvider`, the pre-wired provider.
  It loads CollectionForm, CollectionList and VForm on demand. It is also
  re-exported from `collection-form`.

What you get without changing anything:

- Every relational field inside a **`CollectionForm`** works as before:
  `CollectionForm` supplies `CollectionForm`, `CollectionList` and `VForm` to the
  fields it renders. That covers the generated `/content` pages,
  `DynamicForm` and `FormPreview`.
- **`VForm`** supplies only itself (`FormRenderer`), so `ListM2A`'s item form
  works in any VForm. It does **not** supply `CollectionForm` or
  `CollectionList`: see "What you must do" for O2M / M2M fields in a
  standalone VForm.
- **The scaffolded app layouts** wrap their pages in
  `CollectionsRelationalProvider`: the authenticated route-group layout
  (`app/[lang]/(authenticated)/layout.tsx`, from `api-routes`) and the
  `/content` layout (`content-routes`). So a standalone relational field on
  any authenticated page works with no setup after the upgrade. If you edited
  the authenticated layout, the 3-way merge adds one import and one wrapper
  element. Keep them.
- **`api-routes` now depends on `collection-form`**, because its layout imports
  the provider. `add --with-api`, `add api-routes` and `bootstrap` install it.
  A 2.6 project that has `api-routes` but not `collection-form` fails to
  compile after the upgrade (TS2307 on
  `@/components/ui/collections-relational-provider`). Add the component:
  `npx @buildpad/cli@3 add collection-form`.
- `collection-form` now depends on `collection-list` (it loads the picker
  lazily from `./collection-list`). If your project has `collection-form` but
  not `collection-list`, the build fails on that import until you add it:
  `npx @buildpad/cli@3 add collection-list`.

What you must do:

- **A standalone `<ListO2M>`, `<ListM2M>` or `<ListM2A>`, or a plain `<VForm>`
  with relational fields** (outside any `CollectionForm`) now needs a provider.
  The scaffolded layouts above supply one. On a page outside them (for
  example a page you added outside the `(authenticated)` route group), or in
  an app you did not scaffold, wrap the page or layout in
  `CollectionsRelationalProvider`:

  ```tsx
  import { CollectionsRelationalProvider } from '@/components/ui/collections-relational-provider';

  <CollectionsRelationalProvider>{children}</CollectionsRelationalProvider>
  ```

  Without a provider the field still lists, removes and reorders items, but
  shows an alert ("Related items cannot be edited here") and hides the create,
  select and edit actions that need a missing component. The alert appears
  only for actions the user could take (enable flags and permissions).
- **Custom components:** pass `components={{ CollectionForm, CollectionList }}`
  (or `FormRenderer` for `ListM2A`/`JunctionItemForm`) to one field, or wrap a
  subtree in `RelationalUIProvider components={…}`, or pass `components` to
  `CollectionsRelationalProvider`. A `components` prop wins over providers;
  nested providers merge. `CollectionForm`, `VForm` and a bare
  `CollectionsRelationalProvider` only fill slots no provider above them
  chose, so your app-level choice is kept inside the scaffolded layouts.
- **Upgrade the whole set together.** A new `list-o2m.tsx` with a 2.6
  `collection-form.tsx` has no provider and shows the alert. A 2.6
  `list-o2m.tsx` with a new `collection-form.tsx` keeps working (it still
  imports from the barrel).
- If you edited `list-o2m.tsx`, `list-m2m.tsx`, `list-m2a.tsx`,
  `list-m2a/JunctionItemForm.tsx`, `collection-form.tsx` or
  `vform/VForm.tsx`, expect a 3-way merge there. The changes are small: the
  import of `CollectionForm`/`CollectionList`/`VForm` becomes a
  `useRelationalSlots(components)` call, the create/select/edit conditions gain
  a "component available" check, and `VForm`'s final `return (` becomes
  `const form = (` plus a provider-wrapped return.

Type changes (TypeScript only): `ListO2MProps`, `ListM2MProps`, `ListM2AProps`
and `JunctionItemFormProps` gain an optional `components` prop;
`CollectionsRelationalProvider` and `CollectionsRelationalProviderProps` are new
exports of `collection-form` and `collections-relational-provider`.

## VForm loads heavy interfaces on demand

In 2.6, `vform/components/FormFieldInterface.tsx` imported the whole
components barrel (`import * as Interfaces from '@/components/ui'`), so every
form bundled every installed component. In 3.0 it imports each interface from
its own file, and loads the heavy ones only when a field renders one.

New file (written on upgrade, nothing to do):

- `components/ui/vform/components/interface-components.tsx` — two tables of
  the interface components VForm renders, by export name:
  - `EAGER_INTERFACE_COMPONENTS`: the light controls, imported statically
    (`import { Input } from '@/components/ui/input'`).
  - `LAZY_INTERFACE_COMPONENTS`: `RichTextHTML`, `RichTextMarkdown`,
    `InputBlockEditor`, `SelectIcon`, `Map`, `AutocompleteAPI`,
    `CollectionItemDropdown`, `File`, `FileImage`, `Files`, `ListO2M`,
    `ListM2M` and `ListM2A`, each behind `React.lazy(() => import(…))`.

What changes for the user:

- A field with one of the lazy interfaces shows a skeleton until its component
  has loaded, then renders exactly as before. The skeleton has the height the
  interface manifest records for it (for example 240px for rich text), and
  each field has its own Suspense boundary, so the rest of the form is usable
  meanwhile. Light interfaces render at once, as before.
- The block editor is loaded as `components/ui/input-block-editor.tsx`
  directly. VForm waits for hydration before it renders the editor, so it no
  longer goes through the `next/dynamic` wrapper
  (`input-block-editor-wrapper.tsx`). The wrapper is still installed and
  exported from the barrel for your own pages.
- If a component fails to load (a failed chunk request), the field shows the
  "Unexpected error in interface" notice of its error boundary. Reload the
  page to try again.

What changes in your copied files:

- **`vform/components/FormFieldInterface.tsx`**: the two id → component-name
  maps and the multi-select id set are gone. The component name, the skeleton
  height and the csv handling now come from the interface manifest
  (`getRenderedInterfaceEntry`, `interfaceHasFlag(…, 'csvMultiValue')`), so
  this file needs the 3.0 utils lib: upgrade the whole project.
- **`vform/components/FormGroupField.tsx`** imports `GroupDetail`,
  `GroupAccordion` and `GroupRaw` from their own files instead of the barrel.
- If you edited `FormFieldInterface.tsx`, expect a 3-way merge. If you added
  an entry to one of the removed maps, move it: see the next point.

What you must do:

- **Nothing, if you did not add interfaces of your own.** Every id renders the
  same component with the same props as in 2.6.
- **An interface component of your own** that VForm found through the barrel
  (an id with no built-in component resolves to the PascalCase of the id:
  `my-widget` → `MyWidget`) still works: a name the two tables do not have is
  looked up in `@/components/ui`, loaded on demand. `system-permissions` is
  found the same way, because `vform` does not install that component. To
  load your component with the form instead, or to give it a chunk of its own,
  add it to a table in `interface-components.tsx`:

  ```tsx
  export const LAZY_INTERFACE_COMPONENTS = {
    // …
    MyWidget: lazy(() => import('@/components/my-widget').then((m) => ({ default: m.MyWidget }))),
  };
  ```

- **Tests that render a lazy interface** through `VForm`, `CollectionForm` or
  `FormFieldInterface` must wait for it: use `await screen.findBy…` instead of
  `screen.getBy…` for rich text, files, the map, the icon picker and the
  relational lists. A test that mocked `@/components/ui` to stub interface
  components must mock `@/components/ui/vform/components/interface-components`
  (`getInterfaceComponent`, `loadInstalledInterfaceComponent`) or the
  interface's own file instead.
- **Use the 3.0 CLI.** `interface-components.tsx` contains `import()` calls
  that only the 3.0 CLI rewrites to your aliases.
