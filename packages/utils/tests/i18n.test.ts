/**
 * Component i18n core tests: interpolation, deep merge precedence, plural
 * selection, dotted-path translation, locale helpers, and the catalog parity
 * check that keeps every bundled locale in step with the English defaults.
 */
import { describe, it, expect } from 'vitest';
import {
  bundledLocales,
  bundledTranslationsFor,
  defaultTranslations,
  directionForLocale,
  formatCount,
  hasPlaceholders,
  id,
  interpolate,
  isPluralFormsValue,
  languageOf,
  lookupTranslation,
  mergeTranslations,
  pluralCategory,
  selectPlural,
  translate,
  type BuildpadTranslations,
} from '../src/i18n';

describe('interpolate', () => {
  it('replaces {key} placeholders', () => {
    expect(interpolate('Showing {start} to {end} of {total}', { start: 1, end: 10, total: 42 })).toBe(
      'Showing 1 to 10 of 42',
    );
  });

  it('leaves unknown placeholders visible', () => {
    expect(interpolate('Hello {name}', { other: 'x' })).toBe('Hello {name}');
  });

  it('renders null/undefined values as empty and is a no-op without values', () => {
    expect(interpolate('a{b}c', { b: null })).toBe('ac');
    expect(interpolate('a{b}c')).toBe('a{b}c');
  });

  it('hasPlaceholders detects remaining placeholders', () => {
    expect(hasPlaceholders('x {y}')).toBe(true);
    expect(hasPlaceholders('x y')).toBe(false);
    // stateful regex must not alternate between calls
    expect(hasPlaceholders('x {y}')).toBe(true);
  });
});

describe('mergeTranslations', () => {
  it('deep merges later arguments over earlier ones', () => {
    const merged = mergeTranslations(
      defaultTranslations,
      { form: { validation: { required: 'Provider' } } },
      { form: { validation: { required: 'Prop' } } },
    );
    expect(merged.form.validation.required).toBe('Prop');
    expect(merged.form.validation.email).toBe(defaultTranslations.form.validation.email);
    expect(merged.common.save).toBe('Save');
  });

  it('skips undefined and null overrides without blanking values', () => {
    const merged = mergeTranslations(defaultTranslations, undefined, null, {
      common: { save: undefined, cancel: 'Batal' },
    });
    expect(merged.common.save).toBe('Save');
    expect(merged.common.cancel).toBe('Batal');
  });

  it('never mutates its inputs', () => {
    const base = { a: { b: 'x', c: 'y' } };
    const override = { a: { b: 'z' } };
    const merged = mergeTranslations(base, override);
    expect(merged).toEqual({ a: { b: 'z', c: 'y' } });
    expect(base).toEqual({ a: { b: 'x', c: 'y' } });
    expect(override).toEqual({ a: { b: 'z' } });
    expect(merged.a).not.toBe(base.a);
  });

  it('replaces plural forms as a unit so English categories never leak into another locale', () => {
    const merged = mergeTranslations(defaultTranslations, {
      common: { itemCount: { other: '{count} item' } },
    });
    expect(merged.common.itemCount).toEqual({ other: '{count} item' });
    // the base object is untouched
    expect(defaultTranslations.common.itemCount.one).toBe('{count} item');
  });

  it('merges a namespace that merely contains an `other` key, key by key', () => {
    // `interfaces.selectRadio` is a namespace whose keys include `other`, the
    // "Other" radio option. Overriding only that key must not drop its
    // siblings: the replace-as-a-unit rule is for real plural entries only.
    const merged = mergeTranslations(defaultTranslations, {
      interfaces: { selectRadio: { other: 'Autre' } },
    });
    expect(merged.interfaces.selectRadio.other).toBe('Autre');
    expect(merged.interfaces.selectRadio.misconfigured).toBe(
      defaultTranslations.interfaces.selectRadio.misconfigured,
    );
    expect(merged.interfaces.selectRadio.customValuePlaceholder).toBe(
      defaultTranslations.interfaces.selectRadio.customValuePlaceholder,
    );
  });

  it('replaces a real plural entry as a unit, extra categories included', () => {
    const merged = mergeTranslations(defaultTranslations, {
      common: { itemCount: { two: 'عنصران', few: '{count} عناصر', other: '{count} عنصر' } },
    });
    expect(merged.common.itemCount).toEqual({
      two: 'عنصران',
      few: '{count} عناصر',
      other: '{count} عنصر',
    });
  });

  it('ignores prototype-polluting keys from parsed JSON', () => {
    const hostile = JSON.parse('{"__proto__":{"polluted":"yes"},"common":{"save":"Ok"}}');
    const merged = mergeTranslations(defaultTranslations, hostile);
    expect(Object.getPrototypeOf(merged)).toBe(Object.prototype);
    expect((merged as unknown as { polluted?: string }).polluted).toBeUndefined();
    expect(({} as { polluted?: string }).polluted).toBeUndefined();
    expect(merged.common.save).toBe('Ok');
  });

  it('a nested null override is ignored rather than wiping a subtree', () => {
    const merged = mergeTranslations(defaultTranslations, { form: null as unknown as undefined });
    expect(merged.form.validation.required).toBe('This field is required');
  });
});

describe('plural', () => {
  const forms = { one: '{count} item', other: '{count} items' };

  it('selects CLDR categories per locale', () => {
    expect(pluralCategory('en', 1)).toBe('one');
    expect(pluralCategory('en', 2)).toBe('other');
    expect(pluralCategory('id', 1)).toBe('other');
    expect(pluralCategory('ar', 0)).toBe('zero');
  });

  it('falls back to other when a category form is missing', () => {
    expect(selectPlural('ar', 0, { other: 'x' })).toBe('x');
    expect(selectPlural('en', 1, { other: 'x' })).toBe('x');
  });

  it('prefers an explicit zero form for 0 in any locale', () => {
    expect(selectPlural('en', 0, { zero: 'No items', ...forms })).toBe('No items');
    expect(selectPlural('en', 0, forms)).toBe('{count} items');
  });

  it('formatCount formats the count for the locale', () => {
    expect(formatCount('en', 1, forms)).toBe('1 item');
    expect(formatCount('en', 1234, forms)).toBe('1,234 items');
    expect(formatCount('de', 1234, forms)).toBe('1.234 items');
    expect(formatCount('id', 3, { other: '{count} item' })).toBe('3 item');
  });

  it('formatCount survives an invalid locale tag', () => {
    expect(formatCount('not a locale', 2, forms)).toBe('2 items');
  });
});

describe('isPluralFormsValue', () => {
  it('accepts only objects whose keys are all CLDR categories', () => {
    expect(isPluralFormsValue({ other: 'x' })).toBe(true);
    expect(isPluralFormsValue({ one: 'a', other: 'x' })).toBe(true);
    expect(
      isPluralFormsValue({ zero: 'z', one: 'a', two: 'b', few: 'c', many: 'd', other: 'x' }),
    ).toBe(true);
    // a namespace that merely carries an `other` key is not a plural entry
    expect(isPluralFormsValue({ other: 'Other', misconfigured: 'oops' })).toBe(false);
    expect(isPluralFormsValue({ one: 'a' })).toBe(false);
    expect(isPluralFormsValue('x')).toBe(false);
    expect(isPluralFormsValue(null)).toBe(false);
    expect(isPluralFormsValue(['other'])).toBe(false);
  });

  it('translate() does not treat such a namespace as a plural entry', () => {
    expect(translate(defaultTranslations, 'en', 'interfaces.selectRadio')).toBe(
      'interfaces.selectRadio',
    );
    expect(translate(defaultTranslations, 'en', 'interfaces.selectRadio.other')).toBe('Other');
  });
});

describe('lookupTranslation / translate', () => {
  it('resolves dotted paths to strings and plural forms', () => {
    expect(lookupTranslation(defaultTranslations, 'form.validation.required')).toBe(
      'This field is required',
    );
    expect(lookupTranslation(defaultTranslations, 'common.itemCount')).toEqual(
      defaultTranslations.common.itemCount,
    );
    expect(lookupTranslation(defaultTranslations, 'form')).toBeUndefined();
    expect(lookupTranslation(defaultTranslations, 'nope.nope')).toBeUndefined();
  });

  it('translate interpolates, pluralises with count, and echoes missing keys', () => {
    expect(translate(defaultTranslations, 'en', 'form.validation.generic', { type: 'regex' })).toBe(
      'Validation error: regex',
    );
    expect(translate(defaultTranslations, 'en', 'common.itemCount', { count: 1 })).toBe('1 item');
    expect(translate(defaultTranslations, 'en', 'common.itemCount', { count: 5 })).toBe('5 items');
    expect(translate(defaultTranslations, 'en', 'common.itemCount', { count: '12' })).toBe('12 items');
    expect(translate(defaultTranslations, 'en', 'missing.key')).toBe('missing.key');
  });

  it('translate leaves a non-numeric count alone and uses the universal form', () => {
    expect(translate(defaultTranslations, 'en', 'common.itemCount', { count: 'many' })).toBe('many items');
    expect(translate(defaultTranslations, 'en', 'common.itemCount')).toBe('{count} items');
  });

  it('bundledTranslationsFor ignores prototype members', () => {
    expect(bundledTranslationsFor('constructor')).toBeUndefined();
    expect(bundledTranslationsFor('__proto__')).toBeUndefined();
  });
});

describe('locale helpers', () => {
  it('languageOf / directionForLocale', () => {
    expect(languageOf('id-ID')).toBe('id');
    expect(languageOf('')).toBe('en');
    expect(languageOf(undefined)).toBe('en');
    expect(directionForLocale('ar-EG')).toBe('rtl');
    expect(directionForLocale('he')).toBe('rtl');
    expect(directionForLocale('en-US')).toBe('ltr');
    expect(directionForLocale(undefined)).toBe('ltr');
  });

  it('bundledTranslationsFor matches by primary subtag', () => {
    expect(bundledTranslationsFor('id-ID')).toBe(id);
    expect(bundledTranslationsFor('en')).toBe(defaultTranslations);
    expect(bundledTranslationsFor('fr')).toBeUndefined();
    expect(bundledTranslationsFor(undefined)).toBeUndefined();
  });
});

/** Every key path of `expected` must exist in `actual` with a compatible type. */
function missingKeys(expected: unknown, actual: unknown, prefix = ''): string[] {
  if (typeof expected === 'string') {
    return typeof actual === 'string' ? [] : [prefix || '(root)'];
  }
  if (expected && typeof expected === 'object') {
    const isPlural =
      typeof (expected as { other?: unknown }).other === 'string';
    if (isPlural) {
      return actual && typeof actual === 'object' && typeof (actual as { other?: unknown }).other === 'string'
        ? []
        : [prefix];
    }
    const out: string[] = [];
    for (const key of Object.keys(expected as object)) {
      out.push(
        ...missingKeys(
          (expected as Record<string, unknown>)[key],
          actual && typeof actual === 'object' ? (actual as Record<string, unknown>)[key] : undefined,
          prefix ? `${prefix}.${key}` : key,
        ),
      );
    }
    return out;
  }
  return [];
}

describe('bundled locale parity', () => {
  for (const [code, catalog] of Object.entries(bundledLocales)) {
    it(`${code} carries every key of the English defaults`, () => {
      expect(missingKeys(defaultTranslations, catalog)).toEqual([]);
    });

    it(`${code} has no keys the defaults lack`, () => {
      expect(missingKeys(catalog, defaultTranslations)).toEqual([]);
    });
  }

  it('the placeholders of each string match the defaults', () => {
    const placeholders = (s: string) => (s.match(/{\w+}/g) ?? []).sort();
    const walk = (a: unknown, b: unknown, path: string, out: string[]) => {
      if (typeof a === 'string' && typeof b === 'string') {
        if (placeholders(a).join() !== placeholders(b).join()) out.push(path);
        return;
      }
      if (a && b && typeof a === 'object' && typeof b === 'object') {
        for (const k of Object.keys(a as object)) {
          walk((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${path}.${k}`, out);
        }
      }
    };
    const mismatches: string[] = [];
    // Plural forms legitimately differ in which categories exist; compare `other`.
    for (const [code, catalog] of Object.entries(bundledLocales)) {
      walk(defaultTranslations, catalog as BuildpadTranslations, code, mismatches);
    }
    expect(mismatches.filter((m) => !/\.(one|zero|two|few|many)$/.test(m))).toEqual([]);
  });
});
