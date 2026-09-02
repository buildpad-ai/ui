/**
 * dayjs locale loading for the DateTime interface: BCP 47 → dayjs key
 * mapping, on-demand registration, and graceful fallback for unsupported
 * locales.
 */
import dayjs from 'dayjs';
import { dayjsLocaleKey, ensureDayjsLocale, isDayjsLocaleLoaded } from '../datetime/dayjs-locales';

describe('dayjsLocaleKey', () => {
  test('maps BCP 47 tags to dayjs locale names', () => {
    expect(dayjsLocaleKey('en')).toBe('en');
    expect(dayjsLocaleKey('en-US')).toBe('en');
    expect(dayjsLocaleKey('en-GB')).toBe('en-gb');
    expect(dayjsLocaleKey('id')).toBe('id');
    expect(dayjsLocaleKey('id-ID')).toBe('id');
    expect(dayjsLocaleKey('pt-BR')).toBe('pt-br');
    expect(dayjsLocaleKey('pt-PT')).toBe('pt');
    expect(dayjsLocaleKey('zh-Hant')).toBe('zh-tw');
    expect(dayjsLocaleKey('zh')).toBe('zh-cn');
    expect(dayjsLocaleKey('no')).toBe('nb');
  });

  test('returns undefined for unsupported or empty locales', () => {
    expect(dayjsLocaleKey('xx')).toBeUndefined();
    expect(dayjsLocaleKey('')).toBeUndefined();
    expect(dayjsLocaleKey(undefined)).toBeUndefined();
  });
});

describe('ensureDayjsLocale', () => {
  test('en is always available', async () => {
    expect(isDayjsLocaleLoaded('en')).toBe(true);
    await expect(ensureDayjsLocale('en-US')).resolves.toBe('en');
  });

  test('loads and registers a bundled locale on demand', async () => {
    expect(isDayjsLocaleLoaded('id')).toBe(false);
    await expect(ensureDayjsLocale('id-ID')).resolves.toBe('id');
    expect(isDayjsLocaleLoaded('id')).toBe(true);
    expect(dayjs('2024-01-15').locale('id').format('DD MMMM YYYY')).toBe('15 Januari 2024');
  });

  test('resolves undefined for a locale without bundled data', async () => {
    await expect(ensureDayjsLocale('xx')).resolves.toBeUndefined();
  });
});
