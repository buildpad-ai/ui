/**
 * Deep merge for translation dictionaries.
 *
 * Precedence, lowest to highest: English defaults → provider dictionary →
 * component prop. Later arguments win; `undefined` leaves the earlier value in
 * place so a partial override never blanks a string. A `PluralForms` entry
 * (`{ other, one?, … }`) replaces the earlier one as a whole — its categories
 * follow one locale's plural rules, so English `one` must not leak under an
 * Indonesian `other`. Inputs are never mutated, and `__proto__`-style keys
 * from parsed JSON are ignored.
 */
import type { DeepPartial } from './types';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/** Keys that would rewrite the merged object's prototype if copied from parsed JSON. */
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/** A plural-forms entry is replaced as a unit: its categories belong to ONE locale's rules. */
function isPluralForms(value: unknown): boolean {
  return isPlainObject(value) && typeof value.other === 'string';
}

function mergeInto(target: Record<string, unknown>, source: Record<string, unknown>): void {
  for (const key of Object.keys(source)) {
    if (UNSAFE_KEYS.has(key)) continue;
    const incoming = source[key];
    // `undefined` AND `null` leave the earlier value in place: a JSON dictionary
    // with `"form": null` must not blank a whole namespace.
    if (incoming == null) continue;
    const current = target[key];
    if (isPluralForms(incoming)) {
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
