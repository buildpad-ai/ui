/**
 * Bundled locale catalogs. `en` is the defaults object itself.
 *
 * Add a locale by creating `<code>.ts` with the full `BuildpadTranslations`
 * shape and registering it here — the parity test then covers it.
 */
import { defaultTranslations } from '../defaults';
import type { BuildpadTranslations } from '../types';
import { id } from './id';

export { id };
export const en: BuildpadTranslations = defaultTranslations;

/** Every catalog shipped with Buildpad, keyed by primary language subtag. */
export const bundledLocales: Record<string, BuildpadTranslations> = { en, id };

/** The bundled catalog for a locale ("id-ID" → id), or `undefined`. */
export function bundledTranslationsFor(locale: string | undefined | null): BuildpadTranslations | undefined {
  const primary = (locale ?? '').trim().split(/[-_]/)[0]?.toLowerCase();
  return primary ? bundledLocales[primary] : undefined;
}
