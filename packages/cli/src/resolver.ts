/**
 * Remote/Local Source Resolver
 *
 * Abstracts file fetching so the CLI works in two modes:
 *
 * 1. **Remote mode** (default when installed via npm / npx)
 *    Fetches registry.json and component source files from the GitHub raw CDN,
 *    pinned to the release tag that matches this CLI's own version.
 *
 * 2. **Local mode** (when running from the monorepo checkout)
 *    Reads files directly from the `packages/` directory on disk.
 *
 * The mode is determined automatically:
 *   - If `PACKAGES_ROOT/registry.json` exists on disk → local mode
 *   - Otherwise → remote mode (uses the pinned ref)
 *
 * ## Why the fetch is pinned
 *
 * The CLI used to read registry.json and every source file from `main`, while
 * the registry it read declared a single release version. `main` moves between
 * releases, so `add` copied post-release content and recorded it under the
 * previous release's version — and `upgrade --three-way` then fetched a diff3
 * base that predated what the consumer actually had on disk. Merges ran against
 * the wrong ancestor.
 *
 * Under lockstep releases the CLI version *is* the release version, so the CLI
 * pins every fetch to `v<its own version>`. `npx @buildpad/cli@2.0.0` resolves
 * the same bytes on any day; tags are immutable, so no CDN cache can serve
 * something newer. To pin the components, pin the CLI.
 */

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Configuration ───────────────────────────────────────────────

/** Raw-CDN root for the repository that hosts the registry and sources. */
const REPO_RAW_BASE = 'https://raw.githubusercontent.com/buildpad-ai/ui';

/**
 * This CLI's own version, read from its package.json — the same source
 * `buildpad --version` uses, so the pinned ref can never drift from the
 * published version.
 */
function readCliVersion(): string {
  try {
    const require = createRequire(import.meta.url);
    const pkg = require('../package.json') as { version?: string };
    if (pkg.version) return pkg.version;
  } catch {
    /* fall through */
  }
  return 'main';
}

const CLI_VERSION = readCliVersion();

/** This CLI's own semver — `main` when the package.json could not be read. */
export function getCliVersion(): string {
  return CLI_VERSION;
}

/** The release tag this CLI version corresponds to, e.g. `v2.0.0`. */
const DEFAULT_REF = CLI_VERSION === 'main' ? 'main' : `v${CLI_VERSION}`;

/**
 * Explicit ref override from `--ref <git-ref>`. Set once by the command layer
 * before any fetch happens.
 */
let _refOverride: string | undefined;

/**
 * Override the git ref every remote fetch resolves against (`--ref`).
 * Development escape hatch: `--ref main` reads unreleased content.
 */
export function setSourceRef(ref: string): void {
  _refOverride = ref;
  _registryCache = null; // a different ref is a different registry
}

/**
 * The git ref remote fetches resolve against.
 * Precedence: `--ref` → `BUILDPAD_REF` → `v<cli version>`.
 */
export function getSourceRef(): string {
  return _refOverride ?? process.env.BUILDPAD_REF ?? DEFAULT_REF;
}

/**
 * The ref to record in buildpad.json for files fetched now. This is what a
 * later `upgrade` uses as the exact diff3 base, so it must describe where the
 * bytes actually came from — including the escape hatches.
 */
export function getRecordedRef(): string {
  if (process.env.BUILDPAD_REGISTRY_URL) return `url:${process.env.BUILDPAD_REGISTRY_URL}`;
  if (isLocalMode()) return 'local';
  return getSourceRef();
}

/**
 * Percent-encode a git ref for a raw-CDN path. `/` is left intact so branch
 * names like `feat/foo` still resolve; `@` and other specials are encoded.
 */
export function encodeRef(ref: string): string {
  return encodeURIComponent(ref).replace(/%2F/g, '/');
}

/**
 * Base URL for fetching packages-relative files at the current ref.
 * `BUILDPAD_REGISTRY_URL` overrides it wholesale (points at a mirror or a
 * local static server); the ref is then not ours to reason about.
 */
export function registryBaseUrl(): string {
  return (
    process.env.BUILDPAD_REGISTRY_URL ??
    `${REPO_RAW_BASE}/${encodeRef(getSourceRef())}/packages`
  );
}

/**
 * Base URL for fetching CHANGELOG.md files. Override via env var.
 * Changelogs are cumulative, so they are read from `main` rather than the
 * pinned ref — a consumer wants to see what shipped *after* their version too.
 */
export const CHANGELOG_BASE_URL =
  process.env.BUILDPAD_CHANGELOG_URL ?? `${REPO_RAW_BASE}/main/packages`;

/**
 * Build the URL to a source file at a specific git ref on the raw CDN.
 * `ref` is encoded here — pass the plain ref.
 */
export function buildVersionedSourceUrl(ref: string, source: string): string {
  return `${REPO_RAW_BASE}/${encodeRef(ref)}/packages/${source}`;
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
  navItems?: Array<{
    label: string;
    /** Dictionary path (lib/i18n) resolved by the shell, e.g. "app.nav.users". */
    labelKey?: string;
    href: string;
    icon: string;
    section?: string;
    /** Dictionary path for the section heading, e.g. "app.nav.administration". */
    sectionKey?: string;
  }>;
  /** v2: owning source package, e.g. "@buildpad/cli". */
  sourcePackage?: string;
  /** v2: semver of the source package at registry generation time. */
  version?: string;
  /** v2: last package version in which any of this module's files changed. */
  lastChangedIn?: string;
  /** v2: SHA-256 of the raw source bytes for a single-path module. */
  sourceSha256?: string;
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
    const url = `${registryBaseUrl()}/registry.json`;
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
  const url = `${registryBaseUrl()}/${source}`;
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
 * Fetch registry.json as it stood at an exact git ref.
 *
 * Used by `migrate` to recover the upstream hashes a v2 manifest never
 * recorded: the registry published with release `vX.Y.Z` states the
 * `sourceSha256` of every file that release shipped.
 *
 * Throws when the ref has no registry (releases before the `v<version>` tags
 * were created) — callers fall back rather than guessing.
 */
export async function fetchRegistryAtRef(ref: string): Promise<Registry> {
  const url = `${REPO_RAW_BASE}/${encodeRef(ref)}/packages/registry.json`;
  return fetchJSON<Registry>(url);
}

/**
 * Fetch a source file at an exact git ref.
 *
 * Used by `upgrade` to obtain the diff3 base: the manifest records the ref each
 * file was installed from, so the base is the bytes the consumer actually
 * started from rather than a guess derived from a version number.
 *
 * Throws when the ref is unreachable — callers degrade to a `.new` file and
 * mark the entry `pending`.
 */
export async function fetchSourceAtRef(source: string, ref: string): Promise<string> {
  return fetchText(buildVersionedSourceUrl(ref, source));
}

/**
 * Legacy diff3-base lookup for manifests written before per-file refs existed
 * (schema v2). Tries the changesets per-package tag, then the plain release
 * tag, then a bare semver.
 *
 * Prefer `fetchSourceAtRef` with `manifest.file.ref`. This exists only so a
 * v2 manifest that has not been migrated still gets a usable base.
 */
export async function fetchSourceAtVersion(
  source: string,
  sourcePackage: string,
  version: string
): Promise<string> {
  const refs = [buildPackageTag(sourcePackage, version), `v${version}`, version];
  let lastErr: unknown;
  for (const ref of refs) {
    try {
      return await fetchSourceAtRef(source, ref);
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
