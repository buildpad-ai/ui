/**
 * Upgrade tools: lib-aware list_outdated / get_upgrade_plan, disk paths that
 * match where the CLI writes files, and apply_upgrade's argument validation
 * and pinned CLI invocation.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const spawnSyncMock = vi.fn();
vi.mock('node:child_process', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:child_process')>()),
  spawnSync: spawnSyncMock,
}));

const { handleCallToolRequest } = await import('../src/index.js');
const { getAllComponents, getRegistry } = await import('../src/registry.js');
const { hashTransformed } = await import('../src/versioning.js');
const {
  buildUpgradeCommand,
  diskPathOf,
  libDependencyClosure,
  readConsumerConfig,
  validateApplyUpgradeArgs,
  ENTRY_NAME_PATTERN,
  UPGRADE_STRATEGIES,
} = await import('../src/upgrade.js');

const MCP_VERSION = (JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8'),
) as { version: string }).version;

type ToolResult = { isError?: boolean; content: Array<{ type: string; text: string }> };
const call = (name: string, args?: unknown) =>
  handleCallToolRequest({ params: { name, arguments: args } }) as Promise<ToolResult>;
const json = (r: ToolResult) => JSON.parse(r.content[0].text);

const registry = getRegistry();

/** A component with lib dependencies, and a lib module it depends on. */
const component = getAllComponents().find(c => c.internalDependencies.some(d => registry.lib[d]))!;
const libName = component.internalDependencies.find(d => registry.lib[d])!;
const libFiles = registry.lib[libName].files!;

let tmp: string;

/** Record a file as the CLI would: upstream hash plus the hash of what it wrote. */
function record(target: string, sourceSha256: string | undefined, written: string) {
  return { target, sourceSha256, sha256: hashTransformed(written), ref: `v${MCP_VERSION}`, state: 'clean' };
}

function writeConfig(config: object) {
  fs.writeFileSync(path.join(tmp, 'buildpad.json'), JSON.stringify(config));
}

function writeFile(rel: string, content: string) {
  const full = path.join(tmp, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

beforeEach(() => {
  tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'buildpad-mcp-upgrade-')));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
  spawnSyncMock.mockReset();
});

/**
 * A v3 project: the component is current, its lib dependency is stale
 * (recorded with an old upstream hash), and its files are on disk under src/.
 */
function staleLibProject(opts: { modifyLib?: boolean } = {}) {
  const compRecord = component.files.map(f => record(f.target, f.sourceSha256, `// ${f.target}\n`));
  const libRecord = libFiles.map((f, i) =>
    record(f.target, i === 0 ? 'old-upstream-hash' : f.sourceSha256, `// ${f.target}\n`));
  writeConfig({
    schemaVersion: 3,
    release: MCP_VERSION,
    srcDir: true,
    tsx: true,
    installedComponents: [component.name],
    installedLib: [libName],
    components: { [component.name]: { release: MCP_VERSION, files: compRecord } },
    lib: { [libName]: { release: '0.0.1', files: libRecord } },
  });
  for (const f of component.files) writeFile(path.join('src', f.target.replace(/\.tsx?$/, '.tsx')), `// ${f.target}\n`);
  libFiles.forEach((f, i) =>
    writeFile(path.join('src', f.target), opts.modifyLib && i === 0 ? '// edited\n' : `// ${f.target}\n`));
}

describe('list_outdated', () => {
  test('reports stale lib modules, not only components', async () => {
    staleLibProject();
    const result = json(await call('list_outdated', { projectPath: tmp }));
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      kind: 'lib',
      name: libName,
      installedRelease: '0.0.1',
      latestRelease: registry.version,
      isOutdated: true,
      untracked: false,
      staleFiles: [{ target: libFiles[0].target, reason: 'upstream-changed' }],
    });
  });

  test('latestRelease is the registry release, not the project\'s own release', async () => {
    const [first] = getAllComponents();
    writeConfig({
      release: '0.0.1',
      components: { [first.name]: { release: '0.0.1', files: [{ target: first.files[0].target }] } },
    });
    const [entry] = json(await call('list_outdated', { projectPath: tmp }));
    expect(entry.installedRelease).toBe('0.0.1');
    expect(entry.latestRelease).toBe(registry.version);
  });

  test('an installed entry with no record is reported as untracked', async () => {
    writeConfig({ installedComponents: [component.name], installedLib: [libName] });
    const result = json(await call('list_outdated', { projectPath: tmp }));
    expect(result.map((e: { name: string; untracked: boolean }) => [e.name, e.untracked])).toEqual([
      [component.name, true],
      [libName, true],
    ]);
  });

  test('entries the registry no longer has are skipped', async () => {
    writeConfig({ installedComponents: ['gone'], installedLib: ['gone-lib'], components: { gone: { files: [] } } });
    expect(json(await call('list_outdated', { projectPath: tmp }))).toEqual([]);
  });

  test('rejects an unreadable buildpad.json with a clear error', async () => {
    fs.writeFileSync(path.join(tmp, 'buildpad.json'), '{ not json');
    await expect(call('list_outdated', { projectPath: tmp })).rejects.toThrow('is not valid JSON');
    await expect(call('list_outdated', { projectPath: 42 })).rejects.toThrow('projectPath must be a string');
  });
});

describe('get_upgrade_plan', () => {
  test('plans lib modules and finds component files where the CLI wrote them (srcDir, .ts→.tsx)', async () => {
    staleLibProject();
    const plan = json(await call('get_upgrade_plan', { projectPath: tmp }));
    const comp = plan.find((e: { name: string }) => e.name === component.name);
    const lib = plan.find((e: { name: string }) => e.name === libName);

    expect(comp.kind).toBe('component');
    expect(comp.isOutdated).toBe(false);
    expect(comp.recommendedAction).toBe('up-to-date');
    expect(comp.files.every((f: { status: string }) => f.status === 'pristine')).toBe(true);
    expect(comp.staleLibDependencies).toContain(libName);

    expect(lib.kind).toBe('lib');
    expect(lib.isOutdated).toBe(true);
    expect(lib.modifiedLocally).toBe(false);
    expect(lib.recommendedAction).toBe('safe-overwrite');
    expect(lib.files[0]).toEqual({ target: libFiles[0].target, path: `src/${libFiles[0].target}`, status: 'pristine' });
  });

  test('a locally edited stale lib file needs a merge', async () => {
    staleLibProject({ modifyLib: true });
    const plan = json(await call('get_upgrade_plan', { projectPath: tmp, components: [libName] }));
    expect(plan).toHaveLength(1);
    expect(plan[0].files[0].status).toBe('modified');
    expect(plan[0].recommendedAction).toBe('prompt-or-three-way');
  });

  test('naming a component also plans its stale lib dependencies', async () => {
    staleLibProject();
    const plan = json(await call('get_upgrade_plan', { projectPath: tmp, components: [component.name] }));
    expect(plan.map((e: { name: string }) => e.name)).toEqual([component.name, libName]);
  });

  test('files with no install hash are untracked: the CLI overwrites them whatever the strategy', async () => {
    writeConfig({ srcDir: false, installedLib: [libName] });
    writeFile(libFiles[0].target, '// maybe edited\n');
    const [entry] = json(await call('get_upgrade_plan', { projectPath: tmp }));
    expect(entry).toMatchObject({ kind: 'lib', name: libName, untracked: true, isOutdated: true });
    expect(entry.files).toHaveLength(libFiles.length);
    expect(entry.files[0]).toEqual({ target: libFiles[0].target, path: libFiles[0].target, status: 'untracked' });
    expect(entry.files.slice(1).every((f: { status: string }) => f.status === 'missing')).toBe(true);
    expect(entry.recommendedAction).toBe('overwrite-untracked');
  });

  test('a recorded file without a sha256 that is on disk is untracked too', async () => {
    const [first] = getAllComponents();
    writeConfig({ srcDir: false, tsx: true, components: { [first.name]: { files: [{ target: first.files[0].target }] } } });
    writeFile(first.files[0].target, '// on disk\n');
    const [entry] = json(await call('get_upgrade_plan', { projectPath: tmp }));
    expect(entry.files[0].status).toBe('untracked');
    expect(entry.recommendedAction).toBe('overwrite-untracked');
  });

  test('flags entries installed from a newer release', async () => {
    const [first] = getAllComponents();
    writeConfig({ components: { [first.name]: { release: '999.0.0', files: [] } } });
    const [entry] = json(await call('get_upgrade_plan', { projectPath: tmp }));
    expect(entry.aheadOfRegistry).toBe(true);
    expect(entry.recommendedAction).toBe('update-mcp');
  });

  test('rejects a components argument that is not a list of names', async () => {
    writeConfig({});
    await expect(call('get_upgrade_plan', { projectPath: tmp, components: 'input' })).rejects.toThrow('components must be an array');
  });
});

describe('diskPathOf', () => {
  test('mirrors the CLI: srcDir, the component extension swap, literal lib targets', () => {
    const p = '/proj';
    expect(diskPathOf(p, { srcDir: true, tsx: true }, 'component', 'components/ui/vform/types.ts'))
      .toBe(path.join(p, 'src', 'components/ui/vform/types.tsx'));
    expect(diskPathOf(p, { srcDir: false, tsx: true }, 'component', 'components/ui/input.tsx'))
      .toBe(path.join(p, 'components/ui/input.tsx'));
    expect(diskPathOf(p, { srcDir: false, tsx: false }, 'component', 'components/ui/input.tsx'))
      .toBe(path.join(p, 'components/ui/input.jsx'));
    expect(diskPathOf(p, { srcDir: true, tsx: true }, 'component', 'components/ui/x.css'))
      .toBe(path.join(p, 'src', 'components/ui/x.css'));
    expect(diskPathOf(p, { srcDir: true, tsx: true }, 'lib', 'lib/buildpad/utils/index.ts'))
      .toBe(path.join(p, 'src', 'lib/buildpad/utils/index.ts'));
  });
});

describe('libDependencyClosure', () => {
  test('follows internalDependencies through lib modules', () => {
    const closure = libDependencyClosure([component.name], registry);
    expect(closure).toEqual(expect.arrayContaining(component.internalDependencies.filter(d => registry.lib[d])));
    for (const name of closure) {
      for (const dep of registry.lib[name].internalDependencies ?? []) {
        if (registry.lib[dep]) expect(closure).toContain(dep);
      }
    }
    expect(libDependencyClosure(['not-a-thing'], registry)).toEqual([]);
  });
});

describe('validateApplyUpgradeArgs', () => {
  const base = { projectPath: '/abs/project' };

  test('defaults: new-file strategy, all components, lib dependencies included', () => {
    expect(validateApplyUpgradeArgs(base)).toEqual({
      projectPath: '/abs/project',
      components: [],
      strategy: 'new-file',
      includeLibDependencies: true,
    });
  });

  test.each([
    '--force',
    '-y',
    '--strategy=overwrite',
    'Input',
    'input name',
    '../input',
    'input;rm',
    '',
    '-',
  ])('rejects the component name %j', (name) => {
    expect(() => validateApplyUpgradeArgs({ ...base, components: [name] })).toThrow('Invalid component name');
  });

  test('rejects non-string names and a non-array components value', () => {
    expect(() => validateApplyUpgradeArgs({ ...base, components: [42] })).toThrow('Invalid component name');
    expect(() => validateApplyUpgradeArgs({ ...base, components: 'input' })).toThrow('components must be an array');
  });

  test('accepts registry-style names and de-duplicates them', () => {
    expect(validateApplyUpgradeArgs({ ...base, components: ['input', 'list-m2m', 'input', 'v2'] }).components)
      .toEqual(['input', 'list-m2m', 'v2']);
    expect(ENTRY_NAME_PATTERN.test('a-')).toBe(true);
  });

  test.each(['prompt', 'OVERWRITE', 'merge', '--all', 3])('rejects the strategy %j', (strategy) => {
    expect(() => validateApplyUpgradeArgs({ ...base, strategy })).toThrow('Invalid strategy');
  });

  test('explains why "prompt" is not offered', () => {
    expect(() => validateApplyUpgradeArgs({ ...base, strategy: 'prompt' })).toThrow('interactive');
  });

  test('accepts each non-interactive CLI strategy', () => {
    for (const strategy of UPGRADE_STRATEGIES) {
      expect(validateApplyUpgradeArgs({ ...base, strategy }).strategy).toBe(strategy);
    }
  });

  test('requires an absolute projectPath and a boolean includeLibDependencies', () => {
    expect(() => validateApplyUpgradeArgs({})).toThrow('projectPath is required');
    expect(() => validateApplyUpgradeArgs({ projectPath: 'relative/dir' })).toThrow('absolute path');
    expect(() => validateApplyUpgradeArgs({ projectPath: '--cwd' })).toThrow('absolute path');
    expect(() => validateApplyUpgradeArgs({ ...base, includeLibDependencies: 'yes' })).toThrow('must be a boolean');
  });
});

describe('buildUpgradeCommand', () => {
  test('pins the CLI and puts names after --', () => {
    expect(buildUpgradeCommand({ cliVersion: '2.6.0', projectPath: '/p', strategy: 'three-way', names: ['input', 'utils'] }))
      .toEqual({
        command: 'npx',
        args: ['--yes', '@buildpad/cli@2.6.0', 'upgrade', '--cwd', '/p', '--strategy', 'three-way', '--', 'input', 'utils'],
      });
  });

  test('upgrades everything installed when no names are given', () => {
    expect(buildUpgradeCommand({ cliVersion: '2.7.0-next.1', projectPath: '/p', strategy: 'new-file', names: [] }).args)
      .toEqual(['--yes', '@buildpad/cli@2.7.0-next.1', 'upgrade', '--cwd', '/p', '--strategy', 'new-file', '--all']);
  });

  test('refuses to pin to something that is not a release version', () => {
    expect(() => buildUpgradeCommand({ cliVersion: 'latest', projectPath: '/p', strategy: 'new-file', names: [] }))
      .toThrow('not a release version');
  });
});

describe('apply_upgrade', () => {
  test('no flag injection reaches the command line', async () => {
    writeConfig({ components: {} });
    await expect(call('apply_upgrade', { projectPath: tmp, components: ['--force'] })).rejects.toThrow('Invalid component name');
    await expect(call('apply_upgrade', { projectPath: tmp, strategy: 'overwrite --force' })).rejects.toThrow('Invalid strategy');
    expect(spawnSyncMock).not.toHaveBeenCalled();
  });

  test('rejects names the registry does not have', async () => {
    writeConfig({ components: {} });
    await expect(call('apply_upgrade', { projectPath: tmp, components: ['demo'] })).rejects.toThrow('Not in the @buildpad/mcp');
    expect(spawnSyncMock).not.toHaveBeenCalled();
  });

  test('adds the stale lib modules a named component depends on', async () => {
    staleLibProject();
    spawnSyncMock.mockReturnValue({ status: 0, stdout: 'ok', stderr: '' });
    const result = json(await call('apply_upgrade', { projectPath: tmp, components: [component.name], strategy: 'three-way' }));
    expect(result.libDependencies).toEqual([libName]);
    expect(spawnSyncMock).toHaveBeenCalledWith(
      'npx',
      ['--yes', `@buildpad/cli@${MCP_VERSION}`, 'upgrade', '--cwd', tmp, '--strategy', 'three-way', '--', component.name, libName],
      expect.objectContaining({ cwd: tmp }),
    );
    expect(result.command).toBe(`npx --yes @buildpad/cli@${MCP_VERSION} upgrade --cwd ${tmp} --strategy three-way -- ${component.name} ${libName}`);
  });

  test('includeLibDependencies: false upgrades only the named entries', async () => {
    staleLibProject();
    spawnSyncMock.mockReturnValue({ status: 0, stdout: '', stderr: '' });
    const result = json(await call('apply_upgrade', { projectPath: tmp, components: [component.name], includeLibDependencies: false }));
    expect(result.libDependencies).toEqual([]);
    expect(spawnSyncMock.mock.calls[0][1].slice(-2)).toEqual(['--', component.name]);
  });

  test('refuses to downgrade a project installed from a newer release', async () => {
    writeConfig({ release: '999.0.0', components: {} });
    const result = await call('apply_upgrade', { projectPath: tmp });
    expect(result.isError).toBe(true);
    expect(json(result)).toMatchObject({ projectRelease: '999.0.0', mcpVersion: MCP_VERSION });
    expect(spawnSyncMock).not.toHaveBeenCalled();
  });

  test('refuses when a targeted entry is ahead of this server', async () => {
    const [first] = getAllComponents();
    writeConfig({ release: MCP_VERSION, components: { [first.name]: { release: '999.0.0', files: [] } } });
    const result = await call('apply_upgrade', { projectPath: tmp, components: [first.name] });
    expect(result.isError).toBe(true);
    expect(json(result).aheadOfRegistry).toEqual([{ kind: 'component', name: first.name, installedRelease: '999.0.0' }]);
    expect(json(result).error).toContain('newer release (999.0.0)');
  });

  test('refuses when a stale lib dependency it would add is ahead of this server', async () => {
    staleLibProject();
    const config = JSON.parse(fs.readFileSync(path.join(tmp, 'buildpad.json'), 'utf-8'));
    config.lib[libName].release = '999.0.0';
    writeConfig(config);

    // The plan already says to update the MCP for that lib module ...
    const plan = json(await call('get_upgrade_plan', { projectPath: tmp, components: [component.name] }));
    expect(plan.find((e: { name: string }) => e.name === libName).recommendedAction).toBe('update-mcp');

    // ... so apply_upgrade must not pass it to the older pinned CLI.
    const result = await call('apply_upgrade', { projectPath: tmp, components: [component.name] });
    expect(result.isError).toBe(true);
    expect(json(result)).toMatchObject({
      aheadOfRegistry: [{ kind: 'lib', name: libName, installedRelease: '999.0.0' }],
      libDependencies: [libName],
    });
    expect(json(result).hint).toContain('includeLibDependencies: false');
    expect(spawnSyncMock).not.toHaveBeenCalled();
  });

  test('an ahead lib dependency is left alone with includeLibDependencies: false', async () => {
    staleLibProject();
    const config = JSON.parse(fs.readFileSync(path.join(tmp, 'buildpad.json'), 'utf-8'));
    config.lib[libName].release = '999.0.0';
    writeConfig(config);
    spawnSyncMock.mockReturnValue({ status: 0, stdout: '', stderr: '' });
    const result = await call('apply_upgrade', { projectPath: tmp, components: [component.name], includeLibDependencies: false });
    expect(result.isError).toBeUndefined();
    expect(spawnSyncMock.mock.calls[0][1].slice(-2)).toEqual(['--', component.name]);
  });

  test('reports a CLI that could not be started as an error', async () => {
    writeConfig({ components: {} });
    spawnSyncMock.mockReturnValue({ status: null, stdout: null, stderr: null, error: new Error('spawn npx ENOENT') });
    const result = await call('apply_upgrade', { projectPath: tmp });
    expect(result.isError).toBe(true);
    expect(json(result)).toMatchObject({ success: false, exitCode: -1, error: 'spawn npx ENOENT', components: 'all installed' });
  });

  test('reports a CLI that exits non-zero as an error', async () => {
    writeConfig({ components: {} });
    spawnSyncMock.mockReturnValue({ status: 3, stdout: '', stderr: 'boom' });
    const result = await call('apply_upgrade', { projectPath: tmp });
    expect(result.isError).toBe(true);
    expect(json(result)).toMatchObject({ success: false, exitCode: 3, stderr: 'boom' });
  });

  test('a successful run is not an error', async () => {
    writeConfig({ components: {} });
    spawnSyncMock.mockReturnValue({ status: 0, stdout: 'done', stderr: '' });
    const result = await call('apply_upgrade', { projectPath: tmp });
    expect(result.isError).toBeUndefined();
    expect(json(result)).toMatchObject({ success: true, exitCode: 0, stdout: 'done' });
  });
});

describe('readConsumerConfig', () => {
  test('throws for a missing projectPath or buildpad.json', () => {
    expect(() => readConsumerConfig(undefined)).toThrow('projectPath is required');
    expect(() => readConsumerConfig(tmp)).toThrow('buildpad.json not found');
  });
});
