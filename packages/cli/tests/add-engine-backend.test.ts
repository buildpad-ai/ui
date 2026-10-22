/**
 * add(): the Engine variant of a lib module.
 *
 * A Buildpad starter records its backend in `.buildpad/project.json`. On an
 * Engine project `add external-oauth` (directly, or through `--with-api` /
 * bootstrap) installs `external-oauth-engine`, which replaces the unmodified
 * copies external-oauth and api-routes wrote on the targets they share. A
 * Supabase project, or one that records no backend, keeps external-oauth.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

const MOCK_REGISTRY = {
  schemaVersion: 2,
  generatedAt: '2026-10-20T00:00:00Z',
  version: '2.0.0',
  name: 'buildpad',
  packages: {},
  components: [],
  lib: {
    'api-routes': {
      name: 'api-routes',
      description: 'Auth routes',
      sourcePackage: '@buildpad/cli',
      version: '2.0.0',
      lastChangedIn: '2.0.0',
      files: [
        { source: 'cli/templates/api/auth-login-route.ts', target: 'app/api/auth/login/route.ts', sourceSha256: 'login' },
        { source: 'cli/templates/api/auth-callback-route.ts', target: 'app/api/auth/callback/route.ts', sourceSha256: 'basic' },
      ],
    },
    'external-oauth': {
      name: 'external-oauth',
      description: 'OAuth client (Supabase project)',
      engineVariant: 'external-oauth-engine',
      sourcePackage: '@buildpad/cli',
      version: '2.0.0',
      lastChangedIn: '2.0.0',
      internalDependencies: ['api-routes'],
      files: [
        { source: 'cli/templates/lib/oauth/config.ts', target: 'lib/oauth/config.ts', sourceSha256: 'config' },
        { source: 'cli/templates/api/auth-callback-oauth-route.ts', target: 'app/api/auth/callback/route.ts', sourceSha256: 'supabase-callback' },
      ],
    },
    'external-oauth-engine': {
      name: 'external-oauth-engine',
      description: 'XAppHub sign-in (Engine project)',
      backend: 'engine',
      replaces: ['external-oauth', 'api-routes'],
      sourcePackage: '@buildpad/cli',
      version: '2.0.0',
      lastChangedIn: '2.0.0',
      internalDependencies: ['api-routes'],
      files: [
        { source: 'cli/templates/lib/oauth/config.ts', target: 'lib/oauth/config.ts', sourceSha256: 'config' },
        { source: 'cli/templates/lib/oauth/engine.ts', target: 'lib/oauth/engine.ts', sourceSha256: 'engine' },
        { source: 'cli/templates/api/auth-callback-oauth-engine-route.ts', target: 'app/api/auth/callback/route.ts', sourceSha256: 'engine-callback' },
      ],
    },
  },
  categories: [],
};

const SOURCES: Record<string, string> = {
  'cli/templates/api/auth-login-route.ts': `export const login = 'login';\n`,
  'cli/templates/api/auth-callback-route.ts': `export const callback = 'basic';\n`,
  'cli/templates/lib/oauth/config.ts': `export const config = 'shared';\n`,
  'cli/templates/api/auth-callback-oauth-route.ts': `export const callback = 'supabase-oauth';\n`,
  'cli/templates/lib/oauth/engine.ts': `export const engine = 'engine';\n`,
  'cli/templates/api/auth-callback-oauth-engine-route.ts': `export const callback = 'engine-oauth';\n`,
};

// `add --with-api` with no names falls through to the category prompt.
vi.mock('prompts', () => ({ default: vi.fn(async () => ({})) }));

vi.mock('../src/resolver.js', () => ({
  getRegistry: vi.fn(async () => MOCK_REGISTRY),
  resolveSourceFile: vi.fn(async (source: string) => {
    if (source in SOURCES) return SOURCES[source];
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
  tmpdir = await fs.mkdtemp(path.join(os.tmpdir(), 'buildpad-add-engine-'));
  await fs.ensureDir(path.join(tmpdir, 'components/ui'));
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
});

afterEach(async () => {
  await fs.remove(tmpdir);
  vi.restoreAllMocks();
});

async function writeSignal(backend: string, file = '.buildpad/project.json') {
  await fs.outputFile(path.join(tmpdir, file), `${JSON.stringify({ buildpadProject: 1, backend }, null, 2)}\n`);
}

const manifest = () => fs.readJSON(path.join(tmpdir, 'buildpad.json'));
const callback = () => fs.readFile(path.join(tmpdir, 'app/api/auth/callback/route.ts'), 'utf-8');

describe('add external-oauth by name', () => {
  test('a project that records no backend gets external-oauth, as before', async () => {
    await add(['external-oauth'], { cwd: tmpdir, nonInteractive: true });

    const after = await manifest();
    expect(after.installedLib).toContain('external-oauth');
    expect(after.installedLib).not.toContain('external-oauth-engine');
    expect(await callback()).toContain('supabase-oauth');
  });

  test('a Supabase project gets external-oauth', async () => {
    await writeSignal('supabase');

    await add(['external-oauth'], { cwd: tmpdir, nonInteractive: true });

    expect((await manifest()).installedLib).not.toContain('external-oauth-engine');
    expect(await callback()).toContain('supabase-oauth');
  });

  test('an Engine project gets external-oauth-engine instead', async () => {
    await writeSignal('engine');

    await add(['external-oauth'], { cwd: tmpdir, nonInteractive: true });

    const after = await manifest();
    expect(after.installedLib).toEqual(expect.arrayContaining(['api-routes', 'external-oauth-engine']));
    expect(after.installedLib).not.toContain('external-oauth');
    expect(await callback()).toContain('engine-oauth');
    expect(await fs.pathExists(path.join(tmpdir, 'lib/oauth/engine.ts'))).toBe(true);
    expect(after.lib['external-oauth-engine'].files.map((f: { target: string }) => f.target)).toContain(
      'app/api/auth/callback/route.ts'
    );
  });

  test('the developer’s answer file counts when there is no project.json', async () => {
    await fs.outputJSON(path.join(tmpdir, '.buildpad/backend-answer.json'), { buildpadBackendAnswer: 1, backend: 'engine' });

    await add(['external-oauth'], { cwd: tmpdir, nonInteractive: true });

    expect((await manifest()).installedLib).toContain('external-oauth-engine');
  });

  test('external-oauth-engine is refused on a Supabase project', async () => {
    await writeSignal('supabase');
    const exit = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`exit ${code}`);
    }) as never);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    await expect(add(['external-oauth-engine'], { cwd: tmpdir, nonInteractive: true })).rejects.toThrow('exit 1');

    expect(exit).toHaveBeenCalledWith(1);
    expect(log.mock.calls.flat().join('\n')).toContain('Install external-oauth instead');
    expect(await fs.pathExists(path.join(tmpdir, 'app/api/auth/callback/route.ts'))).toBe(false);
  });
});

describe('add --with-api (bootstrap) on an Engine project', () => {
  test('installs external-oauth-engine and replaces api-routes’ unmodified callback', async () => {
    await writeSignal('engine');

    await add([], { cwd: tmpdir, withApi: true, nonInteractive: true });

    const after = await manifest();
    expect(after.installedLib).toEqual(expect.arrayContaining(['api-routes', 'external-oauth-engine']));
    expect(after.installedLib).not.toContain('external-oauth');
    expect(await callback()).toContain('engine-oauth');
    // api-routes shares only the callback with the Engine module: it stays.
    expect(after.installedLib).toContain('api-routes');
  });

  test('replaces an earlier, unmodified external-oauth and drops it from the manifest', async () => {
    // An earlier bootstrap, before the project recorded its backend.
    await add(['external-oauth'], { cwd: tmpdir, nonInteractive: true });
    expect(await callback()).toContain('supabase-oauth');

    await writeSignal('engine');
    await add([], { cwd: tmpdir, withApi: true, nonInteractive: true });

    const after = await manifest();
    expect(after.installedLib).toContain('external-oauth-engine');
    expect(after.installedLib).not.toContain('external-oauth');
    expect(after.lib['external-oauth']).toBeUndefined();
    expect(await callback()).toContain('engine-oauth');
  });

  test('keeps a callback the developer changed, and does not record it as the Engine module’s', async () => {
    await add(['external-oauth'], { cwd: tmpdir, nonInteractive: true });
    const edited = `export const callback = 'my own';\n`;
    await fs.writeFile(path.join(tmpdir, 'app/api/auth/callback/route.ts'), edited);

    await writeSignal('engine');
    await add([], { cwd: tmpdir, withApi: true, nonInteractive: true });

    expect(await callback()).toBe(edited);
    const after = await manifest();
    const record = after.lib['external-oauth-engine'].files.find(
      (f: { target: string }) => f.target === 'app/api/auth/callback/route.ts'
    );
    // Kept, so not "clean" against the Engine source.
    expect(record.state).toBe('pending');
    // The Engine module wrote its own new file regardless.
    expect(await fs.pathExists(path.join(tmpdir, 'lib/oauth/engine.ts'))).toBe(true);
    // Not every external-oauth target was taken over cleanly, but the module
    // ships all of them, so external-oauth is still superseded.
    expect(after.installedLib).not.toContain('external-oauth');
  });
});

describe('add --with-api on a Supabase project', () => {
  test('installs external-oauth, as before', async () => {
    await writeSignal('supabase');

    await add([], { cwd: tmpdir, withApi: true, nonInteractive: true });

    const after = await manifest();
    expect(after.installedLib).toEqual(expect.arrayContaining(['api-routes', 'external-oauth']));
    expect(after.installedLib).not.toContain('external-oauth-engine');
  });
});
