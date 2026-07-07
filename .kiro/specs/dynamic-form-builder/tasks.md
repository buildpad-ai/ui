# Tasks — Dynamic Form Builder (`@buildpad/ui-forms`)

## Phase 1 — overlay form builder (done)

Builder UI + overlay merge + conditions + definitions persistence + packaging. Answers already write to
**real columns** in the target collection. Phase 2 adds DDL provisioning and the `extras` jsonb tail.

- [X] 1. Define shared types and the condition source of truth

  - Create `packages/types/src/form-definition.ts` with `FormDefinition`, `FormSection`,
    `FormFieldConfig`, and re-export `FieldCondition`.
  - Move `FieldCondition` to `@buildpad/types`; update
    `packages/ui-form/src/utils/apply-conditions.ts` to import it from there.
  - Export from `packages/types/src/index.ts`.
  - _Requirements: 2.4, 3.1, 4.1_
- [X] 2. Implement the overlay merge function

  - Create `packages/utils/src/build-fields-from-definition.ts` exporting
    `buildFieldsFromDefinition(schemaFields, def): Field[]` (order, width, group/section, per-field
    override + condition merge; drop fields absent from the definition; skip unknown fields).
  - Export from `packages/utils/src/index.ts`.
  - Add Vitest unit tests for ordering, width, section→group, override and condition merge.
  - _Requirements: 4.1, 4.5, 2.4_ — _extended in Phase 2 (task 18: synthesize `extras` Fields + `meta.store`)._
- [X] 3. Add the definitions data hook

  - Create `packages/hooks/src/useFormDefinitions.ts` over `ItemsService(formsCollection)`:
    `list({ target_collection?, key? })`, `get(id)`, `create`, `update`, `remove`, plus
    `loading`/`error`; `formsCollection` defaults to `'fb_definitions'`.
  - Add `resolveScreen({ target_collection, key? })` that fetches candidates and applies
    **most-specific-scope-wins** (nearest ancestor-or-self of the active scope; falls back to the
    inherited/global baseline). On a non-scope-enabled collection this is a no-op (single baseline).
  - Export from `packages/hooks/src/index.ts`; update `packages/cli/templates/lib/hooks/index.ts`.
  - _Requirements: 3.1, 3.3, 3.4, 3.5, 9.3_
- [X] 4. Extend `CollectionForm` with an optional definition overlay

  - Add `definition?: FormDefinition` prop to `packages/ui-collections/src/CollectionForm.tsx`.
  - After building `editableFields` and before `setFields`, when `definition` is set apply
    `buildFieldsFromDefinition(editableFields, definition)`.
  - Verify existing permission, M2M, save, and validation paths are unchanged.
  - _Requirements: 4.1, 4.2, 4.4, 5.1, 5.2, 5.3, 5.4_ — _extended in Phase 2 (task 19: `extras` split write/read)._
- [X] 5. Scaffold the `@buildpad/ui-forms` package

  - Create `packages/ui-forms/` by mirroring `packages/ui-files/`: `package.json`
    (`@buildpad/ui-forms` v1.5.0, tsup, peer deps incl. `@dnd-kit/*`, `ui-form`, `ui-collections`),
    `tsconfig.json`, `.storybook/` (unique port + `@buildpad/ui-forms` alias), `src/index.ts`.
  - _Requirements: 7.1_
- [X] 6. Build the runtime renderer + preview wrappers

  - `packages/ui-forms/src/DynamicForm.tsx` — loads a definition via `useFormDefinitions`, renders
    `<CollectionForm definition=… />`.
  - For scope-enabled target collections, pass the active scope URI (from the scope context/cookie)
    as a create-time default value unless DaaS permission presets already inject the scope field.
  - `packages/ui-forms/src/FormPreview.tsx` — live preview using `DynamicForm` against empty values.
  - _Requirements: 4.1, 4.2, 4.3, 6.1, 6.2, 6.3, 9.1, 9.2_
- [X] 7. Build the builder layout components

  - `FormBuilder.tsx` (+ `.css`) orchestrator (palette/canvas/settings/preview), schema load,
    definition load/create/save.
  - `FieldPalette.tsx`, `BuilderCanvas.tsx`, `BuilderSection.tsx`, `BuilderFieldRow.tsx` with
    `@dnd-kit/sortable` reordering, width/required/readonly/hidden controls, section CRUD.
  - `FieldSettingsPanel.tsx` for the selected field.
  - Gate the builder UI on definitions-collection `create`/`update` permission (not `isAdmin`).
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 9 (authoring boundary)_
- [X] 8. Build the conditions editor

  - `ConditionsEditor.tsx` — manage `FieldCondition[]`; reuse `FilterPanel` for the rule; toggles for
    `hidden`/`required`/`readonly` (+ optional `options`); preserve last-match precedence.
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
- [X] 9. Add the empty-state / prerequisite guidance

  - In `FormBuilder` and the list page, when the definitions collection is missing, show a hint
    describing the required collection and fields; document it in the package README.
  - _Requirements: 3.2, 3.6_
- [X] 10. Add CLI page templates and the `forms-routes` lib module

  - `packages/cli/templates/app/forms/{page.tsx,new/page.tsx,[id]/page.tsx,[id]/fill/page.tsx}`
    (install under `(authenticated)`).
  - List → new → `<FormBuilder/>` (edit) → `<DynamicForm/>` (fill).
  - _Requirements: 8.1, 8.2, 8.3, 3.5_
- [X] 11. Wire the registry

  - `scripts/build-registry.mjs`: add `@buildpad/ui-forms` to `PACKAGE_FOLDERS` and
    `inferSourcePackage`.
  - `registry.template.json`: add `form-builder` component (`registryDependencies: ["collection-form","filter-panel"]`), `forms-routes` lib (`registryDependencies: ["form-builder"]`),
    `useFormDefinitions.ts` in `lib.hooks`, `form-definition.ts` in `lib.types`.
  - _Requirements: 7.2, 7.3, 7.4_
- [X] 12. Stories and unit tests for `@buildpad/ui-forms`

  - Stories: `FormBuilder` (empty + populated), `ConditionsEditor`, `DynamicForm`/`FormPreview`
    (+ a `.daas.stories.tsx`).
  - Vitest: condition round-trip through `apply-conditions.ts`.
  - _Requirements: 6.1, 6.2, 6.3, 2.4_
- [X] 13. Build + registry verification

  - `pnpm --filter @buildpad/ui-forms typecheck && build`;
    `pnpm --filter @buildpad/{types,hooks,utils,ui-collections} typecheck`; `pnpm build`.
  - `pnpm build:registry && pnpm registry:check` (must pass; confirm new entries present).
  - _Requirements: 7.5_
- [X] 14. CLI scaffold smoke test

  - `buildpad add form-builder` (+ `forms-routes`, `api-routes`) into a throwaway consumer; confirm
    targets, `@dnd-kit/*` install, and import rewrites.
  - _Requirements: 7.6, 8.2_

## Phase 2 — hybrid storage + DDL provisioning (new)

Make answers searchable-by-default via real columns the builder can provision, with an opt-in `extras`
jsonb tail. _(Confirm DaaS capabilities first via `mcp__daas__{schema,fields,collections,items}`.)_

- [X] 15. Add schema write methods (DDL) to the services

  - Extend `packages/services/src/fields.ts` with `createField`/`updateField`/`deleteField` and
    `packages/services/src/collections.ts` with `createCollection`/`deleteCollection`, wrapping the DaaS
    DDL API (`POST /api/fields/{collection}`, `POST /api/collections`, …); support `add_index`.
  - Add a `FieldSpec`/`CollectionSpec` type and a `fieldSpecToDaaSField` mapper reusing
    `packages/utils/src/{field-interface-mapper,interface-types}.ts` and `packages/types/src/core.ts`.
  - Unit tests for the spec→`Field` mapping (type → `schema.data_type` + `meta.interface`, `add_index`).
  - _Requirements: 10.2, 10.5, 11.1_
- [X] 16. Add the DDL proxy route templates

  - Add write handlers to `packages/cli/templates/app/api/daas-fields-route.ts` (POST) + a new
    `daas-fields-id-route.ts` (PATCH/DELETE), and a new `daas-collections-route.ts` (POST/DELETE),
    forwarding auth headers like the existing proxies. Register them in the `api-routes` lib module.
  - _Requirements: 10.1, 10.2_
- [X] 17. Add `store` + extra descriptor to the form-definition types

  - In `packages/types/src/form-definition.ts` add `FormFieldConfig.store?: 'column' | 'extras'`
    (default `'column'`) and `extra?: ExtraFieldDescriptor` (`type`/`interface`/`label`/`options`).
  - _Requirements: 11.1, 11.3, 11.4_
- [X] 18. Synthesize `extras` in the overlay merge

  - In `build-fields-from-definition.ts`: when `store==='extras'`, synthesize a `Field` from
    `config.extra`; always set `meta.store`. Flag a missing `store:'column'` field as "missing".
  - Unit tests for `extras` synthesis + `meta.store` propagation.
  - _Requirements: 11.1, 11.3, 11.5_
- [X] 19. Hybrid split write/read in `CollectionForm`

  - Extend `splitData` to peel off `meta.store==='extras'` values; on save merge them into the item's
    `extras` jsonb column; on load spread `extras` back into initial values. Real-column + M2M +
    permission + validation paths unchanged.
  - Unit/round-trip tests: form values ↔ real columns + `extras` jsonb.
  - _Requirements: 4.4, 11.1, 11.3, 11.5_
- [X] 20. Builder provisioning + storage-selector UI

  - `FieldPalette`/`FormBuilder` "Add field" flow: choose label/type/interface/options + storage
    (Real column → `createField`, optionally `add_index`; or Extra → jsonb, no DDL). Make
    `FormsEmptyState` "Create collection" actionable (`createCollection` with `id` + `extras`).
  - Permission-gate provisioning on schema rights; surface DDL errors without losing draft (Req 10.6);
    fall back to `extras` when schema rights are absent.
  - _Requirements: 1.2a, 10.1, 10.2, 10.3, 10.4, 10.6_
- [X] 21. Document the searchability foundation

  - In the `@buildpad/ui-forms` README: the native query surface for real-column answers
    (`filter`/relational/`sort`/`search`/`aggregate`/`groupBy`), modeling the Project→Issue hierarchy
    via real relations, and the explicit `extras` non-searchable caveat ("searchable → keep it a column").
  - _Requirements: 11.2, 11.3, 11.6_

## Phase 3 — validation (hybrid)

- [X] 22. Live DaaS end-to-end validation
  - Create the `fb_definitions` collection; build a screen that **provisions a new real field via the
    builder** (DDL) plus one `extras` field, with a conditional field; save; fill; verify layout, live
    conditions, and permission gating.
  - Storage/search: assert a **real item** is written with the new real columns populated and the
    `extras` value in the `extras` jsonb column; a native `filter`/`aggregate` query on a real field
    returns the item; the `extras` field is confirmed **not** server-filterable; field-level permissions
    gate the real fields.
  - Scope check: with a scope-enabled target collection and an active `daas_resource_uri`, verify the
    created item lands in the correct scope (`X-Resource-Uri` injected) and that the scope field is set
    on create; confirm definitions read/write under the active scope behave as configured.
  - _Requirements: 1.*, 2.*, 4.*, 5.*, 8.3, 9.1, 9.2, 9.3, 10.*, 11.*_

## Phase 4 — full data storage & new-collection creation (new)

Add a **full** storage strategy: instead of binding to an existing collection (hybrid), the builder can
**create a new** collection seeded with standard audit **system fields** where every custom field is a real
column (no `extras` tail). Every builder-created collection carries the `fb_` prefix; the definitions
collection default is renamed `form_definitions` → `fb_definitions` (clean rename — module unreleased).
_(Confirm DaaS capabilities first via `mcp__daas__{schema,fields,collections}`.)_

- [X] 23. Add a storage-strategy baseline to `CollectionsService`

  - In `packages/services/src/collections.ts` split `baselineFields` into `hybridBaseline` (`id` + `extras`
    jsonb — today's default) and `fullBaseline` (audit **system fields**: `id`, `status`, `sort`,
    `user_created`, `user_updated`, `date_created`, `date_updated`; **no** `extras`).
  - Add a `strategy?: 'hybrid' | 'full'` (default `'hybrid'`) option to `CollectionSpec`/`createCollection`
    selecting the baseline. Unit test both baselines.
  - _Requirements: 12.1, 12.2, 12.3, 11.7_
- [X] 24. Add the builder collection-name prefix

  - Add a configurable `FORM_BUILDER_COLLECTION_PREFIX` (default `fb_`) + a `normalizeCollectionName(name)`
    helper (prepend if absent, idempotent — never `fb_fb_`, reject `daas_` names); apply it in
    `createCollection`. Unit test the prefix/idempotency/`daas_` rules.
  - _Requirements: 12.7_
- [X] 25. Rename the default definitions collection `form_definitions` → `fb_definitions`

  - Update the default everywhere it appears: `packages/hooks/src/useFormDefinitions.ts`,
    `packages/cli/templates/app/forms/*`, `packages/ui-forms/src/*` prop defaults, `packages/ui-forms/README.md`,
    and Storybook/mocks. Straight rename — no back-compat/dual-name lookup (module unreleased).
  - _Requirements: 3.1, 12.7_
- [X] 26. New-form entry chooser (existing vs new collection)

  - Replace the single target-collection text input in `packages/cli/templates/app/forms/new/page.tsx` with a
    two-path chooser: **Use existing collection** (hybrid) or **Create new collection** (name + optional note
    → `createCollection({ strategy: 'full' })`, then set `target_collection` and open `<FormBuilder/>`).
  - Permission-gate the create-new (full) path on DaaS schema rights; hide/disable when absent.
  - _Requirements: 12.1, 12.4, 12.5, 12.6_
- [X] 27. Gate the `extras` store option on collection strategy

  - In `packages/ui-forms/src/AddFieldModal.tsx` (and the `FormBuilder` "Add field" flow) offer the *Extra*
    (jsonb) store **only** when the target collection has an `extras` column; a **full** collection shows
    *Real column* only. Infer strategy from the loaded schema (no `extras` field ⇒ full).
  - _Requirements: 12.3, 11.7_
- [X] 28. Docs, stories & full-storage E2E

  - Document the two storage strategies + the new-collection flow (and the `fb_` convention) in
    `packages/ui-forms/README.md`; add a Storybook story for the `AddFieldModal` storage gating
    (`AddFieldModal.stories.tsx`: hybrid vs full vs no-schema-rights).
  - Extend the live DaaS E2E (task 22) to create an `fb_`-prefixed **full** collection, add a real column,
    submit an item, and confirm there is **no** `extras` column and every field is server-filterable.
    _(Harness extended in `scripts/e2e-daas.mts`; a live run needs `DAAS_URL`/`DAAS_TOKEN`.)_
  - _Requirements: 12.*, 11.7_

## Phase 5 — optional target collection & broadened field palette (new)

The target collection is no longer required up front. The new-screen flow defaults to **Start building**
(no collection bound); on the first save the builder auto-creates a `fb_` **full** collection from the
screen name and provisions the fields the author added (deferred provisioning). The "Add field" interface
picker offers **all** provisionable interfaces of `@buildpad/ui-interfaces` — scalar, selection, rich
content (rich text / block editor) and geospatial (map) — with the extra rendering libraries declared as
`@buildpad/ui-forms` peer dependencies (task 34).

- [X] 29. Optional target collection + deferred provisioning in `FormBuilder`

  - Make `FormBuilderProps.targetCollection` optional. When unbound, hold added real-column `FieldSpec`s in
    a `pendingSpecs` map and synthesize each field locally so it renders; on the first save, derive a name
    from the screen name, `createCollection({ strategy: 'full' })`, `createField` each still-placed pending
    spec, set it as `target_collection`, then persist the definition. Surface provisioning errors without
    losing the draft and without triggering the definitions-missing empty state.
  - Rework `packages/cli/templates/app/forms/new/page.tsx`: **Start building** (auto-create, needs schema
    rights) as the default, with **Use existing collection** as the fallback / only path without schema
    rights. Collection creation moves from the page into the builder's save.
  - _Requirements: 12.1, 12.1a, 12.2, 12.5, 12.6_
- [X] 30. Broaden the "Add field" interface palette

  - In `packages/ui-forms/src/AddFieldModal.tsx` replace the curated interface list with the grouped
    **provisionable scalar/selection** interfaces of `@buildpad/ui-interfaces` (text / selection /
    numeric-date / other); refine choice-list detection to `select-dropdown`/`select-radio`/
    `select-multiple-checkbox` (a `CHOICE_INTERFACES` set). Exclude relational/file/group interfaces.
  - _Requirements: 1.2a, 10.2, 10.2a_
- [X] 31. Type-aware interface picker + shared provisionable catalog (fixes interface ids)

  - Add `packages/utils/src/interface-catalog.ts` (`PROVISIONABLE_INTERFACES` + `provisionableInterfacesForType`)
    using **renderer-recognized** interface ids (from `field-interface-mapper`) with per-type compatibility
    mirroring `registry.json`; export from `packages/utils/src/index.ts`. This corrects the wrong ids from
    task 30 (`color`→`select-color`; the mis-named `rich-text-*` are dropped in task 33).
  - In `AddFieldModal.tsx` drive the Interface `Select` from `provisionableInterfacesForType(type)` (grouped,
    type-filtered, `Auto (from type)` default) and reset an incompatible interface to *Auto* on type change;
    widen `TYPE_OPTIONS` (`bigInteger`/`decimal`/`time`/`csv`) and add `select-multiple-dropdown` to
    `CHOICE_INTERFACES`.
  - Unit test `packages/utils/tests/interface-catalog.test.ts`: per-type filtering + integrity (every value a
    renderer-recognized id; valid `FieldType`s; no dup ids).
  - _Requirements: 1.2a, 10.2a_
- [X] 32. Auto-create builder UX: offline preview + populated palette

  - `FormPreview`: add an **offline** mode (render in-memory fields via `VForm` + `buildFieldsFromDefinition`
    with `enforcePermissions={false}`) when no `target_collection` is bound; `FormBuilder` passes
    `schemaFields`. Preview now works before the first save (bound mode still uses `CollectionForm`).
  - `FieldPalette`: **quick-add field-type templates** from `PROVISIONABLE_INTERFACES` (grouped) that open
    `AddFieldModal` prefilled via new `defaultType`/`defaultInterface` props (applied on open).
  - `FormBuilder`: in auto-create mode seed `schemaFields` with `fullBaselineFields()` (exported from
    `@buildpad/services` `CollectionsService`) so the palette lists the new collection's system fields; wire
    `onQuickAdd`/`onAddNewField` through an `openAddField(seed?)` helper + `addFieldSeed` state.
  - _Requirements: 1.1a, 1.2a, 6.1a_
- [X] 33. Restrict the catalog to renderable interfaces + prove rendering

  - Remove `input-rich-text-html`/`input-rich-text-md` from `PROVISIONABLE_INTERFACES` — they need
    `@mantine/tiptap` + `@tiptap/*` (not form-builder peer deps), so they throw in the preview and would
    break in a scaffolded consumer. Keep only interfaces renderable with the form-builder's peer deps.
  - Prove rendering two ways: (a) the `interface-catalog` unit test now resolves every catalog id through the
    real `getFieldInterface` and asserts it maps to its **own** component (no fallback); (b) a
    `FormPreview.stories.tsx` story (`AllProvisionableInterfaces`) renders every interface via the offline
    preview so it can be verified visually (no error boundaries).
  - _Requirements: 1.2a, 6.1a, 10.2a_
- [X] 34. Full interface support via peer deps (reverses task 33's exclusion)

  - Declare the interface-rendering libraries as **`@buildpad/ui-forms` peer dependencies** (heavy
    per-interface ones optional in `peerDependenciesMeta`): `@mantine/tiptap` + `@tiptap/*` + `highlight.js`
    + `lowlight` (rich text), `@editorjs/*` (block editor), `maplibre-gl` + `@mapbox/mapbox-gl-draw` (map),
    plus `@mantine/dates` and `@buildpad/ui-interfaces`; mirror in `devDependencies`.
  - Re-add `input-rich-text-html`, `input-rich-text-md`, `input-block-editor`, and `map` to
    `PROVISIONABLE_INTERFACES` (`Rich content` + `Geospatial` groups) with `registry.json` types; update the
    module doc. The `interface-catalog` unit test auto-covers them (each resolves to its own renderer
    component); add a geometry→`map` assertion and move the empty-list assertion to `binary`.
  - Fix duplicate-context rendering in `packages/ui-forms/.storybook/main.ts`: the builder aliases
    `@buildpad/ui-interfaces`/`-collections` to their **out-of-root src**, so Vite served their `@mantine/core`
    raw while the app's copy was pre-bundled — two `MantineContext` instances, i.e. the "MantineProvider was
    not found" error thrown by `@mantine/tiptap`. Add `resolve.dedupe` **and** `optimizeDeps.include` for the
    shared singletons (React, `@mantine/*`, `@mantine/tiptap`, `@tiptap/react`/`core`/`starter-kit`,
    `@tiptap/pm/*`) so every importer shares one pre-bundled copy; a stale optimize cache must be cleared once.
  - _Requirements: 1.2a, 6.1a, 10.2a_

## Phase 6 — Form.io-style drag-and-drop field-type palette (new)

Replace the "Quick add" button cluster with a Form.io-style **draggable field-type catalog** (icon+label
chips grouped by category). Dragging a chip onto the canvas prompts for the **column name only**, drops the
field at that position with the name **locked**, and defers real-column provisioning to Save (for bound
collections too). Label / choices / width / etc. are configured afterward in the settings panel. Existing
schema fields remain draggable.

- [X] 35. Draggable field-type catalog in `FieldPalette`
  - In `packages/ui-forms/src/FieldPalette.tsx` replace the quick-add `Button` cluster with a grouped list of
    `@dnd-kit` **draggable chips** (id `newfield:<interface>`, exported `NEWFIELD_ID_PREFIX`) derived from
    `PROVISIONABLE_INTERFACES` — an icon+label per interface (`@tabler/icons-react`), grouped by
    `ProvisionableInterface.group`. Keep the existing-fields draggable list and make the search box filter
    both; gate the catalog on schema rights. Replace `onQuickAdd`/`QuickAddSeed` with `onAddFieldType`.
  - _Requirements: 1.1, 1.1a, 1.2, 1.2a_
- [X] 36. Drop → name prompt → deferred placement in `FormBuilder`
  - Add a `newfield:*` branch to `handleDragEnd` that resolves the drop target (reusing `sectionIdFrom`),
    stashes it, and opens a new minimal **`NameFieldModal`** (column name only; type/interface from the chip;
    reuse `AddFieldModal`'s name/key derivation + `existingFieldNames` validation). On confirm: build a
    `FieldSpec`, `synthField`, record in `pendingSpecs`, insert `{ field }` at the drop position, and
    `setSelectedField`. Add a `newfield:*` `DragOverlay` preview; wire the click path (append to last
    section).
  - _Requirements: 1.2a, 10.7_
- [X] 37. Configure-after (choices + locked key) and provision-on-save
  - Extract `CHOICE_INTERFACES` + a shared `ChoicesInput` from `AddFieldModal.tsx` and export
    `interfaceRequiresChoices()` from `packages/utils/src/interface-catalog.ts`. In
    `packages/ui-forms/src/FieldSettingsPanel.tsx` add **label** + **choices** editing (writing back to the
    pending `FieldSpec`) and keep the column name a read-only `Badge` (no rename).
  - In `FormBuilder.handleSave`, provision pending specs for **bound** collections too (not only
    auto-create): loop `sections` in order, `createField` each pending `store:'column'` spec and replace its
    synth; block the save with a clear message when a pending choice field has no choices or a pending key is
    invalid/duplicate.
  - Update `FormBuilder.daas.stories.tsx` / Playground; add `packages/ui-forms/tests/` unit tests for
    name/key uniqueness + `interfaceRequiresChoices`.
  - _Requirements: 6a, 10.7, 11.1_

## Phase 7 — release (CI via Changesets)

Ship `@buildpad/ui-forms` so consumers can `npx @buildpad/cli add form-builder forms-routes`. Lockstep
release of all 10 `@buildpad/*` packages; a release is live for consumers the moment `registry.json` +
sources land on `main` (CLI fetches from raw.githubusercontent.com/microbuild-ui/ui/main/...),
independent of npm (only `cli`+`mcp` publish to npm). Authoritative reference: `.claude/skills/release`
and `docs/PUBLISHING.md`. The module is already wired (registry.json has `form-builder` + `forms-routes`,
`package.json` matches `ui-files`, `build-registry.mjs` mapping + `cli/templates/app/forms/*` exist).

- [X] 38.1 Add `@buildpad/ui-forms` to the `fixed` lockstep group
  - Add `"@buildpad/ui-forms"` to the `fixed[0]` array in `.changeset/config.json` (after
    `@buildpad/ui-files`). It is currently missing — without it `changeset version` won't bump ui-forms
    in lockstep with the other 9 packages.
  - _Requirements: 7.1_
- [X] 38.2 Pre-flight build/typecheck/tests (targeted)
  - `pnpm --filter @buildpad/ui-forms build`, `pnpm --filter @buildpad/ui-forms typecheck`,
    `pnpm --filter @buildpad/ui-forms test`, `pnpm --filter @buildpad/utils test` — all clean.
  - Run targeted suites only (the full `ui-interfaces` jest suite has known stale-import failures).
- [X] 38.3 Regenerate + verify the registry
  - `pnpm build:registry && pnpm registry:check` — regenerates `packages/registry.json` with no
    unexpected diff and the CI sync guard passes (hashes/versions on disk match the sources).
- [ ] 38.4 Add the lockstep changeset
  - `pnpm changeset` → **minor** bump (new feature module; the fixed group bumps all 10 packages to
    the next minor, expected 1.6.0). Summary names the module. Touched: `ui-forms` (new),
    `ui-collections`, `hooks`, `types`, `utils`, `services`, `cli`, `ui-form`.
- [ ] 38.5 PR to `main` and merge
  - Open `feat/form-builder` → `main` with the config fix + changeset. Ensure CI (`registry:check`,
    `pnpm build`) is green, then merge. The changesets action opens a "Version Packages" PR.
- [ ] 38.6 Finish the Version Packages PR before merging
  - Bump the top-level `"version"` in `packages/registry.template.json` to the new version
    (`changeset version` does NOT touch it). Re-run `pnpm build:registry` and commit the regenerated
    `packages/registry.json`. Verify all 10 `package.json`s show the SAME version.
  - Guard against the peerDep major cascade: if the bump inflated to a major (e.g. 2.0.0) due to
    `workspace:*` peerDeps, rewrite it down to the intended minor across all 10 package.jsons +
    registry.template.json before merging.
- [ ] 38.7 Merge the Version Packages PR (publish + tags)
  - CI publishes `@buildpad/cli` + `@buildpad/mcp` to npm and creates per-package git tags (incl.
    private packages). Confirm the CI `NPM_TOKEN` is write-scoped (the repo's was previously read-only)
    — the module is CDN-installable either way, but npm publish needs write access.
- [ ] 38.8 Verify end-to-end
  - Registry live on main: `git show main:packages/registry.json` has `form-builder` + `forms-routes`
    at the new version; top-level `version` matches.
  - CLI smoke test in a scratch app: `npx @buildpad/cli@latest add form-builder forms-routes` copies
    `ui-forms/src/*` → `components/ui/form-builder/*`, scaffolds `app/(authenticated)/forms/*`, pulls
    `collection-form`/`filter-panel`/`types`/`hooks`/`services`/`utils`. (Name `form-builder`
    explicitly — the CLI does not auto-install a lib module's `registryDependencies`.)
  - Version sanity: `npx @buildpad/cli@latest --version` prints the new version; registry `version`
    and `packages['@buildpad/ui-forms'].version` match. MCP `list_components` shows `form-builder`.
  - _Requirements: 7.1, 8.1_
