# Design — Dynamic Form Builder (`@buildpad/ui-forms`)

## Overview

The dynamic form builder adds a **design-time authoring layer** on top of the repo's existing,
already-complete **runtime** for schema-driven DaaS forms. The runtime (`CollectionForm` → `VForm` →
`FormFieldInterface`, plus `apply-conditions.ts`) requires no rewrite; the new work is (1) a builder UI
to author a **form definition**, (2) a tiny overlay-merge function so a saved definition drives the
existing runtime, (3) a thin data hook to persist definitions as items, (4) a **hybrid data layer** —
answers stored as real, searchable DaaS columns by default, with the builder **provisioning** the
columns it needs via the DDL API and an opt-in `extras` jsonb tail — and (5) registry/CLI packaging.

Design principles:
- **Reuse, do not reimplement.** No new form renderer, no new condition engine. The merge stays a pure
  function; the runtime is untouched.
- **Lean into the platform, don't reinvent it.** DaaS *is* a managed schema + permission + query/search
  layer. So answers live in **real fields** (searchable, field-permissioned, ecosystem-native) and the
  builder uses the first-class **DDL API** to create them on demand — rather than a JSON blob (not
  server-searchable on DaaS) or a hand-rolled EAV value-table (would re-implement, worse, what the
  platform already provides). A single `extras` jsonb column is the documented escape hatch for the rare
  non-searchable tail. See [Data storage & searchability](#data-storage--searchability).
- This deliberately adds two things the first cut avoided: a **schema write-service + DDL proxy routes**,
  and a **split write/read** in `CollectionForm` for `extras`. Everything else is reuse.

## Architecture

```
Design time                                  Run time
┌──────────────────────────────┐             ┌─────────────────────────────────┐
│ FormBuilder (ui-forms)       │  items CRUD │ DynamicForm (ui-forms)          │
│  FieldPalette                │ ──────────► │  useFormDefinitions.get(id)     │
│  BuilderCanvas/Section/Row   │ form_def…   │  FieldsService.readAll(coll)    │
│  FieldSettingsPanel          │  collection │  buildFieldsFromDefinition()    │
│   └ ConditionsEditor         │ ◄────────── │   → Field[]                     │
│       (reuses FilterPanel)   │   load      │  <CollectionForm definition=…/> │
│  FormPreview ── renders ───────────────────►   VForm → apply-conditions      │
└──────────────────────────────┘             └─────────────────────────────────┘
        @dnd-kit/sortable (already a repo dep, used by ui-table)
```

### Reused building blocks (no or minimal change)
- `packages/ui-form/src/utils/apply-conditions.ts` — runtime condition engine. **Change:** import
  `FieldCondition` from `@buildpad/types` instead of redeclaring it (single source of truth).
- `packages/ui-form/src/VForm.tsx`, `FormFieldInterface.tsx` — rendering (no change).
- `packages/ui-collections/src/CollectionForm.tsx` — data/permissions/CRUD. **Change:** add optional
  `definition` prop + overlay merge before `setFields`; extend the existing `splitData` to also split
  off **`extras`** values (merged into the item's `extras` jsonb column) and flatten `extras` back on
  read. Real-column write, M2M, permission, and validation paths are untouched.
- `packages/ui-collections/src/FilterPanel.tsx` (registry `filter-panel`) — reused to author rules.
- `packages/services/src/{items,permissions}.ts`, `packages/hooks/src/{useFieldMetadata,usePermissions}.ts`.
- `packages/services/src/{fields,collections}.ts` — currently **read-only**. **Change:** add DDL write
  methods (`createField`/`updateField`/`deleteField`, `createCollection`/`deleteCollection`) wrapping the
  DaaS DDL API, for builder provisioning.
- `@dnd-kit/{core,sortable,utilities}` — already a dependency of `ui-table`; reused for reordering.

### Component / module map
| Layer | Artifact | Location |
|------|----------|----------|
| Types | `FormDefinition`, `FormSection`, `FormFieldConfig` (+ `store`, extra descriptor), re-export `FieldCondition` | `packages/types/src/form-definition.ts` |
| Merge | `buildFieldsFromDefinition(schemaFields, def)` (synthesizes a `Field` for each `extras` descriptor) | `packages/utils/src/build-fields-from-definition.ts` |
| Data | `useFormDefinitions(formsCollection?)` | `packages/hooks/src/useFormDefinitions.ts` |
| Schema (NEW write) | `FieldsService`/`CollectionsService` DDL methods (create field/collection) | `packages/services/src/{fields,collections}.ts` |
| Runtime prop | `CollectionForm` `definition?` + `extras` split write/read | `packages/ui-collections/src/CollectionForm.tsx` |
| Builder | `FormBuilder`, `FieldPalette` (field-type catalog + existing fields), `NameFieldModal` (drop name prompt), `AddFieldModal` (advanced/storage), `BuilderCanvas`, `BuilderSection`, `BuilderFieldRow`, `FieldSettingsPanel`, `ChoicesInput`, `ConditionsEditor`, `FormPreview`, `DynamicForm` | `packages/ui-forms/src/*` |
| Routes | forms list / new / `[id]` (build) / `[id]/fill` (render) | `packages/cli/templates/app/forms/*` |
| API (NEW) | DDL proxy routes: `fields` (write) + `collections` | `packages/cli/templates/app/api/*` |

## Components and Interfaces

### `FormBuilder`
```ts
interface FormBuilderProps {
  targetCollection?: string;         // collection the screen creates/edits items in;
                                     // OMIT to auto-create an fb_ full collection on first save
  definitionId?: string;             // edit existing; omit to create new
  formsCollection?: string;          // default 'fb_definitions'
  onSaved?: (def: FormDefinition) => void;
}
```
Orchestrates three panes: palette (left), canvas (center), settings (right) + a preview tab. When
`targetCollection` is set, loads its schema (`FieldsService.readAll`); when omitted, opens empty and
auto-creates a **full** collection on the first save (see *Deferred provisioning* below). Loads/creates the
definition via `useFormDefinitions`, and saves on demand. Drag/reorder via `@dnd-kit/sortable`. Dragging a
field-type catalog chip (`newfield:<interface>`) onto the canvas opens a **minimal name prompt**
(`NameFieldModal`); on confirm it inserts a synthesized field at the drop position with its column name
**locked**, holds the `FieldSpec` in `pendingSpecs`, and selects it so the settings panel opens. The live
preview requires a bound collection, so on the auto-create path it becomes available after the first save.

### `ConditionsEditor`
Edits `FieldCondition[]` for the selected field. Each row composes a `FilterPanel` (scoped to the
collection's fields) for `rule`, plus toggles for `hidden`/`required`/`readonly`. Output is fed back
into the field's `conditions` array verbatim.

### `DynamicForm`
```ts
interface DynamicFormProps {
  definitionId: string;
  formsCollection?: string;          // default 'fb_definitions'
  itemId?: string | number;          // edit mode when provided
  onSuccess?: (data?: Record<string, unknown>) => void;
  onCancel?: () => void;
}
```
Loads the definition, then renders `<CollectionForm targetCollection={def.target_collection}
definition={def} id={itemId} .../>`. Used by the fill page.

### `FormPreview` (in `@buildpad/ui-forms`)
Takes the in-memory draft (`definition`) plus the builder's current `schemaFields`. **Bound** mode (a
`target_collection` is set) renders the true runtime via `CollectionForm` (real schema + permissions).
**Offline** mode (auto-create, no collection yet) renders the builder's in-memory fields directly via
`VForm` + `buildFieldsFromDefinition` — no data load, persistence, or permission checks, but conditions
still evaluate live — so the preview works before the first save. Both use empty values and never persist.

### `FieldPalette` (in `@buildpad/ui-forms`)
Two draggable groups under a shared search box: a **field-type catalog** and the **unplaced existing fields**.
The catalog is derived from the shared `PROVISIONABLE_INTERFACES`, grouped by category (Text / Rich content /
Selection / Numeric & date / Geospatial); each entry renders as an icon+label chip that is `@dnd-kit`
draggable (id `newfield:<interface>`) — dropping it on the canvas opens the name prompt (see `FormBuilder`),
and clicking it appends a new field to the last section. Existing fields are draggable (id `palette:<field>`)
and removed from the palette once placed. The catalog is gated on schema rights (creating a real column is a
DDL op). In the auto-create flow `FormBuilder` seeds `schemaFields` with `fullBaselineFields()` so the
existing-fields group also lists the new collection's system fields (only `status` is user-facing; the rest
are excluded by `PALETTE_EXCLUDE`).

### `FieldSettingsPanel` (in `@buildpad/ui-forms`)
Edits the selected field's `FormFieldConfig` — width, `required`/`readonly`/`hidden`, label/help note, and
the `ConditionsEditor`. For a field created from the catalog it additionally edits the **label** and, for a
**choice interface**, its **choices** (a shared `ChoicesInput`, extracted from `AddFieldModal`), writing them
back into the field's pending `FieldSpec` so the provisioned column carries them. The **column name is shown
read-only** (a locked `Badge`) — it is fixed at the name prompt and never renamable.

### `CollectionForm` extension (in `@buildpad/ui-collections`)
Add `definition?: FormDefinition`. In the field-loading effect, after computing `editableFields` and
**before** `setFields(...)`, when `definition` is present call
`buildFieldsFromDefinition(editableFields, definition)`.

**Hybrid split (the one save-path change).** The existing `splitData` already separates scalar vs. M2M
values; extend it to also peel off **`extras`** fields (those whose merged `Field` carries
`meta.store === 'extras'`). On save: write real-column + M2M values exactly as today, and merge the
`extras` values into the item's single `extras` jsonb column (`{ ...prevExtras, ...changedExtras }`). On
load: spread the item's `extras` object back into the initial form values so extra fields hydrate. All
permission, M2M, and validation logic is otherwise untouched. (Field-level permissions apply to real
columns; `extras` shares the one column's permission — see [Ecosystem fit](#ecosystem-fit).)

### Schema provisioning (NEW — `FieldsService`/`CollectionsService` write methods + builder UI)
`FieldsService` and `CollectionsService` are read-only today; add thin DDL wrappers over the DaaS Schema
API (mirrored by the `mcp__daas__{fields,collections}` contracts):
```ts
// FieldsService
createField(collection: string, spec: FieldSpec): Promise<Field>;   // POST /api/fields/{collection}
updateField(collection: string, field: string, patch): Promise<Field>;
deleteField(collection: string, field: string): Promise<void>;
// CollectionsService
createCollection(spec: CollectionSpec): Promise<Collection>;        // POST /api/collections
deleteCollection(collection: string): Promise<void>;
```
A builder **field spec** → DaaS `Field` is produced by reusing `field-interface-mapper` /
`interface-types` (type → `schema.data_type` + `meta.interface`/`options`). When the new field will be
filtered/sorted, pass `add_index: true` (DaaS B-tree index). In the builder the primary path is **dragging a
catalog chip** onto the canvas, which opens a **minimal name prompt** (`NameFieldModal`) — column name only,
since the chip fixes type/interface — then places the field at the drop position with its column name locked;
its label and choices are edited afterward in `FieldSettingsPanel`. The advanced **"Add field"** flow still
prompts for label/type/interface/options **and storage**: *Real column* (default → `createField`, searchable)
or *Extra* (jsonb, no DDL — descriptor carried in the definition). The *Extra* option is offered **only** when
the target collection has an `extras` column (a hybrid collection); a **full** collection shows *Real
column* only. The **interface** picker is **type-aware**: it lists only the provisionable interfaces whose
`types` include the selected field type (grouped: text / selection / numeric-date), plus an *Auto (from type)*
default, and resets an incompatible interface to *Auto* when the type changes — mirroring the DaaS data-model
UI (`getInterfacesForType`). It is driven by a shared catalog in `@buildpad/utils`
(`interface-catalog.ts` → `PROVISIONABLE_INTERFACES` / `provisionableInterfacesForType`) whose `value` is the
**renderer-recognized** interface id (the `case` labels in `field-interface-mapper.getFieldInterface`, e.g.
`tags`, `select-color`, `input-code`) and whose per-type compatibility mirrors `registry.json`. The catalog is
static (not the runtime `interfaceRegistry`, which is unpopulated here, nor a live `GET /api/interfaces`, whose
DaaS ids don't all match the renderer) so a scaffolded consumer needs no extra data. The catalog offers
**every scalar/selection/rich-content/geospatial interface** of `@buildpad/ui-interfaces`. The interfaces
that need extra rendering libraries — rich text (`@mantine/tiptap`+`@tiptap/*`), block editor
(`@editorjs/*`), map (`maplibre-gl`+`@mapbox/mapbox-gl-draw`) — are declared as **`@buildpad/ui-forms` peer
dependencies** (the heavy per-interface ones optional in `peerDependenciesMeta`; they also arrive
per-interface through the registry, since `form-builder`→`collection-form`→`vform` pulls every interface),
so a consumer can render them. Only relational, file, and group/presentation interfaces are excluded (they
need relations/junctions or store no value; scalars first, relations a later pass). The builder's own
Storybook Vite config **dedupes** React/Mantine/Tiptap so rich text resolves a single MantineProvider. An
`interface-catalog` unit test proves every catalog id resolves through `getFieldInterface` to its own
component (no fallback), and a `FormPreview` story renders all of them.

`createCollection` takes a **storage strategy** (`'hybrid' | 'full'`) selecting its baseline —
`hybridBaseline` (`id` + `extras` jsonb, today's default) or `fullBaseline` (the audit **system fields**,
no `extras`) — and normalizes the collection name through the prefix helper (below). The new-screen entry
point makes the target collection **optional**: **Start building** (default with schema rights) begins
authoring with no collection bound, or **Use existing collection** (hybrid) binds one. `FormsEmptyState`'s
**"Create collection"** action also provisions via the same service. Provisioning is permission-gated on
DaaS schema rights; `extras` need none.

**Deferred provisioning.** Every field created from the catalog is held as a pending `FieldSpec` and
synthesized locally so it renders, and is **provisioned only on Save** — on both the **Start building** path
(no collection yet) and screens **bound to an existing** collection. On the auto-create path the first save
derives a collection name from the screen name and calls `createCollection({ strategy: 'full' })` before
provisioning. In both cases `FormBuilder` then `createField`s every still-placed pending spec in canvas
order, replaces each synthesized field with the returned real one, sets/keeps `target_collection`, and
persists the definition. Before provisioning, the save is **blocked with a clear message** if a pending
choice field has no choices or a pending column name is invalid/duplicate. A failure creating the
collection/fields is surfaced without losing the in-progress draft (it does **not** trigger the
definitions-missing empty state, which is reserved for a genuine definitions-store failure).

**Collection naming.** A configurable `FORM_BUILDER_COLLECTION_PREFIX` (default `fb_`) plus a
`normalizeCollectionName(name)` helper (prepend if absent, idempotent — never `fb_fb_`, reject `daas_`) is
applied by `createCollection`, so every builder-created collection — the `fb_definitions` store and target
collections alike — is prefixed; existing collections a screen binds to are untouched.

## Data Models

### `FormDefinition` (stored as one item in the definitions collection)
```ts
interface FormDefinition {
  id?: string;
  name: string;                 // "Bug create screen"
  target_collection: string;    // "issues"
  key?: string | null;          // optional screen discriminator (e.g. issue_type)
  sections: FormSection[];
}
interface FormSection { id: string; title?: string; fields: FormFieldConfig[]; }
interface FormFieldConfig {
  field: string;                // schema field key (or the extra's key, when store==='extras')
  width?: 'half' | 'full';
  required?: boolean;
  readonly?: boolean;
  hidden?: boolean;
  note?: string;                // label/help override
  conditions?: FieldCondition[];// from ui-form/apply-conditions
  store?: 'column' | 'extras';  // DEFAULT 'column' (real, searchable). 'extras' → jsonb tail.
  extra?: ExtraFieldDescriptor; // REQUIRED when store==='extras' (not in DaaS schema, so self-described)
}
interface ExtraFieldDescriptor {
  type: string;                 // 'string' | 'integer' | 'boolean' | 'date' | 'json' | ...
  interface?: string;           // VForm interface id (e.g. 'input', 'select-dropdown')
  label?: string;
  options?: Record<string, unknown>; // interface options (e.g. choices)
}
```
`store` defaults to `'column'`: the value is bound to a real schema field and is fully searchable. When
`store: 'extras'`, the field is **not** in the DaaS schema, so its rendering metadata is carried inline
via `extra` (the merge synthesizes a `Field` from it), and its value lives in the target collection's
`extras` jsonb column.

### Definitions collection (consumer-created, one-time)
| field | type | notes |
|-------|------|-------|
| `id` | uuid | auto |
| `name` | string | screen name |
| `target_collection` | string | collection the screen targets |
| `key` | string (nullable) | optional screen discriminator |
| `definition` | json | the `FormDefinition` body |

Name is configurable (prop), default `fb_definitions` (it shares the `fb_` builder collection prefix).
**Not** a system/`daas_` collection. Created via the Data Model editor or the **DDL API** — surfaced as a
builder empty-state hint that can now create it in-app (Requirement 10.1).

### Target (entity) collection (holds the answers)
The collection a screen creates/edits items in (e.g. `fb_issues`). Answers are **one item** = real columns
(+ an `extras` jsonb tail only in a **hybrid** collection):

| field | type | notes |
|-------|------|-------|
| `id` | uuid | auto |
| _form fields_ | real typed columns | the **default** store — searchable/sortable/aggregatable/relatable + field-level-permissioned. Provisioned via the DDL API (Req 10), optionally indexed. **Full** collections store **every** field here. |
| `parent` / `type` | relation / string | model a Project → Issue/Case/Request hierarchy with real **relations** (filterable via dot-notation). |
| `extras` | jsonb | **hybrid only** — one column for all `store: 'extras'` fields; opt-in tail, **not** server-searchable. **Absent** in a full collection. |

Two creation baselines (Req 12): **hybrid** = `id` + `extras` (today's Req 10.1 baseline, used when the
target must interop with an existing collection); **full** = the standard audit **system fields** (`id`,
`status`, `sort`, `user_created`, `user_updated`, `date_created`, `date_updated`) and **no `extras`**.
Either way it is an ordinary consumer collection (scope-enable it like any other), the builder creates it
(and its fields) on demand via the DDL API, and its name carries the `fb_` prefix.

### `buildFieldsFromDefinition(schemaFields, def): Field[]`
Pure function. For each `FormFieldConfig` in section/field order: when `store !== 'extras'`, find the
matching schema `Field`; when `store === 'extras'`, **synthesize** a `Field` from `config.extra`
(`field`, `type`, `meta.interface`/`options`/`label`) since it is not in the schema. Deep-merge config
into `field.meta` (`sort` from position, `width`, `required`, `readonly`, `hidden`, `note`, `conditions`,
`group` for section membership, and **`store`** so the save path can route the value). Sections become
either synthesized `presentation-divider` fields (MVP) or synthesized `group-detail`/`group-raw` group
fields (full fidelity — VForm supports both). Real fields absent from the definition are dropped; a
`store:'column'` config whose field is missing from the schema is flagged "missing" in the builder
(prompt to provision it).

## Data storage & searchability

The form **definition** (overlay JSON) is config; the form **data** (answers) is what users must later
search and report on. How answers are stored is therefore the load-bearing decision, and it was made by
eliminating alternatives against the **buildpad/DaaS reality** (verified in the docs + repo):

| Approach | Verdict on buildpad | Why |
|----------|--------------------|-----|
| **Single `data.json` blob** (all answers in one JSON column) | ❌ rejected as default | DaaS filter rules target real fields & relations (dot-notation), **not JSON sub-keys** — the Items API can't filter/sort *inside* a json column (`connect/filter-rules`; `packages/services/src/auth/filter-to-query.ts`). A blob is therefore not server-searchable here. |
| **EAV value-table + Lucene** (how Jira does it) | ❌ rejected | Jira hand-rolls EAV+Lucene because it's a standalone app on a raw RDBMS. On buildpad it would forfeit **field-level permissions** (answers become `(field_key,value)` rows, but DaaS gates by *column* — `platform-studio/roles-policies`), forfeit native **relational filters / `aggregate` / `groupBy`** (`connect/items`), and break **`ui-table` / `generate_form`** which consume real collections. You'd re-implement search (a projection), permissions, relations, and typing — re-inventing, worse, what DaaS provides. |
| **JSONB as the "modern alternative"** | ❌ for searchable data | In *raw* Postgres jsonb is queryable via GIN/expression indexes — but the DaaS **Items API does not expose JSON-internal operators**, so on this platform jsonb collapses into the same non-searchable blob. |
| **Real typed columns** | ✅ chosen (default) | Schema creation is first-class — *"DDL API to create/alter tables"* (`getting-started/overview`); the `mcp__daas__fields` contract even supports `add_index: true`. Real columns are natively searchable/sortable/aggregatable/relatable and **field-level-permissioned**, and every `@buildpad/*` consumer understands them. |
| **+ a single `extras` jsonb column** | ✅ escape hatch | For the rare unbounded/display-only tail that never needs querying — opt-in per field, with the non-searchable caveat surfaced to the author. |

**Decision: hybrid.** Default every field to a **real column** (provisioned on demand via the DDL API);
offer **`extras`** jsonb only as an explicit per-field opt-in. The decision journey
(blob → EAV → JSONB → real columns → hybrid) is recorded here as the canonical rationale. A side-by-side
**ERD** of the classic EAV model vs. this hybrid is in [`diagrams.md` §9](./diagrams.md).

### Storage strategies: hybrid vs full

The `extras` escape hatch is only ever needed when a screen must bind to a collection the author can't (or
won't) reshape. That splits data storage into **two strategies**, chosen by **how the target collection
comes to be** (Requirement 12):

- **Hybrid** — the screen binds to an **existing** collection. Real columns for everything provisioned,
  plus the single opt-in `extras` jsonb tail for the non-searchable remainder. The original behavior.
- **Full** — the builder **creates a new** collection, seeded with the standard audit **system fields**
  (`id`, `status`, `sort`, `user_created`, `user_updated`, `date_created`, `date_updated`) and **no
  `extras` column**. Every custom field is then provisioned as a real column, so the whole record is
  natively searchable and there is no jsonb tail to reason about.

**Strategy is derived, not persisted.** A collection is "full" iff its live schema has **no `extras`
column**; the builder infers the strategy from the schema, so `FormDefinition` gains no new field. The
UI consequence: the `extras` store option in "Add field" is offered **only** when the target collection has
an `extras` column (full collections show *Real column* only).

**Naming convention.** Every collection the builder creates — the definitions collection **and** any target
collection — is named with a configurable prefix (default `fb_`), so builder-owned tables stand out next to
`daas_` system collections. The prefix is applied on creation only, is idempotent (never `fb_fb_`) and
never yields a `daas_` name; a screen that binds to an existing collection never renames it.

**The searchable query surface (no custom code).** Because answers are real columns, the *existing* Items
API is the search layer — `ItemsService.readByQuery(...)` already speaks it:
- `filter` (20+ operators incl. `_eq/_in/_contains/_between/_regex` and **relational dot-notation**
  `filter[parent.type][_eq]=…`), `sort` (`-field`), `search` (substring across strings),
  `aggregate` (count/sum/avg/min/max), `groupBy`, `limit/offset/page`, and `meta.total_count/filter_count`.
- Model a **Project → Issue/Case/Request** hierarchy as real **relations** (M2O `parent` + `type`
  discriminator), so hierarchical queries are native.

This round delivers only the **storage + search foundation** (data is stored so it's queryable). Building
list/table/dashboard UIs over it is a deliberate follow-up (reuse `ui-table` + the query surface above).

## Ecosystem fit

Answering "does the form builder work well with the rest of buildpad?" — yes, *because answers are real
fields*. Each capability below is inherited, not re-built:

| Buildpad capability | Real fields (default) | `extras` jsonb (tail) |
|---------------------|-----------------------|-----------------------|
| Items `filter` / relational dot-notation / `search` | ✅ native | ⚠️ only coarse `search` / client-side |
| `aggregate` / `groupBy` (reporting) | ✅ native | ❌ |
| Roles/policies — **field-level** + row-level + presets/validation | ✅ native (reuses `CollectionForm`) | ⚠️ shares the one column's permission; no per-field gating |
| Scopes (collection-level, `X-Resource-Uri`) | ✅ native | ✅ (same row) |
| `ui-collections` / `ui-table` / `ui-interfaces` | ✅ native | ⚠️ value present, not column-addressable |
| `generate_form` / `generate_interface` codegen | ✅ native | n/a (not in schema) |
| DDL API (`mcp__daas__{fields,collections}`) | ✅ used to provision (+ `add_index`) | not used (no schema) |

The only ecosystem-visible compromise is intentional and bounded: anything an author puts in `extras`
loses native search and per-field permissions — which is exactly why `extras` is opt-in and the builder
warns about it.

## Distribution / Packaging

Mirror `@buildpad/ui-files`:
- New `packages/ui-forms/` (`package.json` → `@buildpad/ui-forms` v1.5.0, `tsconfig.json`, `.storybook/`
  with a unique port + `@buildpad/ui-forms` alias, tsup build). Peer deps: `@mantine/*`,
  `@tabler/icons-react`, `@dnd-kit/{core,sortable,utilities}`, `react`, and
  `@buildpad/{types,hooks,services,utils,ui-form,ui-collections}`.
- `scripts/build-registry.mjs`: add `'@buildpad/ui-forms': 'ui-forms'` to `PACKAGE_FOLDERS` and
  `if (source.startsWith('ui-forms/')) return '@buildpad/ui-forms';` to `inferSourcePackage`.
- `registry.template.json`:
  - `components[]` `form-builder`: `ui-forms/src/*` → `components/ui/form-builder/*`;
    `dependencies: ["@mantine/core","@mantine/hooks","@mantine/notifications","@dnd-kit/core","@dnd-kit/sortable","@dnd-kit/utilities","@tabler/icons-react"]`;
    `internalDependencies: ["types","hooks","services","utils"]`;
    `registryDependencies: ["collection-form","filter-panel"]` (pulls `vform` transitively).
  - `lib` `forms-routes`: page templates; `internalDependencies: ["api-routes","hooks"]`,
    `registryDependencies: ["form-builder"]`.
  - Add `useFormDefinitions.ts` to `lib.hooks` files; add `form-definition.ts` to `lib.types` files.
  - **NEW DDL proxy routes** — add the `fields` write handlers (POST/PATCH/DELETE) and a new `collections`
    route template to the **`api-routes`** lib module, so `buildpad add form-builder` (which depends on
    `api-routes`) scaffolds the provisioning endpoints. Gate them like the other DaaS proxy routes
    (forward auth headers); document that they require DaaS schema rights.

## Error Handling
- **Missing definitions/target collection** → builder/list show an empty-state explaining the required
  collection (do not crash); with schema rights it offers a **"Create collection"** action (DDL).
  `useFormDefinitions` surfaces `error` from the items request.
- **DDL/provisioning failure** (insufficient schema rights, name conflict, invalid field spec) → surface
  the DaaS error inline and keep the in-progress definition intact (Req 10.6); offer `extras` as a
  no-DDL fallback for the field.
- **`store:'column'` field missing from schema** (provisioning skipped, or field later removed) → the
  merge skips it and the builder flags it "missing" so the admin can provision/replace/remove it.
- **Invalid condition rule JSON** → `apply-conditions.ts` already wraps evaluation in try/catch and
  treats a throwing rule as non-matching; the editor validates rules via `FilterPanel`.
- **Permission denial** → reuse `CollectionForm`'s existing handling (field filtering, readonly,
  disabled submit, per-field validation surfacing).
- **Save failure** → propagate DaaS `{ errors: [...] }` to a toast/inline message (reuse
  `CollectionForm.parseValidationErrors`).

## Testing Strategy
- **Unit (Vitest in `@buildpad/ui-forms` / `@buildpad/utils`):** `buildFieldsFromDefinition`
  (order, width, group/section, override + condition merge; **`extras` synthesis** + `meta.store`
  propagation); the field-spec → DaaS `Field` **mapping** (type → `schema.data_type` + `meta.interface`,
  `add_index`); the **hybrid split** round-trip (form values ↔ real columns + `extras` jsonb); a round-trip
  asserting authored `FieldCondition[]` evaluate correctly through `apply-conditions.ts`.
- **Storybook:** stories for `FormBuilder` (empty + populated), `ConditionsEditor`, and a
  `DynamicForm`/`FormPreview` with a sample definition; a `.daas.stories.tsx` against live data.
- **Registry integrity:** `pnpm build:registry && pnpm registry:check` pass with the new entries.
- **CLI smoke test:** `buildpad add form-builder` (+ `forms-routes`, `api-routes`) into a throwaway
  consumer; verify targets, `@dnd-kit/*` install, and import rewrites.
- **Live DaaS E2E:** create `fb_definitions`; build a screen that **provisions a new real field via the
  builder** (DDL) plus one `extras` field, with a `severity` shown-when-`issue_type _eq bug` condition;
  save; fill the screen and verify layout, conditional behavior, and permission gating. Then assert the
  **storage + searchability foundation**: a **real item** is written to `/api/items/issues` with the new
  real columns populated and the `extras` value merged into the `extras` jsonb column; a native
  `filter`/`aggregate` query on a real field returns the item; the `extras` field is confirmed **not**
  server-filterable; and **field-level permissions** gate the real fields.

## DaaS building-block compatibility analysis

Verified against the DaaS docs (core-concepts, roles-policies, scopes) and the repo data layer
(`services/src/{api-request,permissions,daas-context}.ts`, `cli/templates/components/DaaSProviderWrapper.tsx`).

| Building block | Requirement | DaaS reality | Verdict |
|----------------|-------------|--------------|---------|
| `json` field type | store definition body | `json` → PostgreSQL `jsonb`; arbitrary JSON | ✅ |
| User collections / naming | non-system `fb_definitions` | custom collections allowed; `daas_` reserved for system (`daas_users/roles/access`) | ✅ |
| Items CRUD + filters | screen selection by `key`/`target_collection` | `/api/items` with `_eq`/`_in`/`_and`/`_or` | ✅ |
| Field interface meta | baseline rendering | `/api/fields/{collection}` returns `meta.interface` etc. ("drives form renderer") | ✅ |
| Conditions / layout meta | conditional logic, order/width/required | DaaS does **not** advertise persisting these; overlay stores them in our JSON and merges into in-memory `Field.meta` client-side | ✅ (decoupled) |
| `GET /api/permissions/me` | field-level read/write gating | returns per-action `{ fields: [] | ['*'], presets, validation }` + `isAdmin`; consumed as in `CollectionForm` | ✅ |
| Server-side validation rules | surface write constraints | permission `validation` enforced by DaaS; errors surfaced via `parseValidationErrors` | ✅ |
| Admin bypass | full access | admin policy bypasses checks; `isAdmin` already handled | ✅ |
| Scopes (`X-Resource-Uri`) | per-tenant isolation | injected on **direct** DaaS calls by `DaaSProvider` from `daas_resource_uri` cookie | ✅ default path |
| **DDL API (provisioning)** | builder creates target collection + real fields | *"DDL API to create/alter tables"* (overview); `mcp__daas__{fields,collections}` `create` + `add_index` | ✅ first-class |
| **Real-column answer storage** | answers searchable/reportable | `/api/items` `filter` (incl. relational dot-notation), `sort`, `search`, `aggregate`, `groupBy` on real fields (`connect/items`, `connect/filter-rules`) | ✅ native |
| **JSON-internal filtering** | (would be needed for a blob) | **not exposed** — filters target real fields/relations, not json sub-keys (`filter-to-query.ts`) | ❌ → drives the `extras` non-searchable caveat |
| **Field-level permissions** | gate individual answers | roles/policies enforce at **collection + field + row** (*"Fields: which columns are accessible"*, `roles-policies`) — works for real columns, **not** for EAV value-rows | ✅ for real fields |

### Multi-tenancy & scopes (the one area needing explicit handling)
- **Read/write path:** `apiRequest` calls DaaS **directly** and merges headers from `getApiHeadersAsync`
  (`DaaSProviderWrapper` injects `X-Resource-Uri` from the cookie). So scoped reads/writes for both the
  definitions collection and the target collection are partitioned correctly on the default deployment —
  no feature-specific work needed.
- **Proxy caveat:** the shipped Next.js `/api/items` proxy (`getAuthHeaders`) forwards Authorization +
  Content-Type only, **not** `X-Resource-Uri`. A consumer using proxy mode with scope-enabled
  collections must extend the proxy to forward the scope header. Pre-existing repo limitation — document
  as a dependency, do not silently rely on it.
- **Create-time scope:** for a scope-enabled target collection, the new item's scope field (e.g.
  `resource_uri`) must be set on insert. Prefer DaaS **permission presets**; otherwise `DynamicForm`
  passes the active scope URI (from the scope context/cookie) as a create-time default value.
- **Definitions scoping — global baseline + optional per-tenant override (the generic pattern):**
  Principle: *scope the data, share the configuration.* Target-collection items (issues) are scoped
  per their collection config; form definitions are app configuration and default to **global** (root
  scope), so one authored screen works for every tenant out of the box.
  - Default: `fb_definitions` is **non-scope-enabled** → a definition is a global baseline.
  - Upgrade path (no code change): scope-enable `fb_definitions` (with `inheritance_mode: down`) and
    author the baseline at root; a tenant needing a custom screen creates its own at its scope.
  - **Resolution rule — most-specific-scope-wins:** when selecting the screen for a
    `target_collection` (+ optional `key`), `useFormDefinitions`/`DynamicForm` request candidates under
    the active scope (DaaS returns the active scope + inherited ancestors via `X-Resource-Uri` +
    `inheritance_mode: down`), then pick the candidate whose scope is the **nearest ancestor-or-self**
    of the active scope; fall back to the inherited baseline when none exists at the active scope.
  - Avoid per-tenant-by-default: it forces every tenant to build screens before the app works. The only
    case for it is true white-label, where "global template → per-tenant copy" is still usually better.

### Permission boundary for authoring vs. provisioning
- **Arranging existing fields** (using `FormBuilder`) requires: item `create`/`update`/`read` on the
  definitions collection + `read` on the target collection's fields/schema, and (for `extras` fields)
  only item write on the target collection. Gate this on definitions `create`/`update`, not `isAdmin`.
- **Provisioning** (creating the target collection or a new **real** field via the DDL API) requires DaaS
  **schema rights**. Gate the "Create collection" / "Add real field" actions on those rights; when absent,
  fall back to `extras` (no DDL) and surface the requirement. This is now an in-app capability, not just a
  one-time prerequisite.

## Open design decisions
- Default definitions-collection name (`fb_definitions`) and whether to support `key`-based screen
  selection at fill time.
- Section representation: dividers (MVP) vs synthesized group fields (full fidelity).
- Confirm `lib` modules honor `registryDependencies` (precedent: `files-routes` already does).
- **Provisioning depth:** which field types the builder's "Add field" supports out of the box (scalars
  first; relations/M2M and choice-option config in a later pass) and whether to expose `add_index`
  per-field vs. infer it from "this field is filterable".
- **`extras` ergonomics:** whether to later offer a one-click "promote `extras` field → real column"
  (provision the column + backfill from the jsonb) once an author needs to search it. (Moot in a **full**
  collection, which has no `extras`.)
- **Storage strategy is derived, not persisted (resolved).** A collection is "full" iff it has no `extras`
  column; the builder reads this from the live schema rather than storing a flag on `FormDefinition`. The
  full/hybrid switch is exposed only in the **create new collection** flow — existing bindings keep today's
  behavior. `@buildpad/ui-forms` is unreleased, so renaming the default definitions collection to
  `fb_definitions` is a straight rename with no back-compat/dual-lookup path.
