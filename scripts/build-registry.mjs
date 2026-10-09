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

import { readFileSync, writeFileSync, existsSync, realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');
const PACKAGES_DIR = join(ROOT, 'packages');

// ─── Package name → folder name ─────────────────────────────────

/**
 * Kept in step with the CLI's install map (packages/cli/src/commands/import-map.ts)
 * by packages/cli/tests/build-registry.test.ts. Exposed for that test.
 */
export const PACKAGE_FOLDERS = {
  '@buildpad/ui-interfaces': 'ui-interfaces',
  '@buildpad/ui-form': 'ui-form',
  '@buildpad/ui-table': 'ui-table',
  '@buildpad/ui-collections': 'ui-collections',
  '@buildpad/ui-files': 'ui-files',
  '@buildpad/ui-forms': 'ui-forms',
  '@buildpad/ui-users': 'ui-users',
  '@buildpad/ui-workflows': 'ui-workflows',
  '@buildpad/ui-cron': 'ui-cron',
  '@buildpad/hooks': 'hooks',
  '@buildpad/services': 'services',
  '@buildpad/types': 'types',
  '@buildpad/utils': 'utils',
  '@buildpad/cli': 'cli',
};

// ─── Helpers ─────────────────────────────────────────────────────

function sha256(data) {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * The lockstep release version.
 *
 * Every @buildpad package is in one `fixed` changesets group, so they always
 * share a version. `@buildpad/cli` is the canonical reader of it because the
 * same value has to agree in three places or the release breaks:
 *
 *   1. this registry's `version`  → recorded as `release` in buildpad.json
 *   2. packages/cli/package.json  → the ref the CLI pins its fetches to
 *   3. the `v<version>` git tag   → created by publish.yml from (2)
 *
 * Deriving (1) from (2) makes them agree by construction. It used to be a
 * hand-edited field in registry.template.json that `changeset version` never
 * touched, so a release could ship a registry stamped with the PREVIOUS
 * version — consumers would then record that stale release in their manifest.
 */
function getReleaseVersion(template) {
  const cliPkg = join(PACKAGES_DIR, 'cli', 'package.json');
  if (existsSync(cliPkg)) {
    const { version } = JSON.parse(readFileSync(cliPkg, 'utf8'));
    if (version) return version;
  }
  return template.version;
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
  // Normalise line endings before hashing. Hashing raw bytes makes the
  // artifact platform-dependent: a checkout with `core.autocrlf=true`
  // produces hashes that can never match an LF checkout, so `--check`
  // fails permanently on CI. The CLI's own hashTransformed() already
  // normalises the same way.
  const text = readFileSync(fullPath, 'utf8').replaceAll(/\r\n/g, '\n').replaceAll(/\r/g, '\n');
  return sha256(text);
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
        .sort() // NOSONAR: deterministic diff-safe key order across environments; localeCompare would vary by ICU config
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
  const m = tag.match(/(\d+)\.(\d+)\.(\d+)/); // NOSONAR: three independent bounded-alphabet quantifiers, linear
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
 * Exposed for testing.
 */
export function inferSourcePackage(source) {
  if (source.startsWith('ui-interfaces/')) return '@buildpad/ui-interfaces';
  if (source.startsWith('ui-form/'))        return '@buildpad/ui-form';
  if (source.startsWith('ui-table/'))       return '@buildpad/ui-table';
  if (source.startsWith('ui-collections/')) return '@buildpad/ui-collections';
  if (source.startsWith('ui-files/'))       return '@buildpad/ui-files';
  if (source.startsWith('ui-forms/'))       return '@buildpad/ui-forms';
  if (source.startsWith('ui-users/'))       return '@buildpad/ui-users';
  if (source.startsWith('ui-workflows/'))   return '@buildpad/ui-workflows';
  if (source.startsWith('ui-cron/'))        return '@buildpad/ui-cron';
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
  const releaseVersion = getReleaseVersion(template);

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
      const version = packagesMap[sourcePackage]?.version ?? releaseVersion;

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
    // The lockstep release. Derived from packages/cli/package.json so it can
    // never disagree with the CLI version or the v<version> tag.
    version: releaseVersion,
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

/** Drop the one field that is expected to differ between two builds. */
const withoutGeneratedAt = (registry) => {
  const { generatedAt, ...rest } = registry;
  return rest;
};

/**
 * The `generatedAt` a build should write: the committed one whenever nothing
 * else in the artifact moved.
 *
 * Stamping `new Date()` unconditionally made every `pnpm build` rewrite
 * registry.json even on an untouched tree. That phantom diff is not cosmetic:
 * it is enough to fail release-local.sh's clean-tree preflight, so a release
 * could not follow a build without an intervening `git checkout`, and it put
 * an unexplained one-line change into PRs that never touched the registry.
 *
 * `--check` has always compared with the timestamp stripped, i.e. it already
 * treats `generatedAt` as non-semantic. This makes the writer agree: the field
 * now moves when the artifact's content moves, and otherwise holds still.
 */
export function stableGeneratedAt(fresh, committed) {
  if (!committed || typeof committed.generatedAt !== 'string') return fresh.generatedAt;
  return stableStringify(withoutGeneratedAt(fresh)) === stableStringify(withoutGeneratedAt(committed))
    ? committed.generatedAt
    : fresh.generatedAt;
}

/** The committed artifact, or undefined when it is absent or unreadable. */
function readCommittedRegistry(outPath) {
  if (!existsSync(outPath)) return undefined;
  try {
    return JSON.parse(readFileSync(outPath, 'utf8'));
  } catch {
    // A malformed artifact carries no timestamp worth keeping; regenerate it.
    return undefined;
  }
}

function writeRegistry() {
  const output = buildRegistry();
  const outPath = join(PACKAGES_DIR, 'registry.json');

  const committed = readCommittedRegistry(outPath);
  output.generatedAt = stableGeneratedAt(output, committed);
  const unchanged = committed !== undefined && output.generatedAt === committed.generatedAt;

  writeFileSync(outPath, JSON.stringify(output, null, 2) + '\n');

  console.log(`✓ Generated packages/registry.json`);
  console.log(`  schemaVersion : 2`);
  console.log(`  generatedAt   : ${output.generatedAt}${unchanged ? ' (unchanged)' : ''}`);
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
/**
 * Every module specifier in a script, as TypeScript's pre-processor reads
 * them: static imports (multi-line and type-only included), `export … from`,
 * side-effect imports, `import()` and `require()`. Comments and string
 * contents are not specifiers. Exposed for testing.
 */
export function moduleSpecifiers(text) {
  return typescript().preProcessFile(text, true, true).importedFiles.map((f) => f.fileName);
}

// Loaded on first use, so generating the registry never needs the compiler —
// only --check does (typescript is a root devDependency).
let tsModule;
function typescript() {
  tsModule ??= createRequire(import.meta.url)('typescript');
  return tsModule;
}

const SCRIPT_FILE = /\.(?:[cm]?[jt]sx?)$/;
const UI_INTERFACES_SUBPATH = '@buildpad/ui-interfaces/';

/** Resolve a relative specifier against a directory given as path segments. */
function resolveSegments(dir, spec) {
  const segments = [...dir];
  for (const part of spec.split('/')) {
    if (part === '.' || part === '') continue;
    if (part === '..') segments.pop();
    else segments.push(part);
  }
  return segments;
}

/** True when `resolved` (extensionless or not) names one of `paths`, or a directory index among them. */
function shipsPath(paths, resolved) {
  return paths.some((p) => p === resolved || p.startsWith(`${resolved}.`) || p.startsWith(`${resolved}/`));
}

/**
 * Every import in a shipped file must resolve to something the consumer will
 * actually have: another file in the SAME entry, or a component named in
 * `registryDependencies`.
 *
 * The sourceSha256 check below compares file hashes against version bumps and
 * has no notion of an import graph, so a cross-component import could be added
 * with nothing declared and the CLI would emit a file importing a component it
 * never installs — a TS2307 the consumer discovers, not CI.
 *
 * Component files are checked for:
 *   - relative imports in every form, dynamic `import()` included. The needed
 *     component is the one whose files include the resolved path (so a flat
 *     PascalCase sibling such as './CollectionList' names collection-list). A
 *     path no entry ships is reported as 'unshipped-file' (no declaration can
 *     install it), unless it names one of the entry's own files in target
 *     space (vform's index.ts, sourced from cli/templates/, imports './VForm');
 *   - `@buildpad/ui-interfaces/<x>` subpaths (static or dynamic): <x> must be
 *     a registry component, declared unless it is the entry itself.
 *
 * Exposed for testing; `packagesDir` defaults to this repo's packages/.
 */
export function collectUndeclaredImports(registry, packagesDir = PACKAGES_DIR) {
  const problems = [];
  const components = registry.components ?? registry.items ?? [];
  // Only a registry component can be a missing registryDependency.
  const componentNames = new Set(components.map((c) => c.name).filter(Boolean));
  const componentSources = components.map((c) => ({
    name: c.name,
    sources: (c.files ?? []).map((f) => f.source).filter(Boolean),
  }));
  const shippedBy = (resolved) => componentSources.find((c) => shipsPath(c.sources, resolved))?.name;

  for (const component of components) {
    const files = component.files ?? [];
    const ownSources = files.map((f) => f.source).filter(Boolean);
    const ownTargets = files.map((f) => f.target).filter(Boolean);
    const declared = new Set(component.registryDependencies ?? []);
    const needsDeclared = (needs) => needs !== component.name && !declared.has(needs);

    for (const file of files) {
      if (!file.source || !SCRIPT_FILE.test(file.source)) continue;
      const fullPath = join(packagesDir, file.source);
      if (!existsSync(fullPath)) continue;
      const text = readFileSync(fullPath, 'utf8');
      const dir = file.source.split('/').slice(0, -1);

      for (const spec of moduleSpecifiers(text)) {
        if (spec.startsWith(UI_INTERFACES_SUBPATH)) {
          const needs = spec.slice(UI_INTERFACES_SUBPATH.length).split('/')[0];
          if (!componentNames.has(needs)) {
            problems.push({ kind: 'unknown-component', component: component.name, file: file.source, spec, needs });
          } else if (needsDeclared(needs)) {
            problems.push({ component: component.name, file: file.source, spec, needs });
          }
          continue;
        }
        if (!spec.startsWith('.')) continue;
        const resolved = resolveSegments(dir, spec).join('/');
        // Same-entry import: a file this entry already ships.
        if (shipsPath(ownSources, resolved)) continue;
        // Cross-component: the component that ships the resolved file.
        const needs = shippedBy(resolved);
        if (!needs) {
          // Same entry, in target space: the import is left as written and
          // resolves beside the file's target.
          const targetDir = (file.target ?? '').split('/').slice(0, -1);
          if (file.target && shipsPath(ownTargets, resolveSegments(targetDir, spec).join('/'))) continue;
          problems.push({ kind: 'unshipped-file', component: component.name, file: file.source, spec, needs: resolved });
          continue;
        }
        if (!needsDeclared(needs)) continue;
        problems.push({ component: component.name, file: file.source, spec, needs });
      }
    }
  }

  // Lib modules (the hand-maintained barrels) were never scanned, which is
  // how a barrel could re-export '../conceal' while conceal.ts was not a
  // registry file at all. Resolve these in TARGET space: a barrel emitted at
  // lib/buildpad/utils/index.ts importing '../conceal' means
  // lib/buildpad/conceal.ts, which source-space resolution cannot express.
  for (const [moduleName, mod] of Object.entries(registry.lib ?? {})) {
    const files = mod.files ?? [];
    const ownTargets = files.map((f) => f.target).filter(Boolean);
    if (mod.path && mod.target) ownTargets.push(mod.target);

    for (const file of files) {
      if (!file.source || !file.target || !SCRIPT_FILE.test(file.source)) continue;
      const fullPath = join(packagesDir, file.source);
      if (!existsSync(fullPath)) continue;
      const text = readFileSync(fullPath, 'utf8');
      const dir = file.target.split('/').slice(0, -1);

      for (const spec of moduleSpecifiers(text)) {
        if (!spec.startsWith('.')) continue;
        const resolved = resolveSegments(dir, spec).join('/');
        if (shipsPath(ownTargets, resolved)) continue;
        problems.push({
          kind: 'lib-file',
          component: `lib:${moduleName}`,
          file: file.source,
          spec,
          needs: resolved,
        });
      }
    }
  }

  return problems;
}

function checkRegistry() {
  const outPath = join(PACKAGES_DIR, 'registry.json');
  if (!existsSync(outPath)) {
    console.error('✗ packages/registry.json not found. Run: pnpm build:registry');
    process.exit(1);
  }

  const committed = JSON.parse(readFileSync(outPath, 'utf8'));

  const undeclared = collectUndeclaredImports(committed);
  if (undeclared.length > 0) {
    console.error('\n✗ A shipped file imports something its entry does not ship or declare:\n');
    for (const u of undeclared) {
      console.error(`    ${u.component}: ${u.file} imports '${u.spec}'`);
      if (u.kind === 'lib-file') {
        console.error(`      → ${u.needs} is not shipped by that lib entry; register its source file`);
      } else if (u.kind === 'unshipped-file') {
        console.error(`      → ${u.needs} is not shipped by any registry entry; register its source file`);
      } else if (u.kind === 'unknown-component') {
        console.error(`      → "${u.needs}" is not a registry component; @buildpad/ui-interfaces/<x> must name one`);
      } else {
        console.error(`      → add "${u.needs}" to that entry's registryDependencies`);
      }
    }
    console.error('');
    process.exit(1);
  }

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
  // ignoring generatedAt — a rebuild may legitimately restamp it (and now only
  // does so when something else moved; see stableGeneratedAt).
  const registryStale =
    stableStringify(withoutGeneratedAt(fresh)) !== stableStringify(withoutGeneratedAt(committed));

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

/**
 * Whether this module is the script node was asked to run. Compares real
 * paths: node resolves symlinks for import.meta.url but not for argv[1], so a
 * URL comparison silently skipped main() — and exited 0 — when the checkout
 * was reached through a symlink (e.g. macOS /tmp).
 */
function isMainModule() {
  try {
    return !!process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

// Run only when invoked directly (e.g. `node scripts/build-registry.mjs`),
// not when imported by tests for the helper exports.
if (isMainModule()) {
  if (process.argv.includes('--check')) {
    checkRegistry();
  } else {
    writeRegistry();
  }
}
