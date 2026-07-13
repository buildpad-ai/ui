/**
 * Pure helpers shared by the detail surfaces — kept dependency-free (no
 * Mantine/React imports) so they're trivial to unit test, mirroring
 * `userDisplay.ts`.
 */
import type { Role, User } from '@buildpad/types';

/**
 * Normalize the M2M `roles` value on a user to an array of role ID strings.
 * Entries may be flattened `{id,name,icon}` role objects (list/create
 * responses), junction rows shaped `{ id, role_id: '<uuid>' | { id, ... } }`
 * (detail fetched with `fields=*,roles.*`), or bare role-ID strings —
 * depending on the `fields` projection the record was fetched with.
 *
 * NOTE: a detail GET *without* a `fields` param returns bare junction-row
 * IDs, which are NOT role IDs — always fetch with `fields=*,roles.*` before
 * normalizing (see `UserDetail`).
 */
export function normalizeRoleIds(roles: User['roles']): string[] {
  if (!Array.isArray(roles)) return [];
  return roles
    .map((entry) => {
      if (typeof entry === 'string') return entry;
      if (entry && typeof entry === 'object') {
        const roleId = (entry as { role_id?: string | { id?: string } }).role_id;
        if (typeof roleId === 'string') return roleId;
        if (roleId?.id) return roleId.id;
        if (entry.id) return entry.id;
      }
      return null;
    })
    .filter((id): id is string => Boolean(id));
}

/** True when `pattern` compiles as a JavaScript regular expression. */
export function isValidRegex(pattern: string): boolean {
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}

/**
 * Options for a parent-role select: every role except the role being edited
 * (a role cannot be its own parent). Matches the buildpad-daas reference
 * behavior.
 */
export function parentRoleOptions(
  roles: Role[],
  currentRoleId: string | null
): Array<{ value: string; label: string }> {
  return roles
    .filter((role) => role.id !== currentRoleId)
    .map((role) => ({ value: role.id, label: role.name }));
}

/**
 * Roles whose `parent` is the given role. The DaaS API exposes no reverse
 * relation for `role.children`, so the hierarchy is derived client-side from
 * the same roles list the parent-role select already fetches.
 */
export function childRolesOf(roles: Role[], roleId: string | null): Role[] {
  if (!roleId) return [];
  return roles.filter((role) => role.parent === roleId);
}

/**
 * True when `value` is a backend-concealed token: the DaaS API masks
 * `daas_users.token` as all-asterisks (`**********`) in every read response,
 * so an asterisks-only value means "a token is securely saved" and its
 * plaintext can never be shown again.
 */
export function isConcealedToken(value: string | null | undefined): boolean {
  return !!value && /^\*+$/.test(value);
}

/**
 * Cycle a Directus-style list sort through a column's states:
 * unsorted → `field` (asc) → `-field` (desc) → unsorted. Clicking a
 * different column always starts back at ascending on that column.
 */
export function toggleSort(current: string | null, field: string): string | null {
  if (current === field) return `-${field}`;
  if (current === `-${field}`) return null;
  return field;
}

/** Generate a random static API token (hex, default 32 bytes → 64 chars). */
export function generateToken(bytes = 32): string {
  const buffer = new Uint8Array(bytes);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(buffer);
  } else {
    for (let i = 0; i < bytes; i++) buffer[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(buffer, (b) => b.toString(16).padStart(2, '0')).join('');
}
