/**
 * scripts/build-registry.mjs tests
 *
 * Only tests pure helpers (no git / FS exercise). The heavy lift is verified
 * by `pnpm build:registry` in CI.
 */

import { describe, expect, test } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
// @ts-expect-error — pure ESM helper file lives outside the TS project
import { extractSemverFromTag } from '../../../scripts/build-registry.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REGISTRY_PATH = path.resolve(__dirname, '../../registry.json');

describe('extractSemverFromTag', () => {
  test('extracts bare semver tags', () => {
    expect(extractSemverFromTag('1.4.2')).toBe('1.4.2');
  });

  test('strips a "v" prefix', () => {
    expect(extractSemverFromTag('v1.4.2')).toBe('1.4.2');
  });

  test('extracts from a changesets-style tag', () => {
    expect(extractSemverFromTag('@buildpad/ui-interfaces@1.4.2')).toBe('1.4.2');
  });

  test('extracts from arbitrary release prefixes', () => {
    expect(extractSemverFromTag('release-2024-1.4.2')).toBe('1.4.2');
  });

  test('returns undefined when no semver is present', () => {
    expect(extractSemverFromTag('main')).toBeUndefined();
    expect(extractSemverFromTag('latest')).toBeUndefined();
  });

  test('returns undefined for empty / nullish input', () => {
    expect(extractSemverFromTag('')).toBeUndefined();
    // @ts-expect-error — runtime resilience check
    expect(extractSemverFromTag(undefined)).toBeUndefined();
  });
});

describe('generated registry — lib module enrichment', () => {
  test('lib modules carry version + lastChangedIn + sourcePackage', async () => {
    const registry = await fs.readJSON(REGISTRY_PATH);
    for (const [name, mod] of Object.entries<any>(registry.lib)) {
      expect(mod.version, `${name}.version`).toBeTruthy();
      expect(mod.lastChangedIn, `${name}.lastChangedIn`).toBeTruthy();
      expect(mod.sourcePackage, `${name}.sourcePackage`).toBeTruthy();
    }
  });

  test('design-system module is registered with the design + shell files', async () => {
    const registry = await fs.readJSON(REGISTRY_PATH);
    const ds = registry.lib['design-system'];
    expect(ds).toBeDefined();
    expect(ds.sourcePackage).toBe('@buildpad/cli');
    const targets = (ds.files ?? []).map((f: any) => f.target);
    expect(targets).toEqual(
      expect.arrayContaining([
        'app/design-tokens.css',
        'app/globals.css',
        'lib/theme.ts',
        'components/ColorSchemeToggle.tsx',
        'components/layout/AuthenticatedShell.tsx',
      ])
    );
    // every file has a computed source hash
    for (const f of ds.files) expect(f.sourceSha256).toBeTruthy();
  });
});
