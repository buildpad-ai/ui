/**
 * Buildpad CLI - Outdated Command
 *
 * Lists every installed file whose upstream CONTENT changed since it was
 * installed, plus files a previous upgrade left unwritten.
 *
 * v3 logic (see utils/staleness.ts):
 *   - A file is stale when `registry.file.sourceSha256` differs from the hash
 *     recorded in buildpad.json, or when its `state` is `pending`.
 *   - A component is stale when any of its files is stale, or when the
 *     registry has added or removed one of its files.
 *   - No version comparison, no `lastChangedIn`, no git history.
 *
 * v2 manifests have no per-file `sourceSha256`, so they cannot be compared.
 * Those are reported as needing `buildpad migrate` rather than guessed at.
 */

import chalk from 'chalk';
import ora from 'ora';
import { loadConfig } from './init.js';
import {
  computeEntryStaleness,
  registryFilesOf,
  type StaleFile,
} from '../utils/staleness.js';
import { checkCliBehind } from '../utils/npm-latest.js';
import {
  getRegistry as fetchRegistry,
  getCliVersion,
  getSourceRef,
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
  kind: 'component' | 'lib';
  /** Release the entry was last synced to (display only). */
  installedRelease?: string;
  /** Release the registry currently describes. */
  latestRelease: string;
  sourcePackage?: string;
  installedAt: string;
  /** The stale files and why. */
  files: StaleFile[];
}

interface OutdatedResult {
  outdated: OutdatedEntry[];
  upToDate: string[];
  /** Installed but with no manifest record — nothing to compare. */
  unknown: string[];
  /** v2 records whose upstream hashes are missing; `migrate` fixes them. */
  needsMigrate: string[];
  release: string;
  installedRelease?: string;
  ref: string;
  cliVersion: string;
  /** npm `latest` when this CLI is behind it. */
  cliLatest?: string;
}

const REASON_LABEL: Record<StaleFile['reason'], string> = {
  'upstream-changed': 'changed upstream',
  pending: 'pending — last upgrade did not write it',
  added: 'new file',
  removed: 'removed upstream',
};

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
    const latestRelease = registry.version;

    const result: OutdatedResult = {
      outdated: [],
      upToDate: [],
      unknown: [],
      needsMigrate: [],
      release: latestRelease,
      installedRelease: config.release,
      ref: getSourceRef(),
      cliVersion: getCliVersion(),
    };

    // ── Components ────────────────────────────────────────────────────────
    for (const componentName of config.installedComponents) {
      const regComponent = registry.components.find(c => c.name === componentName);
      if (!regComponent) {
        result.unknown.push(componentName);
        continue;
      }

      const record = config.components?.[componentName];
      const staleness = computeEntryStaleness(registryFilesOf(regComponent), record);

      if (staleness.untracked) {
        result.unknown.push(componentName);
        continue;
      }
      if (staleness.needsMigrate) result.needsMigrate.push(componentName);

      if (!staleness.stale) {
        result.upToDate.push(componentName);
        continue;
      }

      result.outdated.push({
        name: componentName,
        kind: 'component',
        installedRelease: record?.release ?? record?.version,
        latestRelease,
        sourcePackage: regComponent.sourcePackage ?? record?.sourcePackage,
        installedAt: record!.installedAt,
        files: staleness.files,
      });
    }

    // ── Lib modules ───────────────────────────────────────────────────────
    for (const libName of config.installedLib) {
      const mod = registry.lib?.[libName];
      const record = config.lib?.[libName];

      if (!mod) {
        if (!record) result.unknown.push(`lib/${libName}`);
        continue;
      }

      const staleness = computeEntryStaleness(registryFilesOf(mod), record);
      if (staleness.untracked) {
        result.unknown.push(`lib/${libName}`);
        continue;
      }
      if (staleness.needsMigrate) result.needsMigrate.push(`lib/${libName}`);

      if (!staleness.stale) {
        result.upToDate.push(`lib/${libName}`);
        continue;
      }

      // Bare module name so the suggested `upgrade <name>` resolves it as a
      // lib module (upgrade checks registry.lib first).
      result.outdated.push({
        name: libName,
        kind: 'lib',
        installedRelease: record?.release ?? record?.version,
        latestRelease,
        sourcePackage: mod.sourcePackage ?? record?.sourcePackage,
        installedAt: record!.installedAt,
        files: staleness.files,
      });
    }

    // Advisory: a pinned CLI reads a pinned registry, so "up to date" only
    // means "up to date with the release this CLI ships against".
    const cliLatest = await checkCliBehind(getCliVersion());
    if (cliLatest) result.cliLatest = cliLatest;

    spinner?.stop();

    if (json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    // ── Display ───────────────────────────────────────────────────────────
    console.log(chalk.bold('\n📦 Component Update Status\n'));
    console.log(chalk.dim(`Registry release : ${result.release} (ref ${result.ref})`));
    console.log(
      chalk.dim(`Project synced at: ${result.installedRelease ?? 'unknown'}\n`)
    );

    if (result.outdated.length > 0) {
      console.log(chalk.yellow(`⚠ ${result.outdated.length} item(s) have updates available:\n`));

      for (const entry of result.outdated) {
        console.log(chalk.yellow(`  ${entry.name}`) + chalk.dim(entry.kind === 'lib' ? ' (lib)' : ''));
        const from = entry.installedRelease ?? 'unknown';
        console.log(
          chalk.dim(
            `    ${from} → ${entry.latestRelease} · installed ${new Date(entry.installedAt).toLocaleDateString()}`
          )
        );
        for (const file of entry.files) {
          console.log(chalk.dim(`      ${file.target} — ${REASON_LABEL[file.reason]}`));
        }
      }

      console.log(chalk.dim('\n  Update with:'));
      console.log(chalk.cyan(`    npx buildpad upgrade ${result.outdated.map(c => c.name).join(' ')}\n`));
    }

    if (result.needsMigrate.length > 0) {
      console.log(
        chalk.yellow(
          `\n  ${result.needsMigrate.length} item(s) recorded without upstream hashes (schema v2):`
        )
      );
      result.needsMigrate.forEach(name => console.log(chalk.dim(`    - ${name}`)));
      console.log(
        chalk.dim("\n  Their staleness cannot be determined. Run 'npx buildpad migrate'.")
      );
    }

    if (result.unknown.length > 0) {
      console.log(chalk.dim(`\n  ${result.unknown.length} item(s) without an install record:`));
      result.unknown.forEach(name => console.log(chalk.dim(`    - ${name}`)));
      console.log(chalk.dim("\n  Run 'npx buildpad migrate' to enable per-file update tracking."));
    }

    if (
      result.outdated.length === 0 &&
      result.unknown.length === 0 &&
      result.needsMigrate.length === 0
    ) {
      console.log(chalk.green('✓ All components are up to date!\n'));
    }

    if (result.cliLatest) {
      console.log(
        chalk.yellow(
          `\n  This CLI is ${result.cliVersion}; npm latest is ${result.cliLatest}.`
        )
      );
      console.log(
        chalk.dim(
          '  Components are fetched at the release matching the CLI, so upgrade the\n' +
          '  CLI to see newer components: npx @buildpad/cli@latest outdated'
        )
      );
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
