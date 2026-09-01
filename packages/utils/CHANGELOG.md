# @buildpad/utils

## 2.1.0

### Patch Changes

- @buildpad/types@2.1.0

## 2.0.0

### Patch Changes

- @buildpad/types@2.0.0

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

- 89f532b: CLI: deliver `conceal.ts`, close the stranded utils exports, and make the registry hash platform-independent.

  `utils/src/conceal.ts` was never registered as a `utils` lib file, so `buildpad add/upgrade utils` had no way to deliver it. Five registry-delivered files already imported it — `InputHash`, `SystemToken`, `FormFieldInterface`, `CollectionForm` and `FormField` — and failed to build in consumer projects. It is now registered as `lib/buildpad/conceal.ts` and re-exported from the utils barrel.

  The barrel had also drifted across three separate commits, not one. Alongside conceal's members it now re-exports `getDefaultValuesFromFields`, `resolveChoiceLabel`, `parseChoiceValues`, `splitCsvValue`, `InterfaceChoice`, `MISSING_FIELD_MARKER`, the auto-generation helpers, and the `interface-types` / `interface-registry` / `define-interface` modules — all of which ship to consumers but had no reachable export path.

  Also fixed, because the drift was undetectable rather than unlucky:

  - `computeFileSha256` now hashes line-ending-normalised content, and a `.gitattributes` pins `eol=lf`. Hashing raw bytes made the registry platform-dependent: generated on a CRLF checkout, its hashes could never match an LF checkout, so `pnpm registry:check` failed permanently and its output was pure noise. `registry:check` now passes.
  - CI runs build, typecheck and unit tests _before_ the registry check. Fail-fast meant the red check aborted the job before any of them ran.
  - `collectUndeclaredImports` now scans `registry.lib`, resolving relative imports in target space. It previously covered components only, which is why a barrel could re-export a module that was not a registry file at all.
  - `@buildpad/cli` is now a known package folder, so `cli/templates/*` files are no longer exempt from the version guard.
  - `build-registry.mjs` only self-executes when invoked directly. The previous guard was always true, so importing it — as the test suite does — rewrote the checked-in `registry.json`.
  - `buildpad upgrade <lib>` no longer reports "up to date" when a registered file is missing on disk. A module that gains a file could not be delivered by version comparison alone, because the version cannot move until a release.
  - `buildpad add` no longer rewrites existing lib files when a module gains one. Adding a file made the "already installed" check fail, and every consumer's customised copies were silently overwritten.
  - The CLI now verifies fetched sources against the registry's `sourceSha256` and warns on mismatch. The field was written but never read.
  - `useModuleAccessKeys` and `module-access-keys` are registered and exported, and the types barrel re-exports `module-access`. `buildpad add users-management` previously produced a project that could not build.

- c67c651: CollectionForm: seed create-mode form data from each field's own schema `default_value`, and parse that default properly.

  Create mode only ever seeded initial form data from the `defaultValues` prop and permission presets, so a field's column-level default (e.g. `status DEFAULT 'active'`) never reached the create payload — the database applied it server-side instead, and nothing the user saw reflected it. It is now seeded from the field's own schema.

  **Precedence.** The schema default is the _weakest_ signal and is merged last, underneath both a permission preset and an explicit `defaultValues` prop. Presets are how a role forces a value on create (`status`, `owner`, `tenant_id`), so a column default must never beat one.

  **Only fields the user can write and can see are seeded.** Everything in `formData` is sent on create, so seeding a field outside the role's write permission would put that field in the payload for the role to be rejected on, and seeding a condition-hidden field would persist a value the user was never shown. Write permission is checked in its own right rather than via the `meta.readonly` flag alone, because a form definition's per-field config is overlaid afterwards and can reset `readonly` to false.

  **Reuse.** The seeding calls the shared `getDefaultValuesFromFields`, which moves to `@buildpad/utils` beside the parser it wraps; `@buildpad/ui-form` re-exports it under the same name for its existing consumers. VForm already derived the same map for display, so keeping a second copy in CollectionForm meant the value the form showed and the value it submitted came from two rules that could drift.

  **`handleFormUpdate` replaces rather than merges.** VForm always emits the complete model, including when it drops a key because the value returned to the field's initial/default. Merging kept the dropped key at its stale value, so re-selecting a field's own default visibly snapped the control back to the previous choice and submitted that instead. This became reachable precisely because the cast fix below makes the parsed default compare equal to what the user picked.

  `getFieldDefault` is rewritten around an actual SQL-literal parse instead of substring tests, fixing a set of defects that this seeding would otherwise have written to rows:

  - **Cast suffixes.** Postgres appends the column type to a literal default, and the type name is not just words: it carries length/precision (`character varying(255)`, `numeric(10,2)`), array dimensions (`text[]`), schema qualification (`public.status_enum`), quoted identifiers (`"OrderStatus"`) and multi-word spellings, and casts can chain. Everything the old `[\w\s]` match missed was returned as raw SQL text.
  - **Parentheses.** The generated-default guard tested for a bare `(` anywhere, which discarded every parameterized cast _and_ every ordinary literal whose text contains a parenthesis (`'Acme (US)'`). It now recognises a function call as an identifier followed by `(`, and a quoted literal is read first so a parenthesis inside the text is never syntax.
  - **Keyword defaults.** `CURRENT_DATE`, `CURRENT_USER`, `LOCALTIMESTAMP`, lower-cased `current_timestamp` and `NULL` carry no parentheses, so nothing caught them and they were returned as literal strings. They are generated defaults and now yield `undefined`.
  - **Quote escaping.** `''` is SQL's escape for an embedded quote; `'It''s'` returned `It''s`.
  - **Falsy defaults.** Only `null`/`undefined` mean "no default" — `0`, `false` and `''` are real defaults that a falsy test dropped, so a column defaulting to `false` behaved differently from its sibling defaulting to `true`.
  - **Already-parsed defaults.** `default_value` is typed `unknown`; some backends return it parsed. `String()` turned `{}` into `"[object Object]"` and `[]` into the number `0`.
  - **Type-directed parsing.** The parse now consults the field's declared type instead of guessing from the shape of the text: a `json`/`jsonb` default is parsed into a value rather than left as the string `"{}"`, a numeric column yields a number even when the literal is quoted (`'-1'::integer`), and a string column keeps its string — `'007'` stayed `007` instead of becoming `7`. An integer beyond the safe range is left as text rather than silently shifted.

  `FormField` and `FormFieldInterface` route the column default through the same parser instead of handing the raw SQL text to the rendered control.

- ddbc1bd: CollectionList: resolve select/radio/multi-select values to their configured choice label (S8.3).

  `fieldTypeRenderCell` had no case for a choice-authoring field's `meta.options.choices` — a scalar select-dropdown/radio field showed its raw stored value (e.g. `"draft"` instead of the configured label `"Draft"`), and an array/csv-stored multi-select value fell through to the generic JSON-badge case, showing a content-less `"JSON"` badge instead of the selected labels. Now resolves scalar and array values through the field's choices, falling back to the raw value only when no configured choice matches.

  The resolution dispatches on the field's **interface**, a different axis from the column type the rest of `fieldTypeRenderCell` switches on, so it runs ahead of the type chain rather than inside it: `select-dropdown` is declared for `integer`, `bigInteger`, `float` and `decimal` as well as `string`, and from inside the chain a numeric choice field never reached it — the numeric branch re-formatted the value through `toLocaleString()`, so a choice valued `1000` rendered as `"1,000"`: neither its label nor its stored value. A field is treated as a choice field only when its interface is one of `CHOICE_INTERFACES`, so a non-choice field that happens to carry `options.choices` keeps its own rendering, and an unresolvable `json` payload keeps its JSON badge.

  `@buildpad/utils` gains `resolveChoiceLabel`, `parseChoiceValues` and `splitCsvValue`. Matching a stored value against a choice, and reading the three shapes a multi-select is persisted in (a real array, a JSON array still encoded as a string, and csv), are shared rules rather than list-rendering details — the form and the list have to agree on what a stored value means. `resolveChoiceLabel` matches exactly before falling back to a stringified comparison, so a value stored as `1` resolves to the choice authored as `1` and not to an earlier one authored as `"1"`.

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

- 577eda9: interface-catalog: add the missing `select-multiple-checkbox-tree` entry (S4.4/S8.4).

  `PROVISIONABLE_INTERFACES` had no entry for the checkbox-tree interface even though `select-multiple-checkbox-tree` is a real, resolvable interface id (`field-interface-mapper.ts` already has a `case` for it), `registry.json` already publishes it, and the component already ships from `@buildpad/ui-interfaces`. The catalog is what drives both in-repo pickers — `AddFieldModal` (via `provisionableInterfacesForType`) and `FieldPalette` (via `CATALOG_GROUPS`) — so until now a form author simply could not create a checkbox-tree field. It is also added to `CHOICE_INTERFACES` so the choices editor and the zero-choices save guard (`interfaceRequiresChoices`) treat it like the other choice-authoring interfaces.

  Both halves are new, and two limits are worth knowing rather than rediscovering later:

  - **The builder can only author a flat tree.** `ChoicesInput` is a `label=value` per-line textarea whose `Choice` is `{ text, value }`, while `TreeChoice` carries `children`. A tree field created through the form builder is therefore a single-level list; nested trees still have to come from DaaS-authored or hand-written `meta.options.choices`. `valueCombining` likewise has no editor and stays `'all'`.
  - **`types` mirrors `registry.json`, not the leaf's standalone capability.** That distinction is now documented in the catalog's module docstring.

  Supporting fixes so the new entry is actually sound end to end:

  - **`@buildpad/ui-interfaces`** — `SelectMultipleCheckboxTree` gained the `type` + normalize + re-serialize trio its two multi-select siblings already had. It is registered for `types: ['json', 'csv']` and the registry ships it standalone (`internalDependencies: []`), so a CLI-installed consumer renders it with no pipeline in front of it; a raw comma-string previously produced substring-matched reads via `String.includes`, character-spread writes, and a `TypeError: currentValue.filter is not a function` on the first uncheck. Tokens parsed out of a csv string are also mapped back to the declared choice value's type, so numeric choices on a csv column match instead of silently appending duplicates. A `null` value (the initial state of a nullable column) no longer crashes on mount, and the component now accepts a forwarded `aria-label` instead of announcing every tree field as "Tree selection".
  - **`@buildpad/ui-forms`** — `FormPreview.stories.tsx` had its own stale copy of `CHOICE_INTERFACES`, which would have rendered the new entry as "Choices option configured incorrectly" in the story that exists to prove every catalogued interface renders; it now imports the shared set. `FieldPalette` gained the `IconListTree` mapping `registry.json` already names, instead of falling back to the glyph already used by rich text.
  - **Tests** — the catalog is now pinned against `registry.json` in both directions, so a missing entry or a drifted `types` fails instead of shipping silently; the renderer-resolution check covers every declared type rather than only `types[0]`; and `csv` compatibility, previously unasserted, is now exhaustive.
  - @buildpad/types@1.11.1

## 1.10.0

### Patch Changes

- Updated dependencies [5981327]
  - @buildpad/types@1.10.0

## 1.9.3

### Patch Changes

- @buildpad/types@1.9.3

## 1.9.2

### Patch Changes

- @buildpad/types@1.9.2

## 1.9.1

### Patch Changes

- @buildpad/types@1.9.1

## 1.9.0

### Patch Changes

- @buildpad/types@1.9.0

## 1.8.1

### Patch Changes

- @buildpad/types@1.8.1

## 1.8.0

### Patch Changes

- @buildpad/types@1.8.0

## 1.7.0

### Patch Changes

- Updated dependencies [90dc795]
  - @buildpad/types@1.8.0

## 1.6.0

### Patch Changes

- @buildpad/types@1.6.0

## 1.5.0

### Patch Changes

- @buildpad/types@1.5.0

## 1.4.1

### Patch Changes

- @buildpad/types@1.4.1

## 1.4.0

### Patch Changes

- Released in lockstep; no functional changes.

## 1.3.1

### Patch Changes

- Released in lockstep; no functional changes.

## 1.3.0

### Patch Changes

- Released in lockstep; no functional changes.

## 1.2.0

### Patch Changes

- Released in lockstep; no functional changes.

## 1.1.0

### Minor Changes

- **Version realignment to 1.x.** Consumer manifests written before per-package versioning recorded component versions as `1.0.0`, while packages were versioned `0.1.x`–`0.2.0` — so `npx buildpad outdated` could never detect updates (`1.0.0 >= 0.2.0`). All packages now release in lockstep from `1.1.0` so the upgrade mechanism works for every existing install.

### Patch Changes

- `getExplicitInterface`: the explicit `"input"` interface no longer hardcodes `type: "string"`, so the field's actual type (`integer`, `decimal`, …) reaches the `Input` component and numeric fields render as number inputs. Field options can still override `type`.

## 0.2.0

### Patch Changes

- Established per-package semver baseline. This package now carries its own independent version tracked via Changesets. Future releases will record component-level changes here so `npx buildpad outdated` and `npx buildpad changelog` can surface the relevant diff.
