/**
 * scripts/build-registry.mjs tests
 *
 * Only tests pure helpers (no git / FS exercise). The heavy lift is verified
 * by `pnpm build:registry` in CI.
 */

import { afterAll, describe, expect, test } from 'vitest';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  extractSemverFromTag,
  releaseTagSemver,
  earliestReleaseSemver,
  deriveLastChangedIn,
  collectUndeclaredImports,
  moduleSpecifiers,
  // @ts-expect-error — pure ESM helper file lives outside the TS project
} from '../../../scripts/build-registry.mjs';

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

describe('releaseTagSemver', () => {
  test('accepts changesets-style @buildpad tags', () => {
    expect(releaseTagSemver('@buildpad/ui-interfaces@1.8.0')).toBe('1.8.0');
    expect(releaseTagSemver('@buildpad/cli@1.8.1')).toBe('1.8.1');
  });

  test('accepts bare / v-prefixed / release- prefixed tags', () => {
    expect(releaseTagSemver('1.4.2')).toBe('1.4.2');
    expect(releaseTagSemver('v1.4.2')).toBe('1.4.2');
    expect(releaseTagSemver('release-1.4.2')).toBe('1.4.2');
  });

  test('rejects non-release tags that embed a version', () => {
    // These exist in the repo — their 0.1.0 must not win the earliest-release
    // selection for lastChangedIn.
    expect(releaseTagSemver('docs@0.1.0')).toBeUndefined();
    expect(releaseTagSemver('storybook-host@0.1.0')).toBeUndefined();
  });

  test('rejects branches and empty input', () => {
    expect(releaseTagSemver('main')).toBeUndefined();
    expect(releaseTagSemver('')).toBeUndefined();
    // @ts-expect-error — runtime resilience check
    expect(releaseTagSemver(undefined)).toBeUndefined();
  });
});

describe('earliestReleaseSemver', () => {
  test('picks the lowest release semver (first release containing the change)', () => {
    expect(
      earliestReleaseSemver([
        '@buildpad/ui-interfaces@1.8.0',
        '@buildpad/ui-interfaces@1.7.0',
        '@buildpad/utils@1.7.0',
      ])
    ).toBe('1.7.0');
  });

  test('ignores non-release tags mixed into the list', () => {
    expect(
      earliestReleaseSemver(['docs@0.1.0', 'main', '@buildpad/hooks@1.6.0', ''])
    ).toBe('1.6.0');
  });

  test('returns undefined when no release tag is present', () => {
    expect(earliestReleaseSemver(['docs@0.1.0', 'main', ''])).toBeUndefined();
    expect(earliestReleaseSemver([])).toBeUndefined();
  });

  test('compares numerically, not lexically', () => {
    expect(
      earliestReleaseSemver(['@buildpad/cli@1.10.0', '@buildpad/cli@1.9.0'])
    ).toBe('1.9.0');
  });
});

describe('deriveLastChangedIn', () => {
  test('takes the most recent release across files', () => {
    expect(deriveLastChangedIn(['1.2.0', '1.7.0', '1.3.1'], '1.9.0')).toBe('1.7.0');
  });

  test('an untagged file change dominates as the upcoming version', () => {
    // Regression: a component whose .tsx changed since the last release
    // (undefined) but whose .css last shipped in 1.8.0 must NOT report
    // 1.8.0 — consumers at 1.8.0 would never be flagged.
    expect(deriveLastChangedIn([undefined, '1.8.0'], '1.8.1')).toBe('1.8.1');
  });

  test('no files → the upcoming version', () => {
    expect(deriveLastChangedIn([], '1.9.0')).toBe('1.9.0');
  });

  test('compares numerically across minors', () => {
    expect(deriveLastChangedIn(['1.10.0', '1.9.0'], '1.11.0')).toBe('1.10.0');
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

describe('moduleSpecifiers', () => {
  test('finds every import form and skips comments and strings', () => {
    const text = [
      "import a from './a';",
      "import type {\n  B,\n} from './b';",
      "export { c } from './c';",
      "export * from './d';",
      "import './e.css';",
      "const F = lazy(() => import('./F'));",
      "// import g from './g';",
      "/* import h from './h'; */",
      "const s = \"import i from './i'\";",
    ].join('\n');
    expect(moduleSpecifiers(text)).toEqual(['./a', './b', './c', './d', './e.css', './F']);
  });
});

describe('collectUndeclaredImports', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'buildpad-registry-check-'));
  afterAll(() => fs.removeSync(root));

  const write = (rel: string, text: string) => fs.outputFileSync(path.join(root, rel), text);
  const component = (name: string, sources: string[], registryDependencies?: string[]) => ({
    name,
    files: sources.map((source) => ({ source, target: `components/ui/${path.basename(source)}` })),
    ...(registryDependencies ? { registryDependencies } : {}),
  });

  write('ui-interfaces/src/select-icon/SelectIcon.tsx', 'export const SelectIcon = 1;');
  write('ui-interfaces/src/upload/Upload.tsx', 'export const Upload = 1;');
  write('ui-collections/src/CollectionList.tsx', 'export const CollectionList = 1;');
  write('ui-interfaces/src/lazy/Lazy.tsx', "export const L = () => import('../select-icon/SelectIcon');");
  write('ui-users/src/Uses.tsx', "import { SelectIcon } from '@buildpad/ui-interfaces/select-icon';");
  write('ui-users/src/Dynamic.tsx', "export const U = () => import('@buildpad/ui-interfaces/upload');");
  write('ui-users/src/Bogus.tsx', "import { X } from '@buildpad/ui-interfaces/not-a-component';");
  write('ui-collections/src/CollectionForm.tsx', "import { CollectionList } from './CollectionList';");
  write('ui-interfaces/src/commented/Commented.tsx', "// import { Upload } from '../upload/Upload';\nexport {};");

  const base = [
    component('select-icon', ['ui-interfaces/src/select-icon/SelectIcon.tsx']),
    component('upload', ['ui-interfaces/src/upload/Upload.tsx']),
    component('collection-list', ['ui-collections/src/CollectionList.tsx']),
  ];
  const check = (...entries: object[]) => collectUndeclaredImports({ components: [...base, ...entries], lib: {} }, root);

  test('a dynamic relative import must be declared', () => {
    expect(check(component('lazy', ['ui-interfaces/src/lazy/Lazy.tsx']))).toEqual([
      { component: 'lazy', file: 'ui-interfaces/src/lazy/Lazy.tsx', spec: '../select-icon/SelectIcon', needs: 'select-icon' },
    ]);
    expect(check(component('lazy', ['ui-interfaces/src/lazy/Lazy.tsx'], ['select-icon']))).toEqual([]);
  });

  test('an @buildpad/ui-interfaces/<x> subpath (static or dynamic) must be a declared component', () => {
    expect(check(component('users', ['ui-users/src/Uses.tsx', 'ui-users/src/Dynamic.tsx']))).toEqual([
      { component: 'users', file: 'ui-users/src/Uses.tsx', spec: '@buildpad/ui-interfaces/select-icon', needs: 'select-icon' },
      { component: 'users', file: 'ui-users/src/Dynamic.tsx', spec: '@buildpad/ui-interfaces/upload', needs: 'upload' },
    ]);
    expect(check(component('users', ['ui-users/src/Uses.tsx', 'ui-users/src/Dynamic.tsx'], ['select-icon', 'upload']))).toEqual([]);
  });

  test('an @buildpad/ui-interfaces/<x> subpath must name a registry component', () => {
    expect(check(component('bogus', ['ui-users/src/Bogus.tsx'], ['select-icon']))).toEqual([
      {
        kind: 'unknown-component',
        component: 'bogus',
        file: 'ui-users/src/Bogus.tsx',
        spec: '@buildpad/ui-interfaces/not-a-component',
        needs: 'not-a-component',
      },
    ]);
  });

  test('a PascalCase sibling import names the component that ships the file', () => {
    expect(check(component('collection-form', ['ui-collections/src/CollectionForm.tsx']))).toEqual([
      { component: 'collection-form', file: 'ui-collections/src/CollectionForm.tsx', spec: './CollectionList', needs: 'collection-list' },
    ]);
    expect(check(component('collection-form', ['ui-collections/src/CollectionForm.tsx'], ['collection-list']))).toEqual([]);
  });

  test('commented-out imports are ignored', () => {
    expect(check(component('commented', ['ui-interfaces/src/commented/Commented.tsx']))).toEqual([]);
  });

  test('the committed registry has no undeclared imports', async () => {
    const registry = await fs.readJSON(REGISTRY_PATH);
    expect(collectUndeclaredImports(registry)).toEqual([]);
  });
});
