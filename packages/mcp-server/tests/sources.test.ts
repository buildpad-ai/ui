/**
 * Source-root detection and reading (src/sources.ts).
 *
 * Simulates the two layouts the server runs in: the monorepo
 * (`packages/mcp-server/dist`, with `packages/registry.json`) and an npm
 * install (`node_modules/@buildpad/mcp/dist`, with `dist/sources`).
 */
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  createSourceResolver,
  detectSourceRoot,
  hashSource,
  registryFilesOf,
} from '../src/sources.js';

let tmp: string;

function write(file: string, content: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

beforeEach(() => {
  tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'buildpad-mcp-sources-')));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('detectSourceRoot', () => {
  test('monorepo checkout: packages/registry.json two levels up means local mode', () => {
    const packages = path.join(tmp, 'packages');
    const dist = path.join(packages, 'mcp-server', 'dist');
    write(path.join(packages, 'registry.json'), '{}');
    // A bundle next to it does not win: the live sources do.
    fs.mkdirSync(path.join(dist, 'sources'), { recursive: true });
    expect(detectSourceRoot(dist)).toEqual({ mode: 'local', dir: packages });
  });

  test('npm install: dist/sources is used', () => {
    const dist = path.join(tmp, 'node_modules', '@buildpad', 'mcp', 'dist');
    fs.mkdirSync(path.join(dist, 'sources'), { recursive: true });
    expect(detectSourceRoot(dist)).toEqual({ mode: 'bundled', dir: path.join(dist, 'sources') });
  });

  test('npm install: never node_modules/@buildpad, even with a registry.json planted there', () => {
    const scope = path.join(tmp, 'node_modules', '@buildpad');
    const dist = path.join(scope, 'mcp', 'dist');
    write(path.join(scope, 'registry.json'), '{}');
    write(path.join(scope, 'ui-interfaces', 'src', 'input', 'Input.tsx'), 'decoy');
    fs.mkdirSync(path.join(dist, 'sources'), { recursive: true });
    expect(detectSourceRoot(dist)).toEqual({ mode: 'bundled', dir: path.join(dist, 'sources') });
  });

  test('neither layout: no root', () => {
    const dist = path.join(tmp, 'somewhere', 'mcp', 'dist');
    fs.mkdirSync(dist, { recursive: true });
    expect(detectSourceRoot(dist)).toBeNull();
  });

  test('the test run itself (src/ in the monorepo) is local mode', () => {
    const root = detectSourceRoot(path.resolve(__dirname, '../src'));
    expect(root).toEqual({ mode: 'local', dir: path.resolve(__dirname, '../..') });
  });
});

describe('createSourceResolver', () => {
  test('reads registry source paths relative to the root', () => {
    write(path.join(tmp, 'ui-interfaces/src/input/Input.tsx'), 'export const Input = 1;\n');
    const resolver = createSourceResolver({ mode: 'bundled', dir: tmp });
    expect(resolver.read('ui-interfaces/src/input/Input.tsx')).toBe('export const Input = 1;\n');
    expect(resolver.describe()).toContain('bundled with @buildpad/mcp');
  });

  test('a missing file is null; there is no index.* directory guessing', () => {
    write(path.join(tmp, 'utils/src/index.ts'), 'export {};\n');
    const resolver = createSourceResolver({ mode: 'local', dir: tmp });
    expect(resolver.read('utils/src/missing.ts')).toBeNull();
    expect(resolver.read('utils/src')).toBeNull();
    expect(resolver.describe()).toContain('monorepo packages directory');
  });

  test('refuses paths that leave the root', () => {
    const root = path.join(tmp, 'root');
    write(path.join(root, 'inside.ts'), 'in');
    write(path.join(tmp, 'outside.ts'), 'out');
    const resolver = createSourceResolver({ mode: 'bundled', dir: root });
    expect(resolver.read('../outside.ts')).toBeNull();
    expect(resolver.read(path.join(tmp, 'outside.ts'))).toBeNull();
    expect(resolver.read('.')).toBeNull();
    expect(resolver.read('inside.ts')).toBe('in');
  });

  test('readFiles splits found and missing files, keeping registry order', () => {
    write(path.join(tmp, 'a.ts'), 'A');
    write(path.join(tmp, 'c.ts'), 'C');
    const resolver = createSourceResolver({ mode: 'bundled', dir: tmp });
    const result = resolver.readFiles([
      { source: 'a.ts', target: 't/a.ts' },
      { source: 'b.ts', target: 't/b.ts' },
      { source: 'c.ts', target: 't/c.ts' },
    ]);
    expect(result.found).toEqual([
      { source: 'a.ts', target: 't/a.ts', content: 'A' },
      { source: 'c.ts', target: 't/c.ts', content: 'C' },
    ]);
    expect(result.missing).toEqual([{ source: 'b.ts', target: 't/b.ts' }]);
  });

  test('with no root every file is missing and the description says why', () => {
    const resolver = createSourceResolver(null);
    expect(resolver.root).toBeNull();
    expect(resolver.read('a.ts')).toBeNull();
    expect(resolver.readFiles([{ source: 'a.ts', target: 'a.ts' }]).missing).toHaveLength(1);
    expect(resolver.describe()).toContain('no source root');
  });
});

describe('hashSource', () => {
  test('matches the registry hash of a real source', () => {
    const packages = path.resolve(__dirname, '../..');
    const registry = JSON.parse(fs.readFileSync(path.join(packages, 'registry.json'), 'utf-8'));
    const file = registry.components[0].files[0];
    expect(hashSource(fs.readFileSync(path.join(packages, file.source), 'utf-8'))).toBe(file.sourceSha256);
  });

  test('normalises CRLF and CR to LF', () => {
    expect(hashSource('a\r\nb\r\n')).toBe(hashSource('a\nb\n'));
    expect(hashSource('a\rb\r')).toBe(hashSource('a\nb\n'));
  });
});

describe('registryFilesOf', () => {
  test('returns files, plus the legacy single-file path/target shape', () => {
    expect(registryFilesOf({ files: [{ source: 's', target: 't' }] })).toEqual([{ source: 's', target: 't' }]);
    expect(registryFilesOf({ path: 'p', target: 'q', sourceSha256: 'h' })).toEqual([
      { source: 'p', target: 'q', sourceSha256: 'h' },
    ]);
    expect(registryFilesOf({})).toEqual([]);
  });
});
