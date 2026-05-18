/**
 * Buildpad CLI - Changelog Command
 *
 * Display the changelog for a source package or a specific component.
 *
 * Usage:
 *   npx buildpad changelog @buildpad/ui-interfaces
 *   npx buildpad changelog input
 *   npx buildpad changelog @buildpad/ui-form --since 0.1.10
 */

import chalk from 'chalk';
import ora from 'ora';
import { loadConfig } from './init.js';
import {
  getRegistry as fetchRegistry,
  CHANGELOG_BASE_URL,
  type Registry,
} from '../resolver.js';
import { changelogSince } from '../utils/changelog-parser.js';

async function getRegistry(): Promise<Registry> {
  try {
    return await fetchRegistry();
  } catch (err: any) {
    console.error(chalk.red('Failed to load registry:', err.message));
    process.exit(1);
  }
}

/**
 * Fetch the raw CHANGELOG.md for a package from GitHub.
 * Falls back gracefully when offline.
 */
async function fetchChangelog(changelogUrl: string): Promise<string | null> {
  // changelogUrl is relative, e.g. "ui-interfaces/CHANGELOG.md".
  // Map to raw GitHub URL via the centralised CHANGELOG_BASE_URL.
  const url = changelogUrl.startsWith('http')
    ? changelogUrl
    : `${CHANGELOG_BASE_URL}/${changelogUrl}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    return res.text();
  } catch {
    return null;
  }
}

export async function changelog(options: {
  target: string;     // package name or component name
  since?: string;     // semver — show only entries newer than this
  cwd: string;
  json?: boolean;
}) {
  const { target, since, cwd, json = false } = options;

  const spinner = json ? null : ora('Loading registry...').start();
  const registry = await getRegistry();
  spinner?.stop();

  // Resolve target → package info
  let changelogUrl: string | undefined;
  let resolvedTarget = target;

  if (registry.packages?.[target]) {
    // Direct package name e.g. "@buildpad/ui-interfaces"
    changelogUrl = registry.packages[target].changelogUrl;
  } else {
    // Try to resolve as component name
    const component = registry.components.find(c => c.name === target);
    if (component?.sourcePackage && registry.packages?.[component.sourcePackage]) {
      changelogUrl = registry.packages[component.sourcePackage].changelogUrl;
      resolvedTarget = component.sourcePackage;
    }
  }

  if (!changelogUrl) {
    const config = await loadConfig(cwd);
    const hint =
      config?.packageVersions
        ? '\n  Known packages: ' + Object.keys(config.packageVersions).join(', ')
        : '';
    console.error(
      chalk.red(
        `\n✗ Cannot find changelog for '${target}'.${hint}\n` +
        `  Use a package name like @buildpad/ui-interfaces or a component name like 'input'.\n`
      )
    );
    process.exit(1);
  }

  const spinner2 = json ? null : ora(`Fetching changelog for ${resolvedTarget}...`).start();
  const raw = await fetchChangelog(changelogUrl);
  spinner2?.stop();

  if (!raw) {
    console.error(chalk.red(`\n✗ Could not fetch changelog (network unavailable or no changelog yet).\n`));
    process.exit(1);
  }

  const output = changelogSince(raw, since);

  if (!output) {
    if (json) {
      console.log(JSON.stringify({ target: resolvedTarget, since, entries: [] }));
    } else {
      console.log(
        chalk.yellow(
          `\nNo changelog entries found for ${resolvedTarget}` +
          (since ? ` newer than ${since}` : '') + '.\n'
        )
      );
    }
    return;
  }

  if (json) {
    console.log(JSON.stringify({ target: resolvedTarget, since, changelog: output }));
    return;
  }

  console.log(chalk.bold(`\n📋 Changelog — ${resolvedTarget}`) +
    (since ? chalk.dim(` (since ${since})`) : '') + '\n');
  console.log(output);
}
