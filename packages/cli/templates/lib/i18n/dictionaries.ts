/**
 * Server-only dictionary loader. The root layout (`app/[lang]/layout.tsx`)
 * awaits `getDictionary(lang)` and hands the result to `I18nProvider`.
 *
 * Every locale in `config.ts` needs a loader here — `Record<Locale, …>`
 * makes a missing one a type error.
 *
 * @buildpad/origin: lib/i18n/dictionaries
 * @buildpad/version: 1.0.0
 */

import "server-only";
import type { Locale } from "./config";
import type { Dictionary } from "./types";

const loaders: Record<Locale, () => Promise<Dictionary>> = {
  // buildpad:dictionary-loaders-start — edited by `buildpad init --locales`
  en: () => import("./dictionaries/en.json").then((m) => m.default),
  // buildpad:dictionary-loaders-end
};

export async function getDictionary(locale: Locale): Promise<Dictionary> {
  return loaders[locale]();
}
