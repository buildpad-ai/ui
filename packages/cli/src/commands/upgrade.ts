/**
 * Buildpad CLI - Upgrade Command
 *
 * Upgrade installed components (and lib modules) to the latest registry versions.
 *
 * Flags:
 *   [components...]              Specific components to upgrade (default: all outdated)
 *   --all                        Upgrade every installed component
 *   --package <name>             Upgrade all components from a specific source package
 *   --design                     Upgrade only the design-system module (tokens, globals,
 *                                theme, app shell). Shorthand scope for the lib module.
 *   --force                      Re-sync even when already at the latest version.
 *                                Bypasses the version gate but still honours --strategy,
 *                                so locally-modified files are merged, not clobbered.
 *                                Default target with --force is all installed components.
 *                                Intended for freshly-migrated (pre-0.2.0) projects whose
 *                                components were baselined to the current version.
 *   --dry-run                    Show what would change without writing files
 *   --yes                        Shorthand for --strategy=overwrite (overwrites modified files)
 *   --three-way                  Shorthand for --strategy=three-way
 *   --strategy <s>               How to handle locally-modified files non-interactively:
 *                                  "overwrite"  – replace with upstream
 *                                  "new-file"   – write new version as <file>.new
 *                                  "three-way"  – attempt diff3 merge; on conflict write .new
 *                                  "prompt"     – ask the user (default for TTY)
 *
 * Per-file behaviour:
 *   • Pristine file (sha256 matches manifest) → silently overwrite.
 *   • Modified file (sha256 differs) → behaviour controlled by strategy.
 */

import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import ora, { type Ora } from 'ora';
import prompts from 'prompts';
import {
  type Config,
  type FileChecksum,
  loadConfig,
  saveConfig,
} from './init.js';
import {
  getRegistry as fetchRegistry,
  resolveSourceFile,
  sourceFileExists,
  fetchSourceAtVersion,
  type Registry,
  type ComponentEntry,
  type LibModule,
} from '../resolver.js';
import {
  transformImports,
  transformRelativeImports,
  transformIntraComponentImports,
  transformVFormImports,
  addOriginHeader,
  hashTransformed,
} from './transformer.js';
import { threeWayMerge } from '../utils/three-way-merge.js';
import { applyNavItems } from './add.js';

async function getRegistry(): Promise<Registry> {
  try {
    return await fetchRegistry();
  } catch (err: any) {
    console.error(chalk.red('Failed to load registry:', err.message));
    process.exit(1);
  }
}

/** Compare semver: a >= b */
function semverGte(a: string, b: string): boolean {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na !== nb) return na > nb;
  }
  return true;
}

/**
 * Transform a component source file's content the same way add.ts does.
 */
async function transformContent(
  rawContent: string,
  file: { source: string; target: string },
  component: ComponentEntry,
  config: Config,
  sourcePackage: string,
  version: string
): Promise<string> {
  let content = rawContent;
  content = transformIntraComponentImports(content, file.source, file.target, component.files);
  content = transformImports(content, config, file.target);
  if (!(component.name === 'vform' || file.target.includes('/vform/'))) {
    content = transformRelativeImports(content, file.source, file.target, config.aliases.components);
  }
  if (component.name === 'vform' || file.target.includes('/vform/')) {
    content = transformVFormImports(content, file.source, file.target);
  }
  content = addOriginHeader(content, component.name, sourcePackage, version);
  return content;
}

/**
 * Transform a lib-module source file's content the same way copyLibModule does.
 * Must match `add.ts` so the recomputed sha equals the recorded baseline.
 */
function transformLibContent(
  rawContent: string,
  file: { source: string },
  moduleName: string,
  config: Config,
  sourcePackage: string,
  version: string
): string {
  let content = transformImports(rawContent, config);
  const fileName = path.basename(file.source, path.extname(file.source));
  content = addOriginHeader(content, `${moduleName}/${fileName}`, sourcePackage, version);
  return content;
}

export type UpgradeStrategy = 'overwrite' | 'new-file' | 'three-way' | 'prompt';

interface UpgradeOptions {
  components: string[];
  all?: boolean;
  package?: string;
  design?: boolean;
  force?: boolean;
  dryRun?: boolean;
  yes?: boolean;
  threeWay?: boolean;
  strategy?: UpgradeStrategy;
  cwd: string;
}

/**
 * Resolve the effective non-interactive strategy from explicit flags.
 * Precedence (most explicit wins):
 *   1. --strategy <X>            (explicit)
 *   2. --three-way               (shorthand for "three-way")
 *   3. --yes                     (shorthand for "overwrite")
 *   4. "prompt"                  (interactive default)
 */
function resolveStrategy(options: {
  strategy?: UpgradeStrategy;
  threeWay?: boolean;
  yes?: boolean;
}): UpgradeStrategy {
  if (options.strategy) return options.strategy;
  if (options.threeWay) return 'three-way';
  if (options.yes) return 'overwrite';
  return 'prompt';
}

interface ProcessFileResult {
  record: FileChecksum;
  conflict: boolean;
}

/**
 * Write one upgraded file, handling pristine vs locally-modified state and the
 * chosen strategy. Transform-agnostic: callers pass the already-transformed
 * `newContent` plus a `getBaseContent` thunk (for three-way merge). Shared by
 * the component and lib-module upgrade loops.
 */
async function processModifiableFile(args: {
  finalPath: string;
  relativeTarget: string;
  newContent: string;
  currentSha256: string | undefined;
  strategy: UpgradeStrategy;
  dryRun: boolean;
  fileSpinner: Ora;
  getBaseContent: () => Promise<string | null>;
}): Promise<ProcessFileResult> {
  const {
    finalPath, relativeTarget, newContent, currentSha256,
    strategy, dryRun, fileSpinner, getBaseContent,
  } = args;
  const newSha256 = hashTransformed(newContent);
  const base = path.basename(relativeTarget);

  if (dryRun) {
    const pristine = currentSha256 === undefined || currentSha256 === newSha256;
    fileSpinner.info(`    ${base} — ${pristine ? 'clean overwrite' : 'has local modifications'}`);
    return { record: { target: relativeTarget, sha256: newSha256 }, conflict: false };
  }

  // Pristine = disk content matches the recorded baseline (or no baseline / no file yet).
  let isPristine: boolean;
  if (!currentSha256) {
    isPristine = true;
  } else if (!(await fs.pathExists(finalPath))) {
    isPristine = true;
  } else {
    const diskContent = await fs.readFile(finalPath, 'utf8');
    isPristine = hashTransformed(diskContent) === currentSha256;
  }

  const writeOverwrite = async (): Promise<ProcessFileResult> => {
    await fs.ensureDir(path.dirname(finalPath));
    await fs.writeFile(finalPath, newContent);
    return { record: { target: relativeTarget, sha256: newSha256 }, conflict: false };
  };
  const writeNewFile = async (content: string): Promise<ProcessFileResult> => {
    const newFilePath = finalPath + '.new';
    await fs.ensureDir(path.dirname(newFilePath));
    await fs.writeFile(newFilePath, content);
    // Preserve the recorded sha so the file stays "pristine" relative to the
    // manifest; the user resolves the .new file out-of-band.
    return { record: { target: relativeTarget, sha256: currentSha256 ?? newSha256 }, conflict: true };
  };

  if (isPristine) {
    return writeOverwrite();
  }

  if (strategy === 'overwrite') {
    const r = await writeOverwrite();
    fileSpinner.info(`    ${base} — overwritten (--strategy=overwrite)`);
    return r;
  }

  if (strategy === 'three-way') {
    const baseContent = await getBaseContent();
    if (baseContent !== null) {
      const currentOnDisk = (await fs.pathExists(finalPath))
        ? await fs.readFile(finalPath, 'utf8')
        : newContent;
      const merged = threeWayMerge(currentOnDisk, baseContent, newContent);
      if (merged.ok) {
        await fs.ensureDir(path.dirname(finalPath));
        await fs.writeFile(finalPath, merged.text);
        fileSpinner.succeed(`    ${base} — merged cleanly`);
        return { record: { target: relativeTarget, sha256: hashTransformed(merged.text) }, conflict: false };
      }
      fileSpinner.warn(`    ${base} — merge conflict → writing .new`);
      return writeNewFile(merged.text);
    }
    fileSpinner.warn(`    ${base} — base unavailable, writing .new`);
    return writeNewFile(newContent);
  }

  if (strategy === 'new-file') {
    const r = await writeNewFile(newContent);
    fileSpinner.info(`    ${base} — wrote .new`);
    return r;
  }

  // strategy === 'prompt' — interactive
  fileSpinner.stop();
  const { action } = await prompts({
    type: 'select',
    name: 'action',
    message: `  ${base} has local modifications. What do you want to do?`,
    choices: [
      { title: 'Write new version as .new file', value: 'new' },
      { title: 'Overwrite (discard local changes)', value: 'overwrite' },
      { title: 'Skip this file', value: 'skip' },
    ],
    initial: 0,
  });
  fileSpinner.start();

  if (action === 'overwrite') {
    return writeOverwrite();
  }
  if (action === 'new') {
    const r = await writeNewFile(newContent);
    fileSpinner.info(`    Written: ${base}.new`);
    return r;
  }
  fileSpinner.info(`    Skipped: ${base}`);
  // Keep file untouched — preserve the recorded sha.
  return { record: { target: relativeTarget, sha256: currentSha256 ?? newSha256 }, conflict: false };
}

export async function upgrade(options: UpgradeOptions) {
  const {
    components: requestedComponents,
    all = false,
    package: packageFilter,
    design = false,
    force = false,
    dryRun = false,
    cwd,
  } = options;
  const strategy = resolveStrategy(options);

  if (dryRun) {
    console.log(chalk.yellow('\n🔍 Dry Run Mode — no files will be modified\n'));
  }

  // Load config
  const config = await loadConfig(cwd);
  if (!config) {
    console.error(chalk.red('\n✗ buildpad.json not found. Run "npx buildpad init" first.\n'));
    process.exit(1);
  }

  if ((config.schemaVersion ?? 1) < 2) {
    console.log(
      chalk.yellow(
        '\n⚠ buildpad.json is v1. Per-file modification detection is unavailable.\n' +
        '  Run \'npx buildpad migrate\' first, then retry.\n'
      )
    );
    process.exit(1);
  }

  const spinner = ora('Fetching registry...').start();
  const registry = await getRegistry();
  spinner.succeed('Registry loaded');

  // ── Resolve targets ───────────────────────────────────────────────
  // `--design` scopes strictly to the design-system lib module (no components).
  let targetComponents: string[] = [];
  let targetLibModules: string[] = [];

  if (design) {
    targetLibModules = ['design-system'];
  } else if (all) {
    targetComponents = config.installedComponents;
  } else if (packageFilter) {
    targetComponents = config.installedComponents.filter(name => {
      const rec = config.components?.[name];
      return rec?.sourcePackage === packageFilter;
    });
  } else if (requestedComponents.length > 0) {
    // Allow naming a lib module (e.g. "design-system") explicitly.
    for (const name of requestedComponents) {
      if (registry.lib[name]) targetLibModules.push(name);
      else targetComponents.push(name);
    }
  } else if (force) {
    targetComponents = config.installedComponents;
  } else {
    // Default: all outdated components AND all outdated lib modules.
    targetComponents = config.installedComponents.filter(name => {
      const regComp = registry.components.find(c => c.name === name);
      if (!regComp) return false;
      const sourcePackage = regComp.sourcePackage ?? '@buildpad/ui-interfaces';
      const lastChangedIn = regComp.lastChangedIn ?? registry.packages?.[sourcePackage]?.version ?? registry.version;
      const installedVersion = config.components?.[name]?.version ?? '0.0.0';
      return !semverGte(installedVersion, lastChangedIn);
    });
    targetLibModules = config.installedLib.filter(name => {
      const mod = registry.lib[name];
      if (!mod?.lastChangedIn) return false;
      const installedVersion = config.lib?.[name]?.version ?? '0.0.0';
      return !semverGte(installedVersion, mod.lastChangedIn);
    });
  }

  if (targetComponents.length === 0 && targetLibModules.length === 0) {
    console.log(chalk.green('\n✓ Everything is up to date.\n'));
    return;
  }

  let upgraded = 0;
  let skipped = 0;
  let conflicts = 0;
  let dirty = false;

  // ── Components ────────────────────────────────────────────────────
  if (targetComponents.length > 0) {
    console.log(chalk.bold(`\n⬆  Upgrading ${targetComponents.length} component(s)...\n`));
  }

  for (const componentName of targetComponents) {
    const regComponent = registry.components.find(c => c.name === componentName);
    if (!regComponent) {
      console.log(chalk.dim(`  Skipping '${componentName}' — not found in registry`));
      skipped++;
      continue;
    }

    const sourcePackage = regComponent.sourcePackage ?? '@buildpad/ui-interfaces';
    const latestVersion = registry.packages?.[sourcePackage]?.version ?? registry.version;
    const lastChangedIn = regComponent.lastChangedIn ?? latestVersion;
    const installedRecord = config.components?.[componentName];
    const installedVersion = installedRecord?.version ?? '0.0.0';

    const upToDate = semverGte(installedVersion, lastChangedIn);
    if (upToDate && !force) {
      console.log(chalk.dim(`  ${componentName} — already up to date (${installedVersion})`));
      skipped++;
      continue;
    }

    console.log(
      chalk.cyan(`  ${componentName}`) +
      chalk.dim(upToDate ? ` re-sync @ ${latestVersion} (--force)` : ` ${installedVersion} → ${latestVersion}`)
    );

    const fileSpinner = ora('').start();
    const newFiles: FileChecksum[] = [];
    let componentHadConflict = false;

    for (const file of regComponent.files) {
      fileSpinner.text = `  Processing ${path.basename(file.target)}...`;

      const targetPath = path.join(config.srcDir ? path.join(cwd, 'src') : cwd, file.target);
      const ext = config.tsx ? '.tsx' : '.jsx';
      const finalPath = targetPath.replace(/\.tsx?$/, ext);

      if (!(await sourceFileExists(file.source))) {
        fileSpinner.warn(`    Source not found: ${file.source}`);
        continue;
      }

      const rawContent = await resolveSourceFile(file.source);
      const newContent = await transformContent(rawContent, file, regComponent, config, sourcePackage, latestVersion);
      const currentSha256 = installedRecord?.files.find(f => f.target === file.target)?.sha256;

      const { record, conflict } = await processModifiableFile({
        finalPath,
        relativeTarget: file.target,
        newContent,
        currentSha256,
        strategy,
        dryRun,
        fileSpinner,
        getBaseContent: async () => {
          try {
            const baseRaw = await fetchSourceAtVersion(file.source, sourcePackage, installedVersion);
            return await transformContent(baseRaw, file, regComponent, config, sourcePackage, installedVersion);
          } catch {
            return null;
          }
        },
      });
      newFiles.push(record);
      if (conflict) { componentHadConflict = true; conflicts++; }
    }

    fileSpinner.stop();

    if (!dryRun) {
      if (!config.components) config.components = {};
      config.components[componentName] = {
        version: latestVersion,
        sourcePackage,
        installedAt: installedRecord?.installedAt ?? new Date().toISOString(),
        files: newFiles,
      };
      if (!config.packageVersions) config.packageVersions = {};
      config.packageVersions[sourcePackage] = latestVersion;
      if (!config.componentVersions) config.componentVersions = {};
      config.componentVersions[componentName] = {
        version: latestVersion,
        installedAt: config.components[componentName].installedAt,
        source: sourcePackage,
      };
      dirty = true;
    }

    const verb = upToDate ? 're-synced at' : 'upgraded to';
    if (!componentHadConflict) {
      console.log(chalk.green(`  ✓ ${componentName} ${verb} ${latestVersion}`));
    } else {
      console.log(chalk.yellow(`  ⚠ ${componentName} ${verb} ${latestVersion} (with conflicts — resolve .new files)`));
    }
    upgraded++;
  }

  // ── Lib modules (e.g. design-system) ──────────────────────────────
  if (targetLibModules.length > 0) {
    console.log(chalk.bold(`\n⬆  Upgrading ${targetLibModules.length} lib module(s)...\n`));
  }

  for (const moduleName of targetLibModules) {
    const mod: LibModule | undefined = registry.lib[moduleName];
    if (!mod) {
      console.log(chalk.dim(`  Skipping '${moduleName}' — not found in registry`));
      skipped++;
      continue;
    }

    const sourcePackage = mod.sourcePackage ?? '@buildpad/cli';
    const latestVersion = mod.version ?? registry.packages?.[sourcePackage]?.version ?? registry.version;
    const lastChangedIn = mod.lastChangedIn ?? latestVersion;
    const installedRecord = config.lib?.[moduleName];
    const installedVersion = installedRecord?.version ?? '0.0.0';
    const isAdoption = !installedRecord;

    const upToDate = !isAdoption && semverGte(installedVersion, lastChangedIn);
    if (upToDate && !force) {
      console.log(chalk.dim(`  ${moduleName} — already up to date (${installedVersion})`));
      skipped++;
      continue;
    }

    console.log(
      chalk.cyan(`  ${moduleName}`) +
      chalk.dim(isAdoption ? ` install @ ${latestVersion}` : ` ${installedVersion} → ${latestVersion}`)
    );

    // Detect first-time adoption of the CLI-managed nav file — when this
    // upgrade CREATES components/layout/navigation.ts, seed it afterwards
    // with the nav entries of route modules that are already installed.
    // (Existing nav files are never re-seeded: removals are user intent.)
    const navFile = (mod.files ?? []).find(f =>
      f.target.endsWith('components/layout/navigation.ts')
    );
    const navExistedBefore = navFile
      ? fs.existsSync(
          path.join(config.srcDir ? path.join(cwd, 'src') : cwd, navFile.target)
        )
      : true;

    const fileSpinner = ora('').start();
    const newFiles: FileChecksum[] = [];
    let moduleHadConflict = false;

    for (const file of mod.files ?? []) {
      fileSpinner.text = `  Processing ${path.basename(file.target)}...`;

      // Lib targets are literal paths (no .tsx/.jsx ext swap) — must match copyLibModule.
      const finalPath = path.join(config.srcDir ? path.join(cwd, 'src') : cwd, file.target);

      // The nav config is adopt-once: it accumulates user edits and
      // CLI-inserted route-module entries — upgrades create it when missing
      // but never overwrite or merge it.
      if (
        file.target.endsWith('components/layout/navigation.ts') &&
        fs.existsSync(finalPath)
      ) {
        const existing = await fs.readFile(finalPath, 'utf-8');
        newFiles.push({ target: file.target, sha256: hashTransformed(existing) });
        continue;
      }

      if (!(await sourceFileExists(file.source))) {
        fileSpinner.warn(`    Source not found: ${file.source}`);
        continue;
      }

      const rawContent = await resolveSourceFile(file.source);
      const newContent = transformLibContent(rawContent, file, moduleName, config, sourcePackage, latestVersion);
      const currentSha256 = installedRecord?.files.find(f => f.target === file.target)?.sha256;

      const { record, conflict } = await processModifiableFile({
        finalPath,
        relativeTarget: file.target,
        newContent,
        currentSha256,
        strategy,
        dryRun,
        fileSpinner,
        getBaseContent: async () => {
          if (isAdoption) return null; // no baseline to merge against
          try {
            const baseRaw = await fetchSourceAtVersion(file.source, sourcePackage, installedVersion);
            return transformLibContent(baseRaw, file, moduleName, config, sourcePackage, installedVersion);
          } catch {
            return null;
          }
        },
      });
      newFiles.push(record);
      if (conflict) { moduleHadConflict = true; conflicts++; }
    }

    fileSpinner.stop();

    if (!dryRun) {
      if (!config.lib) config.lib = {};
      config.lib[moduleName] = {
        version: latestVersion,
        sourcePackage,
        installedAt: installedRecord?.installedAt ?? new Date().toISOString(),
        files: newFiles,
      };
      if (!config.installedLib.includes(moduleName)) config.installedLib.push(moduleName);
      if (!config.packageVersions) config.packageVersions = {};
      config.packageVersions[sourcePackage] = latestVersion;
      dirty = true;

      // Seed the freshly-adopted nav file from already-installed route
      // modules (users-routes, files-routes, forms-routes, …).
      if (navFile && !navExistedBefore) {
        const navSpinner = ora('').start();
        for (const libName of config.installedLib) {
          const installedModule = registry.lib[libName];
          if (installedModule?.navItems?.length) {
            await applyNavItems(installedModule, config, cwd, navSpinner);
          }
        }
        navSpinner.stop();
      }
    }

    const verb = isAdoption ? 'installed at' : 'upgraded to';
    if (!moduleHadConflict) {
      console.log(chalk.green(`  ✓ ${moduleName} ${verb} ${latestVersion}`));
    } else {
      console.log(chalk.yellow(`  ⚠ ${moduleName} ${verb} ${latestVersion} (with conflicts — resolve .new files)`));
    }
    upgraded++;
  }

  if (!dryRun && dirty) {
    await saveConfig(cwd, config);
  }

  console.log('\n' + chalk.bold('Summary:'));
  console.log(`  Upgraded : ${upgraded}`);
  console.log(`  Skipped  : ${skipped}`);
  if (conflicts > 0) {
    console.log(chalk.yellow(`  Conflicts: ${conflicts} (.new files written — please review)`));
  }
  console.log('');
}
