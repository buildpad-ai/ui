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
