/**
 * BuildpadI18nProvider / useBuildpadI18n / useBuildpadTranslations
 *
 * Covers the no-provider fallback (English defaults, browser formatting), the
 * provider dictionary, prop > provider > defaults precedence, pinned time-zone
 * date formatting and plural formatting.
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  BuildpadI18nProvider,
  useBuildpadI18n,
  useBuildpadI18nOptional,
  useBuildpadTranslations,
  type BuildpadI18nProviderProps,
} from '../src/useBuildpadI18n';

function withProvider(props: Omit<BuildpadI18nProviderProps, 'children'>) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <BuildpadI18nProvider {...props}>{children}</BuildpadI18nProvider>;
  };
}

describe('useBuildpadI18n without a provider', () => {
  it('returns English defaults and formats with the runtime locale and zone', () => {
    const { result } = renderHook(() => useBuildpadI18n());
    expect(result.current.hasProvider).toBe(false);
    expect(result.current.locale).toBe('en');
    expect(result.current.direction).toBe('ltr');
    expect(result.current.timeZone).toBeUndefined();
    // No provider → Intl gets `undefined` (runtime default), exactly like the old toLocale* calls.
    const runtimeDefault = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
      new Date('2024-06-01T12:00:00Z'),
    );
    expect(result.current.formatDate('2024-06-01T12:00:00Z', { dateStyle: 'medium' })).toBe(runtimeDefault);
    expect(result.current.t('form.validation.required')).toBe('This field is required');
    expect(result.current.translations.table.noItems).toBe('No items');
  });

  it('formats dates and numbers without throwing', () => {
    const { result } = renderHook(() => useBuildpadI18n());
    expect(result.current.formatDate('2024-01-15T12:00:00Z')).not.toBe('');
    expect(result.current.formatDate('not a date')).toBe('');
    expect(result.current.formatDate(null)).toBe('');
    expect(result.current.formatNumber(1234)).toMatch(/1[,.\s]?234/);
    expect(result.current.formatNumber(undefined)).toBe('');
  });

  it('useBuildpadI18nOptional returns null', () => {
    const { result } = renderHook(() => useBuildpadI18nOptional());
    expect(result.current).toBeNull();
  });
});

describe('BuildpadI18nProvider', () => {
  it('exposes locale, direction, merged dictionary and pinned UTC zone', () => {
    const { result } = renderHook(() => useBuildpadI18n(), {
      wrapper: withProvider({
        locale: 'id',
        translations: { form: { validation: { required: 'Wajib diisi' } } },
      }),
    });
    expect(result.current.hasProvider).toBe(true);
    expect(result.current.locale).toBe('id');
    expect(result.current.direction).toBe('ltr');
    expect(result.current.timeZone).toBe('UTC');
    expect(result.current.t('form.validation.required')).toBe('Wajib diisi');
    // untouched keys keep the English default
    expect(result.current.t('form.validation.email')).toBe('Must be a valid email address');
  });

  it('derives rtl from the locale and accepts an explicit direction', () => {
    const ar = renderHook(() => useBuildpadI18n(), { wrapper: withProvider({ locale: 'ar' }) });
    expect(ar.result.current.direction).toBe('rtl');
    const forced = renderHook(() => useBuildpadI18n(), {
      wrapper: withProvider({ locale: 'ar', direction: 'ltr' }),
    });
    expect(forced.result.current.direction).toBe('ltr');
  });

  it('formats dates in the pinned time zone', () => {
    const iso = '2024-01-15T23:30:00Z';
    const utc = renderHook(() => useBuildpadI18n(), {
      wrapper: withProvider({ locale: 'en-US' }),
    });
    expect(utc.result.current.formatDate(iso, { dateStyle: 'medium' })).toBe('Jan 15, 2024');

    const jakarta = renderHook(() => useBuildpadI18n(), {
      wrapper: withProvider({ locale: 'en-US', timeZone: 'Asia/Jakarta' }),
    });
    expect(jakarta.result.current.formatDate(iso, { dateStyle: 'medium' })).toBe('Jan 16, 2024');
    expect(jakarta.result.current.formatDateTime(iso)).toContain('Jan 16, 2024');
  });

  it('formats numbers and plurals for the locale', () => {
    const { result } = renderHook(() => useBuildpadI18n(), {
      wrapper: withProvider({ locale: 'de-DE' }),
    });
    expect(result.current.formatNumber(1234.5)).toBe('1.234,5');
    expect(result.current.formatCount(1, { one: '{count} Eintrag', other: '{count} Einträge' })).toBe(
      '1 Eintrag',
    );
    expect(result.current.t('common.itemCount', { count: 2 })).toBe('2 items');
  });

  it('survives an invalid locale or time zone by falling back (never throws)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { result } = renderHook(() => useBuildpadI18n(), {
      wrapper: withProvider({ locale: 'en_US!', timeZone: 'Asia/Jakart' }),
    });
    expect(result.current.locale).toBe('en');
    expect(result.current.timeZone).toBe('UTC');
    expect(result.current.formatDate('2024-01-15T23:30:00Z', { dateStyle: 'medium' })).toBe('Jan 15, 2024');
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it('keeps the pinned zone when caller options are invalid', () => {
    const { result } = renderHook(() => useBuildpadI18n(), {
      wrapper: withProvider({ locale: 'en-US', timeZone: 'Asia/Jakarta' }),
    });
    expect(
      result.current.formatDate('2024-01-15T23:30:00Z', { dateStyle: 'nope' as unknown as 'medium' }),
    ).toBe('Jan 16, 2024');
  });

  it('canonicalises the locale tag', () => {
    const { result } = renderHook(() => useBuildpadI18n(), { wrapper: withProvider({ locale: 'id-id' }) });
    expect(result.current.locale).toBe('id-ID');
  });

  it('can be mounted without the Mantine DatesProvider', () => {
    const { result } = renderHook(() => useBuildpadI18n(), {
      wrapper: withProvider({ locale: 'id', datesProvider: false }),
    });
    expect(result.current.locale).toBe('id');
  });
});

describe('useBuildpadTranslations', () => {
  it('applies prop overrides over the provider dictionary over the defaults', () => {
    const { result } = renderHook(
      () =>
        useBuildpadTranslations((d) => d.interfaces.listM2M, {
          create_new: 'From prop',
        }),
      {
        wrapper: withProvider({
          locale: 'id',
          translations: {
            interfaces: { listM2M: { create_new: 'From provider', add_existing: 'Tambah' } },
          },
        }),
      },
    );
    expect(result.current.create_new).toBe('From prop');
    expect(result.current.add_existing).toBe('Tambah');
    expect(result.current.remove).toBe('Remove');
  });

  it('returns the same object across renders for structurally equal inline overrides', () => {
    const { result, rerender } = renderHook(
      ({ text }: { text: string }) => useBuildpadTranslations((d) => d.table, { noItems: text }),
      { initialProps: { text: 'Nothing here' } },
    );
    const first = result.current;
    rerender({ text: 'Nothing here' }); // new object literal, same content
    expect(result.current).toBe(first);
    rerender({ text: 'Changed' });
    expect(result.current).not.toBe(first);
    expect(result.current.noItems).toBe('Changed');
  });

  it('ignores undefined overrides so optional props do not blank strings', () => {
    const { result } = renderHook(() =>
      useBuildpadTranslations((d) => d.table, { noItems: undefined, loading: 'Please wait' }),
    );
    expect(result.current.noItems).toBe('No items');
    expect(result.current.loading).toBe('Please wait');
  });
});
