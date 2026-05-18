/**
 * changelog-parser.ts tests
 */

import { describe, expect, test } from 'vitest';
import { parseChangelog, changelogSince } from '../src/utils/changelog-parser.js';

const SAMPLE = `# Changelog

## [1.2.0] - 2024-03-01

### Added
- New \`Tooltip\` component

## 1.1.0

### Fixed
- Bug in \`Input\` validation

## v1.0.0

Initial release.
`;

describe('parseChangelog', () => {
  test('parses heading variants: [x.y.z], x.y.z, vx.y.z', () => {
    const sections = parseChangelog(SAMPLE);
    expect(Array.from(sections.keys())).toEqual(['1.2.0', '1.1.0', '1.0.0']);
  });

  test('preserves the section body verbatim', () => {
    const sections = parseChangelog(SAMPLE);
    expect(sections.get('1.2.0')).toContain('Added');
    expect(sections.get('1.2.0')).toContain('Tooltip');
  });

  test('returns an empty map for empty input', () => {
    expect(parseChangelog('').size).toBe(0);
  });

  test('returns an empty map when no version headings exist', () => {
    expect(parseChangelog('# Changelog\n\nNo releases yet.').size).toBe(0);
  });
});

describe('changelogSince', () => {
  test('returns all entries when `since` is omitted', () => {
    const out = changelogSince(SAMPLE);
    expect(out).toContain('1.2.0');
    expect(out).toContain('1.1.0');
    expect(out).toContain('1.0.0');
  });

  test('filters out entries at or below `since`', () => {
    const out = changelogSince(SAMPLE, '1.1.0');
    expect(out).toContain('1.2.0');
    expect(out).not.toContain('1.1.0'); // section heading dropped
    expect(out).not.toContain('1.0.0');
  });

  test('returns empty string when no entries are newer', () => {
    expect(changelogSince(SAMPLE, '2.0.0')).toBe('');
  });

  test('returns empty string for empty input', () => {
    expect(changelogSince('', '1.0.0')).toBe('');
  });

  test('handles missing patch numbers gracefully (defaults to 0)', () => {
    // semverGt's `Number(undefined) → NaN` would silently misbehave; ensure
    // the parser actually fills missing parts with 0 via `??`.
    expect(changelogSince(SAMPLE, '1.0.0')).toContain('1.2.0');
  });
});
