/**
 * Remote/Local Source Resolver
 *
 * Abstracts file fetching so the CLI works in two modes:
 *
 * 1. **Remote mode** (default when installed via npm / npx)
 *    Fetches registry.json and component source files from the GitHub raw CDN.
 *
 * 2. **Local mode** (when running from the monorepo checkout)
 *    Reads files directly from the `packages/` directory on disk.
 *
 * The mode is determined automatically:
 *   - If `PACKAGES_ROOT/registry.json` exists on disk → local mode
 *   - Otherwise → remote mode (uses REGISTRY_BASE_URL)
 */

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Configuration ───────────────────────────────────────────────

/**
 * Base URL for fetching files remotely.
 * Points to the raw GitHub content of the `main` branch.
 *
 * Override at runtime with the `BUILDPAD_REGISTRY_URL` env var.
 *
 * ⚠️  REPLACE the placeholder below with your actual GitHub org/repo.
 */
const DEFAULT_REGISTRY_URL =
  'https://raw.githubusercontent.com/microbuild-ui/ui/main/packages';

/**
 * Runtime-configurable registry URL.
 */
export const REGISTRY_BASE_URL =
  process.env.BUILDPAD_REGISTRY_URL ?? DEFAULT_REGISTRY_URL;

/**
 * Base URL for fetching CHANGELOG.md files. Override via env var.
 * Defaults to the same repo as the registry, on the `main` branch.
 */
export const CHANGELOG_BASE_URL =
  process.env.BUILDPAD_CHANGELOG_URL ??
  'https://raw.githubusercontent.com/microbuild-ui/ui/main/packages';

/**
 * Build the URL to a versioned source file on GitHub raw CDN.
 * `ref` should already be encoded (or URL-safe).
 */
export function buildVersionedSourceUrl(ref: string, source: string): string {
  return `https://raw.githubusercontent.com/microbuild-ui/ui/${ref}/packages/${source}`;
}

// Local packages root (only valid when running from monorepo)
// From dist/index.js → packages/cli/dist → needs ../../ to reach packages/
const LOCAL_PACKAGES_ROOT = path.resolve(__dirname, '../..');

/**
 * Detect whether we are running locally inside the monorepo.
 */
function isLocalMode(): boolean {
  return fs.existsSync(path.join(LOCAL_PACKAGES_ROOT, 'registry.json'));
}

// ─── Public API ──────────────────────────────────────────────────

/** Registry v2: per-package version + changelog location */
export interface RegistryPackageInfo {
  version: string;
  changelogUrl: string;
}

export interface Registry {
  /** Schema version — 1 (legacy) or 2 (generated artifact). */
  schemaVersion?: number;
  /** ISO timestamp when registry.json was last generated. */
  generatedAt?: string;
  /** Legacy single-version field (v1 compat). */
  version: string;
  name: string;
  lib: Record<string, LibModule>;
  components: ComponentEntry[];
  categories: Array<{ name: string; title: string; description: string }>;
  dependencies?: Record<string, string[]>;
  aliases?: Record<string, string>;
  meta?: Record<string, unknown>;
  /** v2: per-package semver map. */
  packages?: Record<string, RegistryPackageInfo>;
}

export interface FileMapping {
  source: string;
  target: string;
  /** SHA-256 of the raw (untransformed) source file bytes (v2 only). */
  sourceSha256?: string;
}

export interface LibModule {
  name: string;
  description: string;
  files?: FileMapping[];
  path?: string;
  target?: string;
  dependencies?: string[];
  internalDependencies?: string[];
  /** Components this module requires (e.g. files-routes → file-manager). */
  registryDependencies?: string[];
  /**
   * Sidebar entries this module contributes. On install, the CLI appends
   * them to `components/layout/navigation.ts` (matched by href, idempotent).
   * `icon` is a @tabler/icons-react export name; `section` groups entries
   * under a labelled sidebar heading (default "Main Menu").
   */
  navItems?: Array<{ label: string; href: string; icon: string; section?: string }>;
  /** v2: owning source package, e.g. "@buildpad/cli". */
  sourcePackage?: string;
  /** v2: semver of the source package at registry generation time. */
  version?: string;
  /** v2: last package version in which any of this module's files changed. */
  lastChangedIn?: string;
}

export interface ComponentEntry {
  name: string;
  title: string;
  description: string;
  category: string;
  files: FileMapping[];
  dependencies: string[];
  internalDependencies: string[];
  registryDependencies?: string[];
  /**
   * When true, the component is skipped by bulk installs (`add --all`,
   * bootstrap). It remains installable by explicit name (`add form-builder`)
   * or by category. Used for opt-in feature modules (form-builder, file-manager).
   */
  excludeFromAll?: boolean;
  /** v2: owning source package, e.g. "@buildpad/ui-interfaces". */
  sourcePackage?: string;
  /** v2: semver of the source package at registry generation time. */
  version?: string;
  /** v2: last package version in which any of this component's files changed. */
  lastChangedIn?: string;
}

// In-memory cache so we fetch registry.json at most once per CLI invocation
let _registryCache: Registry | null = null;

/**
 * Load registry.json (local or remote).
 */
export async function getRegistry(): Promise<Registry> {
  if (_registryCache) return _registryCache;

  if (isLocalMode()) {
    const registryPath = path.join(LOCAL_PACKAGES_ROOT, 'registry.json');
    _registryCache = await fs.readJSON(registryPath) as Registry;
  } else {
    const url = `${REGISTRY_BASE_URL}/registry.json`;
    _registryCache = await fetchJSON<Registry>(url);
  }

  return _registryCache;
}

/**
 * Read a source file referenced in registry.json.
 *
 * @param source – the `source` field from a FileMapping, e.g. `"types/src/core.ts"`
 * @returns the file content as a UTF-8 string
 */
export async function resolveSourceFile(source: string): Promise<string> {
  if (isLocalMode()) {
    const fullPath = path.join(LOCAL_PACKAGES_ROOT, source);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Source file not found on disk: ${fullPath}`);
    }
    return fs.readFile(fullPath, 'utf-8');
  }

  // Remote mode
  const url = `${REGISTRY_BASE_URL}/${source}`;
  return fetchText(url);
}

/**
 * Check whether a source file exists.
 * In remote mode we optimistically return `true` (the registry is the manifest).
 */
export async function sourceFileExists(source: string): Promise<boolean> {
  if (isLocalMode()) {
    return fs.existsSync(path.join(LOCAL_PACKAGES_ROOT, source));
  }
  // In remote mode, trust the registry – the file should exist.
  return true;
}

/**
 * Resolve a template file (used by `init` command).
 * Templates are bundled inside the CLI package under `dist/templates/`.
 * When running locally they live in `packages/cli/templates/`.
 */
export function getTemplatesRoot(): string {
  // When built, templates are copied into dist/templates by tsup copy plugin
  const builtTemplates = path.resolve(__dirname, 'templates');
  if (fs.existsSync(builtTemplates)) return builtTemplates;

  // Fallback: running locally from source
  const localTemplates = path.resolve(__dirname, '../templates');
  if (fs.existsSync(localTemplates)) return localTemplates;

  throw new Error(
    'Templates directory not found. Ensure the CLI is built correctly.'
  );
}

/**
 * Return the local PACKAGES_ROOT (only meaningful in local mode).
 * Falls back gracefully so remote-mode callers don't break.
 */
export function getLocalPackagesRoot(): string {
  return LOCAL_PACKAGES_ROOT;
}

/**
 * Load registry.json from the CLI bundle (offline) instead of the network.
 *
 * `init` installs the bundled `design-system` module without a network round
 * trip, so it needs the registry definition that ships with the CLI version
 * the user invoked. The build step copies registry.json into `dist/` next to
 * the compiled entry; locally it lives at `packages/registry.json`.
 */
export async function getBundledRegistry(): Promise<Registry> {
  const bundled = path.resolve(__dirname, 'registry.json');
  if (fs.existsSync(bundled)) {
    return fs.readJSON(bundled) as Promise<Registry>;
  }
  const local = path.join(LOCAL_PACKAGES_ROOT, 'registry.json');
  if (fs.existsSync(local)) {
    return fs.readJSON(local) as Promise<Registry>;
  }
  throw new Error(
    'Bundled registry.json not found. Ensure the CLI is built correctly.'
  );
}

/**
 * Read a `cli/templates/*` source file from the bundled templates (offline),
 * mirroring `resolveSourceFile` but sourced from the CLI bundle rather than the
 * network. Used by `init` so the scaffold matches the installed CLI version.
 */
export async function resolveBundledTemplate(source: string): Promise<string> {
  const prefix = 'cli/templates/';
  if (!source.startsWith(prefix)) {
    throw new Error(
      `resolveBundledTemplate only handles cli/templates/* sources, got: ${source}`
    );
  }
  const rel = source.slice(prefix.length);
  const fullPath = path.join(getTemplatesRoot(), rel);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Bundled template not found: ${fullPath}`);
  }
  return fs.readFile(fullPath, 'utf-8');
}

/** Whether a `cli/templates/*` source exists in the bundled templates. */
export async function bundledTemplateExists(source: string): Promise<boolean> {
  const prefix = 'cli/templates/';
  if (!source.startsWith(prefix)) return false;
  return fs.existsSync(path.join(getTemplatesRoot(), source.slice(prefix.length)));
}

/**
 * Build a changesets-style git tag for a specific package + version.
 *
 * Changesets emits tags like `@buildpad/ui-interfaces@1.4.2` for scoped packages
 * (and `pkg@1.4.2` for unscoped). We replicate that convention so historical
 * sources are reachable on the GitHub raw CDN.
 *
 * Exposed for testing.
 */
export function buildPackageTag(sourcePackage: string, version: string): string {
  return `${sourcePackage}@${version}`;
}

/**
 * Fetch a specific version of a source file from GitHub raw CDN.
 *
 * Used by `upgrade --three-way` to obtain the "base" (common ancestor)
 * for three-way merging.  Falls back gracefully — callers should catch
 * errors and degrade to a 2-way `.new` flow when the network is unavailable.
 *
 * Tries two ref formats in order:
 *   1. `${sourcePackage}@${version}` (changesets-style; works for per-package releases)
 *   2. bare `${version}` (legacy / lockstep releases)
 *
 * @param source         - registry-relative source path, e.g. "ui-interfaces/src/input/Input.tsx"
 * @param sourcePackage  - e.g. "@buildpad/ui-interfaces"
 * @param version        - semver string, e.g. "1.4.2"
 */
export async function fetchSourceAtVersion(
  source: string,
  sourcePackage: string,
  version: string
): Promise<string> {
  const refs = [buildPackageTag(sourcePackage, version), version];
  let lastErr: unknown;
  for (const ref of refs) {
    const url = buildVersionedSourceUrl(encodeURIComponent(ref), source);
    try {
      return await fetchText(url);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr ?? new Error(`Failed to fetch ${source} at any known ref`);
}

// ─── HTTP helpers ────────────────────────────────────────────────

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `Failed to fetch ${url}: ${res.status} ${res.statusText}`
    );
  }
  return res.text();
}

async function fetchJSON<T>(url: string): Promise<T> {
  const text = await fetchText(url);
  return JSON.parse(text) as T;
}
