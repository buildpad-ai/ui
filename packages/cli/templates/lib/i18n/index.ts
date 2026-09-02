/**
 * lib/i18n — locale routing, dictionaries and locale-aware navigation.
 *
 * Server-only pieces (`dictionaries.ts`, `negotiate.ts`) are NOT re-exported
 * here so this barrel is safe to import from client components.
 *
 * @buildpad/origin: lib/i18n/index
 * @buildpad/version: 1.0.0
 */

export {
  locales,
  defaultLocale,
  localeMeta,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  hasLocale,
  getLocaleFromPathname,
  stripLocale,
  localeHref,
  type Locale,
  type LocaleMeta,
} from "./config";
export type { Dictionary } from "./types";
export { I18nProvider, useI18n, useI18nOptional, type I18nContextValue } from "./provider";
export { useLocaleRouter, useLocaleHref, useSwitchLocale, setLocaleCookie } from "./navigation";
export { pickTranslation, translationsQuery, localeListQuery, type TranslationRow } from "./content";
