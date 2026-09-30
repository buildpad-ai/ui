/**
 * @buildpad/services/auth
 * 
 * Authentication and authorization utilities for DaaS applications.
 * Provides reusable session management, permission enforcement, and filter utilities.
 * 
 * @module @buildpad/services/auth
 */

export {
  // Configuration
  configureAuth,
  getAuthConfig,
  // Session management
  createAuthenticatedClient,
  getCurrentUser,
  isAdmin,
  getUserRole,
  getUserProfile,
  getAccountability,
  isAuthenticationError,
  // Error types
  AuthenticationError,
  // Types
  type AuthClientConfig,
  type AuthenticatedClient,
  type AccountabilityInfo,
} from './session';

export {
  enforcePermission,
  getAccessibleFields,
  getUserPermissions,
  validateFieldsAccess,
  filterFields,
  filterFieldsArray,
  filterResponseFields,
  isFieldAccessible,
  getPermissionFilters,
  applyFilterToQuery,
  resolveFilterDynamicValues,
  PermissionError,
  UnsupportedPermissionFilterError,
  type PermissionCheck,
  type PermissionDetails,
  type FilterObject,
} from './enforcer';

export {
  applyFilter,
  applyFieldOperators,
  assertPermissionFilterSupported,
  isUnsupportedPermissionFilterError,
  type DynamicVariableContext,
  type QueryBuilder,
  type UnsupportedPermissionFilterReason,
  FILTER_OPERATORS,
} from './filter-to-query';
