/**
 * Leftover @buildpad/* imports: the shared scanner, `validate` (detects them)
 * and `fix` (rewrites them).
 *
 * Before: both only matched `from '@buildpad/` on one line, under
 * components/** and lib/buildpad/** — missing dynamic `import()`, side-effect
 * imports and every installed file elsewhere (app/api, lib/i18n, middleware.ts,
 * …) — and `fix` re-ran the transformer without a target path, which
 * kebab-cased VForm's PascalCase sibling imports ('./FormFieldInterface' →
 * './form-field-interface') and a user's own relative imports.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { findUntransformedImports, scanSpecifiers } from '../src/utils/import-specifiers.js';
import { installedTargetRoots } from '../src/utils/paths.js';
import { validate } from '../src/commands/validate.js';
import { fix } from '../src/commands/fix.js';
import type { Config } from '../src/commands/init.js';

describe('scanSpecifiers', () => {
  test('finds every import form with its kind and line', () => {
    const content = [
      "import a from 'a';",
      'import type {',
      '  B,',
      '} from "b";',
      "export * from 'c';",
      "export { d } from'd';",
      "import 'e.css';",
      "const F = lazy(() => import( 'f' ));",
      "type G = import('g').G;",
      "const h = require('h');",
      "import i = require('i');",
      "declare module 'j' {}",
      "const notAnImport = x.from('k');",
    ].join('\n');
    expect(scanSpecifiers(content).map(s => [s.kind, s.specifier, s.line])).toEqual([
      ['from', 'a', 1],
      ['from', 'b', 4],
      ['from', 'c', 5],
      ['from', 'd', 6],
      ['side-effect', 'e.css', 7],
      ['dynamic', 'f', 8],
      ['dynamic', 'g', 9],
      ['require', 'h', 10],
      ['require', 'i', 11],
      ['ambient', 'j', 12],
    ]);
  });

  test('literal offsets cover exactly the quoted specifier', () => {
    const content = 'x; import("@buildpad/hooks")';
    const [m] = scanSpecifiers(content);
    expect(content.slice(m.literalStart, m.literalEnd)).toBe('"@buildpad/hooks"');
    expect(content.slice(m.start, m.end)).toBe('import("@buildpad/hooks")');
  });
});

describe('findUntransformedImports', () => {
  test('flags @buildpad/* in every form and skips comment lines', () => {
    const content = [
      '/**',
      " * import { X } from '@buildpad/types';",
      ' */',
      "// import { Y } from '@buildpad/types';",
      'import {',
      '  Z,',
      "} from '@buildpad/types';",
      "const L = lazy(() => import('@buildpad/ui-interfaces/upload'));",
      "import '@buildpad/ui-form/styles.css';",
      "export { s } from '@buildpad/services';",
      "import { ok } from '@/lib/buildpad/types';",
    ].join('\n');
    expect(findUntransformedImports(content).map(f => [f.line, f.kind, f.specifier])).toEqual([
      [7, 'from', '@buildpad/types'],
      [8, 'dynamic', '@buildpad/ui-interfaces/upload'],
      [9, 'side-effect', '@buildpad/ui-form/styles.css'],
      [10, 'from', '@buildpad/services'],
    ]);
  });
});

describe('installedTargetRoots', () => {
  test('every recorded root plus the legacy ones, nested roots collapsed', () => {
    const config = {
      components: { a: { files: [{ target: 'components/ui/a.tsx' }] } },
      lib: {
        x: { files: [{ target: 'app/api/x/route.ts' }, { target: 'lib/i18n/config.ts' }, { target: 'middleware.ts' }] },
      },
    } as unknown as Config;
    expect(installedTargetRoots(config)).toEqual(['app', 'components', 'lib', 'middleware.ts']);
    expect(installedTargetRoots({} as Config)).toEqual(['components', 'lib/buildpad']);
  });
});

describe('validate / fix over a project', () => {
  let cwd: string;
  let src: string;

  beforeEach(async () => {
    cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'buildpad-untransformed-'));
    src = path.join(cwd, 'src');
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.remove(cwd);
  });

  const rec = (target: string) => ({ target, sourceSha256: 'x', sha256: 'y', ref: 'v1', state: 'clean' });

  async function project(files: Record<string, string>) {
    for (const [rel, content] of Object.entries(files)) await fs.outputFile(path.join(src, rel), content);
    await fs.writeJSON(path.join(cwd, 'buildpad.json'), {
      schemaVersion: 3,
      model: 'copy-own',
      tsx: true,
      srcDir: true,
      aliases: { components: '@/components/ui', lib: '@/lib/buildpad' },
      installedComponents: ['vform', 'input'],
      installedLib: ['api-routes'],
      components: {
        vform: {
          release: '1', ref: 'v1', sourcePackage: '@buildpad/ui-form', installedAt: 'x',
          files: [rec('components/ui/vform/components/FormField.tsx'), rec('components/ui/vform/components/FormFieldInterface.tsx')],
        },
        input: {
          release: '1', ref: 'v1', sourcePackage: '@buildpad/ui-interfaces', installedAt: 'x',
          files: [rec('components/ui/input.tsx')],
        },
      },
      lib: {
        'api-routes': {
          release: '1', ref: 'v1', sourcePackage: '@buildpad/cli', installedAt: 'x',
          files: [rec('app/api/thing/route.ts'), rec('lib/i18n/config.ts'), rec('middleware.ts')],
        },
      },
    });
  }

  test('validate reports leftovers in every form, outside components/ and lib/buildpad/ too', async () => {
    await project({
      'components/ui/a.tsx': "export const A = lazy(() => import('@buildpad/ui-interfaces/upload'));\n",
      'components/ui/doc.tsx': "/**\n * import { X } from '@buildpad/types';\n */\nexport {};\n",
      'app/api/thing/route.ts': "export { apiRequest } from '@buildpad/services';\n",
      'lib/i18n/config.ts': "import '@buildpad/utils/styles.css';\n",
      'middleware.ts': 'import {\n  type Field,\n} from "@buildpad/types";\n',
    });

    const result = await validate({ cwd, noExit: true });

    const found = result!.errors.filter(e => e.code === 'UNTRANSFORMED_IMPORT').map(e => `${e.file}:${e.line}`);
    expect(found.sort()).toEqual([
      'src/app/api/thing/route.ts:1',
      'src/components/ui/a.tsx:1',
      'src/lib/i18n/config.ts:1',
      'src/middleware.ts:3',
    ]);
  });

  test('fix rewrites a VForm file without kebab-casing its PascalCase imports', async () => {
    const formField = [
      "import type { Field } from '@buildpad/types';",
      "import { FormFieldInterface } from './FormFieldInterface';",
      "import { VForm } from '../VForm';",
      '',
    ].join('\n');
    await project({
      'components/ui/vform/components/FormField.tsx': formField,
      'components/ui/vform/components/FormFieldInterface.tsx': 'export const FormFieldInterface = 1;\n',
      'components/ui/vform/VForm.tsx': 'export const VForm = 1;\n',
    });

    await fix({ cwd, yes: true });

    expect(await fs.readFile(path.join(src, 'components/ui/vform/components/FormField.tsx'), 'utf8')).toBe(
      formField.replace("'@buildpad/types'", "'@/lib/buildpad/types'"),
    );
  });

  test("fix leaves a user's own relative imports alone", async () => {
    const widget = "import { VForm } from '@buildpad/ui-form';\nimport { Panel } from './MyPanel';\n";
    await project({ 'components/MyWidget.tsx': widget, 'components/MyPanel.tsx': 'export const Panel = 1;\n' });

    await fix({ cwd, yes: true });

    expect(await fs.readFile(path.join(src, 'components/MyWidget.tsx'), 'utf8')).toBe(
      "import { VForm } from '@/components/ui/vform';\nimport { Panel } from './MyPanel';\n",
    );
  });

  test("fix leaves a user's relative imports alone in installed (recorded) files too", async () => {
    // add's transform already normalised the casing of every shipped import, so
    // re-running it here could only rename imports the user added.
    const input = "import type { Field } from '@buildpad/types';\nimport { Helper } from './MyHelper';\n";
    const route = "import { apiRequest } from '@buildpad/services';\nimport { Util } from './RouteUtil';\n";
    await project({
      'components/ui/input.tsx': input,
      'components/ui/MyHelper.tsx': 'export const Helper = 1;\n',
      'app/api/thing/route.ts': route,
      'app/api/thing/RouteUtil.ts': 'export const Util = 1;\n',
    });

    await fix({ cwd, yes: true });

    expect(await fs.readFile(path.join(src, 'components/ui/input.tsx'), 'utf8')).toBe(
      "import type { Field } from '@/lib/buildpad/types';\nimport { Helper } from './MyHelper';\n",
    );
    expect(await fs.readFile(path.join(src, 'app/api/thing/route.ts'), 'utf8')).toBe(
      "import { apiRequest } from '@/lib/buildpad/services';\nimport { Util } from './RouteUtil';\n",
    );
  });

  test('fix reaches installed files outside components/ and lib/buildpad/, and reports what it cannot rewrite', async () => {
    await project({
      'app/api/thing/route.ts': "export { apiRequest } from '@buildpad/services';\n",
      'lib/i18n/config.ts': "export const load = () => import('@buildpad/hooks');\n",
      'middleware.ts': "import '@buildpad/mcp';\n",
    });

    await fix({ cwd, yes: true });

    expect(await fs.readFile(path.join(src, 'app/api/thing/route.ts'), 'utf8')).toBe(
      "export { apiRequest } from '@/lib/buildpad/services';\n",
    );
    expect(await fs.readFile(path.join(src, 'lib/i18n/config.ts'), 'utf8')).toBe(
      "export const load = () => import('@/lib/buildpad/hooks');\n",
    );
    expect(await fs.readFile(path.join(src, 'middleware.ts'), 'utf8')).toBe("import '@buildpad/mcp';\n");
    const logged = vi.mocked(console.log).mock.calls.flat().join('\n');
    expect(logged).toContain("src/middleware.ts:1 cannot rewrite '@buildpad/mcp'");
  });
});
