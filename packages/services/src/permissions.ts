/**
 * Permissions Service
 * Fetches field-level permissions from DaaS backend.
 *
 * Uses the standard DaaS `GET /permissions/me` endpoint which returns
 * a CollectionAccess map keyed by collection and action.
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

import { apiRequest } from "./api-request";

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
let _cachePromise: Promise<CollectionAccess> | null = null;
let _cacheTime = 0;
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
    if (!forceRefresh && _cachedAccess && now - _cacheTime < CACHE_TTL) {
      return _cachedAccess;
    }

    // De-duplicate concurrent calls
    if (_cachePromise && !forceRefresh) return _cachePromise;

    _cachePromise = (async () => {
      try {
        const response = await apiRequest<{ data: CollectionAccess; isAdmin?: boolean }>(
          "/api/permissions/me",
        );
        _cachedAccess = response.data ?? {};
        _cachedIsAdmin = response.isAdmin === true;
        _cacheTime = Date.now();
        return _cachedAccess;
      } catch (err) {
        console.error(
          "[PermissionsService] Failed to fetch /permissions/me:",
          err,
        );
        // Return empty — callers treat empty as "unable to determine permissions"
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

  /** Invalidate the cached /permissions/me response */
  static clearCache(): void {
    _cachedAccess = null;
    _cachedIsAdmin = false;
    _cachePromise = null;
    _cacheTime = 0;
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
