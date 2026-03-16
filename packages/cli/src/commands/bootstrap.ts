/**
 * Buildpad CLI - Bootstrap Command
 * 
 * Single atomic command that combines:
 * 1. init (create buildpad.json, package.json, Next.js skeleton)
 * 2. add --all (copy all components)
 * 3. npm dependency installation
 * 4. post-install validation
 * 
 * Designed for AI agents and CI/CD where the entire setup must complete
 * in a single terminal invocation without hanging.
 */

import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { init } from './init.js';
import { add } from './add.js';
import { fix } from './fix.js';
import { validate } from './validate.js';

/**
 * Main bootstrap command
 * 
 * Usage:
 *   pnpm cli bootstrap --cwd /path/to/project
 *   pnpm cli bootstrap --skip-deps --cwd /path/to/project
 */
export async function bootstrap(options: {
  cwd: string;
  skipDeps?: boolean;
  skipValidate?: boolean;
}) {
  const { cwd, skipDeps = false, skipValidate = false } = options;
  const startTime = Date.now();

  console.log(chalk.bold.blue('\n🚀 Buildpad Bootstrap - Full Project Setup\n'));
  console.log(chalk.dim(`Target: ${cwd}\n`));

  // ── Step 1: Init ───────────────────────────────────────────────
  console.log(chalk.bold('━'.repeat(60)));
  console.log(chalk.bold('Step 1/3: Initializing project...\n'));

  try {
    await init({ yes: true, cwd });
  } catch (error) {
    console.error(chalk.red('\n✗ Init failed:'), error);
    process.exit(1);
  }

  // ── Step 2: Add all components ─────────────────────────────────
  console.log(chalk.bold('\n' + '━'.repeat(60)));
  console.log(chalk.bold('Step 2/3: Adding all components...\n'));

  try {
    await add([], {
      all: true,
      withApi: true,
      cwd,
      nonInteractive: true,
    });
  } catch (error) {
    console.error(chalk.red('\n✗ Component installation failed:'), error);
    process.exit(1);
  }

  // ── Step 3: Install npm dependencies ───────────────────────────
  // All dependencies (including TipTap, EditorJS, MapLibre, etc.) are now
  // pre-configured in package.json by the init step, so a single `pnpm install`
  // resolves everything. No more post-install surprise TS2307 errors.
  if (!skipDeps) {
    console.log(chalk.bold('\n' + '━'.repeat(60)));
    console.log(chalk.bold('Step 3/3: Installing npm dependencies...\n'));

    try {
      // Run pnpm install to resolve everything from package.json
      const { execSync } = await import('child_process');
      const hasPnpmLock = fs.existsSync(path.join(cwd, 'pnpm-lock.yaml'));
      const hasYarnLock = fs.existsSync(path.join(cwd, 'yarn.lock'));
      const hasBunLock = fs.existsSync(path.join(cwd, 'bun.lockb'));

      let installCmd: string;
      if (hasPnpmLock || (!hasYarnLock && !hasBunLock)) {
        installCmd = 'pnpm install';
      } else if (hasYarnLock) {
        installCmd = 'yarn install';
      } else {
        installCmd = 'bun install';
      }

      console.log(chalk.dim(`  Running: ${installCmd}\n`));
      execSync(installCmd, { cwd, stdio: 'inherit' });
      console.log(chalk.green('\n✓ Dependencies installed!'));
    } catch (error) {
      console.log(chalk.yellow('\n⚠ Dependency installation had issues. Run "pnpm install" manually.'));
    }
  } else {
    console.log(chalk.dim('\nSkipped dependency installation (--skip-deps)\n'));
  }

  // ── Validation ─────────────────────────────────────────────────
  if (!skipValidate) {
    console.log(chalk.bold('\n' + '━'.repeat(60)));
    console.log(chalk.bold('Validating installation...\n'));

    try {
      const result = await validate({ cwd, json: false, noExit: true });
      
      if (result && !result.valid) {
        // Separate TS errors (non-fatal) from structural errors (fatal)
        const tsErrors = result.errors.filter((e: { code: string }) => e.code === 'TYPESCRIPT_ERROR');
        const structuralErrors = result.errors.filter((e: { code: string }) => e.code !== 'TYPESCRIPT_ERROR');
        
        if (tsErrors.length > 0) {
          console.log(chalk.yellow(`\n⚠ ${tsErrors.length} TypeScript type error(s) detected. Auto-fixing...\n`));
          try {
            await fix({ cwd, yes: true });
          } catch {
            console.log(chalk.yellow('  Auto-fix encountered issues. Run "npx @buildpad/cli@latest fix --cwd ." to retry.\n'));
          }
        }
        
        if (structuralErrors.length > 0) {
          console.log(chalk.red(`\n✗ ${structuralErrors.length} structural error(s) found that need fixing.`));
        }
      }
    } catch {
      // Validation errors are printed inline, don't fail bootstrap
      console.log(chalk.yellow('\n⚠ Validation encountered issues (see above). Bootstrap still completed.\n'));
    }
  }

  // ── Summary ────────────────────────────────────────────────────
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(chalk.bold('\n' + '━'.repeat(60)));
  console.log(chalk.bold.green(`\n✨ Bootstrap complete! (${elapsed}s)\n`));
  console.log(chalk.dim('Your project is ready with:'));
  console.log(chalk.dim('  • buildpad.json configuration'));
  console.log(chalk.dim('  • 40+ UI components in components/ui/'));
  console.log(chalk.dim('  • Types, services, hooks in lib/buildpad/'));
  console.log(chalk.dim('  • API proxy routes in app/api/'));
  console.log(chalk.dim('  • Supabase auth utilities'));
  console.log(chalk.dim('  • Next.js skeleton (layout, page, config)'));

  console.log(chalk.bold('\nNext steps:'));
  console.log(chalk.cyan('  1. ') + chalk.dim('Configure .env.local with your DaaS URL'));
  console.log(chalk.cyan('  2. ') + chalk.dim('pnpm dev'));
  console.log(chalk.cyan('  3. ') + chalk.dim('Create pages that import from @/components/ui/\n'));
}
