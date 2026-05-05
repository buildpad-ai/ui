/**
 * usePermissions Hook
 * 
 * Client-side permissions hook following DaaS architecture.
 * Fetches and caches field-level and action-level permissions from the API.
 * 
 * Mirrors the server-side permission enforcement from:
 * - lib/permissions/enforcer.ts (enforcePermission, getAccessibleFields)
 * - Database functions (check_permission, get_user_permission_fields)
 * 
 * @module @buildpad/hooks/usePermissions
 */

import { useState, useEffect, useCallback } from 'react';
import { useDaaSContext } from './useDaaSContext';

/**
 * Permission action types (matches DaaS actions)
 */
export type PermissionAction = 'create' | 'read' | 'update' | 'delete' | 'share';

/**
 * Permission details for a specific action
 */
export interface PermissionDetails {
  /** Allowed field names, or ['*'] for all fields */
  fields: string[];
  /** Item-level filter rules (null for no filter) */
  permissions: Record<string, unknown> | null;
  /** Validation rules */
  validation?: Record<string, unknown> | null;
  /** Preset values */
  presets?: Record<string, unknown> | null;
}

/**
 * Collection permissions by action
 */
export interface CollectionPermissions {
  create?: PermissionDetails;
  read?: PermissionDetails;
  update?: PermissionDetails;
  delete?: PermissionDetails;
  share?: PermissionDetails;
}

/**
 * Permissions for current user (from /api/permissions/me)
 */
export interface UserPermissions {
  /** Permissions by collection and action */
  data: Record<string, Record<string, unknown>>;
  /** Whether user is admin (bypasses all checks) */
  isAdmin: boolean;
}

/**
 * usePermissions state
 */
export interface PermissionsState {
  /** Whether user is admin */
  isAdmin: boolean;
  /** Whether permissions are loading */
  loading: boolean;
  /** Error if any */
  error: string | null;
  /** Cached permissions by collection */
  permissions: Record<string, CollectionPermissions>;
}

/**
 * usePermissions methods
 */
export interface PermissionsMethods {
  /** Check if user can perform action on collection */
  canPerform: (collection: string, action: PermissionAction) => boolean;
  /** Get accessible fields for a collection and action */
  getAccessibleFields: (collection: string, action: PermissionAction) => string[];
  /** Check if a specific field is accessible */
  isFieldAccessible: (collection: string, action: PermissionAction, field: string) => boolean;
  /** Filter fields based on permissions */
  filterFields: <T extends string>(collection: string, action: PermissionAction, fields: T[]) => T[];
  /** Fetch permissions for a collection */
  fetchCollectionPermissions: (collection: string) => Promise<CollectionPermissions | null>;
  /** Refresh all permissions */
  refresh: () => Promise<void>;
}

/**
 * usePermissions return type
 */
export interface UsePermissionsReturn extends PermissionsState, PermissionsMethods {}

/**
 * usePermissions options
 */
export interface UsePermissionsOptions {
  /** Collections to pre-fetch permissions for */
  collections?: string[];
  /** Auto-fetch on mount */
  autoFetch?: boolean;
  /** Static token for authentication */
  token?: string;
}

/**
 * usePermissions - Client-side permissions hook
 * 
 * Provides permission checking based on DaaS RBAC system.
 * Fetches permissions from API and caches them for efficient lookups.
 * 
 * @example
 * ```tsx
 * // Basic usage
 * const { canPerform, isAdmin, getAccessibleFields } = usePermissions();
 * 
 * if (canPerform('articles', 'update')) {
 *   // Show edit button
 * }
 * 
 * const editableFields = getAccessibleFields('articles', 'update');
 * 
 * // Pre-fetch specific collections
 * const { permissions } = usePermissions({ 
 *   collections: ['articles', 'users'] 
 * });
 * ```
 */
export function usePermissions(options: UsePermissionsOptions = {}): UsePermissionsReturn {
  const { collections = [], autoFetch = true, token } = options;
  
  // Get DaaS context
  const daasContext = useDaaSContext();
  
  // State
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(autoFetch);
  const [error, setError] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<Record<string, CollectionPermissions>>({});
  const [globalPermissions, setGlobalPermissions] = useState<UserPermissions | null>(null);
  
  // Build API URL helper
  // In direct mode, prepend the DaaS base URL but PRESERVE the `/api` prefix.
  // Stripping `/api` previously routed `/permissions/me` to a DaaS UI path that
  // 307-redirects to /auth/login, returning HTML and breaking JSON parsing
  // (causing isAdmin to silently fall back to false).
  const buildUrl = useCallback((path: string): string => {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    if (daasContext?.isDirectMode && daasContext.config) {
      const baseUrl = daasContext.config.url.replace(/\/$/, '');
      return `${baseUrl}${cleanPath}`;
    }
    return cleanPath;
  }, [daasContext]);
  
  // Get headers helper
  const getHeaders = useCallback((): Record<string, string> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    const effectiveToken = token ?? daasContext?.config?.token;
    if (effectiveToken) {
      headers['Authorization'] = `Bearer ${effectiveToken}`;
    }
    
    return headers;
  }, [token, daasContext?.config?.token]);
  
  // Fetch global permissions (/api/permissions/me)
  const fetchGlobalPermissions = useCallback(async (): Promise<UserPermissions | null> => {
    try {
      const url = buildUrl('/api/permissions/me');
      const response = await fetch(url, {
        headers: getHeaders(),
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch permissions: ${response.status}`);
      }
      
      const data = await response.json();
      return {
        data: data.data || {},
        isAdmin: data.isAdmin ?? false,
      };
    } catch (err) {
      console.error('Error fetching permissions:', err);
      throw err;
    }
  }, [buildUrl, getHeaders]);
  
  // Fetch collection-specific permissions
  const fetchCollectionPermissions = useCallback(async (
    collection: string
  ): Promise<CollectionPermissions | null> => {
    try {
      const url = buildUrl(`/api/permissions/${collection}`);
      const response = await fetch(url, {
        headers: getHeaders(),
        credentials: 'include',
      });
      
      if (!response.ok) {
        if (response.status === 403) {
          // No permissions for this collection
          return {};
        }
        throw new Error(`Failed to fetch permissions: ${response.status}`);
      }
      
      const data = await response.json();
      const collectionPerms = data.data || {};
      
      // Cache the permissions
      setPermissions((prev) => ({
        ...prev,
        [collection]: collectionPerms,
      }));
      
      return collectionPerms;
    } catch (err) {
      console.error(`Error fetching permissions for ${collection}:`, err);
      return null;
    }
  }, [buildUrl, getHeaders]);
  
  // Refresh all permissions
  const refresh = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch global permissions
      const global = await fetchGlobalPermissions();
      setGlobalPermissions(global);
      setIsAdmin(global?.isAdmin ?? false);
      
      // If admin, no need to fetch individual collection permissions
      if (global?.isAdmin) {
        setLoading(false);
        return;
      }
      
      // Fetch permissions for specified collections
      if (collections.length > 0) {
        await Promise.all(collections.map(fetchCollectionPermissions));
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch permissions';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [fetchGlobalPermissions, fetchCollectionPermissions, collections]);
  
  // Check if user can perform action
  const canPerform = useCallback((
    collection: string,
    action: PermissionAction
  ): boolean => {
    // Admin can do everything
    if (isAdmin) return true;
    
    // Check global permissions
    if (globalPermissions?.data?.[collection]?.[action]) {
      return true;
    }
    
    // Check cached collection permissions
    const collectionPerms = permissions[collection];
    if (collectionPerms?.[action]) {
      return true;
    }
    
    return false;
  }, [isAdmin, globalPermissions, permissions]);
  
  // Get accessible fields for action
  const getAccessibleFields = useCallback((
    collection: string,
    action: PermissionAction
  ): string[] => {
    // Admin can access all fields
    if (isAdmin) return ['*'];
    
    // Check cached permissions
    const collectionPerms = permissions[collection];
    const actionPerms = collectionPerms?.[action];
    
    if (actionPerms?.fields) {
      return actionPerms.fields;
    }
    
    // Default to empty (no access)
    return [];
  }, [isAdmin, permissions]);
  
  // Check if specific field is accessible
  const isFieldAccessible = useCallback((
    collection: string,
    action: PermissionAction,
    field: string
  ): boolean => {
    const fields = getAccessibleFields(collection, action);
    
    // Wildcard means all fields
    if (fields.includes('*')) return true;
    
    return fields.includes(field);
  }, [getAccessibleFields]);
  
  // Filter fields based on permissions
  const filterFields = useCallback(<T extends string>(
    collection: string,
    action: PermissionAction,
    fields: T[]
  ): T[] => {
    const accessibleFields = getAccessibleFields(collection, action);
    
    // Wildcard means all fields
    if (accessibleFields.includes('*')) return fields;
    
    // No permissions means no fields
    if (accessibleFields.length === 0) return [];
    
    // Filter to accessible fields
    const accessibleSet = new Set(accessibleFields);
    return fields.filter((f) => accessibleSet.has(f));
  }, [getAccessibleFields]);
  
  // Auto-fetch on mount and whenever the collections list changes.
  // Including `refresh` (which depends on `collections`) ensures permissions
  // are re-fetched when relation info resolves asynchronously — e.g. ListM2M
  // mounts with collections:[] while relationInfo is loading, then the list
  // becomes ['junction', 'related'] once it resolves. Without this dep,
  // non-admin users with valid permissions would never have their collection
  // permissions fetched, leaving allowSelect/allowCreate permanently false.
  useEffect(() => {
    if (autoFetch) {
      refresh();
    }
  }, [autoFetch, refresh]);
  
  return {
    // State
    isAdmin,
    loading,
    error,
    permissions,
    // Methods
    canPerform,
    getAccessibleFields,
    isFieldAccessible,
    filterFields,
    fetchCollectionPermissions,
    refresh,
  };
}

export default usePermissions;
