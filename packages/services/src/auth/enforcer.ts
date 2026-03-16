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
  resolveFilterDynamicValues as resolveInternal,
  type FilterObject as FilterType 
} from './filter-to-query';

// Re-export filter utilities with proper naming
export const applyFilterToQuery = applyFilterInternal;
export const resolveFilterDynamicValues = resolveInternal;

/**
 * Permission denied error
 */
export class PermissionError extends Error {
  constructor(
    message: string,
    public statusCode: number = 403,
    public collection?: string,
    public action?: string
  ) {
    super(message);
    this.name = 'PermissionError';
  }
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
  
  const isAdmin = userData?.admin_access ?? false;
  
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
  
  if (!hasPermission) {
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
  
  // Check if admin
  const { data: userData } = await supabase
    .from('daas_users')
    .select('admin_access')
    .eq('id', user.id)
    .single();
  
  if (userData?.admin_access) {
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
  
  // Get user's policies
  const { data: policyIds } = await supabase.rpc('get_user_policies', { user_id: user.id });
  
  if (!policyIds || policyIds.length === 0) {
    return {};
  }
  
  // Ensure policyIds is an array of strings (UUIDs)
  const policyIdArray = Array.isArray(policyIds)
    ? policyIds.map((id: unknown) => (typeof id === 'string' ? id : String(id)))
    : [];

  if (policyIdArray.length === 0) {
    return {};
  }

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
  
  return data || [];
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
  
  // Check if admin (admins have no filters)
  const { data: userData } = await supabase
    .from('daas_users')
    .select('admin_access')
    .eq('id', user.id)
    .single();
  
  if (userData?.admin_access) {
    return null; // No filter = full access
  }
  
  // Get user's primary role via junction table
  const { data: primaryRole } = await supabase
    .from('daas_user_roles')
    .select('role_id')
    .eq('user_id', user.id)
    .order('sort', { ascending: true })
    .limit(1)
    .maybeSingle();
  
  const roleId = primaryRole?.role_id || undefined;
  
  // Get user's policies
  const { data: policyIds } = await supabase.rpc('get_user_policies', { user_id: user.id });
  
  if (!policyIds || policyIds.length === 0) {
    // No policies = deny all (empty filter that matches nothing)
    return { id: { _eq: '__DENY_ALL__' } };
  }
  
  const policyIdArray = Array.isArray(policyIds)
    ? policyIds.map((id: unknown) => (typeof id === 'string' ? id : String(id)))
    : [];

  // Get permissions with filters
  const { data: permissions, error } = await supabase
    .from('daas_permissions')
    .select('permissions')
    .eq('collection', collection)
    .eq('action', action)
    .in('policy', policyIdArray);

  if (error || !permissions || permissions.length === 0) {
    return { id: { _eq: '__DENY_ALL__' } };
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
  if (filters.length === 1) {
    return resolveFilterDynamicValues(filters[0], user.id, roleId);
  }

  return resolveFilterDynamicValues(
    { _or: filters },
    user.id,
    roleId
  );
}
