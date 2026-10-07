/**
 * Shared helpers for the registry corpus tests: run the CLI's install
 * transform over every file packages/registry.json ships, then reason about
 * the consumer-shaped result (import specifiers, resolution, closures, the
 * generated barrel) without touching a real project.
 *
 * Paths are consumer paths relative to the source root (the project root, or
 * src/ when `srcDir` is set): the transform never looks at srcDir, so both
 * layouts produce the same bytes at the same relative paths.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import type { Config } from '../../src/commands/init.js';
import { INIT_SKELETON_FILES } from '../../src/commands/init.js';
import type { ComponentEntry, LibModule, Registry } from '../../src/resolver.js';
import { transformRegistryFile } from '../../src/commands/transformer.js';
import { collectExportedNames, renderComponentsIndex } from '../../src/utils/components-index.js';

export const PACKAGES_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export const REPO_ROOT = path.dirname(PACKAGES_DIR);
export const TEMPLATES_DIR = path.join(PACKAGES_DIR, 'cli/templates');

export const DEFAULT_ALIASES = { components: '@/components/ui', lib: '@/lib/buildpad' };

export function loadRegistry(): Registry {
  return JSON.parse(fs.readFileSync(path.join(PACKAGES_DIR, 'registry.json'), 'utf8'));
}

export function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    model: 'copy-own',
    schemaVersion: 3,
    tsx: true,
    srcDir: false,
    aliases: { ...DEFAULT_ALIASES },
    installedLib: [],
    installedComponents: [],
    ...overrides,
  };
}

export function readSource(source: string): string {
  return fs.readFileSync(path.join(PACKAGES_DIR, source), 'utf8');
}

export type Owner =
  | { kind: 'component'; name: string; entry: ComponentEntry }
  | { kind: 'lib'; name: string; entry: LibModule };

/** A registry file as the owning entry lists it. `single` marks a lib's legacy `path`/`target` pair. */
export interface RegistryFile {
  source: string;
  target: string;
  single?: boolean;
}

/** Transform one registry file's raw source the way the CLI installs it. */
export type TransformFn = (
  raw: string,
  file: RegistryFile,
  owner: Owner,
  registry: Registry,
  config: Config,
) => string;

/**
 * The install pipeline: transformRegistryFile, the one transform `add`,
 * `upgrade` and `migrate` share.
 */
export const addPipeline: TransformFn = (raw, file, owner, registry, config) =>
  transformRegistryFile(
    raw,
    file,
    owner.kind === 'component'
      ? { kind: 'component', name: owner.name, files: owner.entry.files, sourcePackage: owner.entry.sourcePackage }
      : { kind: 'lib', name: owner.name, sourcePackage: owner.entry.sourcePackage },
    config,
    registry.version,
  );

export interface CorpusFile {
  owner: Owner;
  source: string;
  target: string;
  /** Where the CLI writes it: component .ts/.tsx targets take the project's extension. */
  finalTarget: string;
  content: string;
}

export function libFiles(mod: LibModule): RegistryFile[] {
  const files: RegistryFile[] = [...(mod.files ?? [])].map(f => ({ source: f.source, target: f.target }));
  if (mod.path && mod.target) files.push({ source: mod.path, target: mod.target, single: true });
  return files;
}

export function finalTargetOf(owner: Owner, target: string, config: Config): string {
  return owner.kind === 'component' ? target.replace(/\.tsx?$/, config.tsx ? '.tsx' : '.jsx') : target;
}

/** Every registry file, transformed. Lib modules first, then components, in registry order. */
export function transformCorpus(
  registry: Registry,
  config: Config,
  transform: TransformFn = addPipeline,
): CorpusFile[] {
  const out: CorpusFile[] = [];
  for (const [name, entry] of Object.entries(registry.lib)) {
    const owner: Owner = { kind: 'lib', name, entry };
    for (const file of libFiles(entry)) {
      const content = transform(readSource(file.source), file, owner, registry, config);
      out.push({ owner, source: file.source, target: file.target, finalTarget: finalTargetOf(owner, file.target, config), content });
    }
  }
  for (const entry of registry.components) {
    const owner: Owner = { kind: 'component', name: entry.name, entry };
    for (const file of entry.files) {
      const content = transform(readSource(file.source), file, owner, registry, config);
      out.push({ owner, source: file.source, target: file.target, finalTarget: finalTargetOf(owner, file.target, config), content });
    }
  }
  return out;
}

export function isScript(target: string): boolean {
  return /\.(tsx?|jsx?|mts|cts)$/.test(target);
}

export interface Specifier {
  text: string;
  line: number;
  ambient?: boolean;
}

/**
 * Every module specifier in a script, as the TypeScript pre-processor sees it:
 * static imports (incl. type-only and multi-line), `export … from`, side-effect
 * imports, `import()` (incl. `import('x').T` type positions), `require()`,
 * `import x = require()`, and `declare module '…'` names. Comments and string
 * contents are not specifiers.
 */
export function extractSpecifiers(content: string): Specifier[] {
  const info = ts.preProcessFile(content, true, true);
  const lineOf = (pos: number) => content.slice(0, pos).split('\n').length;
  return [
    ...info.importedFiles.map(f => ({ text: f.fileName, line: lineOf(f.pos) })),
    ...(info.ambientExternalModules ?? []).map(text => ({ text, line: 0, ambient: true })),
  ];
}

const RESOLVE_SUFFIXES = ['', '.ts', '.tsx', '.d.ts', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js', '/index.jsx'];

/**
 * Resolve a consumer-local specifier ('@/…' or relative) from `fromFile`
 * against the set of files present. Returns undefined for a bare package
 * specifier, null when nothing matches.
 */
export function resolveLocal(spec: string, fromFile: string, present: Set<string>): string | null | undefined {
  let base: string;
  if (spec.startsWith('@/')) base = spec.slice(2);
  else if (spec.startsWith('./') || spec.startsWith('../') || spec === '.' || spec === '..') {
    base = path.posix.join(path.posix.dirname(fromFile), spec);
  } else return undefined;
  base = path.posix.normalize(base);
  for (const suffix of RESOLVE_SUFFIXES) {
    if (present.has(base + suffix)) return base + suffix;
  }
  return null;
}

/** The init skeleton: consumer path → content (copied verbatim, never transformed). */
export function initSkeleton(): Map<string, string> {
  const files = new Map<string, string>();
  for (const f of INIT_SKELETON_FILES) {
    files.set(f.target, fs.readFileSync(path.join(TEMPLATES_DIR, f.template), 'utf8'));
  }
  return files;
}

export const BARREL = 'components/ui/index.ts';

/** Render the generated barrel over a set of consumer files. */
export function renderBarrel(installed: string[], registry: Registry, files: Map<string, string>) {
  return renderComponentsIndex(installed, registry, rel => files.get(`components/ui/${rel}`));
}

/** Names the rendered barrel exports (following its `export *` lines into `files`). */
export function barrelExports(barrel: string, files: Map<string, string>): Set<string> {
  const read = (rel: string) => (rel === 'index.ts' ? barrel : files.get(`components/ui/${rel}`));
  return new Set(collectExportedNames('index.ts', read).keys());
}

/** Named imports / re-exports from exactly `spec` in a script (namespace imports carry no names). */
export function namesImportedFrom(content: string, fileName: string, spec: string): Array<{ line: number; names: string[] }> {
  const sf = ts.createSourceFile(fileName, content, ts.ScriptTarget.Latest, true, fileName.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const out: Array<{ line: number; names: string[] }> = [];
  for (const st of sf.statements) {
    if (!(ts.isImportDeclaration(st) || ts.isExportDeclaration(st))) continue;
    if (!st.moduleSpecifier || !ts.isStringLiteral(st.moduleSpecifier) || st.moduleSpecifier.text !== spec) continue;
    const names: string[] = [];
    if (ts.isImportDeclaration(st) && st.importClause?.namedBindings && ts.isNamedImports(st.importClause.namedBindings)) {
      for (const e of st.importClause.namedBindings.elements) names.push((e.propertyName ?? e.name).text);
    }
    if (ts.isExportDeclaration(st) && st.exportClause && ts.isNamedExports(st.exportClause)) {
      for (const e of st.exportClause.elements) names.push((e.propertyName ?? e.name).text);
    }
    out.push({ line: sf.getLineAndCharacterOfPosition(st.getStart()).line + 1, names });
  }
  return out;
}

/**
 * What `add` installs for a request, mirroring the CLI: a component pulls its
 * internalDependencies (lib modules, recursively through theirs) and its
 * registryDependencies; a lib module named directly also queues its own
 * registryDependencies (add.ts), one reached transitively does not.
 * `init` always installs i18n and design-system, so they are the baseline.
 */
export function installClosure(
  registry: Registry,
  request: { components?: string[]; libs?: string[] },
  baselineLibs: string[] = ['i18n', 'design-system'],
): { components: Set<string>; libs: Set<string> } {
  const components = new Set<string>();
  const libs = new Set<string>();
  const addLib = (name: string, direct: boolean) => {
    const mod = registry.lib[name];
    if (!mod) return;
    if (!libs.has(name)) {
      libs.add(name);
      for (const dep of mod.internalDependencies ?? []) addLib(dep, false);
    }
    if (direct) for (const dep of mod.registryDependencies ?? []) addComponent(dep);
  };
  const addComponent = (name: string) => {
    if (components.has(name)) return;
    const entry = registry.components.find(c => c.name === name);
    if (!entry) return;
    components.add(name);
    for (const dep of entry.internalDependencies ?? []) addLib(dep, false);
    for (const dep of entry.registryDependencies ?? []) addComponent(dep);
  };
  for (const name of baselineLibs) addLib(name, false);
  for (const name of request.libs ?? []) addLib(name, true);
  for (const name of request.components ?? []) addComponent(name);
  return { components, libs };
}

export function ownerKey(owner: Owner): string {
  return `${owner.kind === 'lib' ? 'lib:' : ''}${owner.name}`;
}
