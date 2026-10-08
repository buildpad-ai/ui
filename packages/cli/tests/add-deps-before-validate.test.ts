/**
 * `add` installs a component's missing npm dependencies BEFORE it validates.
 *
 * Validation typechecks the copied files and exits the process when it finds
 * errors. A component whose npm dependency the app does not have yet (the
 * first one outside the bootstrap set: workflow-management → @xyflow/react)
 * fails that check with TS2307, so with validation first the dependency step
 * was never reached: `add` exited 1 without installing the package or
 * printing the command that installs it.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

const MOCK_REGISTRY = {
  schemaVersion: 2,
  version: '2.7.0',
  name: 'buildpad',
  packages: {},
  components: [
    {
      name: 'diagram',
      title: 'Diagram',
      description: '',
      category: 'workflow',
      sourcePackage: '@buildpad/ui-workflows',
      files: [{ source: 'ui-workflows/src/Diagram.tsx', target: 'components/ui/diagram.tsx', sourceSha256: 'c'.repeat(64) }],
      dependencies: ['@mantine/core', '@xyflow/react'],
      internalDependencies: [],
    },
  ],
  lib: {},
  categories: [{ name: 'workflow', title: 'Workflow', description: '' }],
};

const calls: string[] = [];
let requestedDeps: string[] = [];

vi.mock('../src/resolver.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/resolver.js')>()),
  getRegistry: vi.fn(async () => MOCK_REGISTRY),
  resolveSourceFile: vi.fn(async () => "import { ReactFlow } from '@xyflow/react';\nexport const Diagram = ReactFlow;\n"),
  sourceFileExists: vi.fn(async () => true),
  getRecordedRef: () => 'v2.7.0',
}));

vi.mock('../src/utils/external-deps.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/utils/external-deps.js')>()),
  ensureExternalDeps: vi.fn(async (options: { deps: Iterable<string> }) => {
    calls.push('dependencies');
    requestedDeps = [...options.deps];
    return { missing: [], installed: false };
  }),
}));

vi.mock('../src/commands/validate.js', () => ({
  // What the real one does on a TS2307: it never returns.
  validate: vi.fn(async () => {
    calls.push('validate');
    throw new Error('process.exit(1)');
  }),
}));

const { add } = await import('../src/commands/add.js');

let tmpdir: string;

beforeEach(async () => {
  calls.length = 0;
  requestedDeps = [];
  tmpdir = await fs.mkdtemp(path.join(os.tmpdir(), 'buildpad-add-deps-'));
  await fs.ensureDir(path.join(tmpdir, 'components/ui'));
  await fs.writeJSON(path.join(tmpdir, 'buildpad.json'), {
    schemaVersion: 3,
    release: '2.7.0',
    model: 'copy-own',
    tsx: true,
    srcDir: false,
    aliases: { components: '@/components/ui', lib: '@/lib/buildpad' },
    installedLib: [],
    installedComponents: [],
    components: {},
    lib: {},
  });
});

afterEach(async () => {
  await fs.remove(tmpdir);
  vi.clearAllMocks();
});

describe('add — external dependencies and validation', () => {
  test('the dependency step runs first, with the component’s npm dependencies', async () => {
    await add(['diagram'], { cwd: tmpdir });

    expect(calls).toEqual(['dependencies', 'validate']);
    expect(requestedDeps).toEqual(['@mantine/core', '@xyflow/react']);
    expect(fs.existsSync(path.join(tmpdir, 'components/ui/diagram.tsx'))).toBe(true);
  });

  test('bootstrap’s non-interactive add still installs dependencies and leaves validation to bootstrap', async () => {
    await add(['diagram'], { cwd: tmpdir, nonInteractive: true });

    expect(calls).toEqual(['dependencies']);
  });
});
