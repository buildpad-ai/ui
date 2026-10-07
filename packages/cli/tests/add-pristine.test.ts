/**
 * `add` must never overwrite a locally edited copy of an installed component.
 *
 * An installed component whose upstream content changed is refreshed in place
 * only when every file on disk still matches its recorded hash
 * (isInstallPristine). That check must look where the CLI actually wrote the
 * file: under src/ when `srcDir` is set, and with the project's extension
 * (component `.ts` targets are written as `.tsx`). Looking anywhere else
 * finds nothing, treats the edited file as "missing", and the self-heal
 * overwrites it.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

const OLD_SHA = 'a'.repeat(64);
const NEW_SHA = 'b'.repeat(64);

const MOCK_REGISTRY = {
  schemaVersion: 2,
  version: '2.1.0',
  name: 'buildpad',
  packages: {},
  components: [
    {
      name: 'demo',
      title: 'Demo',
      description: '',
      category: 'input',
      sourcePackage: '@buildpad/ui-interfaces',
      files: [
        { source: 'ui-interfaces/src/demo/Demo.tsx', target: 'components/ui/demo.tsx', sourceSha256: NEW_SHA },
        { source: 'ui-interfaces/src/demo/types.ts', target: 'components/ui/demo/types.ts', sourceSha256: NEW_SHA },
      ],
      dependencies: [],
      internalDependencies: [],
    },
  ],
  lib: {},
  categories: [{ name: 'input', title: 'Input', description: '' }],
};

const UPSTREAM = {
  'ui-interfaces/src/demo/Demo.tsx': 'export function Demo() {\n  return null; // v2.1.0\n}\n',
  'ui-interfaces/src/demo/types.ts': 'export type DemoProps = { v: 2 };\n',
} as Record<string, string>;

vi.mock('../src/resolver.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/resolver.js')>()),
  getRegistry: vi.fn(async () => MOCK_REGISTRY),
  resolveSourceFile: vi.fn(async (source: string) => {
    if (source in UPSTREAM) return UPSTREAM[source];
    throw new Error(`unexpected source: ${source}`);
  }),
  sourceFileExists: vi.fn(async () => true),
  getRecordedRef: () => 'v2.1.0',
}));

const { add, isInstallPristine } = await import('../src/commands/add.js');
const { hashTransformed } = await import('../src/commands/transformer.js');

const ORIGINAL = {
  'components/ui/demo.tsx': 'export function Demo() {\n  return null; // v2.0.0\n}\n',
  'components/ui/demo/types.ts': 'export type DemoProps = { v: 1 };\n',
} as Record<string, string>;
const EDIT = '// my local change — must survive `add`\n';

let tmpdir: string;

beforeEach(async () => {
  tmpdir = await fs.mkdtemp(path.join(os.tmpdir(), 'buildpad-add-pristine-'));
});

afterEach(async () => {
  await fs.remove(tmpdir);
  vi.clearAllMocks();
});

/**
 * A project with `demo` installed at 2.0.0 (upstream has since changed), the
 * manifest recording what was written, and `edited` changed on disk.
 */
async function project(opts: { srcDir: boolean; edited?: string }) {
  const root = opts.srcDir ? path.join(tmpdir, 'src') : tmpdir;
  const files = Object.entries(ORIGINAL).map(([target, content]) => {
    // Where the CLI writes it: component .ts targets become .tsx.
    const onDisk = path.join(root, target.replace(/\.tsx?$/, '.tsx'));
    fs.outputFileSync(onDisk, target === opts.edited ? content + EDIT : content);
    return { target, sourceSha256: OLD_SHA, sha256: hashTransformed(content), ref: 'v2.0.0', state: 'clean' };
  });
  await fs.ensureDir(path.join(root, 'components/ui'));
  const config = {
    schemaVersion: 3,
    release: '2.0.0',
    model: 'copy-own',
    tsx: true,
    srcDir: opts.srcDir,
    aliases: { components: '@/components/ui', lib: '@/lib/buildpad' },
    installedLib: [],
    installedComponents: ['demo'],
    components: { demo: { release: '2.0.0', ref: 'v2.0.0', sourcePackage: '@buildpad/ui-interfaces', installedAt: 'x', files } },
    lib: {},
  };
  await fs.writeJSON(path.join(tmpdir, 'buildpad.json'), config);
  return { root, config };
}

const read = (root: string, target: string) =>
  fs.readFileSync(path.join(root, target.replace(/\.tsx?$/, '.tsx')), 'utf8');

describe('isInstallPristine', () => {
  test.each([
    ['srcDir project, .tsx target', true, 'components/ui/demo.tsx'],
    ['srcDir project, .ts target', true, 'components/ui/demo/types.ts'],
    ['root project, .ts target (written as .tsx)', false, 'components/ui/demo/types.ts'],
  ])('an edited file is not pristine — %s', async (_label, srcDir, edited) => {
    const { config } = await project({ srcDir, edited });
    expect(isInstallPristine('demo', config as never, tmpdir)).toBe(false);
  });

  test.each([true, false])('unedited files are pristine (srcDir=%s)', async srcDir => {
    const { config } = await project({ srcDir });
    expect(isInstallPristine('demo', config as never, tmpdir)).toBe(true);
  });
});

describe('add — stale installed component', () => {
  test.each([
    ['srcDir project, .tsx target', true, 'components/ui/demo.tsx'],
    ['srcDir project, .ts target', true, 'components/ui/demo/types.ts'],
    ['root project, .ts target', false, 'components/ui/demo/types.ts'],
  ])('keeps a locally edited file — %s', async (_label, srcDir, edited) => {
    const { root } = await project({ srcDir, edited });

    await add(['demo'], { cwd: tmpdir, nonInteractive: true });

    expect(read(root, edited)).toBe(ORIGINAL[edited] + EDIT);
  });

  test('refreshes an unedited copy in place (srcDir project)', async () => {
    const { root } = await project({ srcDir: true });

    await add(['demo'], { cwd: tmpdir, nonInteractive: true });

    expect(read(root, 'components/ui/demo.tsx')).toContain('// v2.1.0');
    expect(read(root, 'components/ui/demo/types.ts')).toContain('{ v: 2 }');
  });
});
