/**
 * Permissions Service
 * Fetches field-level permissions and module-level access from the DaaS backend.
 *
 * Uses the standard DaaS `GET /permissions/me` endpoint which returns
 * a CollectionAccess map keyed by collection and action, plus the user's
 * OR-merged `moduleAccess` capability keys.
 *
 * The response is scope-dependent: DaaS resolves policies against the active
 * Resource URI (`X-Resource-Uri` header / `daas_resource_uri` cookie), so the
 * cache is keyed on that scope.
 *
 * DaaS response format (per action):
 * ```json
 * { "data": {
 *     "tasks": {
 *       "read":  { "fields": ["id","title"], "permissions": {...}, "validation": null, "presets": null },
 *       "create": { "fields": ["*"], "permissions": null, "validation": null, "presets": null }
 *     }
 * }}
 * ```
 */

import type { ModuleAccessMap } from "@buildpad/types";
import { apiRequest } from "./api-request";

/**
 * Read the active scope URI from the `daas_resource_uri` cookie.
 *
 * Used only as a cache key here — the header itself is attached by the
 * DaaSProvider's `getHeaders()` (see `DaaSProviderWrapper`). Returns `null` in
 * non-browser contexts and when no scope is set.
 */
function readActiveScope(): string | null {
  if (typeof document === "undefined") return null;
  const match = /(?:^|;\s*)daas_resource_uri=([^;]*)/.exec(document.cookie);
  if (!match) return null;
  const value = decodeURIComponent(match[1]).trim();
  return value === "" ? null : value;
}

export interface FieldPermissions {
  collection: string;
  action: string;
  fields: string[]; // Array of allowed field names, or ['*'] for all fields
}

/**
 * Shape of a single action inside the DaaS CollectionAccess response.
 * Note: DaaS does NOT include an `access` property (unlike internal DaaS).
 * The presence of the action key itself implies access; `fields` controls scope.
 */
export interface CollectionActionAccess {
  fields?: string[] | null;
  permissions?: Record<string, unknown> | null;
  validation?: Record<string, unknown> | null;
  presets?: Record<string, unknown> | null;
}

/** DaaS `GET /permissions/me` response payload (keyed by collection) */
export type CollectionAccess = Record<
  string,
  Record<string, CollectionActionAccess>
>;

// In-memory cache (per tab lifetime) to avoid redundant /permissions/me calls
let _cachedAccess: CollectionAccess | null = null;
let _cachedIsAdmin = false;
let _cachedModuleAccess: ModuleAccessMap | null = null;
let _cachePromise: Promise<CollectionAccess> | null = null;
let _cacheTime = 0;
// Scope the cached response was resolved at. DaaS resolves /permissions/me
// against the active Resource URI, so a cache that ignored scope would serve
// the previous tenant's permissions for up to CACHE_TTL after a scope switch.
let _cacheScope: string | null = null;
const CACHE_TTL = 30_000; // 30 seconds

/**
 * Permissions Service
 */
export class PermissionsService {
  // ---------------------------------------------------------------------------
  // Standard DaaS endpoint: GET /permissions/me
  // ---------------------------------------------------------------------------

  /**
   * Fetch the full CollectionAccess map for the current user.
   * Uses an in-memory cache with a 30 s TTL so multiple components mounting
   * at the same time share a single request.
   */
  static async getMyCollectionAccess(
    forceRefresh = false,
  ): Promise<CollectionAccess> {
    const now = Date.now();
    const scope = readActiveScope();

    // A scope change invalidates the cache regardless of TTL — the server
    // resolves policies against the active Resource URI.
    const scopeChanged = scope !== _cacheScope;

    if (!forceRefresh && !scopeChanged && _cachedAccess && now - _cacheTime < CACHE_TTL) {
      return _cachedAccess;
    }

    // De-duplicate concurrent calls (but never reuse an in-flight request that
    // was issued for a different scope).
    if (_cachePromise && !forceRefresh && !scopeChanged) return _cachePromise;

    _cachePromise = (async () => {
      try {
        const response = await apiRequest<{
          data: CollectionAccess;
          isAdmin?: boolean;
          moduleAccess?: ModuleAccessMap;
        }>("/api/permissions/me");
        _cachedAccess = response.data ?? {};
        _cachedIsAdmin = response.isAdmin === true;
        // Absent on DaaS builds predating Module-Level Access — treat as "no
        // keys" so every hasModuleAccess() check fails closed.
        _cachedModuleAccess = response.moduleAccess ?? {};
        _cacheTime = Date.now();
        _cacheScope = scope;
        return _cachedAccess;
      } catch (err) {
        console.error(
          "[PermissionsService] Failed to fetch /permissions/me:",
          err,
        );
        // Collection access returns empty — callers treat empty as "unable to
        // determine permissions" and fail OPEN, preserving existing behaviour.
        // Module access must NOT inherit that: a capability flag is deny-by-
        // default, so leave it null and let hasModuleAccess() return false.
        _cachedModuleAccess = null;
        return {};
      } finally {
        _cachePromise = null;
      }
    })();

    return _cachePromise;
  }

  /** Whether the current user is an admin (populated after getMyCollectionAccess resolves) */
  static get isAdmin(): boolean {
    return _cachedIsAdmin;
  }

  // ---------------------------------------------------------------------------
  // Module-Level Access
  // ---------------------------------------------------------------------------

  /**
   * The current user's resolved module access keys, or `null` when
   * `/permissions/me` has not been fetched or the fetch failed.
   *
   * Contains granted keys only — the server drops `false` when OR-merging
   * across policies. For an admin this reflects their own policies' grants and
   * is informational: `isAdmin` already implies every key.
   */
  static get moduleAccess(): ModuleAccessMap | null {
    return _cachedModuleAccess;
  }

  /**
   * Whether the current user holds a module-level access key.
   *
   * Admins hold every key. **Fails closed**: returns `false` when permissions
   * have not been loaded yet or the fetch failed — deliberately unlike the
   * collection-permission helpers, which fail open. A capability flag gates
   * something the user is presumed *not* to have, so an unresolved state must
   * never render the gated control.
   *
   * Only safe after `getMyCollectionAccess()` / `ensureLoaded()` has resolved.
   * In React, prefer `usePermissions().hasModuleAccess`, which tracks loading.
   */
  static hasModuleAccess(key: string): boolean {
    if (_cachedIsAdmin) return true;
    return _cachedModuleAccess?.[key] === true;
  }

  /**
   * Resolve `/permissions/me` if it is not already cached.
   *
   * Convenience for non-React callers that only need the static
   * `isAdmin` / `hasModuleAccess` getters to be populated.
   */
  static async ensureLoaded(): Promise<void> {
    await this.getMyCollectionAccess();
  }

  /**
   * Get readable fields for a collection using the standard DaaS
   * `/permissions/me` endpoint.
   *
   * @returns Array of field names, `['*']` for full access, or `[]` if
   *          the collection has no read permission / fetch failed.
   */
  static async getReadableFields(collection: string): Promise<string[]> {
    const access = await this.getMyCollectionAccess();
    const collectionAccess = access?.[collection];
    // No entry for this collection → no read access
    if (!collectionAccess) return [];
    const readAccess = collectionAccess.read;
    // No read action entry → no read access
    if (!readAccess) return [];
    // null or missing fields → full access (wildcard)
    if (!readAccess.fields) return ["*"];
    // Explicit field list (may include "*")
    return readAccess.fields;
  }

  /**
   * Invalidate the cached /permissions/me response.
   *
   * Call after anything that changes the effective permission set — logout,
   * a policy edit, or a scope switch (though scope changes are also detected
   * automatically via the cache key).
   */
  static clearCache(): void {
    _cachedAccess = null;
    _cachedIsAdmin = false;
    _cachedModuleAccess = null;
    _cachePromise = null;
    _cacheTime = 0;
    _cacheScope = null;
  }

  // ---------------------------------------------------------------------------
  // Legacy methods (use custom /api/permissions/{collection} routes)
  // Kept for backward compatibility with nextjs-supabase-daas app
  // ---------------------------------------------------------------------------

  /**
   * Get accessible fields for a collection and action
   * @param collection - Collection name
   * @param action - Action type (create, read, update, delete)
   * @returns Promise containing field permissions
   */
  static async getFieldPermissions(
    collection: string,
    action: "create" | "read" | "update" | "delete",
  ): Promise<FieldPermissions> {
    const response = await apiRequest<{ data: FieldPermissions }>(
      `/api/permissions/${collection}?action=${action}`,
    );
    return response.data;
  }

  /**
   * Get accessible fields for all actions
   * @param collection - Collection name
   * @returns Promise containing permissions for all actions
   */
  static async getAllFieldPermissions(
    collection: string,
  ): Promise<Record<string, FieldPermissions>> {
    const actions: Array<"create" | "read" | "update" | "delete"> = [
      "create",
      "read",
      "update",
      "delete",
    ];

    const permissions: Record<string, FieldPermissions> = {};

    await Promise.all(
      actions.map(async (action) => {
        try {
          permissions[action] = await this.getFieldPermissions(
            collection,
            action,
          );
        } catch (error) {
          console.error(`Failed to fetch ${action} permissions:`, error);
          // Default to no permissions on error
          permissions[action] = {
            collection,
            action,
            fields: [],
          };
        }
      }),
    );

    return permissions;
  }

  /**
   * Check if a field is accessible for an action
   * @param fieldName - Field name to check
   * @param permissions - Field permissions object
   * @returns True if field is accessible
   */
  static isFieldAccessible(
    fieldName: string,
    permissions: FieldPermissions,
  ): boolean {
    // Wildcard means all fields are accessible
    if (permissions.fields.includes("*")) {
      return true;
    }

    // Check if field is in the allowed list
    return permissions.fields.includes(fieldName);
  }

  /**
   * Filter fields based on permissions
   * @param allFields - Array of all field names
   * @param permissions - Field permissions object
   * @returns Array of accessible field names
   */
  static filterAccessibleFields(
    allFields: string[],
    permissions: FieldPermissions,
  ): string[] {
    // Wildcard means return all fields
    if (permissions.fields.includes("*")) {
      return allFields;
    }

    // Filter to only accessible fields
    return allFields.filter((field) => permissions.fields.includes(field));
  }
}

/**
 * Factory function to create a new PermissionsService instance
 */
export function createPermissionsService(): typeof PermissionsService {
  return PermissionsService;
}
