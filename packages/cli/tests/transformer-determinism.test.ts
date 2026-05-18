/**
 * transformer.ts determinism tests
 *
 * The whole versioning system rests on `hashTransformed` being byte-stable
 * across platforms, install dates, and origin-header churn.  These tests are
 * the regression net for that promise.
 */

import { describe, expect, test } from 'vitest';
import {
  addOriginHeader,
  hashTransformed,
  stripOriginHeader,
  generateOriginHeader,
  extractOriginInfo,
  hasBuildpadOrigin,
} from '../src/commands/transformer.js';

const SAMPLE = `import { useState } from 'react';

export function Hello() {
  return <div>Hi</div>;
}
`;

describe('stripOriginHeader', () => {
  test('removes a v2 origin header (no @buildpad-date)', () => {
    const withHeader = addOriginHeader(SAMPLE, 'hello', '@buildpad/ui-interfaces', '1.4.2');
    const stripped = stripOriginHeader(withHeader);
    expect(stripped).not.toContain('@buildpad-origin');
    expect(stripped).toContain('export function Hello');
  });

  test('removes a legacy v1 header (with @buildpad-date)', () => {
    const legacyHeader = `/**
 * @buildpad-origin @buildpad/ui-interfaces/hello
 * @buildpad-version 1.0.0
 * @buildpad-date 2024-01-01
 */

${SAMPLE}`;
    const stripped = stripOriginHeader(legacyHeader);
    expect(stripped).not.toContain('@buildpad-origin');
    expect(stripped).not.toContain('@buildpad-date');
    expect(stripped).toContain('export function Hello');
  });

  test('preserves "use client" directive at the top', () => {
    const useClientFile = `"use client";

${SAMPLE}`;
    const withHeader = addOriginHeader(useClientFile, 'hello', '@buildpad/ui-interfaces', '1.4.2');
    const stripped = stripOriginHeader(withHeader);
    expect(stripped.startsWith('"use client"')).toBe(true);
    expect(stripped).not.toContain('@buildpad-origin');
  });

  test('is a no-op on content without a header', () => {
    expect(stripOriginHeader(SAMPLE)).toBe(SAMPLE);
  });
});

describe('hashTransformed', () => {
  test('is identical for the same content with different header versions', () => {
    // The whole point: bumping the version line in the header must NOT
    // change the file's recorded sha256, otherwise every "outdated" check
    // would flag every file as modified.
    const a = addOriginHeader(SAMPLE, 'hello', '@buildpad/ui-interfaces', '1.4.2');
    const b = addOriginHeader(SAMPLE, 'hello', '@buildpad/ui-interfaces', '2.0.0');
    expect(hashTransformed(a)).toBe(hashTransformed(b));
  });

  test('is identical for the same content with different sourceSha256', () => {
    const a = addOriginHeader(SAMPLE, 'hello', '@buildpad/ui-interfaces', '1.4.2', 'aaa');
    const b = addOriginHeader(SAMPLE, 'hello', '@buildpad/ui-interfaces', '1.4.2', 'bbb');
    expect(hashTransformed(a)).toBe(hashTransformed(b));
  });

  test('normalises CRLF → LF (so Windows checkouts hash like Linux)', () => {
    const lf = SAMPLE;
    const crlf = SAMPLE.replace(/\n/g, '\r\n');
    expect(hashTransformed(lf)).toBe(hashTransformed(crlf));
  });

  test('normalises lone CR → LF', () => {
    const lf = SAMPLE;
    const cr = SAMPLE.replace(/\n/g, '\r');
    expect(hashTransformed(lf)).toBe(hashTransformed(cr));
  });

  test('treats trailing-newline variants as identical', () => {
    const noNewline = 'export const x = 1;';
    const oneNewline = 'export const x = 1;\n';
    const manyNewlines = 'export const x = 1;\n\n\n';
    const h = hashTransformed(noNewline);
    expect(hashTransformed(oneNewline)).toBe(h);
    expect(hashTransformed(manyNewlines)).toBe(h);
  });

  test('detects real content changes', () => {
    const original = addOriginHeader(SAMPLE, 'hello', '@buildpad/ui-interfaces', '1.4.2');
    const tweaked = addOriginHeader(
      SAMPLE.replace('Hi', 'Hello!'),
      'hello',
      '@buildpad/ui-interfaces',
      '1.4.2'
    );
    expect(hashTransformed(original)).not.toBe(hashTransformed(tweaked));
  });

  test('idempotent under repeated header re-injection', () => {
    // Simulates: install (header v1) → upgrade (header v2) → check the body hasn't changed
    const v1 = addOriginHeader(SAMPLE, 'hello', '@buildpad/ui-interfaces', '1.0.0');
    const stripped = stripOriginHeader(v1);
    const v2 = addOriginHeader(stripped, 'hello', '@buildpad/ui-interfaces', '2.0.0');
    expect(hashTransformed(v1)).toBe(hashTransformed(v2));
  });
});

describe('generateOriginHeader', () => {
  test('does not include any volatile date / timestamp field', () => {
    // Regression: the v1 header used `@buildpad-date ${new Date()...}` which
    // changed daily and made checksums lie.  v2 must have no such fields.
    const header = generateOriginHeader('hello', '@buildpad/ui-interfaces', '1.4.2');
    expect(header).not.toMatch(/@buildpad-date/);
    expect(header).not.toMatch(/\d{4}-\d{2}-\d{2}/); // no ISO-style date anywhere
  });

  test('embeds version and origin', () => {
    const header = generateOriginHeader('hello', '@buildpad/ui-interfaces', '1.4.2');
    expect(header).toContain('@buildpad-origin @buildpad/ui-interfaces/hello');
    expect(header).toContain('@buildpad-version 1.4.2');
  });

  test('includes source sha256 when provided', () => {
    const header = generateOriginHeader('hello', '@buildpad/ui-interfaces', '1.4.2', 'deadbeef');
    expect(header).toContain('@buildpad-source-sha256 deadbeef');
  });
});

describe('extractOriginInfo', () => {
  test('parses a fresh v2 header', () => {
    const file = addOriginHeader(SAMPLE, 'hello', '@buildpad/ui-interfaces', '1.4.2', 'cafe');
    const info = extractOriginInfo(file);
    expect(info?.origin).toBe('@buildpad/ui-interfaces/hello');
    expect(info?.version).toBe('1.4.2');
    expect(info?.sourceSha256).toBe('cafe');
    expect(info?.date).toBeUndefined();
  });

  test('parses a legacy v1 header (with date)', () => {
    const legacy = `/**
 * @buildpad-origin @buildpad/ui-interfaces/hello
 * @buildpad-version 1.0.0
 * @buildpad-date 2024-01-01
 */

${SAMPLE}`;
    const info = extractOriginInfo(legacy);
    expect(info?.origin).toBe('@buildpad/ui-interfaces/hello');
    expect(info?.date).toBe('2024-01-01');
  });

  test('returns null when there is no buildpad header', () => {
    expect(extractOriginInfo(SAMPLE)).toBeNull();
  });
});

describe('hasBuildpadOrigin', () => {
  test('detects v2 origin', () => {
    const file = addOriginHeader(SAMPLE, 'hello', '@buildpad/ui-interfaces', '1.4.2');
    expect(hasBuildpadOrigin(file)).toBe(true);
  });

  test('returns false on plain content', () => {
    expect(hasBuildpadOrigin(SAMPLE)).toBe(false);
  });
});
