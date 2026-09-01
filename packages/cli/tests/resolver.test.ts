/**
 * resolver.ts tests — focuses on the URL-building helpers used by
 * `upgrade --three-way` and the changelog fetcher. Network calls are not
 * exercised here.
 */

import { describe, expect, test } from 'vitest';
import {
  buildPackageTag,
  buildVersionedSourceUrl,
  encodeRef,
  getSourceRef,
  setSourceRef,
  CHANGELOG_BASE_URL,
} from '../src/resolver.js';

describe('buildPackageTag', () => {
  test('builds a changesets-style tag for scoped packages', () => {
    expect(buildPackageTag('@buildpad/ui-interfaces', '1.4.2'))
      .toBe('@buildpad/ui-interfaces@1.4.2');
  });

  test('works for unscoped packages too', () => {
    expect(buildPackageTag('foo', '0.0.1')).toBe('foo@0.0.1');
  });
});

describe('buildVersionedSourceUrl', () => {
  test('encodes the ref itself — callers pass it plain', () => {
    const url = buildVersionedSourceUrl('@buildpad/ui-interfaces@1.4.2', 'ui-interfaces/src/input/Input.tsx');
    expect(url).toContain('%40buildpad/ui-interfaces%401.4.2');
    expect(url).toContain('/packages/ui-interfaces/src/input/Input.tsx');
  });

  test('accepts a plain release tag', () => {
    const url = buildVersionedSourceUrl('v1.4.2', 'hooks/src/useAuth.ts');
    expect(url).toContain('/v1.4.2/packages/hooks/src/useAuth.ts');
  });

  test('leaves slashes in branch refs intact so they still resolve', () => {
    // encodeURIComponent would turn `feat/foo` into `feat%2Ffoo`, which the
    // raw CDN does not accept as a branch path.
    const url = buildVersionedSourceUrl('feat/foo', 'hooks/src/useAuth.ts');
    expect(url).toContain('/feat/foo/packages/hooks/src/useAuth.ts');
  });

  test('points at buildpad-ai/ui, not the old name behind a rename redirect', () => {
    expect(buildVersionedSourceUrl('v1.0.0', 'x.ts')).toContain('/buildpad-ai/ui/');
  });
});

describe('ref pinning', () => {
  test('defaults to the release tag matching this CLI version', () => {
    // In the monorepo the CLI reads packages/cli/package.json, so the default
    // ref tracks whatever version is about to ship.
    expect(getSourceRef()).toMatch(/^(v\d+\.\d+\.\d+|main)$/);
  });

  test('--ref overrides the pinned default', () => {
    const original = getSourceRef();
    try {
      setSourceRef('main');
      expect(getSourceRef()).toBe('main');
    } finally {
      setSourceRef(original);
    }
  });

  test('encodeRef escapes @ but preserves /', () => {
    expect(encodeRef('@buildpad/cli@1.0.0')).toBe('%40buildpad/cli%401.0.0');
    expect(encodeRef('v2.0.0')).toBe('v2.0.0');
  });
});

describe('CHANGELOG_BASE_URL', () => {
  test('is a usable absolute URL', () => {
    expect(CHANGELOG_BASE_URL).toMatch(/^https?:\/\//);
    expect(CHANGELOG_BASE_URL).toContain('packages');
  });
});
