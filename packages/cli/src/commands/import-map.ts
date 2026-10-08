/**
 * Where each @buildpad/* package's imports land in a consumer project.
 *
 * The one package → target map. The transformer rewrites every `@buildpad/*`
 * specifier through it, and it is tested against everything else that lists
 * the packages — packages/*\/package.json, registry.packages, build-registry's
 * PACKAGE_FOLDERS and inferSourcePackage, the changesets fixed group — so
 * adding a package means adding ONE entry here (the tests say where else).
 *
 * Targets are relative to the configured aliases, so the default config
 * (`@/components/ui`, `@/lib/buildpad`) reproduces the registry's fixed target
 * paths. A specifier the map cannot place throws UnmappedImportError: shipping
 * it unrewritten would only fail later, in the consumer's build.
 */

import type { Config } from './init.js';

export interface PackageTarget {
  /** The package's folder under packages/. */
  folder: string;
  /** The configured alias its files install under. */
  alias: keyof Config['aliases'];
  /** Path under the alias for the bare package ('' = the alias itself: for components, the generated barrel). */
  root: string;
  /**
   * How `<package>/<subpath>` maps:
   * - `keep`      → `<alias>/<root>/<subpath>` (the package keeps its folder layout)
   * - `flatten`   → `<alias>/<subpath>` (utils: its files install flat into the lib root)
   * - `kebab`     → `<alias>/<root>/<subpath, each segment kebab-cased>` (flat kebab-case targets)
   * - `interface` → `<alias>/<root>/<subpath>`, except `<x>/<EntryFile>` → `<alias>/<root>/<x>`
   *                 (an interface's entry file installs flattened as `<x>.tsx`)
   * - a table     → `<alias>/<table[subpath]>`; any other subpath has no target
   */
  subpaths: 'keep' | 'flatten' | 'kebab' | 'interface' | Readonly<Record<string, string>>;
  /**
   * Type-only imports and re-exports (`import type { … }`, `export type { … }`)
   * of the bare package go to `root` under the alias, except names listed in
   * `owners`, which live in another module.
   */
  types?: { root: string; owners: Readonly<Record<string, string>> };
}

export const BUILDPAD_PACKAGES: Readonly<Record<string, PackageTarget>> = {
  '@buildpad/types': { folder: 'types', alias: 'lib', root: 'types', subpaths: 'keep' },
  '@buildpad/services': { folder: 'services', alias: 'lib', root: 'services', subpaths: 'keep' },
  '@buildpad/hooks': { folder: 'hooks', alias: 'lib', root: 'hooks', subpaths: 'keep' },
  // utils' modules install flat into the lib root (lib/buildpad/conceal.ts,
  // lib/buildpad/i18n/…); the bare package is the hand-written utils barrel.
  '@buildpad/utils': { folder: 'utils', alias: 'lib', root: 'utils', subpaths: 'flatten' },
  // The bare packages resolve to the generated components barrel.
  '@buildpad/ui-interfaces': { folder: 'ui-interfaces', alias: 'components', root: '', subpaths: 'interface' },
  '@buildpad/ui-collections': { folder: 'ui-collections', alias: 'components', root: '', subpaths: 'kebab' },
  '@buildpad/ui-form': { folder: 'ui-form', alias: 'components', root: 'vform', subpaths: 'keep' },
  '@buildpad/ui-table': {
    folder: 'ui-table',
    alias: 'components',
    root: 'vtable',
    subpaths: {
      VTable: 'vtable',
      types: 'vtable-types',
      'components/TableHeader': 'table-header',
      'components/TableRow': 'table-row',
    },
    // The package index re-exports types.ts plus one props type per component.
    types: {
      root: 'vtable-types',
      owners: { VTableProps: 'vtable', TableHeaderProps: 'table-header', TableRowProps: 'table-row' },
    },
  },
  '@buildpad/ui-files': { folder: 'ui-files', alias: 'components', root: 'file-manager', subpaths: 'kebab' },
  '@buildpad/ui-users': { folder: 'ui-users', alias: 'components', root: 'users-management', subpaths: 'kebab' },
  '@buildpad/ui-forms': { folder: 'ui-forms', alias: 'components', root: 'form-builder', subpaths: 'kebab' },
  '@buildpad/ui-workflows': {
    folder: 'ui-workflows',
    alias: 'components',
    root: 'workflow-management',
    subpaths: 'kebab',
  },
};

/**
 * Workspace packages that are never installed into a consumer project. Both
 * are published to npm, so a consumer's own code may import them; registry
 * files may not (the install transform throws).
 */
export const NON_INSTALLABLE_PACKAGES: Readonly<Record<string, string>> = {
  '@buildpad/cli': 'it is the installer; its templates install under their own targets',
  '@buildpad/mcp': 'it is the MCP server, not a library',
};

/** Whether `specifier` imports one of NON_INSTALLABLE_PACKAGES (the published ones) or a subpath of it. */
export function isNonInstallableSpecifier(specifier: string): boolean {
  const pkg = /^@buildpad\/[^/]+/.exec(specifier)?.[0];
  return pkg !== undefined && Object.hasOwn(NON_INSTALLABLE_PACKAGES, pkg);
}

/** A `@buildpad/*` specifier the install transform cannot place. */
export class UnmappedImportError extends Error {
  constructor(
    readonly specifier: string,
    readonly reason: string,
    readonly line?: number,
    readonly file?: string,
  ) {
    const where = file ? `${file}${line ? `:${line}` : ''}: ` : line ? `line ${line}: ` : '';
    super(
      `${where}cannot rewrite '${specifier}' — ${reason}. ` +
        'Map it in packages/cli/src/commands/import-map.ts, or import the module the registry installs.',
    );
    this.name = 'UnmappedImportError';
  }
}

/**
 * Convert PascalCase or camelCase to kebab-case
 */
export function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

const join = (...parts: string[]) => parts.filter(Boolean).join('/');

/**
 * The consumer path a `@buildpad/*` specifier rewrites to.
 *
 * @param typeOnlyNames - the imported names when the specifier belongs to an
 *   `import type { … }` / `export type { … }` clause
 * @throws UnmappedImportError when there is no target
 */
export function resolveBuildpadImport(
  specifier: string,
  aliases: Config['aliases'],
  typeOnlyNames?: string[],
): string {
  const m = /^(@buildpad\/[^/]+)(?:\/(.+))?$/.exec(specifier);
  if (!m) throw new UnmappedImportError(specifier, 'it is not a @buildpad/<package> specifier');
  const [, pkg, subpath] = m;
  const target = BUILDPAD_PACKAGES[pkg];
  if (!target) {
    const reason = NON_INSTALLABLE_PACKAGES[pkg];
    throw new UnmappedImportError(
      specifier,
      reason ? `${pkg} is never installed into a project (${reason})` : `${pkg} is not a package the registry installs`,
    );
  }
  const alias = aliases[target.alias];

  if (!subpath) {
    if (typeOnlyNames && target.types) {
      const homes = [...new Set(typeOnlyNames.map(name => target.types!.owners[name] ?? target.types!.root))];
      if (homes.length > 1) {
        throw new UnmappedImportError(
          specifier,
          `its type-only names live in different modules (${homes.join(', ')}); split the import`,
        );
      }
      return join(alias, homes[0] ?? target.types.root);
    }
    return join(alias, target.root);
  }

  const rule = target.subpaths;
  if (rule === 'keep') return join(alias, target.root, subpath);
  if (rule === 'flatten') return join(alias, subpath);
  if (rule === 'kebab') return join(alias, target.root, subpath.split('/').map(toKebabCase).join('/'));
  if (rule === 'interface') {
    const [folder, file, ...rest] = subpath.split('/');
    const isEntryFile =
      file !== undefined && rest.length === 0 && /^[A-Z]/.test(file) && file.toLowerCase() === folder.replace(/-/g, '');
    return join(alias, target.root, isEntryFile ? folder : subpath);
  }
  const mapped = rule[subpath];
  if (!mapped) {
    throw new UnmappedImportError(
      specifier,
      `${pkg} has no '${subpath}' module in the registry (known: ${Object.keys(rule).join(', ')})`,
    );
  }
  return join(alias, mapped);
}
