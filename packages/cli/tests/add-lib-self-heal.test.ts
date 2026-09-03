/**
 * copyLibModule: when a lib module gains files (e.g. utils gaining i18n/*),
 * files that changed upstream AND are pristine on disk are refreshed in place
 * (the consumer barrel must export what the new files import); locally
 * modified files are kept with a merge hint.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import ora from 'ora';
import { hashTransformed, addOriginHeader, transformImports } from '../src/commands/transformer.js';
import type { Config } from '../src/commands/init.js';
import type { Registry } from '../src/resolver.js';

const BARREL_OLD = `export { a } from '../a';\n`;
const BARREL_NEW = `export { a } from '../a';\nexport { b } from '../b';\n`;
const B_SOURCE = `export const b = 1;\n`;

const SOURCES: Record<string, string> = {
  'cli/templates/lib/utils-index.ts': BARREL_NEW,
  'utils/src/b.ts': B_SOURCE,
};

vi.mock('../src/resolver.js', () => ({
  getRegistry: vi.fn(async () => { throw new Error('unused'); }),
  resolveSourceFile: vi.fn(async (source: string) => {
    if (SOURCES[source] !== undefined) return SOURCES[source];
    throw new Error(`unexpected source ${source}`);
  }),
  sourceFileExists: vi.fn(async (source: string) => SOURCES[source] !== undefined),
  getRecordedRef: () => 'v2.3.0',
  getSourceRef: () => 'v2.3.0',
  setSourceRef: vi.fn(),
  getCliVersion: () => '2.3.0',
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
  fetchSourceAtRef: vi.fn(async () => { throw new Error('unused'); }),
  fetchSourceAtVersion: vi.fn(async () => { throw new Error('unused'); }),
  fetchRegistryAtRef: vi.fn(async () => { throw new Error('unused'); }),
}));

const { copyLibModule } = await import('../src/commands/add.js');

const REGISTRY = {
  schemaVersion: 2,
  version: '2.3.0',
  name: 'buildpad',
  components: [],
  categories: [],
  lib: {
    utils: {
      name: 'utils',
      description: 'utils',
      sourcePackage: '@buildpad/cli',
      files: [
        { source: 'cli/templates/lib/utils-index.ts', target: 'lib/buildpad/utils/index.ts', sourceSha256: 'barrel-v2' },
        { source: 'utils/src/b.ts', target: 'lib/buildpad/b.ts', sourceSha256: 'b-v2' },
      ],
    },
  },
} as unknown as Registry;

let tmpdir: string;
let config: Config;

function writtenBarrel(): string {
  // what the CLI wrote at install time (transformed + header), as on the consumer's disk
  const content = addOriginHeader(transformImports(BARREL_OLD, config), 'utils/utils-index', '@buildpad/cli', '2.2.0');
  return content;
}

beforeEach(async () => {
  tmpdir = await fs.mkdtemp(path.join(os.tmpdir(), 'buildpad-selfheal-'));
  config = {
    schemaVersion: 3,
    release: '2.2.0',
    model: 'copy-own',
    tsx: true,
    srcDir: false,
    aliases: { components: '@/components/ui', lib: '@/lib/buildpad' },
    installedLib: ['utils'],
    installedComponents: [],
    components: {},
    lib: {},
  };
  const barrelPath = path.join(tmpdir, 'lib/buildpad/utils/index.ts');
  await fs.outputFile(barrelPath, writtenBarrel());
  config.lib!.utils = {
    release: '2.2.0',
    ref: 'v2.2.0',
    sourcePackage: '@buildpad/cli',
    installedAt: '2026-01-01T00:00:00Z',
    files: [
      { target: 'lib/buildpad/utils/index.ts', sourceSha256: 'barrel-v1', sha256: hashTransformed(writtenBarrel()), ref: 'v2.2.0', state: 'clean' },
    ],
  };
});

afterEach(async () => {
  await fs.remove(tmpdir);
});

describe('copyLibModule self-heal', () => {
  test('refreshes a pristine barrel that changed upstream when the module gains a file', async () => {
    const spinner = ora({ isSilent: true }).start();
    await copyLibModule('utils', REGISTRY, config, tmpdir, spinner);
    spinner.stop();

    const barrel = await fs.readFile(path.join(tmpdir, 'lib/buildpad/utils/index.ts'), 'utf-8');
    expect(barrel).toContain(`export { b } from '../b';`);
    expect(fs.existsSync(path.join(tmpdir, 'lib/buildpad/b.ts'))).toBe(true);
    const record = config.lib!.utils.files.find(f => f.target === 'lib/buildpad/utils/index.ts')!;
    expect(record.sourceSha256).toBe('barrel-v2');
    expect(record.state).toBe('clean');
  });

  test('keeps a locally modified barrel and records it for upgrade', async () => {
    const barrelPath = path.join(tmpdir, 'lib/buildpad/utils/index.ts');
    await fs.writeFile(barrelPath, writtenBarrel() + `export const mine = true;\n`);
    const spinner = ora({ isSilent: true }).start();
    await copyLibModule('utils', REGISTRY, config, tmpdir, spinner);
    spinner.stop();

    const barrel = await fs.readFile(barrelPath, 'utf-8');
    expect(barrel).toContain('export const mine = true;');
    expect(barrel).not.toContain(`export { b } from '../b';`);
    const record = config.lib!.utils.files.find(f => f.target === 'lib/buildpad/utils/index.ts')!;
    // old baseline kept, so `outdated` keeps reporting it
    expect(record.sourceSha256).toBe('barrel-v1');
    expect(fs.existsSync(path.join(tmpdir, 'lib/buildpad/b.ts'))).toBe(true);
  });

  test('leaves an up-to-date existing file alone', async () => {
    config.lib!.utils.files[0].sourceSha256 = 'barrel-v2';
    const spinner = ora({ isSilent: true }).start();
    await copyLibModule('utils', REGISTRY, config, tmpdir, spinner);
    spinner.stop();
    const barrel = await fs.readFile(path.join(tmpdir, 'lib/buildpad/utils/index.ts'), 'utf-8');
    expect(barrel).toBe(writtenBarrel());
  });
});
