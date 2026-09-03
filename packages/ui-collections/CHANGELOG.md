# @buildpad/ui-collections

## 2.3.0

### Minor Changes

- b799724: Internationalization, phase 2.

  **Component i18n core** (`@buildpad/utils` → `lib/buildpad/i18n/*`, `@buildpad/services`, `@buildpad/hooks`): one `BuildpadTranslations` dictionary shape with English defaults and a bundled `id` catalog, `mergeTranslations` / `interpolate` / `formatCount` (Intl.PluralRules) helpers, and `BuildpadI18nProvider` + `useBuildpadI18n()` / `useBuildpadTranslations()` for locale, direction, pinned-time-zone `formatDate`, `formatNumber` and dictionary lookup. Without a provider every component keeps its English defaults and browser formatting, so existing consumers are untouched. Precedence is component prop > provider dictionary > defaults. `ListM2M`'s `translations` module now re-exports the shared `interfaces.listM2M` namespace (same API).

  **CLI shell — every scaffolded app is locale-ready** (`@buildpad/cli`): a new `i18n` lib module (`lib/i18n/*`: locale config, Accept-Language negotiation, server-loaded dictionaries, an app `I18nProvider` that also mounts `BuildpadI18nProvider`, `useLocaleRouter()` / `useSwitchLocale()`, content-translation query helpers, `components/LanguageSwitcher.tsx`). The root layout moves to `app/[lang]/layout.tsx` (`generateStaticParams`, `notFound()` for unknown locales, `<html lang dir>`, `DirectionProvider`); every page/layout entry of `api-routes`, `content-routes`, `files-routes`, `users-routes`, `forms-routes` and `scope-routes` is retargeted under `app/[lang]/`; `middleware.ts` redirects unprefixed requests to the negotiated locale before refreshing the session; `lib/supabase/middleware.ts` gates routes with the prefix stripped; the login page, app shell (`localeHref`, `stripLocale`, dictionary `labelKey`s, a built-in `LanguageSwitcher` and a `headerActions` slot) and all route pages use the dictionary and the locale-aware router. `app/api/auth/user` gains a field-restricted `PATCH` (language, theme, first_name, last_name, avatar) proxying DaaS `/users/me`, which is what the `LanguageSwitcher` uses to remember a locale choice across devices. `buildpad init|bootstrap --locales en,id [--default-locale en]` configures locales; `buildpad migrate i18n` moves an existing app onto `app/[lang]`; `upgrade` installs lib-module dependencies a release introduces; `validate` flags a duplicate root layout or a missing i18n module.

  **Every package reads its strings from the shared dictionary** (`ui-form`, `ui-table`, `ui-collections`, `ui-interfaces`, `ui-files`, `ui-users`, `ui-forms`, and the relation hooks in `@buildpad/hooks`): ~1,700 user-facing literals moved into `lib/buildpad/i18n/namespaces/*` with English defaults and a complete Bahasa Indonesia catalog. English output is unchanged; mount `BuildpadI18nProvider` (the CLI's `I18nProvider` does it) to render another locale. Main components gained a `translations` prop for per-instance overrides (VForm, VTable, CollectionList, CollectionForm, FileManager, UsersManager, FormBuilder, Upload, ListM2M/O2M/M2A, …); existing text props (`loadingText`, `noItemsText`, ListM2M `translations`) keep precedence. Dates and numbers shown by these components go through the provider's `formatDate`/`formatNumber` (browser locale and zone without a provider, pinned zone with one) — two visible differences: item counts are digit-grouped for the locale (`1,234 items`), and a cell holding an invalid date renders empty instead of "Invalid Date". The `DateTime` interface loads dayjs locale data on demand and localises its calendar. Storybook has a Locale toolbar (`en`, `id`, `ar` for RTL). `InterfaceErrorBoundary` is now a function-component wrapper around the class (same JSX usage). The ESLint rule `buildpad/no-untranslated-literal` guards the migrated packages. A dictionary slot counts as a plural entry only when every key is a CLDR category, so overriding `interfaces.selectRadio.other` no longer drops that namespace's sibling strings.

### Patch Changes

- Updated dependencies [b799724]
  - @buildpad/utils@2.3.0
  - @buildpad/services@2.3.0
  - @buildpad/ui-form@2.3.0
  - @buildpad/ui-table@2.3.0
  - @buildpad/types@2.3.0

## 2.2.0

### Patch Changes

- @buildpad/ui-table@2.2.0
- @buildpad/services@2.2.0
- @buildpad/types@2.2.0
- @buildpad/ui-form@2.2.0
- @buildpad/utils@2.2.0

## 2.1.0

### Minor Changes

- 02324ef: CollectionForm: don't strip a manually-entered primary key just because it's named "id".

  `SYSTEM_FIELDS`/`READ_ONLY_FIELDS` matched the primary key purely by name (`"id"`), so a collection whose PK type is a manually-entered string (`schema.is_primary_key: true`, `has_auto_increment: false`, no `uuid` special) had its `id` field silently dropped from the create/edit form and stripped from the save payload — even though the DaaS admin explicitly configured it as user-supplied. On create this produced a NOT NULL constraint violation on the PK column; in a collection where the PK is the only non-system field, it left a permanently empty form ("No editable fields found") with a permanently disabled submit button.

  The resolved PK is now only treated as system-managed when it is actually generated — a manually-entered PK stays visible, writable, and part of the create/update payload, and edits to it now count toward `hasEdits`. Other system fields (`user_created`, `user_updated`, `date_created`, `date_updated`, `sort`) are unaffected.

  The classification defaults to "generated" and requires positive evidence that a user has to type the value: `has_auto_increment`, a `uuid` type or special, a DB-side `default_value` (`gen_random_uuid()`, `nextval(...)` — these report `has_auto_increment: false`), or `meta.readonly`. Defaulting the other way misclassifies every shape not enumerated, and because the field filter has no `meta.hidden` check, `SYSTEM_FIELDS` is the only thing keeping `id` off the form — so a miss puts a stray `id` control on the create form. In particular the baseline `id` that `createCollection` writes is a uuid with `has_auto_increment: false` and no `meta.special`, so a narrower test would have surfaced it on every collection created through Buildpad's own flow.

### Patch Changes

- @buildpad/services@2.1.0
- @buildpad/types@2.1.0
- @buildpad/ui-form@2.1.0
- @buildpad/ui-table@2.1.0
- @buildpad/utils@2.1.0

## 2.0.0

### Patch Changes

- @buildpad/services@2.0.0
- @buildpad/types@2.0.0
- @buildpad/ui-form@2.0.0
- @buildpad/ui-table@2.0.0
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

- 565448a: Modal CollectionForm submits stay contained, and ListO2M's Create New no longer pre-fills the '+' placeholder as the child's FK.

  - CollectionForm's submit handler now stops propagation: callers render it inside a portaled Mantine Modal, and React bubbles the synthetic submit along the component tree — so saving the inner form also submitted an ancestor page form with its stale changeset.
  - ListO2M only pre-fills the reverse FK default when the parent is actually saved; for an unsaved parent ('+' placeholder) the link is staged into the changeset on save, as before — but the literal "+" no longer leaks into the created child's FK field.

- c6db1e6: CollectionForm's edit fetch no longer requests O2M/M2M/M2A fields bare.

  readOne(id) with no fields argument fell back to the backend's select-everything default, which includes relational alias fields bare — some DaaS backends 500 resolving these without explicit nested syntax, making the edit form unopenable for any collection with such a field (confirmed against a live instance: fields=id,title succeeds, fields=\* 500s on a pages record with an M2A blocks field). The fetch now passes an explicit fields list built from editableFields with O2M/M2M/M2A fields excluded (matched by meta.special or interface, same signal as CollectionList; M2O keeps its real FK column) and the primary key force-included. The relational interfaces load their own data via their hooks, so nothing is lost.

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

- ce313ea: CollectionList no longer strands users on pages that hold nothing when DaaS reports an estimated total.

  DaaS defaults `meta.total` to the query planner's estimate on large collections (exact below the server's row threshold), and a stale estimate can be off by hundreds of thousands of rows in either direction — measured 5,322,335 reported against 5,002,621 real rows, which made the pager offer ~32,000 empty pages. CollectionList treated the number as exact.

  - Landing on a page past the real end of the collection now steps back to the last page that exists instead of rendering an empty table beneath a footer that claims rows. The overshot page is never painted.
  - A total the server proves exact (`meta.total_estimated: false` — sent by DaaS from v0.1.93) is pinned for the current query, so later estimated responses cannot resurrect the phantom page buttons the server already disproved. The pin clears whenever the matching set changes (collection, search, filters, archive mode), on deletes through the list, and on manual refresh. Against a server that never sends the flag, behavior is unchanged.
  - Responses are guarded by a per-call request id, so an out-of-order response from a superseded load can no longer overwrite fresher state — which matters more now that a response can move the page.
  - A non-finite `meta.total` falls back to counting the received rows instead of feeding NaN into the page math.

- d38d37c: CollectionList no longer requests O2M/M2M/M2A fields as bare columns.

  The default-visible-fields filter only excluded fields whose column type is "alias", but some DaaS backends report the physical type (e.g. text) for relational fields — their bare name then landed in the list view's fields= query and 500'd the backend ("column pages_blocks_1.undefined does not exist"). Fields are now also excluded when meta.special contains m2a/m2m/o2m or the interface is list-m2a/m2m/o2m — the backend-agnostic signal, same policy as CollectionForm's edit-fetch exclusion. M2O fields keep their real FK column and remain visible.

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

- 1226ec5: ListM2M: resolve the display-template label immediately when picking or creating an item, not just after save+reload.

  Picking an item via "Add Existing" only ever staged `{ [junctionField]: { id } }` locally, so a display template referencing e.g. `name` had nothing to resolve against and rendered a blank label until the parent form was saved and the list reloaded — most visible when adding a relation on a brand-new, unsaved parent, where no reload ever happens.

  The select modal has already loaded the rows it is showing, so `BulkAction.action` now receives them alongside the selected ids (`(selectedIds, selectedRows?)` — a new optional parameter, so existing bulk actions are unaffected), and the modal's list is asked for whatever fields the display template needs. `ListM2M` passes those rows to `selectItems`, which keeps them in display-only state so the label resolves immediately, with no extra request and no await between the click and the modal closing. "Create New" does the same with the record `CollectionForm` just returned.

  The staged junction payload deliberately stays reference-only (exactly the related primary key): `CollectionForm` distinguishes "link this existing row" from "deep-create a new one" by that object carrying nothing else, so display fields must never be merged into it. A regression test in `@buildpad/hooks` now pins that contract against the same flatten logic the save path uses.

- 1523349: M2M: alias the junction PK onto `.id`, fix the junction save path, and make ListM2M refetch on a record switch.

  - **Junction updates are no longer silently dropped on save.** `CollectionForm`'s M2M flush read the junction row's PK as a hardcoded `entry.id`, while the hook keys its staged update entries by the junction's real PK column. For any junction table whose PK isn't named `id`, every staged update (reorder, junction-field edit) was skipped and the save still reported success. The junction PK is now resolved from the schema and read by name, and a key mismatch throws instead of skipping.
  - **`useRelationMultipleM2M` aliases the junction PK onto `.id` for fetched items** (previously only locally-created ones got it), so `ListM2M`'s React keys, DnD sortable ids and drag-end matching work for junctions whose PK isn't `id`. The alias is applied after local edits are overlaid (a staged edit can carry its own `id`) and falls back to the row's existing `id` when the PK column is absent from the response, rather than overwriting every row's identity with `undefined`.
  - **Staged changes are discarded when the parent record changes.** Previously they survived, so navigating between records without a remount let record 1's staged links and deletions ride onto record 2 — and saving record 2 also mutated record 1.
  - **`existingItemCount` is inferred from page fullness** instead of `meta.total_count`, which on this backend is the unfiltered collection count. It reported the whole junction table as one parent's count, which disabled drag-and-drop entirely, hid staged creates behind a bogus page count, and rendered phantom pagination.
  - **`ListM2M` refetches when `primaryKey` switches to another record** (the load-signature dedupe omitted it, so the previous record's rows stayed on screen), and clears them when switching to an unsaved parent. `refreshKey` is compared separately from the signature so a record switch that also clears `value` doesn't fire the same query twice. Page, search and selection reset on the switch, and a failed load no longer poisons the dedupe permanently.
  - **Multi-select assigns distinct sort values.** Every id in one batch previously got the same value, losing the chosen order on save.
  - **The select modal's "already linked" exclusion covers every page**, not just the loaded one — it was offering items already linked elsewhere, staging duplicate links.
  - Smaller fixes: a guarded load no longer strands the loading state, and the junction-fields form is hidden for not-yet-saved rows rather than fetching a `$new-` sentinel id.

- Updated dependencies [585362e]
- Updated dependencies [6d724ee]
- Updated dependencies [89f532b]
- Updated dependencies [c67c651]
- Updated dependencies [ddbc1bd]
- Updated dependencies [50a4057]
- Updated dependencies [08127f0]
- Updated dependencies [d5c9eee]
- Updated dependencies [577eda9]
- Updated dependencies [4026571]
  - @buildpad/utils@1.11.1
  - @buildpad/ui-form@1.11.1
  - @buildpad/ui-table@1.11.1
  - @buildpad/services@1.11.1
  - @buildpad/types@1.11.1

## 1.10.0

### Patch Changes

- Updated dependencies [5981327]
  - @buildpad/types@1.10.0
  - @buildpad/services@1.10.0
  - @buildpad/ui-table@1.10.0
  - @buildpad/utils@1.10.0
  - @buildpad/ui-form@1.10.0

## 1.9.3

### Patch Changes

- Make CollectionList pagination footer sticky horizontally and vertically when scrolling.
- 3c55e13: adjust flex property on CollectionList to prevent empty space issue
  - @buildpad/ui-form@1.9.3
  - @buildpad/services@1.9.3
  - @buildpad/types@1.9.3
  - @buildpad/ui-table@1.9.3
  - @buildpad/utils@1.9.3

## 1.9.2

### Patch Changes

- 0a7e18d: Resolve vertical scrolling issues on collections table and height/scroll-sync bugs on code input editor.
- Updated dependencies [0a7e18d]
  - @buildpad/ui-table@1.9.2
  - @buildpad/ui-form@1.9.2
  - @buildpad/services@1.9.2
  - @buildpad/types@1.9.2
  - @buildpad/utils@1.9.2

## 1.9.1

### Patch Changes

- @buildpad/ui-form@1.9.1
- @buildpad/services@1.9.1
- @buildpad/types@1.9.1
- @buildpad/ui-table@1.9.1
- @buildpad/utils@1.9.1

## 1.9.0

### Patch Changes

- @buildpad/ui-form@1.9.0
- @buildpad/services@1.9.0
- @buildpad/types@1.9.0
- @buildpad/ui-table@1.9.0
- @buildpad/utils@1.9.0

## 1.8.1

### Patch Changes

- @buildpad/services@1.8.1
- @buildpad/types@1.8.1
- @buildpad/ui-form@1.8.1
- @buildpad/ui-table@1.8.1
- @buildpad/utils@1.8.1

## 1.8.0

### Patch Changes

- @buildpad/ui-form@1.8.0
- @buildpad/services@1.8.0
- @buildpad/types@1.8.0
- @buildpad/ui-table@1.8.0
- @buildpad/utils@1.8.0

## 1.7.0

### Patch Changes

- c6dd470: `CollectionForm`'s split save button (Save + SaveOptions caret) no longer
  renders with a gap in host apps whose Mantine theme forces `Group` gap via
  `theme.components.Group.styles.root` — theme styles are applied inline and
  override the `gap={0}` prop, so the group now also sets an inline
  `style={{ gap: 0 }}`, which takes precedence over both.
- c6dd470: `CollectionList` and `CollectionForm` no longer assume every collection has an
  `id` primary key column. Both components now resolve the real PK from field
  metadata (`schema.is_primary_key`), falling back to `id`, with the
  `primaryKeyField` prop kept as an explicit override.

  Previously, on a collection whose PK is not named `id` (e.g. `code`, `sku`):

  - `CollectionList` injected `id` into the `fields` query parameter of every
    list request, so the DaaS API returned HTTP 500
    (`column <table>.id does not exist`) and the list never rendered.
  - The total record count used `aggregate[count]=id` and failed silently.
  - `CollectionForm` read the created record's key from `result.id`, breaking
    M2M relation persistence and copy-mode after create.

  `onItemClick` now also receives the item's primary key value as a second
  argument so consumers can navigate without hardcoding `item.id`.

- Updated dependencies [90dc795]
  - @buildpad/types@1.8.0
  - @buildpad/ui-form@1.8.0
  - @buildpad/ui-table@1.8.0
  - @buildpad/services@1.8.0
  - @buildpad/utils@1.8.0

## 1.6.0

### Patch Changes

- @buildpad/services@1.6.0
- @buildpad/types@1.6.0
- @buildpad/ui-form@1.6.0
- @buildpad/ui-table@1.6.0
- @buildpad/utils@1.6.0

## 1.5.0

### Patch Changes

- @buildpad/ui-table@1.5.0
- @buildpad/ui-form@1.5.0
- @buildpad/services@1.5.0
- @buildpad/types@1.5.0

## 1.4.1

### Patch Changes

- Updated dependencies
  - @buildpad/services@1.4.1
  - @buildpad/ui-form@1.4.1
  - @buildpad/ui-table@1.4.1
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

### Minor Changes

- Design-token and styling refinements across `ContentLayout`, `CollectionList`, and `ContentNavigation`.

## 1.1.0

### Minor Changes

- **Version realignment to 1.x.** Consumer manifests written before per-package versioning recorded component versions as `1.0.0`, while packages were versioned `0.1.x`–`0.2.0` — so `npx buildpad outdated` could never detect updates (`1.0.0 >= 0.2.0`). All packages now release in lockstep from `1.1.0` so the upgrade mechanism works for every existing install.

## 0.2.0

### Patch Changes

- Established per-package semver baseline. This package now carries its own independent version tracked via Changesets. Future releases will record component-level changes here so `npx buildpad outdated` and `npx buildpad changelog` can surface the relevant diff.
