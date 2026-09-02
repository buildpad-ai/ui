/**
 * @buildpad/services
 *
 * Shared service classes for Buildpad projects.
 * DaaS-compatible CRUD services for items, fields, collections.
 * Authentication follows DaaS architecture with multiple auth methods.
 */

export { apiRequest, type ApiRequestOptions } from "./api-request";
export {
  CollectionsService,
  createCollectionsService,
  FORM_BUILDER_COLLECTION_PREFIX,
  normalizeCollectionName,
  fullBaselineFields,
} from "./collections";
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
export {
  ModuleAccessKeysService,
  createModuleAccessKeysService,
  buildModuleAccessTree,
  leafModuleAccessKeys,
  MODULE_ACCESS_KEYS_COLLECTION,
  type ModuleAccessKeyInput,
} from "./module-access-keys";

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
  useDaaSContextOptional,
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

// Component i18n provider — locale, dictionary and formatting for every
// Buildpad component. Holds no auth state, so it belongs in the ROOT layout.
export {
  BuildpadI18nProvider,
  BUILDPAD_I18N_DEFAULT_TIMEZONE,
  useBuildpadI18n,
  useBuildpadI18nOptional,
  useBuildpadTranslations,
  type BuildpadI18nContextValue,
  type BuildpadI18nProviderProps,
  type DateInput,
} from "./buildpad-i18n-context";
