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
import { scanSpecifiers } from '../src/utils/import-specifiers.js';
import {
  addPipeline,
  libFiles,
  loadRegistry,
  makeConfig,
  readSource,
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

/**
 * Files written after the refactor that use an import form only the current
 * transformer rewrites. The frozen transformer cannot produce them, and does
 * not need to: no project installed one with it, so no three-way-merge base
 * of theirs was ever built by it.
 *
 * - vform's interface-components.tsx (new in 3.0) loads the heavy interfaces
 *   with `import('@buildpad/ui-interfaces/<x>')`.
 */
const NEW_DYNAMIC_IMPORT_FILES = ['ui-form/src/components/interface-components.tsx'];

describe.each(Object.entries(ALIAS_CONFIGS))('registry corpus, %s', (_label, aliases) => {
  const config = makeConfig({ aliases });
  const expected = transformCorpus(registry, config, frozenPipeline);
  const actual = transformCorpus(registry, config, addPipeline);

  test('every file is byte-identical to the frozen transformer', () => {
    expect(actual.length).toBe(expected.length);
    const drift = actual
      .map((f, i) => ({ f, want: expected[i].content }))
      .filter(({ f, want }) => f.content !== want);
    expect(drift.map(({ f }) => f.source)).toEqual(NEW_DYNAMIC_IMPORT_FILES);
    // Even there, the two differ only where the frozen one left an import() unrewritten.
    for (const { f, want } of drift) {
      const got = f.content.split('\n');
      const frozenLines = want.split('\n');
      expect(got.length).toBe(frozenLines.length);
      const changed = got.flatMap((line, i) => (line === frozenLines[i] ? [] : [frozenLines[i]]));
      expect(changed.filter(line => !/import\('@buildpad\/ui-interfaces(\/[a-z0-9-]+)?'\)/.test(line))).toEqual([]);
    }
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

/**
 * The refactor changed the output for a few specifier shapes on purpose —
 * mappings that pointed at files the registry never installs, and import forms
 * the old regexes left unrewritten. That is byte-safe only while no shipped
 * file that the old transformer installed uses those shapes, so each count
 * here must stay 0. (If one is needed in such a file, its consumers'
 * three-way-merge bases change: ship it deliberately.) The exception is
 * NEW_DYNAMIC_IMPORT_FILES, above.
 */
describe('shapes whose output changed have no hits in the registry corpus', () => {
  const sources = new Set<string>();
  for (const mod of Object.values(registry.lib)) for (const f of libFiles(mod)) sources.add(f.source);
  for (const c of registry.components) for (const f of c.files) sources.add(f.source);
  const hits = [...sources].flatMap(source => {
    const content = readSource(source);
    return scanSpecifiers(content)
      .filter(m => m.specifier.startsWith('@buildpad/'))
      .map(m => ({ ...m, source, before: content.slice(Math.max(0, m.start - 400), m.start) }));
  });
  const LEGACY_DYNAMIC = /^@buildpad\/(services|hooks|types|utils)$/;
  const subOf = (spec: string, pkg: string) =>
    spec.startsWith(`@buildpad/${pkg}/`) ? spec.slice(`@buildpad/${pkg}/`.length) : undefined;

  const CHANGED: Record<string, (h: (typeof hits)[number]) => boolean> = {
    'utils/<x> outside i18n (was lib/buildpad/utils/<x>, now the flat lib/buildpad/<x>)': h => {
      const sub = subOf(h.specifier, 'utils');
      return sub !== undefined && sub !== 'i18n' && !sub.startsWith('i18n/');
    },
    'ui-table/<x> (was components/ui/<x>, now the registry target or an error)': h => subOf(h.specifier, 'ui-table') !== undefined,
    'export type { … } from ui-table (was vtable, now vtable-types)': h =>
      h.specifier === '@buildpad/ui-table' && /export\s+type\s*\{[^{}]*\}\s*$/.test(h.before),
    'import type { VTableProps | TableHeaderProps | TableRowProps } from ui-table (was vtable-types)': h =>
      h.specifier === '@buildpad/ui-table' && /import\s+type\s*\{[^{}]*\b(VTableProps|TableHeaderProps|TableRowProps)\b[^{}]*\}\s*$/.test(h.before),
    'ui-collections/<x> (now kebab-cased)': h => subOf(h.specifier, 'ui-collections') !== undefined,
    'ui-files|ui-users/<x> that kebab-casing changes': h => {
      const sub = subOf(h.specifier, 'ui-files') ?? subOf(h.specifier, 'ui-users');
      return sub !== undefined && sub.split('/').some(seg => current.toKebabCase(seg) !== seg);
    },
    'ui-interfaces/<x>/<EntryFile> (was components/ui/<x>/<EntryFile>, now components/ui/<x>)': h => {
      const [folder, file, ...rest] = (subOf(h.specifier, 'ui-interfaces') ?? '').split('/');
      return file !== undefined && rest.length === 0 && file.toLowerCase() === folder.replace(/-/g, '');
    },
    '@buildpad/ui-forms (newly mapped)': h => h.specifier.startsWith('@buildpad/ui-forms'),
    'side-effect / require / declare module forms (newly rewritten)': h =>
      h.kind === 'side-effect' || h.kind === 'require' || h.kind === 'ambient',
    'import() of anything but bare services|hooks|types|utils (newly rewritten)': h =>
      h.kind === 'dynamic' && !LEGACY_DYNAMIC.test(h.specifier),
    "`from` not followed by exactly one space (newly rewritten)": h =>
      h.kind === 'from' && !/^from ['"]$/.test(readSource(h.source).slice(h.start, h.literalStart + 1)),
    'packages with no install mapping (now an error)': h =>
      !Object.keys(current.BUILDPAD_PACKAGES).some(p => h.specifier === p || h.specifier.startsWith(`${p}/`)),
  };

  test('the scan sees the corpus', () => {
    expect(hits.length).toBeGreaterThan(400);
  });

  const DYNAMIC = 'import() of anything but bare services|hooks|types|utils (newly rewritten)';

  test.each(Object.keys(CHANGED).filter(label => label !== DYNAMIC))('%s', label => {
    expect(hits.filter(CHANGED[label]).map(h => `${h.source}:${h.line} ${h.specifier}`)).toEqual([]);
  });

  test(`${DYNAMIC}: only in files written after the refactor`, () => {
    const sources = new Set(hits.filter(CHANGED[DYNAMIC]).map(h => h.source));
    expect([...sources]).toEqual(NEW_DYNAMIC_IMPORT_FILES);
  });
});
