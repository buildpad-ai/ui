/**
 * Buildpad CLI - Migrate Command
 *
 * Brings buildpad.json up to schema v3.
 *
 * v1 → v3: the manifest has no per-file records at all. Every installed
 *   component's sources are re-fetched, transformed in memory, and hashed so
 *   local modifications become detectable.
 *
 * v2 → v3: the manifest has local hashes but no UPSTREAM hashes, so the v3
 *   content comparison has nothing to compare against. For each component the
 *   registry is fetched at `v<recorded version>` — the release the component
 *   was installed from — and each file's `sourceSha256` is copied out of it,
 *   with `ref` set to that tag and `state` to `clean`.
 *
 *   When that tag is unreachable (releases before the `v<version>` tags
 *   existed, or the two releases that shipped with no tag at all), the file
 *   takes the CURRENT registry hash and is marked `pending` instead. Pending
 *   is deliberately pessimistic: `outdated` keeps reporting the file until a
 *   real `upgrade` writes it, so a wrong baseline cannot go unnoticed.
 *
 * Safe to re-run — already-populated entries are refreshed, not duplicated.
 */

import fs from 'fs-extra';
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
  fetchRegistryAtRef,
  getRecordedRef,
  type Registry,
} from '../resolver.js';
import {
  transformImports,
  transformRelativeImports,
  transformIntraComponentImports,
  transformVFormImports,
  addOriginHeader,
  hashTransformed,
  originHeaderApplies,
} from './transformer.js';
import { registryFilesOf } from '../utils/staleness.js';
import { copyLibModule } from './add.js';
import { ensureExternalDeps } from '../utils/external-deps.js';
import { applyLocales, parseLocalesOption } from '../utils/i18n-locales.js';

async function getRegistry(): Promise<Registry> {
  try {
    return await fetchRegistry();
  } catch (err: any) {
    console.error(chalk.red('Failed to load registry:', err.message));
    process.exit(1);
  }
}

/**
 * Per-file `sourceSha256` from the registry as it stood at `ref`, keyed by
 * target path. Returns null when that ref has no reachable registry — the
 * caller then falls back to the current hashes and marks the files pending.
 *
 * Cached per ref: a project typically has every component installed from the
 * same release, so this is one fetch, not one per component.
 */
const historicRegistryCache = new Map<string, Registry | null>();

async function historicRegistry(ref: string): Promise<Registry | null> {
  if (historicRegistryCache.has(ref)) return historicRegistryCache.get(ref)!;
  let result: Registry | null = null;
  try {
    result = await fetchRegistryAtRef(ref);
  } catch {
    result = null;
  }
  historicRegistryCache.set(ref, result);
  return result;
}

/** Upstream hashes for one entry, taken from a historic registry. */
function hashesFromRegistry(
  registry: Registry,
  kind: 'component' | 'lib',
  name: string
): Map<string, string> {
  const entry =
    kind === 'component'
      ? registry.components?.find(c => c.name === name)
      : registry.lib?.[name];
  const map = new Map<string, string>();
  if (!entry) return map;
  for (const f of registryFilesOf(entry as any)) {
    if (f.sourceSha256) map.set(f.target, f.sourceSha256);
  }
  return map;
}

interface BackfillOutcome {
  files: FileChecksum[];
  /** Files that could not be given a trustworthy upstream baseline. */
  pending: number;
}

/**
 * Give an existing v2 record its v3 fields, per §5.7 of the redesign.
 * Local `sha256` values are preserved — they still describe the bytes on disk.
 */
async function backfillRecord(
  record: ComponentInstall,
  kind: 'component' | 'lib',
  name: string,
  currentHashes: Map<string, string>
): Promise<BackfillOutcome> {
  const installedVersion = record.release ?? record.version;
  const ref = installedVersion ? `v${installedVersion}` : undefined;
  const historic = ref ? await historicRegistry(ref) : null;
  const historicHashes = historic ? hashesFromRegistry(historic, kind, name) : null;

  let pending = 0;
  const files = (record.files ?? []).map((file): FileChecksum => {
    // Already migrated — leave it alone.
    if (file.sourceSha256 && file.state) return file;

    const exact = historicHashes?.get(file.target);
    if (exact && ref) {
      return { ...file, sourceSha256: exact, ref, state: 'clean' };
    }
    pending++;
    return {
      ...file,
      sourceSha256: currentHashes.get(file.target),
      ref: file.ref ?? ref,
      state: 'pending',
    };
  });

  return { files, pending };
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

  const from = config.schemaVersion ?? 1;
  if (from > 3) {
    console.error(
      chalk.red(
        `\n✗ buildpad.json is schema v${from}, which this CLI does not understand.\n` +
        '  Upgrade the CLI: npx @buildpad/cli@latest migrate\n'
      )
    );
    process.exit(1);
  }

  console.log(chalk.bold(`\n🔄 Migrating buildpad.json (v${from} → v3)...\n`));
  if (dryRun) {
    console.log(chalk.yellow('  (dry run — no files will be written)\n'));
  }

  const spinner = ora('Fetching registry...').start();
  const registry = await getRegistry();
  spinner.succeed('Registry loaded');

  const release = registry.version;
  const ref = getRecordedRef();
  let pendingTotal = 0;

  // ── Components ─────────────────────────────────────────────────────────
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
    const currentHashes = new Map(
      regComponent.files.filter(f => f.sourceSha256).map(f => [f.target, f.sourceSha256!])
    );
    const existing = config.components?.[componentName];

    if (existing?.files?.length) {
      // v2 → v3: keep the local hashes, backfill the upstream baseline.
      const { files, pending } = await backfillRecord(
        existing, 'component', componentName, currentHashes
      );
      pendingTotal += pending;
      components[componentName] = {
        release: existing.release ?? existing.version,
        ref: existing.ref ?? (existing.version ? `v${existing.version}` : ref),
        sourcePackage: existing.sourcePackage ?? sourcePackage,
        installedAt: existing.installedAt,
        files,
      };
      continue;
    }

    // v1 → v3: no per-file record at all. Re-derive the local hashes by
    // transforming the current sources exactly as `add` would.
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

        content = addOriginHeader(content, componentName, sourcePackage, release);

        files.push({
          target: file.target,
          sourceSha256: file.sourceSha256,
          sha256: hashTransformed(content),
          ref,
          state: 'clean',
        });
      } catch {
        componentSpinner.warn(`    Failed to process: ${file.source}`);
      }
    }

    if (files.length > 0) {
      components[componentName] = {
        release,
        ref,
        sourcePackage,
        installedAt:
          config.componentVersions?.[componentName]?.installedAt ?? new Date().toISOString(),
        files,
      };
    }
  }

  componentSpinner.succeed(`Migrated ${config.installedComponents.length - failed.length} components`);

  // ── Lib modules ────────────────────────────────────────────────────────
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

      const sourcePackage = libModule.sourcePackage ?? '@buildpad/cli';
      const registryFiles = registryFilesOf(libModule);
      const currentHashes = new Map(
        registryFiles.filter(f => f.sourceSha256).map(f => [f.target, f.sourceSha256!])
      );
      const existing = config.lib?.[libName];

      if (existing?.files?.length) {
        const { files, pending } = await backfillRecord(
          existing, 'lib', libName, currentHashes
        );
        pendingTotal += pending;
        lib[libName] = {
          release: existing.release ?? existing.version,
          ref: existing.ref ?? (existing.version ? `v${existing.version}` : ref),
          sourcePackage: existing.sourcePackage ?? sourcePackage,
          installedAt: existing.installedAt,
          files,
        };
        continue;
      }

      const files: FileChecksum[] = [];
      for (const file of registryFiles) {
        try {
          if (!(await sourceFileExists(file.source))) continue;
          let content = await resolveSourceFile(file.source);
          content = transformImports(content, config);
          const fileName = path.basename(file.source, path.extname(file.source));
          if (originHeaderApplies(file.target)) {
            content = addOriginHeader(content, `${libName}/${fileName}`, sourcePackage, release);
          }
          files.push({
            target: file.target,
            sourceSha256: file.sourceSha256,
            sha256: hashTransformed(content),
            ref,
            state: 'clean',
          });
        } catch {
          /* ignore individual file failure */
        }
      }

      if (files.length > 0) {
        lib[libName] = {
          release,
          ref,
          sourcePackage,
          installedAt:
            config.componentVersions?.[`lib/${libName}`]?.installedAt ?? new Date().toISOString(),
          files,
        };
      } else {
        libFailed.push(libName);
      }
    }
    libSpinner.succeed(
      `Migrated ${config.installedLib.length - libFailed.length} lib modules`
    );
  }

  // `packageVersions` and per-component `version` are superseded by `release`.
  const { packageVersions: _dropped, ...rest } = config;
  const updatedConfig: Config = {
    ...rest,
    schemaVersion: 3,
    release: config.release ?? release,
    components,
    lib,
  };

  if (!dryRun) {
    await saveConfig(cwd, updatedConfig);
    console.log(chalk.green('\n✓ buildpad.json upgraded to schema v3\n'));
  } else {
    console.log('\n  Would write schemaVersion: 3 with:');
    console.log(`    release: ${updatedConfig.release}`);
    console.log(`    components: ${Object.keys(components).join(', ')}`);
  }

  if (pendingTotal > 0) {
    console.log(
      chalk.yellow(
        `  ⚠ ${pendingTotal} file(s) had no reachable release tag for their recorded version,`
      )
    );
    console.log(
      chalk.dim(
        '    so their upstream baseline could not be established exactly. They are marked\n' +
        "    'pending' and will be reported by 'outdated' until you run: npx buildpad upgrade\n"
      )
    );
  }

  if (failed.length > 0) {
    console.log(chalk.yellow(`\n  ⚠ ${failed.length} component(s) could not be migrated (not in registry):`));
    failed.forEach(n => console.log(chalk.dim(`    - ${n}`)));
    console.log(chalk.dim('  These will remain as legacy entries.\n'));
  }

  if (libFailed.length > 0) {
    console.log(chalk.yellow(`\n  ⚠ ${libFailed.length} lib module(s) could not be migrated (not in registry or unreadable):`));
    libFailed.forEach(n => console.log(chalk.dim(`    - ${n}`)));
    console.log(chalk.dim('  These will remain untracked.\n'));
  }
}


// ─────────────────────────────────────────────────────────────────────
// `buildpad migrate i18n` — move an existing app onto app/[lang] routing
// ─────────────────────────────────────────────────────────────────────

/**
 * Entries that stay at the app root: API routes, the locale segment itself,
 * design-system CSS, and the Next.js metadata files that must not be
 * locale-prefixed.
 */
const KEEP_AT_APP_ROOT = new Set([
  'api',
  '[lang]',
  'globals.css',
  'design-tokens.css',
  'favicon.ico',
  'global-error.tsx',
  'global-error.js',
  'robots.ts',
  'robots.txt',
  'sitemap.ts',
  'sitemap.xml',
  'manifest.ts',
  'manifest.json',
  'manifest.webmanifest',
]);
const KEEP_AT_APP_ROOT_PATTERN = /^(icon|apple-icon|opengraph-image|twitter-image)\d*\.[a-z]+$/;

/** The previous root layout is kept beside the new one for a manual merge. */
export const PRE_I18N_LAYOUT = 'layout.pre-i18n.tsx';

export interface MigrateI18nOptions {
  cwd: string;
  dryRun?: boolean;
  /** Comma-separated locale codes to configure after the move (e.g. "en,id"). */
  locales?: string;
  defaultLocale?: string;
}

/** Retarget a recorded file path from app/… to app/[lang]/…, leaving API routes alone. */
export function langTarget(target: string): string {
  if (!target.startsWith('app/')) return target;
  if (target.startsWith('app/api/') || target.startsWith('app/[lang]/')) return target;
  const base = target.slice('app/'.length);
  const first = base.split('/')[0];
  if (KEEP_AT_APP_ROOT.has(first) || KEEP_AT_APP_ROOT_PATTERN.test(first)) return target;
  return `app/[lang]/${base}`;
}

/**
 * Move an app scaffolded before locale routing onto `app/[lang]`:
 *
 *   1. install the `i18n` lib module (lib/i18n/*, LanguageSwitcher)
 *   2. write the new root layout to app/[lang]/layout.tsx and keep the old
 *      app/layout.tsx as app/[lang]/layout.pre-i18n.tsx for a manual merge
 *      (its CSS imports are rewritten to ../globals.css)
 *   3. move every other route entry under app/[lang]/ (api/ and metadata
 *      files stay), retargeting the buildpad.json records so `upgrade` sees
 *      the moved files as the same files
 *   4. optionally configure locales (--locales)
 *
 * The rewritten middleware, login page, app shell and route pages then
 * arrive through `buildpad upgrade --all --three-way`.
 */
export async function migrateI18n(options: MigrateI18nOptions) {
  const { cwd, dryRun = false } = options;
  const localeList = parseLocalesOption(options.locales);

  const config = await loadConfig(cwd);
  if (!config) {
    console.error(chalk.red('\n✗ buildpad.json not found. Run "npx buildpad init" first.\n'));
    process.exit(1);
  }

  const srcRoot = config.srcDir ? path.join(cwd, 'src') : cwd;
  const appDir = path.join(srcRoot, 'app');
  const langDir = path.join(appDir, '[lang]');
  const rel = (p: string) => path.relative(cwd, p);

  if (!fs.existsSync(appDir)) {
    console.error(chalk.red(`\n✗ ${rel(appDir)} not found — is this a Next.js App Router project?\n`));
    process.exit(1);
  }

  console.log(chalk.bold('\n🌐 Migrating to locale-prefixed routing (app/[lang])...\n'));
  if (dryRun) console.log(chalk.yellow('  (dry run — no files will be written)\n'));

  const spinner = ora('Fetching registry...').start();
  const registry = await getRegistry();
  spinner.succeed('Registry loaded');

  // ── 1. i18n lib module ────────────────────────────────────────────
  if (!registry.lib['i18n']) {
    console.error(chalk.red('\n✗ This registry has no i18n module — upgrade the CLI: npx @buildpad/cli@latest\n'));
    process.exit(1);
  }
  if (config.installedLib.includes('i18n')) {
    console.log(chalk.dim('  i18n module already installed'));
  } else if (dryRun) {
    console.log(chalk.dim('  would install lib module: i18n (+ services, utils, types)'));
  } else {
    const libSpinner = ora('Installing lib module: i18n...').start();
    await copyLibModule('i18n', registry, config, cwd, libSpinner, true);
  }

  // ── 2. root layout ────────────────────────────────────────────────
  const oldLayout = path.join(appDir, 'layout.tsx');
  const newLayout = path.join(langDir, 'layout.tsx');
  const keptLayout = path.join(langDir, PRE_I18N_LAYOUT);
  const moves: Array<{ from: string; to: string }> = [];
  const conflicts: string[] = [];

  if (fs.existsSync(oldLayout)) {
    if (fs.existsSync(newLayout)) {
      conflicts.push(`${rel(oldLayout)} → ${rel(newLayout)} (already exists)`);
    } else {
      console.log(chalk.cyan(`  ${rel(newLayout)}`) + chalk.dim(' ← new root layout (generateStaticParams, <html lang dir>, I18nProvider)'));
      console.log(chalk.cyan(`  ${rel(keptLayout)}`) + chalk.dim(` ← your previous ${rel(oldLayout)}, kept for a manual merge`));
      if (!dryRun) {
        const template = await resolveSourceFile('cli/templates/app/layout.tsx');
        await fs.ensureDir(langDir);
        await fs.writeFile(newLayout, template);
        const previous = (await fs.readFile(oldLayout, 'utf-8'))
          .replace(/(['"])\.\/globals\.css\1/g, '$1../globals.css$1')
          .replace(/(['"])\.\/design-tokens\.css\1/g, '$1../design-tokens.css$1');
        await fs.writeFile(keptLayout, previous);
        await fs.remove(oldLayout);
      }
    }
  } else if (!fs.existsSync(newLayout)) {
    console.log(chalk.cyan(`  ${rel(newLayout)}`) + chalk.dim(' ← new root layout'));
    if (!dryRun) {
      const template = await resolveSourceFile('cli/templates/app/layout.tsx');
      await fs.ensureDir(langDir);
      await fs.writeFile(newLayout, template);
    }
  }

  // ── 3. move every other route entry ───────────────────────────────
  for (const entry of await fs.readdir(appDir)) {
    if (KEEP_AT_APP_ROOT.has(entry) || KEEP_AT_APP_ROOT_PATTERN.test(entry)) continue;
    if (entry === 'layout.tsx') continue; // handled above
    const from = path.join(appDir, entry);
    const to = path.join(langDir, entry);
    if (fs.existsSync(to)) {
      conflicts.push(`${rel(from)} → ${rel(to)} (already exists)`);
      continue;
    }
    moves.push({ from, to });
  }

  for (const { from, to } of moves) {
    console.log(chalk.cyan(`  ${rel(from)}`) + chalk.dim(` → ${rel(to)}`));
    if (!dryRun) {
      await fs.ensureDir(path.dirname(to));
      await fs.move(from, to);
    }
  }

  // Retarget manifest records so `upgrade`/`status` follow the moved files
  // instead of reporting them removed-and-added.
  let retargeted = 0;
  for (const record of Object.values(config.lib ?? {})) {
    for (const file of record.files ?? []) {
      const next = langTarget(file.target);
      if (next !== file.target) {
        file.target = next;
        retargeted++;
      }
    }
  }

  if (!dryRun) await saveConfig(cwd, config);

  // ── 4. locales ────────────────────────────────────────────────────
  if (localeList) {
    try {
      const result = await applyLocales({
        cwd,
        srcDir: config.srcDir,
        locales: localeList,
        defaultLocale: options.defaultLocale,
        dryRun,
      });
      console.log(chalk.green(`\n✓ Locales: ${result.locales.join(', ')} (default: ${result.defaultLocale})`));
      result.created.forEach(f => console.log(chalk.dim(`  seeded ${f} from en.json — translate it`)));
    } catch (err: any) {
      console.log(chalk.yellow(`\n⚠ Could not configure locales: ${err.message}`));
    }
  }

  // ── npm deps of the i18n module ───────────────────────────────────
  await ensureExternalDeps({
    cwd,
    deps: (registry.lib['i18n'].dependencies ?? []).map(d => d.replace(/@[^@/]*$/, '')),
    dryRun,
  });

  // ── summary ───────────────────────────────────────────────────────
  console.log(chalk.bold(`\n${dryRun ? 'Would move' : 'Moved'} ${moves.length} entr${moves.length === 1 ? 'y' : 'ies'} under app/[lang]/; retargeted ${retargeted} manifest record(s).`));
  if (conflicts.length > 0) {
    console.log(chalk.yellow('\n⚠ Skipped (target already exists — merge by hand, then delete the old file):'));
    conflicts.forEach(c => console.log(chalk.dim(`  - ${c}`)));
  }

  console.log(chalk.bold('\nNext steps:'));
  // Numbered at print time: the layout-merge step only exists when a pre-i18n
  // layout was actually kept, and a gap in the numbering reads like a bug.
  let step = 0;
  const next = (line: string, detail?: string) => {
    console.log(chalk.cyan(`  ${++step}. `) + chalk.dim(line));
    if (detail) console.log(chalk.dim(`     ${detail}`));
  };
  next(
    'npx @buildpad/cli@latest upgrade --all --three-way',
    '→ pulls the locale-aware middleware, login page, app shell and route pages'
  );
  if (fs.existsSync(keptLayout) || (dryRun && fs.existsSync(oldLayout))) {
    next(`merge your providers from app/[lang]/${PRE_I18N_LAYOUT} into app/[lang]/layout.tsx, then delete it`);
  }
  next(
    'replace useRouter() with useLocaleRouter() and href="/x" with localeHref in your own pages:',
    "grep -rn \"router\\.\\(push\\|replace\\)(['\\\"\\\`]/\\|href=['\\\"]/\" app/ components/ --include=*.tsx | grep -v /api/"
  );
  next('pnpm build — unknown locales 404, / redirects to /<locale>');
  console.log();
}
