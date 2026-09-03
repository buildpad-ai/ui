/**
 * The component i18n core ships as lib/buildpad/i18n/* (a sibling of the
 * utils barrel, not under it), so `@buildpad/utils/i18n` must map there — and
 * the generic `@buildpad/utils/<sub>` rule must not claim it first.
 */
import { describe, expect, test } from 'vitest';
import { transformImports } from '../src/commands/transformer.js';
import type { Config } from '../src/commands/init.js';

const config: Config = {
  schemaVersion: 3,
  model: 'copy-own',
  tsx: true,
  srcDir: false,
  aliases: { components: '@/components/ui', lib: '@/lib/buildpad' },
  installedLib: [],
  installedComponents: [],
};

describe('transformImports — @buildpad/utils/i18n', () => {
  test('maps the i18n root to lib/buildpad/i18n', () => {
    const out = transformImports(`import { interpolate } from '@buildpad/utils/i18n';`, config);
    expect(out).toBe(`import { interpolate } from '@/lib/buildpad/i18n';`);
  });

  test('maps i18n subpaths beneath lib/buildpad/i18n', () => {
    const out = transformImports(`import { id } from "@buildpad/utils/i18n/locales/id";`, config);
    expect(out).toBe(`import { id } from '@/lib/buildpad/i18n/locales/id';`);
  });

  test('leaves other utils subpaths on the utils rule', () => {
    const out = transformImports(`import { x } from '@buildpad/utils/conceal';`, config);
    expect(out).toBe(`import { x } from '@/lib/buildpad/utils/conceal';`);
  });

  test('the bare utils barrel still maps to lib/buildpad/utils', () => {
    const out = transformImports(`import { mergeTranslations } from '@buildpad/utils';`, config);
    expect(out).toBe(`import { mergeTranslations } from '@/lib/buildpad/utils';`);
  });
});

describe('originHeaderApplies', () => {
  test('JSON dictionaries and text files are copied without a comment header', async () => {
    const { originHeaderApplies } = await import('../src/commands/transformer.js');
    expect(originHeaderApplies('lib/i18n/dictionaries/en.json')).toBe(false);
    expect(originHeaderApplies('README.md')).toBe(false);
    expect(originHeaderApplies('lib/i18n/config.ts')).toBe(true);
    expect(originHeaderApplies('components/LanguageSwitcher.tsx')).toBe(true);
    expect(originHeaderApplies('app/globals.css')).toBe(true);
  });
});
