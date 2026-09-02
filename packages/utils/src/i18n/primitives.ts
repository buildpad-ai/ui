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

/** Recursive partial — what apps and props may pass as overrides. */
export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends string
    ? string
    : T[K] extends PluralForms
      ? Partial<PluralForms>
      : T[K] extends object
        ? DeepPartial<T[K]>
        : T[K];
};

/** Text direction of a locale. */
export type TextDirection = 'ltr' | 'rtl';

/** Values substituted into `{key}` placeholders. */
export type InterpolationValues = Record<string, string | number | boolean | null | undefined>;
