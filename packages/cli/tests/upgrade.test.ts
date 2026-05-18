/**
 * upgrade.ts integration tests
 *
 * Drives the full per-file branching of `upgrade()` against a real tmpdir.
 * resolver/registry are mocked at the module boundary so no network or
 * monorepo-relative paths are required.
 *
 * Coverage for the four non-interactive strategies:
 *   - "overwrite":  modified files are replaced
 *   - "new-file":   modified files get a sibling .new
 *   - "three-way":  base fetch failure → falls back to .new
 *   - default behaviour for pristine files: silent overwrite
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { hashTransformed } from '../src/commands/transformer.js';

// ── Mock the resolver module at the boundary ───────────────────────────────

const MOCK_REGISTRY = {
  schemaVersion: 2,
  generatedAt: '2026-05-13T00:00:00Z',
  version: '2.0.0',
  name: 'buildpad',
  packages: {
    '@buildpad/ui-interfaces': { version: '2.0.0', changelogUrl: 'ui-interfaces/CHANGELOG.md' },
  },
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
  lib: {},
  categories: [],
};

const NEW_SOURCE = `import { useState } from 'react';

export function Demo() {
  return <div>Demo v2</div>;
}
`;

vi.mock('../src/resolver.js', () => ({
  getRegistry: vi.fn(async () => MOCK_REGISTRY),
  resolveSourceFile: vi.fn(async (source: string) => {
    if (source === 'ui-interfaces/src/demo/Demo.tsx') return NEW_SOURCE;
    throw new Error(`unexpected source: ${source}`);
  }),
  sourceFileExists: vi.fn(async () => true),
  fetchSourceAtVersion: vi.fn(async () => {
    // Simulate "no network" — upgrade should degrade to .new
    throw new Error('network unavailable');
  }),
  buildPackageTag: (p: string, v: string) => `${p}@${v}`,
  buildVersionedSourceUrl: (r: string, s: string) =>
    `https://x.test/${r}/packages/${s}`,
  CHANGELOG_BASE_URL: 'https://x.test/packages',
  REGISTRY_BASE_URL: 'https://x.test/packages',
  // init.ts calls this at module load time — must be present in the mock
  getTemplatesRoot: () => '/tmp/mock-templates',
  getLocalPackagesRoot: () => '/tmp/mock-packages',
}));

// Now import the SUT — must come after vi.mock
const { upgrade } = await import('../src/commands/upgrade.js');

// ── Tmpdir fixture helpers ──────────────────────────────────────────────────

let tmpdir: string;

beforeEach(async () => {
  tmpdir = await fs.mkdtemp(path.join(os.tmpdir(), 'buildpad-upgrade-'));
});

afterEach(async () => {
  await fs.remove(tmpdir);
  vi.clearAllMocks();
});

interface SetupOpts {
  installedVersion: string;
  fileBody: string;
  /** When provided, this is the sha recorded in the manifest. Otherwise
   *  it's derived from `fileBody` (i.e. file is "pristine"). */
  recordedSha?: string;
}

async function setupConsumer(opts: SetupOpts) {
  // Project layout WITHOUT srcDir for simpler paths in the test
  const targetRel = 'components/ui/demo.tsx';
  const targetAbs = path.join(tmpdir, targetRel);
  await fs.ensureDir(path.dirname(targetAbs));
  await fs.writeFile(targetAbs, opts.fileBody);

  const recordedSha = opts.recordedSha ?? hashTransformed(opts.fileBody);

  await fs.writeJSON(path.join(tmpdir, 'buildpad.json'), {
    $schema: 'https://buildpad.dev/schema.json',
    schemaVersion: 2,
    model: 'copy-own',
    tsx: true,
    srcDir: false,
    aliases: {
      components: '@/components/ui',
      lib: '@/lib/buildpad',
    },
    installedLib: [],
    installedComponents: ['demo'],
    components: {
      demo: {
        version: opts.installedVersion,
        sourcePackage: '@buildpad/ui-interfaces',
        installedAt: '2026-01-01T00:00:00Z',
        files: [{ target: targetRel, sha256: recordedSha }],
      },
    },
    lib: {},
    packageVersions: {
      '@buildpad/ui-interfaces': opts.installedVersion,
    },
  });

  return { targetAbs, targetRel };
}

async function readManifest() {
  return fs.readJSON(path.join(tmpdir, 'buildpad.json'));
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('upgrade — pristine file', () => {
  test('silently overwrites a pristine file (no .new)', async () => {
    const PRISTINE = 'export const old = 1;\n';
    const { targetAbs } = await setupConsumer({
      installedVersion: '1.0.0',
      fileBody: PRISTINE,
    });

    await upgrade({ components: ['demo'], cwd: tmpdir, strategy: 'overwrite' });

    const onDisk = await fs.readFile(targetAbs, 'utf8');
    expect(onDisk).toContain('Demo v2');
    expect(await fs.pathExists(targetAbs + '.new')).toBe(false);

    const manifest = await readManifest();
    expect(manifest.components.demo.version).toBe('2.0.0');
    expect(manifest.packageVersions['@buildpad/ui-interfaces']).toBe('2.0.0');
  });
});

describe('upgrade --strategy=overwrite', () => {
  test('replaces a locally-modified file in-place', async () => {
    const MODIFIED = 'export const my = "customisation";\n';
    const { targetAbs } = await setupConsumer({
      installedVersion: '1.0.0',
      fileBody: MODIFIED,
      recordedSha: 'different-hash-than-modified', // mark as modified
    });

    await upgrade({ components: ['demo'], cwd: tmpdir, strategy: 'overwrite' });

    const onDisk = await fs.readFile(targetAbs, 'utf8');
    expect(onDisk).toContain('Demo v2');
    expect(onDisk).not.toContain('customisation');
    expect(await fs.pathExists(targetAbs + '.new')).toBe(false);
  });
});

describe('upgrade --strategy=new-file', () => {
  test('writes a .new file and leaves the modified original untouched', async () => {
    const MODIFIED = 'export const my = "customisation";\n';
    const { targetAbs } = await setupConsumer({
      installedVersion: '1.0.0',
      fileBody: MODIFIED,
      recordedSha: 'different-hash-than-modified',
    });

    await upgrade({ components: ['demo'], cwd: tmpdir, strategy: 'new-file' });

    // Original untouched
    expect(await fs.readFile(targetAbs, 'utf8')).toContain('customisation');
    // .new sibling exists with new content
    const newPath = targetAbs + '.new';
    expect(await fs.pathExists(newPath)).toBe(true);
    expect(await fs.readFile(newPath, 'utf8')).toContain('Demo v2');
  });
});

describe('upgrade --strategy=three-way', () => {
  test('falls back to .new when the base cannot be fetched', async () => {
    const MODIFIED = 'export const my = "customisation";\n';
    const { targetAbs } = await setupConsumer({
      installedVersion: '1.0.0',
      fileBody: MODIFIED,
      recordedSha: 'different-hash-than-modified',
    });

    await upgrade({ components: ['demo'], cwd: tmpdir, strategy: 'three-way' });

    // Original kept, .new created (because mock fetchSourceAtVersion throws)
    expect(await fs.readFile(targetAbs, 'utf8')).toContain('customisation');
    expect(await fs.pathExists(targetAbs + '.new')).toBe(true);
  });
});

describe('upgrade — strategy resolution', () => {
  test('--yes is shorthand for --strategy=overwrite', async () => {
    const MODIFIED = 'export const my = "customisation";\n';
    const { targetAbs } = await setupConsumer({
      installedVersion: '1.0.0',
      fileBody: MODIFIED,
      recordedSha: 'different-hash-than-modified',
    });

    await upgrade({ components: ['demo'], cwd: tmpdir, yes: true });

    expect(await fs.readFile(targetAbs, 'utf8')).toContain('Demo v2');
    expect(await fs.pathExists(targetAbs + '.new')).toBe(false);
  });
});

describe('upgrade — manifest gating', () => {
  test('refuses to run on a v1 manifest', async () => {
    await fs.writeJSON(path.join(tmpdir, 'buildpad.json'), {
      model: 'copy-own',
      tsx: true,
      srcDir: false,
      aliases: { components: '@/components/ui', lib: '@/lib/buildpad' },
      installedLib: [],
      installedComponents: ['demo'],
      // no schemaVersion → v1
    });

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`exit:${code}`);
    }) as never);

    await expect(
      upgrade({ components: ['demo'], cwd: tmpdir, strategy: 'overwrite' })
    ).rejects.toThrow(/exit:1/);

    exitSpy.mockRestore();
  });
});
