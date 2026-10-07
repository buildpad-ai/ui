/**
 * Where the MCP server reads component and lib-module sources from.
 *
 * The npm package ships only `dist/` and the README. Until this module existed
 * the server joined registry `source` paths onto `dist/../..`, which under npm
 * is `node_modules/@buildpad/`. Nothing lives there, so every source-returning
 * tool came back empty for every npx user. Worse, any sibling
 * `node_modules/@buildpad/<pkg>/src/...` would have been served silently.
 *
 * Sources now come from exactly one root, picked once at startup:
 *
 * 1. **local**: running from the monorepo checkout. Detected the same way as
 *    the CLI's resolver (packages/cli/src/resolver.ts `isLocalMode`): a
 *    `registry.json` two levels above the module's directory, so
 *    `packages/mcp-server/dist` resolves to `packages/`. A root that is inside
 *    a `node_modules` directory is never treated as local.
 * 2. **bundled**: `dist/sources/`, which the build fills with every file
 *    the embedded registry references and checks against the registry's
 *    `sourceSha256` (see bundle-sources.ts and tsup.config.ts).
 *
 * There is deliberately no fallback beyond these two, and no `index.*`
 * directory guessing. A registry `source` names one file; if that file is
 * not under the chosen root, callers report it as missing instead of
 * returning empty data.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';

/** One file mapping from the registry, for a component or a lib module. */
export interface RegistryFile {
  source: string;
  target: string;
  sourceSha256?: string;
}

/**
 * The file entries of a component or lib module. Includes the single-file
 * `path`/`target` shape that older lib modules used. Mirrors `registryFilesOf`
 * in packages/cli/src/utils/staleness.ts.
 */
export function registryFilesOf(entry: {
  files?: RegistryFile[];
  path?: string;
  target?: string;
  sourceSha256?: string;
}): RegistryFile[] {
  const files = [...(entry.files ?? [])];
  if (entry.path && entry.target) {
    files.push({ source: entry.path, target: entry.target, sourceSha256: entry.sourceSha256 });
  }
  return files;
}

/**
 * SHA-256 of a source file with line endings normalised to LF. This is the
 * same hash that scripts/build-registry.mjs records as `sourceSha256` and that
 * the CLI checks in `verifySourceSha256`.
 */
export function hashSource(content: string): string {
  const normalised = content.replaceAll(/\r\n/g, '\n').replaceAll(/\r/g, '\n');
  return createHash('sha256').update(normalised).digest('hex');
}

export type SourceMode = 'local' | 'bundled';

export interface SourceRoot {
  mode: SourceMode;
  /** Absolute directory that registry `source` paths are relative to. */
  dir: string;
}

function isInsideNodeModules(dir: string): boolean {
  return dir.split(/[\\/]/).includes('node_modules');
}

/**
 * Pick the source root for a server whose code lives in `moduleDir`
 * (`dist/` when built, `src/` under vitest). Returns null when neither the
 * monorepo nor a bundled copy is present.
 */
export function detectSourceRoot(moduleDir: string): SourceRoot | null {
  const packagesRoot = resolve(moduleDir, '..', '..');
  if (existsSync(join(packagesRoot, 'registry.json')) && !isInsideNodeModules(packagesRoot)) {
    return { mode: 'local', dir: packagesRoot };
  }
  const bundled = resolve(moduleDir, 'sources');
  if (existsSync(bundled)) {
    return { mode: 'bundled', dir: bundled };
  }
  return null;
}

/** A registry file that could not be read from the source root. */
export interface MissingSource {
  source: string;
  target: string;
}

export interface ReadSourcesResult {
  found: Array<{ source: string; target: string; content: string }>;
  missing: MissingSource[];
}

export interface SourceResolver {
  /** The root this resolver reads from, or null when there is none. */
  readonly root: SourceRoot | null;
  /** Read one registry `source` path. Null when it is not under the root. */
  read(source: string): string | null;
  /** Read many registry files and report each one that is missing. */
  readFiles(files: ReadonlyArray<{ source: string; target: string }>): ReadSourcesResult;
  /** Where sources are read from, for error messages. */
  describe(): string;
}

/**
 * Resolve `source` under `dir`. Returns null for absolute paths and for paths
 * that climb out of the root with `..`.
 */
function resolveInside(dir: string, source: string): string | null {
  if (isAbsolute(source)) return null;
  const full = resolve(dir, source);
  const rel = relative(dir, full);
  if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) return null;
  return full;
}

export function createSourceResolver(root: SourceRoot | null): SourceResolver {
  const read = (source: string): string | null => {
    if (!root) return null;
    const full = resolveInside(root.dir, source);
    if (!full || !existsSync(full) || !statSync(full).isFile()) return null;
    return readFileSync(full, 'utf-8');
  };

  return {
    root,
    read,
    readFiles(files) {
      const result: ReadSourcesResult = { found: [], missing: [] };
      for (const file of files) {
        const content = read(file.source);
        if (content === null) {
          result.missing.push({ source: file.source, target: file.target });
        } else {
          result.found.push({ source: file.source, target: file.target, content });
        }
      }
      return result;
    },
    describe() {
      if (!root) return 'no source root (neither the monorepo packages/ directory nor a bundled dist/sources directory was found)';
      return root.mode === 'local'
        ? `the monorepo packages directory (${root.dir})`
        : `the sources bundled with @buildpad/mcp (${root.dir})`;
    },
  };
}
