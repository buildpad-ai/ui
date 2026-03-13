/**
 * Buildpad Services
 *
 * Re-exports all service classes.
 * This file is copied to your project and can be customized.
 */

export { apiRequest, type ApiRequestOptions } from "./api-request";
export { CollectionsService, createCollectionsService } from "./collections";
export { FieldsService, createFieldsService } from "./fields";
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
} from "./daas-context";
