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

- **`lib/buildpad/field-interface-mapper.ts`**: `getExplicitInterface` calls
  `normalizeInterfaceId()` before its `switch`. The legacy ids that were extra
  `case` labels (`textarea`, `wysiwyg`, `markdown`, `list-m2o` and the five
  `xtr-…`/`xtremax-…` workflow ids) are manifest aliases now, so their labels
  are gone from the switch. They render exactly as before.
  - If you added `case` labels of your own, they keep working.
  - If your edits sit next to a removed label, the 3-way merge may conflict:
    keep your cases and drop the alias labels.
  - `REGISTRY_INTERFACE_ALIASES` is still exported with the same entries, but
    it is derived from the manifest and the mapper no longer reads it.
    Changing the object at runtime has no effect any more; add a `case`
    instead.
- **`lib/buildpad/conceal.ts`, `lib/buildpad/interface-catalog.ts`**: the
  concealing set, `CHOICE_INTERFACES` and `PROVISIONABLE_INTERFACES` are
  derived from the manifest. `ProvisionableInterfaceGroup` is defined in the
  manifest and still exported from `interface-catalog` and the barrel.
- **`lib/buildpad/utils/index.ts`** (the utils barrel) exports the manifest
  and its helpers: `INTERFACE_MANIFEST`, `normalizeInterfaceId`,
  `getInterfaceManifestEntry`, `interfaceHasFlag`, `isPresentationInterface`,
  `isNonFlatRelationalInterface`, `isSelfPersistingInterface`,
  `isRelationListInterface` and the others. If you edited the barrel and its
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

Deprecated (still exported, no behaviour change):

- `interface-registry.ts` (`InterfaceRegistry`, `interfaceRegistry`,
  `getInterfaceRegistry`), `define-interface.ts` (`defineInterface`,
  `defineInterfaces`, `createInterfaceOption`, `createOptionGroup`,
  `InterfaceOptions`) and `load-interfaces.ts`. Nothing populates that
  registry and VForm never reads it. Use `INTERFACE_MANIFEST` for interface
  identity. These modules will be removed in a later major release.
