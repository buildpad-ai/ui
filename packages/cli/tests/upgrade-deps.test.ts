/**
 * upgrade.ts ↔ external-deps wiring tests
 *
 * Regression coverage for the 1.8.0 rich-text-markdown incident: `upgrade`
 * copied new source that imported @tiptap/extension-table / tiptap-markdown /
 * marked but never installed them, leaving consumers with unresolvable
 * imports. These tests assert `upgrade` forwards each upgraded entry's
 * registry-declared deps to ensureExternalDeps (mocked — no real installs).
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { hashTransformed } from '../src/commands/transformer.js';

const MOCK_REGISTRY = {
  schemaVersion: 2,
  generatedAt: '2026-07-15T00:00:00Z',
  version: '1.8.0',
  name: 'buildpad',
  packages: {
    '@buildpad/ui-interfaces': { version: '1.8.0', changelogUrl: 'ui-interfaces/CHANGELOG.md' },
    '@buildpad/cli': { version: '1.8.0', changelogUrl: 'cli/CHANGELOG.md' },
  },
  components: [
    {
      name: 'rich-text-markdown',
      title: 'RichTextMarkdown',
      description: 'Test fixture',
      category: 'input',
      sourcePackage: '@buildpad/ui-interfaces',
      version: '1.8.0',
      lastChangedIn: '1.8.0',
      files: [
        {
          source: 'ui-interfaces/src/rich-text-markdown/RichTextMarkdown.tsx',
          target: 'components/ui/rich-text-markdown.tsx',
          sourceSha256: 'stub',
        },
      ],
      dependencies: ['@tiptap/extension-table', 'tiptap-markdown', 'marked'],
      internalDependencies: [],
    },
  ],
  lib: {
    'supabase-auth': {
      name: 'supabase-auth',
      description: 'Test lib fixture',
      sourcePackage: '@buildpad/cli',
      version: '1.8.0',
      lastChangedIn: '1.8.0',
      files: [
        {
          source: 'cli/templates/lib/supabase.ts',
          target: 'lib/supabase.ts',
          sourceSha256: 'stub',
        },
      ],
      // Lib deps may carry version specifiers — upgrade must strip them.
      dependencies: ['@supabase/ssr@^0.5'],
    },
  },
  categories: [],
};

const NEW_COMPONENT_SOURCE = `export function RichTextMarkdown() { return null; }\n`;
const NEW_LIB_SOURCE = `export const supabase = null;\n`;

vi.mock('../src/resolver.js', () => ({
  getRegistry: vi.fn(async () => MOCK_REGISTRY),
  resolveSourceFile: vi.fn(async (source: string) => {
    if (source.endsWith('RichTextMarkdown.tsx')) return NEW_COMPONENT_SOURCE;
    if (source.endsWith('supabase.ts')) return NEW_LIB_SOURCE;
    throw new Error(`unexpected source: ${source}`);
  }),
  sourceFileExists: vi.fn(async () => true),
  fetchSourceAtVersion: vi.fn(async () => {
    throw new Error('network unavailable');
  }),
  buildPackageTag: (p: string, v: string) => `${p}@${v}`,
  buildVersionedSourceUrl: (r: string, s: string) =>
    `https://x.test/${r}/packages/${s}`,
  CHANGELOG_BASE_URL: 'https://x.test/packages',
  REGISTRY_BASE_URL: 'https://x.test/packages',
  getTemplatesRoot: () => '/tmp/mock-templates',
  getLocalPackagesRoot: () => '/tmp/mock-packages',
  getBundledRegistry: vi.fn(async () => MOCK_REGISTRY),
  resolveBundledTemplate: vi.fn(async () => NEW_LIB_SOURCE),
  bundledTemplateExists: vi.fn(async () => true),
}));

vi.mock('../src/utils/external-deps.js', () => ({
  ensureExternalDeps: vi.fn(async () => ({ missing: [], installed: false })),
}));

// Import the SUT (and the mocked collaborator) after vi.mock
const { upgrade } = await import('../src/commands/upgrade.js');
const { ensureExternalDeps } = await import('../src/utils/external-deps.js');

let tmpdir: string;

beforeEach(async () => {
  tmpdir = await fs.mkdtemp(path.join(os.tmpdir(), 'buildpad-upgrade-deps-'));
});

afterEach(async () => {
  await fs.remove(tmpdir);
  vi.clearAllMocks();
});

async function setupConsumer(opts: { installedVersion: string; withLib?: boolean }) {
  const targetRel = 'components/ui/rich-text-markdown.tsx';
  const targetAbs = path.join(tmpdir, targetRel);
  const body = `export function RichTextMarkdown() { return 'v1'; }\n`;
  await fs.ensureDir(path.dirname(targetAbs));
  await fs.writeFile(targetAbs, body);

  const libRel = 'lib/supabase.ts';
  if (opts.withLib) {
    const libAbs = path.join(tmpdir, libRel);
    await fs.ensureDir(path.dirname(libAbs));
    await fs.writeFile(libAbs, `export const supabase = 'v1';\n`);
  }

  await fs.writeJSON(path.join(tmpdir, 'buildpad.json'), {
    $schema: 'https://buildpad.dev/schema.json',
    schemaVersion: 2,
    model: 'copy-own',
    tsx: true,
    srcDir: false,
    aliases: { components: '@/components/ui', lib: '@/lib/buildpad' },
    installedLib: opts.withLib ? ['supabase-auth'] : [],
    installedComponents: ['rich-text-markdown'],
    components: {
      'rich-text-markdown': {
        version: opts.installedVersion,
        sourcePackage: '@buildpad/ui-interfaces',
        installedAt: '2026-01-01T00:00:00Z',
        files: [{ target: targetRel, sha256: hashTransformed(body) }],
      },
    },
    lib: opts.withLib
      ? {
          'supabase-auth': {
            version: opts.installedVersion,
            sourcePackage: '@buildpad/cli',
            installedAt: '2026-01-01T00:00:00Z',
            files: [{ target: libRel, sha256: hashTransformed(`export const supabase = 'v1';\n`) }],
          },
        }
      : {},
    packageVersions: { '@buildpad/ui-interfaces': opts.installedVersion },
  });
}

function ensureCallDeps(): string[] {
  const calls = vi.mocked(ensureExternalDeps).mock.calls;
  expect(calls).toHaveLength(1);
  return Array.from(calls[0][0].deps);
}

describe('upgrade installs newly-introduced deps', () => {
  test('component upgrade forwards registry-declared deps', async () => {
    await setupConsumer({ installedVersion: '1.7.0' });

    await upgrade({
      components: ['rich-text-markdown'],
      strategy: 'overwrite',
      cwd: tmpdir,
    });

    expect(ensureCallDeps().sort()).toEqual(
      ['@tiptap/extension-table', 'marked', 'tiptap-markdown'].sort()
    );
  });

  test('lib module deps are stripped of version specifiers', async () => {
    await setupConsumer({ installedVersion: '1.7.0', withLib: true });

    await upgrade({
      components: [],
      all: false,
      strategy: 'overwrite',
      cwd: tmpdir,
    });

    // Default targeting: both the outdated component and lib module upgrade.
    const deps = ensureCallDeps();
    expect(deps).toContain('@supabase/ssr'); // "@supabase/ssr@^0.5" stripped
    expect(deps).toContain('marked');
  });

  test('everything up to date → no dependency check', async () => {
    await setupConsumer({ installedVersion: '1.8.0' });

    await upgrade({
      components: [],
      strategy: 'overwrite',
      cwd: tmpdir,
    });

    expect(ensureExternalDeps).not.toHaveBeenCalled();
  });

  test('dry-run forwards dryRun to the installer', async () => {
    await setupConsumer({ installedVersion: '1.7.0' });

    await upgrade({
      components: ['rich-text-markdown'],
      strategy: 'overwrite',
      dryRun: true,
      cwd: tmpdir,
    });

    const calls = vi.mocked(ensureExternalDeps).mock.calls;
    expect(calls).toHaveLength(1);
    expect(calls[0][0].dryRun).toBe(true);
  });
});
