/**
 * Form Definition types
 *
 * Shared types for the Dynamic Form Builder (`@buildpad/ui-forms`). A
 * `FormDefinition` is a JSON document describing the fields, sections, layout,
 * and conditions for one screen of one target collection. It is stored as a
 * single item in a consumer-owned definitions collection (default
 * `fb_definitions`) and merged onto the collection's live schema `Field[]`
 * at render time via `buildFieldsFromDefinition` — the schema is never mutated.
 *
 * `FieldCondition` is the single source of truth for conditional logic and is
 * consumed verbatim by `apply-conditions.ts` in `@buildpad/ui-form`.
 *
 * @package @buildpad/types
 */

/**
 * A single condition entry stored in `field.meta.conditions`.
 *
 * Evaluated against the current form values by `apply-conditions.ts`. When the
 * condition's `rule` matches, its overrides (`readonly`, `hidden`, `required`,
 * `options`, `clear_hidden_value_on_save`) are merged into the field's meta.
 * Conditions are evaluated last-match-wins (DaaS convention).
 */
export interface FieldCondition {
  /** Display name of the condition (for admin UI) */
  name?: string;
  /** Filter rule — a JSON filter object (DaaS operators: `_eq`, `_in`, `_and`, …) */
  rule?: Record<string, unknown>;
  /** Override: set field readonly */
  readonly?: boolean;
  /** Override: set field hidden */
  hidden?: boolean;
  /** Override: set field required */
  required?: boolean;
  /** Override: replace field options */
  options?: Record<string, unknown>;
  /** Override: clear value on save when hidden */
  clear_hidden_value_on_save?: boolean;
}

/**
 * Where a form field's answer is stored in the target collection.
 *
 * - `'column'` (default) — a real, typed DaaS column: searchable, sortable,
 *   aggregatable, relatable, and field-level-permissioned via the Items API.
 *   Provisioned on demand via the DDL API.
 * - `'extras'` — the value lives inside the target collection's single `extras`
 *   jsonb column. No DDL needed, but **not** server-searchable and not
 *   individually field-permissioned.
 */
export type FieldStore = 'column' | 'extras';

/**
 * Self-describing rendering metadata for an `extras` field.
 *
 * An `extras` field is **not** part of the DaaS schema, so the form definition
 * must carry its rendering metadata inline. `buildFieldsFromDefinition`
 * synthesizes a `Field` from this descriptor at render time.
 */
export interface ExtraFieldDescriptor {
  /** DaaS field type (`'string' | 'integer' | 'boolean' | 'date' | 'json' | …`) */
  type: string;
  /** VForm interface id (e.g. `'input'`, `'select-dropdown'`); inferred from `type` when omitted */
  interface?: string;
  /** Human-readable label */
  label?: string;
  /** Interface options (e.g. choices for a select) → `field.meta.options` */
  options?: Record<string, unknown>;
}

/**
 * Per-field configuration within a form definition. Overlays the matching
 * schema `Field` at render time.
 */
export interface FormFieldConfig {
  /** Schema field key (matches `Field.field`), or the extra's key when `store === 'extras'` */
  field: string;
  /** Field width within the section (constrained to half/full) */
  width?: 'half' | 'full';
  /** Override: mark the field required */
  required?: boolean;
  /** Override: mark the field readonly */
  readonly?: boolean;
  /** Override: hide the field */
  hidden?: boolean;
  /** Label/help override (maps to `field.meta.note`) */
  note?: string;
  /** Conditional rules consumed verbatim by `apply-conditions.ts` */
  conditions?: FieldCondition[];
  /**
   * Where the answer is stored. Defaults to `'column'` (real, searchable).
   * `'extras'` routes the value into the target collection's `extras` jsonb tail.
   */
  store?: FieldStore;
  /**
   * Rendering metadata for an `extras` field. **Required** when
   * `store === 'extras'` (the field is not in the DaaS schema, so it is
   * self-described); ignored for real-column fields.
   */
  extra?: ExtraFieldDescriptor;
}

/**
 * A named, ordered group of fields within a form definition.
 */
export interface FormSection {
  /** Stable section id (used for the synthesized group/divider field key) */
  id: string;
  /** Optional section heading */
  title?: string;
  /** Fields placed in this section, in display order */
  fields: FormFieldConfig[];
}

/**
 * A form definition — one screen of one target collection. Stored as a single
 * JSON item in the definitions collection.
 */
export interface FormDefinition {
  /** Item id in the definitions collection (absent until first save) */
  id?: string;
  /** Human-readable screen name (e.g. "Bug create screen") */
  name: string;
  /** Collection the screen creates/edits items in (e.g. "issues") */
  target_collection: string;
  /** Optional screen discriminator for fill-time selection (e.g. by `issue_type`) */
  key?: string | null;
  /** Sections in display order */
  sections: FormSection[];
}
