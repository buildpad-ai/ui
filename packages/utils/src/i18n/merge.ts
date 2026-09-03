/**
 * Deep merge for translation dictionaries.
 *
 * Precedence, lowest to highest: English defaults → provider dictionary →
 * component prop. Later arguments win; `undefined` leaves the earlier value in
 * place so a partial override never blanks a string. A `PluralForms` entry
 * (an object whose keys are all CLDR categories) replaces the earlier one as a
 * whole, because its categories follow one locale's plural rules and English
 * `one` must not leak under an Indonesian `other`. A namespace that merely has
 * an `other` key, such as `interfaces.selectRadio`, still merges key by key.
 * Inputs are never mutated, and `__proto__`-style keys from parsed JSON are
 * ignored.
 */
import { isPluralFormsValue } from './primitives';
import type { DeepPartial } from './types';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/** Keys that would rewrite the merged object's prototype if copied from parsed JSON. */
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function mergeInto(target: Record<string, unknown>, source: Record<string, unknown>): void {
  for (const key of Object.keys(source)) {
    if (UNSAFE_KEYS.has(key)) continue;
    const incoming = source[key];
    // `undefined` AND `null` leave the earlier value in place: a JSON dictionary
    // with `"form": null` must not blank a whole namespace.
    if (incoming == null) continue;
    const current = target[key];
    // Whether this slot is a plural entry is decided by what the dictionary
    // HOLDS, not by the shape of the override: `{ other: 'X' }` is a complete
    // plural override, but it is also a partial override of a namespace that
    // happens to have an `other` key, and only the base tells the two apart.
    if (isPluralFormsValue(current) && isPlainObject(incoming)) {
      target[key] = { ...(incoming as Record<string, unknown>) };
    } else if (isPlainObject(incoming) && isPlainObject(current)) {
      const copy: Record<string, unknown> = { ...current };
      mergeInto(copy, incoming);
      target[key] = copy;
    } else if (isPlainObject(incoming)) {
      const copy: Record<string, unknown> = {};
      mergeInto(copy, incoming);
      target[key] = copy;
    } else {
      target[key] = incoming;
    }
  }
}

/**
 * Merge one or more partial dictionaries over a complete base.
 *
 * @example
 * const t = mergeTranslations(defaults.interfaces.listM2M, providerDict, props.translations);
 */
export function mergeTranslations<T extends object>(
  base: T,
  ...overrides: Array<DeepPartial<T> | Partial<T> | null | undefined>
): T {
  const result: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const override of overrides) {
    if (!override) continue;
    mergeInto(result, override as Record<string, unknown>);
  }
  return result as T;
}
