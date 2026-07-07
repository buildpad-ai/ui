/**
 * @buildpad/ui-forms
 *
 * Dynamic Form Builder for Buildpad projects — a design-time authoring layer
 * (FormBuilder, FieldPalette, ConditionsEditor, …) plus a runtime renderer
 * (DynamicForm, FormPreview) on top of the existing schema-driven form runtime
 * (`CollectionForm` → `VForm`). Definitions are stored as items in an ordinary,
 * consumer-owned collection and merged onto the live schema at render time via
 * `buildFieldsFromDefinition` — the schema is never mutated.
 *
 * This entry re-exports the shared runtime building blocks plus the builder and
 * renderer components so consumers have a single import surface for the feature.
 */

// ---- Runtime renderer + preview ----
export { DynamicForm } from './DynamicForm';
export type { DynamicFormProps } from './DynamicForm';

export { FormPreview } from './FormPreview';
export type { FormPreviewProps } from './FormPreview';

// ---- Builder ----
export { FormBuilder } from './FormBuilder';
export type { FormBuilderProps } from './FormBuilder';

export { FieldPalette, PALETTE_ID_PREFIX, NEWFIELD_ID_PREFIX } from './FieldPalette';
export type { FieldPaletteProps } from './FieldPalette';

export { AddFieldModal } from './AddFieldModal';
export type { AddFieldModalProps, AddFieldResult } from './AddFieldModal';

export { NameFieldModal } from './NameFieldModal';
export type { NameFieldModalProps } from './NameFieldModal';

export {
  ChoicesInput,
  parseChoices,
  choicesToRaw,
} from './ChoicesInput';
export type { ChoicesInputProps, Choice } from './ChoicesInput';

export { BuilderCanvas } from './BuilderCanvas';
export type { BuilderCanvasProps } from './BuilderCanvas';

export {
  BuilderSection,
  SECTION_ID_PREFIX,
  SECTION_BODY_ID_PREFIX,
} from './BuilderSection';
export type { BuilderSectionProps } from './BuilderSection';

export { BuilderFieldRow } from './BuilderFieldRow';
export type { BuilderFieldRowProps } from './BuilderFieldRow';

export { FieldSettingsPanel } from './FieldSettingsPanel';
export type { FieldSettingsPanelProps } from './FieldSettingsPanel';

export { ConditionsEditor } from './ConditionsEditor';
export type { ConditionsEditorProps } from './ConditionsEditor';

export { FormsEmptyState } from './FormsEmptyState';
export type { FormsEmptyStateProps } from './FormsEmptyState';

// Overlay merge (the runtime step that drives the existing form renderer)
export { buildFieldsFromDefinition } from '@buildpad/utils';

// Definitions data hook
export {
  useFormDefinitions,
  DEFAULT_FORMS_COLLECTION,
  type ListFormDefinitionsParams,
  type ResolveScreenParams,
  type UseFormDefinitionsOptions,
  type UseFormDefinitionsReturn,
} from '@buildpad/hooks';

// Shared types
// NOTE: `FieldCondition` is intentionally NOT re-exported here — the form runtime
// (`vform`, via `apply-conditions`) is its canonical component-layer re-export.
// Re-exporting it here too collides in the generated `components/ui/index.ts`
// (`export * from './vform'` + `export * from './form-builder'` → TS2308).
// Import it from `@buildpad/types` (or `@/lib/buildpad/types`) when needed.
export type {
  FormDefinition,
  FormSection,
  FormFieldConfig,
} from '@buildpad/types';
