/**
 * `--locales` rewriting (utils/i18n-locales.ts) against the real lib/i18n
 * templates: marker blocks are replaced, dictionaries are seeded, and the
 * result is still the shape the templates expect.
 */
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  applyLocales,
  localeDirection,
  localeDisplayName,
  parseLocalesOption,
} from '../src/utils/i18n-locales.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES = path.resolve(__dirname, '../templates/lib/i18n');

let tmpdir: string;

beforeEach(async () => {
  tmpdir = await fs.mkdtemp(path.join(os.tmpdir(), 'buildpad-locales-'));
  await fs.copy(TEMPLATES, path.join(tmpdir, 'lib', 'i18n'));
});

afterEach(async () => {
  await fs.remove(tmpdir);
});

describe('parseLocalesOption', () => {
  test('splits on commas and spaces, dedupes, keeps order', () => {
    expect(parseLocalesOption('en,id id, pt-BR')).toEqual(['en', 'id', 'pt-BR']);
  });

  test('returns undefined when not given', () => {
    expect(parseLocalesOption(undefined)).toBeUndefined();
  });

  test('rejects malformed codes and empty lists', () => {
    expect(() => parseLocalesOption('en,EN_us')).toThrow(/Invalid locale code/);
    expect(() => parseLocalesOption(' , ')).toThrow(/at least one/);
  });
});

describe('locale helpers', () => {
  test('display names come from ICU, direction from the language', () => {
    expect(localeDisplayName('id')).toBe('Bahasa Indonesia');
    expect(localeDisplayName('en')).toBe('English');
    expect(localeDisplayName('zz')).toBe('zz');
    expect(localeDirection('ar-EG')).toBe('rtl');
    expect(localeDirection('id')).toBe('ltr');
  });
});

describe('applyLocales', () => {
  test('rewrites config.ts, dictionaries.ts and seeds dictionaries', async () => {
    const result = await applyLocales({ cwd: tmpdir, srcDir: false, locales: ['en', 'id', 'pt-BR'] });

    expect(result.defaultLocale).toBe('en');
    expect(result.created).toEqual(['lib/i18n/dictionaries/id.json', 'lib/i18n/dictionaries/pt-BR.json']);

    const config = await fs.readFile(path.join(tmpdir, 'lib/i18n/config.ts'), 'utf-8');
    expect(config).toContain('export const locales = ["en", "id", "pt-BR"] as const;');
    expect(config).toContain('export const defaultLocale: Locale = "en";');
    expect(config).toContain('id: { name: "Bahasa Indonesia", direction: "ltr" },');
    expect(config).toContain('"pt-BR": { name: "Português (Brasil)", direction: "ltr" },');
    // markers survive so the rewrite is repeatable
    expect(config).toContain('// buildpad:locale-meta-start');
    expect(config).toContain('// buildpad:locale-meta-end');

    const dictionaries = await fs.readFile(path.join(tmpdir, 'lib/i18n/dictionaries.ts'), 'utf-8');
    expect(dictionaries).toContain('  id: () => import("./dictionaries/id.json").then((m) => m.default),');
    expect(dictionaries).toContain('  "pt-BR": () => import("./dictionaries/pt-BR.json").then((m) => m.default),');
    expect(dictionaries).not.toMatch(/en: \(\) => import[\s\S]*en: \(\) => import/);

    const en = await fs.readJSON(path.join(tmpdir, 'lib/i18n/dictionaries/en.json'));
    const id = await fs.readJSON(path.join(tmpdir, 'lib/i18n/dictionaries/id.json'));
    expect(id).toEqual(en);
  });

  test('is idempotent and honours an explicit default locale', async () => {
    await applyLocales({ cwd: tmpdir, srcDir: false, locales: ['en', 'id'] });
    await fs.writeJSON(path.join(tmpdir, 'lib/i18n/dictionaries/id.json'), { app: { brand: 'Aplikasi' } });

    const result = await applyLocales({ cwd: tmpdir, srcDir: false, locales: ['id', 'en'], defaultLocale: 'id' });
    expect(result.created).toEqual([]); // existing dictionaries are never overwritten

    const config = await fs.readFile(path.join(tmpdir, 'lib/i18n/config.ts'), 'utf-8');
    expect(config).toContain('export const locales = ["id", "en"] as const;');
    expect(config).toContain('export const defaultLocale: Locale = "id";');
    expect(config.match(/buildpad:locale-meta-start/g)).toHaveLength(1);
    const id = await fs.readJSON(path.join(tmpdir, 'lib/i18n/dictionaries/id.json'));
    expect(id).toEqual({ app: { brand: 'Aplikasi' } });
  });

  test('rejects a default locale outside the list and a missing module', async () => {
    await expect(
      applyLocales({ cwd: tmpdir, srcDir: false, locales: ['en'], defaultLocale: 'id' })
    ).rejects.toThrow(/not in the locale list/);
    await fs.remove(path.join(tmpdir, 'lib/i18n/config.ts'));
    await expect(applyLocales({ cwd: tmpdir, srcDir: false, locales: ['en'] })).rejects.toThrow(
      /not installed/
    );
  });

  test('dry run writes nothing', async () => {
    const before = await fs.readFile(path.join(tmpdir, 'lib/i18n/config.ts'), 'utf-8');
    const result = await applyLocales({ cwd: tmpdir, srcDir: false, locales: ['en', 'id'], dryRun: true });
    expect(result.created).toEqual(['lib/i18n/dictionaries/id.json']);
    expect(await fs.readFile(path.join(tmpdir, 'lib/i18n/config.ts'), 'utf-8')).toBe(before);
    expect(fs.existsSync(path.join(tmpdir, 'lib/i18n/dictionaries/id.json'))).toBe(false);
  });
});
