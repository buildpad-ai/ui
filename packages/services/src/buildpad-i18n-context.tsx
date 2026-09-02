'use client';

/**
 * BuildpadI18nProvider — locale, dictionary and formatting for every Buildpad
 * component. Sits next to `DaaSProvider`, but unlike it holds no auth state,
 * so it belongs in the app's ROOT layout (Bug 22 does not apply).
 *
 * Without a provider every hook below still works: components render the
 * English defaults and format dates/numbers with the browser locale and time
 * zone — exactly what they did before i18n existed. Storybook, tests and
 * existing consumers therefore need no changes.
 *
 * Precedence for every string: component prop > provider dictionary > defaults.
 *
 * @example
 * // app/[lang]/layout.tsx
 * <BuildpadI18nProvider locale={lang} translations={dictionary.buildpad}>
 *   {children}
 * </BuildpadI18nProvider>
 *
 * // inside a component
 * const t = useBuildpadTranslations((d) => d.interfaces.listM2M, props.translations);
 * const { formatDate } = useBuildpadI18n();
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { DatesProvider } from '@mantine/dates';
import {
  DEFAULT_LOCALE,
  defaultTranslations,
  directionForLocale,
  formatCount as formatCountForLocale,
  mergeTranslations,
  translate,
  type BuildpadTranslations,
  type BuildpadTranslationsInput,
  type DeepPartial,
  type InterpolationValues,
  type PluralForms,
  type TextDirection,
} from '@buildpad/utils';

/** Time zone pinned by the provider when none is given — keeps SSR and client output identical. */
export const BUILDPAD_I18N_DEFAULT_TIMEZONE = 'UTC';

export type DateInput = string | number | Date;

export interface BuildpadI18nContextValue {
  /** Active BCP 47 locale. `"en"` when no provider is mounted. */
  locale: string;
  /** Text direction of `locale`. */
  direction: TextDirection;
  /** IANA time zone used by `formatDate`; `undefined` (browser zone) without a provider. */
  timeZone: string | undefined;
  /** Whether a `BuildpadI18nProvider` is mounted above the caller. */
  hasProvider: boolean;
  /** Provider dictionary merged over the English defaults. */
  translations: BuildpadTranslations;
  /**
   * Dotted-path lookup with `{key}` interpolation, e.g.
   * `t('form.validation.required')` or `t('common.itemCount', { count: 3 })`.
   * A missing key returns the path itself.
   */
  t: (path: string, values?: InterpolationValues) => string;
  /** Locale + time-zone aware date formatting. Invalid input → `''`. */
  formatDate: (value: DateInput | null | undefined, options?: Intl.DateTimeFormatOptions) => string;
  /** `formatDate` with `dateStyle: 'medium', timeStyle: 'short'`. */
  formatDateTime: (value: DateInput | null | undefined, options?: Intl.DateTimeFormatOptions) => string;
  /** `Intl.NumberFormat` for the active locale. */
  formatNumber: (value: number | null | undefined, options?: Intl.NumberFormatOptions) => string;
  /** Plural selection + interpolation for a `PluralForms` entry. */
  formatCount: (count: number, forms: PluralForms, values?: InterpolationValues) => string;
}

const BuildpadI18nContext = createContext<BuildpadI18nContextValue | null>(null);

function toDate(value: DateInput | null | undefined): Date | null {
  if (value == null || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

interface BuildValueOptions {
  locale: string | undefined;
  direction?: TextDirection;
  timeZone: string | undefined;
  translations: BuildpadTranslations;
  hasProvider: boolean;
}

function buildContextValue({
  locale,
  direction,
  timeZone,
  translations,
  hasProvider,
}: BuildValueOptions): BuildpadI18nContextValue {
  // `undefined` makes Intl use the browser/runtime default — the pre-i18n behaviour.
  const intlLocale = hasProvider ? locale : undefined;
  const resolvedLocale = locale ?? DEFAULT_LOCALE;

  const formatDate: BuildpadI18nContextValue['formatDate'] = (value, options) => {
    const date = toDate(value);
    if (!date) return '';
    try {
      return new Intl.DateTimeFormat(intlLocale, {
        ...(timeZone ? { timeZone } : {}),
        ...(options ?? { dateStyle: 'medium' }),
      }).format(date);
    } catch {
      return date.toLocaleDateString();
    }
  };

  return {
    locale: resolvedLocale,
    direction: direction ?? directionForLocale(resolvedLocale),
    timeZone,
    hasProvider,
    translations,
    t: (path, values) => translate(translations, intlLocale, path, values),
    formatDate,
    formatDateTime: (value, options) =>
      formatDate(value, options ?? { dateStyle: 'medium', timeStyle: 'short' }),
    formatNumber: (value, options) => {
      if (value == null || Number.isNaN(value)) return '';
      try {
        return new Intl.NumberFormat(intlLocale, options).format(value);
      } catch {
        return String(value);
      }
    },
    formatCount: (count, forms, values) => formatCountForLocale(intlLocale, count, forms, values),
  };
}

/** Value returned by the hooks when no provider is mounted. Built once. */
let fallbackValue: BuildpadI18nContextValue | null = null;
function getFallbackValue(): BuildpadI18nContextValue {
  if (!fallbackValue) {
    fallbackValue = buildContextValue({
      locale: undefined,
      timeZone: undefined,
      translations: defaultTranslations,
      hasProvider: false,
    });
  }
  return fallbackValue;
}

export interface BuildpadI18nProviderProps {
  /** BCP 47 locale for dictionary selection and Intl formatting. Default `"en"`. */
  locale?: string;
  /** Text direction; derived from `locale` when omitted. */
  direction?: TextDirection;
  /**
   * IANA time zone for `formatDate`. Defaults to UTC so server and client
   * render the same string (no hydration mismatch). Pass the user's zone to
   * show local times.
   */
  timeZone?: string;
  /** Partial dictionary merged over the English defaults (`dictionary.buildpad` in a scaffolded app). */
  translations?: BuildpadTranslationsInput | null;
  /** Mount Mantine's `DatesProvider` with `locale` / `firstDayOfWeek` (default `true`). */
  datesProvider?: boolean;
  /** 0 = Sunday … 6 = Saturday. Passed to `DatesProvider`. */
  firstDayOfWeek?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  children: ReactNode;
}

export function BuildpadI18nProvider({
  locale = DEFAULT_LOCALE,
  direction,
  timeZone = BUILDPAD_I18N_DEFAULT_TIMEZONE,
  translations,
  datesProvider = true,
  firstDayOfWeek,
  children,
}: BuildpadI18nProviderProps) {
  const merged = useMemo(
    () => mergeTranslations(defaultTranslations, translations ?? undefined),
    [translations],
  );

  const value = useMemo(
    () =>
      buildContextValue({
        locale,
        direction,
        timeZone,
        translations: merged,
        hasProvider: true,
      }),
    [locale, direction, timeZone, merged],
  );

  const content = <BuildpadI18nContext.Provider value={value}>{children}</BuildpadI18nContext.Provider>;

  if (!datesProvider) return content;

  return (
    <DatesProvider
      settings={{
        // dayjs locale data for non-English locales is loaded by the DateTime
        // interface on demand (see ui-interfaces/datetime/dayjs-locales.ts).
        locale: value.locale.split(/[-_]/)[0]?.toLowerCase() || DEFAULT_LOCALE,
        ...(timeZone ? { timezone: timeZone } : {}),
        ...(firstDayOfWeek !== undefined ? { firstDayOfWeek } : {}),
      }}
    >
      {content}
    </DatesProvider>
  );
}

/**
 * Locale, dictionary and formatters. Never throws — returns English defaults
 * and browser formatting when no provider is mounted.
 */
export function useBuildpadI18n(): BuildpadI18nContextValue {
  return useContext(BuildpadI18nContext) ?? getFallbackValue();
}

/** The context value, or `null` when no provider is mounted. */
export function useBuildpadI18nOptional(): BuildpadI18nContextValue | null {
  return useContext(BuildpadI18nContext);
}

/**
 * One namespace of the dictionary with component-prop overrides applied on
 * top — the standard way a component obtains its strings.
 *
 * @example
 * const t = useBuildpadTranslations((d) => d.table, { noItems: props.noItemsText });
 */
export function useBuildpadTranslations<T extends object>(
  select: (dictionary: BuildpadTranslations) => T,
  ...overrides: Array<DeepPartial<T> | Partial<T> | null | undefined>
): T {
  const { translations } = useBuildpadI18n();
  const base = select(translations);
  // Overrides are usually inline props; merge is cheap, so memoise on the
  // values rather than on array identity.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => mergeTranslations(base, ...overrides), [base, ...overrides]);
}
