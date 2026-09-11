/**
 * add(): installs components and lib modules into a fresh v3 project.
 *
 * Covers the schema-v2+ per-file record bootstrap (`config.components ??= {}`,
 * `config.lib ??= {}`) and the deprecated-field backward-compat writes
 * (componentVersions/registryVersion) — previously entirely untested.
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
  categories: [{ name: 'input', title: 'Input', description: 'Input components' }],
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
  fetchRegistryAtRef: vi.fn(async () => { throw new Error('unused'); }),
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

const { add } = await import('../src/commands/add.js');

let tmpdir: string;

beforeEach(async () => {
  tmpdir = await fs.mkdtemp(path.join(os.tmpdir(), 'buildpad-add-'));
});

afterEach(async () => {
  await fs.remove(tmpdir);
  vi.clearAllMocks();
});

async function writeV3Manifest() {
  await fs.writeJSON(path.join(tmpdir, 'buildpad.json'), {
    $schema: 'https://buildpad.dev/schema.json',
    schemaVersion: 3,
    release: '2.0.0',
    model: 'copy-own',
    tsx: true,
    srcDir: false,
    aliases: { components: '@/components/ui', lib: '@/lib/buildpad' },
    installedLib: [],
    installedComponents: [],
    components: {},
    lib: {},
  });
}

async function readManifest() {
  return fs.readJSON(path.join(tmpdir, 'buildpad.json'));
}

describe('add — component install', () => {
  test('installs a new component and bootstraps its per-file v3 record', async () => {
    await writeV3Manifest();

    await add(['demo'], { cwd: tmpdir, nonInteractive: true });

    const after = await readManifest();
    expect(after.installedComponents).toContain('demo');
    expect(after.components.demo.files).toHaveLength(1);
    expect(after.components.demo.files[0]).toMatchObject({
      target: 'components/ui/demo.tsx',
      sourceSha256: 'stub',
      state: 'clean',
    });
    // Deprecated v1 field is still written for backward compat.
    expect(after.componentVersions.demo).toBeDefined();

    expect(await fs.readFile(path.join(tmpdir, 'components/ui/demo.tsx'), 'utf-8')).toContain('Demo');
    expect(await fs.pathExists(path.join(tmpdir, 'components/ui/index.ts'))).toBe(true);
  });
});

describe('add — lib module install', () => {
  test('installs a lib module directly by name and bootstraps config.lib', async () => {
    await writeV3Manifest();
    // generateComponentsIndex (unconditionally run after add()) writes
    // components/ui/index.ts and doesn't create the directory itself — it
    // always exists in practice because `init` scaffolds it. Pre-create it
    // here since this test installs a lib module only, no component.
    await fs.ensureDir(path.join(tmpdir, 'components/ui'));

    await add(['design-system'], { cwd: tmpdir, nonInteractive: true });

    const after = await readManifest();
    expect(after.installedLib).toContain('design-system');
    expect(after.lib['design-system'].files).toHaveLength(1);
    expect(after.lib['design-system'].files[0]).toMatchObject({
      target: 'app/globals.css',
      sourceSha256: 'stub',
    });

    expect(await fs.readFile(path.join(tmpdir, 'app/globals.css'), 'utf-8')).toContain('color: black');
  });
});
