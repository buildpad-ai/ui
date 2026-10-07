/**
 * globFiles: the file walk behind `validate` and `fix`.
 */

import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { globFiles } from '../src/utils/glob.js';

let root: string;

async function touch(...files: string[]) {
  for (const f of files) {
    await fs.outputFile(path.join(root, f), '');
  }
}

const rel = (files: string[]) =>
  files.map((f) => path.relative(root, f).split(path.sep).join('/')).sort();

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'buildpad-glob-'));
});

afterEach(async () => {
  await fs.remove(root);
});

describe('globFiles', () => {
  test('expands brace patterns and returns absolute paths', async () => {
    await touch('components/a.ts', 'components/ui/b.tsx', 'components/c.js', 'components/d.jsx', 'components/e.css');
    const files = await globFiles(root, 'components/**/*.{ts,tsx,js,jsx}');
    expect(files.every((f) => path.isAbsolute(f))).toBe(true);
    expect(rel(files)).toEqual(['components/a.ts', 'components/c.js', 'components/d.jsx', 'components/ui/b.tsx']);
  });

  test('skips node_modules at any depth', async () => {
    await touch('components/a.ts', 'components/node_modules/x/index.ts', 'node_modules/y/index.ts');
    expect(rel(await globFiles(root, '**/*.ts'))).toEqual(['components/a.ts']);
  });

  test('matches files inside Next.js [dynamic] and (group) route folders', async () => {
    await touch('app/[locale]/page.tsx', 'app/(auth)/login/page.tsx', 'app/page.tsx', 'app/layout.tsx');
    expect(rel(await globFiles(path.join(root, 'app'), '**/page.tsx'))).toEqual([
      'app/(auth)/login/page.tsx',
      'app/[locale]/page.tsx',
      'app/page.tsx',
    ]);
  });

  test('treats glob characters in the directory itself literally', async () => {
    // The directory is the glob's cwd, never part of the pattern, so its
    // brackets and parentheses must not be read as glob syntax.
    const project = path.join(root, 'my[app] (v2)');
    await fs.outputFile(path.join(project, 'components', 'a.tsx'), '');
    const files = await globFiles(project, 'components/**/*.{ts,tsx}');
    expect(files).toHaveLength(1);
    expect(path.normalize(files[0])).toBe(path.join(project, 'components', 'a.tsx'));
  });

  test('returns nothing for a missing directory', async () => {
    expect(await globFiles(path.join(root, 'nope'), '**/*.ts')).toEqual([]);
  });
});
