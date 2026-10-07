/**
 * bundleRegistrySources — the build step that copies every registry source
 * into dist/sources and fails the build when a copy does not match the
 * registry's sourceSha256.
 */
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  bundleRegistrySources,
  collectRegistrySources,
  SourceBundleError,
  type BundleRegistry,
} from '../src/bundle-sources.js';
import { hashSource } from '../src/sources.js';

let tmp: string;
let packagesRoot: string;
let outDir: string;

function writeSource(source: string, content: string) {
  const full = path.join(packagesRoot, source);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'buildpad-mcp-bundle-'));
  packagesRoot = path.join(tmp, 'packages');
  outDir = path.join(tmp, 'dist', 'sources');
  fs.mkdirSync(packagesRoot);
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

function bundleError(fn: () => unknown): SourceBundleError {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(SourceBundleError);
    return err as SourceBundleError;
  }
  throw new Error('expected bundleRegistrySources to throw');
}

describe('collectRegistrySources', () => {
  test('collects component, lib and legacy single-file lib sources once each', () => {
    const registry: BundleRegistry = {
      components: [
        { name: 'a', files: [{ source: 'ui/a.tsx', target: 'components/ui/a.tsx', sourceSha256: 'h1' }] },
        { name: 'b', files: [{ source: 'ui/a.tsx', target: 'components/ui/a.tsx', sourceSha256: 'h1' }] },
      ],
      lib: {
        utils: { files: [{ source: 'utils/u.ts', target: 'lib/u.ts', sourceSha256: 'h2' }] },
        legacy: { path: 'legacy/index.ts', target: 'lib/legacy.ts', sourceSha256: 'h3' },
      },
    };
    const { sources, problems } = collectRegistrySources(registry);
    expect(problems).toEqual([]);
    expect([...sources]).toEqual([
      ['ui/a.tsx', 'h1'],
      ['utils/u.ts', 'h2'],
      ['legacy/index.ts', 'h3'],
    ]);
  });

  test('reports a source recorded with two different hashes', () => {
    const { problems } = collectRegistrySources({
      components: [
        { name: 'a', files: [{ source: 'x.ts', target: 'a.ts', sourceSha256: 'one' }] },
        { name: 'b', files: [{ source: 'x.ts', target: 'b.ts', sourceSha256: 'two' }] },
      ],
    });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('x.ts');
  });
});

describe('bundleRegistrySources', () => {
  test('copies every source byte-for-byte when the hashes match', () => {
    const lf = 'export const a = 1;\n';
    const crlf = 'export const b = 2;\r\nexport const c = 3;\r\n';
    writeSource('ui/a.tsx', lf);
    writeSource('utils/b.ts', crlf);

    const result = bundleRegistrySources({
      registry: {
        components: [{ name: 'a', files: [{ source: 'ui/a.tsx', target: 'components/ui/a.tsx', sourceSha256: hashSource(lf) }] }],
        // The registry hashes LF-normalised text, so a CRLF checkout still matches.
        lib: { utils: { files: [{ source: 'utils/b.ts', target: 'lib/b.ts', sourceSha256: hashSource(crlf.replaceAll('\r\n', '\n')) }] } },
      },
      packagesRoot,
      outDir,
    });

    expect(result.files).toBe(2);
    expect(result.bytes).toBe(Buffer.byteLength(lf) + Buffer.byteLength(crlf));
    expect(fs.readFileSync(path.join(outDir, 'ui/a.tsx'), 'utf-8')).toBe(lf);
    expect(fs.readFileSync(path.join(outDir, 'utils/b.ts'), 'utf-8')).toBe(crlf);
  });

  test('empties the output directory first, so no stale file ships', () => {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'stale.ts'), 'old');
    writeSource('a.ts', 'a');
    bundleRegistrySources({
      registry: { components: [{ name: 'a', files: [{ source: 'a.ts', target: 'a.ts', sourceSha256: hashSource('a') }] }] },
      packagesRoot,
      outDir,
    });
    expect(fs.existsSync(path.join(outDir, 'stale.ts'))).toBe(false);
  });

  test('fails on a hash mismatch and leaves no partial bundle', () => {
    writeSource('ui/a.tsx', 'export const a = 1;\n');
    writeSource('ui/b.tsx', 'export const b = 1;\n');
    const err = bundleError(() => bundleRegistrySources({
      registry: {
        components: [{
          name: 'a',
          files: [
            { source: 'ui/a.tsx', target: 'a.tsx', sourceSha256: hashSource('export const a = 1;\n') },
            { source: 'ui/b.tsx', target: 'b.tsx', sourceSha256: hashSource('something else') },
          ],
        }],
      },
      packagesRoot,
      outDir,
    }));
    expect(err.problems).toHaveLength(1);
    expect(err.problems[0]).toMatch(/^ui\/b\.tsx: sha256 .* does not match/);
    expect(err.message).toContain('pnpm build:registry');
    expect(fs.existsSync(outDir)).toBe(false);
  });

  test('fails when a referenced file is missing or has no hash, listing every problem', () => {
    writeSource('present.ts', 'x');
    const err = bundleError(() => bundleRegistrySources({
      registry: {
        components: [{ name: 'a', files: [{ source: 'missing.ts', target: 'a.ts', sourceSha256: 'abc' }] }],
        lib: { l: { files: [{ source: 'present.ts', target: 'p.ts' }] } },
      },
      packagesRoot,
      outDir,
    }));
    expect(err.problems).toHaveLength(2);
    expect(err.problems[0]).toContain('missing.ts: referenced by the registry but not found');
    expect(err.problems[1]).toContain('present.ts: the registry records no sourceSha256');
  });

  test('fails on conflicting hashes and on paths outside packages/', () => {
    writeSource('x.ts', 'x');
    const err = bundleError(() => bundleRegistrySources({
      registry: {
        components: [
          { name: 'a', files: [{ source: 'x.ts', target: 'a.ts', sourceSha256: hashSource('x') }] },
          { name: 'b', files: [{ source: 'x.ts', target: 'b.ts', sourceSha256: 'different' }] },
          { name: 'c', files: [{ source: '../outside.ts', target: 'c.ts', sourceSha256: 'h' }] },
          { name: 'd', files: [{ source: '/etc/passwd', target: 'd.ts', sourceSha256: 'h' }] },
        ],
      },
      packagesRoot,
      outDir,
    }));
    expect(err.problems.some(p => p.startsWith('x.ts: component b records a different sourceSha256'))).toBe(true);
    expect(err.problems.some(p => p.startsWith('../outside.ts: not a relative path'))).toBe(true);
    expect(err.problems.some(p => p.startsWith('/etc/passwd: not a relative path'))).toBe(true);
  });

  test('truncates a long problem list in the message but keeps all problems', () => {
    const files = Array.from({ length: 30 }, (_, i) => ({ source: `m${i}.ts`, target: `t${i}.ts`, sourceSha256: 'h' }));
    const err = bundleError(() => bundleRegistrySources({
      registry: { components: [{ name: 'a', files }] },
      packagesRoot,
      outDir,
    }));
    expect(err.problems).toHaveLength(30);
    expect(err.message).toContain('...and 5 more');
  });

  test('the real registry bundles cleanly from this checkout', () => {
    const repoPackages = path.resolve(__dirname, '../..');
    const registry = JSON.parse(fs.readFileSync(path.join(repoPackages, 'registry.json'), 'utf-8'));
    const { sources } = collectRegistrySources(registry);
    const result = bundleRegistrySources({ registry, packagesRoot: repoPackages, outDir });
    expect(result.files).toBe(sources.size);
    expect(result.files).toBeGreaterThan(0);
    for (const [source, expected] of sources) {
      expect(hashSource(fs.readFileSync(path.join(outDir, source), 'utf-8'))).toBe(expected);
    }
  });
});
