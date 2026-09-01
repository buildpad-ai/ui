/**
 * utils/staleness.ts — hash-based stale detection (Issue 7).
 *
 * The point of these tests is that NOTHING here depends on a version number,
 * a git tag, or `lastChangedIn`. Same inputs → same answer, on any machine, on
 * any day, including against a registry built with no git history at all.
 */

import { describe, expect, test } from 'vitest';
import { computeEntryStaleness, registryFilesOf } from '../src/utils/staleness.js';
import type { ComponentInstall } from '../src/commands/init.js';

const A = 'a'.repeat(64);
const B = 'b'.repeat(64);

const REG = [
  { source: 'ui/src/Input.tsx', target: 'components/ui/input.tsx', sourceSha256: A },
  { source: 'ui/src/Input.module.css', target: 'components/ui/input.module.css', sourceSha256: B },
];

function record(files: ComponentInstall['files']): ComponentInstall {
  return {
    release: '1.0.0',
    ref: 'v1.0.0',
    sourcePackage: '@buildpad/ui-interfaces',
    installedAt: '2026-01-01T00:00:00Z',
    files,
  };
}

const CLEAN = record([
  { target: 'components/ui/input.tsx', sourceSha256: A, sha256: 'x', ref: 'v1.0.0', state: 'clean' },
  { target: 'components/ui/input.module.css', sourceSha256: B, sha256: 'y', ref: 'v1.0.0', state: 'clean' },
]);

describe('computeEntryStaleness', () => {
  test('matching upstream hashes are not stale', () => {
    const r = computeEntryStaleness(REG, CLEAN);
    expect(r.stale).toBe(false);
    expect(r.files).toEqual([]);
  });

  test('a changed upstream hash is stale, and names only that file', () => {
    const reg = [{ ...REG[0], sourceSha256: 'c'.repeat(64) }, REG[1]];
    const r = computeEntryStaleness(reg, CLEAN);
    expect(r.stale).toBe(true);
    expect(r.files).toEqual([
      { target: 'components/ui/input.tsx', source: 'ui/src/Input.tsx', reason: 'upstream-changed' },
    ]);
  });

  test('a pending file is stale even when its upstream hash matches', () => {
    // Issue 3: a file the last upgrade did not write must keep reporting.
    const rec = record([
      { ...CLEAN.files[0], state: 'pending' },
      CLEAN.files[1],
    ]);
    const r = computeEntryStaleness(REG, rec);
    expect(r.stale).toBe(true);
    expect(r.files[0].reason).toBe('pending');
  });

  test('a file added upstream is stale', () => {
    const reg = [...REG, { source: 'ui/src/new.ts', target: 'components/ui/new.ts', sourceSha256: A }];
    const r = computeEntryStaleness(reg, CLEAN);
    expect(r.files).toEqual([
      { target: 'components/ui/new.ts', source: 'ui/src/new.ts', reason: 'added' },
    ]);
  });

  test('a file removed upstream is stale', () => {
    const r = computeEntryStaleness([REG[0]], CLEAN);
    expect(r.files).toEqual([{ target: 'components/ui/input.module.css', reason: 'removed' }]);
  });

  test('a v2 record (no upstream hashes) reports needsMigrate, not staleness', () => {
    // Comparing a recorded `undefined` against a real hash would mark every
    // file stale on the first v3 run and drown the report.
    const rec = record([
      { target: 'components/ui/input.tsx', sha256: 'x' },
      { target: 'components/ui/input.module.css', sha256: 'y' },
    ]);
    const r = computeEntryStaleness(REG, rec);
    expect(r.stale).toBe(false);
    expect(r.needsMigrate).toBe(true);
  });

  test('no record at all is untracked, not stale', () => {
    const r = computeEntryStaleness(REG, undefined);
    expect(r).toEqual({ stale: false, files: [], needsMigrate: false, untracked: true });
  });

  test('a registry without file hashes cannot decide, so reports nothing', () => {
    const reg = REG.map(({ source, target }) => ({ source, target }));
    expect(computeEntryStaleness(reg, CLEAN).stale).toBe(false);
  });

  test('the verdict ignores release numbers entirely', () => {
    // The same record judged against the same file hashes is not stale no
    // matter what release it claims to be at — this is what makes a lockstep
    // bump with byte-identical files silent.
    for (const release of ['0.0.1', '1.0.0', '99.0.0']) {
      expect(computeEntryStaleness(REG, { ...CLEAN, release }).stale).toBe(false);
    }
  });
});

describe('registryFilesOf', () => {
  test('returns the files array for a multi-file entry', () => {
    expect(registryFilesOf({ files: REG })).toEqual(REG);
  });

  test('folds the single-file path/target shape into the same list', () => {
    // Older lib modules use `path` + `target` instead of `files`.
    expect(
      registryFilesOf({ path: 'utils/src/index.ts', target: 'lib/buildpad/utils.ts', sourceSha256: A })
    ).toEqual([
      { source: 'utils/src/index.ts', target: 'lib/buildpad/utils.ts', sourceSha256: A },
    ]);
  });

  test('an entry with neither is an empty list, not a crash', () => {
    expect(registryFilesOf({})).toEqual([]);
  });
});
