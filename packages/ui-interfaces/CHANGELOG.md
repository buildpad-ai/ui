# @buildpad/ui-interfaces

## 2.2.0

### Patch Changes

- Updated dependencies [2b199c9]
  - @buildpad/hooks@2.2.0
  - @buildpad/ui-collections@2.2.0
  - @buildpad/services@2.2.0
  - @buildpad/types@2.2.0
  - @buildpad/ui-form@2.2.0
  - @buildpad/utils@2.2.0

## 2.1.0

### Patch Changes

- Updated dependencies [02324ef]
  - @buildpad/ui-collections@2.1.0
  - @buildpad/hooks@2.1.0
  - @buildpad/services@2.1.0
  - @buildpad/types@2.1.0
  - @buildpad/ui-form@2.1.0
  - @buildpad/utils@2.1.0

## 2.0.0

### Patch Changes

- @buildpad/hooks@2.0.0
- @buildpad/services@2.0.0
- @buildpad/types@2.0.0
- @buildpad/ui-collections@2.0.0
- @buildpad/ui-form@2.0.0
- @buildpad/utils@2.0.0

## 1.11.1

### Patch Changes

- 585362e: Batch of low/medium audit fixes across the relational stack.

  - All four relation item hooks (M2A, M2O, MultipleM2M, O2M) guard loadItems with a per-call request id, so an out-of-order response from a superseded call can no longer overwrite state with stale data.
  - ListO2M: editing a staged-created ($temp\_) row merges into its changeset.create entry instead of staging an update the backend can't resolve.
  - ListM2MInterface: the render-prop placeholder resolves {{field}} templates via the shared renderTemplate instead of printing the raw template string.
  - useRelationM2MItems requests the resolved junction PK field instead of a literal "id".
  - field-interface-mapper reads M2A allowed collections from snake_case `allowed_collections` (real DaaS storage) with camelCase fallback.
  - CollectionForm passes the loaded item's initial data (not schema defaults) as VForm initialValues.
  - ListM2M: header comment now documents that only junction-level operations are local-first; related-item edits persist immediately.

- 6d724ee: Selection quick-wins across Radio, CheckboxTree, Icon, MultiDropdown, Checkbox, and the form pipeline.

  - SelectMultipleCheckboxTree: search queries containing regex special characters no longer crash the field; label ids use useId() instead of Math.random() (SSR hydration); per-node disabled flag.
  - SelectMultipleCheckbox: per-option disabled flag; the allowOther swatch detects hex/rgb/hsl colors and styles via color-mix instead of producing invalid var(--mantine-color-...) names.
  - SelectMultipleDropdown: clearable is no longer gated behind allowNone; the selection-order sort copies Mantine's array instead of mutating it; aria-label is forwardable.
  - SelectRadio: the "Other" option stays checked while its input is open before any text is typed; aria-label is forwardable.
  - SelectIcon: formatTitle/renderIcon guard non-string values instead of throwing; aria-label forwarded to the trigger when no visible label is set.
  - FormFieldInterface forwards readonly state as the camelCase readOnly prop the interfaces actually consume.

- 565448a: Modal CollectionForm submits stay contained, and ListO2M's Create New no longer pre-fills the '+' placeholder as the child's FK.

  - CollectionForm's submit handler now stops propagation: callers render it inside a portaled Mantine Modal, and React bubbles the synthetic submit along the component tree — so saving the inner form also submitted an ancestor page form with its stale changeset.
  - ListO2M only pre-fills the reverse FK default when the parent is actually saved; for an unsaved parent ('+' placeholder) the link is staged into the changeset on save, as before — but the literal "+" no longer leaks into the created child's FK field.

- b8b5344: CollectionItemDropdown and SelectDropdownM2OInterface no longer corrupt numeric/non-`id` primary keys.

  - CollectionItemDropdown's Combobox path stringified the selected key (Mantine's `onOptionSubmit` value), so numeric PKs were emitted as strings and lost their `active` highlight. `onOptionSubmit` now resolves the submitted string back to the matching item's raw key.
  - The free-text collection input cleared the current item selection on every keystroke (`onChange` fired `handleCollectionSelect` per character). It now only commits — and clears the selection — when the typed value exactly matches an available collection, or on blur.
  - SelectDropdownM2OInterface hardcoded `.id` to read the current value, so a related collection with a non-`id` PK (e.g. a slug) always showed "No item selected" despite a value being set. It now resolves the PK via `relationInfo.relatedPrimaryKeyField`, falling back to `id`. A primitive value is also now wrapped under the resolved PK field before being handed to `renderSelectedItem`, instead of being cast as an item object as-is.

- a22729a: CollectionItemDropdown's value prop type matches the shapes its normalization already handles.

  The prop was declared as CollectionItemDropdownValue | null only, but the component accepts raw string/number keys, JSON strings, and resolved item objects at runtime. Under stricter consumer tsconfigs (e.g. buildpad-daas) the mismatch narrowed string checks to never and failed the consumer build.

- 50a4057: Concealed and hashed fields: one contract, and the three states told apart correctly.

  DaaS never returns a stored secret. Its read transformer sends a run of asterisks when a value exists, `null` when the column is empty, and omits write-only columns entirely — three states the UI has to distinguish. That rule was re-derived in four places with three different spellings (`/^\*+$/` twice, a truthy-length test that could not tell a mask from a real password, and a hardcoded ten-character literal), so `@buildpad/utils` now owns it: `CONCEALED_PLACEHOLDER`, `isConcealedValue`, `isConcealedField` and `concealingInterface`. The mask is a display only; nothing compares against its width, which the server chooses.

  **`FormFieldInterface`** decides the whole thing in one place, from the field, the resolved interface and the primary key it already receives:

  - An explicit `null` from a `conceal` field passes through. The server distinguishes its own empty state, so re-masking a just-cleared token stranded it as "still set" forever — that is the bug this change set out to fix.
  - A `hash` field keeps its mask on `null`. That path is not the server's: a hash column is never round-tripped on read, so the only producer of `null` is the leaf itself when the user types and then erases. Treating it as "no credential" flipped the padlock open and told the operator the account had no password while the stored hash was untouched.
  - A record that does not exist yet gets no mask. Create forms were showing a closed padlock and "Value securely stored", and users saved accounts with no credential at all.
  - A secret field rendered by a text interface gets no mask either, and is normalised back to `null` rather than `undefined` — a literal row of asterisks in a text box is something the user can submit as their password.

  **`FormField`** forwards the omitted signal for secret fields, and does so _ahead_ of the column default. A DDL default on a secret column is not the secret: taking that branch first rendered the literal default as "Value securely stored" and would have submitted it as the credential.

  **`InputHash`** resets its local value when the incoming value is the mask, not only on `null`/`undefined`. The mask is the steady state for a stored credential, so the old condition could never fire for the case it existed to handle — typed plaintext survived Discard, stayed visible, and was re-submitted on the next save. `isHashed` is also now a string test, so a non-string value cannot silently report "no credential stored".

  **`SystemToken`** accepts and forwards `aria-label`. `FormField` renders the visible label itself and withholds `label` from the leaf, so without this the token input had no accessible name at all — an axe `label` failure on the one field this work is about. Its empty-state placeholder no longer names the Generate control when that control is hidden (disabled or read-only), and says "No token set" instead of rendering a blank box. Clearing a token after generating one now also clears the fresh-token flag, which otherwise left the credential input as `type="text"`.

  **`CollectionForm`** drops concealed values from a Save-as-Copy payload. `formData` holds the server's mask verbatim, so copying a row wrote the literal asterisks into the new row's secret column — a guessable static token, or a password hashed from `**********`.

  The accessible name is now declared _after_ the `meta.options` spread, alongside the lock props, because admin-authored options JSON reaches the leaf unfiltered and an `aria-label` key in it silently erased the name.

  The per-field `data-testid` broadcast is not included. `FormField` already emits `data-field={field.field}` on every field wrapper and the Playwright suite already selects on it, so it duplicated a working hook; being derived from the field name alone it was also not unique once a nested `CollectionForm` was open (ListO2M, ListM2M, and JunctionItemForm which mounts two forms at once). Sub-element ids can be scoped within `[data-field]`.

  Registry: the `vform` component now declares `input-hash` and `system-token`, which `FormFieldInterface` maps but which were missing from its 35 interface dependencies, so `buildpad add vform` produced a form that fell through to "Interface component not found" for both. `input-hash` and `system-token` declare their new `utils` dependency.

- 08127f0: Separate readonly from disabled across the form pipeline (S2.6).

  Readonly and disabled are visually and semantically distinct — readonly means the value is visible but not editable and the control stays focusable and un-greyed; disabled means greyed out and inert. The form pipeline conflated the two, and untangling it needed changes at three layers:

  **`FormField`** computed `isDisabled = disabled || isFieldReadOnly(field, ...)` and passed the result down as `disabled`. Everything `isFieldReadOnly()` reports — `meta.readonly`, auto-increment columns, auto-generated UUID primary keys, generated defaults — is semantically read-only, not disabled, so a readonly field reached the interface as `disabled=true`/`readOnly=false`. That is now routed to `readonly` instead, which is what actually fixes the reported symptom.

  **`FormFieldInterface`** no longer sets `disabled` for a merely-readonly field. It also now suppresses `onChange` for readonly (not just `nonEditable`), drops `required` and `autofocus` on a locked field, and re-asserts the `onChange`/`disabled`/`readOnly` trio _after_ the `meta.options` spread so admin-authored options JSON cannot unlock a locked control. `nonEditable` remains stronger and still sets both.

  **`@buildpad/ui-interfaces`** — because `disabled` is no longer set for readonly fields, each leaf has to honour `readOnly` itself, and many did not. Fixed across `input`, `input-hash`, `input-code`, `file`, `file-image`, `files`, `select-radio`, `select-icon`, `select-multiple-checkbox`, `select-multiple-checkbox-tree`, `select-multiple-dropdown`, `tags`, `color`, `rich-text-html`, `rich-text-md`, `system-token`, `system-permissions`, `workflow-button` and `list-m2a`. Two distinct causes: several leaves had no read-only concept at all, and `input`, `input-hash`, `file`, `file-image` and `files` declared the prop in lowercase (`readonly`) while the form container passes camelCase (`readOnly`), so their existing read-only code was unreachable. Those five now accept either casing. `list-m2a` accepted `readOnly` and discarded it; it now uses the same `isEffectivelyDisabled` flag as `list-m2m` and `list-o2m`.

  Without the leaf changes, dropping `disabled` would have made readonly fields fully editable — including `input-hash` (a stored credential) and `system-token` (a live API token).

- d5c9eee: Autofocus works end to end, and `Input`'s numeric branch stops losing values.

  `FormFieldInterface` forwards `autofocus` to every leaf, but `Input` destructured it only as `_autofocus` and discarded it, so the field never received focus on mount. Wiring it up exposed the rest of the path, which is fixed here too.

  **`Input`** now applies it as Mantine's `autoFocus`, accepting both spellings (`autofocus` from the form pipeline, `autoFocus` for a direct consumer) and comparing strictly — `meta.options` is unvalidated admin JSON, and a truthy string like `"false"` was turning focus on. It is declared _after_ the rest spread, so an `autoFocus` key in that JSON can no longer override or erase the container's decision. The control also carries `data-autofocus` when focused: Mantine's focus trap fires from a `setTimeout` after React's mount focus and targets that marker, so without it the trap pulled focus to the modal close button and the feature was dead inside the O2M/M2M drawers, which is where nested create forms actually live.

  **`FormFieldInterface`** moves `autofocus` and `required` below the `meta.options` spread, alongside the lock props. Both sat above it, so an admin-authored `autofocus: true` on a readonly field defeated "never steal initial focus into a field that cannot be edited" — and a readonly input is still focusable.

  **`VForm`** resolves the field _key_ to focus rather than an index. The old predicate (`!meta.readonly`) was much weaker than the rule enforced downstream by `isFieldReadOnly`, ignored permission-readonly fields, and counted dividers, notices and group headers — so on the commonest schema shape, an auto-increment `id` first, index 0 won, `FormFieldInterface` then zeroed the flag, and nothing in the form was focused. Resolving to a key also lets the group branch forward it, so a form whose fields live inside a section can focus at all; `FormGroupField` passes it to its children.

  **`CollectionForm`** no longer drives VForm's `loading` with `saving`. VForm renders a skeleton while loading, which unmounted every field and remounted them when the save resolved — re-firing mount-time focus and scrolling the user back to that field. `disabled` already blocks input during a save.

  **`Textarea`** accepts `aria-label`, `maxLength` and `autofocus`. It declared none of them and has no rest spread, and since the container renders the visible label itself and withholds `label` from the leaf, every long-text field shipped with no programmatic accessible name at all — an axe `label` violation, and unreachable by role or label queries. Its `max_length` was also silently unenforced.

  Fixed in `Input` while wiring the above, all in the block or object the change touches:

  - The numeric branch passed `undefined` for any non-`number` value. Postgres returns `numeric` and `bigint` as strings, so a stored price rendered as an empty box and saving the untouched form wrote that blank back — and `undefined` puts Mantine's `useUncontrolled` into uncontrolled mode, after which discard and post-save refetch could never correct the field again. The value is now always controlled, and a numeric string passes through intact so trailing zeros such as `10.50` survive.
  - Emptying a number field emitted `""`, which PATCHed a nullable numeric column with an empty string instead of `null`.
  - `trim` and `slug` ran on every keystroke, rewriting the value before the next character arrived: a trimmed field could never contain `"John Doe"` and a slug field could never reach `"hello-w"`. They now run on blur.
  - `clear` overrode the right section that `NumberInput` uses for its increment/decrement controls, removing them and the arrow-key affordance; and `iconRight || clearButton` meant a field with both rendered no clear button. A numeric field is cleared by emptying it, and the text branches now render both.
  - The clear button was gated on a truthy value, so a numeric field holding `0` never offered one.
  - `maxLength` reached `NumberInput`, where it caps the rendered string including thousands separators — a schema limit of 5 allowed only four digits.
  - `collection` and `field` were forwarded to the DOM as real attributes; they are now discarded like the other container metadata, which is what that block exists to do.

- 577eda9: interface-catalog: add the missing `select-multiple-checkbox-tree` entry (S4.4/S8.4).

  `PROVISIONABLE_INTERFACES` had no entry for the checkbox-tree interface even though `select-multiple-checkbox-tree` is a real, resolvable interface id (`field-interface-mapper.ts` already has a `case` for it), `registry.json` already publishes it, and the component already ships from `@buildpad/ui-interfaces`. The catalog is what drives both in-repo pickers — `AddFieldModal` (via `provisionableInterfacesForType`) and `FieldPalette` (via `CATALOG_GROUPS`) — so until now a form author simply could not create a checkbox-tree field. It is also added to `CHOICE_INTERFACES` so the choices editor and the zero-choices save guard (`interfaceRequiresChoices`) treat it like the other choice-authoring interfaces.

  Both halves are new, and two limits are worth knowing rather than rediscovering later:

  - **The builder can only author a flat tree.** `ChoicesInput` is a `label=value` per-line textarea whose `Choice` is `{ text, value }`, while `TreeChoice` carries `children`. A tree field created through the form builder is therefore a single-level list; nested trees still have to come from DaaS-authored or hand-written `meta.options.choices`. `valueCombining` likewise has no editor and stays `'all'`.
  - **`types` mirrors `registry.json`, not the leaf's standalone capability.** That distinction is now documented in the catalog's module docstring.

  Supporting fixes so the new entry is actually sound end to end:

  - **`@buildpad/ui-interfaces`** — `SelectMultipleCheckboxTree` gained the `type` + normalize + re-serialize trio its two multi-select siblings already had. It is registered for `types: ['json', 'csv']` and the registry ships it standalone (`internalDependencies: []`), so a CLI-installed consumer renders it with no pipeline in front of it; a raw comma-string previously produced substring-matched reads via `String.includes`, character-spread writes, and a `TypeError: currentValue.filter is not a function` on the first uncheck. Tokens parsed out of a csv string are also mapped back to the declared choice value's type, so numeric choices on a csv column match instead of silently appending duplicates. A `null` value (the initial state of a nullable column) no longer crashes on mount, and the component now accepts a forwarded `aria-label` instead of announcing every tree field as "Tree selection".
  - **`@buildpad/ui-forms`** — `FormPreview.stories.tsx` had its own stale copy of `CHOICE_INTERFACES`, which would have rendered the new entry as "Choices option configured incorrectly" in the story that exists to prove every catalogued interface renders; it now imports the shared set. `FieldPalette` gained the `IconListTree` mapping `registry.json` already names, instead of falling back to the glyph already used by rich text.
  - **Tests** — the catalog is now pinned against `registry.json` in both directions, so a missing entry or a drifted `types` fails instead of shipping silently; the renderer-resolution check covers every declared type rather than only `types[0]`; and `csv` compatibility, previously unasserted, is now exhaustive.

- c6baa06: ListM2A: inline "Create New" now emits real item data instead of the collection name as the id.

  - The Create New modal's onSave passed JunctionItemForm's whole combined payload into `createItemWithData`, which re-nests its argument under the junction field — so the staged junction value was doubly wrapped and its first key was the collection discriminator. It now passes only the nested related-item fields as `itemData`, with remaining junction-level edits as `additionalData`.
  - The replace-mode payload builder resolved a nested row's id as `nested.id ?? Object.values(nested)[0]`, which returned the collection name for inline-created items (and the wrong field for collections whose PK isn't named `id`). It now resolves via `relationPrimaryKeyFields`, and when no PK exists yet (inline create) passes the whole nested object through so DaaS deep-creates the related item.

- 27a2515: ListM2A: stop the replace-mode payload from mass-unlinking off-page junction rows.

  The emitted M2A payload was built from `displayItems`, which is page-scoped (`useRelationM2AItems.loadItems` always sends `limit`/`page`), while the DaaS relation writer treats the payload as the complete set: it deletes every junction row for the parent, then re-inserts only what it received. With more junction rows than one page, staging any single change and saving deleted every off-page row. Bare-primitive entries can't patch over this the way ListO2M's preserve does — `processM2AField` ignores primitive entries entirely — so the emit now preserve-fetches every junction row for the parent (`limit=-1&page=0`, `count=exact`) at build time, drops staged deletes, applies staged sort updates to the payload order (payload order is what the backend persists as sort), appends staged creates, and emits the full `{ collection, item }` set. A failed or incomplete preserve-fetch (returned rows ≠ the server's exact count) aborts the emit instead of falling through, since an incomplete replace payload is destructive rather than merely incomplete. The fetch runs fresh per emit (not a mount-time snapshot), and emit dedupe now keys on _successful_ emits so an aborted build retries on the next change.

- 6375036: ListM2A: recognise every new-item sentinel before preserve-fetching.

  `isParentSaved` tested for `'+'` alone, while the canonical `isNewItem` helper — the one `useRelationM2A.loadItems` already gates on — also treats `'%2B'` and `'new'` as new. On a route like `/pages/new` the loader therefore declined to fetch while `isParentSaved` reported true, so the emit preserve-fetched against a literal `'new'` primary key. If the backend rejects that against a uuid column the emit aborts, and the new record saves with none of its staged rows.

  Also adds regression coverage for behaviour the preserve-fetch already had but nothing pinned: that the fetch is scoped to this parent (without the filter it returns every parent's junction rows and the replace-mode emit re-links them onto this one), that a bare-array response is normalised rather than read as an empty relation, and that the payload still spans all pages when an active search has narrowed the visible set.

- 2b8413c: ListM2A: drag reorder now works end-to-end and paginated sets are handled safely.

  - Multi-position drags previously looped moveItemUp/moveItemDown against stale state within one tick, staging only a single-position swap. handleDragEnd now computes the full reordered array once (arrayMove) and stages it with a single reorderItems call.
  - `useRelationM2AItems.displayItems` now orders items by the (possibly locally-staged) sort value. Staged reorders previously changed nothing observable: the list snapped back to fetch order and the emitted replace-mode payload — whose order is what the backend persists — kept the old order.
  - reorderItems/moveItemUp/moveItemDown accept a `pageOffset` so any future cross-page reorder writes global sort values instead of page-local 1..N.
  - Drag is now gated on `totalCount <= limit` (all pages, not the current page's row count) — reordering a paginated M2A emits a payload containing only the loaded page, which replace-mode would persist by deleting the other pages' junction rows. The drag-disabled notice uses the same condition, so paginated lists explain why drag is off instead of silently hiding the handles.

- 0408b2c: ListM2M: dedupe the load-items effect against fresh prop literals / React 18 StrictMode double-invoke (was firing an identical query twice on mount), and route the disabled batch-edit button's tooltip through the existing i18n translations system instead of a hardcoded English string. The parent-cleared reset branch also no longer bumps refreshKey on initial mount with an empty value — the remaining double-fetch path the signature dedupe alone couldn't catch.
- 12f823c: ListM2M: paginated reorder writes global sort values, staged creates render only on the last page, and the broken batch-edit trigger is disabled.

  - `reorderItems`/`moveItemUp`/`moveItemDown` in useRelationMultipleM2M accept a `pageOffset` (ListM2M passes `(currentPage - 1) * limit`), so reordering on page 2+ no longer collides with every other page's 1..N sorts. The staged updates are emitted in the ChangesItem and persist on save.
  - `displayItems` now orders by the (possibly staged) sort value, so an arrow reorder is visible immediately instead of only after a server round-trip.
  - Locally staged creates previously rendered on every page (the hook appends all of `changes.create` to whatever page is fetched); ListM2M now shows them only on the last page, where totalCount already accounts for them.
  - The batch-edit button opened `CollectionForm(mode='edit', id=undefined)` — an empty broken form with no batch-apply logic behind it. It is now disabled with an explanatory tooltip until a real batch-edit flow exists.

- 594c277: ListM2M's items query resolves the bootstrap "id" fields default to the related collection's real primary key.

  The fields prop defaults to ["id"] as a placeholder meaning "the primary key", but both query-building sites prefixed it literally as `${junctionField}.id` — requesting a nonexistent column and 500ing the list for any related collection whose PK isn't named id. The bootstrap sentinel now resolves to relationInfo.relatedPrimaryKeyField (dynamic since the hardcoded-PK fix); explicitly-passed field names are untouched. Same policy as the resolveRelationFields fix that landed with the relation-hooks PK work.

- 2be8218: Fix ListM2M arrow-reorder misalignment with staged creates (N2).

  `moveItemUp`/`moveItemDown` in `useRelationMultipleM2M` recomputed their own "visible" array from the hook's unfiltered `displayItems` (includes every staged create, globally sorted), while `ListM2M` passed an `index` from its own page-local `visibleItems` (staged creates hidden on any page that isn't the last). Whenever a staged create existed, the two arrays disagreed and the arrow reorder moved the wrong item. Both functions now take the caller's exact page-local array instead of an index they re-derive differently — this is a breaking change to their signature (`(pageItems, index, pageOffset?)` instead of `(index, pageOffset?)`).

- 1226ec5: ListM2M: resolve the display-template label immediately when picking or creating an item, not just after save+reload.

  Picking an item via "Add Existing" only ever staged `{ [junctionField]: { id } }` locally, so a display template referencing e.g. `name` had nothing to resolve against and rendered a blank label until the parent form was saved and the list reloaded — most visible when adding a relation on a brand-new, unsaved parent, where no reload ever happens.

  The select modal has already loaded the rows it is showing, so `BulkAction.action` now receives them alongside the selected ids (`(selectedIds, selectedRows?)` — a new optional parameter, so existing bulk actions are unaffected), and the modal's list is asked for whatever fields the display template needs. `ListM2M` passes those rows to `selectItems`, which keeps them in display-only state so the label resolves immediately, with no extra request and no await between the click and the modal closing. "Create New" does the same with the record `CollectionForm` just returned.

  The staged junction payload deliberately stays reference-only (exactly the related primary key): `CollectionForm` distinguishes "link this existing row" from "deep-create a new one" by that object carrying nothing else, so display fields must never be merged into it. A regression test in `@buildpad/hooks` now pins that contract against the same flatten logic the save path uses.

- 1bf1731: ListM2M: fetch the fields referenced by the row-display template.

  The API `fields=` query was built only from the `fields` prop (defaulting to the bootstrap `["id"]`), independent of the `template` used for rendering — so a field configured with a template but no explicit `fields` fetched only the related primary key, and every row rendered blank. `ListO2M` and `SelectDropdownM2O` already merge template-referenced fields into their queries; `ListM2M` never got the equivalent.

  Template paths are normalised before use, because M2M templates arrive in both conventions: an explicit `template` prop may be junction-relative (`{{tag_id.name}}`) or related-relative (`{{name}}`), while the related collection's `display_template` and the `{{ pk }}` bootstrap are always related-relative. Related-relative paths are prefixed with the junction field for the junction query and used bare when querying the related collection directly. Sending an unprefixed path to the junction table asks it for a column it does not have, which fails the whole request rather than just rendering a blank label.

  Row labels resolve against the related record with junction columns available but never shadowing it, so `{{ id }}` means the related item's key and a junction column sharing a name with a related one no longer wins.

- 46afe83: ListO2M: fixes the `.id` assumptions behind R6.1 for related collections whose real PK column isn't named `"id"`, plus several staged-change bugs found alongside them.

  1. The "select all" header checkbox built `selectedIds` from `displayItems.map((i) => i.id)`, but every per-row checkbox is keyed by `getPk(item)` (the resolved real PK). For a non-`"id"`-PK collection this mismatch meant select-all populated the set with `undefined`, so no row ever showed as checked and batch actions silently targeted nothing. Select-all state is now derived from membership rather than by comparing the Set's size to the row count (which read as "all selected" on a different page), and selections are pruned when a row leaves the list.
  2. The edit modal opened `CollectionForm` with `id={currentlyEditing?.id}` instead of the resolved PK — for a non-`"id"`-PK collection this was always `undefined`, so clicking "Edit" on an existing row silently opened the form in create mode instead. `mode` now follows the resolved id, so an "edit" modal can no longer route Save into `createOne`.
  3. The `$temp_` sentinel on a staged create was overwritten by the real `id` that `CollectionForm` merges into every `onSuccess` payload, so every `$temp_` guard mis-branched: removing a just-created child staged a delete _and_ left the create in place, and editing one PATCHed a child that was not linked yet.
  4. Un-staging a link left any edit staged against that row in the changeset, so a record the user had just removed was still emitted and would be updated and re-linked on save. Staged edits are also now applied to staged-link rows, which previously rendered stale values and emitted a second entry for the same PK.
  5. Emitted update entries no longer reassert the PK key over the form data, so renaming a user-editable PK column is not silently discarded.
  6. Reorder arrows passed a `displayItems` index — which is padded with staged links and creates — into handlers that index the fetched rows, swapping in `undefined` after issuing real PATCHes for earlier indices. They now resolve the row's real index and are disabled for rows that only exist locally.
  7. The table rendered the raw `fields` prop, whose bootstrap default is `["id"]`; for a non-`"id"`-PK collection that produced an empty "Id" column and a sort by a column that doesn't exist. It now renders the resolved PK, the same substitution the `fields=` query already made.
  8. Staged links/updates/deletes are reset when the parent record changes, so record A's staged changes are no longer emitted for record B when the host swaps `primaryKey` without remounting.

  Not changed, and now documented in the source: object-shaped payload entries keep their literal `id` key. The relation writer resolves records via `itemObj[manyPrimary]`, but `directus_relations.many_primary` is `TEXT NOT NULL DEFAULT 'id'` and is hardcoded to `"id"` at every DaaS write site — this repo never sends it. Re-keying those entries by the related collection's real PK column makes the lookup miss, so the writer falls through to its create branch and INSERTs a row that already exists. Supporting a non-`"id"` PK on the write path needs a backend change (populate `many_primary`), not a client change. The `$delete` marker has no reader in DaaS at all, so removing a fetched row while the parent is unsaved currently has no backend representation.

- 5056ef3: ListO2M: close the saved-parent mass-unlink holes around the changeset emit.

  The emit effect now maintains a preserve set — the full id list of the parent's currently linked children — and appends it to every saved-parent payload, so the relation writer's authoritative handling of that payload can't deselect unrelated children. Concretely:

  - Reverting a staged link (stage → un-stage) re-emits the full current id set (a no-op re-link) instead of `[]`, which the writer answers by unlinking or deleting every child.
  - Emits are synchronous whenever a known-good preserve set exists (the first successful fetch seeds it, and it is re-fetched in the background after each emit, re-emitting only when the server set actually changed). The parent form is never left holding an outdated payload during a fetch round-trip, so a Save clicked mid-fetch can no longer submit a reverted change.
  - Direct mutations on a saved parent (row unlink/delete, creating a child via the modal) update or invalidate the preserve set and re-emit, so a pending payload can't re-link a removed child or deselect a just-created one.
  - A preserve fetch that fails — or that returns a row set not matching the server's exact count (e.g. a server-side row cap), or rows missing their primary key (e.g. stripped by field permissions) — never produces a destructive payload: with no cached set the emit is withheld and an inline error with a Retry action is shown; with a cached set the synchronous emit has already delivered the last known-good payload.

- 7b415ad: ListO2M: fix three ways pending relational changes were lost.

  - Mounting the field with an existing value no longer emits `onChange([])`, which silently wiped the O2M value on the next save.
  - "Add Existing" on an unsaved parent now stages into a dedicated `link` bucket, so the picked item renders in the list and is emitted with the parent FK on save. It previously staged into `update`, which only patches items already loaded from the server, so the selection disappeared and was never saved. Links are emitted as a reference (`id` + FK) rather than the fetched display fields — echoing those back makes the API drop the entry when the display template contains a nested path such as `{{author_id.name}}`.
  - Staged creates now take their `$index` from a ref, so an interleaved create → edit → create no longer hands the same `$temp_` id to two rows (which made both disappear when either was removed).

  Un-staging the last pending change still emits `[]`, so the parent form drops the field edit instead of saving an item the user removed.

- 1523349: M2M: alias the junction PK onto `.id`, fix the junction save path, and make ListM2M refetch on a record switch.

  - **Junction updates are no longer silently dropped on save.** `CollectionForm`'s M2M flush read the junction row's PK as a hardcoded `entry.id`, while the hook keys its staged update entries by the junction's real PK column. For any junction table whose PK isn't named `id`, every staged update (reorder, junction-field edit) was skipped and the save still reported success. The junction PK is now resolved from the schema and read by name, and a key mismatch throws instead of skipping.
  - **`useRelationMultipleM2M` aliases the junction PK onto `.id` for fetched items** (previously only locally-created ones got it), so `ListM2M`'s React keys, DnD sortable ids and drag-end matching work for junctions whose PK isn't `id`. The alias is applied after local edits are overlaid (a staged edit can carry its own `id`) and falls back to the row's existing `id` when the PK column is absent from the response, rather than overwriting every row's identity with `undefined`.
  - **Staged changes are discarded when the parent record changes.** Previously they survived, so navigating between records without a remount let record 1's staged links and deletions ride onto record 2 — and saving record 2 also mutated record 1.
  - **`existingItemCount` is inferred from page fullness** instead of `meta.total_count`, which on this backend is the unfiltered collection count. It reported the whole junction table as one parent's count, which disabled drag-and-drop entirely, hid staged creates behind a bogus page count, and rendered phantom pagination.
  - **`ListM2M` refetches when `primaryKey` switches to another record** (the load-signature dedupe omitted it, so the previous record's rows stayed on screen), and clears them when switching to an unsaved parent. `refreshKey` is compared separately from the signature so a record switch that also clears `value` doesn't fire the same query twice. Page, search and selection reset on the switch, and a failed load no longer poisons the dedupe permanently.
  - **Multi-select assigns distinct sort values.** Every id in one batch previously got the same value, losing the chosen order on save.
  - **The select modal's "already linked" exclusion covers every page**, not just the loaded one — it was offering items already linked elsewhere, staging duplicate links.
  - Smaller fixes: a guarded load no longer strands the loading state, and the junction-fields form is hidden for not-yet-saved rows rather than fetching a `$new-` sentinel id.

- ad9c415: SelectMultipleDropdown and SelectMultipleCheckbox normalize csv-string values themselves.

  Both are registered for json (array) and csv (comma-string) storage but assumed arrays. The FormFieldInterface pipeline already normalizes for its own leaves, but a consumer using either exported component directly still hit the raw-string failure cluster: silently dropped data in the dropdown (Array.isArray ? ... : []), and substring-match reads, character-spread corruption, uncheck TypeErrors, and an allowOther render crash in the checkbox. The leaves now accept a `type` prop ('csv' | 'json'), normalize string values on read (also inferring csv storage from an observed string), and re-serialize to a comma-string on write for csv storage — composing with the pipeline without double-joining.

- 1f2bcff: Radio per-choice icon/color, checkbox-tree UX fixes, multi-dropdown allowOther/icons, and a checkbox allowOther double-render fix.

  - SelectRadio (S3.3): `RadioChoice` now supports `icon`/`color`, rendered next to the label. As a side effect, per-choice (and group-default) checked-state color is now applied via Mantine's native `color` prop instead of a `styles`-prop `&[data-checked]` selector that does nothing in Mantine v8 (S3.4).
  - SelectMultipleCheckboxTree: a fully-selected parent in `leaf` mode now shows checked instead of stuck indeterminate (S4.5); searching a parent's own text no longer hides all its children (S4.6); cascade toggles ('all'/'leaf' modes) now skip disabled descendants (S4.7, on top of the existing per-node `disabled` support); `data-testid` is now scoped by index path instead of the raw (possibly colliding) value (S4.8 residual); nodes on the path to a search/selection match now force-expand past a prior manual collapse (S4.9); recursive walkers now cap at a depth of 100 as a defensive guard against cyclic input (S4.10); `color` now gets the same `var(--mantine-color-X-6)` normalization as its sibling checkbox (S4.11).
  - SelectMultipleDropdown: `allowOther` is now implemented (Enter/blur commits typed free text, mirroring SelectDropdown's manual creatable pattern) instead of silently doing nothing (S6.2); `DropdownChoice` now supports `icon`/`color`, rendered in the option list, and the global pill `color` is normalized for hex/rgb/hsl the same way `SelectMultipleCheckbox` already does (S6.3).
  - SelectMultipleCheckbox (S7.3): a custom "other" value committed via its own input row no longer also renders as a second, separate read-only checked checkbox — the live row now takes precedence.
  - Leaf-mode parent state counts only selectable (or already-selected) leaves, so an unselected disabled leaf no longer holds the parent at an indeterminate state the cascade toggle can never resolve.

- 925e201: useRelationM2M/useRelationO2M resolve real primary keys instead of hardcoding "id", and ListO2M keys rows by the resolved PK.

  - `relatedPrimaryKeyField`, `junctionPrimaryKeyField` (M2M) and `relatedPrimaryKeyField`, `parentPrimaryKeyField` (O2M) were hardcoded to `id`/`uuid` (junction: `id`/`integer`). They are now detected from the collection schema (`is_primary_key`), the same way useRelationM2A already does, with the old values as a graceful fallback when the schema can't be read.
  - `useRelationO2MItems` and ListO2M now key every read/write off the resolved PK field. Hardcoded `.id` made removeItem/deleteItem/reorderItems hit `/api/items/{collection}/undefined` (silent no-ops) and corrupted staged-change matching, React keys, and checkbox selection for any related collection whose PK isn't literally `id`.
  - `resolveRelationFields` drops the bootstrap `"id"` default from `fields=` queries when the resolved PK isn't `id` — that placeholder referenced a column that doesn't exist on such collections and 500'd the request. (Overlaps in intent with PR #99's M2M-side fix; reconcile when both land.)
  - Known limit, unchanged here: ListO2M's emitted payload entries still key items by a literal `id` property. That backend-contract check has since been done (see the ListO2M changeset in this same release): the literal `id` is what the relation writer actually reads, because `directus_relations.many_primary` is always `"id"` in practice — so this shape is correct, and supporting a non-`id` PK on the write path needs a backend change rather than a client one.

- 4a31fb5: SelectDropdown: allowOther can now actually commit a custom value.

  Mantine v8's Select has no creatable mode and its onChange never fires for text matching no option, so the old allowOther branch was unreachable — typed values could never be committed. Free text is now committed manually on Enter or blur (unless it matches an existing choice), and an already-committed custom value is injected as a synthetic option so the field displays it instead of blank.

- 24ebfc2: SelectDropdown & SelectMultipleDropdown: rework the `allowOther` free-text commit path (V3-2, V3-3, N3-b and adjacent holes).

  - **Enter commits are now deferred one microtask.** Mantine invokes the consumer `onKeyDown` before its own Enter handling, so nothing Mantine is about to do (preventDefault, selecting a highlighted option) is observable in the handler itself; the deferred commit instead consults a selection flag set by the chained `onOptionSubmit`, which Mantine fires synchronously in the same task. One Enter on a highlighted option now produces exactly one `onChange` with the resolved choice value — previously it double-emitted the raw search text first. A consumer `selectProps.onKeyDown` that preventDefaults Enter (the usual anti-form-submit guard) no longer affects the commit wiring.
  - **`onOptionSubmit` also eagerly syncs the search text to the submitted option's label** (and fires even when re-submitting the currently-selected option, which Mantine's `onChange` skips), so a blur that lands before the controlled value echo — or after a no-op re-select — no longer commits the abandoned filter fragment over the selection.
  - **`lastCommittedRef` stays in sync with the current value** (trimmed) via an effect and is also updated on every selection, so re-typing a previously committed value always commits again — including for consumers that don't echo the value back into `value`.
  - **Text naming an existing choice resolves to that choice** (`onChange(choice.value)`) instead of being silently dropped — typing an exact label with no highlighted option used to be a dead keystroke whose text blur then wiped. Comparisons are trimmed-to-trimmed, so whitespace-padded values/labels can't produce spurious commits on focus traversal.
  - **`readOnly`/`disabled` fields never emit** from the commit path, an Enter that confirms an IME composition (`isComposing` / keyCode 229) is ignored, and Escape restores the selected choice's label rather than exposing the raw stored value.

- 0ad17fc: SelectDropdown: fix icon visibility when a choice has both `icon` and `color` set (S2.5).

  - `renderOption` previously hid the icon whenever a color was also present, showing only the color swatch.
  - The closed input's `leftSection` never showed the selected choice's own icon/color at all — once a value was picked, `showGlobalIcon` correctly turned off the global fallback, but nothing filled that gap, so the input went blank instead of showing the selection's own icon.

  Both now mirror each other: a choice with both `icon` and `color` shows both, in the option list and in the closed input.

  Composed with the earlier glyph-rendering fix: icons in both places render via the shared IconDisplay (Tabler glyphs), never as the raw Material name string.

- 432125d: SelectDropdown renders real icon glyphs instead of raw Material names, gets a forwarded aria-label, and SelectIcon's category list no longer duplicates icon names.

  - SelectDropdown's `leftSection` and option rows printed the literal icon name string (e.g. `code`) instead of a glyph — now rendered via the shared `IconDisplay` (select-icon's `ICON_MAP`).
  - SelectDropdown dropped `aria-label`, leaving the Select with no accessible name beyond its placeholder. It's now accepted and forwarded to the underlying `<Select>`.
  - SelectIcon's `ICON_CATEGORIES` listed 10 names in two categories each (e.g. `lock`, `vpn_key`, `fingerprint` in both "Action"/"Communication" and "Security & Identity"), producing duplicate `data-testid`s and double-highlighting a selected duplicate. Categories are now deduped so each icon name appears in exactly one category.

- 2f6ad88: SelectDropdownM2O: clearing the value now resets the shown item, and picked options emit their real (typed) key.

  - The item-load effect only handled the truthy branch, so a value going non-null → null (clear button, or an external reset) kept the previously-loaded item on screen — the field showed a stale label while its value was empty. The effect now calls clearItem() in the else branch.
  - onOptionSubmit forwarded Mantine's always-stringified option value straight to onChange, storing numeric foreign keys as strings and breaking the `active` highlight (a raw comparison that never matches a re-stringified value). The submitted string is now resolved back to the matching item and its real key is emitted; the table-layout path already did this.

- 4becd38: SelectDropdown and SelectMultipleCheckboxTree edge-case fixes (N3/N4).

  - SelectDropdown: `selectProps` no longer silently disables the `allowOther` commit wiring (consumer-supplied onBlur/onKeyDown/onSearchChange now compose instead of overwrite); blur/Enter no longer re-commit an unchanged value; Enter on a highlighted option no longer double-emits; Escape now discards typed-but-uncommitted text instead of letting the following blur commit it.
  - SelectMultipleCheckboxTree: tree node collapse/expand state no longer resets when a search query changes which siblings are filtered out — keys are now derived from each node's position in the unfiltered choices tree instead of the filtered array's own index.

  Reconciled with the earlier auto-expand fix (S4.9): node identity is stable across searches, so a manual collapse survives filtered-index shifts — but a query matching a collapsed branch's descendant still force-expands it, since a match hidden under a collapsed ancestor reads as "no results".

- 5802243: SelectIcon: forward extra props safely, accept both `autoFocus` spellings, and unify the unknown-icon fallback (S5.5, S5.7).

  **Prop forwarding (S5.5).** `SelectIcon` now forwards extra props to its trigger `<Button>`, so a consumer can pass `data-*` attributes and event handlers. Note this is a _new_ capability rather than parity: of the selection leaves, `SelectDropdown`, `SelectRadio`, `SelectMultipleCheckbox` and `SelectMultipleDropdown` take no rest props at all, and `Boolean`/`Toggle` forward a rest that is closed at the type level.

  Because `FormFieldInterface` passes DaaS schema metadata to every leaf — `type`, `collection`, `field`, `primaryKey`, `maxLength`, `nullable`, `defaultValue` — plus admin-authored `meta.options` spread unfiltered, forwarding has to be guarded:

  - Those metadata props are declared and destructured-and-discarded, mirroring the existing guard in `input/Input.tsx`, so none reach the DOM as invalid attributes.
  - `type` matters most. Mantine's `UnstyledButton` applies its `type: "button"` default _before_ its own rest spread, so a forwarded `type` wins — and `field.type` is a DaaS abstract type (`string`, `uuid`, …), never a valid button type. An invalid `button@type` falls back to `submit`, and `CollectionForm` renders fields inside `<form onSubmit={handleSave}>`, so the trigger would have saved the record when the user clicked merely to open the picker. `type="button"` is now pinned, and the forwarded value discarded.
  - The rest spread is declared first, so component-owned props always win: rest may add, never override.
  - The rest is typed (`SelectIconTriggerProps`) rather than an `[key: string]: unknown` index signature. An index signature would have disabled excess-property checking on every call site — `valeu`, `onChagne` would compile and ship to the DOM. `data-*` never needed it: TypeScript always permits non-identifier JSX attribute names.

  **Autofocus (S5.5).** Both `autoFocus` and `autofocus` are accepted. The form pipeline (`VForm` → `FormField` → `FormFieldInterface`) sends the lowercase spelling, so a camelCase-only prop would never have fired for the only in-repo caller.

  **Fallback glyph (S5.7).** The trigger's `renderIcon` and the read-only `IconDisplay` companion used different glyphs for the same "stored name with no `ICON_MAP` entry" condition. Both now use `DEFAULT_UNKNOWN_ICON` (`IconQuestionMark`) _with the same stroke and `aria-hidden`_ — sharing the component alone still left them at different stroke weights. The constant is exported from the package barrel so the two can't drift again. The trigger also surfaces the raw stored name via the icon's own SVG `<title>` (Tabler's built-in `title` prop, which reaches assistive tech) instead of a bare `?`; the picker grid does not, since its cells already carry a formatted title.

  **`@buildpad/ui-users`.** `IconDisplay`'s default fallback changed, and `RolesManager` was the one caller relying on it — every role with no icon would have rendered a question mark instead of a users-group glyph. It now passes `fallback={IconUsersGroup}` explicitly, matching how the policy surfaces already pass `fallback={IconShield}`.

- 4355c8e: SelectMultipleCheckbox: per-choice icon/color, plus the checked-color fix.

  1. **Per-choice `icon`/`color`** (`Option.icon`, `Option.color`), matching SelectRadio's existing S3.3 behaviour — a choice's icon renders before its label, or a colour swatch when only `color` is set, and `choice.color` overrides the group-level `color` on the checkbox itself (S7.2).

     Colour values are passed through **verbatim**, not reduced to a palette name. Mantine's `color` prop already accepts any CSS value (a non-palette string is returned untouched), so `var(--mantine-color-blue-3)` resolves correctly while the palette-reduced `blue-3` is neither a palette reference nor valid CSS and would compute the checked box to transparent. `ColorSwatch` never theme-resolves at all — it assigns the value straight to `backgroundColor` — so a bare palette name there renders no colour whatsoever. The shared `paletteNameFromColor` helper now lives in `select-icon` alongside `IconDisplay` and is used only where a palette _name_ is genuinely required (string interpolation that rebuilds a `var()`); it anchors the shade suffix so a palette whose own name contains `-6` is not mangled.

     The icon map is loaded **on demand**. `IconDisplay` resolves a Material icon name through a 257-entry table via a dynamic index, so a static import cannot be tree-shaken and made this component roughly 6x larger gzipped for every consumer — including the majority whose choices carry no icon. It now loads only when a choice actually has one; a field without icons never fetches it.

  2. **The group-level `color` prop's checked state was never rendering.** The checkbox's `wrapperProps={{ style: {...} }}` is spread onto `InlineInput`'s props _after_ Mantine's own computed `style` (which carries `--checkbox-color` and `--checkbox-size`), and a plain object spread is last-wins on the `style` key — so the resolved CSS variables were dropped outright, whether the colour came from the group default or a per-choice override. Switching to `styles={{ root: {...} }}` merges through Mantine's `getStyles` instead. This is now applied to **both** checkboxes in the file; the `allowOther` custom-value checkbox had the same construct and would otherwise have kept checking in the theme colour while the choices above it checked in the configured one.

  **Registry.** `select-multiple-checkbox` imports `IconDisplay` from `select-icon`, which the registry entry did not declare — so `buildpad add select-multiple-checkbox` emitted a file importing a component that was never installed. `select-radio`, `select-dropdown` and `select-multiple-dropdown` already carried the same undeclared import, and `map-with-real-map` the same class; all five now declare it, along with the `@tabler/icons-react` dependency the emitted files need. `pnpm registry:check` gained a check that resolves every relative import in a shipped file against that entry's own files and its `registryDependencies`, so this cannot recur silently — the existing check compares file hashes against version bumps and has no notion of an import graph.

- 79c22f7: SelectMultipleCheckboxTree: survive a cyclic choices tree, and make the toggle lookup O(1) (S4.10).

  A choices tree containing a cycle — a node whose descendants loop back to it, e.g. a malformed API response reusing a shared object reference — could take the component down. `handleToggle` resolved the clicked node with an unguarded depth-first search, so a cycle reached before the target overflowed the stack on the first toggle.

  Rather than add a depth cap to that one search, the lookup is now a `Map` from value to node, memoized on `choices` and built with a `WeakSet` of visited nodes. Three things follow:

  - **Cycles are detected, not merely bounded.** A depth cap only limits how long a cycle spins, and does not survive a node listed _twice_ in its own children: that fans out 2^depth and exhausts memory long before any cap bites — a frozen tab rather than an empty branch. Visited-node detection terminates on any cycle shape. The same treatment is applied to the two walkers that rebuild the tree for rendering, which cycle independently of the toggle; there it is an ancestor-chain check, since a node is only cyclic if it appears within its own subtree.
  - **No false negatives on deep data.** A cap silently stops resolving nodes that are still on screen: the render-side walker keeps one level more than a capped search would reach, so a node at that boundary rendered but its click did nothing. An exact lookup has no boundary to disagree about.
  - **The traversal is no longer duplicated.** The component already walked the identical tree with identical dependencies to collect `choiceValues` for csv normalization; that list is now derived from the same map, and the per-toggle re-walk is gone.

  First occurrence wins, preserving the depth-first ordering the previous search had.

- af56a74: SelectMultipleDropdown: fix the `allowOther` free-text commit path and option rendering (V3-6).

  - **Enter on a highlighted option no longer double-emits.** The commit is deferred one microtask and consults a flag set by a chained `onOptionSubmit`, because this component's `onKeyDown` runs _before_ Mantine's own Enter handling — so `event.defaultPrevented` cannot be used to detect it. Previously one keystroke emitted twice (the raw filter text, then the resolved option), and the second emission overwrote the first, discarding the typed text. A consumer that preventDefaults Enter (the usual guard against a wrapping form submitting) no longer loses the commit, and an Enter confirming an IME composition is ignored.
  - **Text naming an existing choice now selects that choice** (matched case-insensitively, so "REACT" finds "React") instead of being silently discarded. Custom values are still compared case-sensitively, so case-distinct free-text entries such as `ember` and `Ember` remain separate — on a free-text field the casing is user data.
  - **`maxValues` now caps manual commits**, and a commit blocked by the cap leaves the typed text in the box instead of erasing it with no feedback.
  - **Commits are suppressed while the field is `disabled` or non-`searchable`**, so disabling a focused field mid-edit (the standard "disable while saving" pattern) no longer commits its pending text on the resulting blur.
  - **Clearing the selection keeps csv storage intact.** The empty selection now emits `''` rather than `null` under csv storage, and the storage-shape inference is latched, so subsequent writes stay comma-strings instead of switching to arrays.
  - **Rendering:** a choice that sets both an icon and a colour now shows both (the colour was dropped whenever an icon was present), the selected-option check is a proper `IconCheck` rather than a literal `✓` character inside the option's accessible name, and `hidePickedOptions`/`limit` now work in non-searchable mode (the custom `filter` was returning the unfiltered option list).

- eb662e3: SelectMultipleDropdown: fix dedup-drop type corruption for already-selected values (S6.6).

  Two choices whose values stringify identically (e.g. number `1` vs string `'1'`) only ever have the first survive the render-time dedup. `handleChange` rebuilds the _entire_ selected array from Mantine's stringified selection on every toggle, so an already-selected "dropped twin" (e.g. a stored string `'1'`) was silently re-typed to the surviving choice's type (`1`) whenever the user toggled any unrelated item — not just the colliding one. Already-selected values now keep their exact stored type; only genuinely new selections resolve through the choices list.

- ee5bbd6: SelectRadio: stored falsy values (0, false) are treated as real selections, and choice matching tolerates string/number type mismatches.

  - `!value`-style guards became `value == null`, so a stored `0` or `false` no longer renders as "nothing selected" (or gets misrouted to the "Other" input when allowOther is set).
  - In-choices detection stringifies both sides, matching the highlight/emit logic that already did — a choice authored as `'3'` matches a stored integer `3`.
  - The radio-group value no longer collapses `0`/`false` to `''` via `String(value || '')`.

- 4aad6ac: SelectRadio: a choice missing `text` no longer crashes the field, and choices whose values stringify identically no longer collide on React keys.

  - The width-measurement reducer read `val.text.length` unguarded, so one malformed/seeded choice without `text` threw during render. It now treats missing text as `''`, and the radio label falls back to the choice's value.
  - Row keys are index-qualified; the native radio `value` stays unqualified — two choices stringifying identically still share one native selection slot, which is audit 3.7's separately-documented limitation.

- a5478f4: SelectRadio: choices whose values stringify identically (e.g. number `1` vs string `'1'`) no longer share one native radio group value (S3.7) — previously selecting either one visually checked both. The second occurrence is dropped, matching the treatment `SelectDropdown` already got for the same collision (the dropped choice was never independently selectable anyway, since `handleChange` already resolved to the first match).
- e078a74: Choices whose values stringify identically (e.g. number 1 vs string '1') no longer crash SelectDropdown/SelectMultipleDropdown or warn in SelectMultipleCheckbox(Tree).

  - The dropdowns build Mantine data arrays that require globally-unique string values; a colliding pair hard-crashed the field ("Duplicate options are not supported"). The second occurrence is now skipped, matching the existing first-match selection resolution — the dropped choice was never independently selectable.
  - The checkbox and tree leaves key rows by index + stringified value instead of the stringified value alone, eliminating React's duplicate-key warning; selection state already compared real typed values and is unchanged.

- 4355f4d: Tree, checkbox, and CollectionItemDropdown: fix six V3-7 quirks.

  **SelectMultipleCheckboxTree**

  - Clicking the chevron to collapse an auto-expanded ancestor (search matched a descendant) was a silent no-op — toggling `manuallyExpanded` recomputed `expanded` back to `true` anyway since the auto-expand condition still applied. An explicit click now wins, by storing the user's choice together with the auto-expand context it was made in. Both `searchQuery` **and** `showSelectionOnly` feed that context: keying on the search alone would leave a user-collapsed node collapsed when "Show Selected" is clicked, hiding the very selection that mode exists to reveal.
  - `data-testid`s were derived from each node's index in the _filtered_ array, so they shifted whenever search or `showSelectionOnly` changed which siblings were visible. They are now derived from each node's position in the **unfiltered** array. The format is unchanged (`checkbox-0`, `checkbox-0-2-1`) — only its stability — so no existing selector breaks.
  - `valueCombining='all'` counted disabled descendants when deciding whether a parent is fully checked, while the cascade toggle deliberately refuses to select them (S4.7). A single disabled descendant therefore held the parent at indeterminate forever, with every further click re-emitting an identical selection. The `'leaf'` branch already carried this fix; `'all'` now matches.

  **SelectMultipleCheckbox**

  - The "already backed by a live row" exclusion (S7.3) matched a stored value against every row's typed text, regardless of whether that row was even checked. A stored _number_ (e.g. `5`) was hidden entirely whenever an unrelated, unchecked row's in-progress text happened to be the _string_ `"5"`. Only checked rows are considered now. The comparison itself stays string-based: a row's value is always its typed text, so a strict-equality test could never match a stored number or boolean, and the entry would render twice — once read-only and once as the row.

  **CollectionItemDropdown**

  - Blur committed the typed collection text as-is even when it didn't resolve to a real collection, wiping the item selection and pointing `selectedCollection` at something that doesn't exist. It now reverts the draft instead — but only when the collection list is actually known. The list starts empty and is filled by an async fetch that can also fail outright, and treating "we haven't loaded it yet" as "that isn't a collection" silently discarded valid typed input, removing the free-text escape hatch exactly when the menu can't offer one.
  - Typing a valid collection in full committed twice: once from the change handler and again on blur, because blur compared the draft against `selectedCollection`, which a controlled prop that doesn't echo `onCollectionChange` never updates — and the form pipeline never passes that callback at all. Blur now compares against what was actually last committed.
  - Retyping the current collection (e.g. backspace + retype the same characters) cleared the item selection even though the collection never changed. Only that destructive half is now skipped: the pick is still reported to the parent, since "value unchanged" and "user made no choice" are different events and a parent that has lost its collection relies on the callback to learn the user re-confirmed one.

- Updated dependencies [585362e]
- Updated dependencies [6d724ee]
- Updated dependencies [89f532b]
- Updated dependencies [565448a]
- Updated dependencies [c6db1e6]
- Updated dependencies [c67c651]
- Updated dependencies [ddbc1bd]
- Updated dependencies [ce313ea]
- Updated dependencies [d38d37c]
- Updated dependencies [50a4057]
- Updated dependencies [08127f0]
- Updated dependencies [d5c9eee]
- Updated dependencies [577eda9]
- Updated dependencies [4a53873]
- Updated dependencies [2b8413c]
- Updated dependencies [12f823c]
- Updated dependencies [2be8218]
- Updated dependencies [1226ec5]
- Updated dependencies [944c25c]
- Updated dependencies [1523349]
- Updated dependencies [4026571]
- Updated dependencies [925e201]
  - @buildpad/hooks@1.11.1
  - @buildpad/ui-collections@1.11.1
  - @buildpad/utils@1.11.1
  - @buildpad/ui-form@1.11.1
  - @buildpad/services@1.11.1
  - @buildpad/types@1.11.1

## 1.10.0

### Patch Changes

- 4976915: Widen `CollectionItemDropdown`'s `value` prop to accept what the component
  already normalizes.

  The prop was typed `CollectionItemDropdownValue | null`, but the normalization
  memo also handles a raw key (`string | number`), a JSON string, and a resolved
  item object. Under a strict consumer tsconfig the declared type narrowed
  `typeof value === 'string'` to `never`, so `value.trim()` failed to compile with
  `TS2339: Property 'trim' does not exist on type 'never'` — which broke
  `pnpm build` for `@buildpad/ui-interfaces` and, with it, every CI publish run
  since 1.9.2. Runtime behaviour is unchanged; only the declaration now matches
  the implementation.

- 2e6bee7: Fix the file library picker and file thumbnails across the file interfaces.

  **The library picker's search box did nothing.** `Upload`'s fetch effect
  deliberately excluded the search term from its dependencies
  (`}, [libraryOpen]); // Only trigger on libraryOpen change, not on search`), so
  typing updated the input and re-rendered but never refetched, and there was no
  client-side filtering either — the term had no effect through any path. Search is
  now a real fetch dependency, debounced 300ms via `useDebouncedValue`, with
  filtering done server-side through the DaaS `search` parameter. A second, dormant
  copy of the fetch logic that _did_ close over the search term was only reachable
  from the open handler, which also flipped `libraryOpen`, so opening the picker
  fired two competing requests; that duplication is gone.

  **Thumbnails requested a preset DaaS ignores.** `?key=system-small-cover` (and
  `system-large-*`) is silently discarded by DaaS, which then streams the
  **full-size original** — so no resizing happened and the browser downloaded
  multi-megabyte images to paint 40–120px squares. All asset URLs now pass explicit
  `width`/`height`/`fit` transform params, which do resize. In `FileImage` this was
  worse than wasteful: originals were base64-encoded behind a 5 MB guard, so a
  large photo reported "Image too large to preview" for an image rendering at
  220px.

  **Files were drawn as folders.** Every non-image fell back to `IconFolderOpen`,
  and `Files` rendered `IconFolder` for _every_ attached file with no thumbnail at
  all — videos, audio, PDFs and Markdown all looked like directories. Thumbnails
  now fall back to a per-category icon (image / video / audio / document / archive /
  code) matching `FileCard` in `@buildpad/ui-files`, and never to a folder glyph.
  The fallback also triggers on image load failure, so a file record whose binary is
  missing from storage still shows what kind of file it is instead of a broken
  image.

  **New exports, one shared picker.** The browser is extracted as
  `LibraryPickerModal` and the thumbnail as `FileThumbnail` (both exported from
  `@buildpad/ui-interfaces/upload`, along with the `LibraryFolder` type). `Files`
  had its own parallel library modal; it now renders the shared one and inherits
  search, pagination, thumbnails and layouts. The picker gains:

  - pagination with a page-size selector (12/24/48/96) and a result count
  - grid and list layouts, toggled by an icon control with visually-hidden labels
  - optional folder browsing with a breadcrumb, enabled by passing the new
    `onFetchLibraryFolders` prop (omit it for the previous flat library — no folder
    UI is rendered). `File`, `FileImage` and `Files` wire it through `useFolders`.
  - a distinct error state — a failed fetch previously rendered as an innocuous
    "No files found", hiding permission problems
  - keyboard-operable tiles (`role="button"`, Enter/Space) and a token-based focus
    ring
  - cancellation of superseded requests, so a slow earlier response can no longer
    overwrite a newer one

  New `Upload` props: `libraryPageSize`, `libraryDefaultView`,
  `onFetchLibraryFolders`.

  **Pagination no longer invents pages.** DaaS cannot report a _filtered_ total:
  `meta.total_count` is always the unfiltered collection count, `meta.filter_count`
  only ever equals the number of rows in the current page, and `aggregate[count]`
  is ignored. Trusting it produced clickable pages that were always empty — in
  `FileManager`, searching a 32-file library returned 18 rows but rendered a second
  page from `ceil(32/24)`. Note this also affects the folder root, which is itself a
  filtered query (`folder._null`). Both surfaces now only show a numeric total when
  nothing narrows the query: `LibraryPickerModal` falls back to Prev/Next, and
  `FileManager` derives its page count from observation (a full page implies at
  least one more, a short page is the last), so the pager may understate how many
  pages exist until you walk forward but never offers one that isn't there. Both
  step back automatically if a page comes back empty, which also covers deleting
  the last item on a page. `FileManager` gains a result count that omits the total
  while filtering rather than displaying a wrong one.

  **Registry metadata.** Three pre-existing declaration gaps that would break
  `buildpad add` installs: `file` and `file-image` import `@buildpad/hooks` and
  `@mantine/notifications` without declaring them, and `files` imports
  `@buildpad/utils` undeclared. `upload` also now declares its `types` lib
  dependency and its `@mantine/hooks` / `@mantine/notifications` /
  `@tabler/icons-react` packages.

  `File` now uses the shared `formatFileSize` from `@buildpad/types` instead of a
  local copy, so sizes render as `1.5 KB` / `0 B` rather than `1.5 KB` / `0 Bytes`.

- Updated dependencies [5981327]
  - @buildpad/types@1.10.0
  - @buildpad/services@1.10.0
  - @buildpad/hooks@1.10.0
  - @buildpad/ui-collections@1.10.0
  - @buildpad/utils@1.10.0
  - @buildpad/ui-form@1.10.0

## 1.9.3

### Patch Changes

- Updated dependencies [3c55e13]
  - @buildpad/ui-collections@1.9.3
  - @buildpad/ui-form@1.9.3
  - @buildpad/hooks@1.9.3
  - @buildpad/services@1.9.3
  - @buildpad/types@1.9.3
  - @buildpad/utils@1.9.3

## 1.9.2

### Patch Changes

- 0a7e18d: Resolve vertical scrolling issues on collections table and height/scroll-sync bugs on code input editor.
- Updated dependencies [0a7e18d]
  - @buildpad/ui-collections@1.9.2
  - @buildpad/ui-form@1.9.2
  - @buildpad/hooks@1.9.2
  - @buildpad/services@1.9.2
  - @buildpad/types@1.9.2
  - @buildpad/utils@1.9.2

## 1.9.1

### Patch Changes

- a453388: RichTextMarkdown: fix a crash when opening Source mode — react-textarea-autosize (behind Mantine's `autosize` Textarea) rejects `style.minHeight`; the height floor now comes from `minRows` alone. This fix was part of the Source-mode branch but missed the 1.9.0 merge window.
  - @buildpad/ui-form@1.9.1
  - @buildpad/ui-collections@1.9.1
  - @buildpad/hooks@1.9.1
  - @buildpad/services@1.9.1
  - @buildpad/types@1.9.1
  - @buildpad/utils@1.9.1

## 1.9.0

### Minor Changes

- 5bf4320: RichTextMarkdown: replace the rendered "Preview" toggle with an editable raw-Markdown "Source" mode. The WYSIWYG editor renders Markdown as you type (it is the preview), which made a separate Preview mode redundant and confusing. Source mode shows the underlying Markdown in a monospace textarea; edits flow through `onChange` immediately and re-parse into the rich editor when switching back. The `previewFont` prop is deprecated (kept for type compatibility, no effect).

### Patch Changes

- @buildpad/ui-form@1.9.0
- @buildpad/ui-collections@1.9.0
- @buildpad/hooks@1.9.0
- @buildpad/services@1.9.0
- @buildpad/types@1.9.0
- @buildpad/utils@1.9.0

## 1.8.1

### Patch Changes

- @buildpad/hooks@1.8.1
- @buildpad/services@1.8.1
- @buildpad/types@1.8.1
- @buildpad/ui-collections@1.8.1
- @buildpad/ui-form@1.8.1
- @buildpad/utils@1.8.1

## 1.8.0

### Minor Changes

- 5c1000a: RichTextMarkdown now persists and round-trips Markdown instead of HTML. It parses the `value` prop as Markdown on load, serializes the document back to Markdown through `onChange`, and renders the preview from Markdown. Adds GFM table support so tables round-trip as real table nodes (the toolbar "table" action now inserts a table node), and reinterprets Markdown source pasted from a rendered code fence instead of trapping the whole document in a single code block.

### Patch Changes

- @buildpad/ui-form@1.8.0
- @buildpad/ui-collections@1.8.0
- @buildpad/hooks@1.8.0
- @buildpad/services@1.8.0
- @buildpad/types@1.8.0
- @buildpad/utils@1.8.0

## 1.7.0

### Minor Changes

- 6db435b: Custom permission editing for `system-permissions`: the matrix's "Use Custom"
  menu item (previously a stub) now opens a tabbed `PermissionDetailModal` with
  action-dependent tabs — Item Permissions (Directus-filter JSON with dynamic
  variables and relational-limitation warnings), Field Permissions (checkbox
  field list with `['*']` semantics, PK/alias badges, app-minimal locking),
  Field Validation, and Field Presets (JSON editors with examples). Edits flow
  through the existing `PermissionAlterations` model and are persisted by the
  host form's Save — closing the last feature-parity gap with the buildpad-daas
  policies admin. Also fixes `getPermissionLevel` to report presets-only
  permissions as `custom`, exports `APP_ACCESS_MINIMAL_PERMISSIONS`, and adds
  `fieldsByCollection`/`relations` injection props plus ported filter
  types/utils (`parseFilterToNodes`, `nodesToFilter`, operator sets) and cached
  field/relation metadata fetchers. Also removes a double border on the matrix
  under themes that default `Table` to `withTableBorder: true` (the generated app
  theme and enterprise Storybook) — the matrix `Table` now opts out, matching the
  `Paper`-wrapped card edge like the other module tables.
- e563c73: Reuse consolidation and error surfacing from the ui-users conventions audit:

  - `IconDisplay` moves into `@buildpad/ui-interfaces/select-icon`, driven by
    `SelectIcon`'s full ~190-name icon map (previously ui-users shipped its own
    18-name copy, so most picked icons fell back to a generic glyph in the
    roles/policies lists). The map and picker also gain the security/identity
    names (`shield`, `verified_user`, `admin_panel_settings`, `policy`, `key`,
    `badge`, `supervised_user_circle`, …) under a new "Security & Identity"
    category — including the daas default role/policy icons, which were
    previously not pickable. ui-users re-exports `IconDisplay` unchanged.
  - `SystemToken` gains an optional `generate` prop (custom sync/async token
    producer replacing the `/api/utils/random/string` call),
    `data-lpignore`/`data-1p-ignore` password-manager suppression, daas wording
    ("Value Securely Saved", the copy-once notice), and copy feedback via
    notifications. ui-users' `TokenInput` is now a thin wrapper over it
    (client-side `generateToken()`), replacing the previous parallel port;
    `users-management` gains a `system-token` registry dependency.
  - The three list managers now share extracted chrome: `SearchInput`,
    `ListFooter` (owns the totalCount/totalPages footer gates), `ListEmptyState`,
    and `RowActionsMenu` — all exported and registry-listed.
  - Error surfacing: a failed list load renders a distinct "Failed to load …"
    state plus a red notification instead of masquerading as "no data yet", and
    a failed row delete toasts and keeps the confirm dialog open for retry.
  - Design-system compliance: `SystemToken` scopes its monospace face to the
    input element via `styles={{ input }}` — the previous root-level `style`
    leaked monospace into the label/description while the design-system theme's
    own TextInput input override forced the input back to sans (the exact
    inverse of intended). Scheme-static grays swapped for semantic tokens:
    `--mantine-color-default-border` (list footers, matching ui-collections),
    `--mantine-color-dimmed` (empty-state/count/key icons), and
    `--mantine-color-error` (load-failure icon).

### Patch Changes

- Updated dependencies [c6dd470]
- Updated dependencies [c6dd470]
- Updated dependencies [90dc795]
  - @buildpad/ui-collections@1.8.0
  - @buildpad/hooks@1.8.0
  - @buildpad/types@1.8.0
  - @buildpad/ui-form@1.8.0
  - @buildpad/services@1.8.0
  - @buildpad/utils@1.8.0

## 1.6.0

### Patch Changes

- @buildpad/hooks@1.6.0
- @buildpad/services@1.6.0
- @buildpad/types@1.6.0
- @buildpad/ui-collections@1.6.0
- @buildpad/ui-form@1.6.0
- @buildpad/utils@1.6.0

## 1.5.0

### Patch Changes

- Updated dependencies [94604c9]
- Updated dependencies [94604c9]
  - @buildpad/hooks@1.5.0
  - @buildpad/ui-collections@1.5.0
  - @buildpad/ui-form@1.5.0
  - @buildpad/services@1.5.0
  - @buildpad/types@1.5.0
  - @buildpad/utils@1.5.0

## 1.4.1

### Patch Changes

- Updated dependencies
  - @buildpad/services@1.4.1
  - @buildpad/hooks@1.4.1
  - @buildpad/ui-collections@1.4.1
  - @buildpad/ui-form@1.4.1
  - @buildpad/types@1.4.1
  - @buildpad/utils@1.4.1

## 1.4.0

### Patch Changes

- Released in lockstep; no functional changes.

## 1.3.1

### Patch Changes

- Rich-text components (`rich-text-html`, `rich-text-markdown`) now import `@mantine/tiptap/styles.css` so the editor is styled when used.

## 1.3.0

### Patch Changes

- Released in lockstep; no functional changes.

## 1.2.0

### Patch Changes

- Styling refinements across interface components (input-hash, system-token, map, shared stories).

## 1.1.0

### Minor Changes

- **Version realignment to 1.x.** Consumer manifests written before per-package versioning recorded component versions as `1.0.0`, while packages were versioned `0.1.x`–`0.2.0` — so `npx buildpad outdated` could never detect updates (`1.0.0 >= 0.2.0`). All packages now release in lockstep from `1.1.0` so the upgrade mechanism works for every existing install.

### Patch Changes

- `Input`: the text branch now coerces non-string primitives via `String(value)` instead of rendering an empty input, so numeric values display correctly.
- `InputCode`: non-string values (arrays/objects from `json`/`csv` fields) are normalized to pretty-printed JSON instead of crashing with `.split is not a function`; for structured fields (`type` json/csv or `language="json"`), valid JSON edits emit the parsed value so the stored type is preserved on save, while invalid JSON mid-edit stays editable and emits the raw string. `InputCodeProps.value`/`onChange` widen to `unknown`.
- `SelectDropdownM2O`: option selection and active-option comparison now use the relation's target field (`relatedPrimaryKeyField.field`) instead of unconditionally `item.id`, so relations targeting a unique non-PK column (e.g. a `uri_path`) save and highlight correctly.

## 0.2.0

### Patch Changes

- Established per-package semver baseline. This package now carries its own independent version tracked via Changesets. Future releases will record component-level changes here so `npx buildpad outdated` and `npx buildpad changelog` can surface the relevant diff.
