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

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { ModuleAccessMap } from '@buildpad/types';
import { useDaaSContext } from './useDaaSContext';

/** Stable empty map so `moduleAccess` keeps a constant identity until loaded. */
const EMPTY_MODULE_ACCESS: ModuleAccessMap = {};

/**
 * Read the active scope URI from the `daas_resource_uri` cookie.
 *
 * DaaS resolves `/permissions/me` against the active Resource URI, so a change
 * here must trigger a refetch — otherwise a tenant switch leaves the previous
 * tenant's permissions in state. The header itself is attached by the
 * provider's `getHeaders()`; this only observes the value.
 */
function readActiveScope(): string | null {
  if (typeof document === 'undefined') return null;
  const match = /(?:^|;\s*)daas_resource_uri=([^;]*)/.exec(document.cookie);
  if (!match) return null;
  const value = decodeURIComponent(match[1]).trim();
  return value === '' ? null : value;
}

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
  /**
   * OR-merged module-level access keys. Granted keys only — DaaS drops `false`
   * when merging across policies. `null` when the fetch failed, which keeps
   * `hasModuleAccess` failing closed.
   */
  moduleAccess: ModuleAccessMap | null;
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
  /**
   * Resolved module-level access keys for the current user at the active scope.
   * `{}` until loaded or when the fetch failed. Contains granted keys only.
   */
  moduleAccess: ModuleAccessMap;
}

/**
 * usePermissions methods
 */
export interface PermissionsMethods {
  /** Check if user can perform action on collection */
  canPerform: (collection: string, action: PermissionAction) => boolean;
  /**
   * Check whether the user holds a module-level access key.
   *
   * Admins hold every key. **Fails closed** — returns `false` while loading and
   * on error, deliberately unlike `canPerform`, which is optimistic. A
   * capability flag gates something the user is presumed *not* to have, so an
   * unresolved state must never render the gated control. Show a skeleton while
   * `loading` if flicker matters.
   *
   * @example
   * const { hasModuleAccess } = usePermissions();
   * {hasModuleAccess('reports:export') && <Button>Export</Button>}
   */
  hasModuleAccess: (key: string) => boolean;
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
  const [moduleAccess, setModuleAccess] = useState<ModuleAccessMap>(EMPTY_MODULE_ACCESS);

  // Stabilise the `collections` dependency by CONTENT rather than array
  // identity. Callers frequently pass an inline array (or rely on the default
  // `[]`), which produces a fresh reference every render. Depending on the raw
  // array would re-create `refresh` each render, which in turn re-fires the
  // auto-fetch effect below on every render — an infinite loop that hammers
  // `/api/permissions/me`. A serialised key only changes when the contents do.
  const collectionsKey = collections.join(',');

  // Build API URL helper
  // In direct mode, prepend the DaaS base URL but PRESERVE the `/api` prefix.
  // Stripping `/api` previously routed `/permissions/me` to a DaaS UI path that
  // 307-redirects to /auth/login, returning HTML and breaking JSON parsing
  // (causing isAdmin to silently fall back to false).
  // Depend on the PRIMITIVE values this reads, not the whole `daasContext`
  // object. A consumer that passes an inline `config`/callbacks to DaaSProvider
  // gives the context a new `value` identity on every layout re-render; keying
  // off the object would re-create `buildUrl` → `fetchGlobalPermissions` →
  // `refresh` and re-fire the auto-fetch effect each time.
  const isDirectMode = daasContext?.isDirectMode ?? false;
  const daasUrl = daasContext?.config?.url;
  const buildUrl = useCallback((path: string): string => {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    if (isDirectMode && daasUrl != null) {
      const baseUrl = daasUrl.replace(/\/$/, '');
      return `${baseUrl}${cleanPath}`;
    }
    return cleanPath;
  }, [isDirectMode, daasUrl]);
  
  // Get headers helper.
  // Prefer the explicit static `token` option (Storybook/testing). Otherwise
  // defer to the provider's getHeaders(), which resolves the *dynamic* token
  // (config.getToken(), e.g. the live Supabase session JWT) into an
  // Authorization header. Reading `daasContext.config.token` directly is wrong
  // here — that field is only set when the provider is configured with a
  // static token, which getToken-based apps never populate, so every request
  // went out with no Authorization header and permanently 401ed.
  // Depend on the context's getHeaders FUNCTION, not the whole context object
  // (see the buildUrl note above): its identity changes exactly when the
  // stored token changes, which is precisely when a re-fetch is warranted.
  const contextGetHeaders = daasContext?.getHeaders;
  const getHeaders = useCallback((): Record<string, string> => {
    if (token) {
      return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      };
    }
    return contextGetHeaders?.() ?? { 'Content-Type': 'application/json' };
  }, [token, contextGetHeaders]);
  
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
        // Absent on DaaS builds predating Module-Level Access. `{}` (rather
        // than null) is right here: the request succeeded, the user simply
        // holds no keys.
        moduleAccess: data.moduleAccess ?? {},
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
      setModuleAccess(global?.moduleAccess ?? EMPTY_MODULE_ACCESS);

      // If admin, no need to fetch individual collection permissions
      if (global?.isAdmin) {
        setLoading(false);
        return;
      }
      
      // Fetch permissions for specified collections
      const cols = collectionsKey ? collectionsKey.split(',') : [];
      if (cols.length > 0) {
        await Promise.all(cols.map(fetchCollectionPermissions)); // NOSONAR: fetchCollectionPermissions takes a single arg, no index/array arity bug
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch permissions';
      setError(errorMessage);
      // Fail closed for module access. Collection permissions keep whatever
      // they had (consumers treat "unknown" as full access, by design), but a
      // capability flag must never be granted off a failed request.
      setModuleAccess(EMPTY_MODULE_ACCESS);
    } finally {
      setLoading(false);
    }
  }, [fetchGlobalPermissions, fetchCollectionPermissions, collectionsKey]);
  
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
  
  // Check a module-level access key.
  // Stable on [isAdmin, moduleAccess] — consumers gate render on this, and an
  // unstable identity would re-fire their effects on every render.
  const hasModuleAccess = useCallback((key: string): boolean => {
    if (isAdmin) return true;
    return moduleAccess[key] === true;
  }, [isAdmin, moduleAccess]);

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
  // When the app authenticates with a Bearer token, the provider resolves
  // `getToken()` asynchronously — on first render the token is usually not
  // there yet. Fetching without it is a guaranteed 401 (console noise, and
  // `isAdmin` briefly wrong). Wait for the token instead: `hasToken` flips
  // when the provider's getHeaders identity changes, so the effect re-fires
  // the moment it resolves. Only gate when a token is actually expected
  // (static `token` or `getToken` configured) — cookie-based setups have no
  // token to wait for and must fetch immediately.
  const expectsToken = Boolean(
    token ?? daasContext?.config?.token ?? daasContext?.config?.getToken
  );
  const hasToken =
    Boolean(token) ||
    Boolean(contextGetHeaders && 'Authorization' in contextGetHeaders());

  // DaaS resolves /permissions/me against the active Resource URI, so the
  // response is scope-dependent and must be re-fetched when the scope changes.
  // Read on every render (a cookie read is cheap) so a ScopeSwitcher that only
  // rewrites the cookie still re-fires this effect — the value is a primitive,
  // so an unchanged scope produces no extra work.
  const activeScope = readActiveScope();

  useEffect(() => {
    if (!autoFetch) return;
    if (expectsToken && !hasToken) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFetch, refresh, expectsToken, hasToken, activeScope]);

  return {
    // State
    isAdmin,
    loading,
    error,
    permissions,
    moduleAccess,
    // Methods
    canPerform,
    hasModuleAccess,
    getAccessibleFields,
    isFieldAccessible,
    filterFields,
    fetchCollectionPermissions,
    refresh,
  };
}

/**
 * Check a single module-level access key.
 *
 * Sugar over `usePermissions().hasModuleAccess`. Fails closed while loading.
 *
 * @example
 * const canExport = useModuleAccess('reports:export');
 * return canExport ? <Button>Export</Button> : null;
 */
export function useModuleAccess(key: string): boolean {
  const { hasModuleAccess } = usePermissions();
  return useMemo(() => hasModuleAccess(key), [hasModuleAccess, key]);
}

/**
 * The full resolved module access map for the current user.
 * Useful for rendering a dynamic capability list.
 */
export function useModuleAccessMap(): ModuleAccessMap {
  const { moduleAccess } = usePermissions();
  return moduleAccess;
}

export default usePermissions;
