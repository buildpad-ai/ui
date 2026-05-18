/**
 * scripts/build-registry.mjs tests
 *
 * Only tests pure helpers (no git / FS exercise). The heavy lift is verified
 * by `pnpm build:registry` in CI.
 */

import { describe, expect, test } from 'vitest';
// @ts-expect-error — pure ESM helper file lives outside the TS project
import { extractSemverFromTag } from '../../../scripts/build-registry.mjs';

describe('extractSemverFromTag', () => {
  test('extracts bare semver tags', () => {
    expect(extractSemverFromTag('1.4.2')).toBe('1.4.2');
  });

  test('strips a "v" prefix', () => {
    expect(extractSemverFromTag('v1.4.2')).toBe('1.4.2');
  });

  test('extracts from a changesets-style tag', () => {
    expect(extractSemverFromTag('@buildpad/ui-interfaces@1.4.2')).toBe('1.4.2');
  });

  test('extracts from arbitrary release prefixes', () => {
    expect(extractSemverFromTag('release-2024-1.4.2')).toBe('1.4.2');
  });

  test('returns undefined when no semver is present', () => {
    expect(extractSemverFromTag('main')).toBeUndefined();
    expect(extractSemverFromTag('latest')).toBeUndefined();
  });

  test('returns undefined for empty / nullish input', () => {
    expect(extractSemverFromTag('')).toBeUndefined();
    // @ts-expect-error — runtime resilience check
    expect(extractSemverFromTag(undefined)).toBeUndefined();
  });
});
