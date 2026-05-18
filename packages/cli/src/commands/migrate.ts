/**
 * Buildpad CLI - Migrate Command
 *
 * One-shot v1 → v2 migration of buildpad.json.
 *
 * What it does:
 *   1. Reads the existing buildpad.json
 *   2. Fetches the registry to get per-package versions
 *   3. For each installed component: re-fetches source files, transforms them
 *      in-memory, computes sha256 via hashTransformed(), and records in config.components
 *   4. Writes schemaVersion: 2 back to buildpad.json
 *
 * Safe to re-run — already-populated v2 entries are refreshed, not duplicated.
 */

import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
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
  type Registry,
} from '../resolver.js';
import {
  transformImports,
  transformRelativeImports,
  transformIntraComponentImports,
  transformVFormImports,
  addOriginHeader,
  hashTransformed,
} from './transformer.js';
import { inferSourcePackage, resolvePackageVersion } from '../utils/checksum.js';

async function getRegistry(): Promise<Registry> {
  try {
    return await fetchRegistry();
  } catch (err: any) {
    console.error(chalk.red('Failed to load registry:', err.message));
    process.exit(1);
  }
}

export async function migrate(options: {
  cwd: string;
  dryRun?: boolean;
}) {
  const { cwd, dryRun = false } = options;

  // Load config
  const config = await loadConfig(cwd);
  if (!config) {
    console.error(chalk.red('\n✗ buildpad.json not found. Run "npx buildpad init" first.\n'));
    process.exit(1);
  }

  if ((config.schemaVersion ?? 1) >= 2 && !dryRun) {
    console.log(chalk.green('\n✓ buildpad.json is already v2. Nothing to migrate.\n'));
    return;
  }

  console.log(chalk.bold('\n🔄 Migrating buildpad.json to schema v2...\n'));
  if (dryRun) {
    console.log(chalk.yellow('  (dry run — no files will be written)\n'));
  }

  const spinner = ora('Fetching registry...').start();
  const registry = await getRegistry();
  spinner.succeed('Registry loaded');

  // Build packageVersions from registry
  const packageVersions: Record<string, string> = {};
  if (registry.packages) {
    for (const [pkgName, info] of Object.entries(registry.packages)) {
      packageVersions[pkgName] = info.version;
    }
  } else {
    // v1 registry — all packages at the same global version
    packageVersions['@buildpad/ui-interfaces'] = registry.version;
  }

  // Migrate components
  const components: Record<string, ComponentInstall> = { ...config.components };
  const failed: string[] = [];

  const componentSpinner = ora('').start();
  for (const componentName of config.installedComponents) {
    componentSpinner.text = `Migrating component: ${componentName}...`;

    const regComponent = registry.components.find(c => c.name === componentName);
    if (!regComponent) {
      componentSpinner.warn(`  Component '${componentName}' not found in registry — skipped`);
      failed.push(componentName);
      componentSpinner.start();
      continue;
    }

    const sourcePackage = regComponent.sourcePackage ?? '@buildpad/ui-interfaces';
    const version = packageVersions[sourcePackage] ?? registry.version;
    const installedAt =
      config.componentVersions?.[componentName]?.installedAt ?? new Date().toISOString();

    const files: FileChecksum[] = [];

    for (const file of regComponent.files) {
      try {
        if (!(await sourceFileExists(file.source))) {
          componentSpinner.warn(`    Source not found: ${file.source}`);
          continue;
        }

        let content = await resolveSourceFile(file.source);

        // Apply the same transforms as add.ts
        content = transformIntraComponentImports(content, file.source, file.target, regComponent.files);
        content = transformImports(content, config, file.target);

        if (!(componentName === 'vform' || file.target.includes('/vform/'))) {
          content = transformRelativeImports(content, file.source, file.target, config.aliases.components);
        }
        if (componentName === 'vform' || file.target.includes('/vform/')) {
          content = transformVFormImports(content, file.source, file.target);
        }

        content = addOriginHeader(content, componentName, sourcePackage, version);

        files.push({ target: file.target, sha256: hashTransformed(content) });
      } catch {
        componentSpinner.warn(`    Failed to process: ${file.source}`);
      }
    }

    if (files.length > 0) {
      components[componentName] = {
        version,
        sourcePackage,
        installedAt,
        files,
      };
    }
  }

  componentSpinner.succeed(`Migrated ${config.installedComponents.length - failed.length} components`);

  // ── Migrate lib modules ────────────────────────────────────────────────
  const lib: Record<string, ComponentInstall> = { ...(config.lib ?? {}) };
  const libFailed: string[] = [];

  if (config.installedLib && config.installedLib.length > 0) {
    const libSpinner = ora('').start();
    for (const libName of config.installedLib) {
      libSpinner.text = `Migrating lib module: ${libName}...`;
      const libModule = registry.lib?.[libName];
      if (!libModule) {
        libSpinner.warn(`  Lib module '${libName}' not found in registry — skipped`);
        libFailed.push(libName);
        libSpinner.start();
        continue;
      }

      const files: FileChecksum[] = [];
      let primarySource: string | undefined;

      // Single-file lib (e.g. utils legacy shape)
      if (libModule.path && libModule.target) {
        primarySource = libModule.path;
        try {
          if (await sourceFileExists(libModule.path)) {
            const sp = inferSourcePackage(libModule.path);
            const v = resolvePackageVersion(registry, sp);
            let content = await resolveSourceFile(libModule.path);
            content = transformImports(content, config);
            content = addOriginHeader(content, libName, sp, v);
            files.push({ target: libModule.target, sha256: hashTransformed(content) });
          }
        } catch {
          /* ignore individual file failure */
        }
      }

      // Multi-file lib
      for (const file of (libModule.files ?? [])) {
        try {
          if (!(await sourceFileExists(file.source))) continue;
          if (!primarySource) primarySource = file.source;
          const sp = inferSourcePackage(file.source);
          const v = resolvePackageVersion(registry, sp);
          let content = await resolveSourceFile(file.source);
          content = transformImports(content, config);
          const fileName = path.basename(file.source, path.extname(file.source));
          content = addOriginHeader(content, `${libName}/${fileName}`, sp, v);
          files.push({ target: file.target, sha256: hashTransformed(content) });
        } catch {
          /* ignore individual file failure */
        }
      }

      if (files.length > 0 && primarySource) {
        const sp = inferSourcePackage(primarySource);
        const v = resolvePackageVersion(registry, sp);
        const installedAt =
          config.componentVersions?.[`lib/${libName}`]?.installedAt ?? new Date().toISOString();
        lib[libName] = { version: v, sourcePackage: sp, installedAt, files };
        // Make sure the package version is in the map
        if (!packageVersions[sp]) packageVersions[sp] = v;
      } else {
        libFailed.push(libName);
      }
    }
    libSpinner.succeed(
      `Migrated ${config.installedLib.length - libFailed.length} lib modules`
    );
  }

  // Update config
  const updatedConfig: Config = {
    ...config,
    schemaVersion: 2,
    components,
    lib,
    packageVersions,
  };

  if (!dryRun) {
    await saveConfig(cwd, updatedConfig);
    console.log(chalk.green('\n✓ buildpad.json upgraded to schema v2\n'));
  } else {
    console.log('\n  Would write schemaVersion: 2 with:');
    console.log(`    packageVersions: ${JSON.stringify(packageVersions, null, 2)}`);
    console.log(`    components: ${Object.keys(components).join(', ')}`);
  }

  if (failed.length > 0) {
    console.log(chalk.yellow(`\n  ⚠ ${failed.length} component(s) could not be migrated (not in registry):`));
    failed.forEach(n => console.log(chalk.dim(`    - ${n}`)));
    console.log(chalk.dim('  These will remain as v1 entries.\n'));
  }

  if (libFailed.length > 0) {
    console.log(chalk.yellow(`\n  ⚠ ${libFailed.length} lib module(s) could not be migrated (not in registry or unreadable):`));
    libFailed.forEach(n => console.log(chalk.dim(`    - ${n}`)));
    console.log(chalk.dim('  These will remain untracked in v2.\n'));
  }
}
