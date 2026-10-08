/**
 * external-deps.ts unit tests
 *
 * The shared dependency installer used by `add` and `upgrade`. Pure logic is
 * tested against a real tmpdir; nothing here shells out (dry-run/decline paths
 * never reach execSync).
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
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

// The confirmation prompt. Tests set what the user answers.
const promptsMock = vi.hoisted(() => vi.fn(async (): Promise<Record<string, unknown>> => ({})));
vi.mock('prompts', () => ({ default: promptsMock }));

let tmpdir: string;
const stdinIsTTY = process.stdin.isTTY;

/** Run the rest of the test as if stdin were (not) a terminal. */
function setTerminal(isTTY: boolean) {
  Object.defineProperty(process.stdin, 'isTTY', { value: isTTY, configurable: true });
}

beforeEach(async () => {
  tmpdir = await fs.mkdtemp(path.join(os.tmpdir(), 'buildpad-extdeps-'));
});

afterEach(async () => {
  await fs.remove(tmpdir);
  Object.defineProperty(process.stdin, 'isTTY', { value: stdinIsTTY, configurable: true });
  promptsMock.mockReset();
  promptsMock.mockImplementation(async () => ({}));
  vi.restoreAllMocks();
});

describe('toInstallSpec', () => {
  test('pins known deps to their tested ranges', () => {
    expect(toInstallSpec('@mantine/tiptap')).toBe('"@mantine/tiptap@^8.0.0"');
    // The rich-text-markdown 1.8.0 additions must be pinned (the original
    // omission shipped them unpinned via `add`).
    expect(toInstallSpec('@tiptap/extension-table')).toBe('"@tiptap/extension-table@^3.31.4"');
    expect(toInstallSpec('tiptap-markdown')).toBe('"tiptap-markdown@^0.9.0"');
    expect(toInstallSpec('marked')).toBe('"marked@^16.4.2"');
    // workflow-management's diagram library, pinned to the 12.x line it is built on.
    expect(toInstallSpec('@xyflow/react')).toBe('"@xyflow/react@^12.9.3"');
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
    expect(tiptapRanges).toEqual(new Set(['^3.31.4']));
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
    expect(promptsMock).not.toHaveBeenCalled();
  });
});

describe('ensureExternalDeps — confirming the install', () => {
  /** Console output of one call, joined. */
  async function run(options: { autoInstall?: boolean } = {}) {
    await fs.writeJSON(path.join(tmpdir, 'package.json'), { dependencies: {} });
    const lines: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      lines.push(args.join(' '));
    });
    const result = await ensureExternalDeps({ cwd: tmpdir, deps: ['marked', 'dompurify'], ...options });
    return { result, out: lines.join('\n') };
  }

  test('without a terminal it does not ask: it names the packages, prints the command and returns', async () => {
    // CI, `< /dev/null`, or the MCP server's spawnSync. Asking here left the
    // prompt pending for ever: the process ended at the question with exit
    // code 0, before the caller's summary.
    setTerminal(false);

    const { result, out } = await run();

    expect(promptsMock).not.toHaveBeenCalled();
    expect(result).toEqual({ missing: ['marked', 'dompurify'], installed: false });
    expect(out).toContain('- marked');
    expect(out).toContain('- dompurify');
    expect(out).toContain('no terminal to confirm on');
    expect(out).toContain(`npm install "marked@${DEPENDENCY_VERSIONS.marked}" "dompurify@${DEPENDENCY_VERSIONS.dompurify}"`);
  });

  test('without a terminal the command is the one for the project\'s package manager', async () => {
    setTerminal(false);
    await fs.writeFile(path.join(tmpdir, 'pnpm-lock.yaml'), '');

    const { out } = await run();

    expect(out).toContain('pnpm add "marked@');
  });

  test('on a terminal it asks, and a no prints the manual command', async () => {
    setTerminal(true);
    promptsMock.mockResolvedValue({ autoInstall: false });

    const { result, out } = await run();

    expect(promptsMock).toHaveBeenCalledTimes(1);
    expect(promptsMock.mock.calls[0]).toEqual([expect.objectContaining({ type: 'confirm', name: 'autoInstall' })]);
    expect(result.installed).toBe(false);
    expect(out).toContain('Install manually with:');
    expect(out).not.toContain('no terminal');
  });

  test('a cancelled prompt is a no', async () => {
    setTerminal(true);
    promptsMock.mockResolvedValue({}); // Ctrl+C / Esc: no answer at all

    const { result, out } = await run();

    expect(result.installed).toBe(false);
    expect(out).toContain('Install manually with:');
  });

  test('an explicit autoInstall never asks, terminal or not', async () => {
    setTerminal(true);
    expect((await run({ autoInstall: false })).result.installed).toBe(false);
    expect(promptsMock).not.toHaveBeenCalled();
  });
});
