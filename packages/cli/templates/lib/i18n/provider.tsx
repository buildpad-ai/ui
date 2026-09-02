"use client";

/**
 * I18nProvider — app-level locale + dictionary context.
 *
 * Mounted once in `app/[lang]/layout.tsx`. It holds only the static
 * dictionary and locale (no auth state), so the root layout is the right
 * place — the Bug 22 rule concerns auth-bearing providers only.
 *
 * It also mounts Buildpad's `BuildpadI18nProvider` with the `buildpad`
 * namespace of the dictionary layered over the catalog Buildpad ships for the
 * locale, so every copied Buildpad component (CollectionList, VForm, Upload,
 * …) renders in the app's language without editing components/ui/*.
 *
 * @buildpad/origin: lib/i18n/provider
 * @buildpad/version: 1.0.0
 */

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { BuildpadI18nProvider } from "@/lib/buildpad/services";
import {
  bundledTranslationsFor,
  formatCount,
  interpolate,
  mergeTranslations,
  type BuildpadTranslationsInput,
  type PluralForms,
} from "@/lib/buildpad/utils";
import { localeMeta, type Locale } from "./config";
import type { Dictionary } from "./types";

type Values = Record<string, string | number | boolean | null | undefined>;

export interface I18nContextValue {
  locale: Locale;
  direction: "ltr" | "rtl";
  /** IANA zone every date is rendered in (server and client alike). */
  timeZone: string;
  dictionary: Dictionary;
  /**
   * t("app.login.submit") · t("app.common.showing", { start: 1, end: 10, total: 42 })
   * A plural-forms entry ({ one, other }) is resolved with `values.count`.
   * Missing keys return the path so the gap is visible.
   */
  t: (path: string, values?: Values) => string;
  formatDate: (value: string | number | Date, options?: Intl.DateTimeFormatOptions) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function lookup(dictionary: Dictionary, path: string): string | PluralForms | undefined {
  const value = path.split(".").reduce<unknown>(
    (node, key) =>
      node && typeof node === "object" ? (node as Record<string, unknown>)[key] : undefined,
    dictionary,
  );
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && typeof (value as PluralForms).other === "string") {
    return value as PluralForms;
  }
  return undefined;
}

export function I18nProvider({
  locale,
  dictionary,
  timeZone = process.env.NEXT_PUBLIC_TIMEZONE ?? "UTC",
  children,
}: {
  locale: Locale;
  dictionary: Dictionary;
  /** Pin a zone so server and client render the same date string (avoids hydration mismatches). */
  timeZone?: string;
  children: ReactNode;
}) {
  const direction = localeMeta[locale].direction;

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      direction,
      timeZone,
      dictionary,
      t: (path, values) => {
        const entry = lookup(dictionary, path);
        if (entry === undefined) return path;
        if (typeof entry === "string") return interpolate(entry, values);
        const count = Number(values?.count ?? 0);
        return formatCount(locale, Number.isFinite(count) ? count : 0, entry, values);
      },
      formatDate: (input, options) =>
        new Intl.DateTimeFormat(locale, { timeZone, ...(options ?? { dateStyle: "medium" }) }).format(
          new Date(input),
        ),
      formatNumber: (input, options) => new Intl.NumberFormat(locale, options).format(input),
    }),
    [locale, direction, dictionary, timeZone],
  );

  // Buildpad's own catalog for the locale (if it ships one) under the app's
  // `buildpad` overrides. `mergeTranslations` never mutates its inputs.
  const buildpadTranslations = useMemo<BuildpadTranslationsInput>(
    () =>
      mergeTranslations(
        {},
        bundledTranslationsFor(locale),
        (dictionary as { buildpad?: BuildpadTranslationsInput }).buildpad,
      ),
    [locale, dictionary],
  );

  return (
    <I18nContext.Provider value={value}>
      <BuildpadI18nProvider
        locale={locale}
        direction={direction}
        timeZone={timeZone}
        translations={buildpadTranslations}
      >
        {children}
      </BuildpadI18nProvider>
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n() must be used under <I18nProvider> — mount it in app/[lang]/layout.tsx");
  }
  return ctx;
}

/** Like useI18n() but returns null outside the provider (for shared components). */
export function useI18nOptional(): I18nContextValue | null {
  return useContext(I18nContext);
}
