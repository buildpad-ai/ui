/**
 * Build step: copy every source file the registry references into
 * `dist/sources/<source>` and prove the copies match the registry.
 *
 * Called from tsup.config.ts `onSuccess`. It reads the same registry.json that
 * the build embeds, so the published package carries the exact bytes its
 * own metadata describes. Each copied file is hashed the way the registry
 * hashes it (SHA-256 over LF-normalised text) and compared with
 * `sourceSha256`. Any missing file, missing hash or mismatch fails the build:
 * a stale registry.json (for example after `pnpm --filter @buildpad/mcp build`
 * without `pnpm build:registry`) must not ship.
 *
 * Not imported by the server itself, so it is not part of dist/index.js.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, normalize, sep } from 'node:path';
import { hashSource, registryFilesOf, type RegistryFile } from './sources.js';

/** The registry fields this step reads. */
export interface BundleRegistry {
  components?: Array<{ name: string; files?: RegistryFile[] }>;
  lib?: Record<string, { files?: RegistryFile[]; path?: string; target?: string; sourceSha256?: string }>;
}

export interface BundleSourcesOptions {
  registry: BundleRegistry;
  /** The monorepo `packages/` directory that registry `source` paths are relative to. */
  packagesRoot: string;
  /** Output directory, normally `dist/sources`. Emptied first. */
  outDir: string;
}

export interface BundleSourcesResult {
  files: number;
  bytes: number;
}

/** Thrown when the bundle does not match the registry. Lists every problem. */
export class SourceBundleError extends Error {
  readonly problems: string[];

  constructor(problems: string[]) {
    const shown = problems.slice(0, 25).map(p => `  - ${p}`).join('\n');
    const more = problems.length > 25 ? `\n  ...and ${problems.length - 25} more` : '';
    super(
      `dist/sources does not match registry.json (${problems.length} problem(s)):\n${shown}${more}\n` +
      'Run `pnpm build:registry` and rebuild. If a source changed, regenerate packages/registry.json.'
    );
    this.name = 'SourceBundleError';
    this.problems = problems;
  }
}

/**
 * Every source path the registry references, with its expected hash. The
 * same source can appear in more than one entry; it must then carry the
 * same hash everywhere.
 */
export function collectRegistrySources(registry: BundleRegistry): {
  sources: Map<string, string | undefined>;
  problems: string[];
} {
  const sources = new Map<string, string | undefined>();
  const problems: string[] = [];
  const entries: Array<{ label: string; files: RegistryFile[] }> = [
    ...(registry.components ?? []).map(c => ({ label: `component ${c.name}`, files: c.files ?? [] })),
    ...Object.entries(registry.lib ?? {}).map(([name, mod]) => ({ label: `lib ${name}`, files: registryFilesOf(mod) })),
  ];
  for (const { label, files } of entries) {
    for (const file of files) {
      if (!sources.has(file.source)) {
        sources.set(file.source, file.sourceSha256);
      } else if (sources.get(file.source) !== file.sourceSha256) {
        problems.push(`${file.source}: ${label} records a different sourceSha256 than another entry`);
      }
    }
  }
  return { sources, problems };
}

/** A registry source path that stays inside the packages root. */
function isSafeSourcePath(source: string): boolean {
  if (!source || isAbsolute(source)) return false;
  const norm = normalize(source);
  return norm !== '..' && !norm.startsWith(`..${sep}`) && !norm.startsWith('../');
}

export function bundleRegistrySources(options: BundleSourcesOptions): BundleSourcesResult {
  const { registry, packagesRoot, outDir } = options;
  const { sources, problems } = collectRegistrySources(registry);

  rmSync(outDir, { recursive: true, force: true });

  let bytes = 0;
  for (const [source, expected] of sources) {
    if (!isSafeSourcePath(source)) {
      problems.push(`${source}: not a relative path inside packages/`);
      continue;
    }
    const from = join(packagesRoot, source);
    if (!existsSync(from) || !statSync(from).isFile()) {
      problems.push(`${source}: referenced by the registry but not found at ${from}`);
      continue;
    }
    if (!expected) {
      problems.push(`${source}: the registry records no sourceSha256, so the copy cannot be verified`);
      continue;
    }
    const to = join(outDir, source);
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(from, to);
    // Verify what was written, not what was read: the copy is what ships.
    const copied = readFileSync(to, 'utf-8');
    const actual = hashSource(copied);
    if (actual !== expected) {
      problems.push(
        `${source}: sha256 ${actual.slice(0, 12)}… does not match the registry's ${expected.slice(0, 12)}…`
      );
      continue;
    }
    bytes += statSync(to).size;
  }

  if (problems.length > 0) {
    // Leave no partial bundle behind for a later pack to pick up.
    rmSync(outDir, { recursive: true, force: true });
    throw new SourceBundleError(problems);
  }

  return { files: sources.size, bytes };
}
