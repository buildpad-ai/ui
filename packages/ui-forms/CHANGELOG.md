# @buildpad/ui-forms

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
