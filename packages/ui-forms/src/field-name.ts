/**
 * Field-name helpers
 *
 * Pure derivation + validation for a new field's column key, shared by the
 * advanced `AddFieldModal` and the minimal `NameFieldModal` (and reused by the
 * builder's save-time guard). Kept free of React/Mantine imports so it can be
 * unit-tested directly; the validation messages come from the shared
 * dictionary (`forms.fieldName.error`) — components pass the strings they
 * resolved through `useBuildpadTranslations`, and the English defaults apply
 * when the argument is omitted.
 *
 * @package @buildpad/ui-forms
 */

import { defaultTranslations, type FormsTranslations } from '@buildpad/utils';

/** A valid DaaS column key: snake_case, starting with a letter. */
export const FIELD_KEY_PATTERN = /^[a-z][a-z0-9_]*$/;

/** The messages `fieldKeyError` returns — `forms.fieldName.error` in the dictionary. */
export type FieldNameErrorMessages = FormsTranslations['fieldName']['error'];

/** Convert a label/name to a snake_case field key. */
export function toFieldKey(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
}

/**
 * Validate a derived field key against the naming rules and existing names
 * (schema + already-placed). Returns an error message, or `null` when valid.
 */
export function fieldKeyError(
  key: string,
  existingNames: ReadonlySet<string>,
  messages: FieldNameErrorMessages = defaultTranslations.forms.fieldName.error,
): string | null {
  if (!key) return messages.required;
  if (!FIELD_KEY_PATTERN.test(key)) return messages.invalidPattern;
  if (existingNames.has(key)) return messages.duplicate;
  return null;
}
