/**
 * Locale helpers that need no dictionary: direction, normalisation, and the
 * dotted-path lookup used by `t()`.
 */
import { interpolate } from './interpolate';
import { formatCount } from './plural';
import type { InterpolationValues, PluralForms, TextDirection } from './types';

/** Locale the components fall back to when no provider is mounted. */
export const DEFAULT_LOCALE = 'en';

/** Primary language subtags written right-to-left. */
const RTL_LANGUAGES = new Set(['ar', 'he', 'fa', 'ur', 'ps', 'sd', 'ug', 'yi', 'dv', 'ku', 'ckb']);

/** "id-ID" → "id"; "" → "en" */
export function languageOf(locale: string | undefined | null): string {
  const primary = (locale ?? '').trim().split(/[-_]/)[0]?.toLowerCase();
  return primary || DEFAULT_LOCALE;
}

/** Text direction for a locale (`rtl` for Arabic, Hebrew, Persian, Urdu, …). */
export function directionForLocale(locale: string | undefined | null): TextDirection {
  return RTL_LANGUAGES.has(languageOf(locale)) ? 'rtl' : 'ltr';
}

function isPluralForms(value: unknown): value is PluralForms {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as { other?: unknown }).other === 'string'
  );
}

/**
 * Resolve a dotted path (`"form.validation.required"`) in a dictionary.
 * Returns the string or `PluralForms` found, or `undefined`.
 */
export function lookupTranslation(dictionary: object, path: string): string | PluralForms | undefined {
  const value = path.split('.').reduce<unknown>(
    (node, key) =>
      node && typeof node === 'object' ? (node as Record<string, unknown>)[key] : undefined,
    dictionary,
  );
  if (typeof value === 'string') return value;
  if (isPluralForms(value)) return value;
  return undefined;
}

/**
 * Translate a dotted path with interpolation. A `PluralForms` entry is
 * resolved with `values.count`; a missing key returns the path itself so the
 * gap is visible in the UI rather than blank.
 */
export function translate(
  dictionary: object,
  locale: string | undefined,
  path: string,
  values?: InterpolationValues,
): string {
  const entry = lookupTranslation(dictionary, path);
  if (entry === undefined) return path;
  if (typeof entry === 'string') return interpolate(entry, values);
  const count = typeof values?.count === 'number' ? values.count : Number(values?.count ?? 0);
  return formatCount(locale, Number.isFinite(count) ? count : 0, entry, values);
}
