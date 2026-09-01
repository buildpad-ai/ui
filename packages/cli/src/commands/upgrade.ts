/**
 * Buildpad CLI - Upgrade Command
 *
 * Upgrade installed components (and lib modules) to the release this CLI ships
 * against. Staleness is decided by content hash, not by version — see
 * utils/staleness.ts.
 *
 * Flags:
 *   [components...]              Specific components to upgrade (default: all stale)
 *   --all                        Upgrade every installed component
 *   --package <name>             Upgrade all components from a specific source package
 *   --design                     Upgrade only the design-system module (tokens, globals,
 *                                theme, app shell). Shorthand scope for the lib module.
 *   --force                      Re-sync every file even when upstream is unchanged.
 *                                Bypasses the staleness gate but still honours --strategy,
 *                                so locally-modified files are merged, not clobbered.
 *   --dry-run                    Show what would change without writing files
 *   --yes                        Shorthand for --strategy=overwrite (overwrites modified files)
 *   --three-way                  Shorthand for --strategy=three-way
 *   --strategy <s>               How to handle locally-modified files non-interactively:
 *                                  "overwrite"  – replace with upstream
 *                                  "new-file"   – write new version as <file>.new
 *                                  "three-way"  – attempt diff3 merge; on conflict write .new
 *                                  "prompt"     – ask the user (default for TTY)
 *
 * Per-file behaviour (§4 of the versioning redesign):
 *
 *   upstream changed | local modified | action
 *   -----------------+----------------+---------------------------------------
 *   no               | no             | none
 *   no               | yes            | none — no prompt
 *   yes              | no             | overwrite, silent
 *   yes              | yes            | strategy; diff3 base = the exact bytes
 *                    |                | installed, fetched at the recorded ref
 *   added upstream   | -              | add
 *   removed upstream | -              | keep on disk, warn, stop tracking
 *
 * Anything the CLI does not actually write is recorded `state: "pending"` with
 * its OLD upstream hash and ref, so the next `outdated` still reports it. The
 * pre-v3 upgrade wrote `version: latest` unconditionally, which made a skipped
 * file vanish from the report permanently.
 */

import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import ora, { type Ora } from 'ora';
import prompts from 'prompts';
import {
  type Config,
  type ComponentInstall,
  type FileChecksum,
  loadConfig,
  saveConfig,
} from './init.js';
import {
  getRegistry as fetchRegistry,
  resolveSourceFile,
  sourceFileExists,
  fetchSourceAtRef,
  fetchSourceAtVersion,
  getRecordedRef,
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
import {
  computeEntryStaleness,
  registryFilesOf,
  type RegistryFileEntry,
} from '../utils/staleness.js';
import { threeWayMerge } from '../utils/three-way-merge.js';
import { ensureExternalDeps } from '../utils/external-deps.js';
import { applyNavItems } from './add.js';

async function getRegistry(): Promise<Registry> {
  try {
    return await fetchRegistry();
  } catch (err: any) {
    console.error(chalk.red('Failed to load registry:', err.message));
    process.exit(1);
  }
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
  /** False when the CLI did not write the new upstream content. */
  written: boolean;
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
  /** Registry hash of the untransformed upstream source we are moving to. */
  newSourceSha256?: string;
  /** Ref `newContent` was fetched from — recorded as the next diff3 base. */
  ref: string;
  /** Manifest record for this file, if any. */
  installed?: FileChecksum;
  strategy: UpgradeStrategy;
  dryRun: boolean;
  fileSpinner: Ora;
  getBaseContent: () => Promise<string | null>;
}): Promise<ProcessFileResult> {
  const {
    finalPath, relativeTarget, newContent, newSourceSha256, ref, installed,
    strategy, dryRun, fileSpinner, getBaseContent,
  } = args;
  const currentSha256 = installed?.sha256;
  const newSha256 = hashTransformed(newContent);
  const base = path.basename(relativeTarget);

  /** Record for a file we successfully brought to the new upstream content. */
  const clean = (sha256: string): FileChecksum => ({
    target: relativeTarget,
    sourceSha256: newSourceSha256,
    sha256,
    ref,
    state: 'clean',
  });

  /**
   * Record for a file we did NOT write: keep the OLD upstream hash and ref so
   * the next run still sees it as stale and still knows its true diff3 base.
   */
  const pending = (): FileChecksum => ({
    target: relativeTarget,
    sourceSha256: installed?.sourceSha256,
    sha256: currentSha256 ?? newSha256,
    ref: installed?.ref ?? ref,
    state: 'pending',
  });

  if (dryRun) {
    const pristine = currentSha256 === undefined || currentSha256 === newSha256;
    fileSpinner.info(`    ${base} — ${pristine ? 'clean overwrite' : 'has local modifications'}`);
    return { record: clean(newSha256), conflict: false, written: true };
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
    return { record: clean(newSha256), conflict: false, written: true };
  };
  const writeNewFile = async (content: string): Promise<ProcessFileResult> => {
    const newFilePath = finalPath + '.new';
    await fs.ensureDir(path.dirname(newFilePath));
    await fs.writeFile(newFilePath, content);
    // The user's file is untouched, so the upgrade is not done: stay pending
    // until they resolve the .new file and re-run.
    return { record: pending(), conflict: true, written: false };
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
        // The merge integrated the new upstream content, so this file IS at
        // the new upstream revision even though its bytes differ from it.
        return { record: clean(hashTransformed(merged.text)), conflict: false, written: true };
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
  // File untouched — keep the old baseline so it stays stale.
  return { record: pending(), conflict: false, written: false };
}

/**
 * Files the registry no longer ships. Deleting them would remove code the
 * consumer's app may still import — this is a copy-and-own model, the files
 * are theirs. Warn, leave them on disk, and stop tracking them so they do not
 * report as stale forever.
 */
function reportRemovedFiles(
  entryName: string,
  registryFiles: RegistryFileEntry[],
  installedFiles: FileChecksum[]
): FileChecksum[] {
  const registryTargets = new Set(registryFiles.map(f => f.target));
  const removed = installedFiles.filter(f => !registryTargets.has(f.target));
  for (const file of removed) {
    console.log(
      chalk.yellow(`    ⚠ ${file.target} is no longer shipped by '${entryName}'.`)
    );
    console.log(
      chalk.dim('      Kept on disk and no longer tracked — delete it yourself if unused.')
    );
  }
  return removed;
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

  const release = registry.version;
  const ref = getRecordedRef();

  /** Staleness for one installed component, computed once and reused. */
  const componentStaleness = (name: string) => {
    const reg = registry.components.find(c => c.name === name);
    if (!reg) return null;
    return computeEntryStaleness(registryFilesOf(reg), config.components?.[name]);
  };
  const libStaleness = (name: string) => {
    const mod = registry.lib?.[name];
    if (!mod) return null;
    return computeEntryStaleness(registryFilesOf(mod), config.lib?.[name]);
  };

  // ── Resolve targets ───────────────────────────────────────────────
  // `--design` scopes strictly to the design-system lib module (no components).
  let targetComponents: string[] = [];
  let targetLibModules: string[] = [];

  if (design) {
    targetLibModules = ['design-system'];
  } else if (all) {
    targetComponents = config.installedComponents;
    targetLibModules = config.installedLib;
  } else if (packageFilter) {
    targetComponents = config.installedComponents.filter(name => {
      const reg = registry.components.find(c => c.name === name);
      const declared = reg?.sourcePackage ?? config.components?.[name]?.sourcePackage;
      return declared === packageFilter;
    });
  } else if (requestedComponents.length > 0) {
    // Allow naming a lib module (e.g. "design-system") explicitly.
    for (const name of requestedComponents) {
      if (registry.lib[name]) targetLibModules.push(name);
      else targetComponents.push(name);
    }
  } else if (force) {
    targetComponents = config.installedComponents;
    targetLibModules = config.installedLib;
  } else {
    // Default: everything whose upstream content changed, plus anything a
    // previous run left pending. A v2 record has no upstream hash to compare,
    // so it is included too — the upgrade re-baselines it into v3.
    targetComponents = config.installedComponents.filter(name => {
      const s = componentStaleness(name);
      return !!s && (s.stale || s.needsMigrate || s.untracked);
    });
    targetLibModules = config.installedLib.filter(name => {
      const s = libStaleness(name);
      return !!s && (s.stale || s.needsMigrate || s.untracked);
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
  // npm deps declared by everything we upgrade — a new version can introduce
  // dependencies the app doesn't have yet (e.g. rich-text-markdown 1.8.0
  // added @tiptap/extension-table + tiptap-markdown + marked).
  const externalDeps = new Set<string>();

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
    const installedRecord = config.components?.[componentName];
    const staleness = computeEntryStaleness(registryFilesOf(regComponent), installedRecord);

    if (!staleness.stale && !staleness.needsMigrate && !staleness.untracked && !force) {
      console.log(chalk.dim(`  ${componentName} — already up to date`));
      skipped++;
      continue;
    }

    // Files whose upstream hash is unchanged need no action at all — not even
    // a prompt. Prompting on them offered to overwrite a user's edits with
    // byte-identical old content.
    //
    // A record with no upstream hashes (v2, or none at all) cannot be compared
    // file by file, so every file is in scope: this run re-baselines it to v3.
    const staleTargets = staleness.needsMigrate || staleness.untracked
      ? new Set(regComponent.files.map(f => f.target))
      : new Set(staleness.files.filter(f => f.reason !== 'removed').map(f => f.target));

    const from = installedRecord?.release ?? installedRecord?.version ?? 'unknown';
    console.log(
      chalk.cyan(`  ${componentName}`) +
      chalk.dim(force ? ` re-sync @ ${release} (--force)` : ` ${from} → ${release}`)
    );

    // Removals are reported here and then simply absent from `newFiles`.
    reportRemovedFiles(
      componentName,
      registryFilesOf(regComponent),
      installedRecord?.files ?? []
    );

    const fileSpinner = ora('').start();
    const newFiles: FileChecksum[] = [];
    let componentHadConflict = false;

    for (const file of regComponent.files) {
      fileSpinner.text = `  Processing ${path.basename(file.target)}...`;

      const targetPath = path.join(config.srcDir ? path.join(cwd, 'src') : cwd, file.target);
      const ext = config.tsx ? '.tsx' : '.jsx';
      const finalPath = targetPath.replace(/\.tsx?$/, ext);
      const installed = installedRecord?.files.find(f => f.target === file.target);

      // Upstream unchanged and the file is present → leave it alone entirely,
      // modified or not. Missing on disk still self-heals.
      const onDisk = await fs.pathExists(finalPath);
      if (!force && !staleTargets.has(file.target) && onDisk && installed) {
        newFiles.push(installed);
        continue;
      }

      if (!(await sourceFileExists(file.source))) {
        fileSpinner.warn(`    Source not found: ${file.source}`);
        if (installed) newFiles.push(installed);
        continue;
      }

      const rawContent = await resolveSourceFile(file.source);
      const newContent = await transformContent(rawContent, file, regComponent, config, sourcePackage, release);

      const { record, conflict } = await processModifiableFile({
        finalPath,
        relativeTarget: file.target,
        newContent,
        newSourceSha256: file.sourceSha256,
        ref,
        installed,
        strategy,
        dryRun,
        fileSpinner,
        getBaseContent: async () => {
          const baseRaw = await fetchBaseSource(file.source, installed, sourcePackage, installedRecord?.version);
          if (baseRaw === null) return null;
          return transformContent(
            baseRaw, file, regComponent, config, sourcePackage,
            installed?.ref ?? installedRecord?.release ?? release
          );
        },
      });
      newFiles.push(record);
      if (conflict) { componentHadConflict = true; conflicts++; }
    }

    fileSpinner.stop();

    // The new source is on disk now (even with conflicts, .new files reference
    // the new imports) — make sure its declared npm deps get installed.
    regComponent.dependencies?.forEach(dep => externalDeps.add(dep));

    const pendingCount = newFiles.filter(f => f.state === 'pending').length;

    if (!dryRun) {
      if (!config.components) config.components = {};
      const record: ComponentInstall = {
        release,
        ref,
        sourcePackage,
        installedAt: installedRecord?.installedAt ?? new Date().toISOString(),
        files: newFiles,
      };
      config.components[componentName] = record;
      dirty = true;
    }

    if (componentHadConflict) {
      console.log(chalk.yellow(`  ⚠ ${componentName} → ${release} (conflicts — resolve .new files, then re-run)`));
    } else if (pendingCount > 0) {
      console.log(chalk.yellow(`  ⚠ ${componentName} → ${release} (${pendingCount} file(s) still pending)`));
    } else {
      console.log(chalk.green(`  ✓ ${componentName} upgraded to ${release}`));
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
    const installedRecord = config.lib?.[moduleName];
    const isAdoption = !installedRecord;
    // Iterate the same list staleness is computed from. Older lib modules
    // declare a single file as `path`/`target` rather than in `files`; counting
    // it as stale but never writing it would leave the module permanently
    // outdated with no way to resolve it.
    const modFiles = registryFilesOf(mod);
    const staleness = computeEntryStaleness(modFiles, installedRecord);

    // A module gains files over time, and a file registered upstream but absent
    // on disk is work to do regardless of hashes.
    const libSrcDir = config.srcDir ? path.join(cwd, 'src') : cwd;
    const missingFiles = modFiles.filter(
      (f: { target: string }) => !fs.existsSync(path.join(libSrcDir, f.target))
    );

    const needsWork =
      isAdoption || missingFiles.length > 0 || staleness.stale || staleness.needsMigrate;
    if (!needsWork && !force) {
      console.log(chalk.dim(`  ${moduleName} — already up to date`));
      skipped++;
      continue;
    }

    const staleTargets = staleness.needsMigrate || staleness.untracked
      ? new Set(modFiles.map(f => f.target))
      : new Set(staleness.files.filter(f => f.reason !== 'removed').map(f => f.target));

    const from = installedRecord?.release ?? installedRecord?.version ?? 'unknown';
    console.log(
      chalk.cyan(`  ${moduleName}`) +
      chalk.dim(isAdoption ? ` install @ ${release}` : ` ${from} → ${release}`)
    );

    if (!isAdoption) {
      reportRemovedFiles(moduleName, modFiles, installedRecord!.files ?? []);
    }

    // Detect first-time adoption of the CLI-managed nav file — when this
    // upgrade CREATES components/layout/navigation.ts, seed it afterwards
    // with the nav entries of route modules that are already installed.
    // (Existing nav files are never re-seeded: removals are user intent.)
    const navFile = modFiles.find(f =>
      f.target.endsWith('components/layout/navigation.ts')
    );
    const navExistedBefore = navFile
      ? fs.existsSync(path.join(libSrcDir, navFile.target))
      : true;

    const fileSpinner = ora('').start();
    const newFiles: FileChecksum[] = [];
    let moduleHadConflict = false;

    for (const file of modFiles) {
      fileSpinner.text = `  Processing ${path.basename(file.target)}...`;

      // Lib targets are literal paths (no .tsx/.jsx ext swap) — must match copyLibModule.
      const finalPath = path.join(libSrcDir, file.target);
      const installed = installedRecord?.files.find(f => f.target === file.target);

      // The nav config is adopt-once: it accumulates user edits and
      // CLI-inserted route-module entries — upgrades create it when missing
      // but never overwrite or merge it.
      if (
        file.target.endsWith('components/layout/navigation.ts') &&
        fs.existsSync(finalPath)
      ) {
        const existing = await fs.readFile(finalPath, 'utf-8');
        newFiles.push({
          target: file.target,
          sourceSha256: file.sourceSha256,
          sha256: hashTransformed(existing),
          ref,
          state: 'clean',
        });
        continue;
      }

      const onDisk = await fs.pathExists(finalPath);
      if (!force && !staleTargets.has(file.target) && onDisk && installed) {
        newFiles.push(installed);
        continue;
      }

      if (!(await sourceFileExists(file.source))) {
        fileSpinner.warn(`    Source not found: ${file.source}`);
        if (installed) newFiles.push(installed);
        continue;
      }

      const rawContent = await resolveSourceFile(file.source);
      const newContent = transformLibContent(rawContent, file, moduleName, config, sourcePackage, release);

      const { record, conflict } = await processModifiableFile({
        finalPath,
        relativeTarget: file.target,
        newContent,
        newSourceSha256: file.sourceSha256,
        ref,
        installed,
        strategy,
        dryRun,
        fileSpinner,
        getBaseContent: async () => {
          if (isAdoption) return null; // no baseline to merge against
          const baseRaw = await fetchBaseSource(file.source, installed, sourcePackage, installedRecord?.version);
          if (baseRaw === null) return null;
          return transformLibContent(
            baseRaw, file, moduleName, config, sourcePackage,
            installedRecord?.release ?? release
          );
        },
      });
      newFiles.push(record);
      if (conflict) { moduleHadConflict = true; conflicts++; }
    }

    fileSpinner.stop();

    // Lib deps may carry version specifiers (e.g. "@supabase/ssr@^0.5") — strip
    // to the bare name, matching add.ts.
    mod.dependencies?.forEach(dep => externalDeps.add(dep.replace(/@[^@/]*$/, '')));

    const pendingCount = newFiles.filter(f => f.state === 'pending').length;

    if (!dryRun) {
      if (!config.lib) config.lib = {};
      config.lib[moduleName] = {
        release,
        ref,
        sourcePackage,
        installedAt: installedRecord?.installedAt ?? new Date().toISOString(),
        files: newFiles,
      };
      if (!config.installedLib.includes(moduleName)) config.installedLib.push(moduleName);
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
    if (moduleHadConflict) {
      console.log(chalk.yellow(`  ⚠ ${moduleName} ${verb} ${release} (conflicts — resolve .new files, then re-run)`));
    } else if (pendingCount > 0) {
      console.log(chalk.yellow(`  ⚠ ${moduleName} ${verb} ${release} (${pendingCount} file(s) still pending)`));
    } else {
      console.log(chalk.green(`  ✓ ${moduleName} ${verb} ${release}`));
    }
    upgraded++;
  }

  if (!dryRun && dirty) {
    config.release = release;
    // Only claim v3 once EVERY record actually carries upstream hashes. A
    // targeted `upgrade input` on a v2 manifest re-baselines that one component
    // and leaves the rest v2; stamping v3 there would silence loadConfig's
    // migrate hint while most of the manifest still cannot be compared.
    if (allRecordsAreV3(config)) config.schemaVersion = 3;
    await saveConfig(cwd, config);
  }

  // Install npm deps the upgraded source now needs but the app lacks.
  // `--yes` (non-interactive) installs without prompting, like bootstrap.
  if (externalDeps.size > 0) {
    console.log(chalk.bold('\n📦 External dependencies...\n'));
    await ensureExternalDeps({
      cwd,
      deps: externalDeps,
      autoInstall: options.yes ? true : undefined,
      dryRun,
    });
  }

  console.log('\n' + chalk.bold('Summary:'));
  console.log(`  Upgraded : ${upgraded}`);
  console.log(`  Skipped  : ${skipped}`);
  if (conflicts > 0) {
    console.log(chalk.yellow(`  Conflicts: ${conflicts} (.new files written — please review)`));
  }
  console.log('');
}

/**
 * The exact bytes this consumer installed, for use as the diff3 base.
 *
 * v3 records the ref each file came from, so the base is fetched from that ref
 * — the true common ancestor. Before v3 the CLI guessed a tag from the recorded
 * version, which was wrong whenever the install came from `main` between
 * releases, or whenever the guessed tag did not exist (the CLI and MCP packages
 * were untagged at several releases). That path remains only for manifests that
 * have not been migrated yet.
 *
 * Returns null when no base is reachable — the caller writes a `.new` file and
 * marks the entry pending.
 */
async function fetchBaseSource(
  source: string,
  installed: FileChecksum | undefined,
  sourcePackage: string,
  legacyVersion: string | undefined
): Promise<string | null> {
  if (installed?.ref && !installed.ref.startsWith('url:') && installed.ref !== 'local') {
    try {
      return await fetchSourceAtRef(source, installed.ref);
    } catch {
      return null;
    }
  }
  // Legacy v2 record: no ref was stored. Fall back to the version guess.
  if (!legacyVersion) return null;
  try {
    return await fetchSourceAtVersion(source, sourcePackage, legacyVersion);
  } catch {
    return null;
  }
}

/**
 * True when every installed component and lib module records an upstream hash
 * for every file — i.e. the whole manifest can answer the v3 staleness question.
 */
function allRecordsAreV3(config: Config): boolean {
  const records = [
    ...Object.values(config.components ?? {}),
    ...Object.values(config.lib ?? {}),
  ];
  if (records.length === 0) return false;
  return records.every(r => (r.files ?? []).every(f => !!f.sourceSha256));
}
