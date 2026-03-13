/**
 * @buildpad/hooks
 * 
 * Shared React hooks for Buildpad projects.
 * DaaS-compatible relation hooks for M2M, M2O, O2M relationships.
 * Authentication and permission hooks following DaaS architecture.
 */

// Authentication & Authorization hooks (DaaS-compatible)
export {
  useAuth,
  type AuthUser,
  type AuthState,
  type AuthMethods,
  type UseAuthOptions,
  type UseAuthReturn,
} from './useAuth';
export {
  usePermissions,
  type PermissionAction,
  type PermissionDetails,
  type CollectionPermissions,
  type UserPermissions,
  type PermissionsState,
  type PermissionsMethods,
  type UsePermissionsOptions,
  type UsePermissionsReturn,
} from './usePermissions';
export {
  useDaaSContext,
  useIsDaaSReady,
  useIsDirectDaaSMode,
  DaaSProvider,
  type DaaSConfig,
  type DaaSContextValue,
  type DaaSProviderProps,
  type DaaSUser,
} from './useDaaSContext';

// Relation hooks
export { useRelationM2M, type M2MRelationInfo } from './useRelationM2M';
export { useRelationM2MItems, type M2MItem, type M2MQueryParams } from './useRelationM2MItems';
export { useRelationM2O, useRelationM2OItem, type M2ORelationInfo, type M2OItem } from './useRelationM2O';
export { useRelationO2M, useRelationO2MItems, type O2MRelationInfo, type O2MItem, type O2MQueryParams } from './useRelationO2M';
export { 
    useRelationM2A, 
    useRelationM2AItems, 
    type M2ARelationInfo, 
    type M2AItem, 
    type M2AQueryParams,
    type ChangesItem,
} from './useRelationM2A';
export {
    useRelationPermissionsM2A,
    type RelationPermissionsM2A,
    type PerCollectionPermission,
} from './useRelationPermissionsM2A';
export {
    useRelationMultipleM2M,
    type M2MDisplayItem,
    type M2MChangesItem,
    type M2MMultipleQueryParams,
} from './useRelationMultipleM2M';
export {
    useRelationPermissionsM2M,
    type RelationPermissionsM2M,
} from './useRelationPermissionsM2M';
export {
    useRelationPermissionsM2O,
    type RelationPermissionsM2O,
} from './useRelationPermissionsM2O';

// File hooks
export { 
    useFiles, 
    type FileUpload, 
    type FileUploadOptions, 
    type DaaSFile 
} from './useFiles';

// Selection & Preset hooks
export { 
    useSelection, 
    type UseSelectionOptions, 
    type UseSelectionReturn 
} from './useSelection';
export { 
    usePreset, 
    type UsePresetOptions, 
    type UsePresetReturn,
    type Filter,
    type Query
} from './usePreset';

// Navigation guard hooks (DaaS-style)
export { 
    useEditsGuard, 
    useHasEdits,
    type UseEditsGuardOptions, 
    type UseEditsGuardReturn 
} from './useEditsGuard';

// Clipboard and Storage hooks (DaaS-style)
export {
    useClipboard,
    type UseClipboardOptions,
    type UseClipboardReturn
} from './useClipboard';
export {
    useLocalStorage,
    type LocalStorageValue,
    type UseLocalStorageOptions,
    type UseLocalStorageReturn
} from './useLocalStorage';

// Versioning hooks (DaaS workflow + content versioning)
export {
    useVersions,
    type ContentVersion,
    type UseVersionsOptions,
    type UseVersionsReturn
} from './useVersions';
export {
    useWorkflowAssignment,
    type WorkflowAssignment,
    type UseWorkflowAssignmentReturn
} from './useWorkflowAssignment';
export {
    useWorkflowVersioning,
    type WorkflowState,
    type WorkflowInstance,
    type UseWorkflowVersioningOptions,
    type UseWorkflowVersioningProps,
    type UseWorkflowVersioningReturn
} from './useWorkflowVersioning';

// Field metadata hook
export {
    useFieldMetadata,
    type FieldMetadataEntry,
    type UseFieldMetadataOptions,
    type UseFieldMetadataReturn,
} from './useFieldMetadata';

// API helpers
export { api, daasAPI, createDaaSAPI, type DaaSAPIConfig, type QueryParams } from './api';

// Re-export types for convenience
export type { Relation, RelationMeta, RelationSchema, RelationCollectionMeta, RelationFieldInfo } from '@buildpad/types';

// Collection navigation hooks
export {
    useCollections,
    type CollectionTreeNode,
    type UseCollectionsOptions,
    type UseCollectionsReturn
} from './useCollections';

// Utility functions
export { apiRequest, isValidPrimaryKey } from './utils';
