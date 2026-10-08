/**
 * Helpers for the upgrade tools (list_outdated, get_upgrade_plan,
 * apply_upgrade).
 *
 * They read a consumer project's buildpad.json and its files on disk, and
 * compare them with the registry embedded in this server. They mirror what
 * the CLI's `upgrade` command does (packages/cli/src/commands/upgrade.ts) so
 * the plan an agent sees is the plan the CLI runs:
 *
 * - Components and lib modules are both checked. Lib modules (utils, services,
 *   hooks, ...) are recorded under `lib` / `installedLib`. Before this change
 *   the MCP looked only at `components`, so a stale lib module was never
 *   reported.
 * - Files are found on disk where the CLI writes them. That is under `src/`
 *   when `srcDir` is set. Component files also get their `.ts`/`.tsx`
 *   extension replaced by `.tsx` (or `.jsx` when `tsx` is off). Lib-module
 *   targets are used as written.
 * - apply_upgrade runs the CLI pinned to this server's own version. Under
 *   lockstep releases that CLI fetches the same registry this server embeds.
 * - Naming entries also brings what they depend on: the out-of-date ones are
 *   upgraded and the missing ones installed, as `buildpad upgrade <names>`
 *   does (packages/cli/src/utils/upgrade-plan.ts). The MCP works the list out
 *   itself and hands the CLI every name with `--no-deps`, so the names it
 *   checked (nothing newer than this server is moved backwards) are exactly
 *   the names the CLI touches.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { isAbsolute, join, relative, sep } from 'node:path';
import { hashTransformed, staleFilesOf, compareSemver } from './versioning.js';
import { registryFilesOf, type RegistryFile } from './sources.js';
import type { Registry } from './registry.js';

// ─── buildpad.json ───────────────────────────────────────────────

export interface InstalledFile {
  target: string;
  sha256?: string;
  sourceSha256?: string;
  state?: string;
}

export interface InstallRecord {
  release?: string;
  /** v1/v2 manifests recorded `version` instead of `release`. */
  version?: string;
  sourcePackage?: string;
  files?: InstalledFile[];
}

export interface ConsumerConfig {
  release?: string;
  srcDir?: boolean;
  tsx?: boolean;
  installedComponents?: string[];
  installedLib?: string[];
  components?: Record<string, InstallRecord>;
  lib?: Record<string, InstallRecord>;
}

/** Read `<projectPath>/buildpad.json`. Throws a clear error when it cannot. */
export function readConsumerConfig(projectPath: unknown): ConsumerConfig {
  if (!projectPath) throw new Error('projectPath is required');
  if (typeof projectPath !== 'string') throw new Error('projectPath must be a string');
  const configPath = join(projectPath, 'buildpad.json');
  if (!existsSync(configPath)) {
    throw new Error(
      `buildpad.json not found at: ${configPath}. ` +
      'Ensure projectPath points to a valid Buildpad consumer project.'
    );
  }
  try {
    return JSON.parse(readFileSync(configPath, 'utf-8')) as ConsumerConfig;
  } catch (err) {
    throw new Error(`buildpad.json at ${configPath} is not valid JSON: ${(err as Error).message}`);
  }
}

// ─── Installed entries ───────────────────────────────────────────

export type EntryKind = 'component' | 'lib';

export interface InstalledEntry {
  kind: EntryKind;
  name: string;
  /** The buildpad.json record; absent when the entry is listed but untracked. */
  record?: InstallRecord;
  registryFiles: RegistryFile[];
  internalDependencies: string[];
  sourcePackage?: string;
}

function namesOf(records: Record<string, InstallRecord> | undefined, listed: string[] | undefined): string[] {
  return [...new Set([...Object.keys(records ?? {}), ...(listed ?? [])])];
}

/**
 * Every installed component and lib module that the registry still knows,
 * components first. An entry listed in `installedComponents`/`installedLib`
 * without a record is included as untracked; the CLI upgrades those too.
 */
export function installedEntries(config: ConsumerConfig, registry: Registry): InstalledEntry[] {
  const entries: InstalledEntry[] = [];
  for (const name of namesOf(config.components, config.installedComponents)) {
    const reg = registry.components.find(c => c.name === name);
    if (!reg) continue;
    entries.push({
      kind: 'component',
      name,
      record: config.components?.[name],
      registryFiles: reg.files,
      internalDependencies: reg.internalDependencies ?? [],
      sourcePackage: reg.sourcePackage,
    });
  }
  for (const name of namesOf(config.lib, config.installedLib)) {
    const mod = registry.lib?.[name];
    if (!mod) continue;
    entries.push({
      kind: 'lib',
      name,
      record: config.lib?.[name],
      registryFiles: registryFilesOf(mod),
      internalDependencies: mod.internalDependencies ?? [],
      sourcePackage: mod.sourcePackage,
    });
  }
  return entries;
}

export interface EntryStatus {
  kind: EntryKind;
  name: string;
  sourcePackage: string | null;
  installedRelease: string | null;
  /** The release of the registry this server embeds (what an upgrade installs). */
  latestRelease: string;
  staleFiles: Array<{ target: string; reason: string }>;
  /** Installed but with no buildpad.json record, so nothing can be compared. */
  untracked: boolean;
  isOutdated: boolean;
  /**
   * The entry was installed from a newer release than this server's registry.
   * Upgrading it with this server would move it backwards.
   */
  aheadOfRegistry: boolean;
}

export function entryStatus(entry: InstalledEntry, registryVersion: string): EntryStatus {
  const installedRelease = entry.record?.release ?? entry.record?.version ?? null;
  const untracked = !entry.record;
  const staleFiles = entry.record ? staleFilesOf({ files: entry.registryFiles }, entry.record) : [];
  return {
    kind: entry.kind,
    name: entry.name,
    sourcePackage: entry.record?.sourcePackage ?? entry.sourcePackage ?? null,
    installedRelease,
    latestRelease: registryVersion,
    staleFiles,
    untracked,
    isOutdated: untracked || staleFiles.length > 0,
    aheadOfRegistry: isAhead(installedRelease, registryVersion),
  };
}

/** True when `release` is a newer semver than `registryVersion`. */
export function isAhead(release: string | null | undefined, registryVersion: string): boolean {
  return !!release && compareSemver(release, registryVersion) > 0;
}

/**
 * The lib modules `names` depend on, directly or through other lib modules.
 * Does not include `names` themselves unless a cycle leads back to them.
 */
export function libDependencyClosure(names: string[], registry: Registry): string[] {
  const seen = new Set<string>();
  const visit = (deps: string[] | undefined) => {
    for (const dep of deps ?? []) {
      if (seen.has(dep) || !registry.lib?.[dep]) continue;
      seen.add(dep);
      visit(registry.lib[dep].internalDependencies);
    }
  };
  for (const name of names) {
    const comp = registry.components.find(c => c.name === name);
    visit(comp ? comp.internalDependencies : registry.lib?.[name]?.internalDependencies);
  }
  return [...seen];
}

/**
 * Installed lib modules that `names` depend on (transitively) and that are
 * outdated.
 */
export function staleLibDependencies(
  names: string[],
  statuses: EntryStatus[],
  registry: Registry
): string[] {
  const closure = new Set(libDependencyClosure(names, registry));
  return statuses
    .filter(s => s.kind === 'lib' && s.isOutdated && closure.has(s.name) && !names.includes(s.name))
    .map(s => s.name);
}

/** A registry entry by kind and name. */
export interface EntryName {
  kind: EntryKind;
  name: string;
}

const sameEntry = (a: EntryName, b: EntryName) => a.kind === b.kind && a.name === b.name;

/** The kind the CLI gives a name: a lib module when the registry has one, otherwise a component. */
export function entryNameOf(name: string, registry: Registry): EntryName | undefined {
  if (registry.lib?.[name]) return { kind: 'lib', name };
  if (registry.components.some(c => c.name === name)) return { kind: 'component', name };
  return undefined;
}

/**
 * Everything `names` depend on, directly or through other entries, of both
 * kinds: `internalDependencies` name lib modules, `registryDependencies` name
 * components. Breadth-first from `names`, which are not listed themselves.
 * The same walk as the CLI's planDependencies.
 */
export function dependencyClosure(names: string[], registry: Registry): EntryName[] {
  const targets = names.map(n => entryNameOf(n, registry)).filter((e): e is EntryName => !!e);
  const seen: EntryName[] = [...targets];
  for (let i = 0; i < seen.length; i++) {
    const entry = seen[i];
    const source = entry.kind === 'component'
      ? registry.components.find(c => c.name === entry.name)
      : registry.lib?.[entry.name];
    const deps: EntryName[] = [
      ...(source?.internalDependencies ?? [])
        .filter(name => !!registry.lib?.[name])
        .map((name): EntryName => ({ kind: 'lib', name })),
      ...(source?.registryDependencies ?? [])
        .filter(name => registry.components.some(c => c.name === name))
        .map((name): EntryName => ({ kind: 'component', name })),
    ];
    for (const dep of deps) if (!seen.some(e => sameEntry(e, dep))) seen.push(dep);
  }
  return seen.slice(targets.length);
}

export interface DependencyNames {
  /** Installed and outdated: upgraded with the named entries. */
  stale: EntryName[];
  /** Not installed: installed with the named entries. */
  missing: EntryName[];
}

/**
 * What upgrading `names` brings along: the installed, outdated entries they
 * depend on, and the ones the project does not have. `statuses` holds every
 * installed entry.
 */
export function dependenciesToBring(names: string[], statuses: EntryStatus[], registry: Registry): DependencyNames {
  const stale: EntryName[] = [];
  const missing: EntryName[] = [];
  for (const dep of dependencyClosure(names, registry)) {
    const status = statuses.find(s => sameEntry(s, dep));
    if (!status) missing.push(dep);
    else if (status.isOutdated) stale.push(dep);
  }
  return { stale, missing };
}

// ─── Files on disk ───────────────────────────────────────────────

/**
 * Where the CLI wrote a recorded file. Matches packages/cli add.ts / upgrade.ts:
 * `srcDir` puts files under `src/`. Component files get `.ts`/`.tsx` replaced
 * by `.tsx` (`.jsx` when `tsx` is false). Lib targets are literal.
 */
export function diskPathOf(projectPath: string, config: ConsumerConfig, kind: EntryKind, target: string): string {
  const fileRoot = config.srcDir ? join(projectPath, 'src') : projectPath;
  const path = join(fileRoot, target);
  if (kind === 'lib') return path;
  return path.replace(/\.tsx?$/, config.tsx ? '.tsx' : '.jsx');
}

/**
 * - `pristine`: matches the hash recorded at install.
 * - `modified`: differs from it (local edits).
 * - `missing`: not on disk.
 * - `untracked`: on disk, but buildpad.json has no install hash for it. The
 *   CLI cannot tell edits from the original, and its upgrade overwrites such
 *   files whatever the strategy.
 * - `invalid-target`: the recorded target resolves outside the project root,
 *   or something other than a regular file is at its path. It is not read.
 */
export type FileStatus = 'pristine' | 'modified' | 'missing' | 'untracked' | 'invalid-target';

/** True when `diskPath` is the project root itself or lies outside it. */
function outsideProject(projectPath: string, diskPath: string): boolean {
  const rel = relative(projectPath, diskPath);
  return rel === '' || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel);
}

/**
 * The on-disk status of each file of an entry: the recorded files, or for an
 * entry with no record, the files the registry lists.
 */
export function fileStatuses(
  projectPath: string,
  config: ConsumerConfig,
  entry: InstalledEntry
): Array<{ target: string; path: string; status: FileStatus }> {
  const files: InstalledFile[] = entry.record ? entry.record.files ?? [] : entry.registryFiles;
  return files.map(f => {
    const diskPath = diskPathOf(projectPath, config, entry.kind, f.target);
    const path = relative(projectPath, diskPath).split('\\').join('/');
    // buildpad.json is input: never read, or hash, a file it points at
    // outside the project.
    if (outsideProject(projectPath, diskPath)) return { target: f.target, path, status: 'invalid-target' as const };
    const stat = statSync(diskPath, { throwIfNoEntry: false });
    if (!stat) return { target: f.target, path, status: 'missing' as const };
    if (!stat.isFile()) return { target: f.target, path, status: 'invalid-target' as const };
    if (!f.sha256) return { target: f.target, path, status: 'untracked' as const };
    const diskHash = hashTransformed(readFileSync(diskPath, 'utf-8'));
    return { target: f.target, path, status: diskHash === f.sha256 ? 'pristine' as const : 'modified' as const };
  });
}

/**
 * What an agent should do about one entry in an upgrade plan:
 * - `update-mcp`: installed from a newer release than this server knows.
 * - `up-to-date`: nothing to do.
 * - `review-invalid-targets`: a recorded target is outside the project or is
 *   not a regular file; fix buildpad.json or the file before upgrading.
 * - `overwrite-untracked`: files are on disk with no install hash; the CLI
 *   will overwrite them, so back up any local edits first.
 * - `prompt-or-three-way`: local edits; pick a strategy.
 * - `safe-overwrite`: nothing local to lose.
 */
export function recommendedAction(
  status: EntryStatus,
  files: Array<{ status: FileStatus }>
):
  | 'update-mcp'
  | 'up-to-date'
  | 'review-invalid-targets'
  | 'overwrite-untracked'
  | 'prompt-or-three-way'
  | 'safe-overwrite' {
  if (status.aheadOfRegistry) return 'update-mcp';
  if (!status.isOutdated) return 'up-to-date';
  if (files.some(f => f.status === 'invalid-target')) return 'review-invalid-targets';
  if (files.some(f => f.status === 'untracked')) return 'overwrite-untracked';
  if (files.some(f => f.status === 'modified')) return 'prompt-or-three-way';
  return 'safe-overwrite';
}

// ─── apply_upgrade ───────────────────────────────────────────────

/**
 * The CLI's non-interactive `--strategy` values. The CLI also accepts
 * `prompt`, but that asks questions on a TTY. The MCP runs the CLI with no
 * terminal, so `prompt` would wait until the timeout.
 */
export const UPGRADE_STRATEGIES = ['overwrite', 'new-file', 'three-way'] as const;
export type UpgradeStrategy = (typeof UPGRADE_STRATEGIES)[number];

/** Component and lib-module names: lowercase kebab-case, never starting with `-`. */
export const ENTRY_NAME_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

export interface ApplyUpgradeInput {
  projectPath: string;
  components: string[];
  strategy: UpgradeStrategy;
  /** Also upgrade the outdated entries the targets depend on, and install the missing ones. */
  includeDependencies: boolean;
}

/**
 * Validate apply_upgrade's arguments before anything reaches a command line.
 * Throws on the first problem.
 */
export function validateApplyUpgradeArgs(args: unknown): ApplyUpgradeInput {
  const a = (args ?? {}) as Record<string, unknown>;

  const projectPath = a.projectPath;
  if (!projectPath) throw new Error('projectPath is required');
  if (typeof projectPath !== 'string' || !isAbsolute(projectPath)) {
    throw new Error('projectPath must be an absolute path to the consumer project root');
  }

  const strategy = a.strategy ?? 'new-file';
  if (typeof strategy !== 'string' || !(UPGRADE_STRATEGIES as readonly string[]).includes(strategy)) {
    const extra = strategy === 'prompt'
      ? ' "prompt" is interactive and cannot be answered through MCP.'
      : '';
    throw new Error(
      `Invalid strategy ${JSON.stringify(strategy)}. Use one of: ${UPGRADE_STRATEGIES.join(', ')}.${extra}`
    );
  }

  const raw = a.components ?? [];
  if (!Array.isArray(raw)) throw new Error('components must be an array of component or lib-module names');
  for (const name of raw) {
    if (typeof name !== 'string' || !ENTRY_NAME_PATTERN.test(name)) {
      throw new Error(
        `Invalid component name ${JSON.stringify(name)}: names are lowercase letters, digits and dashes, ` +
        'and cannot start with a dash.'
      );
    }
  }

  // `includeLibDependencies` is the name this option had while it covered lib
  // modules only; it is still accepted.
  for (const key of ['includeDependencies', 'includeLibDependencies'] as const) {
    if (a[key] !== undefined && typeof a[key] !== 'boolean') throw new Error(`${key} must be a boolean`);
  }
  const includeDependencies = (a.includeDependencies ?? a.includeLibDependencies ?? true) as boolean;

  return {
    projectPath,
    components: [...new Set(raw as string[])],
    strategy: strategy as UpgradeStrategy,
    includeDependencies,
  };
}

/** A plain release version, as published to npm. */
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

/**
 * The `npx` arguments that run `buildpad upgrade` with the CLI release this
 * server belongs to. Names go after `--`, so commander reads them as names
 * even if one looked like a flag. With no names, `--all` upgrades every
 * installed component and lib module. `noDeps` passes `--no-deps`: the CLI
 * then touches the given names only (see the module note).
 */
export function buildUpgradeCommand(options: {
  cliVersion: string;
  projectPath: string;
  strategy: UpgradeStrategy;
  names: string[];
  noDeps?: boolean;
}): { command: 'npx'; args: string[] } {
  const { cliVersion, projectPath, strategy, names, noDeps = false } = options;
  if (!VERSION_PATTERN.test(cliVersion)) {
    throw new Error(`Cannot pin @buildpad/cli: ${JSON.stringify(cliVersion)} is not a release version`);
  }
  const args = ['--yes', `@buildpad/cli@${cliVersion}`, 'upgrade', '--cwd', projectPath, '--strategy', strategy];
  if (noDeps) args.push('--no-deps');
  if (names.length > 0) args.push('--', ...names);
  else args.push('--all');
  return { command: 'npx', args };
}
