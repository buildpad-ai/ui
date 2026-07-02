# Requirements — Dynamic Form Builder (`@buildpad/ui-forms`)

## Introduction

The buildpad-ui monorepo already ships a complete runtime for schema-driven forms on top of
DaaS: `CollectionForm` (data + permissions + CRUD) → `VForm` → `FormFieldInterface` (40+
interfaces), and `apply-conditions.ts` already evaluates `field.meta.conditions` against live form
values. What is missing is a **design-time form builder**: a way for an admin to visually arrange a
collection's fields, set widths/required, and author conditional rules, then save that as a reusable,
named **form definition** that drives create/edit forms at runtime.

This feature targets a Jira-like project-management use case where the form for an item (an "issue")
must be **dynamic, not hard-coded** — admins configure "screens" (per collection, optionally per
issue-type) without redeploying. A **form definition** (the screen config: which fields, order, width,
sections, conditions) is stored using an **overlay model** — a JSON definition merged onto the live
schema at render time — so multiple named screens can exist per collection without touching the schema.
The module ships the shadcn-registry way as a new buildable package `@buildpad/ui-forms`, mirroring
`@buildpad/ui-files`.

### Data storage — real columns, searchable by default (hybrid or full; not a JSON blob)

The form **definition** (the overlay) is separate from the form **data** (the answers a user fills in).
This feature stores **answers as real, typed DaaS columns by default**, so they are natively searchable,
sortable, aggregatable, relatable, and field-level-permissioned through the Items API — exactly the
ecosystem every other `@buildpad/*` module relies on. Because DaaS exposes a first-class **DDL API**
(create/alter collections & fields, with optional column indexing), the builder can **provision the real
fields it needs on demand** rather than requiring them to be hand-created first. For the rare,
truly-unbounded or display-only tail of fields that never needs to be queried, a single **`extras` jsonb
column** is offered as an opt-in escape hatch — explicitly **not** server-searchable. The system **does
not** store answers as an opaque `data.json` blob, and does **not** use an EAV value-table; see
[`design.md` → Data storage & searchability](./design.md) for the full rationale and the rejected
alternatives.

There are **two storage strategies**, chosen by how the screen's target collection comes to be. Binding a
screen to an **existing** collection uses **hybrid** storage: real columns for the fields that can be
provisioned, plus the single opt-in `extras` jsonb tail. Having the builder **create a new** collection
uses **full** storage: it pre-provisions a set of standard **system fields** (`id`, `status`, `sort`,
`user_created`, `user_updated`, `date_created`, `date_updated`) and then every custom field the author adds
becomes a **real column** — there is **no `extras` column**, so all answers are natively searchable. Both
paths are covered by Requirement 12. Collections the builder creates are named with a configurable prefix
(default `fb_`) so builder-owned tables are recognizable alongside `daas_` system collections.

Out of scope this round: board/kanban, issue list/table, dashboards/widgets/charts, and issue-detail
surfaces. This round delivers the **storage + search foundation** ("form only"); building list/search/
Display UIs over the now-queryable data is a follow-up.

### Glossary
- **Form definition** — a JSON document describing the fields, sections, layout, and conditions for
  one screen of one target collection. This is the screen *config*, not the answers.
- **Form data / answers** — the values an end user fills into a rendered screen. Stored as one **item**
  in the target collection: real columns (default) + an optional `extras` jsonb tail.
- **Overlay merge** — the runtime step that merges a form definition onto the collection's live
  schema `Field[]` to produce the `Field[]` consumed by `VForm`.
- **Definitions collection** — an ordinary, consumer-owned collection (default `fb_definitions`,
  never a `daas_`-prefixed system collection) that stores form definitions as items.
- **Target (entity) collection** — the consumer collection a screen creates/edits items in (e.g.
  `fb_issues`). Holds the answers as real columns, plus an `extras` jsonb column **only** in a hybrid
  collection.
- **Storage strategy** — a property of the target collection: **hybrid** (real columns + an opt-in
  `extras` jsonb tail; the strategy used when a screen binds to an existing collection) or **full** (real
  columns only, no `extras` tail; the strategy used when the builder creates a new collection). Derived
  from whether the collection has an `extras` column — not persisted on the form definition.
- **System fields** — the standard audit columns the builder provisions on a collection it creates:
  `id`, `status`, `sort`, `user_created`, `user_updated`, `date_created`, `date_updated`.
- **Builder collection prefix** — a configurable prefix (default `fb_`) applied to **every** builder-owned
  collection name (the definitions collection and any target collection the builder creates), so they are
  distinguishable from hand-created and `daas_` system collections. Auto-applied on creation, never
  double-applied, never `daas_`.
- **Real field** — a provisioned DaaS column. Searchable/sortable/aggregatable/relatable and
  field-level-permissioned via the Items API. The **default** store for every form field (and the **only**
  store in a full collection).
- **Extra field** — an opt-in field whose value lives inside the target collection's single `extras`
  **jsonb** column. Available **only** in a hybrid collection. No DDL needed; **not** server-searchable and
  not individually permissioned.
- **Provisioning** — the builder creating a real collection/field via the DaaS **DDL API**
  (`POST /api/collections`, `POST /api/fields/{collection}`), optionally with a column index.

---

## Requirement 1 — Build and arrange a form layout

**User story:** As an admin, I want to visually select and arrange a collection's fields into ordered
sections with per-field width and required settings, so that I can compose a tailored create/edit
screen without writing code.

#### Acceptance Criteria
1. WHEN the builder is opened for a target collection THE SYSTEM SHALL load that collection's field
   schema via `FieldsService.readAll` and present the palette as two draggable groups filterable by a
   search box: (i) a **field-type catalog** — one chip per provisionable interface, grouped by category
   (Text / Rich content / Selection / Numeric & date / Geospatial) from the shared catalog (Requirement
   10.2a), each with an icon and label — and (ii) the collection's **unplaced existing fields**.
1a. WHERE no target collection is bound yet (the auto-create flow, Requirement 12.1a) THE SYSTEM SHALL
   still show the field-type catalog and seed the existing-fields group with the **full-storage system
   fields** the new collection will have (`fullBaselineFields()` — `status` plus the hidden audit fields),
   so the author can see and place available fields before the collection exists.
2. WHEN an admin drags (or clicks) an **existing field** from the palette THE SYSTEM SHALL place it into a
   section — at the drop position when dragged, or appended to the last section when clicked — and remove
   it from the palette.
2a. WHEN an admin drags a **field-type catalog chip** onto the canvas THE SYSTEM SHALL prompt for the new
   field's **column name only** (its type and interface come from the chip), place it at the drop position,
   and **lock that column name thereafter** (DaaS columns are not renamable). The chip stays in the catalog
   for reuse. The field's real column is provisioned per Requirement 10; because provisioning is deferred,
   it is created on **Save** (Requirement 10.7). The advanced **"Add field"** flow (Requirement 10) remains
   available for choosing `extras` storage or a B-tree index.
3. WHEN an admin reorders fields or sections THE SYSTEM SHALL persist the new order in the definition.
4. WHEN an admin sets a field's width THE SYSTEM SHALL constrain it to `half` or `full`.
5. WHEN an admin toggles a field's `required`, `readonly`, or `hidden` setting THE SYSTEM SHALL record
   the override on that field's config.
6. WHERE a field has no explicit label override THE SYSTEM SHALL use the field's schema display name.
6a. WHEN a field created from the catalog is selected THE SYSTEM SHALL let the admin edit its **label** and,
   for a **choice interface** (`select-dropdown`/`select-radio`/`select-multiple-checkbox`/
   `select-multiple-dropdown`), its **choices**, in the settings panel; its **column name stays read-only**
   (Requirement 1.2a). Choices SHALL be captured before the field is provisioned on Save.
7. THE SYSTEM SHALL allow creating, renaming, and removing sections within a definition.

## Requirement 2 — Author conditional logic

**User story:** As an admin, I want to define rules that show/hide, require, or make read-only a field
based on the value of another field, so that the form adapts dynamically (e.g. show `severity` only
when `issue_type` is `bug`).

#### Acceptance Criteria
1. WHEN an admin opens the conditions editor for a field THE SYSTEM SHALL allow adding one or more
   conditions, each with a rule and a set of overrides.
2. WHEN an admin builds a condition rule THE SYSTEM SHALL reuse the existing `FilterPanel` to produce
   DaaS-compatible filter JSON (operators such as `_eq`, `_neq`, `_in`, `_and`, `_or`).
3. WHEN an admin sets condition overrides THE SYSTEM SHALL support `hidden`, `required`, and `readonly`
   (and optionally `options` and `clear_hidden_value_on_save`).
4. THE SYSTEM SHALL emit conditions in the exact `FieldCondition[]` shape consumed by
   `apply-conditions.ts` so the runtime applies them without translation.
5. WHEN multiple conditions on a field match THE SYSTEM SHALL preserve DaaS precedence (last matching
   condition wins).

## Requirement 3 — Persist definitions without a system collection

**User story:** As an admin, I want form definitions saved to an ordinary, configurable collection,
so that the platform schema is not mutated and no `daas_`/system collection is introduced.

#### Acceptance Criteria
1. THE SYSTEM SHALL store each form definition as a single JSON item in a definitions collection whose
   name is configurable and defaults to `fb_definitions` (carrying the builder collection prefix, see
   Requirement 12).
2. THE SYSTEM SHALL NOT use a `daas_`-prefixed name and SHALL NOT require a platform/system collection.
3. WHEN an admin saves a definition THE SYSTEM SHALL create or update it via the generic
   `/api/items/{collection}` and `/api/items/{collection}/{id}` proxy routes (definition persistence
   needs no new routes; field/collection *provisioning* uses the DDL routes added by Requirement 10).
4. THE SYSTEM SHALL support multiple named definitions ("screens") per target collection.
5. WHERE a definition declares an optional `key` THE SYSTEM SHALL allow selecting the matching screen
   at fill time (e.g. by `issue_type`).
6. IF the definitions collection does not exist THEN THE SYSTEM SHALL surface an empty-state hint
   describing the required collection and fields rather than failing silently.

## Requirement 4 — Render a definition at runtime

**User story:** As an end user, I want the create/edit form to render exactly as the admin configured
it, with conditions applied live, so that I fill in the correct, context-appropriate fields.

#### Acceptance Criteria
1. WHEN a definition is rendered THE SYSTEM SHALL merge it onto the collection's live schema `Field[]`
   via `buildFieldsFromDefinition`, applying order, width, group/section, and the per-field overrides.
2. THE SYSTEM SHALL pass the merged `Field[]` to the existing `CollectionForm`/`VForm` so all existing
   rendering, validation, M2M handling, and condition evaluation are reused unchanged.
3. WHEN a field's value changes THE SYSTEM SHALL re-evaluate conditions and update visibility/required/
   readonly accordingly.
4. WHEN the form is submitted THE SYSTEM SHALL create or update **one item** in the target collection
   via `ItemsService`, **splitting** values by storage: real-column fields are written to their columns
   (as today, incl. M2M handling); `extras` fields are merged into the item's single `extras` jsonb
   column. On read, `extras` is flattened back into form values. (See Requirement 11.)
5. THE SYSTEM SHALL only include fields declared by the definition (others are omitted from the form).

## Requirement 5 — Respect permissions

**User story:** As a security-conscious operator, I want the configured form to still honor DaaS
permissions, so that users cannot read or write fields they lack access to.

#### Acceptance Criteria
1. THE SYSTEM SHALL reuse `CollectionForm`'s existing permission enforcement (`PermissionsService`)
   for create/update/delete and field-level read/write.
2. IF a user lacks read access to a field THEN THE SYSTEM SHALL omit that field even when the
   definition includes it.
3. IF a user lacks write access to a field THEN THE SYSTEM SHALL render it read-only.
4. IF a user lacks create/update permission for the target collection THEN THE SYSTEM SHALL disable
   submission.

## Requirement 6 — Live preview

**User story:** As an admin, I want a live preview of the form while I build it, so that I can verify
layout and conditional behavior before saving.

#### Acceptance Criteria
1. WHILE editing a definition THE SYSTEM SHALL render a live preview using the runtime renderer against
   empty values.
1a. WHERE a target collection is bound THE SYSTEM SHALL preview via `CollectionForm` (real schema +
   permissions); WHERE none is bound yet (auto-create flow) THE SYSTEM SHALL render an **offline** preview
   of the in-memory fields via `VForm` + `buildFieldsFromDefinition` (no data load, persistence, or
   permission checks) so the preview works before the first save.
2. WHEN the admin changes layout or conditions THE SYSTEM SHALL update the preview accordingly.
3. WHEN the admin changes a value in the preview THE SYSTEM SHALL evaluate conditions so conditional
   behavior is visible (in both the bound and offline preview modes).

## Requirement 7 — Ship as a registry package

**User story:** As a consumer-app developer, I want to scaffold the form builder via the CLI the same
way as other modules, so that the source is copied into my app and I own it.

#### Acceptance Criteria
1. THE SYSTEM SHALL provide a new buildable package `@buildpad/ui-forms` mirroring `@buildpad/ui-files`
   (tsup build, storybook, peer deps), versioned in lockstep with the other `@buildpad/*` packages.
2. THE SYSTEM SHALL register `@buildpad/ui-forms` in `scripts/build-registry.mjs`
   (`PACKAGE_FOLDERS` + `inferSourcePackage`).
3. THE SYSTEM SHALL add a `form-builder` component entry mapping `ui-forms/src/*` to
   `components/ui/form-builder/*`, with `registryDependencies` on `collection-form` and `filter-panel`.
4. THE SYSTEM SHALL add a `forms-routes` lib module with the page templates, depending on
   `api-routes`, `hooks`, and the `form-builder` component.
5. WHEN `pnpm build:registry` runs THEN `pnpm registry:check` SHALL pass with `form-builder` in
   components, `forms-routes` in lib, and `@buildpad/ui-forms` in packages.
6. WHEN a consumer runs `buildpad add form-builder` THEN the source SHALL be copied to the targets and
   `@buildpad/*` imports SHALL be rewritten to the consumer aliases.

## Requirement 8 — Provide scaffoldable routes

**User story:** As a consumer-app developer, I want ready-made pages for managing and using form
definitions, so that I get a working `/forms` experience out of the box.

#### Acceptance Criteria
1. THE SYSTEM SHALL provide a forms list page, a new-definition page, an edit page
   (`<FormBuilder/>`), and a fill page (`<DynamicForm/>`).
2. THE SYSTEM SHALL install these under the `(authenticated)` route group so DaaS provider and
   permission context are present.
3. WHEN a definition is selected to fill THE SYSTEM SHALL create a real item in the target collection.

## Requirement 9 — Multi-tenant scope compatibility

**User story:** As an operator of a multi-tenant app, I want the builder and the rendered forms to
respect DaaS scopes, so that definitions and created items land in the correct tenant scope.

#### Acceptance Criteria
1. WHERE the deployment uses scopes THE SYSTEM SHALL convey the active scope to DaaS via the
   `X-Resource-Uri` header on data requests (reusing the existing `DaaSProvider`/`DaaSProviderWrapper`
   header injection from the `daas_resource_uri` cookie).
2. IF the target collection is scope-enabled THEN THE SYSTEM SHALL ensure the active scope URI is set
   on item creation — either via DaaS permission presets or by passing the active scope as a
   create-time default value.
3. THE SYSTEM SHALL follow a **global-baseline + optional per-tenant-override** model for definitions:
   1. By default the definitions collection is non-scope-enabled, so a definition authored once is a
      global baseline shared by all tenants (config is shared; only target-collection *data* is scoped).
   2. WHERE a consumer scope-enables the definitions collection THE SYSTEM SHALL resolve the screen for
      a given `target_collection`/`key` by **most-specific-scope-wins**: a definition at the active
      scope overrides one inherited from a parent/root scope; if none exists at the active scope the
      inherited baseline is used.
   3. THE SYSTEM SHALL function transparently in both modes without code changes (the scope is conveyed
      by `X-Resource-Uri`; resolution is a sort/pick over the returned candidates).
4. WHERE a consumer routes data through the Next.js `/api/items` proxy instead of direct DaaS calls
   THE SYSTEM SHALL document that the proxy must forward the `X-Resource-Uri` header for scoped
   collections (a pre-existing repo limitation, not introduced by this feature).

## Requirement 10 — Provision fields and collections (DDL)

**User story:** As an admin, I want to create new fields (and, when needed, the target collection itself)
directly from the builder, so that I can compose a screen without leaving to hand-craft the schema first.

#### Acceptance Criteria
1. WHERE the target collection does not exist THE SYSTEM SHALL offer to **create it** via the DaaS DDL
   API (`POST /api/collections`), replacing today's manual prerequisite (Requirement 3.6 empty-state hint
   becomes actionable). This is the **hybrid** baseline (a primary `id` + a single `extras` jsonb column);
   the **full** baseline (audit system fields, no `extras`) is covered by Requirement 12. In either case
   the created collection's name is auto-prefixed with the builder collection prefix (default `fb_`,
   Requirement 12.7).
2. WHEN an admin creates a new **real** field THE SYSTEM SHALL provision it via the DDL API
   (`POST /api/fields/{collection}`), mapping the chosen type/interface/options to the DaaS `Field` shape
   (`type` + `schema.data_type` + `meta.interface`), and SHALL offer to **index** it (`add_index: true`)
   when it will be filtered or sorted.
2a. THE SYSTEM SHALL offer, for the new field's interface, a **type-filtered** list of the **provisionable
   scalar/selection interfaces** of `@buildpad/ui-interfaces`: only interfaces whose `types` include the
   selected field type are shown (mirroring how the DaaS data-model UI filters interfaces), plus an
   *Auto (from type)* default. WHEN the field type changes such that the chosen interface is no longer
   compatible THE SYSTEM SHALL reset the interface to *Auto*. The list is sourced from a shared catalog
   (`@buildpad/utils` `provisionableInterfacesForType`) whose interface ids are the **renderer-recognized**
   ids (from `field-interface-mapper`) and whose per-type compatibility mirrors `registry.json`. The catalog
   offers **every scalar/selection/rich-content/geospatial interface** of `@buildpad/ui-interfaces`; the
   interfaces that need extra rendering libraries — rich text (`@mantine/tiptap`+`@tiptap/*`), block editor
   (`@editorjs/*`), and map (`maplibre-gl`+`@mapbox/mapbox-gl-draw`) — are declared as **peer dependencies of
   `@buildpad/ui-forms`** (optional in `peerDependenciesMeta`, and also delivered per-interface through the
   registry), so a scaffolded consumer can render them. Excluded are relational (m2o/o2m/m2m/m2a), file, and
   group/presentation interfaces (they need relations/junctions or store no value, so are not provisionable
   as a single column; a later pass).
3. WHEN an admin marks a new field as an **`extras`** field THE SYSTEM SHALL NOT call the DDL API; its
   value is stored in the target collection's `extras` jsonb column and its descriptor
   (`type`/`interface`/`label`/`options`) is carried in the form definition JSON.
4. THE SYSTEM SHALL permission-gate real-field/collection provisioning on DaaS **schema rights**;
   `extras` fields require only item write permission on the target collection.
5. THE SYSTEM SHALL treat provisioning as **additive** — authoring SHALL NOT alter or drop existing
   fields or their data.
6. IF a DDL call fails (insufficient rights, name conflict, invalid spec) THEN THE SYSTEM SHALL surface
   the error to the admin without losing in-progress definition state.
7. THE SYSTEM SHALL **defer provisioning** of fields created from the catalog until **Save** — for both the
   auto-create flow and screens bound to an existing collection — holding each new field's `FieldSpec` and
   rendering it locally (a synthesized `Field`) meanwhile. On Save THE SYSTEM SHALL `createField` each
   still-placed pending spec in canvas order, and SHALL block the save with a clear message if a pending
   choice field has no choices or a pending column name is invalid or duplicates an existing column.

## Requirement 11 — Data storage & searchability (hybrid + full)

**User story:** As an operator, I want form answers stored so they are easily searchable and reportable
across the buildpad ecosystem, so that lists, filters, dashboards, and integrations work natively.

#### Acceptance Criteria
1. THE SYSTEM SHALL store each form field's value as a **real typed column** in the target collection by
   default (`store: 'column'`).
2. THE SYSTEM SHALL make real-column answers queryable via the existing Items API — `filter` (incl.
   relational dot-notation), `sort`, `search`, `aggregate`, `groupBy`, pagination, and
   `meta.total_count/filter_count` — with **no** custom search index and **no** EAV value-table.
3. WHERE a field is `store: 'extras'` THE SYSTEM SHALL store its value in the target collection's single
   `extras` jsonb column AND SHALL inform the author that such values are **not** server-searchable,
   -sortable, or -aggregatable (only coarse `search`/client-side) and are not individually
   field-permissioned.
4. THE SYSTEM SHALL default every field to `'column'` and require an explicit opt-in for `'extras'`.
5. THE SYSTEM SHALL NOT store the full set of answers as a single opaque blob, and SHALL NOT use an
   entity-attribute-value (EAV) value table.
6. WHERE a Project → Issue/Case/Request-style hierarchy is modeled THE SYSTEM SHALL use real DaaS
   **relations** (e.g. an M2O `parent` + a `type` discriminator), so the hierarchy is filterable via
   dot-notation rather than nested in a blob.
7. WHERE the target collection is created by the builder in **full** storage (Requirement 12) THE SYSTEM
   SHALL NOT add an `extras` column; every field is therefore a real, searchable column and the `extras`
   opt-in is unavailable for that collection. (Hybrid — criteria 1–6 — remains the strategy for collections
   that have an `extras` column, i.e. existing collections the screen binds to.)

## Requirement 12 — Full data storage via a builder-created collection

**User story:** As an admin, I want to spin up a brand-new collection for my screen (instead of binding to
an existing one), pre-provisioned with standard system fields and with every custom field as a real
physical column, so that all answers are natively searchable with no `extras` tail to reason about.

#### Acceptance Criteria
1. WHEN starting a new screen THE SYSTEM SHALL make choosing a target collection **optional** and offer two
   paths: **Start building** — begin authoring immediately with no collection bound (the default when the
   admin has schema rights), OR **bind to an existing** target collection (hybrid). Binding to an existing
   collection is the only path when schema rights are absent.
1a. WHERE no target collection is bound (the **Start building** path) THE SYSTEM SHALL, on the **first save**,
   auto-**create a new** collection with **full** data storage (deriving the collection name from the screen
   name), provision every field the admin added as a real column, then persist the definition against it —
   so the admin never has to name or create the collection up front. Real-column fields added before the
   collection exists are held and provisioned at this point (deferred provisioning).
2. WHERE a new collection is created (auto on save, or explicitly) THE SYSTEM SHALL provision it via the DDL
   API (`POST /api/collections`) pre-seeded with the standard **system fields**: `id` (uuid primary key),
   `status`, `sort`, `user_created`, `user_updated`, `date_created`, `date_updated`, and MAY collect an
   optional note/icon.
3. A **full** collection SHALL NOT include an `extras` jsonb column; every field the admin subsequently
   adds SHALL be provisioned as a real column (`store: 'column'`), and the `extras` opt-in SHALL be
   unavailable for that collection (see Requirement 11.7).
4. WHERE the admin **binds to an existing** collection THE SYSTEM SHALL retain today's **hybrid** behavior
   (real columns + the `extras` opt-in when the collection has an `extras` column).
5. WHEN a new collection is created THE SYSTEM SHALL set it as the screen's `target_collection` and open
   the builder as usual.
6. THE SYSTEM SHALL permission-gate new-collection creation on DaaS **schema rights** (per Requirement
   10.4) and SHALL hide/disable the **Start building** (auto-create) path when those rights are absent,
   leaving **bind to an existing** collection as the only path.
7. WHEN the builder creates any collection (this full path or the Requirement 10.1 hybrid path) THE SYSTEM
   SHALL auto-apply the configurable **builder collection prefix** (default `fb_`) to the collection name —
   never double-prefixing an already-prefixed name and never producing a `daas_` name. Binding to an
   **existing** collection SHALL NOT rename it.

## Design considerations — modeling a Jira-like product

A Jira-like product models an `Issue { project, title, type, … }` where each issue's `type` selects a
different **screen** (a curated set of fields), and the issue's data must be **searchable** — which is
why a single `Issue.data` JSON blob (or an EAV value-table + external search index, as classic engines
use) is inadequate on this platform. This spec adopts that product model and resolves the storage:

| Concept | This design |
|---------|-------------|
| Screen definition (fields/order/layout/conditions) | `FormDefinition` overlay in `fb_definitions`. |
| Screen selector ("which form") | the definition `id` (+ optional `key`). |
| Issue `type` → a different screen | multiple named screens per collection, picked by `key`. |
| The answers ("issue data") | **real columns** (searchable). **Hybrid** (existing collection) adds an opt-in `extras` jsonb tail; **full** (builder-created collection) has none — every field is a column. Never a single blob. |
| Where a screen's collection comes from | bind to an **existing** collection (hybrid) or have the builder **create a new** one with standard system fields (full). Builder-created collections are `fb_`-prefixed. |
| Making answers searchable | native Items `filter`/`search`/`aggregate` on real columns provisioned via the **DDL API** — not an EAV value-table + external index. DaaS already *is* the managed schema/permission/search layer those patterns reach for. |

Rationale and the rejected alternatives (blob → EAV → JSONB → real columns → hybrid) are recorded in
[`design.md` → Data storage & searchability](./design.md).

## Non-functional / compatibility constraints (verified against DaaS docs)
- Form **definitions** are stored in a `json` (jsonb) field of a user-created collection; no `daas_`/system
  collection. Authoring may **additively** create the target collection and its fields via the managed DDL
  API, but never mutates or drops existing fields' data.
- Field-level permissions are read from `GET /api/permissions/me`, whose per-action shape is
  `{ fields: string[] | ['*'], presets, validation }` plus `isAdmin` — consumed exactly as
  `CollectionForm` already does.
- Conditions/order/width/required live in the definition JSON and are merged client-side; the feature
  does **not** depend on DaaS persisting `meta.conditions` or layout metadata.
- **Arranging existing fields** requires only item CRUD on the definitions collection + read on the
  target collection's schema/fields. **Provisioning new real fields/collections** (Requirement 10) needs
  DaaS **schema rights** and is permission-gated accordingly; authoring with `extras`-only fields needs no
  DDL. Answers default to **real typed columns** and are queryable via the Items API (`filter`/`sort`/
  `search`/`aggregate`/`groupBy`) — no JSON-internal filtering is required or relied upon.
- **Full data storage** (Requirement 12) is a collection-creation option: a builder-created collection is
  seeded with the standard audit **system fields** and **no `extras` column**, so every field is a real,
  searchable column. Every collection the builder creates — the definitions collection (`fb_definitions`)
  and target collections alike — carries the configurable `fb_` prefix; existing collections a screen binds
  to are never renamed.
