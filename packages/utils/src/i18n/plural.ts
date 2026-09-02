/**
 * Plural handling on `Intl.PluralRules`.
 *
 * Replaces the `item_count_one` / `item_count_other` special case: a
 * `PluralForms` object carries one string per CLDR category the locale needs
 * (`other` is mandatory) and `formatCount()` picks the right one, then
 * interpolates `{count}` formatted for the locale.
 */
import { interpolate } from './interpolate';
import type { InterpolationValues, PluralForms } from './types';

type PluralCategory = keyof PluralForms;

const rulesCache = new Map<string, Intl.PluralRules>();

/** The CLDR category `Intl.PluralRules` assigns to `count` in `locale`. */
export function pluralCategory(locale: string | undefined, count: number): PluralCategory {
  const key = locale ?? '';
  let rules = rulesCache.get(key);
  if (!rules) {
    try {
      rules = new Intl.PluralRules(locale);
    } catch {
      rules = new Intl.PluralRules('en');
    }
    rulesCache.set(key, rules);
  }
  return rules.select(count) as PluralCategory;
}

/**
 * Select the plural form for `count`. An explicit `zero` form wins for 0 even
 * in locales whose rules have no `zero` category (English "No items").
 */
export function selectPlural(locale: string | undefined, count: number, forms: PluralForms): string {
  if (count === 0 && forms.zero !== undefined) return forms.zero;
  const category = pluralCategory(locale, count);
  return forms[category] ?? forms.other;
}

/**
 * Select the plural form and interpolate it. `{count}` is pre-formatted with
 * `Intl.NumberFormat(locale)`; other placeholders come from `values`.
 *
 * @example
 * formatCount('en', 3, { one: '{count} item', other: '{count} items' }) // → '3 items'
 * formatCount('id', 3, { other: '{count} item' })                       // → '3 item'
 */
export function formatCount(
  locale: string | undefined,
  count: number,
  forms: PluralForms,
  values?: InterpolationValues,
): string {
  let formatted: string;
  try {
    formatted = new Intl.NumberFormat(locale).format(count);
  } catch {
    formatted = String(count);
  }
  return interpolate(selectPlural(locale, count, forms), { ...values, count: formatted });
}
