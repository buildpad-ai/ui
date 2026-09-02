/**
 * `buildpad migrate i18n` — moves a pre-i18n app onto app/[lang].
 *
 * The resolver is mocked at the module boundary (as in upgrade.test.ts); the
 * i18n module install is exercised through the real copyLibModule against
 * stub sources.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';

const MOCK_REGISTRY = {
  schemaVersion: 2,
  version: '2.3.0',
  name: 'buildpad',
  packages: { '@buildpad/cli': { version: '2.3.0', changelogUrl: 'cli/CHANGELOG.md' } },
  components: [],
  lib: {
    i18n: {
      name: 'i18n',
      description: 'locale routing',
      sourcePackage: '@buildpad/cli',
      dependencies: ['negotiator'],
      files: [
        { source: 'cli/templates/lib/i18n/config.ts', target: 'lib/i18n/config.ts', sourceSha256: 'stub' },
      ],
    },
    'api-routes': {
      name: 'api-routes',
      description: 'routes',
      sourcePackage: '@buildpad/cli',
      files: [
        { source: 'cli/templates/api/login-page.tsx', target: 'app/[lang]/login/page.tsx', sourceSha256: 'stub' },
        { source: 'cli/templates/api/auth-login-route.ts', target: 'app/api/auth/login/route.ts', sourceSha256: 'stub' },
      ],
    },
  },
  categories: [],
};

const SOURCES: Record<string, string> = {
  'cli/templates/lib/i18n/config.ts': 'export const locales = ["en"] as const;\n',
  'cli/templates/app/layout.tsx': '// new [lang] layout template\nexport default function RootLayout() {}\n',
};

vi.mock('../src/resolver.js', () => ({
  getRegistry: vi.fn(async () => MOCK_REGISTRY),
  resolveSourceFile: vi.fn(async (source: string) => {
    if (SOURCES[source] !== undefined) return SOURCES[source];
    throw new Error(`unexpected source: ${source}`);
  }),
  sourceFileExists: vi.fn(async (source: string) => SOURCES[source] !== undefined),
  fetchSourceAtRef: vi.fn(async () => { throw new Error('unreachable'); }),
  fetchSourceAtVersion: vi.fn(async () => { throw new Error('unreachable'); }),
  fetchRegistryAtRef: vi.fn(async () => MOCK_REGISTRY),
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
  getBundledRegistry: vi.fn(async () => MOCK_REGISTRY),
  resolveBundledTemplate: vi.fn(async () => { throw new Error('not bundled'); }),
  bundledTemplateExists: vi.fn(async () => false),
}));

// Keep the npm-install step out of the test.
vi.mock('../src/utils/external-deps.js', () => ({
  ensureExternalDeps: vi.fn(async () => ({ missing: [], installed: false })),
}));

const { migrateI18n, langTarget, PRE_I18N_LAYOUT } = await import('../src/commands/migrate.js');

let tmpdir: string;
let exitSpy: ReturnType<typeof vi.spyOn>;

const OLD_LAYOUT = `import "./design-tokens.css";\nimport './globals.css';\nexport default function RootLayout({ children }) { return <html lang="en"><body>{children}</body></html>; }\n`;

async function scaffold() {
  const app = path.join(tmpdir, 'app');
  await fs.outputFile(path.join(app, 'layout.tsx'), OLD_LAYOUT);
  await fs.outputFile(path.join(app, 'globals.css'), 'body{}');
  await fs.outputFile(path.join(app, 'design-tokens.css'), ':root{}');
  await fs.outputFile(path.join(app, 'favicon.ico'), '');
  await fs.outputFile(path.join(app, 'robots.ts'), 'export default function robots() {}');
  await fs.outputFile(path.join(app, 'login', 'page.tsx'), 'export default function Login() {}');
  await fs.outputFile(path.join(app, '(authenticated)', 'layout.tsx'), 'export default function L() {}');
  await fs.outputFile(path.join(app, '(authenticated)', 'page.tsx'), 'export default function Home() {}');
  await fs.outputFile(path.join(app, '(authenticated)', 'users', 'page.tsx'), 'export default function Users() {}');
  await fs.outputFile(path.join(app, 'api', 'auth', 'login', 'route.ts'), 'export async function POST() {}');
  await fs.outputFile(path.join(app, 'custom', 'page.tsx'), 'export default function Custom() {}');
  await fs.writeJSON(path.join(tmpdir, 'buildpad.json'), {
    schemaVersion: 3,
    release: '2.2.0',
    model: 'copy-own',
    tsx: true,
    srcDir: false,
    aliases: { components: '@/components/ui', lib: '@/lib/buildpad' },
    installedLib: ['api-routes'],
    installedComponents: [],
    components: {},
    lib: {
      'api-routes': {
        release: '2.2.0',
        ref: 'v2.2.0',
        sourcePackage: '@buildpad/cli',
        installedAt: '2026-01-01T00:00:00Z',
        files: [
          { target: 'app/login/page.tsx', sourceSha256: 'old', sha256: 'x', ref: 'v2.2.0', state: 'clean' },
          { target: 'app/(authenticated)/layout.tsx', sourceSha256: 'old', sha256: 'x', ref: 'v2.2.0', state: 'clean' },
          { target: 'app/api/auth/login/route.ts', sourceSha256: 'old', sha256: 'x', ref: 'v2.2.0', state: 'clean' },
        ],
      },
    },
  });
}

beforeEach(async () => {
  tmpdir = await fs.mkdtemp(path.join(os.tmpdir(), 'buildpad-migrate-i18n-'));
  await scaffold();
  exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
    throw new Error(`process.exit(${code})`);
  }) as never);
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(async () => {
  exitSpy.mockRestore();
  vi.restoreAllMocks();
  await fs.remove(tmpdir);
});

describe('langTarget', () => {
  test('prefixes pages and layouts, leaves api routes and root metadata alone', () => {
    expect(langTarget('app/login/page.tsx')).toBe('app/[lang]/login/page.tsx');
    expect(langTarget('app/(authenticated)/users/page.tsx')).toBe('app/[lang]/(authenticated)/users/page.tsx');
    expect(langTarget('app/api/items/route.ts')).toBe('app/api/items/route.ts');
    expect(langTarget('app/[lang]/login/page.tsx')).toBe('app/[lang]/login/page.tsx');
    expect(langTarget('app/globals.css')).toBe('app/globals.css');
    expect(langTarget('app/sitemap.ts')).toBe('app/sitemap.ts');
    expect(langTarget('app/opengraph-image.png')).toBe('app/opengraph-image.png');
    expect(langTarget('components/ui/input.tsx')).toBe('components/ui/input.tsx');
  });
});

describe('migrateI18n', () => {
  test('moves routes under app/[lang], keeps the old layout for merging, retargets the manifest', async () => {
    await migrateI18n({ cwd: tmpdir });

    const app = path.join(tmpdir, 'app');
    // moved
    expect(fs.existsSync(path.join(app, '[lang]', 'login', 'page.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(app, '[lang]', '(authenticated)', 'users', 'page.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(app, '[lang]', 'custom', 'page.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(app, 'login'))).toBe(false);
    expect(fs.existsSync(path.join(app, '(authenticated)'))).toBe(false);
    expect(fs.existsSync(path.join(app, 'custom'))).toBe(false);
    // kept at root
    expect(fs.existsSync(path.join(app, 'api', 'auth', 'login', 'route.ts'))).toBe(true);
    expect(fs.existsSync(path.join(app, 'globals.css'))).toBe(true);
    expect(fs.existsSync(path.join(app, 'robots.ts'))).toBe(true);
    expect(fs.existsSync(path.join(app, 'favicon.ico'))).toBe(true);
    // root layout replaced, previous one kept with rewritten CSS imports
    expect(fs.existsSync(path.join(app, 'layout.tsx'))).toBe(false);
    const newLayout = await fs.readFile(path.join(app, '[lang]', 'layout.tsx'), 'utf-8');
    expect(newLayout).toContain('new [lang] layout template');
    const kept = await fs.readFile(path.join(app, '[lang]', PRE_I18N_LAYOUT), 'utf-8');
    expect(kept).toContain(`import "../design-tokens.css";`);
    expect(kept).toContain(`import '../globals.css';`);
    // i18n module installed
    expect(fs.existsSync(path.join(tmpdir, 'lib', 'i18n', 'config.ts'))).toBe(true);

    const manifest = await fs.readJSON(path.join(tmpdir, 'buildpad.json'));
    expect(manifest.installedLib).toContain('i18n');
    const targets = manifest.lib['api-routes'].files.map((f: { target: string }) => f.target);
    expect(targets).toEqual([
      'app/[lang]/login/page.tsx',
      'app/[lang]/(authenticated)/layout.tsx',
      'app/api/auth/login/route.ts',
    ]);
  });

  test('dry run changes nothing on disk or in the manifest', async () => {
    const before = await fs.readJSON(path.join(tmpdir, 'buildpad.json'));
    await migrateI18n({ cwd: tmpdir, dryRun: true });
    const app = path.join(tmpdir, 'app');
    expect(fs.existsSync(path.join(app, 'layout.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(app, '[lang]'))).toBe(false);
    expect(fs.existsSync(path.join(tmpdir, 'lib', 'i18n'))).toBe(false);
    expect(await fs.readJSON(path.join(tmpdir, 'buildpad.json'))).toEqual(before);
  });

  test('is safe to re-run: existing targets are reported, not clobbered', async () => {
    await migrateI18n({ cwd: tmpdir });
    // simulate a leftover old file reappearing
    await fs.outputFile(path.join(tmpdir, 'app', 'login', 'page.tsx'), 'export default function Stale() {}');
    await migrateI18n({ cwd: tmpdir });
    const moved = await fs.readFile(path.join(tmpdir, 'app', '[lang]', 'login', 'page.tsx'), 'utf-8');
    expect(moved).toBe('export default function Login() {}');
    expect(fs.existsSync(path.join(tmpdir, 'app', 'login', 'page.tsx'))).toBe(true);
  });
});
