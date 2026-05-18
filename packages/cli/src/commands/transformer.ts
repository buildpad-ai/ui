/**
 * Import Transformer
 * 
 * Transforms @buildpad/* imports to local path aliases.
 * This is the core of the Copy & Own model - making copied files self-contained.
 */

import path from 'path';
import { sha256 } from '../utils/checksum.js';
import type { Config } from './init.js';

/**
 * Import replacement mapping
 */
interface ImportMapping {
  from: RegExp;
  to: string;
}

/**
 * Get import mappings based on config
 */
export function getImportMappings(config: Config): ImportMapping[] {
  const libAlias = config.aliases.lib;
  const componentsAlias = config.aliases.components;

  return [
    // Types
    {
      from: /from ['"]@buildpad\/types['"]/g,
      to: `from '${libAlias}/types'`,
    },
    {
      from: /from ['"]@buildpad\/types\/([^'"]+)['"]/g,
      to: `from '${libAlias}/types/$1'`,
    },
    // Services
    {
      from: /from ['"]@buildpad\/services['"]/g,
      to: `from '${libAlias}/services'`,
    },
    {
      from: /from ['"]@buildpad\/services\/([^'"]+)['"]/g,
      to: `from '${libAlias}/services/$1'`,
    },
    // Hooks
    {
      from: /from ['"]@buildpad\/hooks['"]/g,
      to: `from '${libAlias}/hooks'`,
    },
    {
      from: /from ['"]@buildpad\/hooks\/([^'"]+)['"]/g,
      to: `from '${libAlias}/hooks/$1'`,
    },
    // UI Interfaces (component to component imports)
    {
      from: /from ['"]@buildpad\/ui-interfaces['"]/g,
      to: `from '${componentsAlias}'`,
    },
    {
      from: /from ['"]@buildpad\/ui-interfaces\/([^'"]+)['"]/g,
      to: `from '${componentsAlias}/$1'`,
    },
    // UI Collections (component to component imports)
    {
      from: /from ['"]@buildpad\/ui-collections['"]/g,
      to: `from '${componentsAlias}'`,
    },
    {
      from: /from ['"]@buildpad\/ui-collections\/([^'"]+)['"]/g,
      to: `from '${componentsAlias}/$1'`,
    },
    // Utils
    {
      from: /from ['"]@buildpad\/utils['"]/g,
      to: `from '${libAlias}/utils'`,
    },
    {
      from: /from ['"]@buildpad\/utils\/([^'"]+)['"]/g,
      to: `from '${libAlias}/utils/$1'`,
    },
    // UI Form (VForm and related components)
    {
      from: /from ['"]@buildpad\/ui-form['"]/g,
      to: `from '${componentsAlias}/vform'`,
    },
    {
      from: /from ['"]@buildpad\/ui-form\/([^'"]+)['"]/g,
      to: `from '${componentsAlias}/vform/$1'`,
    },
    // UI Table (VTable - type-import pattern MUST come before general pattern
    // so type imports resolve to vtable-types while value imports resolve to vtable)
    {
      from: /import type \{([^}]+)\} from ['"]@buildpad\/ui-table['"]/g,
      to: `import type {$1} from '${componentsAlias}/vtable-types'`,
    },
    {
      from: /from ['"]@buildpad\/ui-table['"]/g,
      to: `from '${componentsAlias}/vtable'`,
    },
    {
      from: /from ['"]@buildpad\/ui-table\/([^'"]+)['"]/g,
      to: `from '${componentsAlias}/$1'`,
    },
    // Import type statements
    {
      from: /import type \{([^}]+)\} from ['"]@buildpad\/types['"]/g,
      to: `import type {$1} from '${libAlias}/types'`,
    },
    {
      from: /import type \{([^}]+)\} from ['"]@buildpad\/hooks['"]/g,
      to: `import type {$1} from '${libAlias}/hooks'`,
    },
    {
      from: /import type \{([^}]+)\} from ['"]@buildpad\/services['"]/g,
      to: `import type {$1} from '${libAlias}/services'`,
    },
    // Import type for utils
    {
      from: /import type \{([^}]+)\} from ['"]@buildpad\/utils['"]/g,
      to: `import type {$1} from '${libAlias}/utils'`,
    },
    // Import type for ui-form
    {
      from: /import type \{([^}]+)\} from ['"]@buildpad\/ui-form['"]/g,
      to: `import type {$1} from '${componentsAlias}/vform'`,
    },
    // Dynamic imports - import('@buildpad/services') etc.
    {
      from: /import\s*\(\s*['"]@buildpad\/services['"]\s*\)/g,
      to: `import('${libAlias}/services')`,
    },
    {
      from: /import\s*\(\s*['"]@buildpad\/hooks['"]\s*\)/g,
      to: `import('${libAlias}/hooks')`,
    },
    {
      from: /import\s*\(\s*['"]@buildpad\/types['"]\s*\)/g,
      to: `import('${libAlias}/types')`,
    },
    {
      from: /import\s*\(\s*['"]@buildpad\/utils['"]\s*\)/g,
      to: `import('${libAlias}/utils')`,
    },
  ];
}

/**
 * Transform a file's content by replacing @buildpad/* imports with local paths
 * Also normalizes import paths to use consistent kebab-case file names
 * 
 * @param content - File content to transform
 * @param config - Buildpad config
 * @param targetPath - Optional target path for context-aware transformations
 */
export function transformImports(content: string, config: Config, targetPath?: string): string {
  const mappings = getImportMappings(config);
  let result = content;

  for (const mapping of mappings) {
    result = result.replace(mapping.from, mapping.to);
  }

  // Normalize any PascalCase import paths to kebab-case (skips VForm folder)
  result = normalizeImportPaths(result, targetPath);

  return result;
}

/**
 * Transform internal component imports
 * e.g., import { CollectionList } from '@buildpad/ui-collections' 
 *    -> import { CollectionList } from '@/components/ui/collection-list'
 */
export function transformComponentImports(
  content: string,
  _componentName: string,
  config: Config
): string {
  const componentsAlias = config.aliases.components;
  
  // Handle default exports that reference other components
  const componentImportPattern = new RegExp(
    `from ['"]\\.\\.?\\/([^'"]+)['""]`,
    'g'
  );
  
  return content.replace(componentImportPattern, (match, importPath) => {
    // If it's a relative import to another component file, transform it
    if (importPath.startsWith('..')) {
      // Extract component folder name and convert to kebab-case
      const parts = importPath.split('/');
      const componentFolder = parts[parts.length - 1] || parts[parts.length - 2];
      const kebabName = toKebabCase(componentFolder);
      return `from '${componentsAlias}/${kebabName}'`;
    }
    return match;
  });
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

/**
 * Convert kebab-case to PascalCase
 */
export function toPascalCase(str: string): string {
  return str
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

/**
 * Normalize import paths to use consistent kebab-case file names
 * Fixes issues where imports use PascalCase but files are kebab-case
 * 
 * EXCEPTION: VForm folder preserves PascalCase imports because its files
 * are copied with original casing (VForm.tsx, FormField.tsx, etc.)
 * 
 * Examples:
 *   ./InputBlockEditor → ./input-block-editor
 *   ./FileImage → ./file-image
 *   ../Upload/Upload → ./upload
 *   dynamic import('./InputBlockEditor') → import('./input-block-editor')
 *   
 * Files marked with @buildpad-preserve-casing are not normalized.
 */
export function normalizeImportPaths(content: string, targetPath?: string): string {
  // Skip normalization for files that preserve casing
  if (content.includes('@buildpad-preserve-casing')) {
    return content;
  }
  
  // Skip normalization for VForm folder files (they use PascalCase filenames)
  if (targetPath && (
    targetPath.includes('/vform/') || 
    targetPath.includes('/ui-form/') ||
    targetPath.includes('VForm') ||
    targetPath.includes('FormField')
  )) {
    return content;
  }
  
  // Pattern matches relative imports with PascalCase filenames
  // e.g., from './InputBlockEditor' or from '../Upload/Upload'
  const pascalCaseImportPattern = /from\s+['"](\.\.\/?|\.\/)([A-Z][a-zA-Z0-9]*(?:\/[A-Z][a-zA-Z0-9]*)?)['"]/g;
  
  let result = content.replace(pascalCaseImportPattern, (_match, prefix, importPath) => {
    // Extract the last component (filename) from the path
    const parts = importPath.split('/');
    const fileName = parts[parts.length - 1];
    
    // Convert to kebab-case
    const kebabFileName = toKebabCase(fileName);
    
    // If it was a nested path like '../Upload/Upload', flatten to './upload'
    if (prefix === '../' && parts.length >= 1) {
      return `from './${kebabFileName}'`;
    }
    
    // Otherwise, just convert the filename
    return `from '${prefix}${kebabFileName}'`;
  });
  
  // Handle dynamic imports: import('./InputBlockEditor') → import('./input-block-editor')
  // This pattern matches: import('./ComponentName') or import("./ComponentName")
  const dynamicImportPattern = /import\s*\(\s*['"](\.\/)([A-Z][a-zA-Z0-9]*)['"]\s*\)/g;
  
  result = result.replace(dynamicImportPattern, (_match, prefix, componentName) => {
    const kebabName = toKebabCase(componentName);
    return `import('${prefix}${kebabName}')`;
  });
  
  return result;
}

/**
 * Transform relative imports within a multi-file component using the registry
 * file mappings. Resolves each relative import against the source file's location,
 * looks up the corresponding target path, and rewrites the import to point to
 * the correct target-relative path.
 *
 * Handles both module imports (`from './...'`) and side-effect imports (`import './...'` for CSS).
 */
export function transformIntraComponentImports(
  content: string,
  sourceFile: string,
  targetFile: string,
  fileMappings: Array<{ source: string; target: string }>
): string {
  // Only useful for multi-file components
  if (!fileMappings || fileMappings.length <= 1) return content;

  const sourceDir = path.posix.dirname(sourceFile);
  const targetDir = path.posix.dirname(targetFile);

  // Build lookup: resolved source path (no extension) → target path (no extension)
  const sourceToTarget = new Map<string, string>();
  // Build lookup: resolved source path (with extension) → target path (with extension)
  const sourceToTargetExt = new Map<string, string>();

  for (const fm of fileMappings) {
    sourceToTarget.set(fm.source.replace(/\.\w+$/, ''), fm.target.replace(/\.\w+$/, ''));
    sourceToTargetExt.set(fm.source, fm.target);
  }

  // Pattern 1: `from './...'` or `from '../...'` (JS/TS module imports)
  let result = content.replace(
    /from\s+(['"])(\.[^'"]+)\1/g,
    (match, _quote, importPath) => {
      const resolved = path.posix.join(sourceDir, importPath);
      // Try with and without extension stripping
      const resolvedNoExt = resolved.replace(/\.\w+$/, '');
      const mapped = sourceToTarget.get(resolvedNoExt) ?? sourceToTarget.get(resolved);
      if (mapped) {
        let rel = path.posix.relative(targetDir, mapped);
        if (!rel.startsWith('.')) rel = './' + rel;
        return match.replace(importPath, rel);
      }
      return match;
    }
  );

  // Pattern 2: `import './...'` (CSS/side-effect imports, no `from`)
  result = result.replace(
    /import\s+(['"])(\.[^'"]+)\1/g,
    (match, _quote, importPath) => {
      // Skip if it looks like a `from` import (already handled above)
      // This regex only fires for bare `import '...'` statements
      const resolved = path.posix.join(sourceDir, importPath);
      // Try with extension first (CSS files keep extensions)
      const mappedExt = sourceToTargetExt.get(resolved);
      if (mappedExt) {
        let rel = path.posix.relative(targetDir, mappedExt);
        if (!rel.startsWith('.')) rel = './' + rel;
        return match.replace(importPath, rel);
      }
      // Fallback: try without extension
      const resolvedNoExt = resolved.replace(/\.\w+$/, '');
      const mapped = sourceToTarget.get(resolvedNoExt);
      if (mapped) {
        let rel = path.posix.relative(targetDir, mapped);
        if (!rel.startsWith('.')) rel = './' + rel;
        return match.replace(importPath, rel);
      }
      return match;
    }
  );

  return result;
}

/**
 * Check if content has @buildpad/* imports
 */
export function hasBuildpadImports(content: string): boolean {
  return /@buildpad\/(types|services|hooks|utils|ui-interfaces|ui-collections|ui-form|ui-table)/.test(content);
}

/**
 * Known relative import mappings for ui-interfaces components
 * Maps source folder imports to target file imports when flattening structure
 */
const RELATIVE_IMPORT_MAPPINGS: Record<string, string> = {
  // file-image/FileImage.tsx imports from ../upload → ./upload
  '../upload': './upload',
  // file/File.tsx imports from ../upload → ./upload
  // files/Files.tsx imports from ../upload → ./upload
  // list-o2m imports from ../upload → ./upload
  // list-m2m/ListM2M.tsx imports from ../list-m2a/render-template → ./list-m2a/render-template
  '../list-m2a/render-template': './list-m2a/render-template',
};

/**
 * Known relative import mappings for VForm components (nested folder structure)
 * VForm keeps its folder structure, so imports like '../types' need to stay as '../types'
 * but imports from './types' when in the same folder should remain './types'
 */
const VFORM_IMPORT_MAPPINGS: Record<string, Record<string, string>> = {
  // Files in vform/components/ folder
  'components': {
    '../types': '../types',
    './types': '../types',
  },
  // Files in vform/utils/ folder  
  'utils': {
    '../types': '../types',
    './types': '../types',
  },
  // Files in vform/ root folder
  'root': {
    './types': './types',
  },
};

/**
 * Transform VForm-specific relative imports based on source file location
 */
export function transformVFormImports(
  content: string,
  sourceFile: string,
  _targetFile: string
): string {
  let result = content;
  
  // Determine which subfolder this file is in
  let folder = 'root';
  if (sourceFile.includes('/components/')) {
    folder = 'components';
  } else if (sourceFile.includes('/utils/')) {
    folder = 'utils';
  }
  
  const mappings = VFORM_IMPORT_MAPPINGS[folder] || {};
  
  for (const [from, to] of Object.entries(mappings)) {
    const importPattern = new RegExp(
      `(from\\s+['"])${from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(['"])`,
      'g'
    );
    result = result.replace(importPattern, `$1${to}$2`);
  }
  
  return result;
}

/**
 * Transform relative imports when flattening component folder structure
 * e.g., file-image/FileImage.tsx has `from '../upload'` 
 *       which becomes `from './upload'` when copied to components/ui/file-image.tsx
 */
export function transformRelativeImports(
  content: string, 
  _sourceFile: string,
  _targetFile: string,
  _componentsAlias: string
): string {
  let result = content;
  
  // Apply known mappings
  for (const [from, to] of Object.entries(RELATIVE_IMPORT_MAPPINGS)) {
    // Match import statements with this relative path
    const importPattern = new RegExp(
      `(from\\s+['"])${from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(['"])`,
      'g'
    );
    result = result.replace(importPattern, `$1${to}$2`);
  }
  
  // Transform sibling component imports (../component-name → ./component-name)
  // This handles cases like:
  //   import { Upload } from '../Upload' → import { Upload } from './upload'
  //   import { renderTemplate } from '../list-m2a/render-template' → import { renderTemplate } from './list-m2a/render-template'
  const siblingImportPattern = /from\s+['"](\.\.\/([a-z][-a-z0-9]*)(?:\/([-a-zA-Z0-9]+))?)['"]/g;
  result = result.replace(siblingImportPattern, (_match, _fullPath, componentFolder, subFile) => {
    // Convert to kebab-case and use relative import
    const kebabName = toKebabCase(componentFolder);
    if (subFile) {
      // PascalCase subfile = component entry point → flatten (e.g., ../Upload/Upload → ./upload)
      if (/^[A-Z]/.test(subFile)) {
        return `from './${kebabName}'`;
      }
      // kebab-case subfile = internal module → preserve path (e.g., ../list-m2a/render-template → ./list-m2a/render-template)
      return `from './${kebabName}/${toKebabCase(subFile)}'`;
    }
    return `from './${kebabName}'`;
  });

  return result;
}

/**
 * Extract which @buildpad/* packages are imported
 */
export function extractBuildpadDependencies(content: string): string[] {
  const deps: Set<string> = new Set();
  
  const patterns = [
    /@buildpad\/types/g,
    /@buildpad\/services/g,
    /@buildpad\/hooks/g,
    /@buildpad\/ui-interfaces/g,
    /@buildpad\/ui-collections/g,
  ];

  for (const pattern of patterns) {
    if (pattern.test(content)) {
      const match = pattern.source.match(/@buildpad\/([^/]+)/);
      if (match) {
        // Map package names to lib names
        const libName = match[1].replace('ui-', '');
        if (['types', 'services', 'hooks'].includes(libName)) {
          deps.add(libName);
        }
      }
    }
  }

  return Array.from(deps);
}

/**
 * Add "use client" directive if not present (for Next.js App Router)
 */
export function ensureUseClient(content: string): string {
  const trimmed = content.trim();
  if (trimmed.startsWith('"use client"') || trimmed.startsWith("'use client'")) {
    return content;
  }
  return `"use client";\n\n${content}`;
}

/**
 * Remove "use client" directive if present
 */
export function removeUseClient(content: string): string {
  return content
    .replace(/^["']use client["'];\s*\n*/m, '')
    .trim();
}

/**
 * Generate origin header comment for copied files.
 *
 * The header contains only stable, deterministic fields so that the file hash
 * remains reproducible across machines and time.  The volatile `installedAt`
 * timestamp is recorded in `buildpad.json` only (not in the file).
 *
 * @param componentName - e.g. "input" or "vform/components/VFormField"
 * @param sourcePackage  - e.g. "@buildpad/ui-interfaces"
 * @param version        - semver string of the source package, e.g. "1.4.2"
 * @param sourceSha256   - optional SHA-256 of the untransformed source bytes
 */
export function generateOriginHeader(
  componentName: string,
  sourcePackage: string,
  version: string = '1.0.0',
  sourceSha256?: string
): string {
  const sha256Line = sourceSha256 ? ` * @buildpad-source-sha256 ${sourceSha256}\n` : '';
  return `/**
 * @buildpad-origin ${sourcePackage}/${componentName}
 * @buildpad-version ${version}
${sha256Line} *
 * This file was copied from Buildpad UI Packages.
 * To update, run: npx @buildpad/cli add ${componentName} --overwrite
 *
 * Docs: https://buildpad.dev/components/${componentName}
 */

`;
}

/**
 * Add origin header to file content.
 *
 * @param content       - File content to prepend the header to
 * @param componentName - e.g. "input"
 * @param sourcePackage - e.g. "@buildpad/ui-interfaces"
 * @param version       - semver string
 * @param sourceSha256  - optional SHA-256 of the untransformed source bytes
 */
export function addOriginHeader(
  content: string,
  componentName: string,
  sourcePackage: string,
  version: string = '1.0.0',
  sourceSha256?: string
): string {
  const header = generateOriginHeader(componentName, sourcePackage, version, sourceSha256);
  
  // If file has "use client", insert header after it
  const useClientMatch = content.match(/^(["']use client["'];?\s*\n)/);
  if (useClientMatch) {
    return useClientMatch[1] + header + content.slice(useClientMatch[0].length);
  }
  
  return header + content;
}

/**
 * Strip the Buildpad origin-header block from `content`.
 *
 * Handles both the old format (which included `@buildpad-date`) and the new
 * stable format.  Returns the content unchanged when no header is present.
 *
 * The header is the `/** ... *\/` block that immediately precedes (or follows
 * a "use client" directive) the rest of the file, and contains
 * `@buildpad-origin`.
 */
export function stripOriginHeader(content: string): string {
  // Match an optional "use client" directive, then the JSDoc block containing
  // @buildpad-origin, then any trailing blank lines.
  return content.replace(
    /^(["']use client["'];?\s*\n)?\/\*\*[\s\S]*?@buildpad-origin[\s\S]*?\*\/\s*\n?/,
    '$1'
  );
}

/**
 * Compute a stable SHA-256 hash of a *transformed* file's content.
 *
 * The hash is computed over the file content with:
 *   1. The origin-header block stripped (it contains version info that will
 *      change on every upgrade, so it must not be part of the comparison hash).
 *   2. Line endings normalised to LF (`\n`).
 *   3. A single trailing newline appended (ensures the hash is stable
 *      regardless of whether the editor added one or not).
 *
 * This is the value stored in `buildpad.json` under
 * `components[name].files[].sha256` so that `outdated`/`upgrade` can detect
 * whether the consumer has modified the file locally.
 */
export function hashTransformed(content: string): string {
  const stripped = stripOriginHeader(content);
  // Normalise CRLF → LF
  const normalised = stripped.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  // Ensure exactly one trailing newline
  const withTrailingNewline = normalised.trimEnd() + '\n';
  return sha256(withTrailingNewline);
}

/**
 * Check if file has buildpad origin header
 */
export function hasBuildpadOrigin(content: string): boolean {
  return content.includes('@buildpad-origin');
}

/**
 * Extract origin info from file header.
 *
 * Compatible with both the old format (which had `@buildpad-date`) and the
 * new stable format.  `date` is included for backward-compat but will be
 * `undefined` for files written by CLI >= v2 (it is stored in buildpad.json
 * instead).
 */
export function extractOriginInfo(content: string): {
  origin?: string;
  version?: string;
  sourceSha256?: string;
  /** @deprecated Recorded in buildpad.json since CLI v2. Not present in new-style headers. */
  date?: string;
} | null {
  const originMatch = content.match(/@buildpad-origin\s+([^\n*]+)/);
  const versionMatch = content.match(/@buildpad-version\s+([^\n*]+)/);
  const sha256Match = content.match(/@buildpad-source-sha256\s+([^\n*]+)/);
  const dateMatch = content.match(/@buildpad-date\s+([^\n*]+)/);
  
  if (!originMatch) return null;
  
  return {
    origin: originMatch[1].trim(),
    version: versionMatch?.[1].trim(),
    sourceSha256: sha256Match?.[1].trim(),
    date: dateMatch?.[1].trim(),
  };
}
