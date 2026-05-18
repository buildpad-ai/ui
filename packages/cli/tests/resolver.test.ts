/**
 * resolver.ts tests — focuses on the URL-building helpers used by
 * `upgrade --three-way` and the changelog fetcher. Network calls are not
 * exercised here.
 */

import { describe, expect, test } from 'vitest';
import {
  buildPackageTag,
  buildVersionedSourceUrl,
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
  test('puts the encoded ref in the path', () => {
    const ref = encodeURIComponent('@buildpad/ui-interfaces@1.4.2');
    const url = buildVersionedSourceUrl(ref, 'ui-interfaces/src/input/Input.tsx');
    expect(url).toContain('%40buildpad%2Fui-interfaces%401.4.2');
    expect(url).toContain('/packages/ui-interfaces/src/input/Input.tsx');
  });

  test('accepts a bare semver ref', () => {
    const url = buildVersionedSourceUrl('1.4.2', 'hooks/src/useAuth.ts');
    expect(url).toContain('/1.4.2/packages/hooks/src/useAuth.ts');
  });
});

describe('CHANGELOG_BASE_URL', () => {
  test('is a usable absolute URL', () => {
    expect(CHANGELOG_BASE_URL).toMatch(/^https?:\/\//);
    expect(CHANGELOG_BASE_URL).toContain('packages');
  });
});
