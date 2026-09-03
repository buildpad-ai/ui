/**
 * Content-translation query helpers (Directus-style `languages` +
 * `<collection>_translations` junctions on DaaS).
 *
 * DaaS parses Directus's `deep` parameter but ignores it in the items
 * service, so a nested read cannot be narrowed to one language. Query the
 * junction directly for the requested AND default locale, then pick
 * client-side with `pickTranslation()` — the backend never falls back.
 *
 * See the add-i18n skill's content-translations reference for the schema.
 *
 * @buildpad/origin: lib/i18n/content
 * @buildpad/version: 1.0.0
 */

import { defaultLocale, type Locale } from "./config";

export type TranslationRow<T> = T & { id: string; languages_code: string };

/** Requested locale → default locale → first available. */
export function pickTranslation<T>(
  rows: TranslationRow<T>[],
  locale: Locale,
): TranslationRow<T> | undefined {
  return (
    rows.find((r) => r.languages_code === locale) ??
    rows.find((r) => r.languages_code === defaultLocale) ??
    rows[0]
  );
}

/** Query string for one parent's rows in the requested + default locale. */
export function translationsQuery(parentField: string, parentId: string, locale: Locale): string {
  const filter = {
    [parentField]: { _eq: parentId },
    languages_code: { _in: Array.from(new Set([locale, defaultLocale])) },
  };
  return `filter=${encodeURIComponent(JSON.stringify(filter))}&fields=*,${parentField}.*`;
}

/** Query string for a locale's list, newest first. */
export function localeListQuery(parentField: string, locale: Locale, limit = 25): string {
  const filter = { languages_code: { _eq: locale } };
  return `filter=${encodeURIComponent(JSON.stringify(filter))}&fields=*,${parentField}.*&sort=-date_created&limit=${limit}`;
}
