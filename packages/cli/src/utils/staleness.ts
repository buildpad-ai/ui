/**
 * Hash-based staleness (manifest v3).
 *
 * Staleness used to be a semver comparison: `installed.version >= component.
 * lastChangedIn`. That made correctness depend on `lastChangedIn`, which the
 * registry build derives from full git history plus the tags present at build
 * time — so a missing tag, a shallow clone, or a release-PR step performed in
 * the wrong order silently produced wrong answers, and every upgrade bug in
 * docs/PUBLISHING.md was a bug in that path.
 *
 * v3 compares content instead. The registry has always recorded each file's
 * `sourceSha256`; the manifest now records the same hash at install time. A
 * file is stale when the two differ. Nothing here reads a version, a tag, or
 * git history, so the same inputs give the same answer on any machine on any
 * day — including a registry built with no git history at all.
 *
 * `lastChangedIn` stays in the registry as display data only.
 */

import type { ComponentInstall, FileChecksum } from '../commands/init.js';

/** Why a single file is out of sync with the registry. */
export type FileStaleReason =
  /** The registry's source hash differs from the one recorded at install. */
  | 'upstream-changed'
  /** The last upgrade did not write this file (skipped, or `.new` written). */
  | 'pending'
  /** The registry lists a file this install does not have. */
  | 'added'
  /** The install has a file the registry no longer lists. */
  | 'removed';

export interface StaleFile {
  target: string;
  /** Registry-relative source path; absent for `removed`. */
  source?: string;
  reason: FileStaleReason;
}

export interface EntryStaleness {
  /** True when at least one file is stale. */
  stale: boolean;
  /** Only the stale files, in registry order then removals. */
  files: StaleFile[];
  /**
   * True when the record predates v3 (no per-file `sourceSha256`), so hashes
   * cannot be compared. Callers surface a `migrate` hint rather than guessing.
   */
  needsMigrate: boolean;
  /** True when the component is installed but has no manifest record at all. */
  untracked: boolean;
}

/** The registry-side shape this module needs — components and lib modules both fit. */
export interface RegistryFileEntry {
  source: string;
  target: string;
  sourceSha256?: string;
}

const EMPTY: EntryStaleness = { stale: false, files: [], needsMigrate: false, untracked: false };

/**
 * Compare one installed component or lib module against the registry.
 *
 * A component is stale when any of its files is stale, when the registry adds
 * a file, or when the registry removes one.
 */
export function computeEntryStaleness(
  registryFiles: RegistryFileEntry[] | undefined,
  record: ComponentInstall | undefined
): EntryStaleness {
  if (!record) return { ...EMPTY, untracked: true };

  const files: StaleFile[] = [];
  const recorded = new Map<string, FileChecksum>();
  for (const f of record.files ?? []) recorded.set(f.target, f);

  let needsMigrate = false;

  for (const rf of registryFiles ?? []) {
    const installed = recorded.get(rf.target);
    if (!installed) {
      files.push({ target: rf.target, source: rf.source, reason: 'added' });
      continue;
    }
    if (installed.state === 'pending') {
      files.push({ target: rf.target, source: rf.source, reason: 'pending' });
      continue;
    }
    // A v2 record carries no upstream hash. Comparing against `undefined` would
    // mark every file stale on the first v3 run, so defer to `migrate` instead.
    if (!installed.sourceSha256) {
      needsMigrate = true;
      continue;
    }
    // A registry without hashes (v1) cannot answer the question either.
    if (!rf.sourceSha256) continue;
    if (installed.sourceSha256 !== rf.sourceSha256) {
      files.push({ target: rf.target, source: rf.source, reason: 'upstream-changed' });
    }
  }

  const registryTargets = new Set((registryFiles ?? []).map(f => f.target));
  for (const target of recorded.keys()) {
    if (!registryTargets.has(target)) {
      files.push({ target, reason: 'removed' });
    }
  }

  return { stale: files.length > 0, files, needsMigrate, untracked: false };
}

/**
 * Registry file entries for a component or lib module, including the
 * single-file `path`/`target` shape older lib modules still use.
 */
export function registryFilesOf(entry: {
  files?: RegistryFileEntry[];
  path?: string;
  target?: string;
  sourceSha256?: string;
}): RegistryFileEntry[] {
  const files = [...(entry.files ?? [])];
  if (entry.path && entry.target) {
    files.push({ source: entry.path, target: entry.target, sourceSha256: entry.sourceSha256 });
  }
  return files;
}
