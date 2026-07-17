#!/usr/bin/env node
/**
 * Registry Generator — scripts/build-registry.mjs
 *
 * Reads packages/registry.template.json (hand-edited metadata) and generates
 * packages/registry.json (the published artifact) with:
 *
 *   • schemaVersion: 2
 *   • generatedAt timestamp
 *   • packages map (name → { version, changelogUrl }) from each package.json
 *   • per-component `sourcePackage`, `version`, `lastChangedIn`
 *   • per-file `sourceSha256` (SHA-256 of the raw, untransformed source bytes)
 *
 * The hashes are computed from the UNTRANSFORMED source so that:
 *   - They are alias-config-independent (alias transforms happen on the consumer side).
 *   - The CLI can store a per-consumer "transformed sha256" in buildpad.json and
 *     compare it to detect local modifications without needing the registry hash.
 *
 * Usage:
 *   node scripts/build-registry.mjs            generate packages/registry.json
 *   node scripts/build-registry.mjs --check    verify it is in sync (CI; no write)
 *   pnpm build:registry
 *   pnpm registry:check
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { createHash } from 'crypto';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');
const PACKAGES_DIR = join(ROOT, 'packages');

// ─── Package name → folder name ─────────────────────────────────

const PACKAGE_FOLDERS = {
  '@buildpad/ui-interfaces': 'ui-interfaces',
  '@buildpad/ui-form': 'ui-form',
  '@buildpad/ui-table': 'ui-table',
  '@buildpad/ui-collections': 'ui-collections',
  '@buildpad/ui-files': 'ui-files',
  '@buildpad/ui-forms': 'ui-forms',
  '@buildpad/ui-users': 'ui-users',
  '@buildpad/hooks': 'hooks',
  '@buildpad/services': 'services',
  '@buildpad/types': 'types',
  '@buildpad/utils': 'utils',
};

// ─── Helpers ─────────────────────────────────────────────────────

function sha256(data) {
  return createHash('sha256').update(data).digest('hex');
}

function getPackageVersion(folder) {
  const pkgPath = join(PACKAGES_DIR, folder, 'package.json');
  if (!existsSync(pkgPath)) return '0.1.18';
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  return pkg.version;
}

function computeFileSha256(source) {
  const fullPath = join(PACKAGES_DIR, source);
  if (!existsSync(fullPath)) return undefined;
  const bytes = readFileSync(fullPath);
  return sha256(bytes);
}

/** Compare bare semver strings: >0 if a>b, <0 if a<b, 0 if equal. */
function compareSemver(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d;
  }
  return 0;
}

/** Deterministic JSON string with recursively sorted keys (for diff-safe compares). */
function stableStringify(value) {
  if (Array.isArray(value)) {
    return '[' + value.map(stableStringify).join(',') + ']';
  }
  if (value && typeof value === 'object') {
    return (
      '{' +
      Object.keys(value)
        .sort()
        .map((k) => JSON.stringify(k) + ':' + stableStringify(value[k]))
        .join(',') +
      '}'
    );
  }
  return JSON.stringify(value);
}

/**
 * Extract a bare semver `X.Y.Z` from a git tag string.
 * Handles common shapes:
 *   "1.4.2"                            → "1.4.2"
 *   "v1.4.2"                           → "1.4.2"
 *   "@buildpad/ui-interfaces@1.4.2"    → "1.4.2"
 *   "release-1.4.2"                    → "1.4.2"
 * Returns undefined if no semver can be found.
 *
 * Exposed for testing.
 */
export function extractSemverFromTag(tag) {
  if (!tag) return undefined;
  const m = tag.match(/(\d+)\.(\d+)\.(\d+)/);
  return m ? `${m[1]}.${m[2]}.${m[3]}` : undefined;
}

/**
 * Semver of a RELEASE tag, or undefined for anything else.
 * Release tags are the changesets shape `@buildpad/<pkg>@X.Y.Z` plus the
 * legacy bare / `v` / `release-` prefixed shapes. Non-release tags that
 * happen to embed a version (docs@0.1.0, storybook-host@0.1.0) must return
 * undefined — their low semvers would otherwise win the earliest-containing-
 * release selection below.
 *
 * Exposed for testing.
 */
export function releaseTagSemver(tag) {
  if (!tag) return undefined;
  const t = tag.trim();
  const m = t.match(/^@buildpad\/[^@]+@(\d+)\.(\d+)\.(\d+)$/);
  if (m) return `${m[1]}.${m[2]}.${m[3]}`;
  if (/^(v|release-)?\d+\.\d+\.\d+$/.test(t)) return extractSemverFromTag(t);
  return undefined;
}

/**
 * Lowest release semver among `tags` — i.e. the release that first shipped
 * whatever commit the tags were derived from. Returns undefined when no
 * release tag is present.
 *
 * Exposed for testing.
 */
export function earliestReleaseSemver(tags) {
  let earliest;
  for (const tag of tags) {
    const semver = releaseTagSemver(tag);
    if (semver && (!earliest || compareSemver(semver, earliest) < 0)) earliest = semver;
  }
  return earliest;
}

/**
 * Combine per-file "first release containing the last change" values into a
 * component/module-level lastChangedIn. A file whose latest change is not in
 * any release tag yet (undefined) ships in the UPCOMING release — it must
 * dominate as `version`, not be skipped: a component whose .tsx changed
 * yesterday but whose .css last shipped in 1.8.0 has lastChangedIn = the
 * upcoming version, or consumers at 1.8.0 would never be flagged.
 *
 * Exposed for testing.
 */
export function deriveLastChangedIn(perFileTags, version) {
  let latest;
  for (const tag of perFileTags) {
    const effective = tag ?? version;
    if (!latest || compareSemver(effective, latest) > 0) latest = effective;
  }
  return latest ?? version;
}

// Last-change commit → earliest containing release. Files last touched by the
// same commit (the common case for a component's file set) share one lookup.
const containingReleaseCache = new Map();

/**
 * The release (as bare semver) that first shipped the most recent change to
 * `fullPath`: take the file's last-change commit and find the earliest
 * release tag containing it. Returns undefined when git is unavailable, the
 * file has no history, or its latest change is not in any release tag yet
 * (i.e. it changes in the upcoming release — callers fall back to the
 * package version, which is exactly that release).
 *
 * NOTE: this must NOT look for tag decorations on the file's own commits
 * (the pre-1.8.1 implementation did) — changesets tags point at release
 * commits, which never touch component sources, so that lookup found
 * nothing and every component degraded to lastChangedIn == version
 * ("everything changed every release").
 */
function getLastChangedTag(fullPath) {
  try {
    const gitOpts = { cwd: ROOT, stdio: ['pipe', 'pipe', 'pipe'], encoding: 'utf8', timeout: 5000 };
    const sha = execSync(`git log -1 --follow --format=%H -- "${fullPath}"`, gitOpts).trim();
    if (!sha) return undefined;

    if (containingReleaseCache.has(sha)) return containingReleaseCache.get(sha);
    const tags = execSync(`git tag --contains ${sha}`, gitOpts).split('\n');
    const semver = earliestReleaseSemver(tags);
    containingReleaseCache.set(sha, semver);
    return semver;
  } catch {
    // git not available or no history — ignore
    return undefined;
  }
}

/**
 * Infer which source package owns a registry file path.
 * Files coming from cli/templates/* are treated as CLI-owned.
 */
function inferSourcePackage(source) {
  if (source.startsWith('ui-interfaces/')) return '@buildpad/ui-interfaces';
  if (source.startsWith('ui-form/'))        return '@buildpad/ui-form';
  if (source.startsWith('ui-table/'))       return '@buildpad/ui-table';
  if (source.startsWith('ui-collections/')) return '@buildpad/ui-collections';
  if (source.startsWith('ui-files/'))       return '@buildpad/ui-files';
  if (source.startsWith('ui-forms/'))       return '@buildpad/ui-forms';
  if (source.startsWith('ui-users/'))       return '@buildpad/ui-users';
  if (source.startsWith('hooks/'))          return '@buildpad/hooks';
  if (source.startsWith('services/'))       return '@buildpad/services';
  if (source.startsWith('types/'))          return '@buildpad/types';
  if (source.startsWith('utils/'))          return '@buildpad/utils';
  return '@buildpad/cli';
}

// ─── Registry assembly ──────────────────────────────────────────

/**
 * Build the registry artifact in memory (does not write to disk).
 * Pure aside from reading the source tree + git history.
 */
function buildRegistry() {
  const packagesMap = {};
  for (const [pkgName, folder] of Object.entries(PACKAGE_FOLDERS)) {
    packagesMap[pkgName] = {
      version: getPackageVersion(folder),
      changelogUrl: `${folder}/CHANGELOG.md`,
    };
  }

  // ─── Load template ─────────────────────────────────────────────
  const templatePath = join(PACKAGES_DIR, 'registry.template.json');
  if (!existsSync(templatePath)) {
    console.error('Error: packages/registry.template.json not found.');
    console.error('Create it by copying packages/registry.json, then re-run.');
    process.exit(1);
  }
  const template = JSON.parse(readFileSync(templatePath, 'utf8'));

  // ─── Enrich components ─────────────────────────────────────────
  const enrichedComponents = (template.components ?? []).map((component) => {
    const firstFile = component.files?.[0];
    const sourcePackage = firstFile
      ? inferSourcePackage(firstFile.source)
      : '@buildpad/ui-interfaces';

    const version = packagesMap[sourcePackage]?.version ?? '0.1.18';

    // lastChangedIn: the release that first shipped the most recent change to
    // ANY of this component's source files. Scanning every file matters — a
    // change to a non-first file (a hook, a types module) must still bump
    // lastChangedIn. Untagged changes dominate as the upcoming release; see
    // deriveLastChangedIn.
    const lastChangedIn = deriveLastChangedIn(
      (component.files ?? []).map((file) => getLastChangedTag(join(PACKAGES_DIR, file.source))),
      version
    );

    // Enrich each file with its source SHA-256
    const enrichedFiles = (component.files ?? []).map((file) => {
      const sourceSha256 = computeFileSha256(file.source);
      return sourceSha256 ? { ...file, sourceSha256 } : file;
    });

    return {
      ...component,
      sourcePackage,
      version,
      lastChangedIn,
      files: enrichedFiles,
    };
  });

  // ─── Enrich lib modules ────────────────────────────────────────
  // Mirror the component enrichment: each module gets a sourcePackage,
  // version, and lastChangedIn so `outdated`/`upgrade` can detect staleness
  // (e.g. the design-system module). Sources under cli/templates/* are
  // attributed to @buildpad/cli via inferSourcePackage.
  const enrichedLib = Object.fromEntries(
    Object.entries(template.lib ?? {}).map(([key, mod]) => {
      const enrichedFiles = (mod.files ?? []).map((file) => {
        const sourceSha256 = computeFileSha256(file.source);
        return sourceSha256 ? { ...file, sourceSha256 } : file;
      });

      // Determine the owning package from the first source (files or path).
      const firstSource = mod.files?.[0]?.source ?? mod.path;
      const sourcePackage = firstSource
        ? inferSourcePackage(firstSource)
        : '@buildpad/cli';
      const version = packagesMap[sourcePackage]?.version ?? template.version;

      // lastChangedIn: the release that first shipped the latest change to ANY
      // of the module's source files (and its single-file `path`). Untagged
      // changes dominate as the upcoming release; see deriveLastChangedIn.
      const allSources = [...(mod.files ?? []).map((f) => f.source)];
      if (mod.path) allSources.push(mod.path);
      const lastChangedIn = deriveLastChangedIn(
        allSources.map((source) => getLastChangedTag(join(PACKAGES_DIR, source))),
        version
      );

      let enrichedMod = {
        ...mod,
        sourcePackage,
        version,
        lastChangedIn,
        files: enrichedFiles,
      };
      if (mod.path) {
        const sourceSha256 = computeFileSha256(mod.path);
        if (sourceSha256) enrichedMod = { ...enrichedMod, sourceSha256 };
      }
      return [key, enrichedMod];
    })
  );

  // ─── Assemble output ───────────────────────────────────────────
  return {
    $schema: template.$schema,
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    // Legacy v1 field kept for backward compat with older CLI versions
    version: template.version,
    name: template.name,
    description: template.description,
    license: template.license,
    repository: template.repository,
    meta: template.meta,
    aliases: template.aliases,
    dependencies: template.dependencies,
    packages: packagesMap,
    lib: enrichedLib,
    components: enrichedComponents,
    categories: template.categories,
  };
}

// ─── Generate mode ──────────────────────────────────────────────

function writeRegistry() {
  const output = buildRegistry();
  const outPath = join(PACKAGES_DIR, 'registry.json');
  writeFileSync(outPath, JSON.stringify(output, null, 2) + '\n');

  console.log(`✓ Generated packages/registry.json`);
  console.log(`  schemaVersion : 2`);
  console.log(`  generatedAt   : ${output.generatedAt}`);
  console.log(`  packages      : ${Object.keys(output.packages).length}`);
  console.log(`  components    : ${output.components.length}`);
  console.log(`  lib modules   : ${Object.keys(output.lib).length}`);
}

// ─── Check mode (CI / pre-publish guard) ────────────────────────

/** Collect every source file → its recorded sourceSha256 from a registry. */
function collectFileHashes(registry) {
  const hashes = new Map();
  for (const c of registry.components ?? []) {
    for (const f of c.files ?? []) {
      if (f.source && f.sourceSha256) hashes.set(f.source, f.sourceSha256);
    }
  }
  for (const mod of Object.values(registry.lib ?? {})) {
    for (const f of mod.files ?? []) {
      if (f.source && f.sourceSha256) hashes.set(f.source, f.sourceSha256);
    }
    if (mod.path && mod.sourceSha256) hashes.set(mod.path, mod.sourceSha256);
  }
  return hashes;
}

/**
 * Verify packages/registry.json is in sync with the source tree WITHOUT
 * writing anything. Intended for CI / pre-publish.
 *
 * Exits non-zero when:
 *   1. A source file's hash changed but its owning package version was NOT
 *      bumped — the dangerous "silent un-versioned change" case.
 *   2. registry.json is otherwise stale (version bumped / files added but the
 *      artifact was never regenerated).
 */
function checkRegistry() {
  const outPath = join(PACKAGES_DIR, 'registry.json');
  if (!existsSync(outPath)) {
    console.error('✗ packages/registry.json not found. Run: pnpm build:registry');
    process.exit(1);
  }

  const committed = JSON.parse(readFileSync(outPath, 'utf8'));
  const fresh = buildRegistry();
  const committedHashes = collectFileHashes(committed);

  const unversioned = []; // changed source, package version NOT bumped
  const needsRegen = new Set(); // changed/new source, regeneration required

  const checkFile = (source, freshHash, pkg) => {
    if (!source || !freshHash) return;
    const recorded = committedHashes.get(source);
    if (recorded === undefined) {
      needsRegen.add(source); // newly added file
      return;
    }
    if (recorded === freshHash) return; // unchanged
    const recordedVer = committed.packages?.[pkg]?.version;
    const freshVer = fresh.packages?.[pkg]?.version;
    if (recordedVer && freshVer && recordedVer === freshVer) {
      unversioned.push({ file: source, pkg, version: freshVer });
    } else {
      needsRegen.add(source);
    }
  };

  for (const c of fresh.components ?? []) {
    for (const f of c.files ?? []) checkFile(f.source, f.sourceSha256, c.sourcePackage);
  }
  for (const mod of Object.values(fresh.lib ?? {})) {
    for (const f of mod.files ?? []) {
      checkFile(f.source, f.sourceSha256, inferSourcePackage(f.source));
    }
    if (mod.path) checkFile(mod.path, mod.sourceSha256, inferSourcePackage(mod.path));
  }

  // Non-hash staleness: compare the whole artifact, key-order-independent,
  // ignoring the always-changing generatedAt timestamp.
  const strip = (r) => { const { generatedAt, ...rest } = r; return rest; };
  const registryStale =
    stableStringify(strip(fresh)) !== stableStringify(strip(committed));

  if (unversioned.length > 0) {
    console.error('\n✗ Source changed without a version bump:\n');
    for (const u of unversioned) {
      console.error(`    ${u.file}`);
      console.error(`      owner: ${u.pkg} (still at ${u.version})`);
    }
    console.error('\n  These files changed but their package version was not bumped,');
    console.error('  so "outdated" cannot detect the change. Add a changeset, bump the');
    console.error('  package, then run: pnpm build:registry\n');
    process.exit(1);
  }

  if (registryStale) {
    console.error('\n✗ packages/registry.json is out of date.\n');
    for (const f of needsRegen) console.error(`    ${f}`);
    console.error('\n  Regenerate it with: pnpm build:registry\n');
    process.exit(1);
  }

  console.log('✓ registry.json is in sync — all source changes are versioned.');
}

// Run only when invoked directly (e.g. `node scripts/build-registry.mjs`),
// not when imported by tests for the helper exports.
if (import.meta.url.endsWith('build-registry.mjs') || process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/build-registry.mjs')) {
  if (process.argv.includes('--check')) {
    checkRegistry();
  } else {
    writeRegistry();
  }
}
