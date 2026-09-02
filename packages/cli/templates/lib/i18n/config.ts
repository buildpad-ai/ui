/**
 * Locale configuration — the single source of truth for middleware
 * negotiation, the `[lang]` route param, dictionaries, the LanguageSwitcher,
 * and the DaaS `languages.code` values (content translations).
 *
 * Add a locale in three places, all in lib/i18n:
 *   1. `locales` and `localeMeta` below (or `buildpad init --locales en,id`)
 *   2. `dictionaries/<code>.json` (copy en.json and translate)
 *   3. the loader map in `dictionaries.ts`
 *
 * @buildpad/origin: lib/i18n/config
 * @buildpad/version: 1.0.0
 */

// buildpad:locales — edited by `buildpad init --locales`; keep on one line.
export const locales = ["en"] as const;
export type Locale = (typeof locales)[number];
// buildpad:default-locale
export const defaultLocale: Locale = "en";

export interface LocaleMeta {
  /** Native display name shown in the LanguageSwitcher. */
  name: string;
  direction: "ltr" | "rtl";
}

// buildpad:locale-meta-start
export const localeMeta: Record<Locale, LocaleMeta> = {
  en: { name: "English", direction: "ltr" },
};
// buildpad:locale-meta-end

/** Written by the LanguageSwitcher; read by middleware before Accept-Language. */
export const LOCALE_COOKIE = "NEXT_LOCALE";

/** One year — the switcher's choice should outlive the session. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function hasLocale(value: string | null | undefined): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}

/** "/id/content/articles" → "id"; "/content" → null */
export function getLocaleFromPathname(pathname: string): Locale | null {
  const first = pathname.split("/")[1];
  return hasLocale(first) ? first : null;
}

/** "/id/content/articles" → "/content/articles"; "/id" → "/" */
export function stripLocale(pathname: string): string {
  const locale = getLocaleFromPathname(pathname);
  if (!locale) return pathname;
  return pathname.slice(locale.length + 1) || "/";
}

/**
 * localeHref("id", "/content") → "/id/content".
 * API paths, absolute URLs, hashes and already-prefixed paths pass through.
 */
export function localeHref(locale: Locale, path: string): string {
  if (
    path.startsWith("/api/") ||
    path === "/api" ||
    path.startsWith("#") ||
    path.startsWith("//") ||
    /^[a-z][a-z0-9+.-]*:/i.test(path)
  ) {
    return path;
  }
  // Split off query/hash so stripLocale only sees the pathname.
  const match = path.match(/^([^?#]*)(.*)$/);
  const pathname = match?.[1] ?? path;
  const suffix = match?.[2] ?? "";
  const clean = stripLocale(pathname.startsWith("/") ? pathname : `/${pathname}`);
  return `/${locale}${clean === "/" ? "" : clean}${suffix}`;
}
