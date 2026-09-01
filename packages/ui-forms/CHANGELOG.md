# @buildpad/ui-forms

## 2.1.0

### Patch Changes

- Updated dependencies [02324ef]
  - @buildpad/ui-collections@2.1.0
  - @buildpad/ui-interfaces@2.1.0
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
- @buildpad/ui-interfaces@2.0.0
- @buildpad/utils@2.0.0

## 1.11.1

### Patch Changes

- 577eda9: interface-catalog: add the missing `select-multiple-checkbox-tree` entry (S4.4/S8.4).

  `PROVISIONABLE_INTERFACES` had no entry for the checkbox-tree interface even though `select-multiple-checkbox-tree` is a real, resolvable interface id (`field-interface-mapper.ts` already has a `case` for it), `registry.json` already publishes it, and the component already ships from `@buildpad/ui-interfaces`. The catalog is what drives both in-repo pickers — `AddFieldModal` (via `provisionableInterfacesForType`) and `FieldPalette` (via `CATALOG_GROUPS`) — so until now a form author simply could not create a checkbox-tree field. It is also added to `CHOICE_INTERFACES` so the choices editor and the zero-choices save guard (`interfaceRequiresChoices`) treat it like the other choice-authoring interfaces.

  Both halves are new, and two limits are worth knowing rather than rediscovering later:

  - **The builder can only author a flat tree.** `ChoicesInput` is a `label=value` per-line textarea whose `Choice` is `{ text, value }`, while `TreeChoice` carries `children`. A tree field created through the form builder is therefore a single-level list; nested trees still have to come from DaaS-authored or hand-written `meta.options.choices`. `valueCombining` likewise has no editor and stays `'all'`.
  - **`types` mirrors `registry.json`, not the leaf's standalone capability.** That distinction is now documented in the catalog's module docstring.

  Supporting fixes so the new entry is actually sound end to end:

  - **`@buildpad/ui-interfaces`** — `SelectMultipleCheckboxTree` gained the `type` + normalize + re-serialize trio its two multi-select siblings already had. It is registered for `types: ['json', 'csv']` and the registry ships it standalone (`internalDependencies: []`), so a CLI-installed consumer renders it with no pipeline in front of it; a raw comma-string previously produced substring-matched reads via `String.includes`, character-spread writes, and a `TypeError: currentValue.filter is not a function` on the first uncheck. Tokens parsed out of a csv string are also mapped back to the declared choice value's type, so numeric choices on a csv column match instead of silently appending duplicates. A `null` value (the initial state of a nullable column) no longer crashes on mount, and the component now accepts a forwarded `aria-label` instead of announcing every tree field as "Tree selection".
  - **`@buildpad/ui-forms`** — `FormPreview.stories.tsx` had its own stale copy of `CHOICE_INTERFACES`, which would have rendered the new entry as "Choices option configured incorrectly" in the story that exists to prove every catalogued interface renders; it now imports the shared set. `FieldPalette` gained the `IconListTree` mapping `registry.json` already names, instead of falling back to the glyph already used by rich text.
  - **Tests** — the catalog is now pinned against `registry.json` in both directions, so a missing entry or a drifted `types` fails instead of shipping silently; the renderer-resolution check covers every declared type rather than only `types[0]`; and `csv` compatibility, previously unasserted, is now exhaustive.

- Updated dependencies [585362e]
- Updated dependencies [6d724ee]
- Updated dependencies [89f532b]
- Updated dependencies [565448a]
- Updated dependencies [c6db1e6]
- Updated dependencies [c67c651]
- Updated dependencies [b8b5344]
- Updated dependencies [a22729a]
- Updated dependencies [ddbc1bd]
- Updated dependencies [ce313ea]
- Updated dependencies [d38d37c]
- Updated dependencies [50a4057]
- Updated dependencies [08127f0]
- Updated dependencies [d5c9eee]
- Updated dependencies [577eda9]
- Updated dependencies [c6baa06]
- Updated dependencies [4a53873]
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
- Updated dependencies [944c25c]
- Updated dependencies [1523349]
- Updated dependencies [4026571]
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
  - @buildpad/hooks@1.11.1
  - @buildpad/ui-interfaces@1.11.1
  - @buildpad/ui-collections@1.11.1
  - @buildpad/utils@1.11.1
  - @buildpad/ui-form@1.11.1
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
  - @buildpad/hooks@1.10.0
  - @buildpad/ui-collections@1.10.0
  - @buildpad/utils@1.10.0
  - @buildpad/ui-form@1.10.0

## 1.9.3

### Patch Changes

- Updated dependencies [3c55e13]
  - @buildpad/ui-collections@1.9.3
  - @buildpad/ui-interfaces@1.9.3
  - @buildpad/ui-form@1.9.3
  - @buildpad/hooks@1.9.3
  - @buildpad/services@1.9.3
  - @buildpad/types@1.9.3
  - @buildpad/utils@1.9.3

## 1.9.2

### Patch Changes

- Updated dependencies [0a7e18d]
  - @buildpad/ui-collections@1.9.2
  - @buildpad/ui-interfaces@1.9.2
  - @buildpad/ui-form@1.9.2
  - @buildpad/hooks@1.9.2
  - @buildpad/services@1.9.2
  - @buildpad/types@1.9.2
  - @buildpad/utils@1.9.2

## 1.9.1

### Patch Changes

- Updated dependencies [a453388]
  - @buildpad/ui-interfaces@1.9.1
  - @buildpad/ui-form@1.9.1
  - @buildpad/ui-collections@1.9.1
  - @buildpad/hooks@1.9.1
  - @buildpad/services@1.9.1
  - @buildpad/types@1.9.1
  - @buildpad/utils@1.9.1

## 1.9.0

### Patch Changes

- Updated dependencies [5bf4320]
  - @buildpad/ui-interfaces@1.9.0
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
- @buildpad/ui-interfaces@1.8.1
- @buildpad/utils@1.8.1

## 1.8.0

### Patch Changes

- Updated dependencies [5c1000a]
  - @buildpad/ui-interfaces@1.8.0
  - @buildpad/ui-form@1.8.0
  - @buildpad/ui-collections@1.8.0
  - @buildpad/hooks@1.8.0
  - @buildpad/services@1.8.0
  - @buildpad/types@1.8.0
  - @buildpad/utils@1.8.0

## 1.7.0

### Patch Changes

- Updated dependencies [c6dd470]
- Updated dependencies [c6dd470]
- Updated dependencies [6db435b]
- Updated dependencies [90dc795]
- Updated dependencies [e563c73]
  - @buildpad/ui-collections@1.8.0
  - @buildpad/ui-interfaces@1.8.0
  - @buildpad/hooks@1.8.0
  - @buildpad/types@1.8.0
  - @buildpad/ui-form@1.8.0
  - @buildpad/services@1.8.0
  - @buildpad/utils@1.8.0

## 1.6.0

### Minor Changes

- Add the Dynamic Form Builder module (`@buildpad/ui-forms`): a visual `FormBuilder`
  (drag-and-drop field-type palette, section canvas, per-field settings, live
  Preview) plus a `DynamicForm` runtime renderer, `FormPreview`, `ConditionsEditor`,
  and `FormsEmptyState`. Ships the `forms-routes` app module (`/forms`, `/forms/new`,
  `/forms/[id]`, `/forms/[id]/fill`) and the `useFormDefinitions` hook. Definitions
  are stored as items in an ordinary collection and merged onto the live schema at
  render time — the schema is never mutated. Answers persist as real, searchable DaaS
  columns by default with an opt-in `extras` jsonb tail.

  Also: standardize the forms UI on "form" terminology, add breadcrumbs and improved
  empty/creation UX to the generated `/forms` pages, and fix `usePermissions` to
  resolve the dynamic (`getToken`) auth token via the provider's `getHeaders()` so
  permission checks authenticate correctly under dynamic-token setups.

### Patch Changes

- @buildpad/hooks@1.6.0
- @buildpad/services@1.6.0
- @buildpad/types@1.6.0
- @buildpad/ui-collections@1.6.0
- @buildpad/ui-form@1.6.0
- @buildpad/ui-interfaces@1.6.0
- @buildpad/utils@1.6.0
