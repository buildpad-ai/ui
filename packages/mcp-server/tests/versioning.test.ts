import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  stripOriginHeader,
  hashTransformed,
  compareSemver,
  staleFilesOf,
  changelogSince,
  fetchChangelogContent,
} from '../src/versioning.js';

describe('stripOriginHeader', () => {
  test('removes the @buildpad-origin JSDoc header', () => {
    const content = `/**\n * @buildpad-origin ui-interfaces/src/demo/Demo.tsx@2.0.0\n */\nexport const x = 1;\n`;
    expect(stripOriginHeader(content)).toBe('export const x = 1;\n');
  });

  test('preserves a leading "use client" directive', () => {
    const content = `'use client';\n/**\n * @buildpad-origin foo@1.0.0\n */\nexport const x = 1;\n`;
    expect(stripOriginHeader(content)).toBe(`'use client';\nexport const x = 1;\n`);
  });

  test('leaves content without an origin header untouched', () => {
    const content = 'export const x = 1;\n';
    expect(stripOriginHeader(content)).toBe(content);
  });
});

describe('hashTransformed', () => {
  test('produces the same hash regardless of the origin header version', () => {
    const v1 = `/**\n * @buildpad-origin foo@1.0.0\n */\nexport const x = 1;\n`;
    const v2 = `/**\n * @buildpad-origin foo@2.0.0\n */\nexport const x = 1;\n`;
    expect(hashTransformed(v1)).toBe(hashTransformed(v2));
  });

  test('normalises CRLF and CR line endings to LF before hashing', () => {
    const lf = 'export const x = 1;\nexport const y = 2;\n';
    const crlf = 'export const x = 1;\r\nexport const y = 2;\r\n';
    const cr = 'export const x = 1;\rexport const y = 2;\r';
    expect(hashTransformed(crlf)).toBe(hashTransformed(lf));
    expect(hashTransformed(cr)).toBe(hashTransformed(lf));
  });

  test('is sensitive to actual content changes', () => {
    expect(hashTransformed('export const x = 1;\n')).not.toBe(hashTransformed('export const x = 2;\n'));
  });
});

describe('compareSemver', () => {
  test('orders by major, then minor, then patch', () => {
    expect(compareSemver('1.0.0', '2.0.0')).toBe(-1);
    expect(compareSemver('2.1.0', '2.0.0')).toBe(1);
    expect(compareSemver('2.0.1', '2.0.0')).toBe(1);
    expect(compareSemver('2.0.0', '2.0.0')).toBe(0);
  });

  test('strips leading non-numeric characters like ^ or ~', () => {
    expect(compareSemver('^1.2.0', '~1.1.0')).toBe(1);
  });
});

describe('staleFilesOf', () => {
  test('reports an "added" file present in the registry but not installed', () => {
    const result = staleFilesOf(
      { files: [{ target: 'a.ts', sourceSha256: 'x' }] },
      { files: [] },
    );
    expect(result).toEqual([{ target: 'a.ts', reason: 'added' }]);
  });

  test('reports a "pending" file left mid-merge by a previous upgrade', () => {
    const result = staleFilesOf(
      { files: [{ target: 'a.ts', sourceSha256: 'x' }] },
      { files: [{ target: 'a.ts', sourceSha256: 'x', state: 'pending' }] },
    );
    expect(result).toEqual([{ target: 'a.ts', reason: 'pending' }]);
  });

  test('reports "needs-migrate" for a pre-v3 record with no recorded hash', () => {
    const result = staleFilesOf(
      { files: [{ target: 'a.ts', sourceSha256: 'x' }] },
      { files: [{ target: 'a.ts' }] },
    );
    expect(result).toEqual([{ target: 'a.ts', reason: 'needs-migrate' }]);
  });

  test('reports "upstream-changed" when the registry hash differs from the recorded one', () => {
    const result = staleFilesOf(
      { files: [{ target: 'a.ts', sourceSha256: 'new' }] },
      { files: [{ target: 'a.ts', sourceSha256: 'old' }] },
    );
    expect(result).toEqual([{ target: 'a.ts', reason: 'upstream-changed' }]);
  });

  test('reports "removed" for a recorded file no longer in the registry', () => {
    const result = staleFilesOf(
      { files: [] },
      { files: [{ target: 'a.ts', sourceSha256: 'x' }] },
    );
    expect(result).toEqual([{ target: 'a.ts', reason: 'removed' }]);
  });

  test('reports nothing for a matching, up-to-date file', () => {
    const result = staleFilesOf(
      { files: [{ target: 'a.ts', sourceSha256: 'x' }] },
      { files: [{ target: 'a.ts', sourceSha256: 'x' }] },
    );
    expect(result).toEqual([]);
  });
});

describe('fetchChangelogContent', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('fetches an absolute URL as-is and returns its body', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, text: async () => 'CHANGELOG BODY' }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchChangelogContent('https://example.test/CHANGELOG.md');

    expect(result).toBe('CHANGELOG BODY');
    expect(fetchMock).toHaveBeenCalledWith('https://example.test/CHANGELOG.md', expect.anything());
  });

  test('prefixes a relative path with the raw GitHub base URL', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, text: async () => 'BODY' }));
    vi.stubGlobal('fetch', fetchMock);

    await fetchChangelogContent('ui-interfaces/CHANGELOG.md');

    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain('ui-interfaces/CHANGELOG.md');
    expect(calledUrl.startsWith('http')).toBe(true);
  });

  test('returns null when the response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, text: async () => '' })));
    expect(await fetchChangelogContent('https://example.test/missing.md')).toBeNull();
  });

  test('returns null when the fetch itself throws', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down'); }));
    expect(await fetchChangelogContent('https://example.test/x.md')).toBeNull();
  });
});

describe('changelogSince', () => {
  const CHANGELOG = [
    '## 2.1.0',
    '- newest change',
    '',
    '## 2.0.0',
    '- older change',
    '',
    '## 1.0.0',
    '- oldest change',
  ].join('\n');

  test('returns the full trimmed content when no version is given', () => {
    expect(changelogSince(CHANGELOG)).toBe(CHANGELOG);
  });

  test('returns only sections newer than the given version', () => {
    const result = changelogSince(CHANGELOG, '2.0.0');
    expect(result).toContain('## 2.1.0');
    expect(result).not.toContain('## 2.0.0');
    expect(result).not.toContain('## 1.0.0');
  });

  test('returns an empty string when nothing is newer than the given version', () => {
    expect(changelogSince(CHANGELOG, '2.1.0')).toBe('');
  });
});
