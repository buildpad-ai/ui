/**
 * `upgrade` and the dependencies of what it upgrades.
 *
 * An entry's new source imports its dependencies' new source, so upgrading
 * the entry alone leaves a project that does not compile (3.0: `upgrade
 * list-o2m` wrote imports of a services file and a list-m2a file that the 2.6
 * copies do not have). `upgrade` therefore upgrades the out-of-date entries
 * its targets depend on and installs the missing ones; `--no-deps` keeps the
 * old, exact scope.
 *
 * Drives the real command against a tmpdir; only the resolver is mocked.
 *
 * The fixture registry:
 *   form       → field, picker (components), helpers (lib)
 *   field      → form (a cycle), helpers (lib)
 *   picker     → icons (lib)
 *   standalone   (depends on nothing; nothing depends on it)
 *   helpers    → core (lib)
 *   routes (lib) → form (component)
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { hashTransformed } from '../src/commands/transformer.js';

const RELEASE = '3.0.0';
const NEW_SHA = 'sha-v3';
const OLD_SHA = 'sha-v2';

const componentEntry = (name: string, deps: { lib?: string[]; components?: string[] } = {}) => ({
  name,
  title: name,
  description: 'Test fixture',
  category: 'input',
  sourcePackage: '@buildpad/ui-interfaces',
  version: RELEASE,
  lastChangedIn: RELEASE,
  files: [{ source: `ui-interfaces/src/${name}/${name}.tsx`, target: `components/ui/${name}.tsx`, sourceSha256: NEW_SHA }],
  dependencies: [],
  internalDependencies: deps.lib ?? [],
  registryDependencies: deps.components ?? [],
});

const libEntry = (name: string, deps: { lib?: string[]; components?: string[] } = {}) => ({
  name,
  description: 'Test lib fixture',
  sourcePackage: '@buildpad/cli',
  version: RELEASE,
  lastChangedIn: RELEASE,
  files: [{ source: `cli/templates/lib/${name}.ts`, target: `lib/buildpad/${name}.ts`, sourceSha256: NEW_SHA }],
  internalDependencies: deps.lib ?? [],
  registryDependencies: deps.components ?? [],
});

const MOCK_REGISTRY = {
  schemaVersion: 2,
  generatedAt: '2026-10-08T00:00:00Z',
  version: RELEASE,
  name: 'buildpad',
  packages: {
    '@buildpad/ui-interfaces': { version: RELEASE, changelogUrl: 'ui-interfaces/CHANGELOG.md' },
    '@buildpad/cli': { version: RELEASE, changelogUrl: 'cli/CHANGELOG.md' },
  },
  components: [
    componentEntry('form', { lib: ['helpers'], components: ['field', 'picker'] }),
    componentEntry('field', { lib: ['helpers'], components: ['form'] }),
    componentEntry('picker', { lib: ['icons'] }),
    componentEntry('standalone'),
  ],
  lib: {
    helpers: libEntry('helpers', { lib: ['core'] }),
    core: libEntry('core'),
    icons: libEntry('icons'),
    routes: libEntry('routes', { components: ['form'] }),
  },
  categories: [],
};

/** What the registry ships for a source path: a v3 marker the tests look for. */
const upstream = (source: string) => `// ${source} @ ${RELEASE}\nexport const release = '${RELEASE}';\n`;

vi.mock('../src/resolver.js', () => ({
  getRegistry: vi.fn(async () => MOCK_REGISTRY),
  resolveSourceFile: vi.fn(async (source: string) => upstream(source)),
  sourceFileExists: vi.fn(async () => true),
  fetchSourceAtRef: vi.fn(async () => {
    throw new Error('unreachable ref');
  }),
  fetchSourceAtVersion: vi.fn(async () => {
    throw new Error('network unavailable');
  }),
  fetchRegistryAtRef: vi.fn(async () => MOCK_REGISTRY),
  getRecordedRef: () => `v${RELEASE}`,
  getSourceRef: () => `v${RELEASE}`,
  setSourceRef: vi.fn(),
  getCliVersion: () => RELEASE,
  encodeRef: (r: string) => r,
  registryBaseUrl: () => 'https://x.test/packages',
  buildPackageTag: (p: string, v: string) => `${p}@${v}`,
  buildVersionedSourceUrl: (r: string, s: string) => `https://x.test/${r}/packages/${s}`,
  CHANGELOG_BASE_URL: 'https://x.test/packages',
  getTemplatesRoot: () => '/tmp/mock-templates',
  getLocalPackagesRoot: () => '/tmp/mock-packages',
  getBundledRegistry: vi.fn(async () => MOCK_REGISTRY),
  resolveBundledTemplate: vi.fn(async (source: string) => upstream(source)),
  bundledTemplateExists: vi.fn(async () => true),
}));

const { upgrade } = await import('../src/commands/upgrade.js');

// ── Consumer fixture ────────────────────────────────────────────────────────

/**
 * How an entry sits in the project before the run:
 *   stale    — installed from 2.6, untouched since
 *   edited   — installed from 2.6, then edited by the user
 *   current  — already at the registry's content
 *   (absent) — not installed
 */
type State = 'stale' | 'edited' | 'current';

const INSTALLED_BODY = (name: string) => `// ${name} @ 2.6.0\nexport const release = '2.6.0';\n`;
const EDITED_BODY = (name: string) => `${INSTALLED_BODY(name)}// my own change\n`;

const targetOf = (kind: 'component' | 'lib', name: string) =>
  kind === 'component' ? `components/ui/${name}.tsx` : `lib/buildpad/${name}.ts`;

let tmpdir: string;
let log: string[];

beforeEach(async () => {
  tmpdir = await fs.mkdtemp(path.join(os.tmpdir(), 'buildpad-upgrade-deps-'));
  log = [];
  vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    log.push(args.join(' '));
  });
});

afterEach(async () => {
  vi.restoreAllMocks();
  await fs.remove(tmpdir);
});

async function setupConsumer(entries: {
  components?: Record<string, State>;
  lib?: Record<string, State>;
}) {
  const record = async (kind: 'component' | 'lib', name: string, state: State) => {
    const target = targetOf(kind, name);
    const abs = path.join(tmpdir, target);
    await fs.ensureDir(path.dirname(abs));
    await fs.writeFile(abs, state === 'edited' ? EDITED_BODY(name) : INSTALLED_BODY(name));
    return {
      release: state === 'current' ? RELEASE : '2.6.0',
      ref: state === 'current' ? `v${RELEASE}` : 'v2.6.0',
      sourcePackage: kind === 'component' ? '@buildpad/ui-interfaces' : '@buildpad/cli',
      installedAt: '2026-01-01T00:00:00Z',
      files: [{
        target,
        sourceSha256: state === 'current' ? NEW_SHA : OLD_SHA,
        // The hash of what the CLI wrote: an edited file no longer matches it.
        sha256: hashTransformed(INSTALLED_BODY(name)),
        ref: state === 'current' ? `v${RELEASE}` : 'v2.6.0',
        state: 'clean',
      }],
    };
  };

  const components: Record<string, unknown> = {};
  for (const [name, state] of Object.entries(entries.components ?? {})) components[name] = await record('component', name, state);
  const lib: Record<string, unknown> = {};
  for (const [name, state] of Object.entries(entries.lib ?? {})) lib[name] = await record('lib', name, state);

  await fs.writeJSON(path.join(tmpdir, 'buildpad.json'), {
    schemaVersion: 3,
    release: '2.6.0',
    model: 'copy-own',
    tsx: true,
    srcDir: false,
    aliases: { components: '@/components/ui', lib: '@/lib/buildpad' },
    installedLib: Object.keys(lib),
    installedComponents: Object.keys(components),
    components,
    lib,
  });
}

const read = (kind: 'component' | 'lib', name: string) => fs.readFile(path.join(tmpdir, targetOf(kind, name)), 'utf8');
const exists = (rel: string) => fs.pathExists(path.join(tmpdir, rel));
const manifest = () => fs.readJSON(path.join(tmpdir, 'buildpad.json'));
/** Whether the file on disk is the registry's 3.0 content. */
const isUpgraded = async (kind: 'component' | 'lib', name: string) => (await read(kind, name)).includes(`@ ${RELEASE}`);

/** A 2.6 project with every fixture entry but `picker` and `icons`. */
const PROJECT = {
  components: { form: 'stale', field: 'stale', standalone: 'stale' },
  lib: { helpers: 'stale', core: 'current', routes: 'current' },
} as const;

// ── Tests ───────────────────────────────────────────────────────────────────

describe('upgrade <name> brings its dependencies', () => {
  test('upgrades the out-of-date components and lib modules the entry depends on', async () => {
    await setupConsumer(PROJECT);

    await upgrade({ components: ['form'], strategy: 'new-file', cwd: tmpdir });

    expect(await isUpgraded('component', 'form')).toBe(true);
    expect(await isUpgraded('component', 'field')).toBe(true);
    expect(await isUpgraded('lib', 'helpers')).toBe(true);
    const m = await manifest();
    expect(m.components.field.files[0]).toMatchObject({ sourceSha256: NEW_SHA, state: 'clean', ref: `v${RELEASE}` });
    expect(m.lib.helpers.files[0]).toMatchObject({ sourceSha256: NEW_SHA, state: 'clean' });
  });

  test('leaves an out-of-date entry alone when nothing selected depends on it', async () => {
    await setupConsumer(PROJECT);

    await upgrade({ components: ['form'], strategy: 'new-file', cwd: tmpdir });

    expect(await read('component', 'standalone')).toBe(INSTALLED_BODY('standalone'));
    expect((await manifest()).components.standalone.files[0].sourceSha256).toBe(OLD_SHA);
  });

  test('installs a component the entry now needs, the lib module that component needs, and the barrel line', async () => {
    await setupConsumer(PROJECT);

    await upgrade({ components: ['form'], strategy: 'new-file', cwd: tmpdir });

    expect(await isUpgraded('component', 'picker')).toBe(true);
    expect(await isUpgraded('lib', 'icons')).toBe(true);
    const m = await manifest();
    expect(m.installedComponents).toContain('picker');
    expect(m.installedLib).toContain('icons');
    expect(m.components.picker).toMatchObject({ release: RELEASE, ref: `v${RELEASE}` });
    expect(m.components.picker.files[0]).toMatchObject({ sourceSha256: NEW_SHA, state: 'clean' });
    expect(await fs.readFile(path.join(tmpdir, 'components/ui/index.ts'), 'utf8')).toContain('./picker');
  });

  test('says what it brings along, and why', async () => {
    await setupConsumer(PROJECT);

    await upgrade({ components: ['form'], strategy: 'new-file', cwd: tmpdir });

    const out = log.join('\n');
    expect(out).toContain('Dependencies of what is being upgraded');
    expect(out).toMatch(/upgrade .*field.* — needed by form/);
    expect(out).toMatch(/upgrade .*helpers \(lib\).* — needed by form/);
    expect(out).toMatch(/install .*picker.* — needed by form/);
    expect(out).toMatch(/install .*icons \(lib\).* — needed by picker/);
    expect(out).toContain('--no-deps');
    expect(out).toMatch(/Upgraded : 3/); // form, field, helpers
    expect(out).toMatch(/Installed: 2/); // picker, icons
  });

  test('reaches an out-of-date entry behind an up-to-date one', async () => {
    // form → helpers (current) → core (stale)
    await setupConsumer({
      components: { form: 'stale', field: 'current', picker: 'current' },
      lib: { helpers: 'current', core: 'stale', icons: 'current' },
    });

    await upgrade({ components: ['form'], strategy: 'new-file', cwd: tmpdir });

    expect(await isUpgraded('lib', 'core')).toBe(true);
    // Up-to-date dependencies are not rewritten.
    expect(await read('lib', 'helpers')).toBe(INSTALLED_BODY('helpers'));
    expect(await read('component', 'field')).toBe(INSTALLED_BODY('field'));
  });

  test('never overwrites an edited dependency: it goes through the strategy', async () => {
    await setupConsumer({ ...PROJECT, components: { ...PROJECT.components, field: 'edited' }, lib: { ...PROJECT.lib, helpers: 'edited' } });

    await upgrade({ components: ['form'], strategy: 'new-file', cwd: tmpdir });

    expect(await read('component', 'field')).toBe(EDITED_BODY('field'));
    expect(await exists('components/ui/field.tsx.new')).toBe(true);
    expect(await read('lib', 'helpers')).toBe(EDITED_BODY('helpers'));
    expect(await exists('lib/buildpad/helpers.ts.new')).toBe(true);
    const m = await manifest();
    // Still out of date, so the next run offers them again.
    expect(m.components.field.files[0]).toMatchObject({ sourceSha256: OLD_SHA, state: 'pending' });
    expect(m.lib.helpers.files[0]).toMatchObject({ sourceSha256: OLD_SHA, state: 'pending' });
  });

  test('a named lib module brings the components it depends on', async () => {
    await setupConsumer({ ...PROJECT, lib: { ...PROJECT.lib, routes: 'stale' } });

    await upgrade({ components: ['routes'], strategy: 'new-file', cwd: tmpdir });

    expect(await isUpgraded('lib', 'routes')).toBe(true);
    expect(await isUpgraded('component', 'form')).toBe(true);
    expect(await isUpgraded('component', 'field')).toBe(true);
    expect(await isUpgraded('lib', 'helpers')).toBe(true);
    expect(await read('component', 'standalone')).toBe(INSTALLED_BODY('standalone'));
  });

  test('an entry that is itself up to date still gets its dependencies repaired', async () => {
    // What `upgrade form --no-deps` leaves behind: form current, the rest on 2.6.
    await setupConsumer({ ...PROJECT, components: { ...PROJECT.components, form: 'current' } });

    await upgrade({ components: ['form'], strategy: 'new-file', cwd: tmpdir });

    expect(await read('component', 'form')).toBe(INSTALLED_BODY('form'));
    expect(await isUpgraded('component', 'field')).toBe(true);
    expect(await isUpgraded('lib', 'helpers')).toBe(true);
    expect((await manifest()).installedComponents).toContain('picker');
  });

  test('--force re-syncs the named entry only, not the dependencies that are up to date', async () => {
    await setupConsumer({
      components: { form: 'current', field: 'current', picker: 'current' },
      lib: { helpers: 'current', core: 'current', icons: 'current' },
    });

    await upgrade({ components: ['form'], force: true, strategy: 'overwrite', cwd: tmpdir });

    expect(await isUpgraded('component', 'form')).toBe(true);
    expect(await read('component', 'field')).toBe(INSTALLED_BODY('field'));
    expect(await read('lib', 'helpers')).toBe(INSTALLED_BODY('helpers'));
  });

  test('--dry-run reports the dependencies and writes nothing', async () => {
    await setupConsumer(PROJECT);
    const before = await manifest();

    await upgrade({ components: ['form'], strategy: 'new-file', dryRun: true, cwd: tmpdir });

    expect(log.join('\n')).toMatch(/install .*picker/);
    expect(await manifest()).toEqual(before);
    expect(await read('component', 'field')).toBe(INSTALLED_BODY('field'));
    expect(await read('lib', 'helpers')).toBe(INSTALLED_BODY('helpers'));
    expect(await exists('components/ui/picker.tsx')).toBe(false);
    expect(await exists('lib/buildpad/icons.ts')).toBe(false);
    expect(await exists('components/ui/index.ts')).toBe(false);
  });
});

describe('upgrade --no-deps', () => {
  test('upgrades only the named entry', async () => {
    await setupConsumer(PROJECT);

    await upgrade({ components: ['form'], deps: false, strategy: 'new-file', cwd: tmpdir });

    expect(await isUpgraded('component', 'form')).toBe(true);
    expect(await read('component', 'field')).toBe(INSTALLED_BODY('field'));
    expect(await read('lib', 'helpers')).toBe(INSTALLED_BODY('helpers'));
    const m = await manifest();
    expect(m.installedComponents).not.toContain('picker');
    expect(m.installedLib).not.toContain('icons');
    expect(log.join('\n')).not.toContain('Dependencies of what is being upgraded');
  });

  test('still installs a lib module the named entry imports directly', async () => {
    // As before this change: a missing lib dependency is never left missing.
    await setupConsumer({ components: { picker: 'stale' } });

    await upgrade({ components: ['picker'], deps: false, strategy: 'new-file', cwd: tmpdir });

    expect((await manifest()).installedLib).toContain('icons');
    expect(await isUpgraded('lib', 'icons')).toBe(true);
  });
});

describe('upgrade with no names', () => {
  test('upgrades everything out of date and installs what those entries now need', async () => {
    await setupConsumer(PROJECT);

    await upgrade({ components: [], strategy: 'new-file', cwd: tmpdir });

    for (const name of ['form', 'field', 'standalone']) expect(await isUpgraded('component', name)).toBe(true);
    expect(await isUpgraded('lib', 'helpers')).toBe(true);
    const m = await manifest();
    expect(m.installedComponents).toContain('picker');
    expect(m.installedLib).toContain('icons');
    // Everything out of date was selected already: only the installs are "brought along".
    const out = log.join('\n');
    expect(out).toMatch(/install .*picker/);
    expect(out).not.toMatch(/\n\s+upgrade .* — needed by/);
  });

  test('with --no-deps a missing component stays missing', async () => {
    await setupConsumer(PROJECT);

    await upgrade({ components: [], deps: false, strategy: 'new-file', cwd: tmpdir });

    expect(await isUpgraded('component', 'form')).toBe(true);
    expect((await manifest()).installedComponents).not.toContain('picker');
  });

  test('nothing out of date is still a no-op', async () => {
    await setupConsumer({ components: { standalone: 'current' }, lib: { core: 'current' } });
    const before = await manifest();

    await upgrade({ components: [], strategy: 'new-file', cwd: tmpdir });

    expect(log.join('\n')).toContain('Everything is up to date');
    expect(await manifest()).toEqual(before);
  });
});

describe('upgrade <name> for a component the project does not have', () => {
  test('installs it, with what it needs, and lists it as installed', async () => {
    await setupConsumer({ components: { standalone: 'current' } });

    await upgrade({ components: ['picker'], strategy: 'new-file', cwd: tmpdir });

    const m = await manifest();
    expect(m.installedComponents).toEqual(['standalone', 'picker']);
    expect(m.installedLib).toContain('icons');
    expect(await isUpgraded('component', 'picker')).toBe(true);
    expect(log.join('\n')).toMatch(/picker.* install @ 3\.0\.0/);
  });
});
