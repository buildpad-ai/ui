/**
 * Validate Item
 * Ported from DaaS (Directus) app/src/utils/validate-item.ts
 *
 * Checks an item against its fields' `meta.required` and `meta.validation`
 * rules, as a form does before it saves. Returns one ValidationError per
 * failing field (VForm's `validationErrors` shape); an empty list means the
 * item may be saved.
 */

import type { Field } from '@buildpad/types';
import type { ValidationError } from '../types';
import { applyConditions, evaluateFilter } from './apply-conditions';

/** null, undefined, '' and [] hold no value. */
function isEmptyValue(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    value === '' ||
    (Array.isArray(value) && value.length === 0)
  );
}

/**
 * Whether the user can fill this field in the form: alias fields (groups,
 * presentation, relational lists) hold no column value, and a hidden or
 * read-only field cannot be changed by the user, so none of them is checked.
 */
function isFillable(field: Field, byKey: Map<string, Field>): boolean {
  if (field.type === 'alias') return false;
  if (field.meta?.hidden === true || field.meta?.readonly === true) return false;
  const group = field.meta?.group ? byKey.get(field.meta.group) : undefined;
  if (group?.meta?.hidden === true) return false;
  return true;
}

/**
 * Validate an item against its fields' rules.
 *
 * Each field's `meta.conditions` are applied against the item first, so a
 * condition can make a field required, hidden or read-only.
 *
 * - `meta.required`: the value must not be empty (null, undefined, '' or
 *   []). Error `{ field, type: 'required' }`.
 * - `meta.validation`: a filter rule (`{ email: { _regex: '@' } }`), which
 *   must match the item when the field holds a value; an empty value is
 *   only refused by `meta.required`. Error
 *   `{ field, type: 'validation', code: 'FAILED_VALIDATION', message }`,
 *   the message being `meta.validation_message` when set.
 *
 * @param item   The item as it would be saved (loaded values with the edits over them)
 * @param fields The fields the form renders
 */
export function validateItem(
  item: Record<string, unknown>,
  fields: Field[],
): ValidationError[] {
  const processed = fields.map((field) => applyConditions(item, field));
  const byKey = new Map(processed.map((field) => [field.field, field]));
  const errors: ValidationError[] = [];

  for (const field of processed) {
    if (!isFillable(field, byKey)) continue;
    const value = item[field.field];

    if (field.meta?.required === true && isEmptyValue(value)) {
      errors.push({ collection: field.collection, field: field.field, type: 'required' });
      continue;
    }

    const rule = field.meta?.validation;
    if (!rule || typeof rule !== 'object' || Object.keys(rule).length === 0) continue;
    if (isEmptyValue(value)) continue;

    let valid: boolean;
    try {
      valid = evaluateFilter(rule as Record<string, unknown>, item);
    } catch {
      valid = false;
    }
    if (!valid) {
      errors.push({
        collection: field.collection,
        field: field.field,
        type: 'validation',
        code: 'FAILED_VALIDATION',
        ...(field.meta?.validation_message ? { message: field.meta.validation_message } : {}),
      });
    }
  }

  return errors;
}
