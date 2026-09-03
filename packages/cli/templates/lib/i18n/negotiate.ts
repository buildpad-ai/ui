/**
 * Locale negotiation for middleware.
 *
 * Precedence: NEXT_LOCALE cookie (an explicit choice) → Accept-Language →
 * defaultLocale. Only middleware calls this — reading headers or cookies in a
 * page or layout would force dynamic rendering and duplicate the redirect.
 *
 * @buildpad/origin: lib/i18n/negotiate
 * @buildpad/version: 1.0.0
 */

import Negotiator from "negotiator";
import { match } from "@formatjs/intl-localematcher";
import type { NextRequest } from "next/server";
import { defaultLocale, hasLocale, locales, LOCALE_COOKIE, type Locale } from "./config";

export function negotiateLocale(request: NextRequest): Locale {
  const cookie = request.cookies.get(LOCALE_COOKIE)?.value;
  if (hasLocale(cookie)) return cookie;

  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });

  try {
    const languages = new Negotiator({ headers }).languages();
    // Negotiator yields "*" or malformed tags for odd headers; match() throws on them.
    const matched = match(languages, locales as unknown as string[], defaultLocale);
    return hasLocale(matched) ? matched : defaultLocale;
  } catch {
    return defaultLocale;
  }
}
