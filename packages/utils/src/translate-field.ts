import type { Field } from '@buildpad/types';

/**
 * Resolves the display name for a field based on its translations.
 * Falls back to a title-cased version of the raw field name.
 */
export function getFieldDisplayName(field: Field, locale?: string): string {
  const translations = field.meta?.translations;

  if (translations && translations.length > 0) {
    if (locale) {
      // With explicit locale: exact match → prefix match → formatFieldTitle
      // Matches Directus behavior: i18n.global.t() only resolves the active locale
      const lang = locale.toLowerCase();
      const match =
        translations.find((t) => t.language.toLowerCase() === lang) ??
        translations.find((t) => lang.startsWith(t.language.toLowerCase()));

      if (match?.translation) {
        return match.translation;
      }
    } else {
      // Without locale: use first available translation as fallback
      // (buildpad-ui has no i18n system, so we use the first entry)
      const first = translations.find((t) => t.translation);
      if (first) {
        return first.translation;
      }
    }
  }

  return formatFieldTitle(field.field);
}

/** Converts a snake_case field name to Title Case (e.g. "first_name" → "First Name"). */
export function formatFieldTitle(fieldName: string): string {
  return fieldName
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
