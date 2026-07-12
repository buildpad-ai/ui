/**
 * Pure display helpers shared by `UserAvatar`, `UsersManager`, and
 * `RoleUsersManager` — kept dependency-free (no Mantine/React import) so
 * they're trivial to unit test.
 */
import type { User } from '@buildpad/types';

/** The subset of `User` needed to derive initials/display name/avatar. */
export type UserDisplayFields = Pick<User, 'first_name' | 'last_name' | 'email' | 'avatar'>;

/**
 * Derive avatar initials for a user: first+last initial when both names are
 * present, otherwise the first two characters of the email, otherwise `?`.
 * Matches the buildpad-daas `getUserInitials` reference behavior.
 */
export function getUserInitials(user: UserDisplayFields): string {
  if (user.first_name && user.last_name) {
    return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();
  }
  return user.email ? user.email.slice(0, 2).toUpperCase() : '?';
}

/**
 * Derive a display name for a user: "First Last" when either name part is
 * present, otherwise the email. Matches the buildpad-daas `getUserName`
 * reference behavior.
 */
export function getUserDisplayName(user: UserDisplayFields): string {
  if (user.first_name || user.last_name) {
    return `${user.first_name || ''} ${user.last_name || ''}`.trim();
  }
  return user.email;
}
