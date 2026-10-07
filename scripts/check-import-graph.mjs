#!/usr/bin/env node
/**
 * Import-graph acyclicity guard — scripts/check-import-graph.mjs
 *
 * Builds two import graphs and fails on any import cycle that is not on the
 * allow-list below:
 *
 *   • package graph — @buildpad/<pkg> → @buildpad/<pkg>, from every
 *     `@buildpad/*` specifier in packages/<pkg>/src (stories and tests too:
 *     they are part of each package's type program);
 *   • registry-entry graph — component/lib entry → entry, from the imports in
 *     the files each entry ships (packages/registry.json), resolved the way a
 *     consumer gets them: relative and '@/…' paths to the entry that ships the
 *     file, `@buildpad/<pkg>[/<sub>]` through the package's re-exports to the
 *     entry that declares each imported name.
 *
 * The allow-lists name every edge that currently sits on a cycle (an edge
 * inside a strongly connected component). An edge that closes a NEW cycle
 * fails, and so does an allow-listed edge that is no longer on a cycle — the
 * list only shrinks (remove the entry when a cycle is broken).
 *
 * Usage:
 *   node scripts/check-import-graph.mjs          check (CI)
 *   node scripts/check-import-graph.mjs --print  list the graphs' cycle edges
 *   pnpm graph:check
 */

import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGES_DIR = join(ROOT, 'packages');

/**
 * Edges that are on an import cycle today. Each needs a reason; delete the
 * entry once the cycle is broken (the check fails until you do).
 */
export const ALLOWED_CYCLE_EDGES = {
  package: [
    // ui-form ⇄ ui-interfaces ⇄ ui-collections: VForm renders interfaces
    // (FormFieldInterface, FormGroupField), relational interfaces render
    // CollectionForm/CollectionList and VForm (ListO2M/M2M/M2A,
    // JunctionItemForm), CollectionForm renders VForm. Broken by the planned
    // relational-slot context (cycle-break).
    '@buildpad/ui-collections -> @buildpad/ui-form',
    '@buildpad/ui-form -> @buildpad/ui-interfaces',
    '@buildpad/ui-interfaces -> @buildpad/ui-collections',
    '@buildpad/ui-interfaces -> @buildpad/ui-form',
  ],
  entry: [
    // The same cycle at entry level: vform's FormFieldInterface looks up every
    // relational interface in the components barrel; the list-* entries render
    // CollectionForm (→ vform) and JunctionItemForm renders VForm. list-o2m,
    // list-m2m, select-dropdown-m2o and collection-item-dropdown also reach
    // list-m2a for render-template.ts, which has no imports of its own.
    'collection-form -> vform',
    'collection-item-dropdown -> list-m2a',
    'list-m2a -> vform',
    'list-m2m -> collection-form',
    'list-m2m -> list-m2a',
    'list-o2m -> collection-form',
    'list-o2m -> list-m2a',
    'select-dropdown-m2o -> list-m2a',
    'vform -> collection-item-dropdown',
    'vform -> list-m2a',
    'vform -> list-m2m',
    'vform -> list-o2m',
    'vform -> select-dropdown-m2o',
    // services ships lib/module-access/enforce.ts, which imports
    // @/lib/supabase/server; supabase-auth's middleware imports lib/i18n, and
    // the i18n provider imports the services barrel. Undeclared on purpose
    // (copyLibModule cannot install a lib cycle) — see the closure allow-list
    // in packages/cli/tests/registry-transform.test.ts.
    'lib:i18n -> lib:services',
    'lib:services -> lib:supabase-auth',
    'lib:supabase-auth -> lib:i18n',
  ],
};

const SCRIPT = /\.(?:[cm]?[jt]sx?)$/;
const RESOLVE_SUFFIXES = ['', '.ts', '.tsx', '.d.ts', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js', '/index.jsx'];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist') continue;
    const abs = join(dir, name);
    if (statSync(abs).isDirectory()) walk(abs, out);
    else if (SCRIPT.test(name)) out.push(abs);
  }
  return out;
}

/** Module specifiers in a script (static, type-only, export-from, side-effect, dynamic, require). */
export function moduleSpecifiers(text) {
  return ts.preProcessFile(text, true, true).importedFiles.map((f) => f.fileName);
}

/** `@buildpad/<pkg>` for any `@buildpad/<pkg>[/sub]` specifier, else undefined. */
function buildpadPackage(spec) {
  const m = /^(@buildpad\/[^/]+)/.exec(spec);
  return m ? m[1] : undefined;
}

/** folder → package name for every packages/<folder>/package.json. */
export function workspacePackages(packagesDir = PACKAGES_DIR) {
  const map = new Map();
  for (const folder of readdirSync(packagesDir)) {
    const manifest = join(packagesDir, folder, 'package.json');
    if (existsSync(manifest)) map.set(folder, JSON.parse(readFileSync(manifest, 'utf8')).name);
  }
  return map;
}

/** Package graph: name → Map<name, first file importing it>. */
export function packageGraph(packagesDir = PACKAGES_DIR) {
  const graph = new Map();
  for (const [folder, name] of workspacePackages(packagesDir)) {
    const src = join(packagesDir, folder, 'src');
    const edges = new Map();
    graph.set(name, edges);
    if (!existsSync(src)) continue;
    for (const file of walk(src)) {
      for (const spec of moduleSpecifiers(readFileSync(file, 'utf8'))) {
        const target = buildpadPackage(spec);
        if (target && target !== name && !edges.has(target)) {
          edges.set(target, posix.relative(packagesDir.split('\\').join('/'), file.split('\\').join('/')));
        }
      }
    }
  }
  return graph;
}

// ─── Registry-entry graph ─────────────────────────────────────────────

function firstExisting(base, exists) {
  for (const suffix of RESOLVE_SUFFIXES) if (exists(base + suffix)) return base + suffix;
  return undefined;
}

/**
 * Named exports of a source file (packages-relative path) → the file that
 * declares each, following `export … from` and `export *` within packages/.
 */
function makeExportResolver(packagesDir) {
  const cache = new Map();
  const exists = (rel) => existsSync(join(packagesDir, rel)) && statSync(join(packagesDir, rel)).isFile();

  function exportsOf(file, stack = new Set()) {
    if (cache.has(file)) return cache.get(file);
    const result = new Map();
    if (stack.has(file) || !exists(file)) return result;
    stack.add(file);
    const sf = ts.createSourceFile(file, readFileSync(join(packagesDir, file), 'utf8'), ts.ScriptTarget.Latest, false);
    const resolveRel = (spec) => (spec.startsWith('.') ? firstExisting(posix.join(posix.dirname(file), spec), exists) : undefined);
    for (const st of sf.statements) {
      if (ts.isExportDeclaration(st)) {
        const spec = st.moduleSpecifier && ts.isStringLiteral(st.moduleSpecifier) ? st.moduleSpecifier.text : undefined;
        const target = spec ? resolveRel(spec) : undefined;
        if (st.exportClause && ts.isNamedExports(st.exportClause)) {
          for (const el of st.exportClause.elements) {
            const local = (el.propertyName ?? el.name).text;
            const declaredIn = target ? exportsOf(target, stack).get(local) ?? target : file;
            result.set(el.name.text, declaredIn);
          }
        } else if (target) {
          for (const [name, declaredIn] of exportsOf(target, stack)) if (!result.has(name)) result.set(name, declaredIn);
        }
        continue;
      }
      const mods = ts.canHaveModifiers(st) ? ts.getModifiers(st) ?? [] : [];
      if (!mods.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) continue;
      if (ts.isVariableStatement(st)) {
        for (const d of st.declarationList.declarations) if (ts.isIdentifier(d.name)) result.set(d.name.text, file);
      } else if (st.name && ts.isIdentifier(st.name)) {
        result.set(st.name.text, file);
      }
    }
    stack.delete(file);
    cache.set(file, result);
    return result;
  }
  return { exportsOf, exists };
}

/** Names a script imports from each specifier (`*` for namespace / side-effect / dynamic). */
function importedNames(text, fileName) {
  const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, false, fileName.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const bySpec = new Map();
  const add = (spec, names) => bySpec.set(spec, [...(bySpec.get(spec) ?? []), ...names]);
  for (const st of sf.statements) {
    if (!(ts.isImportDeclaration(st) || ts.isExportDeclaration(st))) continue;
    if (!st.moduleSpecifier || !ts.isStringLiteral(st.moduleSpecifier)) continue;
    const spec = st.moduleSpecifier.text;
    if (ts.isImportDeclaration(st)) {
      const clause = st.importClause;
      const bindings = clause?.namedBindings;
      if (bindings && ts.isNamedImports(bindings)) add(spec, bindings.elements.map((e) => (e.propertyName ?? e.name).text));
      else if (clause?.name && !bindings) add(spec, ['default']);
      else add(spec, ['*']);
    } else if (st.exportClause && ts.isNamedExports(st.exportClause)) {
      add(spec, st.exportClause.elements.map((e) => (e.propertyName ?? e.name).text));
    } else {
      add(spec, ['*']);
    }
  }
  // Anything only the pre-processor sees (dynamic import, require, import('x').T).
  for (const spec of moduleSpecifiers(text)) if (!bySpec.has(spec)) add(spec, ['*']);
  return bySpec;
}

const entryKey = (kind, name) => (kind === 'lib' ? `lib:${name}` : name);

/** Registry-entry graph: entry → Map<entry, first "file → specifier">. */
export function entryGraph(registry, packagesDir = PACKAGES_DIR) {
  const folders = new Map([...workspacePackages(packagesDir)].map(([folder, name]) => [name, folder]));
  const { exportsOf, exists } = makeExportResolver(packagesDir);

  const entries = [
    ...registry.components.map((c) => ({ key: entryKey('component', c.name), files: c.files, component: true })),
    ...Object.entries(registry.lib).map(([name, m]) => ({
      key: entryKey('lib', name),
      files: [...(m.files ?? []), ...(m.path && m.target ? [{ source: m.path, target: m.target }] : [])],
      component: false,
    })),
  ];
  const sourceOwner = new Map();
  const targetOwner = new Map();
  for (const e of entries) {
    for (const f of e.files) {
      sourceOwner.set(f.source, e.key);
      // Component .ts targets are written as .tsx; both resolve to the entry.
      targetOwner.set(f.target, e.key);
      if (e.component) targetOwner.set(f.target.replace(/\.tsx?$/, '.tsx'), e.key);
    }
  }
  const componentNames = new Set(registry.components.map((c) => c.name));

  /** Entries that declare `names` exported by source file `file` (or own `file`). */
  const ownersThrough = (file, names) => {
    const direct = sourceOwner.get(file);
    if (direct) return [direct];
    const exported = exportsOf(file);
    const declaring = names.includes('*') ? [...exported.values()] : names.map((n) => exported.get(n)).filter(Boolean);
    return [...new Set(declaring.map((f) => sourceOwner.get(f)).filter(Boolean))];
  };

  const graph = new Map(entries.map((e) => [e.key, new Map()]));
  for (const e of entries) {
    for (const f of e.files) {
      if (!SCRIPT.test(f.source) || !exists(f.source)) continue;
      const templated = f.source.startsWith('cli/templates/');
      for (const [spec, names] of importedNames(readFileSync(join(packagesDir, f.source), 'utf8'), f.source)) {
        let owners = [];
        if (spec.startsWith('.')) {
          if (templated) {
            const t = firstExisting(posix.join(posix.dirname(f.target), spec), (p) => targetOwner.has(p));
            owners = t ? [targetOwner.get(t)] : [];
          } else {
            const s = firstExisting(posix.join(posix.dirname(f.source), spec), exists);
            owners = s ? ownersThrough(s, names) : [];
          }
        } else if (spec.startsWith('@/')) {
          const t = firstExisting(spec.slice(2), (p) => targetOwner.has(p));
          owners = t ? [targetOwner.get(t)] : [];
        } else {
          const pkg = buildpadPackage(spec);
          const folder = pkg && folders.get(pkg);
          if (!folder) continue;
          const sub = spec.slice(pkg.length + 1);
          if (pkg === '@buildpad/ui-interfaces' && sub && componentNames.has(sub.split('/')[0])) {
            owners = [sub.split('/')[0]];
          } else {
            const file = firstExisting(posix.join(folder, 'src', sub || 'index'), exists);
            owners = file ? ownersThrough(file, names) : [];
          }
        }
        for (const owner of owners) {
          if (owner !== e.key && !graph.get(e.key).has(owner)) graph.get(e.key).set(owner, `${f.source} → ${spec}`);
        }
      }
    }
  }
  return graph;
}

// ─── Cycles ───────────────────────────────────────────────────────────

/** Strongly connected components (Tarjan), each as a sorted array of nodes. */
export function stronglyConnected(graph) {
  let index = 0;
  const indices = new Map();
  const low = new Map();
  const stack = [];
  const onStack = new Set();
  const result = [];
  const visit = (v) => {
    indices.set(v, index);
    low.set(v, index);
    index++;
    stack.push(v);
    onStack.add(v);
    for (const w of graph.get(v)?.keys() ?? []) {
      if (!indices.has(w)) {
        visit(w);
        low.set(v, Math.min(low.get(v), low.get(w)));
      } else if (onStack.has(w)) {
        low.set(v, Math.min(low.get(v), indices.get(w)));
      }
    }
    if (low.get(v) === indices.get(v)) {
      const scc = [];
      let w;
      do {
        w = stack.pop();
        onStack.delete(w);
        scc.push(w);
      } while (w !== v);
      result.push(scc.sort());
    }
  };
  for (const v of graph.keys()) if (!indices.has(v)) visit(v);
  return result;
}

/** Every edge whose two ends are in the same SCC, i.e. every edge on some cycle. */
export function cycleEdges(graph) {
  const component = new Map();
  for (const scc of stronglyConnected(graph)) for (const v of scc) component.set(v, scc);
  const edges = [];
  for (const [from, targets] of graph) {
    for (const [to, via] of targets) {
      if (from === to || component.get(from) === component.get(to)) edges.push({ edge: `${from} -> ${to}`, via });
    }
  }
  return edges.sort((a, b) => (a.edge < b.edge ? -1 : a.edge > b.edge ? 1 : 0));
}

/** Compare a graph's cycle edges with its allow-list. */
export function compareWithAllowList(graph, allowed) {
  const found = cycleEdges(graph);
  const foundSet = new Set(found.map((e) => e.edge));
  return {
    unexpected: found.filter((e) => !allowed.includes(e.edge)),
    stale: allowed.filter((e) => !foundSet.has(e)),
  };
}

function main() {
  const registry = JSON.parse(readFileSync(join(PACKAGES_DIR, 'registry.json'), 'utf8'));
  const graphs = { package: packageGraph(), entry: entryGraph(registry) };

  if (process.argv.includes('--print')) {
    for (const [kind, graph] of Object.entries(graphs)) {
      console.log(`${kind} graph — edges on a cycle:`);
      for (const { edge, via } of cycleEdges(graph)) console.log(`  '${edge}',   // ${via}`);
    }
    return;
  }

  let failed = false;
  for (const [kind, graph] of Object.entries(graphs)) {
    const { unexpected, stale } = compareWithAllowList(graph, ALLOWED_CYCLE_EDGES[kind]);
    if (unexpected.length > 0) {
      failed = true;
      console.error(`\n✗ New import cycle in the ${kind} graph:\n`);
      for (const { edge, via } of unexpected) console.error(`    ${edge}\n      via ${via}`);
      console.error('\n  Break the cycle (or, if it is intended, add the edge to ALLOWED_CYCLE_EDGES with a reason).');
    }
    if (stale.length > 0) {
      failed = true;
      console.error(`\n✗ Allow-listed ${kind} edges no longer on a cycle — remove them from ALLOWED_CYCLE_EDGES:\n`);
      for (const edge of stale) console.error(`    ${edge}`);
    }
  }
  if (failed) {
    console.error('');
    process.exit(1);
  }
  console.log(
    `✓ No new import cycles (package graph: ${ALLOWED_CYCLE_EDGES.package.length} allow-listed edges, ` +
      `registry-entry graph: ${ALLOWED_CYCLE_EDGES.entry.length}).`,
  );
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

if (isMainModule()) main();
