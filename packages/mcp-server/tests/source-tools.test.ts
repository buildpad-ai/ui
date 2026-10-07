/**
 * The source-returning tools and resources/read, run against each source
 * layout: bundled (what an npm install has), and missing (what an npm install
 * had before dist/sources existed). They must return the registry's exact
 * bytes, or fail loudly with the list of files they could not read. They must
 * never return placeholder text or empty lists.
 */
import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import {
  handleCallToolRequest,
  handleReadResourceRequest,
  setSourceResolver,
} from '../src/index.js';
import { getAllComponents, getRegistry } from '../src/registry.js';
import { bundleRegistrySources } from '../src/bundle-sources.js';
import { createSourceResolver, hashSource, type SourceResolver } from '../src/sources.js';

function call(name: string, args?: unknown) {
  return handleCallToolRequest({ params: { name, arguments: args } }) as Promise<{
    isError?: boolean;
    content: Array<{ type: string; text: string }>;
  }>;
}

const read = (uri: string) => handleReadResourceRequest({ params: { uri } });

let tmp: string;
let bundled: SourceResolver;
let original: SourceResolver;

beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'buildpad-mcp-tools-'));
  const outDir = path.join(tmp, 'dist', 'sources');
  // The same step the build runs, from this checkout's registry.
  bundleRegistrySources({ registry: getRegistry(), packagesRoot: path.resolve(__dirname, '../..'), outDir });
  bundled = createSourceResolver({ mode: 'bundled', dir: outDir });
  original = setSourceResolver(bundled);
});

afterEach(() => {
  setSourceResolver(bundled);
});

afterAll(() => {
  setSourceResolver(original);
  fs.rmSync(tmp, { recursive: true, force: true });
});

const input = () => getAllComponents().find(c => c.name === 'input') ?? getAllComponents()[0];

describe('bundled sources (npm layout)', () => {
  test('get_component returns the registry bytes', async () => {
    const comp = input();
    const result = await call('get_component', { name: comp.name });
    expect(result.isError).toBeUndefined();
    const body = JSON.parse(result.content[0].text);
    expect(hashSource(body.source)).toBe(comp.files[0].sourceSha256);
  });

  test('resources/read returns the primary file for a component and a lib module', async () => {
    const comp = input();
    const res = await read(`buildpad://components/${comp.name}`);
    expect(hashSource(res.contents[0].text)).toBe(comp.files[0].sourceSha256);

    const [libName, mod] = Object.entries(getRegistry().lib)[0];
    const lib = await read(`buildpad://components/${libName}`);
    expect(hashSource(lib.contents[0].text)).toBe(mod.files![0].sourceSha256);
  });

  test('copy_component with includeLib returns every component and lib file', async () => {
    const comp = getAllComponents().find(c => c.name === 'collection-form')
      ?? getAllComponents().find(c => c.internalDependencies.length > 0)!;
    const result = await call('copy_component', { name: comp.name, includeLib: true });
    expect(result.isError).toBeUndefined();
    const body = JSON.parse(result.content[0].text);
    expect(body.files).toHaveLength(comp.files.length);
    expect(body.libFiles.length).toBeGreaterThan(0);
    for (const f of [...body.files, ...body.libFiles]) expect(f.content.length).toBeGreaterThan(0);
  });

  test('resources/read still reports unknown names and URIs', async () => {
    await expect(read('buildpad://components/not-a-real-thing')).rejects.toThrow('Component not found');
    await expect(read('buildpad://other/x')).rejects.toThrow('Unknown resource URI');
    await expect(read('buildpad://packages/nope')).rejects.toThrow('Package not found');
    const pkg = await read('buildpad://packages/@buildpad/types');
    expect(JSON.parse(pkg.contents[0].text).name).toBe('@buildpad/types');
  });
});

describe('missing sources fail loudly', () => {
  test('get_component returns isError with the missing files instead of placeholder text', async () => {
    setSourceResolver(createSourceResolver(null));
    const comp = input();
    const result = await call('get_component', { name: comp.name });
    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0].text);
    expect(body.missingSources).toEqual(comp.files.map(f => ({ source: f.source, target: f.target })));
    expect(body.sourceRoot).toBeNull();
    expect(body.error).toContain('not available');
    expect(result.content[0].text).not.toContain('Source code not available');
  });

  test('a single missing file of a multi-file entry is reported, not skipped', async () => {
    const [libName, mod] = Object.entries(getRegistry().lib).find(([, m]) => (m.files?.length ?? 0) > 1)!;
    const dropped = mod.files![1];
    const outDir = bundled.root!.dir;
    const partial = path.join(tmp, 'partial');
    fs.cpSync(outDir, partial, { recursive: true });
    fs.rmSync(path.join(partial, dropped.source));
    setSourceResolver(createSourceResolver({ mode: 'bundled', dir: partial }));

    for (const tool of ['get_component', 'copy_component']) {
      const result = await call(tool, { name: libName });
      expect(result.isError).toBe(true);
      expect(JSON.parse(result.content[0].text).missingSources).toEqual([
        { source: dropped.source, target: dropped.target },
      ]);
    }
  });

  test('copy_component reports missing component and lib files together', async () => {
    setSourceResolver(createSourceResolver(null));
    const comp = getAllComponents().find(c => c.internalDependencies.length > 0)!;
    const result = await call('copy_component', { name: comp.name, includeLib: true });
    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0].text);
    expect(body.missingSources.length).toBeGreaterThan(comp.files.length);
    expect(body.hint).toContain(`npx @buildpad/cli add ${comp.name}`);
  });

  test('copy_component of a lib module reports its missing files', async () => {
    setSourceResolver(createSourceResolver(null));
    const [libName] = Object.keys(getRegistry().lib);
    const result = await call('copy_component', { name: libName });
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text).missingSources.length).toBeGreaterThan(0);
  });

  test('resources/read throws an MCP error carrying missingSources', async () => {
    setSourceResolver(createSourceResolver(null));
    const comp = input();
    const err = await read(`buildpad://components/${comp.name}`).catch(e => e);
    expect(err).toBeInstanceOf(McpError);
    expect(err.message).toContain('is not available');
    expect(err.data.missingSources).toEqual([{ source: comp.files[0].source, target: comp.files[0].target }]);
  });
});
