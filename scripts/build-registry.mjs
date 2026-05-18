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
 *   node scripts/build-registry.mjs
 *   pnpm build:registry
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
 * Ask git for the most recent tag (as bare semver) that included a change
 * to `fullPath`.  Returns undefined when git is unavailable, no tags exist
 * yet, or no tag could be parsed into a semver.
 */
function getLastChangedTag(fullPath) {
  try {
    // Walk the log; stop at the first line that mentions a tag decoration.
    const raw = execSync(
      `git log --format="%D" --tags --follow -- "${fullPath}"`,
      { cwd: ROOT, stdio: ['pipe', 'pipe', 'pipe'], encoding: 'utf8', timeout: 5000 }
    );
    for (const line of raw.split('\n')) {
      const m = line.match(/tag:\s*([^\s,]+)/);
      if (m) {
        const semver = extractSemverFromTag(m[1]);
        if (semver) return semver;
      }
    }
  } catch {
    // git not available or no history — ignore
  }
  return undefined;
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
  if (source.startsWith('hooks/'))          return '@buildpad/hooks';
  if (source.startsWith('services/'))       return '@buildpad/services';
  if (source.startsWith('types/'))          return '@buildpad/types';
  if (source.startsWith('utils/'))          return '@buildpad/utils';
  return '@buildpad/cli';
}

// ─── Main (only runs when executed directly, not on import) ──────

function main() {
const packagesMap = {};
for (const [pkgName, folder] of Object.entries(PACKAGE_FOLDERS)) {
  packagesMap[pkgName] = {
    version: getPackageVersion(folder),
    changelogUrl: `${folder}/CHANGELOG.md`,
  };
}

// ─── Load template ───────────────────────────────────────────────

const templatePath = join(PACKAGES_DIR, 'registry.template.json');
if (!existsSync(templatePath)) {
  console.error('Error: packages/registry.template.json not found.');
  console.error('Create it by copying packages/registry.json, then re-run.');
  process.exit(1);
}
const template = JSON.parse(readFileSync(templatePath, 'utf8'));

// ─── Enrich components ───────────────────────────────────────────

const enrichedComponents = (template.components ?? []).map((component) => {
  const firstFile = component.files?.[0];
  const sourcePackage = firstFile
    ? inferSourcePackage(firstFile.source)
    : '@buildpad/ui-interfaces';

  const version = packagesMap[sourcePackage]?.version ?? '0.1.18';

  // lastChangedIn: last git tag that touched the first source file (fallback: version)
  let lastChangedIn = version;
  if (firstFile) {
    const fullPath = join(PACKAGES_DIR, firstFile.source);
    const tag = getLastChangedTag(fullPath);
    if (tag) lastChangedIn = tag;
  }

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

// ─── Enrich lib modules ──────────────────────────────────────────

const enrichedLib = Object.fromEntries(
  Object.entries(template.lib ?? {}).map(([key, mod]) => {
    const enrichedFiles = (mod.files ?? []).map((file) => {
      const sourceSha256 = computeFileSha256(file.source);
      return sourceSha256 ? { ...file, sourceSha256 } : file;
    });
    // Single-file modules
    let enrichedMod = { ...mod, files: enrichedFiles };
    if (mod.path) {
      const sourceSha256 = computeFileSha256(mod.path);
      if (sourceSha256) enrichedMod = { ...enrichedMod, sourceSha256 };
    }
    return [key, enrichedMod];
  })
);

// ─── Assemble output ─────────────────────────────────────────────

const output = {
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

// ─── Write output ─────────────────────────────────────────────────

const outPath = join(PACKAGES_DIR, 'registry.json');
writeFileSync(outPath, JSON.stringify(output, null, 2) + '\n');

console.log(`✓ Generated packages/registry.json`);
console.log(`  schemaVersion : 2`);
console.log(`  generatedAt   : ${output.generatedAt}`);
console.log(`  packages      : ${Object.keys(packagesMap).length}`);
console.log(`  components    : ${enrichedComponents.length}`);
console.log(`  lib modules   : ${Object.keys(enrichedLib).length}`);
}

// Run only when invoked directly (e.g. `node scripts/build-registry.mjs`),
// not when imported by tests for the helper exports.
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
