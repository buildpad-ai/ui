/**
 * ListM2M Translation System
 *
 * The strings live in the shared Buildpad dictionary
 * (`@buildpad/utils` → `defaultTranslations.interfaces.listM2M`) so an app
 * translates them once through `BuildpadI18nProvider`. This module keeps the
 * original `M2MTranslations` API — `defaultTranslations`, `mergeTranslations`,
 * `interpolate`, `formatItemCount` — for the `translations` prop and for
 * consumers who imported it directly.
 *
 * Precedence: `translations` prop > provider dictionary > English defaults.
 *
 * @module @buildpad/ui-interfaces/list-m2m/translations
 */

import {
  defaultTranslations as buildpadDefaults,
  interpolate,
  mergeTranslations as mergeDeep,
  type ListM2MTranslations,
} from '@buildpad/utils';

export type M2MTranslations = ListM2MTranslations;

export { interpolate };

/**
 * Default English translations (the shared `interfaces.listM2M` namespace).
 */
export const defaultTranslations: M2MTranslations = buildpadDefaults.interfaces.listM2M;

/**
 * Merge user-provided partial translations with defaults. Pass the provider's
 * namespace as `base` so prop overrides land on top of the app dictionary.
 */
export function mergeTranslations(
    overrides?: Partial<M2MTranslations>,
    base: M2MTranslations = defaultTranslations,
): M2MTranslations {
    if (!overrides) return base;
    return mergeDeep(base, overrides);
}

/**
 * Format item count with correct plural form.
 */
export function formatItemCount(
    count: number,
    t: M2MTranslations,
): string {
    if (count === 1) return t.item_count_one;
    return interpolate(t.item_count_other, { count });
}
