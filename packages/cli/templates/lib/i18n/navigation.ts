"use client";

/**
 * Locale-aware navigation.
 *
 * - `useLocaleRouter()` — drop-in for `useRouter()` whose push/replace prefix
 *   the active locale (`router.push("/content")` → `/id/content`).
 * - `useLocaleHref()` — prefix a path for `<Link href>`.
 * - `useSwitchLocale()` — write the NEXT_LOCALE cookie and re-enter the
 *   current route under the new prefix (what the LanguageSwitcher calls).
 *
 * @buildpad/origin: lib/i18n/navigation
 * @buildpad/version: 1.0.0
 */

import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";
import {
  hasLocale,
  localeHref,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  stripLocale,
  type Locale,
} from "./config";
import { useI18n } from "./provider";

type NavigateOptions = { scroll?: boolean };

export function useLocaleRouter() {
  const router = useRouter();
  const { locale } = useI18n();
  return useMemo(
    () => ({
      locale,
      href: (path: string) => localeHref(locale, path),
      push: (path: string, options?: NavigateOptions) => router.push(localeHref(locale, path), options),
      replace: (path: string, options?: NavigateOptions) =>
        router.replace(localeHref(locale, path), options),
      prefetch: (path: string) => router.prefetch(localeHref(locale, path)),
      back: () => router.back(),
      forward: () => router.forward(),
      refresh: () => router.refresh(),
    }),
    [router, locale],
  );
}

/** `const href = useLocaleHref(); <Link href={href("/users")}>` */
export function useLocaleHref() {
  const { locale } = useI18n();
  return useCallback((path: string) => localeHref(locale, path), [locale]);
}

/** Persist the choice for middleware, then navigate to the same route under the new locale. */
export function setLocaleCookie(locale: Locale) {
  if (typeof document === "undefined") return;
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; SameSite=Lax`;
}

export function useSwitchLocale() {
  const router = useRouter();
  return useCallback(
    (next: string) => {
      if (!hasLocale(next) || typeof window === "undefined") return;
      setLocaleCookie(next);
      const rest = stripLocale(window.location.pathname);
      router.push(`${localeHref(next, rest)}${window.location.search}${window.location.hash}`);
      router.refresh();
    },
    [router],
  );
}
