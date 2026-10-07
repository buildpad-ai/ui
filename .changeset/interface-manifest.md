---
"@buildpad/utils": major
"@buildpad/cli": major
"@buildpad/mcp": major
---

Add the interface manifest, `lib/buildpad/interface-manifest.ts`: one data table of field-interface identity, with an entry per interface id (aliases, registry component, component export name, compatible field types, group, behaviour flags, form-builder picker descriptor, loading class). The interface tables that were kept by hand are derived from it, under their old names and with their old values. How stored records render does not change.

- `getFieldInterface` resolves registry and legacy alias ids (`input-tags`, `textarea`, `wysiwyg`, the xtremax workflow ids, …) through `normalizeInterfaceId()` before its switch; the legacy ids are no longer extra `case` labels. `REGISTRY_INTERFACE_ALIASES`, the concealing set, `CHOICE_INTERFACES`, `PROVISIONABLE_INTERFACES` and `isPresentationField` are derived from the manifest.
- The utils barrel exports the manifest and its helpers (`INTERFACE_MANIFEST`, `normalizeInterfaceId`, `getInterfaceManifestEntry`, `interfaceHasFlag`, `isPresentationInterface`, `isNonFlatRelationalInterface`, `isSelfPersistingInterface`, `isRelationListInterface`, …).
- `InterfaceGroup` gains `'system'`, the registry group of `system-permissions` (a `Record<InterfaceGroup, …>` needs a `system` key). The `InterfaceType` literals the mapper never returns (`textarea`, `number`, `uuid`, `list-m2o`) are marked `@deprecated` and kept.
- `interface-registry`, `define-interface` and `load-interfaces` are deprecated: nothing populates that registry and VForm never reads it. They stay exported.

Upgrade the whole project (`buildpad upgrade`), not single components; see docs/MIGRATION-3.0.md.
