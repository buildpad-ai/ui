/**
 * Deep merge for translation dictionaries.
 *
 * Precedence, lowest to highest: English defaults → provider dictionary →
 * component prop. Later arguments win; `undefined` leaves the earlier value in
 * place so a partial override never blanks a string. Inputs are never mutated.
 */
import type { DeepPartial } from './types';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function mergeInto(target: Record<string, unknown>, source: Record<string, unknown>): void {
  for (const key of Object.keys(source)) {
    const incoming = source[key];
    if (incoming === undefined) continue;
    const current = target[key];
    if (isPlainObject(incoming) && isPlainObject(current)) {
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
