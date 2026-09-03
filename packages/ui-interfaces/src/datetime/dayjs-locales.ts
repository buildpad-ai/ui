/**
 * dayjs locale data for the DateTime interface.
 *
 * Mantine's pickers format through dayjs, which only knows the locales whose
 * data has been imported. `useDayjsLocale(locale)` loads the matching
 * `dayjs/locale/<code>` chunk on demand (a dynamic import per locale, so the
 * app bundle does not carry all 140) and returns the dayjs locale key once it
 * is registered — pass it to the picker's `locale` prop.
 *
 * `en` is built in and resolves immediately. Unknown locales resolve to
 * `undefined` (dayjs falls back to English) rather than throwing.
 */
import { useEffect, useState } from 'react';
import dayjs from 'dayjs';

type Loader = () => Promise<unknown>;

/** Locales with a bundled loader, keyed by dayjs locale name (lower-case). */
const LOADERS: Record<string, Loader> = {
  ar: () => import('dayjs/locale/ar'),
  bn: () => import('dayjs/locale/bn'),
  cs: () => import('dayjs/locale/cs'),
  da: () => import('dayjs/locale/da'),
  de: () => import('dayjs/locale/de'),
  el: () => import('dayjs/locale/el'),
  'en-gb': () => import('dayjs/locale/en-gb'),
  es: () => import('dayjs/locale/es'),
  fa: () => import('dayjs/locale/fa'),
  fi: () => import('dayjs/locale/fi'),
  fr: () => import('dayjs/locale/fr'),
  he: () => import('dayjs/locale/he'),
  hi: () => import('dayjs/locale/hi'),
  hu: () => import('dayjs/locale/hu'),
  id: () => import('dayjs/locale/id'),
  it: () => import('dayjs/locale/it'),
  ja: () => import('dayjs/locale/ja'),
  ko: () => import('dayjs/locale/ko'),
  ms: () => import('dayjs/locale/ms'),
  nb: () => import('dayjs/locale/nb'),
  nl: () => import('dayjs/locale/nl'),
  pl: () => import('dayjs/locale/pl'),
  pt: () => import('dayjs/locale/pt'),
  'pt-br': () => import('dayjs/locale/pt-br'),
  ro: () => import('dayjs/locale/ro'),
  ru: () => import('dayjs/locale/ru'),
  sv: () => import('dayjs/locale/sv'),
  th: () => import('dayjs/locale/th'),
  tr: () => import('dayjs/locale/tr'),
  uk: () => import('dayjs/locale/uk'),
  ur: () => import('dayjs/locale/ur'),
  vi: () => import('dayjs/locale/vi'),
  'zh-cn': () => import('dayjs/locale/zh-cn'),
  'zh-tw': () => import('dayjs/locale/zh-tw'),
};

/** BCP 47 tags whose dayjs name differs from a plain lower-casing. */
const ALIASES: Record<string, string> = {
  zh: 'zh-cn',
  'zh-hans': 'zh-cn',
  'zh-hant': 'zh-tw',
  'zh-hk': 'zh-tw',
  no: 'nb',
  'en-us': 'en',
};

/**
 * "id-ID" → "id", "pt-BR" → "pt-br", "zh-Hant" → "zh-tw", "en" → "en".
 * Returns `undefined` for locales without bundled data.
 */
export function dayjsLocaleKey(locale: string | undefined | null): string | undefined {
  if (!locale) return undefined;
  const normalized = locale.trim().toLowerCase().replace(/_/g, '-');
  if (!normalized) return undefined;
  const aliased = ALIASES[normalized] ?? normalized;
  if (aliased === 'en') return 'en';
  if (LOADERS[aliased]) return aliased;
  const primary = aliased.split('-')[0];
  if (ALIASES[primary]) return ALIASES[primary];
  if (primary === 'en') return 'en';
  return LOADERS[primary] ? primary : undefined;
}

/** Whether dayjs already has the locale registered. */
export function isDayjsLocaleLoaded(key: string): boolean {
  return key === 'en' || Boolean((dayjs as unknown as { Ls: Record<string, unknown> }).Ls?.[key]);
}

const inflight = new Map<string, Promise<string | undefined>>();

/**
 * Load the dayjs locale data for `locale`. Resolves to the dayjs locale key
 * once registered, or `undefined` when no data is bundled for it.
 */
export function ensureDayjsLocale(locale: string | undefined | null): Promise<string | undefined> {
  const key = dayjsLocaleKey(locale);
  if (!key) return Promise.resolve(undefined);
  if (isDayjsLocaleLoaded(key)) return Promise.resolve(key);
  let pending = inflight.get(key);
  if (!pending) {
    pending = LOADERS[key]()
      .then(() => (isDayjsLocaleLoaded(key) ? key : undefined))
      .catch(() => undefined)
      .finally(() => inflight.delete(key));
    inflight.set(key, pending);
  }
  return pending;
}

/**
 * React hook: the dayjs locale key for `locale` once its data is loaded
 * (`'en'` immediately; `undefined` while loading or when unsupported).
 */
export function useDayjsLocale(locale: string | undefined | null): string | undefined {
  const key = dayjsLocaleKey(locale);
  const [loaded, setLoaded] = useState<string | undefined>(() =>
    key && isDayjsLocaleLoaded(key) ? key : undefined,
  );

  useEffect(() => {
    let alive = true;
    if (!key) {
      setLoaded(undefined);
      return;
    }
    if (isDayjsLocaleLoaded(key)) {
      setLoaded(key);
      return;
    }
    void ensureDayjsLocale(key).then((resolved) => {
      if (alive) setLoaded(resolved);
    });
    return () => {
      alive = false;
    };
  }, [key]);

  return loaded;
}
