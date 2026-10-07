/**
 * Differential test: the current install transform must produce byte-for-byte
 * what the frozen pre-refactor transformer (tests/fixtures/transformer-frozen.ts)
 * produced, for every file the registry ships, under the default aliases and
 * under non-default ones.
 *
 * Why bytes matter: `upgrade` builds its three-way-merge base by re-transforming
 * the source at the consumer's installed ref with the CURRENT transformer, and
 * `migrate` re-derives v1 hashes the same way. Any drift on an import line would
 * read as a local edit and conflict with real upstream changes.
 */

import { describe, expect, test } from 'vitest';
import path from 'node:path';
import * as frozen from './fixtures/transformer-frozen.js';
import * as current from '../src/commands/transformer.js';
import {
  addPipeline,
  loadRegistry,
  makeConfig,
  transformCorpus,
  type TransformFn,
} from './helpers/registry-corpus.js';

/** The install pipeline exactly as add.ts ran it before the refactor, on the frozen functions. */
const frozenPipeline: TransformFn = (raw, file, owner, registry, config) => {
  if (owner.kind === 'component') {
    const component = owner.entry;
    let content = frozen.transformIntraComponentImports(raw, file.source, file.target, component.files);
    content = frozen.transformImports(content, config, file.target);
    if (!(component.name === 'vform' || file.target.includes('/vform/'))) {
      content = frozen.transformRelativeImports(content, file.source, file.target, config.aliases.components);
    }
    if (component.name === 'vform' || file.target.includes('/vform/')) {
      content = frozen.transformVFormImports(content, file.source, file.target);
    }
    return frozen.addOriginHeader(content, component.name, component.sourcePackage ?? '@buildpad/ui-interfaces', registry.version);
  }
  let content = frozen.transformImports(raw, config);
  if (frozen.originHeaderApplies(file.target)) {
    const label = file.single ? owner.name : `${owner.name}/${path.basename(file.source, path.extname(file.source))}`;
    content = frozen.addOriginHeader(content, label, owner.entry.sourcePackage ?? '@buildpad/cli', registry.version);
  }
  return content;
};

const ALIAS_CONFIGS = {
  default: { components: '@/components/ui', lib: '@/lib/buildpad' },
  'short @/ aliases': { components: '@/ui', lib: '@/lib/bp' },
  'non-@ aliases': { components: '~/components/buildpad', lib: '#lib/buildpad' },
};

const registry = loadRegistry();

describe.each(Object.entries(ALIAS_CONFIGS))('registry corpus, %s', (_label, aliases) => {
  const config = makeConfig({ aliases });
  const expected = transformCorpus(registry, config, frozenPipeline);
  const actual = transformCorpus(registry, config, addPipeline);

  test('every file is byte-identical to the frozen transformer', () => {
    expect(actual.length).toBe(expected.length);
    const drift = actual
      .map((f, i) => ({ f, want: expected[i].content }))
      .filter(({ f, want }) => f.content !== want)
      .map(({ f }) => `${f.owner.name} ${f.source}`);
    expect(drift).toEqual([]);
  });

  test('the corpus exercises the rewrite (it is not trivially unchanged)', () => {
    const rewritten = actual.filter(f => f.content.includes(aliases.lib) || f.content.includes(aliases.components));
    expect(rewritten.length).toBeGreaterThan(150);
  });
});

/**
 * Hand-written inputs for the shapes the corpus does not cover densely —
 * including every quirk the old regexes had and the refactor must keep.
 * Shapes whose output deliberately changed (0 corpus hits) are tested in
 * transformer.test.ts instead.
 */
const SYNTHETIC: Array<[label: string, input: string, targetPath?: string]> = [
  ['bare packages', "import { a } from '@buildpad/types';\nimport { b } from '@buildpad/services';\nimport { c } from '@buildpad/hooks';\nimport { d } from '@buildpad/utils';\n"],
  ['double quotes become single', 'import { a } from "@buildpad/types";\nexport * from "@buildpad/hooks";\n'],
  ['subpaths', "import { s } from '@buildpad/services/auth/session';\nimport type { F } from '@buildpad/types/core';\nimport { h } from '@buildpad/hooks/useFiles';\n"],
  ['utils i18n', "import { t } from '@buildpad/utils/i18n';\nimport { n } from '@buildpad/utils/i18n/namespaces/form';\n"],
  ['components', "import { Input } from '@buildpad/ui-interfaces';\nimport { Upload } from '@buildpad/ui-interfaces/upload';\nimport { List } from '@buildpad/ui-collections';\nimport { VForm } from '@buildpad/ui-form';\nimport { X } from '@buildpad/ui-form/types';\n"],
  ['feature packages', "import { FileManager } from '@buildpad/ui-files';\nimport { D } from '@buildpad/ui-files/detail';\nimport { UsersManager } from '@buildpad/ui-users';\nimport { R } from '@buildpad/ui-users/roles';\n"],
  ['ui-table value + type', "import { VTable } from '@buildpad/ui-table';\nimport type { Header, Sort } from '@buildpad/ui-table';\nimport type {\n  Item,\n} from \"@buildpad/ui-table\";\n"],
  ['ui-table export type goes to vtable', "export type { Header } from '@buildpad/ui-table';\n"],
  ['type-only imports', "import type { A } from '@buildpad/types';\nimport type { B } from '@buildpad/hooks';\nimport type { C } from '@buildpad/services';\nimport type { D } from '@buildpad/utils';\nimport type { E } from '@buildpad/ui-form';\n"],
  ['multi-line import', "import {\n  a,\n  b,\n} from '@buildpad/services';\n"],
  ['export forms', "export { a } from '@buildpad/types';\nexport * from '@buildpad/services';\nexport * as ns from '@buildpad/hooks';\n"],
  ['bare dynamic imports, whitespace dropped', "const s = await import('@buildpad/services');\nconst h = await import ( \"@buildpad/hooks\" );\ntype T = import('@buildpad/types').Field;\nconst u = import('@buildpad/utils');\n"],
  ['JSDoc example lines are rewritten too', "/**\n * @example\n * import { VForm } from '@buildpad/ui-form';\n */\n// import { x } from '@buildpad/types';\n"],
  ['strings containing from', "const msg = \"import x from '@buildpad/types'\";\n"],
  ['relative PascalCase', "import { A } from './InputBlockEditor';\nimport { U } from '../Upload/Upload';\nimport { S } from '../select-icon/SelectIcon';\nconst L = import('./LazyThing');\nconst K = import('../select-icon/SelectIcon');\n"],
  ['relative PascalCase in a vform target', "import { F } from './FormFieldInterface';\nimport type { T } from '@buildpad/types';\n", 'components/ui/vform/components/FormField.tsx'],
  ['preserve-casing marker', "// @buildpad-preserve-casing\nimport { A } from './InputBlockEditor';\nimport { b } from '@buildpad/types';\n"],
  ['no imports', 'export const x = 1;\n'],
];

describe.each(Object.entries(ALIAS_CONFIGS))('synthetic inputs, %s', (_label, aliases) => {
  const config = makeConfig({ aliases });
  test.each(SYNTHETIC)('%s', (_name, input, targetPath) => {
    expect(current.transformImports(input, config, targetPath)).toBe(frozen.transformImports(input, config, targetPath));
  });
});
