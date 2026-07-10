/**
 * Checksum utilities for Buildpad CLI
 *
 * Provides stable SHA-256 hashing for component files.
 * The hash is always computed over the file content WITHOUT the origin-header
 * block, with line endings normalised to LF and a guaranteed trailing newline.
 * This makes the hash independent of the platform and the install date.
 */

import { createHash } from 'crypto';

/**
 * Return the SHA-256 hex digest of `data`.
 */
export function sha256(data: string): string {
  return createHash('sha256').update(data, 'utf8').digest('hex');
}

/**
 * Infer the owning source package for a registry-relative file path.
 *
 * Examples:
 *   "ui-interfaces/src/input/Input.tsx"        → "@buildpad/ui-interfaces"
 *   "hooks/src/useAuth.ts"                     → "@buildpad/hooks"
 *   "cli/templates/lib/common-utils.ts"        → "@buildpad/cli"
 */
export function inferSourcePackage(source: string): string {
  if (source.startsWith('ui-interfaces/'))   return '@buildpad/ui-interfaces';
  if (source.startsWith('ui-form/'))         return '@buildpad/ui-form';
  if (source.startsWith('ui-table/'))        return '@buildpad/ui-table';
  if (source.startsWith('ui-collections/'))  return '@buildpad/ui-collections';
  if (source.startsWith('ui-files/'))        return '@buildpad/ui-files';
  if (source.startsWith('hooks/'))           return '@buildpad/hooks';
  if (source.startsWith('services/'))        return '@buildpad/services';
  if (source.startsWith('types/'))           return '@buildpad/types';
  if (source.startsWith('utils/'))           return '@buildpad/utils';
  return '@buildpad/cli';
}

/** Compare semver strings — returns true if a >= b. */
export function semverGte(a: string, b: string): boolean {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na !== nb) return na > nb;
  }
  return true; // equal
}

/**
 * Resolve a per-package version from a v2 registry, with sensible fallbacks.
 *
 * Order: registry.packages[pkg].version → fallbackVersion → '0.0.0'
 */
export function resolvePackageVersion(
  registry: { packages?: Record<string, { version: string }>; version?: string },
  sourcePackage: string,
  fallbackVersion?: string
): string {
  return (
    registry.packages?.[sourcePackage]?.version ??
    fallbackVersion ??
    registry.version ??
    '0.0.0'
  );
}
