/**
 * Interface identity: cross-table consistency (interface-manifest, Phase 0).
 *
 * A field interface has no single source of identity. It is spread over
 * hand-kept tables in four key spaces:
 *   1. renderer ids — what `getFieldInterface` resolves and what the form
 *      builder writes into `meta.interface` (`tags`, `map`, `select-color`);
 *   2. registry / DaaS-catalog ids — `registry.template.json` `interface.id`
 *      (`input-tags`, `input-map`, `input-map-gl`);
 *   3. registry component names — what `buildpad add` installs (`tags`,
 *      `color`, `divider`, `map-with-real-map`);
 *   4. component export names — what FormFieldInterface looks up in the
 *      consumer's generated `components/ui/index.ts` (`Tags`, `Color`).
 *
 * This file extracts every one of those tables (importing the utils runtime
 * where its values are exported, otherwise parsing the source with the
 * TypeScript AST so a reshaped table fails loudly instead of parsing as
 * empty, and running a non-exported helper's own declaration rather than
 * copying it), asserts the invariants that hold today, and pins every CURRENT
 * divergence as an exact, commented expectation. Import specifiers of shipped
 * files are resolved through the CLI's real transformer into the consumer
 * layout, so checks see what an installed project sees.
 *
 * A failing `divergence (x)` expectation is not necessarily a regression: it
 * means a change fixed or worsened that divergence. Update the expectation
 * (and its comment) on purpose in the same change — that is the point. The
 * letters match the Phase 2 interface-manifest analysis.
 *
 * Phase 1 moved the utils-side tables into one data module,
 * utils/src/interface-manifest.ts, and re-derived them from it; the
 * "pre-manifest snapshot" block pins each derived value to what it was
 * before, and the "interface manifest" block checks the manifest against the
 * tables that are still hand-kept (FormFieldInterface, the registry).
 *
 * Tests only: nothing here changes runtime behaviour.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi, type MockInstance } from 'vitest';

// `info` resolves the registry through the resolver; serve it the checked-in
// registry.json so `buildpad info <id>` is exercised against the real data.
vi.mock('../src/resolver.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/resolver.js')>();
  return { ...actual, getRegistry: vi.fn() };
});

import { getRegistry, type ComponentEntry, type Registry } from '../src/resolver.js';
import { findComponentWithSuggestions } from '../src/commands/add.js';
import { info } from '../src/commands/info.js';
import type { Config } from '../src/commands/init.js';
import { transformImports } from '../src/commands/transformer.js';

// utils runtime, imported straight from source (pure TS, no React).
import {
  getFieldInterface,
  isPresentationField,
  REGISTRY_INTERFACE_ALIASES,
} from '../../utils/src/field-interface-mapper';
import { concealingInterface } from '../../utils/src/conceal';
import {
  INTERFACE_MANIFEST,
  getInterfaceManifestEntry,
  interfaceAliasMap,
  interfaceIdsWithFlag,
  isNonFlatRelationalInterface,
  isPresentationInterface,
  isPresentationLikeInterface,
  isRelationListInterface,
  isRenderedPresentationInterface,
  isSelfPersistingInterface,
  type InterfaceManifestEntry,
} from '../../utils/src/interface-manifest';
import { CHOICE_INTERFACES, PROVISIONABLE_INTERFACES } from '../../utils/src/interface-catalog';
import { dataTypeForFieldType, interfaceForFieldType } from '../../utils/src/field-spec-mapper';
import { formsDefaults, formsId } from '../../utils/src/i18n/namespaces/forms';

type Field = Parameters<typeof getFieldInterface>[0];

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGES_ROOT = path.resolve(__dirname, '../..');
const REPO_ROOT = path.resolve(PACKAGES_ROOT, '..');

// ---------------------------------------------------------------------------
// Source parsing (TypeScript AST)
// ---------------------------------------------------------------------------

const sourceCache = new Map<string, ts.SourceFile>();

/** Parse a file under packages/ (path relative to packages/). */
function parseSource(relToPackages: string): ts.SourceFile {
  const abs = path.join(PACKAGES_ROOT, relToPackages);
  let sf = sourceCache.get(abs);
  if (!sf) {
    const kind = abs.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    sf = ts.createSourceFile(abs, fs.readFileSync(abs, 'utf8'), ts.ScriptTarget.Latest, true, kind);
    sourceCache.set(abs, sf);
  }
  return sf;
}

function collectNodes<T extends ts.Node>(root: ts.Node, pred: (n: ts.Node) => n is T): T[] {
  const out: T[] = [];
  const visit = (n: ts.Node): void => {
    if (pred(n)) out.push(n);
    ts.forEachChild(n, visit);
  };
  visit(root);
  return out;
}

function unwrap(e: ts.Expression): ts.Expression {
  let cur = e;
  while (ts.isAsExpression(cur) || ts.isSatisfiesExpression(cur) || ts.isParenthesizedExpression(cur)) {
    cur = cur.expression;
  }
  return cur;
}

function where(sf: ts.SourceFile): string {
  return path.relative(PACKAGES_ROOT, sf.fileName);
}

function propertyKey(sf: ts.SourceFile, name: ts.PropertyName): string {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;
  throw new Error(`${where(sf)}: unsupported property key ${name.getText()}`);
}

/** Initializers of every `const <name> = …` in the file (module scope or nested). */
function initializersOf(sf: ts.SourceFile, name: string): ts.Expression[] {
  return collectNodes(sf, ts.isVariableDeclaration)
    .filter((d) => ts.isIdentifier(d.name) && d.name.text === name)
    .map((d) => {
      if (!d.initializer) throw new Error(`${where(sf)}: \`${name}\` has no initializer`);
      return unwrap(d.initializer);
    });
}

function initializerOf(sf: ts.SourceFile, name: string): ts.Expression {
  const inits = initializersOf(sf, name);
  if (inits.length !== 1) {
    throw new Error(`${where(sf)}: expected exactly one \`${name}\`, found ${inits.length}`);
  }
  return inits[0];
}

/**
 * `{ key: 'value' }` (or `{ key: SomeIdentifier }`, read as the identifier's
 * name) → a plain record. Anything else — a spread, a computed key, a call —
 * throws, so a reshaped table cannot silently parse as smaller.
 */
function readStringRecord(file: string, name: string): Record<string, string> {
  const sf = parseSource(file);
  const init = initializerOf(sf, name);
  if (!ts.isObjectLiteralExpression(init)) throw new Error(`${file}: \`${name}\` is not an object literal`);
  const out: Record<string, string> = {};
  for (const p of init.properties) {
    if (!ts.isPropertyAssignment(p)) throw new Error(`${file}: \`${name}\` has unsupported member ${p.getText()}`);
    const v = unwrap(p.initializer);
    if (!ts.isStringLiteral(v) && !ts.isNoSubstitutionTemplateLiteral(v) && !ts.isIdentifier(v)) {
      throw new Error(`${file}: \`${name}\` has a non-literal value ${v.getText()}`);
    }
    out[propertyKey(sf, p.name)] = v.text;
  }
  return out;
}

function readSetLiteral(sf: ts.SourceFile, init: ts.Expression, name: string): string[] {
  if (!ts.isNewExpression(init) || init.expression.getText() !== 'Set' || !init.arguments?.length) {
    throw new Error(`${where(sf)}: \`${name}\` is not \`new Set([...])\``);
  }
  const arr = unwrap(init.arguments[0]);
  if (!ts.isArrayLiteralExpression(arr)) throw new Error(`${where(sf)}: \`${name}\` Set is not built from an array literal`);
  return arr.elements.map((e) => {
    const u = unwrap(e);
    if (!ts.isStringLiteral(u)) throw new Error(`${where(sf)}: \`${name}\` has a non-string member ${u.getText()}`);
    return u.text;
  });
}

/** `const <name> = new Set(['a', 'b'])` → ['a', 'b'] (exactly one declaration). */
function readStringSet(file: string, name: string): string[] {
  const sf = parseSource(file);
  return readSetLiteral(sf, initializerOf(sf, name), name);
}

/** Every `const <name> = new Set([...])` in the file (for duplicated local copies). */
function readAllStringSets(file: string, name: string): string[][] {
  const sf = parseSource(file);
  return initializersOf(sf, name).map((init) => readSetLiteral(sf, init, name));
}

/** `type <name> = 'a' | 'b'` → ['a', 'b']. */
function readStringUnion(file: string, name: string): string[] {
  const sf = parseSource(file);
  const decls = collectNodes(sf, ts.isTypeAliasDeclaration).filter((d) => d.name.text === name);
  if (decls.length !== 1) throw new Error(`${file}: expected exactly one type \`${name}\``);
  const t = decls[0].type;
  if (!ts.isUnionTypeNode(t)) throw new Error(`${file}: \`${name}\` is not a union`);
  return t.types.map((m) => {
    if (ts.isLiteralTypeNode(m) && ts.isStringLiteral(m.literal)) return m.literal.text;
    throw new Error(`${file}: \`${name}\` has a non-string-literal member ${m.getText()}`);
  });
}

function functionNamed(sf: ts.SourceFile, name: string): ts.FunctionDeclaration {
  const fns = collectNodes(sf, ts.isFunctionDeclaration).filter((f) => f.name?.text === name);
  if (fns.length !== 1 || !fns[0].body) throw new Error(`${where(sf)}: expected exactly one function \`${name}\``);
  return fns[0];
}

interface SwitchArm {
  labels: string[];
  returns: string;
}

/**
 * The single `switch` in function `fnName`, as fall-through groups: each arm is
 * the run of `case` labels sharing one body, plus the id that body returns
 * (`returnOf` reads it off the return expression; every `return` in an arm
 * must agree). The `default` arm, if any, is reported separately.
 */
function readSwitch(
  file: string,
  fnName: string,
  returnOf: (e: ts.Expression) => string,
): { arms: SwitchArm[]; defaultReturns: string | undefined } {
  const sf = parseSource(file);
  const switches = collectNodes(functionNamed(sf, fnName), ts.isSwitchStatement);
  if (switches.length !== 1) throw new Error(`${file}: expected one switch in \`${fnName}\`, found ${switches.length}`);
  const returnsIn = (clause: ts.CaseOrDefaultClause): string => {
    const values = new Set(
      collectNodes(clause, ts.isReturnStatement).map((r) => {
        if (!r.expression) throw new Error(`${file}: bare return in \`${fnName}\``);
        return returnOf(unwrap(r.expression));
      }),
    );
    if (values.size !== 1) throw new Error(`${file}: \`${fnName}\` arm returns ${[...values].join(', ') || 'nothing'}`);
    return [...values][0];
  };
  const arms: SwitchArm[] = [];
  let pending: string[] = [];
  let defaultReturns: string | undefined;
  for (const clause of switches[0].caseBlock.clauses) {
    if (ts.isDefaultClause(clause)) {
      if (pending.length) throw new Error(`${file}: \`${fnName}\` case labels fall through into default`);
      defaultReturns = returnsIn(clause);
      continue;
    }
    const label = unwrap(clause.expression);
    if (!ts.isStringLiteral(label)) throw new Error(`${file}: \`${fnName}\` has a non-string case ${label.getText()}`);
    pending.push(label.text);
    if (clause.statements.length === 0) continue;
    arms.push({ labels: pending, returns: returnsIn(clause) });
    pending = [];
  }
  if (pending.length) throw new Error(`${file}: \`${fnName}\` ends on a fall-through label`);
  return { arms, defaultReturns };
}

/** Return expression `{ type: 'x', … }` → 'x'; `null` → 'null'. */
function returnedConfigType(e: ts.Expression): string {
  if (e.kind === ts.SyntaxKind.NullKeyword) return 'null';
  if (!ts.isObjectLiteralExpression(e)) throw new Error(`unexpected return ${e.getText()}`);
  for (const p of e.properties) {
    if (ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === 'type') {
      const v = unwrap(p.initializer);
      if (ts.isStringLiteral(v)) return v.text;
    }
  }
  throw new Error(`return without a literal \`type\`: ${e.getText()}`);
}

/** Return expression `'x'` → 'x'. */
function returnedString(e: ts.Expression): string {
  if (ts.isStringLiteral(e)) return e.text;
  throw new Error(`unexpected return ${e.getText()}`);
}

/** Every string literal inside function `fnName`. */
function stringLiteralsIn(file: string, fnName: string): string[] {
  return collectNodes(functionNamed(parseSource(file), fnName), ts.isStringLiteral).map((s) => s.text);
}

/**
 * Interface-id literals a file compares against: `<expr mentioning
 * "interface"> === / !== 'literal'` (either operand order).
 */
function interfaceComparisons(file: string): string[] {
  const out: string[] = [];
  for (const b of collectNodes(parseSource(file), ts.isBinaryExpression)) {
    const op = b.operatorToken.kind;
    if (op !== ts.SyntaxKind.EqualsEqualsEqualsToken && op !== ts.SyntaxKind.ExclamationEqualsEqualsToken) continue;
    const [lit, other] = ts.isStringLiteral(b.right) ? [b.right, b.left] : ts.isStringLiteral(b.left) ? [b.left, b.right] : [];
    if (lit && other && /interface/i.test(other.getText())) out.push(lit.text);
  }
  return out;
}

interface ExportInfo {
  values: Set<string>;
  types: Set<string>;
  /** `export * from '<spec>'` module specifiers. */
  stars: string[];
  /** `export { local as exported } from '<spec>'` entries. */
  reexports: { local: string; exported: string; spec: string; typeOnly: boolean }[];
}

function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
  return ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some((m) => m.kind === kind);
}

/** Top-level export names of a module (no `export *` resolution). */
function readExports(file: string): ExportInfo {
  const sf = parseSource(file);
  const info: ExportInfo = { values: new Set(), types: new Set(), stars: [], reexports: [] };
  for (const stmt of sf.statements) {
    if (ts.isExportDeclaration(stmt)) {
      const spec = stmt.moduleSpecifier && ts.isStringLiteral(stmt.moduleSpecifier) ? stmt.moduleSpecifier.text : undefined;
      if (!stmt.exportClause) {
        if (spec) info.stars.push(spec);
      } else if (ts.isNamespaceExport(stmt.exportClause)) {
        info.values.add(stmt.exportClause.name.text);
      } else {
        for (const el of stmt.exportClause.elements) {
          const typeOnly = stmt.isTypeOnly || el.isTypeOnly;
          (typeOnly ? info.types : info.values).add(el.name.text);
          if (spec) info.reexports.push({ local: (el.propertyName ?? el.name).text, exported: el.name.text, spec, typeOnly });
        }
      }
      continue;
    }
    if (ts.isExportAssignment(stmt)) {
      info.values.add('default');
      continue;
    }
    if (!hasModifier(stmt, ts.SyntaxKind.ExportKeyword)) continue;
    const isDefault = hasModifier(stmt, ts.SyntaxKind.DefaultKeyword);
    if (ts.isVariableStatement(stmt)) {
      for (const d of stmt.declarationList.declarations) if (ts.isIdentifier(d.name)) info.values.add(d.name.text);
    } else if (ts.isFunctionDeclaration(stmt) || ts.isClassDeclaration(stmt) || ts.isEnumDeclaration(stmt)) {
      info.values.add(isDefault ? 'default' : (stmt.name?.text ?? 'default'));
    } else if (ts.isInterfaceDeclaration(stmt) || ts.isTypeAliasDeclaration(stmt)) {
      info.types.add(stmt.name.text);
    }
  }
  return info;
}

/** Resolve a relative specifier inside the packages/ source tree (monorepo layout). */
function resolveSourceRelative(fromFile: string, spec: string): string {
  const base = path.posix.join(path.posix.dirname(fromFile), spec);
  for (const candidate of [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) {
    if (fs.existsSync(path.join(PACKAGES_ROOT, candidate))) return candidate;
  }
  throw new Error(`${fromFile}: cannot resolve ${spec}`);
}

interface ExportNames {
  values: Set<string>;
  types: Set<string>;
}

/**
 * Export names of the modules of one graph: each module's own exports plus
 * whatever it reaches through relative `export *` (which never re-exports
 * `default`). Results are memoised per module; the cache is consulted before
 * cycle detection and only complete results are stored, so a module reached
 * along two paths (a diamond) always yields its full set. An `export *` cycle
 * throws instead of producing a partial answer.
 */
function createExportResolver(
  read: (mod: string) => Pick<ExportInfo, 'values' | 'types' | 'stars'>,
  resolve: (mod: string, spec: string) => string,
): (mod: string) => ExportNames {
  const cache = new Map<string, ExportNames>();
  const inProgress = new Set<string>();
  const exportsOf = (mod: string): ExportNames => {
    const cached = cache.get(mod);
    if (cached) return cached;
    if (inProgress.has(mod)) throw new Error(`\`export *\` cycle through ${mod}`);
    inProgress.add(mod);
    try {
      const ex = read(mod);
      const out: ExportNames = { values: new Set(ex.values), types: new Set(ex.types) };
      for (const spec of ex.stars) {
        if (!spec.startsWith('.')) continue;
        const inner = exportsOf(resolve(mod, spec));
        for (const n of inner.values) if (n !== 'default') out.values.add(n);
        for (const n of inner.types) out.types.add(n);
      }
      cache.set(mod, out);
      return out;
    } finally {
      inProgress.delete(mod);
    }
  };
  return exportsOf;
}

/** Export names of a source module in the monorepo (path relative to packages/). */
const sourceExportsOf = createExportResolver(readExports, resolveSourceRelative);

/**
 * Run top-level function declarations of a source file in isolation (the
 * declarations alone, transpiled to JS). A function that comes to depend on
 * anything else in its module fails here with a ReferenceError instead of
 * being silently re-implemented by the test.
 */
function loadFunctions<T>(file: string, names: readonly string[]): T {
  const sf = parseSource(file);
  const text = names.map((n) => functionNamed(sf, n).getText(sf)).join('\n');
  const js = ts.transpileModule(text, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  return new Function('exports', `${js}\nreturn { ${names.join(', ')} };`)({}) as T;
}

/** `const <name> = ['a', 'b'] as const` → ['a', 'b']. */
function readStringArray(file: string, name: string): string[] {
  const sf = parseSource(file);
  const init = initializerOf(sf, name);
  if (!ts.isArrayLiteralExpression(init)) throw new Error(`${file}: \`${name}\` is not an array literal`);
  return init.elements.map((e) => {
    const u = unwrap(e);
    if (!ts.isStringLiteral(u)) throw new Error(`${file}: \`${name}\` has a non-string member ${u.getText()}`);
    return u.text;
  });
}

interface ImportedName {
  /** `default`, a named binding, or `*` (namespace import / `export *`). */
  name: string;
  typeOnly: boolean;
}

interface ImportDecl {
  spec: string;
  kind: 'import' | 'export';
  /** `import type` / `export type` (the whole statement). */
  typeOnly: boolean;
  names: ImportedName[];
}

/** Every static `import … from` / `export … from` of a module, with the names it takes. */
function importDeclsOf(file: string): ImportDecl[] {
  const sf = parseSource(file);
  const out: ImportDecl[] = [];
  for (const stmt of sf.statements) {
    if (ts.isImportDeclaration(stmt)) {
      if (!ts.isStringLiteral(stmt.moduleSpecifier)) continue;
      const clause = stmt.importClause;
      const typeOnly = !!clause?.isTypeOnly;
      const names: ImportedName[] = [];
      if (clause?.name) names.push({ name: 'default', typeOnly });
      const nb = clause?.namedBindings;
      if (nb && ts.isNamespaceImport(nb)) names.push({ name: '*', typeOnly });
      if (nb && ts.isNamedImports(nb)) {
        for (const el of nb.elements) names.push({ name: (el.propertyName ?? el.name).text, typeOnly: typeOnly || el.isTypeOnly });
      }
      out.push({ spec: stmt.moduleSpecifier.text, kind: 'import', typeOnly, names });
    } else if (ts.isExportDeclaration(stmt)) {
      if (!stmt.moduleSpecifier || !ts.isStringLiteral(stmt.moduleSpecifier)) continue;
      const typeOnly = stmt.isTypeOnly;
      const names: ImportedName[] = [];
      if (!stmt.exportClause || ts.isNamespaceExport(stmt.exportClause)) names.push({ name: '*', typeOnly });
      else {
        for (const el of stmt.exportClause.elements) {
          names.push({ name: (el.propertyName ?? el.name).text, typeOnly: typeOnly || el.isTypeOnly });
        }
      }
      out.push({ spec: stmt.moduleSpecifier.text, kind: 'export', typeOnly, names });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Small set helpers
// ---------------------------------------------------------------------------

const sorted = (xs: Iterable<string>): string[] => [...new Set(xs)].sort((a, b) => a.localeCompare(b));
const minus = (a: Iterable<string>, b: Iterable<string>): string[] => {
  const drop = new Set(b);
  return sorted([...a].filter((x) => !drop.has(x)));
};

// ---------------------------------------------------------------------------
// The tables
// ---------------------------------------------------------------------------

const F = {
  mapper: 'utils/src/field-interface-mapper.ts',
  conceal: 'utils/src/conceal.ts',
  specMapper: 'utils/src/field-spec-mapper.ts',
  interfaceTypes: 'utils/src/interface-types.ts',
  ffi: 'ui-form/src/components/FormFieldInterface.tsx',
  leafProbe: 'ui-form/src/__tests__/helpers/leafProbe.tsx',
  uiInterfacesBarrel: 'ui-interfaces/src/index.ts',
  palette: 'ui-forms/src/FieldPalette.tsx',
  collectionForm: 'ui-collections/src/CollectionForm.tsx',
  collectionList: 'ui-collections/src/CollectionList.tsx',
  junctionItemForm: 'ui-interfaces/src/list-m2a/JunctionItemForm.tsx',
  addCmd: 'cli/src/commands/add.ts',
  infoCmd: 'cli/src/commands/info.ts',
  mcpIndex: 'mcp-server/src/index.ts',
  utilsBarrelTemplate: 'cli/templates/lib/utils-index.ts',
  hooks: ['hooks/src/useRelationM2A.ts', 'hooks/src/useRelationM2M.ts', 'hooks/src/useRelationO2M.ts'],
} as const;

interface InterfaceBlock {
  id: string;
  aliases?: string[];
  icon: string;
  types: string[];
  group: string;
}
type TemplateComponent = ComponentEntry & { interface?: InterfaceBlock };
interface TemplateRegistry extends Omit<Registry, 'components'> {
  components: TemplateComponent[];
}

const readJson = <T>(rel: string): T => JSON.parse(fs.readFileSync(path.join(PACKAGES_ROOT, rel), 'utf8')) as T;
const template = readJson<TemplateRegistry>('registry.template.json');
const registry = readJson<TemplateRegistry>('registry.json');

/** Registry interface blocks (template), one per component that declares one. */
const registryBlocks = template.components
  .filter((c): c is TemplateComponent & { interface: InterfaceBlock } => !!c.interface)
  .map((c) => ({ component: c.name, title: c.title, ...c.interface }));
const componentByName = new Map(template.components.map((c) => [c.name, c]));

// utils — field-interface-mapper
const interfaceTypeUnion = readStringUnion(F.mapper, 'InterfaceType');
const explicitSwitch = readSwitch(F.mapper, 'getExplicitInterface', returnedConfigType);
const caseLabels = explicitSwitch.arms.flatMap((a) => a.labels);
const returnedIds = sorted(explicitSwitch.arms.map((a) => a.returns));
// utils — interface manifest
const manifest: readonly InterfaceManifestEntry[] = INTERFACE_MANIFEST;
const renderedEntries = manifest.filter((e) => e.renders);
/** Every alias normalizeInterfaceId resolves (registry and legacy), alias → renderer id. */
const manifestAliases = { ...interfaceAliasMap('registry'), ...interfaceAliasMap('legacy') };
/** Every id `meta.interface` may hold and still resolve explicitly. */
const acceptedIds = sorted([...caseLabels, ...Object.keys(manifestAliases)]);
const presentationIds = interfaceIdsWithFlag('presentation');

// utils — the other runtime tables
const concealingIds = interfaceIdsWithFlag('concealing');
const provisionableIds = PROVISIONABLE_INTERFACES.map((p) => p.value);
const specInterfaceByType = readStringRecord(F.specMapper, 'INTERFACE_BY_TYPE');
const fieldTypeUnion = readStringUnion(F.interfaceTypes, 'FieldType');
const interfaceGroupUnion = readStringUnion(F.interfaceTypes, 'InterfaceGroup');

// vform — FormFieldInterface
const ffiComponentMap = readStringRecord(F.ffi, 'interfaceComponentMap');
const ffiRelationalMap = readStringRecord(F.ffi, 'relationalFullComponentMap');
const ffiMultiSelect = readStringSet(F.ffi, 'MULTI_SELECT_INTERFACE_TYPES');
const ffiDefaultSwitch = readSwitch(F.ffi, 'getDefaultInterfaceForType', returnedString);
/** FormFieldInterface's lookup order: relational map, then the component map. */
const ffiExportFor = (rendererId: string): string | undefined =>
  ffiRelationalMap[rendererId] ?? ffiComponentMap[rendererId];
const ffiDefaultFor = (type: string): string =>
  ffiDefaultSwitch.arms.find((a) => a.labels.includes(type))?.returns ?? ffiDefaultSwitch.defaultReturns ?? '';

// Other packages
const uiInterfacesExports = sourceExportsOf(F.uiInterfacesBarrel).values;
const paletteIcons = readStringRecord(F.palette, 'INTERFACE_ICONS');
const paletteGroupKeys = readStringRecord(F.palette, 'CATALOG_GROUP_KEYS');
const addAliases = readStringRecord(F.addCmd, 'COMPONENT_ALIASES');
const infoAliases = readStringRecord(F.infoCmd, 'aliases');
const mcpComponentMap = readStringRecord(F.mcpIndex, 'componentMap');
const vformDeps = componentByName.get('vform')?.registryDependencies ?? [];

/** Resolve `meta.interface` through the real mapper (type-based fallback included). */
function renderedType(interfaceId: string | null, type: string, dataType?: string): string {
  const field = {
    field: 'probe',
    type,
    schema: dataType ? { data_type: dataType } : null,
    meta: interfaceId === null ? null : { interface: interfaceId, options: {} },
  } as unknown as Field;
  return getFieldInterface(field).type;
}

// ---------------------------------------------------------------------------
// Consumer layout: what an installed project actually contains
// ---------------------------------------------------------------------------

/** Every file the registry ships (components and lib modules). */
const shippedFiles = [
  ...registry.components.flatMap((c) => c.files),
  ...Object.values(registry.lib).flatMap((m) => m.files ?? []),
];
/** consumer target path → monorepo source path (relative to packages/). */
const sourceByTarget = new Map(shippedFiles.map((f) => [f.target, f.source] as const));

/** Resolve a module path in the consumer layout to a shipped target, if any. */
function shippedTarget(base: string): string | undefined {
  return [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`].find((t) => sourceByTarget.has(t));
}

/**
 * Export names of a shipped file *as installed* (consumer target path),
 * following relative `export *` in the consumer layout — which is where the
 * CLI's own barrel templates resolve.
 */
const exportsOfTarget = createExportResolver(
  (target) => {
    const source = sourceByTarget.get(target);
    if (!source) throw new Error(`no shipped source for ${target}`);
    return readExports(source);
  },
  (target, spec) => {
    const next = shippedTarget(path.posix.join(path.posix.dirname(target), spec));
    if (!next) throw new Error(`${target}: \`export * from '${spec}'\` resolves to no shipped file`);
    return next;
  },
);

/** The CLI's default config (`buildpad init` aliases, no src/ dir: '@/' is the project root). */
const CONSUMER_CONFIG: Config = {
  schemaVersion: 3,
  model: 'copy-own',
  tsx: true,
  srcDir: false,
  aliases: { components: '@/components/ui', lib: '@/lib/buildpad' },
  installedLib: [],
  installedComponents: [],
};
/** Targets of lib-module files, which the CLI writes through `transformImports` alone. */
const libTargets = new Set(Object.values(registry.lib).flatMap((m) => (m.files ?? []).map((f) => f.target)));

/**
 * Where an import of a shipped file points once installed, as a project path
 * without extension (resolve it with `shippedTarget`); undefined for a bare
 * package. `@buildpad/*` specifiers go through the real transformer — the
 * same `transformImports` call `buildpad add` makes, statement kind included
 * — `@/` is the project root, and a relative specifier resolves against the
 * target. Relative imports are resolved for lib-module files only: those are
 * copied verbatim, while component files have theirs rewritten by the
 * component transforms (and, sitting in other packages, never reach into the
 * utils lib by a relative path).
 */
function consumerModulePath(file: { target: string }, decl: Pick<ImportDecl, 'spec' | 'kind' | 'typeOnly'>): string | undefined {
  const isLib = libTargets.has(file.target);
  const stmt = `${decl.kind}${decl.typeOnly ? ' type' : ''} { x } from '${decl.spec}';`;
  const mapped = /from ['"]([^'"]+)['"]/.exec(transformImports(stmt, CONSUMER_CONFIG, isLib ? undefined : file.target))?.[1];
  if (!mapped) throw new Error(`transformer dropped the specifier of: ${stmt}`);
  if (mapped.startsWith('@/')) return mapped.slice(2);
  if (mapped.startsWith('.')) return isLib ? path.posix.join(path.posix.dirname(file.target), mapped) : undefined;
  return undefined;
}

/**
 * Names the consumer's generated components/ui/index.ts exposes for one
 * installed component — the namespace FormFieldInterface looks components up
 * in. Mirrors add.ts generateComponentsIndex: `export *` from the first file's
 * target, or from its folder (the folder's index) when that target is
 * foldered. `export *` never re-exports `default`.
 */
function consumerExports(componentName: string): Set<string> {
  const c = componentByName.get(componentName);
  if (!c) throw new Error(`unknown registry component ${componentName}`);
  const rel = c.files[0].target.replace(/^components\/ui\//, '');
  const entry = rel.includes('/') ? shippedTarget(`components/ui/${rel.split('/')[0]}`) : c.files[0].target;
  if (!entry) throw new Error(`${componentName}: foldered target without a shipped index`);
  const names = new Set(exportsOfTarget(entry).values);
  names.delete('default');
  return names;
}

/** Registry components (with a TS entry) whose consumer entry exports `exportName`. */
function componentsExporting(exportName: string): string[] {
  return sorted(
    template.components
      .filter((c) => c.files.length > 0 && /\.tsx?$/.test(c.files[0].target))
      .filter((c) => consumerExports(c.name).has(exportName))
      .map((c) => c.name),
  );
}

// ---------------------------------------------------------------------------

describe('test helpers', () => {
  /** A resolver over an in-memory graph: module → own value exports and `export *` targets. */
  const resolverOver = (graph: Record<string, { values: string[]; stars: string[] }>) =>
    createExportResolver(
      (mod) => ({ values: new Set(graph[mod].values), types: new Set<string>(), stars: graph[mod].stars }),
      (_mod, spec) => spec.replace(/^\.\//, ''),
    );

  test('export resolver: a module reached along two paths keeps its full export set', () => {
    // A → B → D and A → C → D: resolving A first must not cache C without D.
    const exportsOf = resolverOver({
      A: { values: ['a'], stars: ['./B', './C'] },
      B: { values: ['b'], stars: ['./D'] },
      C: { values: ['c'], stars: ['./D'] },
      D: { values: ['d', 'default'], stars: [] },
    });
    expect(sorted(exportsOf('A').values)).toEqual(['a', 'b', 'c', 'd']);
    expect(sorted(exportsOf('C').values)).toEqual(['c', 'd']);
    expect(sorted(exportsOf('D').values)).toEqual(['d', 'default']);
  });

  test('export resolver: an `export *` cycle throws instead of caching a partial set', () => {
    const exportsOf = resolverOver({
      X: { values: ['x'], stars: ['./Y'] },
      Y: { values: ['y'], stars: ['./X'] },
    });
    expect(() => exportsOf('X')).toThrow('`export *` cycle through X');
    expect(() => exportsOf('Y')).toThrow('`export *` cycle through Y');
  });
});

describe('inventory', () => {
  test('table sizes (adding an interface touches all of these — update them together)', () => {
    expect({
      interfaceTypeUnion: interfaceTypeUnion.length,
      manifestEntries: manifest.length,
      manifestRenderedEntries: renderedEntries.length,
      manifestAliases: Object.keys(manifestAliases).length,
      registryInterfaceAliases: Object.keys(REGISTRY_INTERFACE_ALIASES).length,
      switchCaseLabels: caseLabels.length,
      switchReturnedIds: returnedIds.length,
      concealing: concealingIds.length,
      provisionable: provisionableIds.length,
      choice: CHOICE_INTERFACES.size,
      specInterfaceByType: Object.keys(specInterfaceByType).length,
      ffiComponentMap: Object.keys(ffiComponentMap).length,
      ffiRelationalMap: Object.keys(ffiRelationalMap).length,
      ffiMultiSelect: ffiMultiSelect.length,
      registryInterfaceBlocks: registryBlocks.length,
      vformRegistryDependencies: vformDeps.length,
      addAliases: Object.keys(addAliases).length,
      infoAliases: Object.keys(infoAliases).length,
      mcpComponentMap: Object.keys(mcpComponentMap).length,
      paletteIcons: Object.keys(paletteIcons).length,
    }).toEqual({
      interfaceTypeUnion: 41,
      // 37 renderer ids + `upload` and `presentation-links`, which no case resolves
      manifestEntries: 39,
      manifestRenderedEntries: 37,
      // the 3 registry aliases + the 9 legacy ids that were inline case labels
      manifestAliases: 12,
      registryInterfaceAliases: 3,
      // Was 46: the 9 legacy alias labels left the switch for the manifest
      // (normalizeInterfaceId resolves them before it), so each case now names
      // exactly one renderer id. Rendering is unchanged — see the pre-manifest
      // snapshot below.
      switchCaseLabels: 37,
      switchReturnedIds: 37,
      concealing: 2,
      provisionable: 20,
      choice: 5,
      specInterfaceByType: 15,
      ffiComponentMap: 36,
      ffiRelationalMap: 5,
      ffiMultiSelect: 3,
      registryInterfaceBlocks: 39,
      vformRegistryDependencies: 37,
      addAliases: 37,
      infoAliases: 21,
      mcpComponentMap: 8,
      paletteIcons: 20,
    });
  });

  test('registry.json carries the template interface blocks verbatim', () => {
    const generated = registry.components.filter((c) => c.interface).map((c) => [c.name, c.interface]);
    expect(generated).toEqual(template.components.filter((c) => c.interface).map((c) => [c.name, c.interface]));
  });
});

describe('utils: field-interface-mapper', () => {
  test('the parsed switch matches the runtime for every case label', () => {
    for (const arm of explicitSwitch.arms) {
      for (const label of arm.labels) expect([label, renderedType(label, 'string')]).toEqual([label, arm.returns]);
    }
    expect(explicitSwitch.defaultReturns).toBe('null');
  });

  test('REGISTRY_INTERFACE_ALIASES: keys are not case labels, targets are, and the runtime honours them', () => {
    for (const [alias, target] of Object.entries(REGISTRY_INTERFACE_ALIASES)) {
      expect(caseLabels).not.toContain(alias);
      expect(caseLabels).toContain(target);
      expect(renderedType(alias, 'json')).toBe(renderedType(target, 'json'));
    }
  });

  test('no inline aliases: the switch has one case label per renderer id', () => {
    const inline = Object.fromEntries(
      explicitSwitch.arms.flatMap((a) => a.labels.filter((l) => l !== a.returns).map((l) => [l, a.returns])),
    );
    // Resolved (interface-manifest Phase 1) without a rendering change: the
    // legacy ids that were fall-through labels — a second alias table inside
    // the switch — are the manifest's `aliases.legacy`, resolved by
    // normalizeInterfaceId with the registry aliases before the switch. They
    // still render exactly as before (pre-manifest snapshot below).
    expect(inline).toEqual({});
    expect(interfaceAliasMap('legacy')).toEqual(PRE_MANIFEST.inlineSwitchAliases);
  });

  test('InterfaceType covers every resolved id', () => {
    expect(minus(returnedIds, interfaceTypeUnion)).toEqual([]);
    // Members kept in the exported union that getFieldInterface never
    // returns (legacy literals; dropping them would be a consumer TS break).
    expect(minus(interfaceTypeUnion, returnedIds)).toEqual(['list-m2o', 'number', 'textarea', 'uuid']);
  });

  test('getFieldInterface never returns an empty type, so FormFieldInterface getDefaultInterfaceForType is unreachable', () => {
    // divergence (c): FormFieldInterface.tsx only calls its own default table
    // when `config.type` is falsy, which the mapper never produces — the
    // third default-per-type table below is dead code.
    for (const type of [...fieldTypeUnion, 'datetime', 'mystery']) {
      expect(renderedType(null, type)).toBeTruthy();
      expect(renderedType('not-an-interface', type)).toBeTruthy();
    }
  });

  test('isPresentationField ids', () => {
    expect(sorted(presentationIds)).toEqual(['presentation-divider', 'presentation-links', 'presentation-notice']);
    // `presentation-links` is recognised as presentation-only here but has no
    // mapper case, registry entry or component anywhere.
    expect(minus(presentationIds, acceptedIds)).toEqual(['presentation-links']);
  });

  test('CONCEALING_INTERFACES are resolved ids, and concealingInterface() agrees', () => {
    expect(minus(concealingIds, returnedIds)).toEqual([]);
    for (const id of acceptedIds) expect([id, concealingInterface(id)]).toEqual([id, concealingIds.includes(id)]);
  });
});

describe('utils: interface manifest vs the tables still kept by hand', () => {
  test('rendered entries are exactly the switch cases, and each case returns its own id', () => {
    expect(sorted(renderedEntries.map((e) => e.id))).toEqual(sorted(caseLabels));
    expect(sorted(caseLabels)).toEqual(returnedIds);
  });

  test('unrendered entries are known ids that no case resolves', () => {
    const unrendered = manifest.filter((e) => !e.renders).map((e) => e.id);
    expect(sorted(unrendered)).toEqual(['presentation-links', 'upload']);
    expect(unrendered.filter((id) => acceptedIds.includes(id))).toEqual([]);
  });

  test('InterfaceType is the rendered ids plus the deprecated type literals', () => {
    const literals = renderedEntries.flatMap((e) => (e.renders ? (e.typeLiterals ?? []) : []));
    expect(sorted(literals)).toEqual(['list-m2o', 'number', 'textarea', 'uuid']);
    expect(sorted(interfaceTypeUnion)).toEqual(sorted([...renderedEntries.map((e) => e.id), ...literals]));
  });

  test('exportName is the component FormFieldInterface renders, for the id and each type literal', () => {
    const mismatches = renderedEntries.flatMap((e) =>
      e.renders
        ? [e.id, ...(e.typeLiterals ?? [])]
            .filter((id) => ffiExportFor(id) !== e.exportName)
            .map((id) => ({ id, manifest: e.exportName, formFieldInterface: ffiExportFor(id) }))
        : [],
    );
    expect(mismatches).toEqual([]);
  });

  test("the csvMultiValue flag is FormFieldInterface's MULTI_SELECT_INTERFACE_TYPES", () => {
    expect(sorted(interfaceIdsWithFlag('csvMultiValue'))).toEqual(sorted(ffiMultiSelect));
  });

  test("registryComponent ships the entry's exportName, and its registry block describes the entry", () => {
    const rows = manifest
      .filter((e) => e.registryComponent !== null)
      .map((e) => {
        const component = componentByName.get(e.registryComponent ?? '') as TemplateComponent | undefined;
        const block = component?.interface;
        return {
          id: e.id,
          ships: e.exportName !== null && !!component && consumerExports(component.name).has(e.exportName),
          blockNamesEntry: !!block && getInterfaceManifestEntry(block.id)?.id === e.id,
          types: JSON.stringify(block?.types) === JSON.stringify(e.types),
          group: block?.group === e.group,
        };
      });
    expect(rows.filter((r) => !r.ships || !r.blockNamesEntry || !r.types || !r.group)).toEqual([]);
    // Only presentation-links has no registry component.
    expect(manifest.filter((e) => e.registryComponent === null).map((e) => e.id)).toEqual(['presentation-links']);
  });

  test('every registry interface id and alias names a manifest entry', () => {
    const unknown = registryBlocks.flatMap((b) => [b.id, ...(b.aliases ?? [])]).filter((id) => !getInterfaceManifestEntry(id));
    expect(unknown).toEqual([]);
    // divergence (b), unchanged: input-map-gl is map-with-real-map's id, yet
    // the manifest (like the mapper before it) makes it an alias of `map`.
    const foreign = registryBlocks
      .map((b) => ({ id: b.id, component: b.component, entry: getInterfaceManifestEntry(b.id)?.registryComponent }))
      .filter((r) => r.component !== r.entry);
    expect(foreign).toEqual([{ id: 'input-map-gl', component: 'map-with-real-map', entry: 'map' }]);
  });

  test('divergence (j), unchanged: relation-hook aliases are not resolved by the renderer', () => {
    const hookAliases = manifest.flatMap((e) => e.relation?.hookAliases ?? []);
    expect(hookAliases).toEqual(['one-to-many']);
    expect(minus(hookAliases, acceptedIds)).toEqual(['one-to-many']);
  });
});

describe('utils: catalog, choices and field-spec defaults', () => {
  test('every provisionable value is a canonical switch case', () => {
    expect(minus(provisionableIds, returnedIds)).toEqual([]);
    expect(minus(provisionableIds, caseLabels)).toEqual([]);
  });

  test('CHOICE_INTERFACES ⊂ provisionable', () => {
    expect(minus(CHOICE_INTERFACES, provisionableIds)).toEqual([]);
  });

  test('field-spec-mapper INTERFACE_BY_TYPE writes resolvable ids', () => {
    expect(minus(Object.values(specInterfaceByType), caseLabels)).toEqual([]);
    for (const [type, id] of Object.entries(specInterfaceByType)) expect(interfaceForFieldType(type)).toBe(id);
  });

  test('divergence (c): the three default-interface-per-type tables disagree', () => {
    const rows = [...fieldTypeUnion, 'datetime'].map((type) => ({
      type,
      // getTypeBasedInterface with no schema (e.g. a field whose meta.interface is null and schema unknown)
      runtime: renderedType(null, type),
      // getTypeBasedInterface with the data_type field-spec-mapper provisions for that type
      runtimeProvisioned: renderedType(null, type, dataTypeForFieldType(type)),
      // FormFieldInterface getDefaultInterfaceForType (dead, see above)
      formFieldInterface: ffiDefaultFor(type),
      // field-spec-mapper interfaceForFieldType — what the builder writes into meta.interface
      fieldSpec: interfaceForFieldType(type),
    }));
    const disagreements = rows.filter(
      (r) => new Set([r.runtime, r.runtimeProvisioned, r.formFieldInterface, r.fieldSpec]).size > 1,
    );
    expect(disagreements).toEqual([
      { type: 'dateTime', runtime: 'input', runtimeProvisioned: 'datetime', formFieldInterface: 'datetime', fieldSpec: 'datetime' },
      { type: 'csv', runtime: 'input', runtimeProvisioned: 'input-multiline', formFieldInterface: 'input-code', fieldSpec: 'tags' },
      { type: 'hash', runtime: 'input', runtimeProvisioned: 'input', formFieldInterface: 'input-hash', fieldSpec: 'input' },
      { type: 'geometry', runtime: 'input', runtimeProvisioned: 'input', formFieldInterface: 'map', fieldSpec: 'input' },
      // the lower-case `datetime` literal is in field-spec-mapper and the runtime but missing from FormFieldInterface's switch
      { type: 'datetime', runtime: 'datetime', runtimeProvisioned: 'datetime', formFieldInterface: 'input', fieldSpec: 'datetime' },
    ]);
  });
});

describe('vform: FormFieldInterface maps', () => {
  test('the two maps cover exactly the InterfaceType union, without overlap', () => {
    const ffiKeys = [...Object.keys(ffiComponentMap), ...Object.keys(ffiRelationalMap)];
    expect(sorted(ffiKeys)).toHaveLength(ffiKeys.length);
    expect(sorted(ffiKeys)).toEqual(sorted(interfaceTypeUnion));
  });

  test('every id the mapper returns has an explicit component (the PascalCase fallback is never needed upstream)', () => {
    expect(returnedIds.filter((id) => !ffiExportFor(id))).toEqual([]);
  });

  test('every mapped component is a ui-interfaces barrel export', () => {
    const values = [...Object.values(ffiComponentMap), ...Object.values(ffiRelationalMap)];
    expect(minus(values, uiInterfacesExports)).toEqual([]);
  });

  test('every mapped component is exported by the consumer copy of some registry component', () => {
    const values = sorted([...Object.values(ffiComponentMap), ...Object.values(ffiRelationalMap)]);
    expect(values.filter((v) => componentsExporting(v).length === 0)).toEqual([]);
  });

  test('divergence (h): vform registryDependencies omit components FormFieldInterface can render', () => {
    expect(minus(vformDeps, template.components.map((c) => c.name))).toEqual([]);
    const providers = sorted(
      [...Object.values(ffiComponentMap), ...Object.values(ffiRelationalMap)].flatMap(componentsExporting),
    );
    // FormFieldInterface maps `system-permissions` → SystemPermissions, but a
    // vform install never pulls that component in.
    expect(minus(providers, vformDeps)).toEqual(['system-permissions']);
    // Registry interface components a vform install does not bring along.
    expect(minus(registryBlocks.map((b) => b.component), vformDeps)).toEqual(['map-with-real-map', 'system-permissions']);
  });

  test('MULTI_SELECT_INTERFACE_TYPES are resolved ids', () => {
    expect(minus(ffiMultiSelect, returnedIds)).toEqual([]);
  });

  test('divergence (i): csv-compatible interfaces that FormFieldInterface does not normalise', () => {
    const csvRenderers = registryBlocks
      .filter((b) => b.types.includes('csv'))
      .map((b) => renderedType(b.id, 'csv'));
    // Tags is declared csv-compatible (and is field-spec-mapper's csv default)
    // but is not in MULTI_SELECT_INTERFACE_TYPES, so a csv string reaches it raw.
    expect(minus(csvRenderers, ffiMultiSelect)).toEqual(['tags']);
    expect(interfaceForFieldType('csv')).toBe('tags');
  });

  test('divergence (k): leafProbe hand-copies the export names', () => {
    const probe = readStringArray(F.leafProbe, 'INTERFACE_COMPONENT_NAMES');
    const mapped = [...Object.values(ffiComponentMap), ...Object.values(ffiRelationalMap)];
    expect(minus(probe, mapped)).toEqual([]);
    // The relational exports are missing from the probe list.
    expect(minus(mapped, probe)).toEqual(['ListM2A', 'ListM2M', 'ListO2M', 'SelectDropdownM2O']);
  });
});

describe('registry interface blocks', () => {
  test('divergence (a): registry ids the mapper does not accept', () => {
    const ids = registryBlocks.flatMap((b) => [b.id, ...(b.aliases ?? [])]);
    expect(minus(ids, acceptedIds)).toEqual(['upload']);
    // What a field saved with `upload` renders instead, per declared type:
    // the type-based fallback (the analysis' "json → input-code" example is
    // not a declared upload type; upload declares only uuid).
    const upload = registryBlocks.find((b) => b.id === 'upload');
    expect(Object.fromEntries((upload?.types ?? []).map((t) => [t, renderedType('upload', t)]))).toEqual({ uuid: 'input' });
  });

  test('only select-dropdown-m2o declares `aliases`, and the mapper accepts them', () => {
    expect(registryBlocks.filter((b) => b.aliases).map((b) => [b.component, b.aliases])).toEqual([
      ['select-dropdown-m2o', ['list-m2o']],
    ]);
    expect(minus(registryBlocks.flatMap((b) => b.aliases ?? []), acceptedIds)).toEqual([]);
  });

  test('registry types are FieldType members', () => {
    expect(minus(registryBlocks.flatMap((b) => b.types), fieldTypeUnion)).toEqual([]);
  });

  test('registry groups are InterfaceGroup members', () => {
    // Resolved (interface-manifest Phase 1, types only): system-permissions'
    // group "system" was missing from utils' InterfaceGroup; the union gained
    // it so the manifest can record the registry group of every interface.
    expect(minus(registryBlocks.map((b) => b.group), interfaceGroupUnion)).toEqual([]);
  });

  test('divergence (b): registry entries that render a different component than they install', () => {
    const mismatches = registryBlocks
      .map((b) => {
        const rendererId = renderedType(b.id, b.types[0]);
        return { component: b.component, id: b.id, rendererId, renders: ffiExportFor(rendererId) };
      })
      .filter((m) => !m.renders || !consumerExports(m.component).has(m.renders));
    expect(mismatches).toEqual([
      // the registry's `upload` id has no mapper case (a): it falls back to the uuid default
      { component: 'upload', id: 'upload', rendererId: 'input', renders: 'Input' },
      // input-map-gl is aliased to `map` and renders the Map stub, not MapWithRealMap
      { component: 'map-with-real-map', id: 'input-map-gl', rendererId: 'map', renders: 'Map' },
    ]);
  });

  test('divergence (f): registry titles that are not consumer export names', () => {
    const titled = registryBlocks.filter((b) => !consumerExports(b.component).has(b.title));
    // `FileInterface` is only an alias in the ui-interfaces package barrel; the
    // consumer's components/ui/file.tsx exports `File`.
    expect(titled.map((b) => [b.component, b.title])).toEqual([['file', 'FileInterface']]);
  });

  test('divergence (g): FieldPalette icons that differ from the registry icons', () => {
    expect(sorted(Object.keys(paletteIcons))).toEqual(sorted(provisionableIds));
    /** Icons of every registry block whose id the mapper resolves (explicitly) to `rendererId`. */
    const registryIconsFor = (rendererId: string): string[] =>
      registryBlocks
        .filter((b) => acceptedIds.includes(b.id) && renderedType(b.id, b.types[0]) === rendererId)
        .map((b) => b.icon);
    const rows = provisionableIds.map((id) => ({ id, palette: paletteIcons[id], registry: registryIconsFor(id) }));
    // `map` is the one renderer id two registry blocks resolve to: the palette
    // shows map-with-real-map's IconMapPin while the component that actually
    // renders (`map`, see (b)) carries IconMap. Counted as agreeing here.
    expect(rows.find((r) => r.id === 'map')).toEqual({ id: 'map', palette: 'IconMapPin', registry: ['IconMap', 'IconMapPin'] });
    expect(rows.filter((r) => !r.registry.includes(r.palette))).toEqual([
      { id: 'input', palette: 'IconLetterCase', registry: ['IconForms'] },
      { id: 'input-hash', palette: 'IconHash', registry: ['IconFingerprint'] },
      { id: 'input-rich-text-html', palette: 'IconForms', registry: ['IconTextCaption'] },
      { id: 'input-block-editor', palette: 'IconLayoutList', registry: ['IconLayoutGrid'] },
      { id: 'select-dropdown', palette: 'IconSelect', registry: ['IconSelector'] },
      { id: 'select-multiple-checkbox', palette: 'IconCheckbox', registry: ['IconSquareCheck'] },
      { id: 'select-multiple-dropdown', palette: 'IconListCheck', registry: ['IconSquaresFilled'] },
      { id: 'select-icon', palette: 'IconMoodSmile', registry: ['IconIcons'] },
      { id: 'boolean', palette: 'IconSquareCheck', registry: ['IconCheckbox'] },
      { id: 'slider', palette: 'IconAdjustments', registry: ['IconSlideshow'] },
    ]);
  });
});

describe('ui-forms palette and i18n catalog keys', () => {
  test("FieldPalette's own label lookup finds every provisionable interface, and only those, in both locales", () => {
    // FieldPalette's derivation itself (catalogLabelKey + catalogInterfaceLabel),
    // run from its source — not a copy — so a change there is checked here.
    const palette = loadFunctions<{
      catalogLabelKey: (value: string) => string;
      catalogInterfaceLabel: (t: typeof formsDefaults, descriptor: (typeof PROVISIONABLE_INTERFACES)[number]) => string;
    }>(F.palette, ['catalogLabelKey', 'catalogInterfaceLabel']);
    for (const [locale, dict] of [['en', formsDefaults], ['id', formsId]] as const) {
      const keys = Object.keys(dict.interfaceCatalog.label);
      // A hit returns the dictionary entry; a miss silently falls back to the
      // English descriptor label, which a marked dictionary tells apart.
      const marked = {
        ...dict,
        interfaceCatalog: { ...dict.interfaceCatalog, label: Object.fromEntries(keys.map((k) => [k, `dict:${k}`])) },
      } as typeof formsDefaults;
      const fallbacks = PROVISIONABLE_INTERFACES.filter((p) => !palette.catalogInterfaceLabel(marked, p).startsWith('dict:'));
      expect({ locale, fallbacks: fallbacks.map((p) => p.value) }).toEqual({ locale, fallbacks: [] });
      // … and the dictionary carries no key FieldPalette never asks for.
      expect({ locale, keys: sorted(keys) }).toEqual({ locale, keys: sorted(provisionableIds.map(palette.catalogLabelKey)) });
    }
    // The manifest's labelKey is the key FieldPalette derives.
    const keyMismatches = manifest
      .flatMap((e) => (e.renders && e.provision ? [[e.id, e.provision.labelKey]] : []))
      .filter(([id, key]) => palette.catalogLabelKey(id) !== key);
    expect(keyMismatches).toEqual([]);
  });

  test('catalog group keys cover every provisionable group and exist in both locales', () => {
    expect(sorted(Object.keys(paletteGroupKeys))).toEqual(sorted(PROVISIONABLE_INTERFACES.map((p) => p.group)));
    expect(sorted(Object.values(paletteGroupKeys))).toEqual(sorted(Object.keys(formsDefaults.interfaceCatalog.group)));
    expect(sorted(Object.values(paletteGroupKeys))).toEqual(sorted(Object.keys(formsId.interfaceCatalog.group)));
  });
});

describe('ui-collections and hooks interface checks', () => {
  // Resolved (interface-manifest Phase 1) without a behaviour change: the
  // two NON_FLAT_RELATIONAL_INTERFACES copies, the two selfPersistingInterfaces
  // copies and the raw id comparisons below became calls of manifest
  // predicates; the pre-manifest snapshot pins what each call accepts.
  test('no local copies of NON_FLAT_RELATIONAL_INTERFACES or selfPersistingInterfaces remain', () => {
    expect(initializersOf(parseSource(F.collectionForm), 'NON_FLAT_RELATIONAL_INTERFACES')).toEqual([]);
    expect(initializersOf(parseSource(F.collectionList), 'NON_FLAT_RELATIONAL_INTERFACES')).toEqual([]);
    expect(readAllStringSets(F.collectionForm, 'selfPersistingInterfaces')).toEqual([]);
    expect(minus(interfaceIdsWithFlag('nonFlatRelational'), returnedIds)).toEqual([]);
    expect(minus(interfaceIdsWithFlag('selfPersisting'), returnedIds)).toEqual([]);
  });

  test('raw interface-id comparisons', () => {
    const literals = {
      collectionForm: sorted(interfaceComparisons(F.collectionForm)),
      collectionList: sorted(interfaceComparisons(F.collectionList)),
      junctionItemForm: sorted(interfacePrefixChecks(F.junctionItemForm)),
      ...Object.fromEntries(F.hooks.map((f) => [path.basename(f, '.ts'), sorted(interfaceComparisons(f))])),
    };
    expect(literals).toEqual({
      collectionForm: [],
      // a cell-rendering special case, not an identity table (out of scope)
      collectionList: ['collection-item-dropdown'],
      junctionItemForm: [],
      useRelationM2A: [],
      useRelationM2M: [],
      useRelationO2M: [],
    });
  });

  test('each check calls the manifest predicate that keeps its behaviour', () => {
    expect({
      collectionForm: predicateCalls(F.collectionForm),
      collectionList: predicateCalls(F.collectionList),
      junctionItemForm: predicateCalls(F.junctionItemForm),
      ...Object.fromEntries(F.hooks.map((f) => [path.basename(f, '.ts'), predicateCalls(f)])),
    }).toEqual({
      // CollectionForm's alias-field check: divider + notice only, so the
      // rendered presentation interfaces (isPresentationField also has links)
      collectionForm: [
        'isNonFlatRelationalInterface',
        'isRenderedPresentationInterface',
        'isSelfPersistingInterface',
        'isSelfPersistingInterface',
      ],
      collectionList: ['isNonFlatRelationalInterface'],
      // any presentation-* id, known or not (it was a prefix test)
      junctionItemForm: ['isPresentationLikeInterface', 'isPresentationLikeInterface'],
      useRelationM2A: ["isRelationListInterface(,'m2a')"],
      useRelationM2M: ["isRelationListInterface(,'m2m')"],
      useRelationO2M: ["isRelationListInterface(,'o2m')"],
    });
  });
});

// ---------------------------------------------------------------------------
// Pre-manifest snapshot (interface-manifest, Phase 1)
// ---------------------------------------------------------------------------

/**
 * The value of every interface-id table that interface-manifest Phase 1
 * re-derives from one data module, recorded from the source BEFORE that
 * module existed (59fc8f3). A refactor must leave every live value equal to
 * its literal here; only a deliberate behaviour change may edit one, and the
 * 3.0 release has none (owner decision D6: no change to how stored records
 * render).
 */
const PRE_MANIFEST = {
  /** field-interface-mapper REGISTRY_INTERFACE_ALIASES, entries in declaration order. */
  registryInterfaceAliases: [
    ['input-tags', 'tags'],
    ['input-map', 'map'],
    ['input-map-gl', 'map'],
  ],
  /** getExplicitInterface's fall-through case labels that return another id. */
  inlineSwitchAliases: {
    textarea: 'input-multiline',
    wysiwyg: 'input-rich-text-html',
    markdown: 'input-rich-text-md',
    'list-m2o': 'select-dropdown-m2o',
    'xtr-interface-workflow': 'workflow-button',
    'xtr-interface-workflow-old': 'workflow-button',
    'xtremax-workflow-button': 'workflow-button',
    'xtremax-workflow-button-v2': 'workflow-button',
    'xtremax-workflow-button-scheduled': 'workflow-button',
  },
  /** Every `meta.interface` value getFieldInterface resolves explicitly (46 case labels + the 3 registry aliases). */
  acceptedIds: [
    'boolean', 'collection-item-dropdown', 'datetime', 'file', 'file-image', 'files', 'group-accordion',
    'group-detail', 'group-raw', 'input', 'input-autocomplete-api', 'input-block-editor', 'input-code',
    'input-hash', 'input-map', 'input-map-gl', 'input-multiline', 'input-rich-text-html', 'input-rich-text-md',
    'input-tags', 'list-m2a', 'list-m2m', 'list-m2o', 'list-o2m', 'map', 'markdown', 'presentation-divider',
    'presentation-notice', 'select-color', 'select-dropdown', 'select-dropdown-m2o', 'select-icon',
    'select-multiple-checkbox', 'select-multiple-checkbox-tree', 'select-multiple-dropdown', 'select-radio',
    'slider', 'system-permissions', 'system-token', 'tags', 'textarea', 'toggle', 'workflow-button', 'wysiwyg',
    'xtr-interface-workflow', 'xtr-interface-workflow-old', 'xtremax-workflow-button',
    'xtremax-workflow-button-scheduled', 'xtremax-workflow-button-v2',
  ],
  /** conceal.ts CONCEALING_INTERFACES (what concealingInterface() accepts). */
  concealing: ['input-hash', 'system-token'],
  /** interface-catalog CHOICE_INTERFACES, in insertion order. */
  choice: ['select-dropdown', 'select-radio', 'select-multiple-checkbox', 'select-multiple-checkbox-tree', 'select-multiple-dropdown'],
  /** interface-catalog PROVISIONABLE_INTERFACES, in picker order (types[0] is the provisioned column type). */
  provisionable: [
    { value: 'input', label: 'Text input', group: 'Text', types: ['string', 'text', 'integer', 'bigInteger', 'float', 'decimal'] },
    { value: 'input-multiline', label: 'Multiline text', group: 'Text', types: ['string', 'text'] },
    { value: 'input-code', label: 'Code / JSON', group: 'Text', types: ['string', 'text', 'json'] },
    { value: 'input-hash', label: 'Hash (masked)', group: 'Text', types: ['hash'] },
    { value: 'tags', label: 'Tags', group: 'Text', types: ['json', 'csv'] },
    { value: 'input-rich-text-html', label: 'Rich text (WYSIWYG)', group: 'Rich content', types: ['text'] },
    { value: 'input-rich-text-md', label: 'Rich text (Markdown)', group: 'Rich content', types: ['text'] },
    { value: 'input-block-editor', label: 'Block editor', group: 'Rich content', types: ['json', 'text'] },
    { value: 'select-dropdown', label: 'Dropdown (choices)', group: 'Selection', types: ['string', 'integer', 'bigInteger', 'float', 'decimal'] },
    { value: 'select-radio', label: 'Radio (choices)', group: 'Selection', types: ['string', 'integer'] },
    { value: 'select-multiple-checkbox', label: 'Checkboxes (multiple)', group: 'Selection', types: ['json', 'csv'] },
    { value: 'select-multiple-checkbox-tree', label: 'Checkboxes (tree)', group: 'Selection', types: ['json', 'csv'] },
    { value: 'select-multiple-dropdown', label: 'Multi-select dropdown', group: 'Selection', types: ['json', 'csv'] },
    { value: 'select-icon', label: 'Icon picker', group: 'Selection', types: ['string'] },
    { value: 'select-color', label: 'Color picker', group: 'Selection', types: ['string'] },
    { value: 'boolean', label: 'Checkbox', group: 'Selection', types: ['boolean'] },
    { value: 'toggle', label: 'Toggle', group: 'Selection', types: ['boolean'] },
    { value: 'slider', label: 'Slider', group: 'Numeric & date', types: ['integer', 'bigInteger', 'float', 'decimal'] },
    { value: 'datetime', label: 'Date / time picker', group: 'Numeric & date', types: ['dateTime', 'date', 'time', 'timestamp'] },
    { value: 'map', label: 'Map (geometry)', group: 'Geospatial', types: ['geometry', 'json', 'text'] },
  ],
  /** field-interface-mapper isPresentationField. */
  presentationField: ['presentation-divider', 'presentation-links', 'presentation-notice'],
  /** CollectionForm's inline alias-field check (divider + notice only). */
  collectionFormPresentation: ['presentation-divider', 'presentation-notice'],
  /** JunctionItemForm keeps an alias field whose interface starts with this. */
  junctionItemFormPresentationPrefix: 'presentation-',
  /** NON_FLAT_RELATIONAL_INTERFACES (one copy each in CollectionForm and CollectionList). */
  nonFlatRelational: ['list-m2a', 'list-m2m', 'list-o2m'],
  /** CollectionForm selfPersistingInterfaces (two copies). */
  selfPersisting: ['files'],
  /** The ids each relation hook accepts as its own interface. */
  relationHooks: {
    useRelationM2A: ['list-m2a'],
    useRelationM2M: ['list-m2m'],
    useRelationO2M: ['list-o2m', 'one-to-many'],
  },
} as const;

/** The manifest predicates the shipped checks call, by name. */
const MANIFEST_PREDICATES = {
  isPresentationInterface,
  isRenderedPresentationInterface,
  isPresentationLikeInterface,
  isNonFlatRelationalInterface,
  isSelfPersistingInterface,
  isRelationListInterface,
} as const;
type ManifestPredicate = keyof typeof MANIFEST_PREDICATES;

/** Calls of manifest predicates in a file, in source order, with their literal arguments after the first. */
function manifestPredicateCalls(file: string): { name: ManifestPredicate; args: string[] }[] {
  return collectNodes(parseSource(file), ts.isCallExpression)
    .filter((c) => ts.isIdentifier(c.expression) && c.expression.text in MANIFEST_PREDICATES)
    .map((c) => ({
      name: (c.expression as ts.Identifier).text as ManifestPredicate,
      args: c.arguments.slice(1).map((a) => {
        if (!ts.isStringLiteral(a)) throw new Error(`${file}: non-literal predicate argument ${a.getText()}`);
        return a.text;
      }),
    }));
}

/** `name` or `name(,'arg')` for each manifest predicate call in a file, sorted (duplicates kept). */
function predicateCalls(file: string): string[] {
  return manifestPredicateCalls(file)
    .map((c) => (c.args.length ? `${c.name}(,${c.args.map((a) => `'${a}'`).join(',')})` : c.name))
    .sort((a, b) => a.localeCompare(b));
}

/**
 * The probe ids each call of one of `names` in `file` accepts (one list per
 * call, in source order), running the real predicate with the call's literal
 * arguments.
 */
function acceptedByCalls(file: string, names: readonly ManifestPredicate[]): string[][] {
  return manifestPredicateCalls(file)
    .filter((c) => names.includes(c.name))
    .map((c) => {
      const predicate = MANIFEST_PREDICATES[c.name] as (id: unknown, ...rest: string[]) => boolean;
      return PROBE_IDS.filter((id) => predicate(id, ...c.args));
    });
}

/** The one list every call accepts (calls that disagree, or none, throw). */
function acceptedByEveryCall(file: string, names: readonly ManifestPredicate[], calls: number): string[] {
  const lists = acceptedByCalls(file, names);
  if (lists.length !== calls) throw new Error(`${file}: expected ${calls} call(s) of ${names.join('/')}, found ${lists.length}`);
  if (new Set(lists.map((l) => JSON.stringify(l))).size !== 1) throw new Error(`${file}: ${names.join('/')} calls disagree`);
  return lists[0];
}

const PRESENTATION_PREDICATES: readonly ManifestPredicate[] = [
  'isPresentationInterface',
  'isRenderedPresentationInterface',
  'isPresentationLikeInterface',
];

/** Prefix-check literals of `<…iface…>.startsWith('…')` calls in a file. */
function interfacePrefixChecks(file: string): string[] {
  return collectNodes(parseSource(file), ts.isCallExpression)
    .filter((c) => ts.isPropertyAccessExpression(c.expression) && c.expression.name.text === 'startsWith')
    .filter((c) => /iface|interface/i.test((c.expression as ts.PropertyAccessExpression).expression.getText()))
    .map((c) => {
      const arg = c.arguments[0];
      if (!arg || !ts.isStringLiteral(arg)) throw new Error(`${file}: non-literal startsWith ${c.getText()}`);
      return arg.text;
    });
}

/**
 * Ids probed for behaviour: every id the snapshot names, every registry id,
 * every InterfaceType literal, and near misses nothing should accept (case
 * and whitespace variants, unknown members of known families).
 */
const PROBE_IDS = sorted([
  ...PRE_MANIFEST.acceptedIds,
  ...PRE_MANIFEST.presentationField,
  ...Object.values(PRE_MANIFEST.relationHooks).flat(),
  ...registryBlocks.flatMap((b) => [b.id, ...(b.aliases ?? [])]),
  ...interfaceTypeUnion,
  'presentation-custom',
  'list-custom',
  'not-an-interface',
  'Input',
  'LIST-M2M',
  ' list-m2m',
  '',
]);

/**
 * Whether getFieldInterface resolves `id` through its explicit switch rather
 * than the type-based fallback. For an unknown field type the fallback is
 * `input` without the field's options; every explicit case returns another id
 * or, for `input`, spreads the options.
 */
function resolvesExplicitly(id: string): boolean {
  const field = {
    field: 'probe',
    type: 'probe-type',
    schema: null,
    meta: { interface: id, options: { __probe: true } },
  } as unknown as Field;
  const config = getFieldInterface(field);
  return config.type !== 'input' || config.props?.__probe === true;
}

/**
 * The live value of every snapshotted table: exported values and runtime
 * behaviour, and — for checks inside React components and hooks, which this
 * suite does not render — the manifest predicate each check calls (found in
 * the source with the TypeScript AST) run over the probe ids with the call's
 * own arguments. Before the manifest these read the module-private literals.
 */
const live = {
  acceptedIds: PROBE_IDS.filter(resolvesExplicitly),
  concealing: PROBE_IDS.filter((id) => concealingInterface(id)),
  presentationField: PROBE_IDS.filter((id) => isPresentationField({ field: 'probe', meta: { interface: id } } as unknown as Field)),
  collectionFormPresentation: acceptedByEveryCall(F.collectionForm, PRESENTATION_PREDICATES, 1),
  // Both of its field filters (related and junction collection) check this.
  junctionItemFormPresentation: acceptedByEveryCall(F.junctionItemForm, PRESENTATION_PREDICATES, 2),
  nonFlatRelational: {
    collectionForm: acceptedByEveryCall(F.collectionForm, ['isNonFlatRelationalInterface'], 1),
    collectionList: acceptedByEveryCall(F.collectionList, ['isNonFlatRelationalInterface'], 1),
  },
  // One check per save path (edit, create).
  selfPersisting: acceptedByCalls(F.collectionForm, ['isSelfPersistingInterface']),
  relationHooks: Object.fromEntries(
    F.hooks.map((f) => [path.basename(f, '.ts'), acceptedByEveryCall(f, ['isRelationListInterface'], 1)]),
  ),
};

describe('pre-manifest snapshot: every derived table keeps its value', () => {
  test('REGISTRY_INTERFACE_ALIASES (exported) keeps its entries and their order', () => {
    expect(Object.entries(REGISTRY_INTERFACE_ALIASES)).toEqual(PRE_MANIFEST.registryInterfaceAliases);
  });

  test('getFieldInterface accepts exactly the same ids', () => {
    expect(live.acceptedIds).toEqual(PRE_MANIFEST.acceptedIds);
  });

  test('every alias resolves to its target, with the same props for the same options', () => {
    const aliases = { ...Object.fromEntries(PRE_MANIFEST.registryInterfaceAliases), ...PRE_MANIFEST.inlineSwitchAliases };
    // Options every props builder reads somewhere, so a builder difference shows.
    const options = { __probe: true, toolbar: ['bold', 'link'], font: 'serif', selectMode: 'modal', collection: 'c', type: 'date' };
    const config = (id: string, type: string) =>
      getFieldInterface({ field: 'probe', type, schema: null, meta: { interface: id, options } } as unknown as Field);
    for (const [alias, target] of Object.entries(aliases)) {
      for (const type of ['string', 'json', 'alias']) {
        expect([alias, type, config(alias, type)]).toEqual([alias, type, config(target, type)]);
      }
    }
    // Every other accepted id resolves to itself.
    for (const id of PRE_MANIFEST.acceptedIds.filter((i) => !(i in aliases))) {
      expect([id, renderedType(id, 'probe-type')]).toEqual([id, id]);
    }
  });

  test('concealingInterface() accepts the same ids', () => {
    expect(live.concealing).toEqual(PRE_MANIFEST.concealing);
  });

  test('CHOICE_INTERFACES (exported) keeps its members and their order', () => {
    expect([...CHOICE_INTERFACES]).toEqual(PRE_MANIFEST.choice);
  });

  test('PROVISIONABLE_INTERFACES (exported) keeps every descriptor, in order', () => {
    expect(PROVISIONABLE_INTERFACES).toEqual(PRE_MANIFEST.provisionable);
  });

  test('isPresentationField accepts the same ids', () => {
    expect(live.presentationField).toEqual(PRE_MANIFEST.presentationField);
  });

  test("CollectionForm's alias-field presentation check accepts the same ids", () => {
    expect(live.collectionFormPresentation).toEqual(PRE_MANIFEST.collectionFormPresentation);
  });

  test("JunctionItemForm's presentation check accepts every presentation-* id, known or not", () => {
    const prefix = PRE_MANIFEST.junctionItemFormPresentationPrefix;
    expect(live.junctionItemFormPresentation).toEqual(PROBE_IDS.filter((id) => id.startsWith(prefix)));
    expect(live.junctionItemFormPresentation).toContain('presentation-custom');
  });

  test('NON_FLAT_RELATIONAL_INTERFACES: both ui-collections checks accept the same ids', () => {
    expect(live.nonFlatRelational).toEqual({
      collectionForm: PRE_MANIFEST.nonFlatRelational,
      collectionList: PRE_MANIFEST.nonFlatRelational,
    });
  });

  test("selfPersistingInterfaces: both of CollectionForm's save paths accept the same ids", () => {
    expect(live.selfPersisting).toEqual([PRE_MANIFEST.selfPersisting, PRE_MANIFEST.selfPersisting]);
  });

  test('the relation hooks accept the same interface ids', () => {
    expect(live.relationHooks).toEqual(PRE_MANIFEST.relationHooks);
  });
});

describe('CLI: add / info name resolution', () => {
  let logSpy: MockInstance<typeof console.log>;
  let exitSpy: MockInstance<typeof process.exit>;

  beforeAll(() => {
    vi.mocked(getRegistry).mockResolvedValue(registry as unknown as Registry);
  });
  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit(${code})`);
    }) as typeof process.exit);
  });
  afterEach(() => {
    logSpy.mockRestore();
    exitSpy.mockRestore();
  });

  const addResolves = (name: string): string | undefined =>
    findComponentWithSuggestions(name, registry as unknown as Registry)?.name;

  async function infoResolves(name: string): Promise<string | undefined> {
    logSpy.mockClear();
    try {
      await info(name, { json: true });
    } catch (err) {
      if ((err as Error).message === 'process.exit(1)') return undefined;
      throw err;
    }
    const printed = logSpy.mock.calls.map((c) => String(c[0])).find((s) => s.startsWith('{'));
    return printed ? (JSON.parse(printed) as { name: string }).name : undefined;
  }

  test('add.ts alias targets exist; keys with a dash can never match', () => {
    const names = new Set(registry.components.map((c) => c.name));
    expect(Object.values(addAliases).filter((t) => !names.has(t))).toEqual([]);
    // divergence (e): the lookup strips dashes before consulting the table, so `v-form` is dead.
    expect(Object.keys(addAliases).filter((k) => k.includes('-'))).toEqual(['v-form']);
  });

  test('divergence (e): info.ts keeps its own, smaller alias copy', () => {
    // Every info alias agrees with add …
    expect(Object.entries(infoAliases).filter(([k, v]) => addAliases[k] !== v)).toEqual([]);
    // … but 16 of add's aliases are missing from info.
    expect(minus(Object.keys(addAliases), Object.keys(infoAliases))).toEqual([
      'blockeditor',
      'checkboxes',
      'code',
      'colorpicker',
      'datepicker',
      'editor',
      'fileupload',
      'icon',
      'imageupload',
      'md',
      'multiselect',
      'radio',
      'relation',
      'richtext',
      'textfield',
      'v-form',
    ]);
  });

  test('divergence (d): storable registry ids that `buildpad add` / `buildpad info` cannot resolve', async () => {
    const ids = sorted(registryBlocks.flatMap((b) => [b.id, ...(b.aliases ?? [])]));
    const unresolvedByAdd = ids.filter((id) => !addResolves(id));
    const unresolvedByInfo: string[] = [];
    for (const id of ids) if (!(await infoResolves(id))) unresolvedByInfo.push(id);
    const expected = [
      'input-autocomplete-api',
      'input-map',
      'input-map-gl',
      'input-multiline',
      'input-rich-text-html',
      'input-rich-text-md',
      'input-tags',
      'list-m2o',
      'presentation-divider',
      'presentation-notice',
      'select-color',
    ];
    expect(unresolvedByAdd).toEqual(expected);
    expect(unresolvedByInfo).toEqual(expected);
  });

  test('registry ids that do resolve land on the component that declares them', async () => {
    for (const b of registryBlocks) {
      for (const id of [b.id, ...(b.aliases ?? [])]) {
        const viaAdd = addResolves(id);
        if (viaAdd) expect([id, viaAdd]).toEqual([id, b.component]);
        const viaInfo = await infoResolves(id);
        if (viaInfo) expect([id, viaInfo]).toEqual([id, b.component]);
      }
    }
  });
});

/**
 * The string-literal `enum` of property `prop` in the inputSchema of the MCP
 * tool named `toolName` (the tool list in mcp-server/src/index.ts).
 */
function readToolEnum(file: string, toolName: string, prop: string): string[] {
  const sf = parseSource(file);
  const tools = collectNodes(sf, ts.isObjectLiteralExpression).filter((o) =>
    o.properties.some(
      (p) =>
        ts.isPropertyAssignment(p) &&
        propertyKey(sf, p.name) === 'name' &&
        ts.isStringLiteral(p.initializer) &&
        p.initializer.text === toolName,
    ),
  );
  if (tools.length !== 1) throw new Error(`${file}: expected one tool \`${toolName}\`, found ${tools.length}`);
  const propNode = collectNodes(tools[0], ts.isPropertyAssignment).find((p) => propertyKey(sf, p.name) === prop);
  const enumNode = propNode && collectNodes(propNode, ts.isPropertyAssignment).find((p) => propertyKey(sf, p.name) === 'enum');
  const arr = enumNode && unwrap(enumNode.initializer);
  if (!arr || !ts.isArrayLiteralExpression(arr)) throw new Error(`${file}: \`${toolName}.${prop}\` has no literal enum`);
  return arr.elements.map((e) => {
    if (!ts.isStringLiteral(e)) throw new Error(`${file}: \`${toolName}.${prop}\` enum has a non-string member`);
    return e.text;
  });
}

describe('MCP: hardcoded registry tables', () => {
  test('get_install_command category enum vs registry categories', () => {
    const mcpCategories = readToolEnum(F.mcpIndex, 'get_install_command', 'category');
    expect(minus(mcpCategories, registry.categories.map((c) => c.name))).toEqual([]);
    // The enum is a hand copy; the registry has since gained these categories.
    expect(minus(registry.categories.map((c) => c.name), mcpCategories)).toEqual(['admin', 'workflow']);
  });
});

describe('MCP: generate_interface componentMap', () => {
  test('every mapped name is a ui-interfaces package export', () => {
    expect(minus(Object.values(mcpComponentMap), uiInterfacesExports)).toEqual([]);
  });

  test('divergence (f): keys that are not renderer ids, and names the consumer file does not export', () => {
    // `textarea` is a component name / legacy alias; the renderer id is input-multiline.
    expect(minus(Object.keys(mcpComponentMap), returnedIds)).toEqual(['textarea']);
    // The generated snippet is `import { <name> } from '@/components/ui/<type>'`.
    const snippetImports = (type: string): boolean => {
      const target = shippedTarget(`components/ui/${type}`);
      return !!target && exportsOfTarget(target).values.has(mcpComponentMap[type] ?? 'Input');
    };
    const broken = Object.entries(mcpComponentMap)
      .filter(([key]) => !snippetImports(key))
      .map(([key, name]) => `${key} → ${name}`);
    expect(broken).toEqual(['file → FileInterface']);

    // For any other type it falls back to `Input` but still imports from
    // '@/components/ui/<type>'. Only these registry interface ids produce a
    // snippet whose import resolves (module exists and exports the name);
    // the other 33 do not (input-multiline, select-color, presentation-*, …).
    expect(sorted(registryBlocks.map((b) => b.id).filter(snippetImports))).toEqual([
      'boolean',
      'datetime',
      'file-image',
      'input',
      'select-dropdown',
      'toggle',
    ]);
  });
});

/**
 * Whether `abs` (inside the repo) exists with exactly this casing in every
 * path segment. Each segment is matched against its parent's real directory
 * entries, so a case-insensitive filesystem (macOS, Windows) cannot pass a
 * wrong-case directory the Linux CI and GitHub would reject.
 */
function existsExactCase(abs: string): boolean {
  const rel = path.relative(REPO_ROOT, abs);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return false;
  let dir = REPO_ROOT;
  for (const segment of rel.split(path.sep)) {
    if (!fs.statSync(dir, { throwIfNoEntry: false })?.isDirectory() || !fs.readdirSync(dir).includes(segment)) return false;
    dir = path.join(dir, segment);
  }
  return true;
}

describe('docs', () => {
  test('existsExactCase checks the casing of every segment, not just the file name', () => {
    expect(existsExactCase(path.join(PACKAGES_ROOT, F.uiInterfacesBarrel))).toBe(true);
    expect(existsExactCase(path.join(REPO_ROOT, 'packages/UI-Interfaces/src/index.ts'))).toBe(false);
    expect(existsExactCase(path.join(REPO_ROOT, 'Packages/ui-interfaces/src/index.ts'))).toBe(false);
    expect(existsExactCase(path.join(REPO_ROOT, 'packages/ui-interfaces/src/INDEX.ts'))).toBe(false);
    expect(existsExactCase(path.join(REPO_ROOT, 'packages/ui-interfaces/src/index.ts/x'))).toBe(false);
  });

  test('divergence (l): COMPONENT_MAP.md source links that do not exist (case-sensitive)', () => {
    const doc = fs.readFileSync(path.join(REPO_ROOT, 'docs/COMPONENT_MAP.md'), 'utf8');
    const links = [...doc.matchAll(/\]\((\.\.\/packages\/[^)#\s]+)\)/g)].map((m) => m[1]);
    expect(links.length).toBeGreaterThan(0);
    const broken = links.filter((l) => !existsExactCase(path.resolve(REPO_ROOT, 'docs', l)));
    expect(broken).toEqual(['../packages/ui-interfaces/src/rich-text-html/RichTextHtml.tsx']);
  });
});

// ---------------------------------------------------------------------------
// Consumer utils barrel (cli/templates/lib/utils-index.ts → lib/buildpad/utils/index.ts)
// ---------------------------------------------------------------------------

describe('consumer utils barrel', () => {
  const BARREL_TARGET = 'lib/buildpad/utils/index.ts';
  /**
   * `@/lib/buildpad/utils` resolves to this file before the folder index (TS
   * and bundlers try `<path>.ts` first); it only forwards to the barrel.
   */
  const BARREL_FILE_TARGET = 'lib/buildpad/utils.ts';
  const barrel = readExports(F.utilsBarrelTemplate);
  const utilsLibTargets = new Set((registry.lib.utils?.files ?? []).map((f) => f.target));

  interface ResolvedImport extends ImportDecl {
    /** The importing file: monorepo source and consumer target. */
    file: string;
    fileTarget: string;
    /** Consumer path the specifier points at (no extension); undefined for a bare package. */
    base: string | undefined;
    /** The shipped file `base` resolves to, if any. */
    target: string | undefined;
  }

  /** Every static import of every shipped TS file, resolved in the consumer layout. */
  const shippedImports: ResolvedImport[] = [...sourceByTarget]
    .filter(([, source]) => /\.tsx?$/.test(source))
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([target, source]) =>
      importDeclsOf(source).map((d) => {
        const base = consumerModulePath({ target }, d);
        return { ...d, file: source, fileTarget: target, base, target: base === undefined ? undefined : shippedTarget(base) };
      }),
    );

  /** Names imports take that their (resolved) consumer target does not export. */
  function unexportedNames(imports: ResolvedImport[]): { missing: string[]; valueImportOfTypeExport: string[] } {
    const missing: string[] = [];
    const valueImportOfTypeExport: string[] = [];
    for (const i of imports) {
      if (!i.target) continue;
      const ex = exportsOfTarget(i.target);
      for (const { name, typeOnly } of i.names) {
        if (name === '*' || ex.values.has(name)) continue;
        if (ex.types.has(name)) {
          if (!typeOnly) valueImportOfTypeExport.push(`${i.file}: ${name} (from '${i.spec}')`);
          continue;
        }
        missing.push(`${i.file}: ${name} (from '${i.spec}')`);
      }
    }
    return { missing, valueImportOfTypeExport };
  }

  test('the template is what the registry ships as the barrel, with explicit names only', () => {
    expect(sourceByTarget.get(BARREL_TARGET)).toBe(F.utilsBarrelTemplate);
    expect(barrel.stars).toEqual([]);
    expect(shippedTarget('lib/buildpad/utils')).toBe(BARREL_FILE_TARGET);
    expect(sourceByTarget.get(BARREL_FILE_TARGET)).toBe('cli/templates/lib/utils.ts');
    const forwarder = readExports('cli/templates/lib/utils.ts');
    expect([forwarder.stars, [...forwarder.values], [...forwarder.types]]).toEqual([['./utils/index'], [], []]);
  });

  test('exports every symbol a shipped file imports from it, in every import form', () => {
    const barrelImports = shippedImports.filter((i) => i.target === BARREL_TARGET || i.target === BARREL_FILE_TARGET);
    const importersVia = (spec: string): string[] => sorted(barrelImports.filter((i) => i.spec === spec).map((i) => i.file));
    // Package sources import `@buildpad/utils` (the transformer maps it to
    // `@/lib/buildpad/utils`); CLI templates are written in consumer form and
    // import `@/lib/buildpad/utils` directly. Both reach this barrel, so both
    // are checked — the second form must not silently drop out of coverage.
    expect(importersVia('@buildpad/utils').length).toBeGreaterThan(0);
    expect(importersVia('@/lib/buildpad/utils')).toEqual(
      expect.arrayContaining(['cli/templates/app/content/[collection]/[id]/page.tsx', 'cli/templates/lib/i18n/provider.tsx']),
    );
    // No gaps today. A shipped file importing a utils symbol the template
    // barrel does not re-export compiles in the monorepo but breaks every
    // consumer at `lib/buildpad/utils`.
    expect(unexportedNames(barrelImports)).toEqual({ missing: [], valueImportOfTypeExport: [] });
  });

  test('utils subpath imports resolve, as the transformer maps them, to shipped modules exporting what they take', () => {
    // transformer.ts maps `@buildpad/utils/<x>` to the utils lib's flattened
    // layout, lib/buildpad/<x>, where the module really is. (It used to map
    // non-i18n subpaths to lib/buildpad/utils/<x>, which the lib never
    // creates: the barrel is the only file under lib/buildpad/utils/.)
    const at = (spec: string): string | undefined => consumerModulePath({ target: 'lib/buildpad/conceal.ts' }, { spec, kind: 'import', typeOnly: false });
    expect(shippedTarget(at('@buildpad/utils/i18n') ?? '')).toBe('lib/buildpad/i18n/index.ts');
    expect(shippedTarget(at('@buildpad/utils/i18n/locales/id') ?? '')).toBe('lib/buildpad/i18n/locales/id.ts');
    expect(at('@buildpad/utils/conceal')).toBe('lib/buildpad/conceal');
    expect(shippedTarget(at('@buildpad/utils/conceal') ?? '')).toBe('lib/buildpad/conceal.ts');
    expect([...sourceByTarget.keys()].filter((t) => t.startsWith('lib/buildpad/utils/'))).toEqual([BARREL_TARGET]);

    const subpathImports = shippedImports.filter(
      (i) => /^(@buildpad\/utils|@\/lib\/buildpad\/utils)\//.test(i.spec) || /^@\/lib\/buildpad\/i18n(\/|$)/.test(i.spec),
    );
    expect(subpathImports.filter((i) => !i.target).map((i) => `${i.file}: '${i.spec}'`)).toEqual([]);
    expect(unexportedNames(subpathImports)).toEqual({ missing: [], valueImportOfTypeExport: [] });
  });

  test('imports inside the utils lib resolve in its flattened consumer layout', () => {
    // utils/src/<x> ships as lib/buildpad/<x>; relative imports between those
    // files are copied verbatim, so they must still land on shipped files.
    const inUtilsLib = shippedImports.filter((i) => i.spec.startsWith('.') && utilsLibTargets.has(i.fileTarget));
    expect(inUtilsLib.length).toBeGreaterThan(0);
    expect(inUtilsLib.filter((i) => !i.target).map((i) => `${i.file}: '${i.spec}'`)).toEqual([]);
    expect(unexportedNames(inUtilsLib)).toEqual({ missing: [], valueImportOfTypeExport: [] });
  });

  test('every name the barrel re-exports exists in the shipped module it points at', () => {
    expect(barrel.reexports.length).toBeGreaterThan(0);
    const dangling = barrel.reexports
      .filter((r) => {
        const target = shippedTarget(path.posix.join(path.posix.dirname(BARREL_TARGET), r.spec));
        if (!target) return true;
        const ex = exportsOfTarget(target);
        return !(ex.values.has(r.local) || (r.typeOnly && ex.types.has(r.local)));
      })
      .map((r) => `${r.spec}: ${r.local}`);
    expect(dangling).toEqual([]);
  });
});
