/**
 * Offline typecheck of a full consumer install.
 *
 * Writes the transformed output of every registry file, the generated barrel
 * and the init skeleton into a temp project OUTSIDE the repo (so no
 * `@buildpad/*` package can resolve and hide a missed rewrite), links the
 * repo's hoisted node_modules for the npm dependencies, and runs `tsc --noEmit`
 * with the tsconfig `init` writes. Any error fails: a missed rewrite, a wrong
 * relative path, a barrel ambiguity, or a shipped type error.
 *
 * The transform does not read `srcDir`, so the root layout stands for both.
 */

import { afterAll, describe, expect, test } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  BARREL,
  REPO_ROOT,
  initSkeleton,
  loadRegistry,
  makeConfig,
  renderBarrel,
  transformCorpus,
} from './helpers/registry-corpus.js';

const NODE_MODULES = path.join(REPO_ROOT, 'node_modules');

/**
 * npm packages consumer files import that the monorepo itself does not
 * install (the CLI adds them to the consumer's package.json). Each gets an
 * untyped ambient stub — only when it really is absent — so the check does
 * not need them as root devDependencies.
 */
const STUBBED_PACKAGES = ['@supabase/ssr', 'tailwind-merge', '@mantine/modals', 'negotiator'];

function hasTypes(pkg: string): boolean {
  const dir = path.join(NODE_MODULES, pkg);
  const typesDir = path.join(NODE_MODULES, '@types', pkg.startsWith('@') ? pkg.slice(1).replace('/', '__') : pkg);
  if (fs.existsSync(typesDir)) return true;
  if (!fs.existsSync(path.join(dir, 'package.json'))) return false;
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
  return Boolean(manifest.types || manifest.typings || fs.existsSync(path.join(dir, 'index.d.ts')) ||
    JSON.stringify(manifest.exports ?? {}).includes('"types"'));
}

/** The tsconfig `buildpad init` writes, minus the Next plugin and incremental cache. */
const TSCONFIG = {
  compilerOptions: {
    target: 'ES2017',
    lib: ['dom', 'dom.iterable', 'esnext'],
    allowJs: true,
    skipLibCheck: true,
    strict: true,
    noEmit: true,
    esModuleInterop: true,
    module: 'esnext',
    moduleResolution: 'bundler',
    resolveJsonModule: true,
    isolatedModules: true,
    jsx: 'preserve',
    paths: { '@/*': ['./*'] },
    baseUrl: '.',
  },
  include: ['next-env.d.ts', '**/*.ts', '**/*.tsx'],
  exclude: ['node_modules'],
};

describe('registry corpus: offline typecheck of a full install', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'buildpad-fixture-'));
  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

  test('tsc --noEmit reports no errors', () => {
    const registry = loadRegistry();
    const files = new Map<string, string>();
    // Lib modules first, then components, in registry order — the order
    // `add --with-api` writes them (external-oauth's callback route replaces
    // api-routes' on the shared target).
    for (const f of transformCorpus(registry, makeConfig())) files.set(f.finalTarget, f.content);
    for (const [target, content] of initSkeleton()) files.set(target, content);
    files.set(BARREL, renderBarrel(registry.components.map(c => c.name), registry, files).content);
    files.set('next-env.d.ts', '/// <reference types="next" />\n/// <reference types="next/image-types/global" />\n');
    files.set('tsconfig.json', JSON.stringify(TSCONFIG, null, 2));
    const stubs = STUBBED_PACKAGES.filter(p => !hasTypes(p));
    if (stubs.length > 0) {
      files.set('buildpad-fixture-stubs.d.ts', stubs.map(p => `declare module '${p}';`).join('\n') + '\n');
    }

    for (const [rel, content] of files) {
      const abs = path.join(dir, rel);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, content);
    }
    fs.symlinkSync(NODE_MODULES, path.join(dir, 'node_modules'), 'junction');

    let output = '';
    try {
      execFileSync(process.execPath, [path.join(NODE_MODULES, 'typescript/bin/tsc'), '-p', dir, '--pretty', 'false'], {
        cwd: dir,
        encoding: 'utf8',
        stdio: 'pipe',
        maxBuffer: 32 * 1024 * 1024,
      });
    } catch (err) {
      const e = err as { stdout?: string; stderr?: string; message: string };
      output = `${e.stdout ?? ''}${e.stderr ?? ''}` || e.message;
    }
    const errors = output.split('\n').filter(line => /error TS\d+/.test(line));
    expect(errors).toEqual([]);
    expect(output).toBe('');
  }, 180_000);
});
