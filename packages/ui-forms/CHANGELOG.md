# @buildpad/ui-forms

## 2.0.0

### Patch Changes

- Updated dependencies
  - @buildpad/ui-collections@2.0.0
  - @buildpad/ui-interfaces@2.0.0
  - @buildpad/ui-form@2.0.0
  - @buildpad/hooks@2.0.0
  - @buildpad/services@2.0.0
  - @buildpad/types@2.0.0
  - @buildpad/utils@2.0.0

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
