/**
 * Buildpad CLI - Add Command
 * 
 * Copy & Own Model:
 * - Copies component source files to your project
 * - Transforms @buildpad/* imports to local paths
 * - Auto-copies required lib modules (types, services, hooks)
 * - No runtime dependency on external packages
 */

import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import ora, { type Ora } from 'ora';
import prompts from 'prompts';
import { type Config, type FileChecksum, loadConfig, saveConfig } from './init.js';
import {
  transformImports,
  transformRelativeImports,
  transformIntraComponentImports,
  transformVFormImports,
  addOriginHeader,
  hashTransformed
} from './transformer.js';
import { inferSourcePackage, resolvePackageVersion, semverGte } from '../utils/checksum.js';
import { ensureExternalDeps } from '../utils/external-deps.js';
import { validate } from './validate.js';
import {
  getRegistry as fetchRegistry,
  resolveSourceFile,
  sourceFileExists,
  type Registry,
  type ComponentEntry,
  type LibModule,
} from '../resolver.js';

/**
 * Load registry (local or remote via resolver)
 */
async function getRegistry(): Promise<Registry> {
  try {
    return await fetchRegistry();
  } catch (err: any) {
    console.error(chalk.red('Failed to load registry:', err.message));
    process.exit(1);
  }
}

// Dependency version pins + shared installer live in ../utils/external-deps.js
// (shared with `upgrade`, which must install deps a new version introduces).

/**
 * Common component aliases for better discovery
 */
const COMPONENT_ALIASES: Record<string, string> = {
  'form': 'vform',
  'dynamicform': 'vform',
  'v-form': 'vform',
  'select': 'select-dropdown',
  'dropdown': 'select-dropdown',
  'checkbox': 'boolean',
  'switch': 'toggle',
  'date': 'datetime',
  'time': 'datetime',
  'datepicker': 'datetime',
  'text': 'input',
  'textinput': 'input',
  'textfield': 'input',
  'image': 'file-image',
  'imageupload': 'file-image',
  'wysiwyg': 'rich-text-html',
  'richtext': 'rich-text-html',
  'markdown': 'rich-text-markdown',
  'md': 'rich-text-markdown',
  'm2m': 'list-m2m',
  'm2o': 'select-dropdown-m2o',
  'o2m': 'list-o2m',
  'm2a': 'list-m2a',
  'manytomany': 'list-m2m',
  'manytoone': 'select-dropdown-m2o',
  'onetomany': 'list-o2m',
  'manytoany': 'list-m2a',
  'relation': 'select-dropdown-m2o',
  'multiselect': 'select-multiple-dropdown',
  'checkboxes': 'select-multiple-checkbox',
  'radio': 'select-radio',
  'icon': 'select-icon',
  'colorpicker': 'color',
  'fileupload': 'file',
  'code': 'input-code',
  'blockeditor': 'input-block-editor',
  'editor': 'input-block-editor',
};

/**
 * Find component with smart matching and suggestions
 */
function findComponentWithSuggestions(name: string, registry: Registry): ComponentEntry | null {
  const normalized = name.toLowerCase().replace(/-/g, '');
  
  // Direct match by name
  const directMatch = registry.components.find(
    c => c.name.toLowerCase() === name.toLowerCase()
  );
  if (directMatch) return directMatch;
  
  // Match by title
  const titleMatch = registry.components.find(
    c => c.title.toLowerCase() === name.toLowerCase()
  );
  if (titleMatch) return titleMatch;
  
  // Fuzzy match (remove dashes)
  const fuzzyMatch = registry.components.find(
    c => c.name.toLowerCase().replace(/-/g, '') === normalized ||
         c.title.toLowerCase().replace(/-/g, '') === normalized
  );
  if (fuzzyMatch) return fuzzyMatch;
  
  // Check aliases
  const aliasedName = COMPONENT_ALIASES[normalized];
  if (aliasedName) {
    const aliasMatch = registry.components.find(c => c.name === aliasedName);
    if (aliasMatch) {
      console.log(chalk.yellow(`\n💡 "${name}" matched alias → using "${aliasMatch.name}"\n`));
      return aliasMatch;
    }
  }
  
  // No match found - provide helpful suggestions
  console.log(chalk.red(`\n✗ Component not found: ${name}\n`));
  
  // Find similar components
  const suggestions = registry.components
    .map(c => ({
      component: c,
      score: calculateSimilarity(normalized, c.name.replace(/-/g, '')) +
             calculateSimilarity(normalized, c.title.toLowerCase().replace(/-/g, '')) +
             (c.description.toLowerCase().includes(name.toLowerCase()) ? 0.3 : 0)
    }))
    .filter(s => s.score > 0.2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
  
  if (suggestions.length > 0) {
    console.log(chalk.yellow('Did you mean one of these?\n'));
    suggestions.forEach(s => {
      console.log(`  ${chalk.green(s.component.name.padEnd(28))} ${chalk.dim(s.component.description)}`);
    });
    console.log();
  }
  
  // Show category hint
  const categoryHint = registry.categories.find(cat => 
    name.toLowerCase().includes(cat.name.toLowerCase())
  );
  if (categoryHint) {
    console.log(chalk.dim(`Try: buildpad add --category ${categoryHint.name}\n`));
  }
  
  console.log(chalk.dim('Commands to help you find components:'));
  console.log(chalk.dim('  buildpad list              List all components'));
  console.log(chalk.dim('  buildpad list --category   Filter by category'));
  console.log(chalk.dim('  buildpad info <name>       Get component details\n'));
  
  return null;
}

/**
 * Simple similarity score (0-1)
 */
function calculateSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.7;
  
  // Count matching characters
  let matches = 0;
  const shorter = a.length < b.length ? a : b;
  const longer = a.length < b.length ? b : a;
  
  for (let i = 0; i < shorter.length; i++) {
    if (longer.includes(shorter[i])) matches++;
  }
  
  return matches / longer.length;
}

/**
 * Options for {@link copyLibModule}. By default source files are read via the
 * remote/local resolver; callers (e.g. `init`) can override `readSource` /
 * `sourceExists` to install from the bundled CLI templates instead.
 */
export interface CopyLibModuleOptions {
  readSource?: (source: string) => Promise<string>;
  sourceExists?: (source: string) => Promise<boolean>;
}

/**
 * Copy and transform a lib module (types, services, hooks, design-system, …).
 * Records per-file checksums in `config.lib[moduleName]` so the module can be
 * refreshed later via `upgrade` with three-way merge.
 */
export async function copyLibModule(
  moduleName: string,
  registry: Registry,
  config: Config,
  cwd: string,
  spinner: Ora,
  overwrite = false,
  opts: CopyLibModuleOptions = {}
): Promise<boolean> {
  const readSource = opts.readSource ?? resolveSourceFile;
  const checkSource = opts.sourceExists ?? sourceFileExists;

  const libModule = registry.lib[moduleName];
  if (!libModule) {
    spinner.warn(`Lib module not found: ${moduleName}`);
    return false;
  }

  // Check if already installed — skip only when NOT overwriting and all files exist on disk
  if (config.installedLib.includes(moduleName) && !overwrite) {
    // Verify files actually exist; if any are missing, continue to re-copy
    const srcDir = config.srcDir ? path.join(cwd, 'src') : cwd;
    const allExist = (libModule.files ?? []).every((f: { target: string }) =>
      fs.existsSync(path.join(srcDir, f.target))
    );
    if (allExist) return true;
  }

  // First, install dependencies. Always recurse — copyLibModule self-skips
  // when the module is installed AND complete, but re-copies when the
  // registry has since gained files (e.g. hooks gaining useUsers.ts).
  if (libModule.internalDependencies) {
    for (const dep of libModule.internalDependencies) {
      await copyLibModule(dep, registry, config, cwd, spinner, false, opts);
    }
  }

  // Track per-file checksums for v2 manifest. The "primary" sourcePackage
  // for the lib module is inferred from its first source file (most lib
  // modules are single-package, mixed modules just attribute to the
  // dominant source).
  const writtenFiles: FileChecksum[] = [];
  let primarySource: string | undefined;

  // Handle single file module (like utils)
  if (libModule.path && libModule.target) {
    const targetPath = path.join(
      config.srcDir ? path.join(cwd, 'src') : cwd,
      libModule.target
    );

    if (await checkSource(libModule.path)) {
      const sourcePackage = inferSourcePackage(libModule.path);
      const version = resolvePackageVersion(registry, sourcePackage);
      let content = await readSource(libModule.path);
      content = transformImports(content, config);
      content = addOriginHeader(content, moduleName, sourcePackage, version);
      await fs.ensureDir(path.dirname(targetPath));
      await fs.writeFile(targetPath, content);
      writtenFiles.push({ target: libModule.target, sha256: hashTransformed(content) });
      primarySource = libModule.path;
    }
  }

  // Handle multi-file module
  if (libModule.files) {
    for (const file of libModule.files) {
      const targetPath = path.join(
        config.srcDir ? path.join(cwd, 'src') : cwd,
        file.target
      );

      // The nav config is adopt-once: it accumulates user edits and
      // CLI-inserted route-module entries, so overwrites would lose them.
      if (
        file.target.endsWith('components/layout/navigation.ts') &&
        fs.existsSync(targetPath)
      ) {
        const existing = await fs.readFile(targetPath, 'utf-8');
        writtenFiles.push({ target: file.target, sha256: hashTransformed(existing) });
        continue;
      }

      if (await checkSource(file.source)) {
        const sourcePackage = inferSourcePackage(file.source);
        const version = resolvePackageVersion(registry, sourcePackage);
        let content = await readSource(file.source);
        content = transformImports(content, config);
        // Extract filename for origin tracking
        const fileName = path.basename(file.source, path.extname(file.source));
        content = addOriginHeader(content, `${moduleName}/${fileName}`, sourcePackage, version);
        await fs.ensureDir(path.dirname(targetPath));
        await fs.writeFile(targetPath, content);
        writtenFiles.push({ target: file.target, sha256: hashTransformed(content) });
        if (!primarySource) primarySource = file.source;
      } else {
        spinner.warn(`Source file not found: ${file.source}`);
      }
    }
  }

  if (!config.installedLib.includes(moduleName)) {
    config.installedLib.push(moduleName);
  }

  // v2: record per-file checksums in `config.lib[moduleName]`
  if (config.schemaVersion === 2 && writtenFiles.length > 0 && primarySource) {
    const sourcePackage = inferSourcePackage(primarySource);
    const version = resolvePackageVersion(registry, sourcePackage);
    if (!config.lib) config.lib = {};
    config.lib[moduleName] = {
      version,
      sourcePackage,
      installedAt: new Date().toISOString(),
      files: writtenFiles,
    };
    if (!config.packageVersions) config.packageVersions = {};
    config.packageVersions[sourcePackage] = version;
  }

  spinner.succeed(`Installed lib: ${moduleName}`);
  return true;
}

const NAV_INSERT_MARKER = 'buildpad:nav-insert';

/**
 * Append a route module's sidebar entries to components/layout/navigation.ts
 * (part of the design-system module). Idempotent — entries are matched by
 * href, so re-runs and user edits/reordering are preserved. Degrades to a
 * copy-paste hint when the file or its insert marker is missing (older
 * design-system copies, custom shells).
 */
export async function applyNavItems(
  libModule: LibModule,
  config: Config,
  cwd: string,
  spinner: Ora
): Promise<void> {
  const items = libModule.navItems ?? [];
  if (items.length === 0) return;

  const srcDir = config.srcDir ? path.join(cwd, 'src') : cwd;
  const navPath = path.join(srcDir, 'components/layout/navigation.ts');

  const entryLine = (i: NonNullable<LibModule['navItems']>[number], indent = '  ') =>
    `${indent}{ label: "${i.label}", href: "${i.href}", icon: ${i.icon}` +
    (i.section ? `, section: "${i.section}"` : '') +
    ` },`;

  const manualHint = () => {
    const lines = items.map(i => entryLine(i)).join('\n');
    spinner.warn(
      `Could not update the sidebar automatically. Add these entries to your nav (see https://buildpad.dev/app-shell):\n` +
      chalk.dim(lines) +
      chalk.dim(`\n  (run "buildpad upgrade --design" to get the CLI-managed components/layout/navigation.ts)`)
    );
  };

  if (!fs.existsSync(navPath)) {
    manualHint();
    return;
  }

  let content = await fs.readFile(navPath, 'utf-8');
  if (!content.includes(NAV_INSERT_MARKER)) {
    manualHint();
    return;
  }

  const missing = items.filter(
    i => !content.includes(`href: "${i.href}"`) && !content.includes(`href: '${i.href}'`)
  );
  if (missing.length === 0) return;

  // Ensure the needed @tabler/icons-react imports exist (single or multi-line form)
  const importMatch = content.match(
    /import\s*\{([^}]*)\}\s*from\s*["']@tabler\/icons-react["']/
  );
  if (importMatch) {
    const existing = importMatch[1].split(',').map(s => s.trim()).filter(Boolean);
    const toAdd = [...new Set(missing.map(i => i.icon))].filter(icon => !existing.includes(icon));
    if (toAdd.length > 0) {
      const updated = importMatch[0].replace(
        importMatch[1],
        ` ${[...existing, ...toAdd].join(', ')} `
      );
      content = content.replace(importMatch[0], updated);
    }
  }

  // Insert entries above the marker line, preserving its indentation
  const markerLine = content.split('\n').find(l => l.includes(NAV_INSERT_MARKER))!;
  const indent = markerLine.match(/^\s*/)?.[0] ?? '  ';
  const entries = missing.map(i => entryLine(i, indent)).join('\n');
  content = content.replace(markerLine, `${entries}\n${markerLine}`);

  await fs.writeFile(navPath, content);

  // Keep the v2 manifest checksum in sync so status/diff see the file as clean.
  for (const record of Object.values(config.lib ?? {})) {
    const entry = record.files?.find(f =>
      f.target.endsWith('components/layout/navigation.ts')
    );
    if (entry) entry.sha256 = hashTransformed(content);
  }

  spinner.succeed(
    `Added ${missing.map(i => i.label).join(', ')} to the sidebar (components/layout/navigation.ts)`
  );
}

/**
 * Dry run info for component preview
 */
interface DryRunInfo {
  component: string;
  files: { source: string; target: string }[];
  dependencies: string[];
  libDependencies: string[];
}

/**
 * Copy and transform a component
 */
/**
 * Staleness of an already-installed component vs the registry (Config v2 only).
 * A component is stale when the version recorded at install time predates the
 * last registry version that changed the component's files (`lastChangedIn`).
 */
export function getInstalledStaleness(
  component: ComponentEntry,
  registry: Registry,
  config: Config
): { stale: boolean; installedVersion?: string; lastChangedIn?: string } {
  if ((config.schemaVersion ?? 1) < 2 || !registry.packages) return { stale: false };
  const record = config.components?.[component.name];
  if (!record?.version) return { stale: false }; // pre-tracking install — leave alone
  const sourcePackage =
    component.sourcePackage ?? inferSourcePackage(component.files[0]?.source ?? '');
  const latest = resolvePackageVersion(registry, sourcePackage, registry.version);
  const lastChangedIn = component.lastChangedIn ?? latest;
  if (semverGte(record.version, lastChangedIn)) return { stale: false };
  return { stale: true, installedVersion: record.version, lastChangedIn };
}

/**
 * True when every file recorded for the installed component is either missing
 * on disk or byte-identical (modulo origin header / line endings) to what the
 * CLI originally wrote — i.e. re-copying cannot destroy any user edits.
 */
export function isInstallPristine(componentName: string, config: Config, cwd: string): boolean {
  const record = config.components?.[componentName];
  if (!record?.files?.length) return false; // no manifest — can't verify, don't touch
  for (const file of record.files) {
    const abs = path.join(cwd, file.target);
    if (!fs.existsSync(abs)) continue; // missing → nothing to lose by re-copying
    const content = fs.readFileSync(abs, 'utf-8');
    if (hashTransformed(content) !== file.sha256) return false;
  }
  return true;
}

/**
 * Walk a component's dependency tree (lib modules + registry components).
 * Called both when a component installs and when it is skipped as already
 * installed, so stale-but-unmodified dependencies self-heal no matter where
 * they sit in the tree (e.g. `add users-routes` refreshing an outdated
 * `system-permissions` two levels down).
 */
async function visitDependencies(
  component: ComponentEntry,
  registry: Registry,
  config: Config,
  cwd: string,
  overwrite: boolean,
  spinner: Ora,
  installing: Set<string>,
  dryRun: boolean,
  dryRunInfo?: DryRunInfo[]
): Promise<void> {
  // Install internal dependencies first (types, services, hooks).
  // Always call — copyLibModule self-skips when installed AND complete,
  // but re-copies when the registry has since gained files (e.g. hooks
  // gaining useUsers.ts), so stale modules self-heal.
  for (const dep of (component.internalDependencies ?? [])) {
    spinner.text = `Installing dependency: ${dep}...`;
    if (!dryRun) {
      await copyLibModule(dep, registry, config, cwd, spinner);
    }
  }

  // Registry dependencies (other components). Recurse even into installed
  // ones — copyComponent's guard returns cheaply when they are up to date
  // and self-heals stale unmodified copies. Installed deps stay out of dry
  // runs to keep `--dry-run` output focused on new files.
  for (const depName of (component.registryDependencies ?? [])) {
    if (installing.has(depName)) continue;
    if (dryRun && config.installedComponents.includes(depName)) continue;
    const depComponent = registry.components.find(c => c.name === depName);
    if (depComponent) {
      spinner.text = `Installing component dependency: ${depComponent.title}...`;
      await copyComponent(depComponent, registry, config, cwd, overwrite, spinner, installing, dryRun, dryRunInfo);
    }
  }
}

async function copyComponent(
  component: ComponentEntry,
  registry: Registry,
  config: Config,
  cwd: string,
  overwrite: boolean,
  spinner: Ora,
  installing = new Set<string>(),  // Track components being installed to prevent circular deps
  dryRun = false,  // Preview mode - don't write files
  dryRunInfo?: DryRunInfo[]  // Collect dry run info
): Promise<boolean> {
  // Check for circular dependency
  if (installing.has(component.name)) {
    return true; // Already being installed in this call stack
  }

  // Check if already installed
  if (config.installedComponents.includes(component.name) && !overwrite && !dryRun) {
    // installing.size > 0 means we're in a recursive call from a parent copyComponent.
    const nonInteractive = installing.has('__nonInteractive__') || installing.size > 0;
    const staleness = getInstalledStaleness(component, registry, config);
    let reinstall = false;
    let declined = false;

    if (staleness.stale && isInstallPristine(component.name, config, cwd)) {
      // Outdated but unmodified since install — re-copying cannot lose user
      // edits, so self-heal instead of silently keeping stale code.
      spinner.info(
        `${component.title} ${staleness.installedVersion} is outdated (changed in ${staleness.lastChangedIn}) — refreshing unmodified copy`
      );
      spinner.start(`Adding ${component.title}...`);
      reinstall = true;
    } else if (staleness.stale) {
      // Outdated AND locally modified — never clobber silently.
      spinner.warn(
        `${component.title} is outdated (${staleness.installedVersion} → ${staleness.lastChangedIn}) but has local edits — keeping yours. Merge updates with: npx buildpad upgrade ${component.name}`
      );
      if (!nonInteractive) {
        spinner.stop();
        const { shouldOverwrite } = await prompts({
          type: 'confirm',
          name: 'shouldOverwrite',
          message: `${component.title} has local edits. Overwrite and DISCARD them? (choose No and run "buildpad upgrade ${component.name}" to merge instead)`,
          initial: false,
        });
        if (shouldOverwrite) {
          reinstall = true;
          spinner.start(`Adding ${component.title}...`);
        } else {
          declined = true;
        }
      } else {
        spinner.start();
      }
    } else {
      // Up to date (or untracked) — original behavior: silently skip in
      // non-interactive/batch mode (--all, bootstrap) and for transitive deps.
      if (!nonInteractive) {
        // Stop the spinner so the interactive prompt is visible to the user
        spinner.stop();
        const { shouldOverwrite } = await prompts({
          type: 'confirm',
          name: 'shouldOverwrite',
          message: `${component.title} already installed. Overwrite?`,
          initial: false,
        });
        if (shouldOverwrite) {
          reinstall = true;
          // Restart the spinner for the rest of the operation
          spinner.start(`Adding ${component.title}...`);
        } else {
          declined = true;
        }
      }
    }

    if (!reinstall) {
      // This component keeps its current files, but its dependency tree is
      // still visited so outdated unmodified deps refresh themselves.
      installing.add(component.name);
      await visitDependencies(component, registry, config, cwd, overwrite, spinner, installing, dryRun, dryRunInfo);
      if (declined) {
        spinner.info(`Skipped ${component.title}`);
        return false;
      }
      return true;
    }
  }

  // Mark as being installed to prevent circular deps
  installing.add(component.name);

  // Collect dry run info
  const info: DryRunInfo = {
    component: component.name,
    files: component.files.map(f => ({ source: f.source, target: f.target })),
    dependencies: component.dependencies,
    libDependencies: component.internalDependencies ?? [],
  };

  // Install dependencies (lib modules + other components) first
  await visitDependencies(component, registry, config, cwd, overwrite, spinner, installing, dryRun, dryRunInfo);

  // In dry run mode, just collect info and return
  if (dryRun) {
    if (dryRunInfo) {
      dryRunInfo.push(info);
    }
    spinner.info(`Would add ${component.title}`);
    return true;
  }

  // Copy component files
  for (const file of component.files) {
    const targetPath = path.join(
      config.srcDir ? path.join(cwd, 'src') : cwd,
      file.target
    );

    if (!(await sourceFileExists(file.source))) {
      spinner.warn(`Source not found: ${file.source}`);
      continue;
    }

    // Read and transform
    let content = await resolveSourceFile(file.source);
    
    // Transform intra-component relative imports using registry file mappings
    // (must run BEFORE normalizeImportPaths to avoid partial/incorrect transforms)
    content = transformIntraComponentImports(content, file.source, file.target, component.files);
    
    content = transformImports(content, config, file.target);
    
    // Transform relative imports for flattened folder structure
    // Skip for VForm files — they keep their nested folder structure and
    // transformIntraComponentImports already resolved their paths correctly.
    if (!(component.name === 'vform' || file.target.includes('/vform/'))) {
      content = transformRelativeImports(content, file.source, file.target, config.aliases.components);
    }
    
    // Apply VForm-specific transformations for files in vform folder
    if (component.name === 'vform' || file.target.includes('/vform/')) {
      content = transformVFormImports(content, file.source, file.target);
    }
    
    // Determine source package for this component (v2 registry supplies it, fallback for v1)
    const sourcePackage = component.sourcePackage ?? '@buildpad/ui-interfaces';
    // Determine version: prefer per-package version from v2 registry, fallback to global
    const regV2 = registry;
    const componentVersion =
      regV2.packages?.[sourcePackage]?.version ?? component.version ?? registry.version;

    // Add origin header for maintainability
    content = addOriginHeader(content, component.name, sourcePackage, componentVersion);

    // Ensure directory exists
    await fs.ensureDir(path.dirname(targetPath));
    
    // Write transformed file
    const ext = config.tsx ? '.tsx' : '.jsx';
    const finalPath = targetPath.replace(/\.tsx?$/, ext);
    await fs.writeFile(finalPath, content);

    // v2: record per-file sha256 (computed over content without the origin header)
    if (config.schemaVersion === 2) {
      if (!config.components) config.components = {};
      if (!config.components[component.name]) {
        config.components[component.name] = {
          version: componentVersion,
          sourcePackage,
          installedAt: new Date().toISOString(),
          files: [],
        };
      }
      // Use relative target path for portability
      const relTarget = file.target;
      const existingIdx = config.components[component.name].files.findIndex(f => f.target === relTarget);
      const checksum = { target: relTarget, sha256: hashTransformed(content) };
      if (existingIdx >= 0) {
        config.components[component.name].files[existingIdx] = checksum;
      } else {
        config.components[component.name].files.push(checksum);
      }
    }
  }

  // Determine source package / version once for the whole component
  const sourcePackageFinal = component.sourcePackage ?? '@buildpad/ui-interfaces';
  const regV2Final = registry;
  const installVersion =
    regV2Final.packages?.[sourcePackageFinal]?.version ?? component.version ?? registry.version;

  // Track installation with version info
  if (!config.installedComponents.includes(component.name)) {
    config.installedComponents.push(component.name);
  }
  
  // Track component version (v1 compat)
  if (!config.componentVersions) {
    config.componentVersions = {};
  }
  config.componentVersions[component.name] = {
    version: installVersion,
    installedAt: new Date().toISOString(),
    source: sourcePackageFinal,
  };

  // v2: update components map installedAt + packageVersions
  if (config.schemaVersion === 2) {
    if (!config.components) config.components = {};
    if (config.components[component.name]) {
      config.components[component.name].installedAt = new Date().toISOString();
      config.components[component.name].version = installVersion;
    }
    if (!config.packageVersions) config.packageVersions = {};
    config.packageVersions[sourcePackageFinal] = installVersion;
  }

  spinner.succeed(`Added ${component.title}`);
  return true;
}

/**
 * Generate components/ui/index.ts with exports for all installed components
 * This allows import { ComponentA, ComponentB } from '@/components/ui'
 * 
 * Also detects duplicate named exports across files and warns the user.
 */
async function generateComponentsIndex(
  config: Config,
  cwd: string,
  registry: Registry,
  spinner: Ora
): Promise<void> {
  const srcDir = config.srcDir ? path.join(cwd, 'src') : cwd;
  const componentsDir = path.join(srcDir, 'components/ui');
  const indexPath = path.join(componentsDir, 'index.ts');
  
  spinner.text = 'Generating components/ui/index.ts...';
  
  // Build export lines for each installed component
  const exportLines: string[] = [
    '/**',
    ' * Buildpad UI Components Index',
    ' * ',
    ' * Auto-generated by Buildpad CLI.',
    ' * Re-run "buildpad add" to update after adding new components.',
    ' */',
    '',
  ];
  
  // Use Set to track unique export paths and prevent duplicates
  const exportedPaths = new Set<string>();
  
  // Track named exports across files to detect duplicates
  const namedExportMap = new Map<string, string[]>(); // exportName -> [files]
  
  // Sort components alphabetically for consistent output
  const sortedComponents = [...config.installedComponents].sort();
  
  // Components with known SSR issues that should use wrappers
  const ssrUnsafeComponents: Record<string, string> = {
    'input-block-editor': 'input-block-editor-wrapper',
  };
  
  // Track skipped components due to SSR wrappers
  const skippedForWrapper: string[] = [];
  
  for (const componentName of sortedComponents) {
    const component = registry.components.find(c => c.name === componentName);
    if (!component) continue;
    
    // Determine the export path based on component structure
    const mainFile = component.files[0];
    if (!mainFile) continue;
    
    const targetPath = mainFile.target;
    let exportPath: string;

    // Check if component is in a subfolder (e.g., vform/VForm.tsx,
    // users-management/users-manager.tsx) or flat (e.g., input.tsx).
    // Foldered components ship their own index.ts barrel — export the folder.
    const relToComponents = targetPath.replace(/^components\/ui\//, '');
    const folderName = relToComponents.includes('/')
      ? relToComponents.split('/')[0]
      : null;
    if (folderName) {
      exportPath = `./${folderName}`;
    } else {
      // Flat structure - export from kebab-case file
      const fileName = path.basename(targetPath, path.extname(targetPath));
      
      // Check for SSR wrapper replacements
      if (ssrUnsafeComponents[fileName]) {
        const wrapperPath = path.join(componentsDir, `${ssrUnsafeComponents[fileName]}.tsx`);
        if (fs.existsSync(wrapperPath)) {
          exportPath = `./${ssrUnsafeComponents[fileName]}`;
          skippedForWrapper.push(fileName);
        } else {
          exportPath = `./${fileName}`;
        }
      } else {
        exportPath = `./${fileName}`;
      }
    }
    
    // Only add if not already exported (prevents duplicates)
    if (!exportedPaths.has(exportPath)) {
      exportedPaths.add(exportPath);
      exportLines.push(`export * from '${exportPath}';`);
      
      // Check for named exports in the file
      const filePath = path.join(componentsDir, exportPath.slice(2) + '.tsx');
      if (fs.existsSync(filePath)) {
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const namedExportPattern = /export\s+(?:const|function|class)\s+(\w+)/g;
          let match;
          while ((match = namedExportPattern.exec(content)) !== null) {
            const exportName = match[1];
            if (!namedExportMap.has(exportName)) {
              namedExportMap.set(exportName, []);
            }
            namedExportMap.get(exportName)!.push(exportPath);
          }
        } catch {
          // Ignore read errors
        }
      }
    }
  }
  
  // Write the index file
  await fs.writeFile(indexPath, exportLines.join('\n') + '\n');
  
  // Warn about duplicate named exports
  const duplicates = Array.from(namedExportMap.entries())
    .filter(([_, files]) => files.length > 1);
  
  if (duplicates.length > 0) {
    spinner.warn('Generated components/ui/index.ts (with duplicate warnings)');
    console.log(chalk.yellow('\n⚠ Duplicate export names detected:'));
    for (const [exportName, files] of duplicates) {
      console.log(chalk.dim(`  "${exportName}" exported from: ${files.join(', ')}`));
    }
    console.log(chalk.dim('  Consider using named imports or renaming exports.\n'));
  } else {
    spinner.info('Generated components/ui/index.ts');
  }
  
  if (skippedForWrapper.length > 0) {
    console.log(chalk.dim(`  ℹ Using SSR-safe wrappers for: ${skippedForWrapper.join(', ')}`));
  }
}

/**
 * Main add command
 */
export async function add(
  components: string[],
  options: {
    all?: boolean;
    withApi?: boolean;
    category?: string;
    overwrite?: boolean;
    dryRun?: boolean;
    nonInteractive?: boolean;
    cwd: string;
  }
) {
  const { cwd, all, withApi, category, overwrite = false, dryRun = false, nonInteractive = false } = options;

  // Dry run mode header
  if (dryRun) {
    console.log(chalk.yellow('\n🔍 Dry Run Mode - No files will be modified\n'));
  }

  // Load config
  const config = await loadConfig(cwd);
  if (!config) {
    console.log(chalk.red('\n✗ buildpad.json not found. Run "npx buildpad init" first.\n'));
    process.exit(1);
  }

  // Initialize componentVersions if not present
  if (!config.componentVersions) {
    config.componentVersions = {};
  }

  const registry = await getRegistry();

  // If --with-api flag is set, add api-routes and supabase-auth lib modules
  if (withApi || all) {
    console.log(chalk.bold('\n🔌 Installing API routes and Supabase auth...\n'));
    const spinner = ora('Processing lib modules...').start();

    // Install supabase-auth first (dependency of api-routes)
    if (registry.lib['supabase-auth'] && !config.installedLib.includes('supabase-auth')) {
      await copyLibModule('supabase-auth', registry, config, cwd, spinner);
    }

    // Install api-routes
    if (registry.lib['api-routes'] && !config.installedLib.includes('api-routes')) {
      await copyLibModule('api-routes', registry, config, cwd, spinner);
    }

    // Install external-oauth. The api-routes auth handlers (logout/login/callback)
    // import @/lib/oauth/*, so the oauth helpers must be present or those routes
    // fail to resolve. external-oauth depends back on api-routes/supabase-auth
    // (already installed above), so it only adds its own oauth files here — and
    // its oauth-aware callback intentionally supersedes the basic one.
    if (registry.lib['external-oauth'] && !config.installedLib.includes('external-oauth')) {
      await copyLibModule('external-oauth', registry, config, cwd, spinner);
    }

    spinner.succeed('API routes and auth installed!');
    await saveConfig(cwd, config);
  }

  // Determine which components to add
  let componentsToAdd: ComponentEntry[] = [];
  let libModulesToInstall: string[] = [];

  if (all) {
    // Opt-in feature modules (form-builder, file-manager) are excluded from
    // bulk installs / bootstrap. Install them explicitly by name.
    componentsToAdd = registry.components.filter(c => !c.excludeFromAll);
  } else if (category) {
    componentsToAdd = registry.components.filter(c => c.category === category);
    if (componentsToAdd.length === 0) {
      console.log(chalk.red(`\n✗ No components found in category: ${category}\n`));
      const categories = registry.categories.map(c => c.name).join(', ');
      console.log(chalk.dim(`Available categories: ${categories}\n`));
      process.exit(1);
    }
  } else if (components.length > 0) {
    for (const name of components) {
      // Check lib modules first — before searching components so we don't print
      // "Component not found" for valid lib module names like api-routes, supabase-auth.
      if (registry.lib[name]) {
        libModulesToInstall.push(name);
        // Route modules can require components (e.g. users-routes →
        // users-management, files-routes → file-manager) — queue them so a
        // single `add <module>-routes` installs the whole feature.
        for (const depName of registry.lib[name].registryDependencies ?? []) {
          const depComponent = registry.components.find(c => c.name === depName);
          if (depComponent && !componentsToAdd.some(c => c.name === depComponent.name)) {
            componentsToAdd.push(depComponent);
          }
        }
        continue;
      }
      const component = findComponentWithSuggestions(name, registry);
      if (!component) {
        process.exit(1);
      } else {
        componentsToAdd.push(component);
      }
    }
  } else {
    // Interactive selection
    const choices = registry.categories.map(cat => ({
      title: chalk.bold(cat.title),
      value: cat.name,
      description: cat.description,
    }));

    const { selectedCategory } = await prompts({
      type: 'select',
      name: 'selectedCategory',
      message: 'Select a category',
      choices,
    });

    if (!selectedCategory) {
      console.log(chalk.yellow('\n✓ No category selected\n'));
      return;
    }

    const categoryComponents = registry.components.filter(
      c => c.category === selectedCategory
    );

    const { selected } = await prompts({
      type: 'multiselect',
      name: 'selected',
      message: 'Select components to add',
      choices: categoryComponents.map(c => ({
        title: `${c.title} - ${c.description}`,
        value: c.name,
        selected: false,
      })),
      hint: '- Space to select. Return to submit',
    });

    componentsToAdd = registry.components.filter(c => selected?.includes(c.name));
  }

  if (componentsToAdd.length === 0 && libModulesToInstall.length === 0) {
    console.log(chalk.yellow('\n✓ No components selected\n'));
    return;
  }

  // Dry run mode - show what would be installed
  if (dryRun) {
    console.log(chalk.bold(`\n🔍 Dry Run: Would add ${componentsToAdd.length} component(s)\n`));
    
    const dryRunInfo: DryRunInfo[] = [];
    const spinner = ora('Analyzing...').start();
    
    for (const component of componentsToAdd) {
      spinner.text = `Analyzing ${component.title}...`;
      await copyComponent(component, registry, config, cwd, overwrite, spinner, new Set(), true, dryRunInfo);
    }
    
    spinner.stop();
    
    // Display dry run summary
    console.log(chalk.bold('\n📋 Files that would be created:\n'));
    
    for (const info of dryRunInfo) {
      console.log(chalk.cyan(`  ${info.component}:`));
      for (const file of info.files) {
        console.log(chalk.dim(`    → ${file.target}`));
      }
    }
    
    // Show dependencies
    const allDryRunDeps = new Set<string>();
    dryRunInfo.forEach(info => info.dependencies.forEach(dep => allDryRunDeps.add(dep)));
    
    if (allDryRunDeps.size > 0) {
      console.log(chalk.bold('\n📦 External dependencies needed:\n'));
      Array.from(allDryRunDeps).forEach(dep => console.log(chalk.dim(`    ${dep}`)));
    }
    
    console.log(chalk.dim('\n  Run without --dry-run to install components.\n'));
    return;
  }

  const totalItems = componentsToAdd.length + libModulesToInstall.length;
  console.log(chalk.bold(`\n📦 Adding ${totalItems} item(s)...\n`));

  const spinner = ora('Processing...').start();
  const allDeps = new Set<string>();

  try {
    // Share a single installing Set across all components to prevent duplicate processing
    const sharedInstalling = new Set<string>();
    // Signal non-interactive mode so already-installed components are silently skipped
    if (nonInteractive || all) {
      sharedInstalling.add('__nonInteractive__');
    }

    // Install any lib modules requested directly (e.g. buildpad add external-oauth)
    // Use overwrite=true so missing files from updated registry versions get copied.
    for (const libName of libModulesToInstall) {
      spinner.text = `Installing lib module: ${libName}...`;
      await copyLibModule(libName, registry, config, cwd, spinner, true);
      // Route modules can contribute sidebar entries (users-routes → Users/Roles/Policies)
      await applyNavItems(registry.lib[libName], config, cwd, spinner);
    }

    for (const component of componentsToAdd) {
      spinner.text = `Adding ${component.title}...`;
      await copyComponent(component, registry, config, cwd, overwrite, spinner, sharedInstalling, false);
      
      // Collect external dependencies
      component.dependencies.forEach(dep => allDeps.add(dep));
    }

    // Collect external dependencies from installed lib modules (e.g. @supabase/ssr)
    for (const libName of config.installedLib) {
      const libModule = registry.lib[libName];
      if (libModule?.dependencies) {
        for (const dep of libModule.dependencies) {
          // Strip version specifier (e.g. "@supabase/ssr@^0.5" -> "@supabase/ssr")
          allDeps.add(dep.replace(/@[^@/]*$/, ''));
        }
      }
    }

    // Update registry version (v1 compat)
    config.registryVersion = registry.version;

    // Save updated config
    await saveConfig(cwd, config);

    // Generate components/ui/index.ts with all exports
    await generateComponentsIndex(config, cwd, registry, spinner);

    spinner.succeed('All components added!');

    // Run post-install validation to catch any issues (skip in non-interactive mode — bootstrap runs its own)
    if (!nonInteractive) {
      console.log(chalk.bold('\n🔍 Running post-install validation...\n'));
      try {
        await validate({ cwd, json: false });
      } catch {
        // Validation errors are already printed, continue with summary
      }
    }

    // Check for missing external dependencies
    console.log(chalk.bold('\n📦 External dependencies...\n'));

    // In non-interactive mode (bootstrap), auto-install without prompting
    await ensureExternalDeps({
      cwd,
      deps: allDeps,
      autoInstall: nonInteractive ? true : undefined,
      announceClean: true,
    });

    // Summary
    console.log(chalk.bold.blue('📋 Summary:\n'));
    console.log(chalk.dim('Components installed:'));
    config.installedComponents.forEach(name => {
      console.log(chalk.green(`  ✓ ${name}`));
    });
    
    if (config.installedLib.length > 0) {
      console.log(chalk.dim('\nLib modules installed:'));
      config.installedLib.forEach(name => {
        console.log(chalk.green(`  ✓ ${name}`));
      });
    }

    console.log(chalk.bold.green('\n✨ Done!\n'));
    console.log(chalk.dim('Components are now part of your codebase. Customize freely!'));
    console.log(chalk.dim(`Location: ${config.aliases.components}\n`));

  } catch (error) {
    spinner.fail('Failed to add components');
    console.error(chalk.red(error));
    process.exit(1);
  }
}
