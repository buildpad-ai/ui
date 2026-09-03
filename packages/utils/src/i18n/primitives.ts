/**
 * Primitive types shared by every dictionary namespace. Kept apart from
 * `types.ts` so namespace files can import them without a cycle.
 */

/** CLDR plural categories. `other` is mandatory — it is the universal fallback. */
export interface PluralForms {
  zero?: string;
  one?: string;
  two?: string;
  few?: string;
  many?: string;
  other: string;
}

/**
 * True only for the plural-forms shape itself — an object whose keys are all
 * CLDR categories. A namespace that merely has an `other: string` key next to
 * unrelated keys is a namespace, not a plural entry.
 */
type IsPluralForms<T> = T extends PluralForms
  ? Exclude<keyof T, keyof PluralForms> extends never
    ? true
    : false
  : false;

/** Recursive partial — what apps and props may pass as overrides. */
export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends string
    ? string
    : IsPluralForms<T[K]> extends true
      ? Partial<PluralForms>
      : T[K] extends object
        ? DeepPartial<T[K]>
        : T[K];
};

/** Text direction of a locale. */
export type TextDirection = 'ltr' | 'rtl';

/** Values substituted into `{key}` placeholders. */
export type InterpolationValues = Record<string, string | number | boolean | null | undefined>;

/** The CLDR categories a `PluralForms` object may carry. */
export const PLURAL_CATEGORIES = ['zero', 'one', 'two', 'few', 'many', 'other'] as const;

const PLURAL_CATEGORY_SET: ReadonlySet<string> = new Set(PLURAL_CATEGORIES);

/**
 * Runtime counterpart of the type-level `IsPluralForms`: an object is a plural
 * entry only when it has an `other` string AND every one of its keys is a CLDR
 * category. A namespace that merely happens to contain an `other` key next to
 * unrelated ones — `interfaces.selectRadio.other` ("Other" radio option),
 * `interfaces.upload.categories.other` (the file category) — is a namespace,
 * not a plural entry, and must be merged key by key.
 */
export function isPluralFormsValue(value: unknown): value is PluralForms {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (typeof record.other !== 'string') return false;
  return Object.keys(record).every((key) => PLURAL_CATEGORY_SET.has(key));
}
