---
"@buildpad/utils": major
"@buildpad/cli": major
"@buildpad/mcp": major
---

Add the interface manifest, `lib/buildpad/interface-manifest.ts`: one data table of field-interface identity, with an entry per interface id (aliases, registry component, component export name, compatible field types, group, behaviour flags, form-builder picker descriptor, loading class). The interface tables that were kept by hand are derived from it, under their old names and with their old values. How stored records render does not change.

- `getFieldInterface` resolves the legacy alias ids (`textarea`, `wysiwyg`, the xtremax workflow ids, …) through `normalizeInterfaceId()`; they are no longer extra `case` labels. The switch first sees the id with only the registry aliases resolved (as in 2.6), so a `case` a project added for a legacy id or its own variant is still reached; only an id no case names falls back to its manifest renderer id. `REGISTRY_INTERFACE_ALIASES`, the concealing set, `CHOICE_INTERFACES`, `PROVISIONABLE_INTERFACES` and `isPresentationField` are derived from the manifest.
- The utils barrel exports the manifest and its helpers (`INTERFACE_MANIFEST`, `normalizeInterfaceId`, `getInterfaceManifestEntry`, `interfaceHasFlag`, `isPresentationInterface`, `isNonFlatRelationalInterface`, `isSelfPersistingInterface`, `isRelationListInterface`, …), and the field-level `isNonFlatRelationalField(field)` (an m2a/m2m/o2m special or a list-o2m/m2m/m2a interface).
- `InterfaceGroup` gains `'system'`, the registry group of `system-permissions` (a `Record<InterfaceGroup, …>` needs a `system` key). The `InterfaceType` literals the mapper never returns (`textarea`, `number`, `uuid`, `list-m2o`) are marked `@deprecated` and kept.
- `interface-registry`, `define-interface` and `load-interfaces` are deprecated: nothing populates that registry and VForm never reads it. They stay exported. With the new `'system'` group, `InterfaceRegistry.getGrouped(true)` returns 8 groups (it used to drop `system` interfaces) and `getInterfacesForApi` names that group "System".

Upgrade with the 3.0 CLI, which upgrades an entry's dependencies with it; see docs/MIGRATION-3.0.md.
