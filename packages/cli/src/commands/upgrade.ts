/**
 * Buildpad CLI - Upgrade Command
 *
 * Upgrade installed components to the latest registry versions.
 *
 * Flags:
 *   [components...]              Specific components to upgrade (default: all outdated)
 *   --all                        Upgrade every installed component
 *   --package <name>             Upgrade all components from a specific source package
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
import ora from 'ora';
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
 * Transform a source file's content the same way add.ts does.
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

export type UpgradeStrategy = 'overwrite' | 'new-file' | 'three-way' | 'prompt';

interface UpgradeOptions {
  components: string[];
  all?: boolean;
  package?: string;
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

export async function upgrade(options: UpgradeOptions) {
  const {
    components: requestedComponents,
    all = false,
    package: packageFilter,
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

  // Build list of components to upgrade
  let targetComponents: string[];

  if (all) {
    targetComponents = config.installedComponents;
  } else if (packageFilter) {
    targetComponents = config.installedComponents.filter(name => {
      const rec = config.components?.[name];
      return rec?.sourcePackage === packageFilter;
    });
  } else if (requestedComponents.length > 0) {
    targetComponents = requestedComponents;
  } else {
    // Default: all outdated
    targetComponents = config.installedComponents.filter(name => {
      const regComp = registry.components.find(c => c.name === name);
      if (!regComp) return false;
      const sourcePackage = regComp.sourcePackage ?? '@buildpad/ui-interfaces';
      const lastChangedIn = regComp.lastChangedIn ?? registry.packages?.[sourcePackage]?.version ?? registry.version;
      const installedVersion = config.components?.[name]?.version ?? '0.0.0';
      return !semverGte(installedVersion, lastChangedIn);
    });
  }

  if (targetComponents.length === 0) {
    console.log(chalk.green('\n✓ All components are up to date.\n'));
    return;
  }

  console.log(chalk.bold(`\n⬆  Upgrading ${targetComponents.length} component(s)...\n`));

  let upgraded = 0;
  let skipped = 0;
  let conflicts = 0;

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

    if (semverGte(installedVersion, lastChangedIn)) {
      console.log(chalk.dim(`  ${componentName} — already up to date (${installedVersion})`));
      skipped++;
      continue;
    }

    console.log(
      chalk.cyan(`  ${componentName}`) +
      chalk.dim(` ${installedVersion} → ${latestVersion}`)
    );

    const fileSpinner = ora('').start();
    const newFiles: FileChecksum[] = [];
    let componentHadConflict = false;

    for (const file of regComponent.files) {
      fileSpinner.text = `  Processing ${path.basename(file.target)}...`;

      const targetPath = path.join(
        config.srcDir ? path.join(cwd, 'src') : cwd,
        file.target
      );
      const ext = config.tsx ? '.tsx' : '.jsx';
      const finalPath = targetPath.replace(/\.tsx?$/, ext);
      const relativeTarget = file.target;

      if (!(await sourceFileExists(file.source))) {
        fileSpinner.warn(`    Source not found: ${file.source}`);
        continue;
      }

      const rawContent = await resolveSourceFile(file.source);
      const newContent = await transformContent(rawContent, file, regComponent, config, sourcePackage, latestVersion);
      const newSha256 = hashTransformed(newContent);

      if (dryRun) {
        const currentSha256 = installedRecord?.files.find(f => f.target === relativeTarget)?.sha256;
        const pristine = currentSha256 === undefined || currentSha256 === newSha256;
        fileSpinner.info(`    ${path.basename(file.target)} — ${pristine ? 'clean overwrite' : 'has local modifications'}`);
        newFiles.push({ target: relativeTarget, sha256: newSha256 });
        continue;
      }

      // Check if file has been locally modified by comparing disk sha to the
      // recorded sha (what was written at install time). This mirrors status.ts.
      const currentSha256 = installedRecord?.files.find(f => f.target === relativeTarget)?.sha256;
      let isPristine: boolean;
      if (!currentSha256) {
        isPristine = true;
      } else if (!(await fs.pathExists(finalPath))) {
        isPristine = true;
      } else {
        const diskContent = await fs.readFile(finalPath, 'utf8');
        isPristine = hashTransformed(diskContent) === currentSha256;
      }

      const writeOverwrite = async () => {
        await fs.ensureDir(path.dirname(finalPath));
        await fs.writeFile(finalPath, newContent);
        newFiles.push({ target: relativeTarget, sha256: newSha256 });
      };
      const writeNewFile = async (content: string) => {
        const newFilePath = finalPath + '.new';
        await fs.ensureDir(path.dirname(newFilePath));
        await fs.writeFile(newFilePath, content);
        componentHadConflict = true;
        conflicts++;
        // Preserve the existing recorded sha so the file stays "pristine"
        // relative to the manifest; the user resolves the .new file out-of-band.
        newFiles.push({ target: relativeTarget, sha256: currentSha256 ?? newSha256 });
      };

      if (isPristine) {
        await writeOverwrite();
        continue;
      }

      // File is locally modified — branch on strategy.
      if (strategy === 'overwrite') {
        await writeOverwrite();
        fileSpinner.info(`    ${path.basename(file.target)} — overwritten (--strategy=overwrite)`);
        continue;
      }

      if (strategy === 'three-way') {
        // Attempt three-way merge; on any failure (network / unmerged) → .new
        let baseContent: string | null = null;
        try {
          const baseRaw = await fetchSourceAtVersion(file.source, sourcePackage, installedVersion);
          baseContent = await transformContent(baseRaw, file, regComponent, config, sourcePackage, installedVersion);
        } catch {
          baseContent = null;
        }

        if (baseContent !== null) {
          const currentOnDisk = await fs.pathExists(finalPath)
            ? await fs.readFile(finalPath, 'utf8')
            : newContent;
          const merged = threeWayMerge(currentOnDisk, baseContent, newContent);

          if (merged.ok) {
            await fs.ensureDir(path.dirname(finalPath));
            await fs.writeFile(finalPath, merged.text);
            newFiles.push({ target: relativeTarget, sha256: hashTransformed(merged.text) });
            fileSpinner.succeed(`    ${path.basename(file.target)} — merged cleanly`);
            continue;
          }
          fileSpinner.warn(`    ${path.basename(file.target)} — merge conflict → writing .new`);
          await writeNewFile(merged.text);
          continue;
        }
        // Fall through to new-file behaviour when base couldn't be fetched.
        fileSpinner.warn(`    ${path.basename(file.target)} — base unavailable, writing .new`);
        await writeNewFile(newContent);
        continue;
      }

      if (strategy === 'new-file') {
        await writeNewFile(newContent);
        fileSpinner.info(`    ${path.basename(file.target)} — wrote .new`);
        continue;
      }

      // strategy === 'prompt' — interactive
      fileSpinner.stop();
      const { action } = await prompts({
        type: 'select',
        name: 'action',
        message: `  ${path.basename(file.target)} has local modifications. What do you want to do?`,
        choices: [
          { title: 'Write new version as .new file', value: 'new' },
          { title: 'Overwrite (discard local changes)', value: 'overwrite' },
          { title: 'Skip this file', value: 'skip' },
        ],
        initial: 0,
      });
      fileSpinner.start();

      if (action === 'overwrite') {
        await writeOverwrite();
      } else if (action === 'new') {
        await writeNewFile(newContent);
        fileSpinner.info(`    Written: ${path.basename(file.target)}.new`);
      } else {
        fileSpinner.info(`    Skipped: ${path.basename(file.target)}`);
        // Keep file untouched — preserve the recorded sha
        newFiles.push({ target: relativeTarget, sha256: currentSha256 ?? newSha256 });
      }
    }

    fileSpinner.stop();

    if (!dryRun) {
      // Update config
      if (!config.components) config.components = {};
      config.components[componentName] = {
        version: latestVersion,
        sourcePackage,
        installedAt: installedRecord?.installedAt ?? new Date().toISOString(),
        files: newFiles,
      };

      if (!config.packageVersions) config.packageVersions = {};
      config.packageVersions[sourcePackage] = latestVersion;

      // Update v1 compat field
      if (!config.componentVersions) config.componentVersions = {};
      config.componentVersions[componentName] = {
        version: latestVersion,
        installedAt: config.components[componentName].installedAt,
        source: sourcePackage,
      };
    }

    if (!componentHadConflict) {
      console.log(chalk.green(`  ✓ ${componentName} upgraded to ${latestVersion}`));
    } else {
      console.log(chalk.yellow(`  ⚠ ${componentName} upgraded to ${latestVersion} (with conflicts — resolve .new files)`));
    }
    upgraded++;
  }

  if (!dryRun && upgraded > 0) {
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
