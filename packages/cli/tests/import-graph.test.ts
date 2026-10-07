/**
 * scripts/check-import-graph.mjs — the import-cycle guard (`pnpm graph:check`).
 */

import { describe, expect, test } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  ALLOWED_CYCLE_EDGES,
  compareWithAllowList,
  cycleEdges,
  entryGraph,
  packageGraph,
  stronglyConnected,
  // @ts-expect-error — pure ESM helper file lives outside the TS project
} from '../../../scripts/check-import-graph.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REGISTRY_PATH = path.resolve(__dirname, '../../registry.json');

/** Build a graph from 'a -> b' strings. */
function graphOf(...edges: string[]): Map<string, Map<string, string>> {
  const graph = new Map<string, Map<string, string>>();
  for (const e of edges) {
    const [from, to] = e.split(' -> ');
    if (!graph.has(from)) graph.set(from, new Map());
    if (!graph.has(to)) graph.set(to, new Map());
    graph.get(from)!.set(to, `${from}.ts`);
  }
  return graph;
}

describe('cycle detection', () => {
  test('strongly connected components', () => {
    const sccs = stronglyConnected(graphOf('a -> b', 'b -> c', 'c -> a', 'c -> d', 'd -> e'));
    expect(sccs.filter((s: string[]) => s.length > 1)).toEqual([['a', 'b', 'c']]);
  });

  test('only edges inside a cycle are cycle edges', () => {
    expect(cycleEdges(graphOf('a -> b', 'b -> a', 'b -> c')).map((e: { edge: string }) => e.edge)).toEqual([
      'a -> b',
      'b -> a',
    ]);
  });

  test('a new edge inside an allowed cycle is reported, as is a stale allow-list entry', () => {
    const allowed = ['a -> b', 'b -> a'];
    expect(compareWithAllowList(graphOf('a -> b', 'b -> a'), allowed)).toEqual({ unexpected: [], stale: [] });

    const grown = compareWithAllowList(graphOf('a -> b', 'b -> c', 'c -> a', 'b -> a'), allowed);
    expect(grown.unexpected.map((e: { edge: string }) => e.edge)).toEqual(['b -> c', 'c -> a']);

    const broken = compareWithAllowList(graphOf('a -> b'), allowed);
    expect(broken).toEqual({ unexpected: [], stale: ['a -> b', 'b -> a'] });
  });
});

describe('this repo', () => {
  test('package graph: no cycle beyond the allow-list', () => {
    expect(compareWithAllowList(packageGraph(), ALLOWED_CYCLE_EDGES.package)).toEqual({ unexpected: [], stale: [] });
  });

  test('registry-entry graph: no cycle beyond the allow-list', async () => {
    const registry = await fs.readJSON(REGISTRY_PATH);
    expect(compareWithAllowList(entryGraph(registry), ALLOWED_CYCLE_EDGES.entry)).toEqual({ unexpected: [], stale: [] });
  });

  test('the entry graph resolves package imports to the entry declaring the name', async () => {
    const registry = await fs.readJSON(REGISTRY_PATH);
    const graph = entryGraph(registry);
    // UsersManager imports VTable from '@buildpad/ui-table' (bare package).
    expect(graph.get('users-management').has('vtable')).toBe(true);
    // ui-files' FileManager imports the upload interface by subpath.
    expect(graph.get('file-manager').has('upload')).toBe(true);
    // A template's '@/…' import resolves by target path.
    expect(graph.get('lib:content-routes').has('collection-form')).toBe(true);
  });
});
