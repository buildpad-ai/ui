/**
 * external-deps.ts unit tests
 *
 * The shared dependency installer used by `add` and `upgrade`. Pure logic is
 * tested against a real tmpdir; nothing here shells out (dry-run/decline paths
 * never reach execSync).
 */

import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import {
  DEPENDENCY_VERSIONS,
  toInstallSpec,
  detectInstallCommand,
  findMissingDeps,
  ensureExternalDeps,
} from '../src/utils/external-deps.js';

let tmpdir: string;

beforeEach(async () => {
  tmpdir = await fs.mkdtemp(path.join(os.tmpdir(), 'buildpad-extdeps-'));
});

afterEach(async () => {
  await fs.remove(tmpdir);
});

describe('toInstallSpec', () => {
  test('pins known deps to their tested ranges', () => {
    expect(toInstallSpec('@mantine/tiptap')).toBe('"@mantine/tiptap@^8.0.0"');
    // The rich-text-markdown 1.8.0 additions must be pinned (the original
    // omission shipped them unpinned via `add`).
    expect(toInstallSpec('@tiptap/extension-table')).toBe('"@tiptap/extension-table@^3.13.0"');
    expect(toInstallSpec('tiptap-markdown')).toBe('"tiptap-markdown@^0.9.0"');
    expect(toInstallSpec('marked')).toBe('"marked@^16.4.2"');
  });

  test('leaves unknown deps bare', () => {
    expect(toInstallSpec('left-pad')).toBe('left-pad');
  });

  test('tiptap extensions stay on one major line', () => {
    const tiptapRanges = new Set(
      Object.entries(DEPENDENCY_VERSIONS)
        .filter(([name]) => name.startsWith('@tiptap/'))
        .map(([, range]) => range)
    );
    expect(tiptapRanges).toEqual(new Set(['^3.13.0']));
  });
});

describe('detectInstallCommand', () => {
  test('pnpm-lock.yaml → pnpm add', async () => {
    await fs.writeFile(path.join(tmpdir, 'pnpm-lock.yaml'), '');
    expect(detectInstallCommand(tmpdir, ['a', 'b'])).toBe('pnpm add a b');
  });

  test('yarn.lock → yarn add', async () => {
    await fs.writeFile(path.join(tmpdir, 'yarn.lock'), '');
    expect(detectInstallCommand(tmpdir, ['a'])).toBe('yarn add a');
  });

  test('no lockfile → npm install', () => {
    expect(detectInstallCommand(tmpdir, ['a'])).toBe('npm install a');
  });
});

describe('findMissingDeps', () => {
  test('filters deps present in dependencies or devDependencies', async () => {
    await fs.writeJSON(path.join(tmpdir, 'package.json'), {
      dependencies: { marked: '^16.4.2' },
      devDependencies: { 'tiptap-markdown': '^0.9.0' },
    });
    const missing = await findMissingDeps(tmpdir, [
      'marked',
      'tiptap-markdown',
      '@tiptap/extension-table',
    ]);
    expect(missing).toEqual(['@tiptap/extension-table']);
  });

  test('no package.json → everything missing', async () => {
    const missing = await findMissingDeps(tmpdir, ['marked']);
    expect(missing).toEqual(['marked']);
  });
});

describe('ensureExternalDeps', () => {
  test('nothing missing → no install', async () => {
    await fs.writeJSON(path.join(tmpdir, 'package.json'), {
      dependencies: { marked: '^16.4.2' },
    });
    const result = await ensureExternalDeps({ cwd: tmpdir, deps: ['marked'] });
    expect(result).toEqual({ missing: [], installed: false });
  });

  test('dry-run reports missing without installing', async () => {
    await fs.writeJSON(path.join(tmpdir, 'package.json'), { dependencies: {} });
    const result = await ensureExternalDeps({
      cwd: tmpdir,
      deps: ['marked', 'tiptap-markdown'],
      dryRun: true,
    });
    expect(result.missing).toEqual(['marked', 'tiptap-markdown']);
    expect(result.installed).toBe(false);
    // package.json untouched
    const pkg = await fs.readJSON(path.join(tmpdir, 'package.json'));
    expect(pkg.dependencies).toEqual({});
  });

  test('autoInstall=false prints manual command without installing', async () => {
    await fs.writeJSON(path.join(tmpdir, 'package.json'), { dependencies: {} });
    const result = await ensureExternalDeps({
      cwd: tmpdir,
      deps: ['marked'],
      autoInstall: false,
    });
    expect(result.missing).toEqual(['marked']);
    expect(result.installed).toBe(false);
  });
});
