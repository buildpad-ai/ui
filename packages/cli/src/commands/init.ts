import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import prompts from 'prompts';
import {
  getTemplatesRoot,
  getBundledRegistry,
  resolveBundledTemplate,
  bundledTemplateExists,
  resolveSourceFile,
  sourceFileExists,
} from '../resolver.js';
import { copyLibModule } from './add.js';
import { applyLocales, parseLocalesOption } from '../utils/i18n-locales.js';

/**
 * Per-file state (v3).
 *
 * `pending` means the last upgrade did NOT write this file — the user skipped
 * it, a `.new` file was written instead, or the diff3 base was unreachable.
 * A pending file is stale until it is actually written, so `outdated` keeps
 * reporting it. Before v3 the upgrade advanced the component version anyway
 * and the skipped file silently disappeared from the report forever.
 */
export type FileState = 'clean' | 'pending';

/**
 * Per-file record in buildpad.json.
 *
 * Two hashes, deliberately:
 *   - `sourceSha256` is the registry's hash of the UNTRANSFORMED upstream
 *     source at install time. Comparing it with the current registry hash is
 *     how staleness is decided (v3) — no version arithmetic, no git history.
 *   - `sha256` is the hash of the TRANSFORMED content the CLI wrote, with the
 *     origin header stripped, line endings normalised to LF, and a trailing
 *     newline appended (see `hashTransformed()` in transformer.ts). Comparing
 *     it with the file on disk is how LOCAL modification is detected.
 */
export interface FileChecksum {
  /** Consumer-relative target path, e.g. "components/ui/input.tsx" */
  target: string;
  /**
   * v3: the registry's `sourceSha256` for this file at install time.
   * Absent on v2 manifests — run `buildpad migrate`.
   */
  sourceSha256?: string;
  /** SHA-256 of the transformed content (minus origin header). */
  sha256: string;
  /**
   * v3: git ref the bytes were fetched from, e.g. `v2.0.0`. This is the exact
   * diff3 base for the next upgrade — not a version the CLI has to guess a tag
   * from. `local` when installed from a monorepo checkout, `url:<base>` when
   * `BUILDPAD_REGISTRY_URL` was in play.
   */
  ref?: string;
  /** v3: `clean` (written as recorded) or `pending` (upgrade did not write it). */
  state?: FileState;
}

/**
 * Per-component (or per-lib-module) installation record.
 */
export interface ComponentInstall {
  /**
   * v3: the lockstep release this record was last synced to, e.g. "2.0.0".
   * Display only — staleness is decided per file, by hash.
   */
  release?: string;
  /** v3: git ref the component's files were fetched from. */
  ref?: string;
  /**
   * @deprecated v2 — semver of the source package at install time.
   * Read for migration; never written by v3.
   */
  version?: string;
  /** Source package name, e.g. "@buildpad/ui-interfaces" */
  sourcePackage: string;
  /** ISO 8601 timestamp of the installation */
  installedAt: string;
  /** One entry per copied file */
  files: FileChecksum[];
}

/**
 * Component version info for tracking updates (Config v1 — kept for migration)
 */
export interface ComponentVersion {
  /** Registry version when installed */
  version: string;
  /** Installation timestamp */
  installedAt: string;
  /** Source package (e.g., @buildpad/ui-interfaces) */
  source: string;
}

/**
 * Buildpad Configuration File
 * 
 * Copy & Own Model:
 * - Components are copied to your project as source files
 * - No runtime dependency on @buildpad/* packages
 * - Full customization - you own the code
 * - Works offline after installation
 */
export interface Config {
  $schema?: string;
  /**
   * Manifest schema version.
   * - 1 (or absent): legacy format — componentVersions + registryVersion
   * - 2: components/lib maps with per-file sha256 + packageVersions
   * - 3: adds per-file sourceSha256 / ref / state and a single `release`;
   *      drops per-component `version` and `packageVersions`
   */
  schemaVersion?: 1 | 2 | 3;
  /**
   * v3: the lockstep release the project was last synced to, e.g. "2.0.0".
   * Replaces `packageVersions` — under lockstep every package shares it.
   */
  release?: string;
  /** Distribution model - always 'copy-own' */
  model: 'copy-own';
  /** Use TypeScript (.tsx) or JavaScript (.jsx) */
  tsx: boolean;
  /** Use 'src' directory structure */
  srcDir: boolean;
  /** Path aliases for generated files */
  aliases: {
    /** Where UI components are copied (e.g., @/components/ui) */
    components: string;
    /** Where lib files are copied (e.g., @/lib/buildpad) */
    lib: string;
  };
  /** Installed lib modules */
  installedLib: string[];
  /** Installed components */
  installedComponents: string[];

  // ── v2 fields ────────────────────────────────────────────────────────────

  /**
   * v2: per-component installation records with per-file sha256 checksums.
   * Keyed by component name, e.g. `components["input"]`.
   */
  components?: Record<string, ComponentInstall>;
  /**
   * v2: per-lib-module installation records with per-file sha256 checksums.
   * Keyed by module name, e.g. `lib["types"]`.
   */
  lib?: Record<string, ComponentInstall>;
  /**
   * @deprecated v2 — snapshot of source-package semver at the last install.
   * Superseded by `release`; kept so v2 manifests still parse.
   */
  packageVersions?: Record<string, string>;

  // ── v1 legacy fields (read-only after migration) ─────────────────────────

  /** @deprecated Use `components[name].version` in v2. */
  componentVersions?: Record<string, ComponentVersion>;
  /** @deprecated Use `packageVersions` in v2. */
  registryVersion?: string;
}

/** The manifest schema version this CLI writes. */
export const CURRENT_SCHEMA_VERSION = 3;

const DEFAULT_CONFIG: Config = {
  $schema: 'https://buildpad.dev/schema.json',
  schemaVersion: 3,
  model: 'copy-own',
  tsx: true,
  srcDir: true,
  aliases: {
    components: '@/components/ui',
    lib: '@/lib/buildpad',
  },
  installedLib: [],
  installedComponents: [],
  components: {},
  lib: {},
};

const TEMPLATES_ROOT = getTemplatesRoot();

async function copyTemplateFile(sourceRelativePath: string, targetPath: string, cwd: string) {
  const sourcePath = path.join(TEMPLATES_ROOT, sourceRelativePath);

  if (!fs.existsSync(sourcePath) || fs.existsSync(targetPath)) {
    return;
  }

  await fs.ensureDir(path.dirname(targetPath));
  await fs.copy(sourcePath, targetPath);
  console.log(chalk.green(`✓ Created ${path.relative(cwd, targetPath)}`));
}

export interface InitOptions {
  yes?: boolean;
  cwd: string;
  /** Comma-separated locale codes for app/[lang], e.g. "en,id". Default: "en". */
  locales?: string;
  /** Default locale (must be in `locales`). Default: the first locale. */
  defaultLocale?: string;
}

/**
 * Sources for the modules `init` installs offline: `cli/templates/*` come
 * from the CLI bundle; anything else (the `services` chain the i18n module
 * depends on) goes through the normal resolver — the monorepo on disk in
 * local mode, the pinned release tag otherwise.
 */
const BUNDLED_FIRST = {
  readSource: async (source: string) =>
    (await bundledTemplateExists(source)) ? resolveBundledTemplate(source) : resolveSourceFile(source),
  // A template can be absent from the bundle (tsup's d.ts clean removes
  // types/modules.d.ts from dist/templates) — fall through to the resolver
  // rather than reporting it missing.
  sourceExists: async (source: string) =>
    (await bundledTemplateExists(source)) || sourceFileExists(source),
};

export async function init(options: InitOptions) {
  const { cwd, yes } = options;
  // Validate up front so a typo fails before anything is written.
  const localeList = parseLocalesOption(options.locales);
  if (options.defaultLocale && localeList && !localeList.includes(options.defaultLocale)) {
    console.error(
      chalk.red(`\n✗ --default-locale '${options.defaultLocale}' is not in --locales (${localeList.join(', ')})\n`)
    );
    process.exit(1);
  }

  console.log(chalk.bold('\n🚀 Welcome to Buildpad!\n'));
  console.log(chalk.dim('Copy & Own Model - Components become part of your codebase.\n'));

  // Check if already initialized
  const configPath = path.join(cwd, 'buildpad.json');
  if (fs.existsSync(configPath) && !yes) {
    const { overwrite } = await prompts({
      type: 'confirm',
      name: 'overwrite',
      message: 'buildpad.json already exists. Overwrite?',
      initial: false,
    });

    if (!overwrite) {
      console.log(chalk.yellow('\n✓ Keeping existing configuration\n'));
      return;
    }
  }

  // Detect project type
  const packageJsonPath = path.join(cwd, 'package.json');
  let projectType = 'unknown';
  let hasSrcDir = fs.existsSync(path.join(cwd, 'src'));

  if (fs.existsSync(packageJsonPath)) {
    const packageJson = await fs.readJSON(packageJsonPath);
    if (packageJson.dependencies?.['next']) {
      projectType = 'next';
      // Next.js App Router often uses 'app' instead of 'src'
      if (fs.existsSync(path.join(cwd, 'app')) && !hasSrcDir) {
        hasSrcDir = false;
      }
    } else if (packageJson.dependencies?.['vite']) {
      projectType = 'vite';
    } else if (packageJson.dependencies?.['react']) {
      projectType = 'react';
    }
  } else {
    // Create a minimal package.json for empty projects
    console.log(chalk.yellow('⚠ No package.json found. Creating minimal Next.js project...\n'));
    
    const projectName = path.basename(cwd);
    const minimalPackageJson = {
      name: projectName,
      version: '0.1.0',
      private: true,
      scripts: {
        dev: 'next dev --turbopack',
        build: 'next build',
        start: 'next start',
        lint: 'next lint'
      },
      dependencies: {
        'next': '^16.1.6',
        'react': '^19.0.0',
        'react-dom': '^19.0.0',
        '@mantine/core': '^8.0.0',
        '@mantine/hooks': '^8.0.0',
        '@mantine/modals': '^8.0.0',
        '@mantine/notifications': '^8.0.0',
        '@mantine/form': '^8.0.0',
        // Date picker styles are imported by the scaffolded app/layout.tsx
        // (@mantine/dates/styles.css), so the package + its dayjs peer must
        // always be present or the layout fails to resolve.
        '@mantine/dates': '^8.0.0',
        'dayjs': '^1.11.0',
        '@tabler/icons-react': '^3.0.0',
        // Drag-and-drop: required by core components always installed via `add --all`
        // (list-m2m, list-m2a, vtable) and the form-builder module. Without these,
        // `fix` would otherwise stub them as `declare module` (→ TS2709 namespace errors).
        '@dnd-kit/core': '^6.0.0',
        '@dnd-kit/sortable': '^9.0.0',
        '@dnd-kit/utilities': '^3.0.0',
        // Auth layer scaffolded by `add --with-api` (always run during bootstrap):
        // supabase/middleware.ts is loaded on every request, lib/oauth uses jose.
        '@supabase/ssr': '^0.5',
        '@supabase/supabase-js': '^2',
        'jose': '^5',
        // Locale routing (lib/i18n): Accept-Language negotiation in middleware,
        // server-only dictionary loading in app/[lang]/layout.tsx.
        'negotiator': '^1.0.0',
        '@formatjs/intl-localematcher': '^0.6.0',
        'server-only': '^0.0.1',
        'clsx': '^2.0.0',
        'tailwind-merge': '^2.0.0'
      },
      devDependencies: {
        '@types/negotiator': '^0.6.4',
        '@types/node': '^22',
        '@types/react': '^19',
        '@types/react-dom': '^19',
        'typescript': '^5'
      }
    };
    
    await fs.writeJSON(packageJsonPath, minimalPackageJson, { spaces: 2 });
    projectType = 'next';
    hasSrcDir = false; // New projects use App Router without src/
    console.log(chalk.green('✓ Created package.json\n'));
  }

  console.log(chalk.dim(`Detected: ${projectType} project${hasSrcDir ? ' with src directory' : ''}\n`));

  let config = { ...DEFAULT_CONFIG };
  config.srcDir = hasSrcDir;

  if (!yes) {
    // Prompt for configuration
    const answers = await prompts([
      {
        type: 'confirm',
        name: 'srcDir',
        message: 'Use src directory?',
        initial: hasSrcDir,
      },
      {
        type: 'text',
        name: 'componentsPath',
        message: 'Where should components be installed?',
        initial: '@/components/ui',
      },
      {
        type: 'text',
        name: 'libPath',
        message: 'Where should lib files (types, services, hooks) be installed?',
        initial: '@/lib/buildpad',
      },
      {
        type: 'confirm',
        name: 'tsx',
        message: 'Use TypeScript?',
        initial: true,
      },
    ]);

    config.srcDir = answers.srcDir ?? hasSrcDir;
    config.aliases.components = answers.componentsPath || '@/components/ui';
    config.aliases.lib = answers.libPath || '@/lib/buildpad';
    config.tsx = answers.tsx ?? true;
  }

  const spinner = ora('Setting up Copy & Own structure...').start();

  try {
    // Write config
    await fs.writeJSON(configPath, config, { spaces: 2 });
    spinner.succeed('Created buildpad.json');

    // Create directory structure
    // Components directory
    const componentsDir = resolveAlias(config.aliases.components, cwd, config.srcDir);
    await fs.ensureDir(componentsDir);
    console.log(chalk.green(`✓ Created ${path.relative(cwd, componentsDir)}`));

    // Lib directory structure
    const libDir = resolveAlias(config.aliases.lib, cwd, config.srcDir);
    await fs.ensureDir(libDir);
    await fs.ensureDir(path.join(libDir, 'types'));
    await fs.ensureDir(path.join(libDir, 'services'));
    await fs.ensureDir(path.join(libDir, 'hooks'));
    console.log(chalk.green(`✓ Created ${path.relative(cwd, libDir)}`));
    console.log(chalk.dim('  └── types/'));
    console.log(chalk.dim('  └── services/'));
    console.log(chalk.dim('  └── hooks/'));

    // Create tsconfig.json if missing (required for path aliases)
    const tsconfigPath = path.join(cwd, 'tsconfig.json');
    if (!fs.existsSync(tsconfigPath) && config.tsx) {
      const tsconfig = {
        compilerOptions: {
          target: 'ES2017',
          lib: ['dom', 'dom.iterable', 'esnext'],
          allowJs: true,
          skipLibCheck: true,
          strict: true,
          noEmit: true,
          esModuleInterop: true,
          module: 'esnext',
          moduleResolution: 'bundler',
          resolveJsonModule: true,
          isolatedModules: true,
          jsx: 'preserve',
          incremental: true,
          plugins: [{ name: 'next' }],
          paths: {
            '@/*': [config.srcDir ? './src/*' : './*']
          },
          baseUrl: '.'
        },
        include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
        exclude: ['node_modules']
      };
      await fs.writeJSON(tsconfigPath, tsconfig, { spaces: 2 });
      console.log(chalk.green(`✓ Created tsconfig.json with @/ path alias`));
    }

    // Create next-env.d.ts if missing (for Next.js TypeScript support)
    const nextEnvPath = path.join(cwd, 'next-env.d.ts');
    if (!fs.existsSync(nextEnvPath) && projectType === 'next') {
      const nextEnvContent = `/// <reference types="next" />
/// <reference types="next/image-types/global" />

// NOTE: This file should not be edited
// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.
`;
      await fs.writeFile(nextEnvPath, nextEnvContent);
      console.log(chalk.green(`✓ Created next-env.d.ts`));
    }

    // Create a basic Next.js app skeleton with design system files
    if (projectType === 'next') {
      const srcRoot = config.srcDir ? path.join(cwd, 'src') : cwd;
      const appDir = path.join(srcRoot, 'app');
      const libRoot = path.join(srcRoot, 'lib');
      const componentsRoot = path.join(srcRoot, 'components');

      await fs.ensureDir(appDir);
      await fs.ensureDir(libRoot);
      await fs.ensureDir(componentsRoot);

      // Locale routing first: the root layout, middleware and app shell all
      // import from lib/i18n, so the module must exist before they are copied.
      // The i18n module depends on the `services` chain (BuildpadI18nProvider),
      // which is not bundled — BUNDLED_FIRST reads it through the resolver.
      const bundledRegistry = await getBundledRegistry();
      const i18nSpinner = ora('Installing locale routing (i18n)...').start();
      try {
        await copyLibModule('i18n', bundledRegistry, config, cwd, i18nSpinner, true, BUNDLED_FIRST);
        await fs.writeJSON(configPath, config, { spaces: 2 });
        if (localeList) {
          const result = await applyLocales({
            cwd,
            srcDir: config.srcDir,
            locales: localeList,
            defaultLocale: options.defaultLocale,
          });
          console.log(
            chalk.green(`✓ Locales: ${result.locales.join(', ')} (default: ${result.defaultLocale})`)
          );
          result.created.forEach(f => console.log(chalk.dim(`  seeded ${f} from en.json — translate it`)));
        }
      } catch (err: any) {
        i18nSpinner.warn(
          `i18n module skipped: ${err.message}\n  Install it later with: npx @buildpad/cli@latest add i18n`
        );
      }

      // Plain skeleton files (not part of the upgradeable design system).
      // Every page is locale-prefixed: the root layout lives at app/[lang]/
      // and there must be NO app/layout.tsx beside it.
      await copyTemplateFile('app/layout.tsx', path.join(appDir, '[lang]', 'layout.tsx'), cwd);
      // Home page lives INSIDE the (authenticated) group so "/<lang>" renders
      // within AuthenticatedShell (header + sidebar) once api-routes adds the
      // layout. (No app/[lang]/page.tsx — that would render "/" outside the
      // shell and conflict with this route.) Unauthenticated "/" is redirected
      // to /<lang>/login by the Supabase middleware.
      await copyTemplateFile(
        'app/authenticated-page.tsx',
        path.join(appDir, '[lang]', '(authenticated)', 'page.tsx'),
        cwd
      );

      // Install the design system (tokens, globals, theme, app shell) as a
      // tracked lib module from the bundled CLI templates — offline and
      // version-matched to this CLI. Recording it in buildpad.json gives
      // `upgrade --design` a baseline to three-way merge against later.
      // (It depends on i18n, installed above; a bundled-only resolver keeps
      // this step offline even when the i18n install failed.)
      const dsSpinner = ora('Installing design system...').start();
      try {
        await copyLibModule('design-system', bundledRegistry, config, cwd, dsSpinner, true, {
          readSource: resolveBundledTemplate,
          sourceExists: bundledTemplateExists,
        });
        await fs.writeJSON(configPath, config, { spaces: 2 });
      } catch (err: any) {
        dsSpinner.warn(`Design system install skipped: ${err.message}`);
      }
    }

    // Check for required dependencies
    console.log(chalk.bold('\n📦 Checking dependencies...\n'));

    // Core dependencies always needed
    const coreDeps = [
      '@mantine/core',
      '@mantine/hooks',
      // @mantine/dates + dayjs: styles imported by the scaffolded app/layout.tsx.
      '@mantine/dates',
      'dayjs',
      // Required by the scaffolded AuthenticatedShell (components/layout).
      '@tabler/icons-react',
      // Auth layer scaffolded by `add --with-api`: supabase clients/middleware
      // (@supabase/ssr always loaded via root middleware.ts) and oauth (jose).
      '@supabase/ssr',
      '@supabase/supabase-js',
      'jose',
      // Locale routing (lib/i18n), loaded by middleware.ts and the root layout.
      'negotiator',
      '@formatjs/intl-localematcher',
      'server-only',
      'react',
      'react-dom',
    ];

    // Optional dependencies for specific features (installed on-demand when components need them)
    // @mantine/dates - DateTime component
    // @mantine/notifications - CollectionForm notifications
    // @mantine/dropzone - Upload component
    // dayjs - DateTime component

    // Utility dependencies (for utils.ts)
    const utilityDeps = ['clsx', 'tailwind-merge'];

    const missingDeps: string[] = [];
    const missingUtilDeps: string[] = [];

    if (fs.existsSync(packageJsonPath)) {
      const packageJson = await fs.readJSON(packageJsonPath);
      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      for (const dep of coreDeps) {
        if (!allDeps[dep]) {
          missingDeps.push(dep);
        }
      }

      for (const dep of utilityDeps) {
        if (!allDeps[dep]) {
          missingUtilDeps.push(dep);
        }
      }
    }

    if (missingDeps.length > 0) {
      console.log(chalk.yellow('⚠ Missing core dependencies:'));
      missingDeps.forEach(dep => console.log(chalk.dim(`  - ${dep}`)));
      console.log(chalk.dim('\nInstall with:'));
      console.log(chalk.cyan(`  pnpm add ${missingDeps.join(' ')}\n`));
    } else {
      console.log(chalk.green('✓ Core dependencies installed\n'));
    }

    if (missingUtilDeps.length > 0) {
      console.log(chalk.dim('Optional utility dependencies for cn() helper:'));
      console.log(chalk.cyan(`  pnpm add ${missingUtilDeps.join(' ')}\n`));
    }

    // Print benefits
    console.log(chalk.bold.blue('📋 Copy & Own Benefits:\n'));
    console.log('  ✅ No external package dependencies for component code');
    console.log('  ✅ Full customization - components are your application code');
    console.log('  ✅ No breaking changes from upstream updates');
    console.log('  ✅ Bundle only what you use - tree-shaking friendly');
    console.log('  ✅ Works offline after installation');

    // Success message
    console.log(chalk.bold.green('\n✨ Setup complete!\n'));
    console.log('Next steps:');
    console.log(chalk.cyan('  1. Add components: ') + chalk.dim('npx buildpad add input select-dropdown'));
    console.log(chalk.cyan('  2. List components: ') + chalk.dim('npx buildpad list'));
    console.log(chalk.cyan('  3. Add all basics: ') + chalk.dim('npx buildpad add --category input'));
    console.log(chalk.dim('\nComponents will be copied with all dependencies inlined.\n'));

  } catch (error) {
    spinner.fail('Failed to initialize');
    console.error(chalk.red(error));
    process.exit(1);
  }
}

/**
 * Resolve path alias to absolute path
 * Handles @/ aliases and accounts for srcDir configuration
 */
export function resolveAlias(alias: string, cwd: string, srcDir: boolean = true): string {
  if (alias.startsWith('@/')) {
    const relativePath = alias.slice(2);
    if (srcDir) {
      return path.join(cwd, 'src', relativePath);
    }
    return path.join(cwd, relativePath);
  }
  return path.join(cwd, alias);
}

/**
 * Load and validate the buildpad.json config.
 *
 * If the config is v1 (no `schemaVersion`), a migration hint is printed so
 * the user knows to run `npx buildpad migrate`.  The v1 config is returned
 * as-is so existing commands continue to work.
 */
export async function loadConfig(cwd: string): Promise<Config | null> {
  const configPath = path.join(cwd, 'buildpad.json');
  if (!fs.existsSync(configPath)) {
    return null;
  }
  const config = await fs.readJSON(configPath) as Config;

  const schemaVersion = config.schemaVersion ?? 1;

  if (schemaVersion > CURRENT_SCHEMA_VERSION) {
    // Written by a newer CLI. Its records may carry fields this build does not
    // understand, and writing the file back would silently drop them.
    console.error(
      chalk.red(
        `\n✗ buildpad.json is schema v${schemaVersion}; this CLI understands up to ` +
        `v${CURRENT_SCHEMA_VERSION}.\n  Upgrade the CLI: npx @buildpad/cli@latest\n`
      )
    );
    process.exit(1);
  }

  if (schemaVersion < CURRENT_SCHEMA_VERSION) {
    // v1 has no per-file records at all; v2 has local hashes but no upstream
    // baseline, so hash-based staleness cannot be computed for it.
    console.warn(
      chalk.yellow(
        `\n⚠ buildpad.json is schema v${schemaVersion} (current: v${CURRENT_SCHEMA_VERSION}). ` +
        'Run \'npx buildpad migrate\' to enable content-based update tracking.\n'
      )
    );
  }

  return config;
}

/**
 * Save the buildpad.json config
 */
export async function saveConfig(cwd: string, config: Config): Promise<void> {
  const configPath = path.join(cwd, 'buildpad.json');
  await fs.writeJSON(configPath, config, { spaces: 2 });
}
