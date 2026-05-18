/**
 * Buildpad CLI - Outdated Command
 * 
 * Checks for component updates by comparing installed versions
 * to the current registry version.
 *
 * v2 logic:
 *  - Uses `registry.packages[sourcePackage].version` as "latest"
 *  - A component is "up to date" when `installed.version >= component.lastChangedIn`
 *    (the last package version that actually modified this component's files).
 *  - Falls back to v1 global-version comparison when schemaVersion < 2.
 */

import chalk from 'chalk';
import ora from 'ora';
import { loadConfig } from './init.js';
import {
  getRegistry as fetchRegistry,
  type Registry,
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

interface OutdatedEntry {
  name: string;
  installedVersion: string;
  latestVersion: string;
  lastChangedIn?: string;
  sourcePackage?: string;
  installedAt: string;
}

interface OutdatedResult {
  outdated: OutdatedEntry[];
  upToDate: string[];
  unknown: string[];
  registryVersion: string;
  installedRegistryVersion?: string;
  packageVersions?: Record<string, string>;
}

/** Compare semver strings — returns true if a >= b (simple string lex is fine for semver). */
function semverGte(a: string, b: string): boolean {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na !== nb) return na > nb;
  }
  return true; // equal
}

/**
 * Main outdated command
 */
export async function outdated(options: {
  cwd: string;
  json?: boolean;
}) {
  const { cwd, json = false } = options;
  
  // Load config
  const config = await loadConfig(cwd);
  if (!config) {
    if (json) {
      console.log(JSON.stringify({ error: 'buildpad.json not found' }));
    } else {
      console.log(chalk.red('\n✗ buildpad.json not found. Run "npx buildpad init" first.\n'));
    }
    process.exit(1);
  }
  
  const spinner = json ? null : ora('Checking for updates...').start();
  
  try {
    const registry = await getRegistry();
    const isV2 = (config.schemaVersion ?? 1) >= 2 && !!registry.packages;

    const result: OutdatedResult = {
      outdated: [],
      upToDate: [],
      unknown: [],
      registryVersion: registry.version,
      installedRegistryVersion: config.registryVersion,
      packageVersions: registry.packages
        ? Object.fromEntries(
            Object.entries(registry.packages).map(([k, v]) => [k, v.version])
          )
        : undefined,
    };
    
    // Check each installed component
    for (const componentName of config.installedComponents) {
      const regComponent = registry.components.find(c => c.name === componentName);

      if (isV2 && regComponent) {
        // ── v2 path ──────────────────────────────────────────────────────────
        const sourcePackage = regComponent.sourcePackage ?? '@buildpad/ui-interfaces';
        const latestVersion = registry.packages?.[sourcePackage]?.version ?? registry.version;
        const lastChangedIn = regComponent.lastChangedIn ?? latestVersion;
        const installedRecord = config.components?.[componentName];

        if (!installedRecord) {
          result.unknown.push(componentName);
          continue;
        }

        const installedVersion = installedRecord.version;

        // Component is up to date when the installed version is at or past the
        // last version that changed this component's files.
        if (semverGte(installedVersion, lastChangedIn)) {
          result.upToDate.push(componentName);
        } else {
          result.outdated.push({
            name: componentName,
            installedVersion,
            latestVersion,
            lastChangedIn,
            sourcePackage,
            installedAt: installedRecord.installedAt,
          });
        }
      } else {
        // ── v1 fallback path ─────────────────────────────────────────────────
        const versionInfo = config.componentVersions?.[componentName];
        
        if (!versionInfo) {
          result.unknown.push(componentName);
        } else if (versionInfo.version !== registry.version) {
          result.outdated.push({
            name: componentName,
            installedVersion: versionInfo.version,
            latestVersion: registry.version,
            installedAt: versionInfo.installedAt,
          });
        } else {
          result.upToDate.push(componentName);
        }
      }
    }
    
    // Check lib modules too (unknown without v2 records)
    for (const libName of config.installedLib) {
      const key = `lib/${libName}`;
      if (!config.lib?.[libName] && !config.componentVersions?.[key]) {
        result.unknown.push(key);
      }
    }
    
    spinner?.stop();
    
    if (json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    
    // Display results
    console.log(chalk.bold('\n📦 Component Update Status\n'));
    console.log(chalk.dim(`Registry version: ${registry.version}`));
    if (config.registryVersion) {
      console.log(chalk.dim(`Installed at registry version: ${config.registryVersion}\n`));
    } else {
      console.log(chalk.dim(`Installed at registry version: unknown\n`));
    }
    
    if (result.outdated.length > 0) {
      console.log(chalk.yellow(`\n⚠ ${result.outdated.length} component(s) have updates available:\n`));
      
      for (const comp of result.outdated) {
        const installedDate = new Date(comp.installedAt).toLocaleDateString();
        console.log(chalk.yellow(`  ${comp.name}`));
        const changedLabel = comp.lastChangedIn ? ` (changed in ${comp.lastChangedIn})` : '';
        console.log(chalk.dim(`    ${comp.installedVersion} → ${comp.latestVersion}${changedLabel} · installed ${installedDate}`));
        if (comp.sourcePackage) {
          console.log(chalk.dim(`    source: ${comp.sourcePackage}`));
        }
      }
      
      console.log(chalk.dim('\n  Update with:'));
      console.log(chalk.cyan(`    npx buildpad upgrade ${result.outdated.map(c => c.name).join(' ')}\n`));
    }
    
    if (result.unknown.length > 0) {
      console.log(chalk.dim(`\n  ${result.unknown.length} item(s) without version info (installed before tracking):`));
      result.unknown.forEach(name => console.log(chalk.dim(`    - ${name}`)));
      console.log(chalk.dim('\n  Run \'npx buildpad migrate\' to enable per-file update tracking.'));
    }
    
    if (result.outdated.length === 0 && result.unknown.length === 0) {
      console.log(chalk.green('✓ All components are up to date!\n'));
    }
    
    // Summary
    console.log(chalk.dim(`\nTotal: ${config.installedComponents.length} components, ${config.installedLib.length} lib modules`));
    console.log(chalk.dim(`  Up to date: ${result.upToDate.length}`));
    console.log(chalk.dim(`  Outdated: ${result.outdated.length}`));
    console.log(chalk.dim(`  Unknown: ${result.unknown.length}\n`));
    
  } catch (error) {
    spinner?.fail('Failed to check for updates');
    console.error(chalk.red(error));
    process.exit(1);
  }
}

