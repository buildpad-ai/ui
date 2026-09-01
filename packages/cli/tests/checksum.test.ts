/**
 * checksum.ts tests
 *
 * Covers:
 *   - sha256() determinism + standard test vectors
 *   - resolvePackageVersion() lookup with the documented fallback chain
 */

import { describe, expect, test } from 'vitest';
import {
  sha256,
  resolvePackageVersion,
} from '../src/utils/checksum.js';

describe('sha256', () => {
  // Standard NIST test vector
  test('hashes the empty string to the canonical digest', () => {
    expect(sha256('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    );
  });

  test('hashes "abc" to the canonical digest', () => {
    expect(sha256('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    );
  });

  test('is deterministic across calls', () => {
    const text = 'export const x = 1;\n';
    expect(sha256(text)).toBe(sha256(text));
  });

  test('changes when content changes', () => {
    expect(sha256('a')).not.toBe(sha256('b'));
  });

  test('treats utf-8 multi-byte characters correctly', () => {
    // Different inputs → different digests, never silently truncated
    expect(sha256('é')).not.toBe(sha256('e'));
  });
});

describe('resolvePackageVersion', () => {
  const registry = {
    version: '0.0.0',
    packages: {
      '@buildpad/ui-interfaces': { version: '1.4.2' },
      '@buildpad/hooks':         { version: '1.2.0' },
    },
  };

  test('prefers per-package version when present', () => {
    expect(resolvePackageVersion(registry, '@buildpad/ui-interfaces'))
      .toBe('1.4.2');
  });

  test('falls back to caller-provided fallback', () => {
    expect(resolvePackageVersion(registry, '@buildpad/missing', '9.9.9'))
      .toBe('9.9.9');
  });

  test('falls back to registry.version when nothing else matches', () => {
    expect(resolvePackageVersion({ version: '0.0.0', packages: {} }, '@buildpad/missing'))
      .toBe('0.0.0');
  });

  test('falls back to "0.0.0" when nothing is provided', () => {
    expect(resolvePackageVersion({}, '@buildpad/missing')).toBe('0.0.0');
  });
});
