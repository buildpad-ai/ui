# @buildpad/ui-forms

Dynamic Form Builder for Buildpad projects — a **design-time authoring layer**
(`FormBuilder`) plus a **runtime renderer** (`DynamicForm`) on top of the
existing schema-driven form runtime (`CollectionForm` → `VForm`).

Admins visually arrange a collection's fields into ordered sections, set
widths / required / readonly / hidden, and author conditional logic, then save
the result as a reusable, named **form definition**. Definitions are stored as
JSON items in an ordinary, consumer-owned collection and merged onto the live
schema at render time via `buildFieldsFromDefinition` — **the schema is never
mutated**.

## Prerequisite: the definitions collection

Form definitions are persisted as items in a single collection (default
**`fb_definitions`**). It is an ordinary user collection — **not** a
`daas_`-prefixed system collection — and must be created once via the Data Model
editor (or the DDL API) before the builder can save:

| field              | type              | notes                                   |
| ------------------ | ----------------- | --------------------------------------- |
| `id`               | uuid (PK)         | auto                                    |
| `name`             | string            | screen name                             |
| `target_collection`| string            | collection the screen targets           |
| `key`              | string (nullable) | optional screen discriminator           |
| `definition`       | json              | the `FormDefinition` body               |

If the collection is missing, the builder and the forms list render a
`FormsEmptyState` hint describing exactly this, rather than failing silently.
With DaaS **schema rights**, that hint also offers a one-click **Create
collection** action (`CollectionsService.createCollection`) so you never have to
leave the app.

Authoring (arranging existing fields) requires item `create`/`update`/`read` on
the definitions collection plus `read` on the target collection's schema —
**not** admin/DDL rights. Only **provisioning** (creating the definitions or
target collection, or a new real field) needs schema rights; see
[Data storage & searchability](#data-storage--searchability).

## Components

| Export                | Purpose                                                        |
| --------------------- | ------------------------------------------------------------- |
| `FormBuilder`         | Three-pane authoring UI (palette / canvas / settings) + preview |
| `DynamicForm`         | Runtime renderer — loads a definition by id and renders it     |
| `FormPreview`         | Live preview of an in-memory (unsaved) definition             |
| `ConditionsEditor`    | Author `FieldCondition[]` (reuses `FilterPanel` for rules)     |
| `FieldSettingsPanel`  | Width / required / readonly / hidden / note for a field        |
| `FieldPalette`, `BuilderCanvas`, `BuilderSection`, `BuilderFieldRow` | Builder building blocks |
| `AddFieldModal`       | "Add field" flow — provision a real column or an `extras` field |
| `FormsEmptyState`     | Prerequisite-collection hint (+ in-app **Create collection**)  |

## Usage

```tsx
// Build / edit a screen
<FormBuilder targetCollection="issues" onSaved={(def) => router.push(`/forms/${def.id}`)} />
<FormBuilder definitionId={id} />            // edit: target collection comes from the definition

// Render a saved screen as a create/edit form
<DynamicForm definitionId={id} onSuccess={() => router.push('/issues')} />
<DynamicForm definitionId={id} itemId={issueId} />   // edit mode
```

## Conditions

`ConditionsEditor` emits the exact `FieldCondition[]` shape consumed by
`apply-conditions.ts`, so conditions evaluate at runtime without translation.
When multiple conditions match, the **last** matching one wins (DaaS
convention). Rules are built with `FilterPanel`, producing DaaS-compatible
filter JSON (`_eq`, `_neq`, `_in`, `_and`, `_or`, …).

## Data storage & searchability

The form **definition** (the overlay JSON) is config; the form **data** (the
answers users fill in) is what you later search and report on. This module stores
answers as **real, typed DaaS columns by default** — so they are natively
searchable, sortable, aggregatable, relatable, and field-level-permissioned
through the Items API — with a single opt-in **`extras` jsonb** column as the
escape hatch for the rare non-searchable tail. There is **no** opaque `data.json`
blob and **no** EAV value-table.

### Two storage strategies: hybrid vs full

How answers are stored depends on **how the screen's target collection comes to
be** (chosen on the *New screen* page):

- **Use existing collection → hybrid.** Bind to a collection you already have —
  real columns for the fields you provision, plus the single opt-in `extras`
  jsonb tail for the non-searchable remainder.
- **Create new collection → full.** The builder provisions a brand-new collection
  seeded with standard audit **system fields** (`id`, `status`, `sort`,
  `user_created`, `user_updated`, `date_created`, `date_updated`) and **no**
  `extras` column — so every field is a real, searchable column. Needs DaaS
  schema rights.

The builder **derives** the strategy from the live schema: a collection is *full*
iff it has no `extras` column, and the **Add field** flow then offers *Real
column* only (the `extras` opt-in is hidden). Nothing extra is persisted on the
`FormDefinition`.

**Naming convention.** Every collection the builder *creates* — the
`fb_definitions` store and any target collection — is named with a configurable
`fb_` prefix (`CollectionsService.createCollection` applies it via
`normalizeCollectionName`; idempotent, never `daas_`), so builder-owned tables
stand out. Existing collections you bind to are never renamed.

### Storage per field

Every field carries `store: 'column' | 'extras'` (default `'column'`). In the
builder's **Add field** flow (`AddFieldModal`) you pick the storage:

- **Real column** (default, searchable). Provisioned on demand via the DDL API
  (`FieldsService.createField` → `POST /api/fields/{collection}`), mapping your
  type/interface/options to the DaaS `Field` shape. Tick **Index this column**
  (`add_index: true`) for fields you'll filter or sort on. Needs schema rights.
- **Extra** (jsonb, no DDL). The value lives in the target collection's single
  `extras` jsonb column and its descriptor (`type`/`interface`/`label`/`options`)
  is carried inline in the definition. Needs only item write — **but** such
  values are **not** server-searchable, -sortable, or -aggregatable and are not
  individually field-permissioned.

At render time `buildFieldsFromDefinition` synthesizes a `Field` for each
`extras` descriptor and stamps `meta.store`, and `CollectionForm` splits the save
by storage: real columns are written as today; `extras` values are merged into
the one `extras` jsonb column (and flattened back into form values on load).

> **Rule of thumb:** *if you'll ever search/filter/sort/aggregate on it, keep it
> a real column.* Reach for `extras` only for the unbounded or display-only tail
> that never needs querying.

### The searchable query surface (no custom code)

Because real-column answers are ordinary DaaS columns, the **existing Items API
is the search layer** — `ItemsService.readByQuery(...)` already speaks it:

- `filter` — 20+ operators (`_eq`, `_neq`, `_in`, `_contains`, `_between`,
  `_regex`, …) **incl. relational dot-notation** (`filter[parent.type][_eq]=…`)
- `sort` (`-created_at`), `search` (substring across string columns)
- `aggregate` (count/sum/avg/min/max) and `groupBy` for reporting
- `limit`/`offset`/`page` and `meta.total_count` / `meta.filter_count`

`extras` fields are excluded from all of the above (the Items API does not expose
JSON-internal operators) — only coarse `search` / client-side filtering reach
them.

### Modeling a Project → Issue/Case/Request hierarchy

Model hierarchy with **real relations**, not nested blobs, so it stays filterable
via dot-notation:

- An **M2O `parent`** relation (e.g. `issues.project` → `projects`) plus a
  **`type` discriminator** column (e.g. `issue_type` = `bug` | `task` | `story`).
- Pick the screen per `type` with a definition `key` (multiple named screens per
  target collection); the fill page selects the matching screen.
- Query across the hierarchy natively, e.g.
  `filter[project][_eq]=…&filter[issue_type][_eq]=bug`, `sort=-date_created`,
  or `aggregate[count]=*&groupBy[]=issue_type`.

This round delivers the **storage + search foundation** only. Building the
list/table/dashboard UIs over the now-queryable data is a deliberate follow-up
(reuse `@buildpad/ui-table` + the query surface above).

## Multi-tenancy / scopes

- Data requests reuse the existing `DaaSProvider` header injection, so scoped
  reads/writes are partitioned by `X-Resource-Uri` from the `daas_resource_uri`
  cookie automatically on the default (direct) deployment.
- For a scope-enabled **target** collection, `DynamicForm` passes the active
  scope URI as a create-time default (`scopeField`, default `resource_uri`)
  unless DaaS permission presets already inject it.
- **Definitions** follow a *global-baseline + optional per-tenant-override*
  model: by default `fb_definitions` is non-scope-enabled (one global screen
  for all tenants). If you scope-enable it, `useFormDefinitions.resolveScreen`
  picks the **nearest-ancestor-or-self** definition for the active scope.
- **Proxy caveat:** the shipped Next.js `/api/items` proxy forwards only
  `Authorization` + `Content-Type`. A consumer using proxy mode with
  scope-enabled collections must extend the proxy to forward `X-Resource-Uri`
  (a pre-existing repo limitation, not introduced by this feature).

## Scaffolding

```bash
buildpad add form-builder      # component → components/ui/form-builder
buildpad add forms-routes      # /forms pages (list / new / edit / fill)
```

### Live end-to-end validation

An automated harness exercises the whole storage + searchability foundation
against a real DaaS instance — it provisions throwaway `fb_zz_e2e_*` collections,
creates a real indexed field + an `extras` field, saves a definition, writes an
item, asserts real-column `filter`/`filter_count` returns it while the `extras`
sub-key is **not** server-filterable, provisions a **full**-storage collection
(`strategy:'full'`) and asserts it has the audit system fields, **no** `extras`,
and every field server-filterable, then drops the throwaway collections:

```bash
DAAS_URL="https://<id>.daas4.buildpad.ai" DAAS_TOKEN="<static-token>" \
  pnpm --filter @buildpad/ui-forms test:e2e
```

The token needs DaaS schema rights (provisioning is DDL). Source:
[`scripts/e2e-daas.mts`](./scripts/e2e-daas.mts).

Provisioning (create field/collection) uses the DaaS DDL API. On the default
**direct** deployment the browser calls DaaS directly, so no extra routes are
needed. Consumers running in **proxy** mode get the write proxies from the
`api-routes` module — `POST /api/fields/[collection]`,
`PATCH`/`DELETE /api/fields/[collection]/[field]`, and
`POST`/`DELETE /api/collections[/…]` — which forward auth headers like the other
proxies and require DaaS schema rights.
