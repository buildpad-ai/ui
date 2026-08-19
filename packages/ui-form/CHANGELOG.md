# @buildpad/ui-form

## 1.11.1

### Patch Changes

- 6d724ee: Selection quick-wins across Radio, CheckboxTree, Icon, MultiDropdown, Checkbox, and the form pipeline.

  - SelectMultipleCheckboxTree: search queries containing regex special characters no longer crash the field; label ids use useId() instead of Math.random() (SSR hydration); per-node disabled flag.
  - SelectMultipleCheckbox: per-option disabled flag; the allowOther swatch detects hex/rgb/hsl colors and styles via color-mix instead of producing invalid var(--mantine-color-...) names.
  - SelectMultipleDropdown: clearable is no longer gated behind allowNone; the selection-order sort copies Mantine's array instead of mutating it; aria-label is forwardable.
  - SelectRadio: the "Other" option stays checked while its input is open before any text is typed; aria-label is forwardable.
  - SelectIcon: formatTitle/renderIcon guard non-string values instead of throwing; aria-label forwarded to the trigger when no visible label is set.
  - FormFieldInterface forwards readonly state as the camelCase readOnly prop the interfaces actually consume.

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

- 4026571: Multi-select interfaces on csv-stored fields no longer receive raw comma-strings.

  The three multi-select interfaces are registered for both json (array) and csv (comma-string) storage, but the leaves are array-only — a csv field delivered a raw string into array logic (substring-match reads, character-spread corruption on toggle, TypeErrors on .filter/.map). FormFieldInterface now normalizes once in the pipeline: csv strings are split to arrays on the way in, and leaf-emitted arrays are joined back to comma-strings on the way out — including for fields whose backend reports the physical column type (e.g. text) instead of csv, detected by observing string storage. Known residual: an empty csv-as-text field has nothing to observe, so its first-ever write emits an array.

  Also bootstraps jest for @buildpad/ui-form (config, script, devDependencies) — this package had no test infrastructure at all.

- Updated dependencies [585362e]
- Updated dependencies [6d724ee]
- Updated dependencies [89f532b]
- Updated dependencies [565448a]
- Updated dependencies [c67c651]
- Updated dependencies [b8b5344]
- Updated dependencies [a22729a]
- Updated dependencies [ddbc1bd]
- Updated dependencies [50a4057]
- Updated dependencies [08127f0]
- Updated dependencies [d5c9eee]
- Updated dependencies [577eda9]
- Updated dependencies [c6baa06]
- Updated dependencies [27a2515]
- Updated dependencies [6375036]
- Updated dependencies [2b8413c]
- Updated dependencies [0408b2c]
- Updated dependencies [12f823c]
- Updated dependencies [594c277]
- Updated dependencies [2be8218]
- Updated dependencies [1226ec5]
- Updated dependencies [1bf1731]
- Updated dependencies [46afe83]
- Updated dependencies [5056ef3]
- Updated dependencies [7b415ad]
- Updated dependencies [1523349]
- Updated dependencies [ad9c415]
- Updated dependencies [1f2bcff]
- Updated dependencies [925e201]
- Updated dependencies [4a31fb5]
- Updated dependencies [24ebfc2]
- Updated dependencies [0ad17fc]
- Updated dependencies [432125d]
- Updated dependencies [2f6ad88]
- Updated dependencies [4becd38]
- Updated dependencies [5802243]
- Updated dependencies [4355c8e]
- Updated dependencies [79c22f7]
- Updated dependencies [af56a74]
- Updated dependencies [eb662e3]
- Updated dependencies [ee5bbd6]
- Updated dependencies [4aad6ac]
- Updated dependencies [a5478f4]
- Updated dependencies [e078a74]
- Updated dependencies [4355f4d]
  - @buildpad/ui-interfaces@1.11.1
  - @buildpad/utils@1.11.1
  - @buildpad/services@1.11.1
  - @buildpad/types@1.11.1

## 1.10.0

### Patch Changes

- Updated dependencies [4976915]
- Updated dependencies [2e6bee7]
- Updated dependencies [5981327]
  - @buildpad/ui-interfaces@1.10.0
  - @buildpad/types@1.10.0
  - @buildpad/services@1.10.0
  - @buildpad/utils@1.10.0

## 1.9.3

### Patch Changes

- @buildpad/ui-interfaces@1.9.3
- @buildpad/services@1.9.3
- @buildpad/types@1.9.3
- @buildpad/utils@1.9.3

## 1.9.2

### Patch Changes

- Updated dependencies [0a7e18d]
  - @buildpad/ui-interfaces@1.9.2
  - @buildpad/services@1.9.2
  - @buildpad/types@1.9.2
  - @buildpad/utils@1.9.2

## 1.9.1

### Patch Changes

- Updated dependencies [a453388]
  - @buildpad/ui-interfaces@1.9.1
  - @buildpad/services@1.9.1
  - @buildpad/types@1.9.1
  - @buildpad/utils@1.9.1

## 1.9.0

### Patch Changes

- Updated dependencies [5bf4320]
  - @buildpad/ui-interfaces@1.9.0
  - @buildpad/services@1.9.0
  - @buildpad/types@1.9.0
  - @buildpad/utils@1.9.0

## 1.8.1

### Patch Changes

- @buildpad/services@1.8.1
- @buildpad/types@1.8.1
- @buildpad/ui-interfaces@1.8.1
- @buildpad/utils@1.8.1

## 1.8.0

### Patch Changes

- Updated dependencies [5c1000a]
  - @buildpad/ui-interfaces@1.8.0
  - @buildpad/services@1.8.0
  - @buildpad/types@1.8.0
  - @buildpad/utils@1.8.0

## 1.7.0

### Patch Changes

- Updated dependencies [6db435b]
- Updated dependencies [90dc795]
- Updated dependencies [e563c73]
  - @buildpad/ui-interfaces@1.8.0
  - @buildpad/types@1.8.0
  - @buildpad/services@1.8.0
  - @buildpad/utils@1.8.0

## 1.6.0

### Patch Changes

- @buildpad/services@1.6.0
- @buildpad/types@1.6.0
- @buildpad/ui-interfaces@1.6.0
- @buildpad/utils@1.6.0

## 1.5.0

### Patch Changes

- @buildpad/ui-interfaces@1.5.0
- @buildpad/services@1.5.0
- @buildpad/types@1.5.0
- @buildpad/utils@1.5.0

## 1.4.1

### Patch Changes

- Updated dependencies
  - @buildpad/services@1.4.1
  - @buildpad/ui-interfaces@1.4.1
  - @buildpad/types@1.4.1
  - @buildpad/utils@1.4.1

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

- Styling refinements in `VForm`.

## 1.1.0

### Minor Changes

- **Version realignment to 1.x.** Consumer manifests written before per-package versioning recorded component versions as `1.0.0`, while packages were versioned `0.1.x`–`0.2.0` — so `npx buildpad outdated` could never detect updates (`1.0.0 >= 0.2.0`). All packages now release in lockstep from `1.1.0` so the upgrade mechanism works for every existing install.

## 0.2.0

### Patch Changes

- Established per-package semver baseline. This package now carries its own independent version tracked via Changesets. Future releases will record component-level changes here so `npx buildpad outdated` and `npx buildpad changelog` can surface the relevant diff.
