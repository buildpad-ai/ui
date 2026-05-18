/**
 * three-way-merge.ts
 *
 * Wraps the `node-diff3` package to perform a three-way merge between:
 *   - `ours`   — the consumer's locally-modified version of the file
 *   - `base`   — the original version that was copied (from the registry at install time)
 *   - `theirs` — the new upstream version from the registry
 *
 * On a clean merge (no conflicts), the merged text is returned.
 * On conflicts, the raw diff3 output with conflict markers is returned so the
 * caller can write a `.new` file and let the user resolve manually.
 */

import { diff3Merge } from 'node-diff3';

export interface MergeResult {
  /** True when all hunks merged cleanly with no conflicts. */
  ok: boolean;
  /** The merged text (may contain conflict markers if ok === false). */
  text: string;
}

/**
 * Normalise CRLF / CR to LF so the three sides hash and split identically.
 * Without this, a Windows-edited "ours" against an LF "base" and "theirs"
 * would conflict on every line.
 */
function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/**
 * Perform a three-way merge.
 *
 * @param ours   - Consumer's locally-modified file content
 * @param base   - The original (base) file content that was copied
 * @param theirs - The new upstream file content from the registry
 * @returns      MergeResult with ok flag and merged text
 */
export function threeWayMerge(ours: string, base: string, theirs: string): MergeResult {
  const oursLines = normalizeLineEndings(ours).split('\n');
  const baseLines = normalizeLineEndings(base).split('\n');
  const theirsLines = normalizeLineEndings(theirs).split('\n');

  // node-diff3 returns regions of two shapes:
  //   { ok: string[] }                                      — all three sides agree
  //   { conflict: { a: string[], o: string[], b: string[] } } — conflict
  // (Earlier code looked for `stable` which never exists, sending every
  // region down the conflict path and crashing on `region.conflict.a`.)
  type OkRegion       = { ok: string[] };
  type ConflictRegion = { conflict: { a: string[]; o: string[]; b: string[] } };
  type Region = OkRegion | ConflictRegion;

  const regions = diff3Merge(oursLines, baseLines, theirsLines) as Region[];

  let hasConflicts = false;
  const outputLines: string[] = [];

  for (const region of regions) {
    if ('ok' in region) {
      outputLines.push(...region.ok);
      continue;
    }
    hasConflicts = true;
    // Standard git-style markers — using "HEAD" rather than parenthetical
    // labels so common merge tools (VS Code, IntelliJ, etc.) recognise them.
    outputLines.push('<<<<<<< HEAD');
    outputLines.push(...region.conflict.a);
    outputLines.push('|||||||');
    outputLines.push(...region.conflict.o);
    outputLines.push('=======');
    outputLines.push(...region.conflict.b);
    outputLines.push('>>>>>>> upstream');
  }

  return {
    ok: !hasConflicts,
    text: outputLines.join('\n'),
  };
}
