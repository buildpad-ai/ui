/**
 * Hybrid storage helpers — real columns + an `extras` jsonb tail.
 *
 * The Dynamic Form Builder stores most answers as real, searchable DaaS columns
 * but allows an opt-in `extras` jsonb column for the rare non-searchable tail
 * (fields whose merged `Field` carries `meta.store === 'extras'`). These pure
 * helpers let `CollectionForm` split form values by storage on save and flatten
 * the `extras` object back into form values on load, leaving the real-column,
 * M2M, permission, and validation paths untouched.
 *
 * @package @buildpad/ui-collections
 */

/** The single jsonb column on the target collection that holds all extra answers. */
export const EXTRAS_COLUMN = 'extras';

/** True when `value` is a plain (non-array) object usable as an `extras` map. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Spread an item's `extras` jsonb object back into flat form values so extra
 * fields hydrate. The raw `extras` key is preserved (it serves as the merge base
 * on the next save). No-op when there is no `extras` object.
 */
export function flattenExtras(
  values: Record<string, unknown>,
  extrasColumn: string = EXTRAS_COLUMN,
): Record<string, unknown> {
  const raw = values[extrasColumn];
  if (isPlainObject(raw)) {
    return { ...values, ...raw };
  }
  return { ...values };
}

/**
 * Split `values` into `rest` (real columns + M2M change objects, handled by the
 * existing save path) and `extras` (values for `store: 'extras'` fields). The
 * raw `extras` container key is dropped — it is rebuilt from `extras` + the
 * previously stored object by `mergeExtras`.
 */
export function extractExtras(
  values: Record<string, unknown>,
  extrasFieldNames: ReadonlySet<string>,
  extrasColumn: string = EXTRAS_COLUMN,
): { rest: Record<string, unknown>; extras: Record<string, unknown> } {
  const rest: Record<string, unknown> = {};
  const extras: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) {
    if (key === extrasColumn) continue; // managed separately; rebuilt on save
    if (extrasFieldNames.has(key)) {
      extras[key] = value;
    } else {
      rest[key] = value;
    }
  }
  return { rest, extras };
}

/**
 * Merge changed extra values onto the item's previously stored `extras` object,
 * so unchanged extras survive a partial update (`{ ...prev, ...changed }`).
 */
export function mergeExtras(
  prev: unknown,
  changed: Record<string, unknown>,
): Record<string, unknown> {
  const base = isPlainObject(prev) ? prev : {};
  return { ...base, ...changed };
}

/**
 * A clear, actionable error for when a screen uses `store: 'extras'` fields but
 * the target collection has no `extras` jsonb column to store them in.
 */
export function missingExtrasColumnMessage(collection: string): string {
  return (
    `This screen has "extras" fields, but the "${collection}" collection has no ` +
    `"${EXTRAS_COLUMN}" (json) column to store them. Add a "${EXTRAS_COLUMN}" json ` +
    `column to "${collection}" (or switch those fields to real columns).`
  );
}
