/**
 * Where registry targets live in a consumer project. One definition, so the
 * code that writes a file and the code that later checks it agree — they did
 * not, and `add` overwrote edited files it had judged "missing".
 */

import path from 'node:path';
import type { Config } from '../commands/init.js';

/** The directory registry targets are relative to: `<cwd>/src` with `srcDir`, else `<cwd>`. */
export function sourceRoot(cwd: string, config: Pick<Config, 'srcDir'>): string {
  return config.srcDir ? path.join(cwd, 'src') : cwd;
}

/**
 * Where `add` and `upgrade` write a COMPONENT file: its target under the
 * source root, with a `.ts`/`.tsx` extension replaced by the project's script
 * extension (`.tsx`, or `.jsx` when `tsx` is false). The manifest keeps the
 * registry target. Lib-module targets are written literally:
 * `path.join(sourceRoot(cwd, config), target)`.
 */
export function componentFilePath(cwd: string, config: Pick<Config, 'srcDir' | 'tsx'>, target: string): string {
  return path.join(sourceRoot(cwd, config), target).replace(/\.tsx?$/, config.tsx ? '.tsx' : '.jsx');
}

/** Where `add`/`upgrade` write a recorded target, given the kind of entry that owns it. */
function installedFilePath(cwd: string, config: Pick<Config, 'srcDir' | 'tsx'>, kind: 'component' | 'lib', target: string): string {
  return kind === 'component' ? componentFilePath(cwd, config, target) : path.join(sourceRoot(cwd, config), target);
}

/**
 * Every file buildpad.json records as installed: absolute path on disk → the
 * registry target it was installed from (what the transformer was given).
 */
export function recordedInstalledFiles(
  cwd: string,
  config: Pick<Config, 'srcDir' | 'tsx' | 'components' | 'lib'>,
): Map<string, { target: string; kind: 'component' | 'lib' }> {
  const files = new Map<string, { target: string; kind: 'component' | 'lib' }>();
  for (const [kind, records] of [['component', config.components], ['lib', config.lib]] as const) {
    for (const record of Object.values(records ?? {})) {
      for (const f of record.files ?? []) {
        files.set(path.normalize(installedFilePath(cwd, config, kind, f.target)), { target: f.target, kind });
      }
    }
  }
  return files;
}

/** The directories `add` installed into before buildpad.json recorded per-file targets. */
const LEGACY_ROOTS = ['components', 'lib/buildpad'];

/**
 * Top-level roots (relative to the source root, `/`-separated) that hold
 * installed files: the first directory of every recorded target — `app`,
 * `components`, `lib`, `types`, … — or the file itself for a top-level target
 * such as `middleware.ts`. Always includes the legacy component/lib roots.
 */
export function installedTargetRoots(config: Pick<Config, 'components' | 'lib'>): string[] {
  const roots = new Set(LEGACY_ROOTS);
  for (const record of [...Object.values(config.components ?? {}), ...Object.values(config.lib ?? {})]) {
    for (const f of record.files ?? []) roots.add(f.target.split('/')[0]);
  }
  // Drop roots inside another root (lib/buildpad inside lib).
  return [...roots]
    .filter(r => ![...roots].some(o => o !== r && r.startsWith(`${o}/`)))
    .sort();
}

/** Glob patterns (relative to the source root) for the scripts under `installedTargetRoots`. */
export function installedScriptPatterns(config: Pick<Config, 'components' | 'lib'>): string[] {
  return installedTargetRoots(config).map(root =>
    /\.[cm]?[jt]sx?$/.test(root) ? root : `${root}/**/*.{ts,tsx,js,jsx,mts,cts}`,
  );
}
