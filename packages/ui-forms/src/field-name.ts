/**
 * Field-name helpers
 *
 * Pure derivation + validation for a new field's column key, shared by the
 * advanced `AddFieldModal` and the minimal `NameFieldModal` (and reused by the
 * builder's save-time guard). Kept free of React/Mantine imports so it can be
 * unit-tested directly.
 *
 * @package @buildpad/ui-forms
 */

/** A valid DaaS column key: snake_case, starting with a letter. */
export const FIELD_KEY_PATTERN = /^[a-z][a-z0-9_]*$/;

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
): string | null {
  if (!key) return 'A field name is required';
  if (!FIELD_KEY_PATTERN.test(key))
    return 'Use lowercase letters, numbers and underscores (start with a letter)';
  if (existingNames.has(key)) return 'A field with this name already exists';
  return null;
}
