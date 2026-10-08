/**
 * Registry corpus gate.
 *
 * Runs the CLI's install transform over EVERY file packages/registry.json ships
 * and checks the consumer-shaped result, so a missed rewrite rule or an
 * undeclared dependency fails here instead of as a TS2307 in a consumer app:
 *
 *   1. no `@buildpad/*` module specifier survives the transform, in any form;
 *   2. every '@/' and relative specifier resolves against the registry targets,
 *      the generated barrel and the init skeleton;
 *   3. every entry, installed alone, resolves within its own declared closure;
 *   4. the transformer's package map, the registry and packages/*\/package.json
 *      agree on the set of @buildpad packages.
 */

import { describe, expect, test } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { BUILDPAD_PACKAGES, NON_INSTALLABLE_PACKAGES } from '../src/commands/import-map.js';
import { rewriteBuildpadSpecifiers } from '../src/commands/transformer.js';
import { isCommentedOut, scanSpecifiers } from '../src/utils/import-specifiers.js';
import {
  BARREL,
  PACKAGES_DIR,
  REPO_ROOT,
  barrelExports,
  extractSpecifiers,
  initSkeleton,
  installClosure,
  isScript,
  libFiles,
  loadRegistry,
  makeConfig,
  namesImportedFrom,
  ownerKey,
  readSource,
  renderBarrel,
  resolveLocal,
  transformCorpus,
  type CorpusFile,
} from './helpers/registry-corpus.js';

const registry = loadRegistry();
const config = makeConfig();
const corpus = transformCorpus(registry, config);
const skeleton = initSkeleton();

/** Consumer path → content for a whole-registry install (last writer wins, as on disk). */
function filesOf(entries: CorpusFile[]): Map<string, string> {
  const files = new Map<string, string>();
  for (const f of entries) files.set(f.finalTarget, f.content);
  for (const [target, content] of skeleton) files.set(target, content);
  return files;
}

const everything = filesOf(corpus);
const fullBarrel = renderBarrel(registry.components.map(c => c.name), registry, everything);
everything.set(BARREL, fullBarrel.content);

/**
 * Imports that cannot resolve within their entry's declared closure and cannot
 * be fixed in this phase without moving a file to another entry (source and
 * target paths are frozen: a moved source breaks the three-way-merge base of
 * every consumer copy). Every entry must still be hit, so this list can only
 * shrink.
 */
const CLOSURE_ALLOWLIST: Record<string, string> = {
  // external-oauth already depends on api-routes. Declaring the reverse edge
  // makes copyLibModule recurse forever (a module is recorded as installed
  // only after its dependencies), and dependencies install first, so
  // api-routes' basic auth callback would then overwrite external-oauth's
  // OAuth-aware one (both target app/api/auth/callback/route.ts).
  // `add --with-api` / bootstrap install both explicitly (add.ts).
  'lib:api-routes app/api/auth/logout/route.ts @/lib/oauth/config':
    'api-routes ↔ external-oauth: needs the OAuth helpers moved out of external-oauth',
  // supabase-auth → i18n → services, so services → supabase-auth would close a
  // cycle copyLibModule cannot install. enforce.ts belongs in supabase-auth or
  // api-routes, which is a target-owner move.
  'lib:services lib/module-access/enforce.ts @/lib/supabase/server':
    'services ships lib/module-access/enforce.ts, which needs supabase-auth',
};

/**
 * Names the generated barrel exports from more than one component. The barrel
 * re-exports each from the first (renderComponentsIndex); a new one should be
 * a deliberate decision, so it must be listed here.
 */
const KNOWN_BARREL_DUPLICATES = ['DeleteConfirmModal', 'DeleteConfirmModalProps'];

describe('registry corpus: transformed output', () => {
  test('covers every registry file', () => {
    const expected =
      Object.values(registry.lib).reduce((n, m) => n + (m.files?.length ?? 0) + (m.path ? 1 : 0), 0) +
      registry.components.reduce((n, c) => n + c.files.length, 0);
    expect(corpus.length).toBe(expected);
    expect(corpus.length).toBeGreaterThan(300);
  });

  test('srcDir does not change transformed bytes (one layout covers both)', () => {
    const srcLayout = transformCorpus(registry, makeConfig({ srcDir: true }));
    expect(srcLayout.map(f => f.content)).toEqual(corpus.map(f => f.content));
  });

  test('no @buildpad/* module specifier survives, in any import form', () => {
    const leftovers: string[] = [];
    for (const f of corpus) {
      if (isScript(f.finalTarget)) {
        for (const s of extractSpecifiers(f.content)) {
          if (s.text.startsWith('@buildpad/')) {
            leftovers.push(`${ownerKey(f.owner)} ${f.finalTarget}:${s.line} '${s.text}'${s.ambient ? ' (declare module)' : ''}`);
          }
        }
      } else if (/@import\s+(?:url\()?['"]?@buildpad\//.test(f.content)) {
        leftovers.push(`${ownerKey(f.owner)} ${f.finalTarget}: CSS @import of @buildpad/*`);
      }
    }
    expect(leftovers).toEqual([]);
  });

  test("the CLI's lexical scanner sees every import TypeScript sees, in every shipped source", () => {
    // validate, fix and the transform's fail-closed rule all rely on the
    // scanner; a form it misses would pass through all three unnoticed.
    const missed: string[] = [];
    let checked = 0;
    for (const f of corpus) {
      if (!isScript(f.source)) continue;
      const raw = readSource(f.source);
      const lines = raw.split('\n');
      const seen = new Set(
        scanSpecifiers(raw)
          .filter(m => !isCommentedOut(lines[m.line - 1] ?? '', m.column))
          .map(m => `${m.line} ${m.specifier}`),
      );
      for (const s of extractSpecifiers(raw)) {
        if (s.ambient) continue;
        checked++;
        if (!seen.has(`${s.line} ${s.text}`)) missed.push(`${f.source}:${s.line} '${s.text}'`);
      }
    }
    expect(missed).toEqual([]);
    expect(checked).toBeGreaterThan(1500);
  });

  test("every '@/' and relative specifier resolves (registry targets + barrel + init skeleton)", () => {
    const present = new Set(everything.keys());
    const unresolved: string[] = [];
    for (const [file, content] of everything) {
      if (!isScript(file)) continue;
      for (const s of extractSpecifiers(content)) {
        if (s.ambient) continue;
        if (resolveLocal(s.text, file, present) === null) {
          unresolved.push(`${file}:${s.line} '${s.text}'`);
        }
      }
    }
    expect(unresolved).toEqual([]);
  });

  test("import('@buildpad/ui-interfaces/<x>') resolves for every ui-interfaces component (lazy loading)", () => {
    const present = new Set(everything.keys());
    const interfaces = registry.components.filter(c => c.sourcePackage === '@buildpad/ui-interfaces');
    expect(interfaces.length).toBeGreaterThan(30);
    const unresolved: string[] = [];
    for (const c of interfaces) {
      const rewritten = rewriteBuildpadSpecifiers(`const C = lazy(() => import('@buildpad/ui-interfaces/${c.name}'));`, config);
      const [spec] = extractSpecifiers(rewritten);
      if (!resolveLocal(spec.text, 'components/ui/vform/components/FormFieldInterface.tsx', present)) {
        unresolved.push(`${c.name} → ${spec.text}`);
      }
    }
    expect(unresolved).toEqual([]);
  });

  test('every name imported from the barrel is exported by it', () => {
    const exported = barrelExports(fullBarrel.content, everything);
    const missing: string[] = [];
    for (const f of corpus) {
      if (!isScript(f.finalTarget)) continue;
      for (const { line, names } of namesImportedFrom(f.content, f.finalTarget, config.aliases.components)) {
        for (const name of names) if (!exported.has(name)) missing.push(`${f.finalTarget}:${line} ${name}`);
      }
    }
    expect(missing).toEqual([]);
  });

  test('the generated barrel resolves duplicate names explicitly', () => {
    expect(fullBarrel.duplicates.map(d => d.name).sort()).toEqual([...KNOWN_BARREL_DUPLICATES].sort());
    for (const d of fullBarrel.duplicates) {
      expect(fullBarrel.content).toMatch(new RegExp(`^export (type )?\\{ ${d.name} \\} from '${d.paths[0]}';$`, 'm'));
    }
  });
});

describe('registry corpus: per-entry closure', () => {
  const byOwner = new Map<string, CorpusFile[]>();
  for (const f of corpus) {
    const key = ownerKey(f.owner);
    byOwner.set(key, [...(byOwner.get(key) ?? []), f]);
  }

  /** Problems for one entry installed on its own (plus the init baseline). */
  function closureProblems(request: { components?: string[]; libs?: string[] }, ownKey: string): string[] {
    const closure = installClosure(registry, request);
    const installed = corpus.filter(f =>
      f.owner.kind === 'component' ? closure.components.has(f.owner.name) : closure.libs.has(f.owner.name),
    );
    const files = filesOf(installed);
    const barrel = renderBarrel([...closure.components], registry, files);
    files.set(BARREL, barrel.content);
    const present = new Set(files.keys());
    const exported = barrelExports(barrel.content, files);

    const problems: string[] = [];
    for (const f of byOwner.get(ownKey) ?? []) {
      if (!isScript(f.finalTarget)) continue;
      for (const s of extractSpecifiers(f.content)) {
        if (s.ambient) continue;
        if (resolveLocal(s.text, f.finalTarget, present) === null) {
          problems.push(`${ownKey} ${f.finalTarget} ${s.text}`);
        }
      }
      for (const { line, names } of namesImportedFrom(f.content, f.finalTarget, config.aliases.components)) {
        for (const name of names) {
          if (!exported.has(name)) problems.push(`${ownKey} ${f.finalTarget} ${config.aliases.components}#${name} (line ${line})`);
        }
      }
    }
    return problems;
  }

  const problemsByEntry = new Map<string, string[]>();
  for (const c of registry.components) problemsByEntry.set(c.name, closureProblems({ components: [c.name] }, c.name));
  for (const l of Object.keys(registry.lib)) problemsByEntry.set(`lib:${l}`, closureProblems({ libs: [l] }, `lib:${l}`));

  test.each([...problemsByEntry.keys()])('%s resolves within its declared closure', key => {
    expect(problemsByEntry.get(key)!.filter(p => !(p in CLOSURE_ALLOWLIST))).toEqual([]);
  });

  test('every closure allow-list entry is still needed', () => {
    const all = [...problemsByEntry.values()].flat();
    expect(Object.keys(CLOSURE_ALLOWLIST).filter(k => !all.includes(k))).toEqual([]);
  });
  // A closure walk that reads only an entry's DIRECT internalDependencies
  // (installMissingLibDeps, a co-upgrade) must still reach every lib module
  // the entry's sources import, so a transitive path is not enough: hooks
  // imports @buildpad/utils itself and must declare it, not only reach it
  // through services.
  test('every lib module directly declares each lib-backed @buildpad package its sources import', () => {
    const libNames = new Set(Object.keys(registry.lib));
    const undeclared: string[] = [];
    for (const [name, entry] of Object.entries(registry.lib)) {
      const declared = new Set(entry.internalDependencies ?? []);
      for (const file of libFiles(entry)) {
        if (!isScript(file.target)) continue;
        for (const s of extractSpecifiers(readSource(file.source))) {
          const pkg = /^@buildpad\/([\w-]+)(?:\/|$)/.exec(s.text)?.[1];
          if (pkg && pkg !== name && libNames.has(pkg) && !declared.has(pkg)) undeclared.push(`${name} ${file.source} -> ${pkg}`);
        }
      }
    }
    expect(undeclared).toEqual([]);
  });
});

describe('registry corpus: @buildpad package names agree', () => {
  const workspace = new Map<string, string>(); // folder → package name
  for (const folder of fs.readdirSync(PACKAGES_DIR)) {
    const pkgJson = path.join(PACKAGES_DIR, folder, 'package.json');
    if (fs.existsSync(pkgJson)) workspace.set(folder, JSON.parse(fs.readFileSync(pkgJson, 'utf8')).name);
  }
  const workspaceNames = new Set(workspace.values());
  const registryPackages = new Set(Object.keys(registry.packages ?? {}));

  /** Workspace packages the registry deliberately does not distribute. */
  const NOT_DISTRIBUTED = ['@buildpad/mcp'];
  /**
   * Workspace packages whose registry entry and install mapping have not
   * landed yet: the components come first, the registry component and the CLI
   * templates after them. Delete a name here in the change that registers it
   * — the two tests below then hold it to the same rules as every other
   * package, and the last test in this block fails if a name is left behind.
   */
  const NOT_YET_REGISTERED: string[] = [];
  test('registry.packages = workspace packages minus the non-distributed ones', () => {
    expect([...registryPackages].sort()).toEqual(
      [...workspaceNames].filter(n => !NOT_DISTRIBUTED.includes(n) && !NOT_YET_REGISTERED.includes(n)).sort(),
    );
  });

  test("each registry package's changelog folder holds that package", () => {
    for (const [name, info] of Object.entries(registry.packages ?? {})) {
      const folder = info.changelogUrl.split('/')[0];
      expect(workspace.get(folder), name).toBe(name);
    }
  });

  test("every shipped file's folder package is a registry package, and owns its entry", () => {
    const problems: string[] = [];
    for (const f of corpus) {
      const folderPkg = workspace.get(f.source.split('/')[0]);
      if (!folderPkg || !registryPackages.has(folderPkg)) problems.push(`${f.source}: ${folderPkg}`);
    }
    for (const c of registry.components) {
      const owner = workspace.get(c.files[0].source.split('/')[0]);
      if (c.sourcePackage !== owner) problems.push(`${c.name}: sourcePackage ${c.sourcePackage} ≠ ${owner}`);
    }
    expect(problems).toEqual([]);
  });

  test('the transformer maps every importable registry package, from its own folder', () => {
    // @buildpad/cli owns templates; it is never imported by a shipped file.
    const importable = [...registryPackages].filter(n => n !== '@buildpad/cli');
    expect(Object.keys(BUILDPAD_PACKAGES).sort()).toEqual(importable.sort());
    for (const [name, target] of Object.entries(BUILDPAD_PACKAGES)) {
      expect(workspace.get(target.folder), name).toBe(name);
    }
    // Every workspace package is either mapped or explicitly never installed.
    expect(
      [...workspaceNames].filter(n => !(n in BUILDPAD_PACKAGES) && !NOT_YET_REGISTERED.includes(n)).sort(),
    ).toEqual(Object.keys(NON_INSTALLABLE_PACKAGES).sort());
  });

  test('the changesets fixed group is exactly the workspace packages', () => {
    const changesets = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, '.changeset/config.json'), 'utf8'));
    expect([...changesets.fixed[0]].sort()).toEqual([...workspaceNames].sort());
  });

  test('a package listed as not yet registered is a workspace package that is still unregistered', () => {
    for (const name of NOT_YET_REGISTERED) {
      expect(workspaceNames.has(name), `${name} is not a workspace package`).toBe(true);
      // Registered since: take it off the list, so the tests above cover it again
      expect(registryPackages.has(name) || name in BUILDPAD_PACKAGES, `${name} is registered now`).toBe(false);
    }
  });
});
