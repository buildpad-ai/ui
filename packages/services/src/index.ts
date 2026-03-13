/**
 * @buildpad/services
 *
 * Shared service classes for Buildpad projects.
 * DaaS-compatible CRUD services for items, fields, collections.
 * Authentication follows DaaS architecture with multiple auth methods.
 */

export { apiRequest, type ApiRequestOptions } from "./api-request";
export { CollectionsService, createCollectionsService } from "./collections";
export { FieldsService, createFieldsService } from "./fields";
export {
  ItemsService,
  createItemsService,
  type ItemsQuery,
  type ItemsResponse,
} from "./items";
export {
  PermissionsService,
  createPermissionsService,
  type CollectionAccess,
  type CollectionActionAccess,
  type FieldPermissions,
} from "./permissions";

// DaaS Context Provider — browser calls DaaS directly, no Next.js proxy needed.
// CORS is handled on the DaaS side via CORS_ORIGINS env variable.
export {
  DaaSProvider,
  buildApiUrl,
  getApiHeaders,
  getApiHeadersAsync,
  getGlobalDaaSConfig,
  setGlobalDaaSConfig,
  useDaaSContext,
  useIsDaaSReady,
  useIsDirectDaaSMode,
  type DaaSConfig,
  type DaaSContextValue,
  type DaaSProviderProps,
  type DaaSUser,
} from "./daas-context";

// Auth module - server-side authentication and authorization utilities
export {
  AuthenticationError,
  FILTER_OPERATORS,
  PermissionError,
  applyFieldOperators,
  applyFilter,
  // Filter utilities
  applyFilterToQuery,
  // Session management
  configureAuth,
  createAuthenticatedClient,
  // Permission enforcement
  enforcePermission,
  filterFields,
  filterFieldsArray,
  filterResponseFields,
  getAccessibleFields,
  getAccountability,
  getCurrentUser,
  getPermissionFilters,
  getUserPermissions,
  getUserProfile,
  getUserRole,
  isAdmin,
  isAuthenticationError,
  isFieldAccessible,
  resolveFilterDynamicValues,
  validateFieldsAccess,
  type AccountabilityInfo,
  type AuthClientConfig,
  type AuthenticatedClient,
  type FilterObject,
  type PermissionCheck,
  type PermissionDetails,
  type QueryBuilder,
} from "./auth";
