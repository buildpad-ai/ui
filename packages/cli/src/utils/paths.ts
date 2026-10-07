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

/** The directories `add` installed into before buildpad.json recorded per-file targets. */
const LEGACY_ROOTS = ['components', 'lib/buildpad'];

/**
 * The top-level root of a recorded target, or undefined unless the target is a
 * plain relative path inside the source root. buildpad.json is committed and
 * hand-editable, and validate scans — fix rewrites — every file under these
 * roots, so a target such as '../x', '/x', './x', '**\/x' or 'C:/x' must never
 * widen the scan beyond the project.
 */
function targetRoot(target: unknown): string | undefined {
  if (typeof target !== 'string' || target.includes('\\')) return undefined;
  const segments = target.split('/');
  if (segments.some(s => s === '' || s === '.' || s === '..')) return undefined;
  // A plain file or directory name: no glob syntax, no drive letter.
  return /^[A-Za-z0-9_][A-Za-z0-9_.-]*$/.test(segments[0]) ? segments[0] : undefined;
}

function recordedTargets(config: Pick<Config, 'components' | 'lib'>): unknown[] {
  return [...Object.values(config.components ?? {}), ...Object.values(config.lib ?? {})].flatMap(record =>
    (record.files ?? []).map(f => f.target),
  );
}

/** Recorded targets `installedTargetRoots` ignores because they could reach outside the source root. */
export function unsafeRecordedTargets(config: Pick<Config, 'components' | 'lib'>): string[] {
  return recordedTargets(config)
    .filter(target => targetRoot(target) === undefined)
    .map(target => String(target));
}

/**
 * Top-level roots (relative to the source root, `/`-separated) that hold
 * installed files: the first directory of every recorded target — `app`,
 * `components`, `lib`, `types`, … — or the file itself for a top-level target
 * such as `middleware.ts`. Always includes the legacy component/lib roots.
 * Targets listed by `unsafeRecordedTargets` contribute nothing.
 */
export function installedTargetRoots(config: Pick<Config, 'components' | 'lib'>): string[] {
  const roots = new Set(LEGACY_ROOTS);
  for (const target of recordedTargets(config)) {
    const root = targetRoot(target);
    if (root) roots.add(root);
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

/** Whether `file` is strictly inside `dir` (both absolute). */
export function isInsideDir(dir: string, file: string): boolean {
  const rel = path.relative(dir, file);
  return rel !== '' && rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel);
}
