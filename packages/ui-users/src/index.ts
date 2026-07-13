/**
 * @buildpad/ui-users
 *
 * Users, roles, and policies administration UI for Buildpad projects — the
 * full RBAC management surface (list + detail for each of the three
 * interdependent access-control domains) built with Mantine v8 and the
 * @buildpad/hooks data layer.
 *
 * Navigation is prop-injected (`onUserClick`, `onBack`, `onSaved`, …) so the
 * components work in any React app; see the `users-routes` CLI templates for
 * the Next.js wiring.
 */

// Users surfaces
export { UsersManager } from './UsersManager';
export type { UsersManagerProps } from './UsersManager';

export { UserDetail } from './UserDetail';
export type { UserDetailProps } from './UserDetail';

export { UserPoliciesManager } from './UserPoliciesManager';
export type { UserPoliciesManagerProps } from './UserPoliciesManager';

// Roles surfaces
export { RolesManager } from './RolesManager';
export type { RolesManagerProps } from './RolesManager';

export { RoleDetail } from './RoleDetail';
export type { RoleDetailProps, RoleSaveAction } from './RoleDetail';

export { RoleUsersManager } from './RoleUsersManager';
export type { RoleUsersManagerProps } from './RoleUsersManager';

export { RolePoliciesManager } from './RolePoliciesManager';
export type { RolePoliciesManagerProps } from './RolePoliciesManager';

// Policies surfaces
export { PoliciesManager } from './PoliciesManager';
export type { PoliciesManagerProps } from './PoliciesManager';

export { PolicyDetail } from './PolicyDetail';
export type { PolicyDetailProps } from './PolicyDetail';

export { PolicyAttachmentManager } from './PolicyAttachmentManager';
export type { PolicyAttachmentManagerProps } from './PolicyAttachmentManager';

// Shared presentational components
export { UserStatusBadge, USER_STATUS_COLORS } from './UserStatusBadge';
export type { UserStatusBadgeProps } from './UserStatusBadge';

export { UserAvatar } from './UserAvatar';
export type { UserAvatarProps } from './UserAvatar';

export { InfoPanel } from './InfoPanel';
export type { InfoPanelProps, InfoPanelItem } from './InfoPanel';

export { DeleteConfirmModal } from './DeleteConfirmModal';
export type { DeleteConfirmModalProps } from './DeleteConfirmModal';

export { PolicyPickerModal } from './PolicyPickerModal';
export type { PolicyPickerModalProps } from './PolicyPickerModal';

// Re-exported from @buildpad/ui-interfaces so lists render icons from the
// same map the SelectIcon picker offers (no drift between pick and display).
export { IconDisplay } from '@buildpad/ui-interfaces/select-icon';
export type { IconDisplayProps } from '@buildpad/ui-interfaces/select-icon';

export { SortableTh } from './SortableTh';
export type { SortableThProps } from './SortableTh';

export { SearchInput } from './SearchInput';
export type { SearchInputProps } from './SearchInput';

export { ListFooter } from './ListFooter';
export type { ListFooterProps } from './ListFooter';

export { ListEmptyState } from './ListEmptyState';
export type { ListEmptyStateProps } from './ListEmptyState';

export { RowActionsMenu } from './RowActionsMenu';
export type { RowActionsMenuProps } from './RowActionsMenu';

export { TokenInput } from './TokenInput';
export type { TokenInputProps } from './TokenInput';

// Pure display helpers
export { getUserInitials, getUserDisplayName } from './userDisplay';
export type { UserDisplayFields } from './userDisplay';

export {
  childRolesOf,
  generateToken,
  isConcealedToken,
  isValidRegex,
  normalizeRoleIds,
  parentRoleOptions,
  toggleSort,
} from './accessUtils';
