/**
 * Shared external npm-dependency handling for `add` and `upgrade`.
 *
 * Registry component/lib entries declare the npm packages their source
 * imports. `add` has always installed missing ones; `upgrade` must do the
 * same, because a component can gain a dependency between versions (e.g.
 * rich-text-markdown 1.8.0 added @tiptap/extension-table, tiptap-markdown
 * and marked) — copying the new source without installing them leaves the
 * consumer app with unresolvable imports.
 */

import fs from 'fs-extra';
import path from 'node:path';
import chalk from 'chalk';
import ora from 'ora';
import prompts from 'prompts';

/**
 * Version ranges for auto-installed npm dependencies.
 *
 * Registry entries list bare package names; installing those unpinned resolves
 * to `latest`, which drifts from the ranges the source packages are developed
 * and tested against. Concretely: `pnpm add @mantine/tiptap` pulled Mantine 9.x
 * into apps whose init template pins @mantine/core 8.x — mixed Mantine majors
 * break at runtime ("forwardRef render functions accept exactly two
 * parameters" on every RichTextEditor control).
 *
 * Keep these aligned with the peerDependencies of the source packages
 * (packages/ui-forms/package.json carries the widest surface) and with the
 * init template's base dependencies (init.ts `minimalPackageJson`).
 */
export const DEPENDENCY_VERSIONS: Record<string, string> = {
  // Mantine ecosystem — must stay on the same major as @mantine/core (init template)
  '@mantine/core': '^8.0.0',
  '@mantine/hooks': '^8.0.0',
  '@mantine/dates': '^8.0.0',
  '@mantine/notifications': '^8.0.0',
  '@mantine/dropzone': '^8.0.0',
  '@mantine/tiptap': '^8.0.0',
  // Drag-and-drop (aligned with the init template)
  '@dnd-kit/core': '^6.0.0',
  '@dnd-kit/sortable': '^9.0.0',
  '@dnd-kit/utilities': '^3.0.0',
  // Rich text (tiptap v3 line, per @buildpad/ui-forms peers)
  '@tiptap/core': '^3.31.4',
  '@tiptap/react': '^3.31.4',
  '@tiptap/starter-kit': '^3.31.4',
  '@tiptap/extension-link': '^3.31.4',
  '@tiptap/extension-highlight': '^3.31.4',
  '@tiptap/extension-color': '^3.31.4',
  '@tiptap/extension-placeholder': '^3.31.4',
  '@tiptap/extension-subscript': '^3.31.4',
  '@tiptap/extension-superscript': '^3.31.4',
  '@tiptap/extension-table': '^3.31.4',
  '@tiptap/extension-text-align': '^3.31.4',
  '@tiptap/extension-text-style': '^3.31.4',
  '@tiptap/extension-underline': '^3.31.4',
  '@tiptap/extension-code-block-lowlight': '^3.31.4',
  'tiptap-markdown': '^0.9.0',
  'marked': '^16.4.2',
  'highlight.js': '^11.11.1',
  'lowlight': '^3.3.0',
  // Block editor
  '@editorjs/editorjs': '^2.31.0',
  '@editorjs/checklist': '^1.6.0',
  '@editorjs/code': '^2.9.3',
  '@editorjs/delimiter': '^1.4.2',
  '@editorjs/header': '^2.8.8',
  '@editorjs/inline-code': '^1.5.2',
  '@editorjs/nested-list': '^1.4.3',
  '@editorjs/paragraph': '^2.11.7',
  '@editorjs/quote': '^2.7.6',
  '@editorjs/table': '^2.4.5',
  '@editorjs/underline': '^1.2.1',
  'dompurify': '^3.4.16',
  // Map
  'maplibre-gl': '^5.17.0',
  '@mapbox/mapbox-gl-draw': '^1.5.2',
  // State diagram (workflow-management; the range @buildpad/ui-workflows is developed against)
  '@xyflow/react': '^12.9.3',
  // Misc (aligned with the init template / services)
  '@tabler/icons-react': '^3.0.0',
  '@supabase/ssr': '^0.5',
  '@supabase/supabase-js': '^2',
  'jose': '^5',
  'axios': '^1.20.0',
  'dayjs': '^1.11.0',
  // Locale routing (lib/i18n): Accept-Language negotiation in middleware
  'negotiator': '^1.0.0',
  '@types/negotiator': '^0.6.4',
  '@formatjs/intl-localematcher': '^0.6.0',
  'server-only': '^0.0.1',
};

/** Turn a bare dependency name into a pinned install spec (quoted for shells). */
export function toInstallSpec(dep: string): string {
  const range = DEPENDENCY_VERSIONS[dep];
  return range ? `"${dep}@${range}"` : dep;
}

/** Build the install command for the package manager the app's lockfile implies. */
export function detectInstallCommand(cwd: string, specs: string[]): string {
  const hasYarnLock = fs.existsSync(path.join(cwd, 'yarn.lock'));
  const hasPnpmLock = fs.existsSync(path.join(cwd, 'pnpm-lock.yaml'));
  const hasBunLock = fs.existsSync(path.join(cwd, 'bun.lockb'));

  if (hasPnpmLock) return `pnpm add ${specs.join(' ')}`;
  if (hasYarnLock) return `yarn add ${specs.join(' ')}`;
  if (hasBunLock) return `bun add ${specs.join(' ')}`;
  return `npm install ${specs.join(' ')}`;
}

/** Registry deps not present in the app's package.json (deps or devDeps). */
export async function findMissingDeps(cwd: string, deps: Iterable<string>): Promise<string[]> {
  const packageJsonPath = path.join(cwd, 'package.json');
  if (!(await fs.pathExists(packageJsonPath))) return Array.from(deps);

  const packageJson = await fs.readJSON(packageJsonPath);
  const installed = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };
  return Array.from(deps).filter(dep => !installed[dep]);
}

export interface EnsureExternalDepsOptions {
  cwd: string;
  /** Bare package names declared by the installed/upgraded registry entries. */
  deps: Iterable<string>;
  /**
   * true  → install without prompting (non-interactive flows: bootstrap, --yes)
   * false → never install; print the command
   * undefined → confirm interactively (default). Without a terminal to ask on
   *   (CI, a pipe, the MCP server) nothing is installed and the command is
   *   printed instead.
   */
  autoInstall?: boolean;
  /** List what would be installed without touching anything. */
  dryRun?: boolean;
  /** Print a ✓ line when nothing is missing (add's historical output). */
  announceClean?: boolean;
}

/**
 * Check the app's package.json for missing registry-declared dependencies and
 * install them (with confirmation unless `autoInstall`).
 */
export async function ensureExternalDeps(
  options: EnsureExternalDepsOptions
): Promise<{ missing: string[]; installed: boolean }> {
  const { cwd, deps, dryRun = false, announceClean = false } = options;

  const missing = await findMissingDeps(cwd, deps);
  if (missing.length === 0) {
    if (announceClean) console.log(chalk.green('✓ All external dependencies installed\n'));
    return { missing, installed: false };
  }

  console.log(chalk.yellow('⚠ Missing dependencies:'));
  missing.forEach(dep => console.log(chalk.dim(`  - ${dep}`)));

  // Pin known deps to their tested ranges — a bare name installs `latest`,
  // which can drift majors (see DEPENDENCY_VERSIONS).
  const installCmd = detectInstallCommand(cwd, missing.map(toInstallSpec));

  if (dryRun) {
    console.log(chalk.dim('\nWould install with:'));
    console.log(chalk.cyan(`  ${installCmd}\n`));
    return { missing, installed: false };
  }

  let autoInstall = options.autoInstall ?? false;
  if (options.autoInstall === undefined) {
    // With no terminal on stdin the question can never be answered: the
    // prompt stays pending, Node runs out of work and the process ends right
    // there with exit code 0 — before the caller's summary, and without ever
    // saying how to install the packages. Do not ask.
    if (!process.stdin.isTTY) {
      console.log(chalk.dim('\nNot installed: there is no terminal to confirm on. Install with:'));
      console.log(chalk.cyan(`  ${installCmd}\n`));
      return { missing, installed: false };
    }
    const answer = await prompts({
      type: 'confirm',
      name: 'autoInstall',
      message: 'Install missing dependencies automatically?',
      initial: true,
    });
    // A cancelled prompt (Ctrl+C, Esc) answers nothing: that is a no.
    autoInstall = answer.autoInstall === true;
  }

  if (!autoInstall) {
    console.log(chalk.dim('\nInstall manually with:'));
    console.log(chalk.cyan(`  ${installCmd}\n`));
    return { missing, installed: false };
  }

  const installSpinner = ora('Installing dependencies...').start();
  try {
    const { execSync } = await import('node:child_process');
    execSync(installCmd, { cwd, stdio: 'pipe' });
    installSpinner.succeed('Dependencies installed!');
    return { missing, installed: true };
  } catch {
    installSpinner.fail('Failed to install dependencies');
    console.log(chalk.dim('\nInstall manually with:'));
    console.log(chalk.cyan(`  ${installCmd}\n`));
    return { missing, installed: false };
  }
}
