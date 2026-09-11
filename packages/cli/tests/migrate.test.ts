/**
 * migrate(): brings buildpad.json up to schema v3.
 *
 * Covers the v1 -> v3 path (no per-file record at all — sources are
 * re-fetched, transformed, and hashed) for both components and lib modules,
 * which was entirely untested.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

const MOCK_REGISTRY = {
  schemaVersion: 2,
  generatedAt: '2026-05-13T00:00:00Z',
  version: '2.0.0',
  name: 'buildpad',
  packages: {},
  components: [
    {
      name: 'demo',
      title: 'Demo',
      description: 'Test fixture',
      category: 'input',
      sourcePackage: '@buildpad/ui-interfaces',
      version: '2.0.0',
      lastChangedIn: '2.0.0',
      files: [
        {
          source: 'ui-interfaces/src/demo/Demo.tsx',
          target: 'components/ui/demo.tsx',
          sourceSha256: 'stub',
        },
      ],
      dependencies: [],
      internalDependencies: [],
    },
  ],
  lib: {
    'design-system': {
      name: 'design-system',
      description: 'Design tokens, globals, theme, app shell',
      sourcePackage: '@buildpad/cli',
      version: '2.0.0',
      lastChangedIn: '2.0.0',
      files: [
        {
          source: 'cli/templates/app/globals.css',
          target: 'app/globals.css',
          sourceSha256: 'stub',
        },
      ],
    },
  },
  categories: [],
};

const DEMO_SOURCE = `export function Demo() {\n  return <div>Demo</div>;\n}\n`;
const GLOBALS_SOURCE = `body { color: black; }\n`;

vi.mock('../src/resolver.js', () => ({
  getRegistry: vi.fn(async () => MOCK_REGISTRY),
  resolveSourceFile: vi.fn(async (source: string) => {
    if (source === 'ui-interfaces/src/demo/Demo.tsx') return DEMO_SOURCE;
    if (source === 'cli/templates/app/globals.css') return GLOBALS_SOURCE;
    throw new Error(`unexpected source: ${source}`);
  }),
  sourceFileExists: vi.fn(async () => true),
  fetchSourceAtRef: vi.fn(async () => { throw new Error('unused'); }),
  fetchSourceAtVersion: vi.fn(async () => { throw new Error('unused'); }),
  fetchRegistryAtRef: vi.fn(async () => { throw new Error('unreachable ref'); }),
  getRecordedRef: () => 'v2.0.0',
  getSourceRef: () => 'v2.0.0',
  setSourceRef: vi.fn(),
  getCliVersion: () => '2.0.0',
  encodeRef: (r: string) => r,
  registryBaseUrl: () => 'https://x.test/packages',
  buildPackageTag: (p: string, v: string) => `${p}@${v}`,
  buildVersionedSourceUrl: (r: string, s: string) => `https://x.test/${r}/packages/${s}`,
  CHANGELOG_BASE_URL: 'https://x.test/packages',
  getTemplatesRoot: () => '/tmp/mock-templates',
  getLocalPackagesRoot: () => '/tmp/mock-packages',
  getBundledRegistry: vi.fn(async () => { throw new Error('unused'); }),
  resolveBundledTemplate: vi.fn(async () => { throw new Error('unused'); }),
  bundledTemplateExists: vi.fn(async () => false),
}));

const { migrate } = await import('../src/commands/migrate.js');

let tmpdir: string;

beforeEach(async () => {
  tmpdir = await fs.mkdtemp(path.join(os.tmpdir(), 'buildpad-migrate-'));
});

afterEach(async () => {
  await fs.remove(tmpdir);
  vi.clearAllMocks();
});

async function writeV1Manifest() {
  const targetAbs = path.join(tmpdir, 'components/ui/demo.tsx');
  await fs.ensureDir(path.dirname(targetAbs));
  await fs.writeFile(targetAbs, DEMO_SOURCE);

  const globalsAbs = path.join(tmpdir, 'app/globals.css');
  await fs.ensureDir(path.dirname(globalsAbs));
  await fs.writeFile(globalsAbs, GLOBALS_SOURCE);

  await fs.writeJSON(path.join(tmpdir, 'buildpad.json'), {
    $schema: 'https://buildpad.dev/schema.json',
    schemaVersion: 1,
    packageVersions: { demo: '1.0.0' },
    model: 'copy-own',
    tsx: true,
    srcDir: false,
    aliases: { components: '@/components/ui', lib: '@/lib/buildpad' },
    installedLib: ['design-system'],
    installedComponents: ['demo'],
    components: {},
    lib: {},
  });
}

async function readManifest() {
  return fs.readJSON(path.join(tmpdir, 'buildpad.json'));
}

describe('migrate — v1 to v3', () => {
  test('backfills per-file records for both components and lib modules', async () => {
    await writeV1Manifest();

    await migrate({ cwd: tmpdir });

    const after = await readManifest();
    expect(after.schemaVersion).toBe(3);

    expect(after.components.demo.files).toHaveLength(1);
    expect(after.components.demo.files[0]).toMatchObject({
      target: 'components/ui/demo.tsx',
      sourceSha256: 'stub',
      state: 'clean',
    });

    expect(after.lib['design-system'].files).toHaveLength(1);
    expect(after.lib['design-system'].files[0]).toMatchObject({
      target: 'app/globals.css',
      sourceSha256: 'stub',
      state: 'clean',
    });
  });

  test('drops the deprecated packageVersions field', async () => {
    await writeV1Manifest();

    await migrate({ cwd: tmpdir });

    const after = await readManifest();
    expect(after.packageVersions).toBeUndefined();
  });

  test('dry run leaves buildpad.json untouched', async () => {
    await writeV1Manifest();
    const before = await readManifest();

    await migrate({ cwd: tmpdir, dryRun: true });

    const after = await readManifest();
    expect(after).toEqual(before);
  });
});

describe('migrate — v2 to v3', () => {
  test('backfills the upstream baseline for an existing per-file record, keeping local hashes', async () => {
    const targetAbs = path.join(tmpdir, 'components/ui/demo.tsx');
    await fs.ensureDir(path.dirname(targetAbs));
    await fs.writeFile(targetAbs, DEMO_SOURCE);
    const globalsAbs = path.join(tmpdir, 'app/globals.css');
    await fs.ensureDir(path.dirname(globalsAbs));
    await fs.writeFile(globalsAbs, GLOBALS_SOURCE);

    await fs.writeJSON(path.join(tmpdir, 'buildpad.json'), {
      $schema: 'https://buildpad.dev/schema.json',
      schemaVersion: 2,
      model: 'copy-own',
      tsx: true,
      srcDir: false,
      aliases: { components: '@/components/ui', lib: '@/lib/buildpad' },
      installedLib: ['design-system'],
      installedComponents: ['demo'],
      components: {
        demo: {
          release: '1.0.0',
          sourcePackage: '@buildpad/ui-interfaces',
          installedAt: '2026-01-01T00:00:00Z',
          // Already has a local hash + state — backfillRecord's fast path
          // (no historic-registry fetch needed) keeps it as-is.
          files: [{ target: 'components/ui/demo.tsx', sourceSha256: 'local-hash', state: 'clean' }],
        },
      },
      lib: {
        'design-system': {
          release: '1.0.0',
          sourcePackage: '@buildpad/cli',
          installedAt: '2026-01-01T00:00:00Z',
          files: [{ target: 'app/globals.css', sourceSha256: 'local-hash-2', state: 'clean' }],
        },
      },
    });

    await migrate({ cwd: tmpdir });

    const after = await readManifest();
    expect(after.schemaVersion).toBe(3);
    expect(after.components.demo.files[0]).toMatchObject({
      target: 'components/ui/demo.tsx',
      sourceSha256: 'local-hash',
      state: 'clean',
    });
    expect(after.components.demo.sourcePackage).toBe('@buildpad/ui-interfaces');
    expect(after.lib['design-system'].files[0]).toMatchObject({
      target: 'app/globals.css',
      sourceSha256: 'local-hash-2',
      state: 'clean',
    });
  });
});
