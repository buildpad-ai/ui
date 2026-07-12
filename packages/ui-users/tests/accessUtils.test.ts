/**
 * Pure helper unit tests: M2M roles normalization, scope-pattern regex
 * validation, parent-role option exclusion, role hierarchy derivation,
 * token generation/concealment, and sort cycling.
 */
import { describe, it, expect } from 'vitest';
import type { Role } from '@buildpad/types';
import {
  childRolesOf,
  generateToken,
  isConcealedToken,
  isValidRegex,
  normalizeRoleIds,
  parentRoleOptions,
  toggleSort,
} from '../src/accessUtils';

describe('normalizeRoleIds', () => {
  it('passes through bare ID strings', () => {
    expect(normalizeRoleIds(['role-a', 'role-b'])).toEqual(['role-a', 'role-b']);
  });

  it('extracts IDs from flattened role objects', () => {
    expect(
      normalizeRoleIds([
        { id: 'role-a', name: 'Admin' },
        { id: 'role-b', name: 'Editor', icon: 'edit' },
      ])
    ).toEqual(['role-a', 'role-b']);
  });

  it('extracts IDs from junction rows shaped { id, role_id: {...} }', () => {
    expect(
      normalizeRoleIds([
        { id: 'junction-1', role_id: { id: 'role-a', name: 'Admin' } } as never,
      ])
    ).toEqual(['role-a']);
  });

  it('extracts IDs from junction rows where role_id is a bare string (fields=*,roles.*)', () => {
    expect(
      normalizeRoleIds([
        { id: 'junction-1', role_id: 'role-a', user_id: 'user-1', sort: 0 } as never,
      ])
    ).toEqual(['role-a']);
  });

  it('handles mixed shapes and drops unusable entries', () => {
    expect(
      normalizeRoleIds([
        'role-a',
        { id: 'role-b', name: 'Editor' },
        {} as never,
      ])
    ).toEqual(['role-a', 'role-b']);
  });

  it('returns an empty array for undefined and non-array input', () => {
    expect(normalizeRoleIds(undefined)).toEqual([]);
  });
});

describe('isValidRegex', () => {
  it('accepts valid patterns', () => {
    expect(isValidRegex('^/tenant:.*$')).toBe(true);
    expect(isValidRegex('')).toBe(true);
  });

  it('rejects invalid patterns', () => {
    expect(isValidRegex('[unclosed')).toBe(false);
    expect(isValidRegex('(unbalanced')).toBe(false);
  });
});

describe('parentRoleOptions', () => {
  const roles: Role[] = [
    { id: 'role-a', name: 'Admin' },
    { id: 'role-b', name: 'Editor' },
    { id: 'role-c', name: 'Viewer' },
  ];

  it('excludes the role being edited (a role cannot be its own parent)', () => {
    expect(parentRoleOptions(roles, 'role-b')).toEqual([
      { value: 'role-a', label: 'Admin' },
      { value: 'role-c', label: 'Viewer' },
    ]);
  });

  it('includes every role when creating (no current ID)', () => {
    expect(parentRoleOptions(roles, null)).toHaveLength(3);
  });
});

describe('childRolesOf', () => {
  const roles: Role[] = [
    { id: 'role-a', name: 'Content Manager' },
    { id: 'role-b', name: 'Editor', parent: 'role-a' },
    { id: 'role-c', name: 'Reviewer', parent: 'role-a' },
    { id: 'role-d', name: 'Viewer', parent: 'role-b' },
  ];

  it('returns only roles whose parent is the given role', () => {
    expect(childRolesOf(roles, 'role-a').map((r) => r.id)).toEqual(['role-b', 'role-c']);
  });

  it('returns an empty array for a leaf role', () => {
    expect(childRolesOf(roles, 'role-d')).toEqual([]);
  });

  it('returns an empty array when the role ID is null (create mode)', () => {
    expect(childRolesOf(roles, null)).toEqual([]);
  });
});

describe('isConcealedToken', () => {
  it('detects the backend all-asterisks masking', () => {
    expect(isConcealedToken('**********')).toBe(true);
    expect(isConcealedToken('*')).toBe(true);
  });

  it('rejects plaintext, empty, and nullish values', () => {
    expect(isConcealedToken('abc123')).toBe(false);
    expect(isConcealedToken('**abc**')).toBe(false);
    expect(isConcealedToken('')).toBe(false);
    expect(isConcealedToken(null)).toBe(false);
    expect(isConcealedToken(undefined)).toBe(false);
  });
});

describe('generateToken', () => {
  it('produces a hex string of 2 chars per byte', () => {
    const token = generateToken(32);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces distinct values across calls', () => {
    expect(generateToken()).not.toBe(generateToken());
  });
});

describe('toggleSort', () => {
  it('cycles unsorted → asc → desc → unsorted on the same field', () => {
    expect(toggleSort(null, 'email')).toBe('email');
    expect(toggleSort('email', 'email')).toBe('-email');
    expect(toggleSort('-email', 'email')).toBeNull();
  });

  it('switching to a different field starts at ascending', () => {
    expect(toggleSort('email', 'status')).toBe('status');
    expect(toggleSort('-email', 'status')).toBe('status');
  });
});
