#!/usr/bin/env node
/**
 * Buildpad CLI
 * 
 * Copy & Own CLI tool for adding Buildpad components to your project.
 * 
 * Benefits:
 * ✅ No dependency on external packages for component code
 * ✅ Full customization - components become part of your codebase
 * ✅ No breaking changes from upstream updates
 * ✅ Bundle only what you use - tree-shaking friendly
 * ✅ Works offline after installation
 */

import { Command } from 'commander';
import { init } from './commands/init.js';
import { add } from './commands/add.js';
import { list } from './commands/list.js';
import { diff } from './commands/diff.js';
import { status } from './commands/status.js';
import { info } from './commands/info.js';
import { tree } from './commands/tree.js';
import { validate } from './commands/validate.js';
import { fix } from './commands/fix.js';
import { bootstrap } from './commands/bootstrap.js';
import { upgrade } from './commands/upgrade.js';
import { changelog } from './commands/changelog.js';
import { migrate } from './commands/migrate.js';

const program = new Command();

program
  .name('buildpad')
  .description('Copy & Own CLI - Add Buildpad components to your project')
  .version('1.0.0');

program
  .command('init')
  .description('Initialize Buildpad in your project (creates buildpad.json)')
  .option('-y, --yes', 'Skip prompts and use defaults')
  .option('-c, --cwd <path>', 'Project directory', process.cwd())
  .action(init);

program
  .command('add')
  .description('Copy components to your project (with transformed imports)')
  .argument('[components...]', 'Component names to add')
  .option('-a, --all', 'Add all components')
  .option('--with-api', 'Also add API routes and Supabase auth templates')
  .option('--category <name>', 'Add all components from a category')
  .option('-o, --overwrite', 'Overwrite existing components')
  .option('-n, --dry-run', 'Preview changes without modifying files')
  .option('--cwd <path>', 'Project directory', process.cwd())
  .action(add);

program
  .command('list')
  .description('List all available components')
  .option('--category <name>', 'Filter by category')
  .option('--json', 'Output as JSON')
  .option('--cwd <path>', 'Project directory', process.cwd())
  .action(list);

program
  .command('diff')
  .description('Preview changes before adding a component')
  .argument('<component>', 'Component name')
  .option('--cwd <path>', 'Project directory', process.cwd())
  .action(diff);

program
  .command('status')
  .description('Show installed Buildpad components and their origins')
  .option('--json', 'Output as JSON')
  .option('--cwd <path>', 'Project directory', process.cwd())
  .action(status);

program
  .command('info')
  .description('Show detailed information about a component (sources, dependencies, interface)')
  .argument('<component>', 'Component name')
  .option('--json', 'Output as JSON')
  .action(info);

program
  .command('tree')
  .description('Display dependency tree for a component')
  .argument('<component>', 'Component name')
  .option('--json', 'Output as JSON')
  .option('-d, --depth <number>', 'Max depth to display', '2')
  .action((component, options) => tree(component, { ...options, depth: parseInt(options.depth) }));

program
  .command('validate')
  .description('Validate Buildpad installation (check imports, missing files, SSR issues)')
  .option('--json', 'Output as JSON')
  .option('--cwd <path>', 'Project directory', process.cwd())
  .action(async (options) => { await validate(options); });

program
  .command('bootstrap')
  .description('Full project setup: init + add --all + install deps + validate (single command for AI agents)')
  .option('--cwd <path>', 'Project directory', process.cwd())
  .option('--skip-deps', 'Skip npm dependency installation')
  .option('--skip-validate', 'Skip post-install validation')
  .action(async (options) => {
    await bootstrap({
      cwd: options.cwd,
      skipDeps: options.skipDeps,
      skipValidate: options.skipValidate,
    });
  });

program
  .command('fix')
  .description('Automatically fix common issues (untransformed imports, broken paths, SSR exports)')
  .option('-n, --dry-run', 'Preview fixes without modifying files')
  .option('-y, --yes', 'Skip confirmation prompts')
  .option('--cwd <path>', 'Project directory', process.cwd())
  .action(fix);

program
  .command('outdated')
  .description('Check for component updates (compares installed versions to registry)')
  .option('--json', 'Output as JSON')
  .option('--cwd <path>', 'Project directory', process.cwd())
  .action(async (options) => {
    const { outdated } = await import('./commands/outdated.js');
    await outdated(options);
  });

program
  .command('upgrade')
  .description('Upgrade installed components to the latest registry versions')
  .argument('[components...]', 'Specific components to upgrade (default: all outdated)')
  .option('--all', 'Upgrade every installed component')
  .option('--package <name>', 'Upgrade all components from a specific source package')
  .option('--force', 'Re-sync components even when already at the latest version (default target: all installed)')
  .option('-n, --dry-run', 'Show what would change without writing files')
  .option('-y, --yes', 'Shorthand for --strategy=overwrite')
  .option('--three-way', 'Shorthand for --strategy=three-way')
  .option(
    '--strategy <strategy>',
    'How to handle locally-modified files: overwrite | new-file | three-way | prompt'
  )
  .option('--cwd <path>', 'Project directory', process.cwd())
  .action(async (components, options) => {
    const validStrategies = ['overwrite', 'new-file', 'three-way', 'prompt'] as const;
    if (options.strategy && !validStrategies.includes(options.strategy)) {
      console.error(
        `Invalid --strategy value: ${options.strategy}. Use one of: ${validStrategies.join(', ')}.`
      );
      process.exit(1);
    }
    await upgrade({
      components,
      all: options.all,
      package: options.package,
      force: options.force,
      dryRun: options.dryRun,
      yes: options.yes,
      threeWay: options.threeWay,
      strategy: options.strategy,
      cwd: options.cwd,
    });
  });

program
  .command('changelog')
  .description('Display the changelog for a source package or component')
  .argument('<target>', 'Package name (e.g. @buildpad/ui-interfaces) or component name (e.g. input)')
  .option('--since <version>', 'Show only entries newer than this semver')
  .option('--json', 'Output as JSON')
  .option('--cwd <path>', 'Project directory', process.cwd())
  .action(async (target, options) => {
    await changelog({ target, since: options.since, json: options.json, cwd: options.cwd });
  });

program
  .command('migrate')
  .description('Migrate buildpad.json from schema v1 to v2 (enables per-file update tracking)')
  .option('-n, --dry-run', 'Preview migration without writing files')
  .option('--cwd <path>', 'Project directory', process.cwd())
  .action(async (options) => {
    await migrate({ cwd: options.cwd, dryRun: options.dryRun });
  });

program.parse();
