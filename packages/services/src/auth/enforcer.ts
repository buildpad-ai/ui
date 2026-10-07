/**
 * Permission Enforcement Middleware
 * 
 * This module provides permission checking utilities for API routes.
 * It enforces permissions at the application layer before database queries.
 * 
 * Features:
 * - Permission check and enforcement
 * - Field-level access control
 * - Item-level filtering via JSONB filters
 * - Automatic field merging with OR logic
 * 
 * @module @buildpad/services/auth/enforcer
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { createAuthenticatedClient, type User } from './session';
import {
  applyFilterToQuery as applyFilterInternal,
  assertPermissionFilterSupported,
  resolveFilterDynamicValues as resolveInternal,
  PermissionError,
  UnsupportedPermissionFilterError,
} from './filter-to-query';

// Re-export filter utilities with proper naming.
// NOTE: applyFilterToQuery throws UnsupportedPermissionFilterError (a 403
// PermissionError) for filters it cannot express — it never drops conditions.
export const applyFilterToQuery = applyFilterInternal;
export const resolveFilterDynamicValues = resolveInternal;

// PermissionError lives in ./filter-to-query (so UnsupportedPermissionFilterError
// can extend it without an import cycle); re-exported here for compatibility.
export { PermissionError, UnsupportedPermissionFilterError };

/**
 * Filter that matches no rows — returned when access must be denied.
 *
 * `id IS NULL AND id IS NOT NULL` is a contradiction for every column type, so
 * PostgREST returns an empty result (`?id=is.null&id=not.is.null`) instead of
 * a 400 — unlike comparing `id` to a string sentinel, which is invalid input
 * for uuid / integer primary keys.
 * A fresh object each call so callers cannot mutate a shared instance.
 */
function denyAllFilter(): FilterObject {
  return { _and: [{ id: { _null: true } }, { id: { _nnull: true } }] };
}

/**
 * Permission check parameters
 */
export interface PermissionCheck {
  collection: string;
  action: 'create' | 'read' | 'update' | 'delete' | 'share';
  itemId?: string;
}

/**
 * Permission details for a specific action
 */
export interface PermissionDetails {
  fields: string[];
  permissions: Record<string, unknown> | null;
  validation?: Record<string, unknown> | null;
  presets?: Record<string, unknown> | null;
}

/**
 * Filter object type
 */
export type FilterObject = Record<string, unknown>;

/**
 * Check if user has permission for an action and throw error if denied.
 * 
 * This function:
 * 1. Verifies user is authenticated
 * 2. Checks if user is admin (admins bypass all checks)
 * 3. Queries database for permission via check_permission() function
 * 4. Throws PermissionError if access denied
 * 
 * @param check - Permission check parameters
 * @returns Promise containing user and isAdmin flag
 * @throws {AuthenticationError} If user not authenticated
 * @throws {PermissionError} If permission denied
 * 
 * @example
 * ```typescript
 * const { user, isAdmin } = await enforcePermission({
 *   collection: 'daas_users',
 *   action: 'read'
 * });
 * ```
 */
export async function enforcePermission(
  check: PermissionCheck
): Promise<{ user: User; isAdmin: boolean }> {
  const { supabase, user } = await createAuthenticatedClient();
  
  // Check admin access first
  const { data: userData, error: userError } = await supabase
    .from('daas_users')
    .select('admin_access')
    .eq('id', user.id)
    .single();
  
  if (userError) {
    console.error('Error checking user permissions:', userError);
    throw new PermissionError('Failed to verify permissions', 500);
  }
  
  // Only an explicit boolean true grants admin — never a truthy non-boolean.
  const isAdmin = userData?.admin_access === true;
  
  // Admins bypass all permission checks
  if (isAdmin) {
    return { user, isAdmin: true };
  }
  
  // Use the SQL function to check permission
  // This function aggregates policies from role + direct user assignment
  const { data: hasPermission, error } = await supabase
    .rpc('check_permission', {
      user_id: user.id,
      collection: check.collection,
      action: check.action,
    });
  
  if (error) {
    console.error('Error checking permission:', error);
    throw new PermissionError('Failed to check permission', 500);
  }
  
  // Only an explicit boolean true grants access (not 'false', 1, [], …).
  if (hasPermission !== true) {
    throw new PermissionError(
      `Permission denied: ${check.action} on ${check.collection}`,
      403,
      check.collection,
      check.action
    );
  }
  
  return { user, isAdmin: false };
}

/**
 * Get user's permissions for a specific collection.
 * 
 * Returns permission details for all actions (create, read, update, delete, share).
 * Admin users get full access ('*' fields) for all actions.
 * 
 * @param collection - Collection name
 * @returns Promise containing permissions by action
 * @throws {AuthenticationError} If user not authenticated
 */
export async function getUserPermissions(
  collection: string
): Promise<Record<string, PermissionDetails>> {
  const { supabase, user } = await createAuthenticatedClient();
  
  // Check if admin (a failed lookup means "not admin")
  const { data: userData, error: userError } = await supabase
    .from('daas_users')
    .select('admin_access')
    .eq('id', user.id)
    .single();
  
  if (!userError && userData?.admin_access === true) {
    // Admin has all permissions
    const fullAccess: PermissionDetails = {
      fields: ['*'],
      permissions: null,
      validation: null,
      presets: null,
    };
    
    return {
      create: fullAccess,
      read: fullAccess,
      update: fullAccess,
      delete: fullAccess,
      share: fullAccess,
    };
  }
  
  // Get user's policies (a failed lookup or unexpected shape means "none")
  const { data: policyIds, error: policiesError } = await supabase.rpc('get_user_policies', {
    user_id: user.id,
  });

  if (policiesError || !Array.isArray(policyIds) || policyIds.length === 0) {
    return {};
  }

  // Ensure policyIds is an array of strings (UUIDs)
  const policyIdArray = policyIds.map((id: unknown) => (typeof id === 'string' ? id : String(id)));

  // Get permissions for those policies
  const { data: permissions, error } = await supabase
    .from('daas_permissions')
    .select('action, fields, permissions, validation, presets')
    .eq('collection', collection)
    .in('policy', policyIdArray);

  if (error) {
    console.error('Error fetching permissions:', error);
    return {};
  }

  // Define types for permission rows
  interface PermissionRow {
    action: string;
    fields: string[] | null;
    permissions: Record<string, unknown> | null;
    validation: Record<string, unknown> | null;
    presets: Record<string, unknown> | null;
  }

  // Group by action and merge permissions from multiple policies
  // Following DaaS's approach: fields are merged with OR logic (union),
  // permission filters are combined with OR logic
  return ((permissions || []) as PermissionRow[]).reduce(
    (acc: Record<string, PermissionDetails>, perm: PermissionRow) => {
      const action = perm.action;

      if (!acc[action]) {
        // First permission for this action
        acc[action] = {
          fields: perm.fields || [],
          permissions: perm.permissions,
          validation: perm.validation,
          presets: perm.presets,
        };
      } else {
        // Merge with existing permission for this action
        const existing = acc[action];
        const newFields = perm.fields || [];

        // Merge fields with OR logic (union)
        // If either has wildcard '*', result is wildcard
        if (existing.fields.includes('*') || newFields.includes('*')) {
          existing.fields = ['*'];
        } else {
          // Union of fields
          existing.fields = [...new Set([...existing.fields, ...newFields])];
        }

        // Merge permission filters with OR logic
        if (perm.permissions) {
          if (!existing.permissions) {
            existing.permissions = perm.permissions;
          } else {
            // Combine filters with OR
            existing.permissions = {
              _or: [existing.permissions, perm.permissions],
            };
          }
        }

        // Merge validation with OR logic
        if (perm.validation) {
          if (!existing.validation) {
            existing.validation = perm.validation;
          } else {
            existing.validation = {
              _or: [existing.validation, perm.validation],
            };
          }
        }
      }

      return acc;
    },
    {} as Record<string, PermissionDetails>
  );
}

/**
 * Get allowed fields for a specific collection and action.
 * 
 * This function calls the database helper function get_user_permission_fields()
 * which merges fields from all user's permissions using OR logic (union).
 * 
 * @param collection - Collection name
 * @param action - Action type
 * @returns Promise containing array of allowed field names
 * @throws {AuthenticationError} If user not authenticated
 */
export async function getAccessibleFields(
  collection: string,
  action: string
): Promise<string[]> {
  const { supabase, user } = await createAuthenticatedClient();
  
  // Call database function to get merged field list
  const { data, error } = await supabase.rpc('get_user_permission_fields', {
    user_id: user.id,
    collection,
    action,
  });
  
  if (error) {
    console.error('Error fetching accessible fields:', error);
    return [];
  }

  // Anything but an array of field names grants no fields (a bare '*' string
  // must not pass the callers' `.includes('*')` wildcard check).
  if (!Array.isArray(data)) {
    return [];
  }
  return data.filter((field: unknown): field is string => typeof field === 'string');
}

/**
 * Filter object fields based on allowed fields list.
 * 
 * @param data - Data object to filter
 * @param allowedFields - Array of allowed field names or ['*'] for all
 * @returns Filtered data object
 */
export function filterFields<T extends Record<string, unknown>>(
  data: T,
  allowedFields: string[]
): Partial<T> {
  // Wildcard means all fields allowed
  if (allowedFields.includes('*')) {
    return data;
  }
  
  // Filter to only allowed fields
  const filtered = {} as Partial<T>;
  for (const field of allowedFields) {
    if (field in data) {
      filtered[field as keyof T] = data[field] as T[keyof T];
    }
  }
  return filtered;
}

/**
 * Filter array of objects based on allowed fields.
 */
export function filterFieldsArray<T extends Record<string, unknown>>(
  dataArray: T[],
  allowedFields: string[]
): Partial<T>[] {
  return dataArray.map((item) => filterFields(item, allowedFields));
}

/**
 * Validate that requested fields are allowed for the user.
 * 
 * @param requestedFields - Array of field names user is trying to access/modify
 * @param collection - Collection name
 * @param action - Action type ('create', 'update', etc.)
 * @returns Promise<{ allowed: boolean, forbiddenFields: string[] }>
 * @throws {AuthenticationError} If user not authenticated
 */
export async function validateFieldsAccess(
  requestedFields: string[],
  collection: string,
  action: string
): Promise<{ allowed: boolean; forbiddenFields: string[] }> {
  const allowedFields = await getAccessibleFields(collection, action);
  
  // Wildcard means all fields allowed
  if (allowedFields.includes('*')) {
    return { allowed: true, forbiddenFields: [] };
  }
  
  // No permissions means no fields allowed
  if (allowedFields.length === 0) {
    return { allowed: false, forbiddenFields: requestedFields };
  }
  
  // Check which requested fields are not in allowed list
  const allowedSet = new Set(allowedFields);
  const forbiddenFields = requestedFields.filter((field) => !allowedSet.has(field));
  
  return {
    allowed: forbiddenFields.length === 0,
    forbiddenFields,
  };
}

/**
 * Filter response data based on user's field permissions.
 * 
 * Convenience function that combines getAccessibleFields() and filterFields().
 * 
 * @param data - Data object or array to filter
 * @param collection - Collection name
 * @param action - Action type
 * @returns Promise containing filtered data
 * @throws {AuthenticationError} If user not authenticated
 */
export async function filterResponseFields<T extends Record<string, unknown>>(
  data: T | T[],
  collection: string,
  action: string
): Promise<Partial<T> | Partial<T>[]> {
  const allowedFields = await getAccessibleFields(collection, action);
  
  if (Array.isArray(data)) {
    return filterFieldsArray(data, allowedFields);
  }
  
  return filterFields(data, allowedFields);
}

/**
 * Check if a specific field is accessible for the user.
 */
export async function isFieldAccessible(
  field: string,
  collection: string,
  action: string
): Promise<boolean> {
  const allowedFields = await getAccessibleFields(collection, action);
  
  // Wildcard means all fields accessible
  if (allowedFields.includes('*')) {
    return true;
  }
  
  return allowedFields.includes(field);
}

/**
 * Get permission filters for item-level access control.
 * 
 * Returns the merged permission filter rules that should be applied
 * to database queries for the specified collection/action.
 * 
 * @param collection - Collection name
 * @param action - Action type
 * @returns Promise containing filter object or null for full access
 * @throws {AuthenticationError} If user not authenticated
 */
export async function getPermissionFilters(
  collection: string,
  action: string
): Promise<FilterObject | null> {
  const { supabase, user } = await createAuthenticatedClient();
  
  // Check if admin (admins have no filters; a failed lookup means "not admin")
  const { data: userData, error: userError } = await supabase
    .from('daas_users')
    .select('admin_access')
    .eq('id', user.id)
    .single();
  
  if (!userError && userData?.admin_access === true) {
    return null; // No filter = full access
  }
  
  // Get all of the user's roles via the junction table, primary (lowest sort)
  // first. Used for $CURRENT_ROLE / $CURRENT_ROLES. On error the role data is
  // treated as unknown, so filters referencing it deny instead of guessing.
  const { data: roleRows, error: rolesError } = await supabase
    .from('daas_user_roles')
    .select('role_id')
    .eq('user_id', user.id)
    .order('sort', { ascending: true });

  const roleIds: string[] | undefined =
    !rolesError && Array.isArray(roleRows)
      ? roleRows
          .map((r: { role_id?: unknown }) => r?.role_id)
          .filter((id: unknown): id is string => typeof id === 'string' && id !== '')
      : undefined;
  const roleId = roleIds?.[0];
  
  // Get user's policies
  const { data: policyIds, error: policiesError } = await supabase.rpc('get_user_policies', {
    user_id: user.id,
  });

  if (policiesError || !Array.isArray(policyIds) || policyIds.length === 0) {
    // No (readable) policies = deny all (filter that matches nothing)
    return denyAllFilter();
  }

  const policyIdArray = policyIds.map((id: unknown) => (typeof id === 'string' ? id : String(id)));

  // Get permissions with filters
  const { data: permissions, error } = await supabase
    .from('daas_permissions')
    .select('permissions')
    .eq('collection', collection)
    .eq('action', action)
    .in('policy', policyIdArray);

  if (error || !Array.isArray(permissions) || permissions.length === 0) {
    return denyAllFilter();
  }

  // Only an explicit `permissions: null` means "no restriction". A row that is
  // not an object or lacks the column is malformed: deny rather than let an
  // `undefined` filter reach the caller as "no filter".
  if (
    permissions.some(
      (p: unknown) =>
        typeof p !== 'object' || p === null || (p as { permissions?: unknown }).permissions === undefined
    )
  ) {
    console.error(`[permissions] Denying ${action} on ${collection}: malformed permission row`);
    return denyAllFilter();
  }

  // Define type for permission filter rows
  interface PermissionFilterRow {
    permissions: Record<string, unknown> | null;
  }

  const typedPermissions = permissions as PermissionFilterRow[];

  // Collect non-null filters
  const filters = typedPermissions
    .filter((p: PermissionFilterRow) => p.permissions !== null)
    .map((p: PermissionFilterRow) => p.permissions as FilterObject);

  if (filters.length === 0) {
    // All permissions have null filter = full access
    return null;
  }

  // If any permission has null filter, user has full access
  if (typedPermissions.some((p: PermissionFilterRow) => p.permissions === null)) {
    return null;
  }

  // Combine filters with OR logic
  const combined: FilterObject = filters.length === 1 ? filters[0] : { _or: filters };

  // FAIL CLOSED: resolve dynamic variables and verify the whole filter can be
  // translated into a query. A filter that cannot be enforced faithfully
  // (unknown operator, relational path, unresolvable variable, …) denies all
  // rows instead of being partially applied or dropped.
  try {
    const resolved = resolveFilterDynamicValues(combined, user.id, roleId, {
      roles: roleIds,
      policies: policyIdArray,
    });
    assertPermissionFilterSupported(resolved);
    return resolved;
  } catch (err) {
    if (err instanceof UnsupportedPermissionFilterError) {
      console.error(
        `[permissions] Denying ${action} on ${collection}: ${err.message}`
      );
      return denyAllFilter();
    }
    throw err;
  }
}
