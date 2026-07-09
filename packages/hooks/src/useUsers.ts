'use client';

import { useState, useCallback } from 'react';
import { apiRequest } from '@buildpad/services';
import type { Policy, User, UserStatus } from '@buildpad/types';
import { parseDaaSError } from './parseDaaSError';

/**
 * Parameters for `fetchUsers`.
 */
export interface FetchUsersParams {
  /** Page number (1-indexed). Default: 1. */
  page?: number;
  /** Items per page. Default: 25. */
  limit?: number;
  /** Free-text search across searchable fields. */
  search?: string;
  /** Sort spec, comma-separated, prefix with `-` for descending. */
  sort?: string;
  /** Comma-separated field list (Directus-style, supports dot-notation). */
  fields?: string;
  /** Filter to users holding this role ID. */
  role?: string;
  /** Filter by account status. */
  status?: UserStatus;
  /** Additional Directus-style filter object, merged server-side. */
  filter?: Record<string, unknown>;
}

/**
 * Result of `fetchUsers`.
 */
export interface UsersListResult {
  users: User[];
  total: number;
  totalPages: number;
}

/**
 * Hook for user CRUD, role-membership bulk updates, and user↔policy
 * attachment. Mirrors the `useFiles.ts` conventions: `'use client'`,
 * `useState` loading/error, `useCallback` methods, `apiRequest` transport.
 */
export function useUsers() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * List users with pagination, search, role/status filters, and an
   * optional Directus-style filter object.
   */
  const fetchUsers = useCallback(async (
    params: FetchUsersParams = {}
  ): Promise<UsersListResult> => {
    setLoading(true);
    setError(null);

    try {
      const query = new URLSearchParams();
      query.set('page', String(params.page ?? 1));
      query.set('limit', String(params.limit ?? 25));
      if (params.search) query.set('search', params.search);
      if (params.sort) query.set('sort', params.sort);
      if (params.fields) query.set('fields', params.fields);
      if (params.role) query.set('role', params.role);
      if (params.status) query.set('status', params.status);
      if (params.filter) query.set('filter', JSON.stringify(params.filter));

      const result = await apiRequest<{
        data: User[];
        count?: number;
        totalCount?: number;
        totalPages?: number;
      }>(`/api/users?${query.toString()}`);

      return {
        users: result.data || [],
        total: result.totalCount ?? result.count ?? 0,
        totalPages: result.totalPages ?? 1,
      };
    } catch (err) {
      const message = parseDaaSError(err);
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  /** Get a single user by ID. */
  const getUser = useCallback(async (
    id: string,
    opts: { fields?: string } = {}
  ): Promise<User> => {
    setLoading(true);
    setError(null);

    try {
      const query = new URLSearchParams();
      if (opts.fields) query.set('fields', opts.fields);
      const qs = query.toString();
      const result = await apiRequest<{ data: User }>(
        `/api/users/${id}${qs ? `?${qs}` : ''}`
      );
      return result.data;
    } catch (err) {
      const message = parseDaaSError(err);
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  /** Get the currently authenticated user's profile. */
  const getMe = useCallback(async (): Promise<User> => {
    setLoading(true);
    setError(null);

    try {
      const result = await apiRequest<{ data: User }>('/api/users/me');
      return result.data;
    } catch (err) {
      const message = parseDaaSError(err);
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  /** Create a user. `email` (and typically `password`) are required. */
  const createUser = useCallback(async (
    data: Partial<User> & { email: string }
  ): Promise<User> => {
    setLoading(true);
    setError(null);

    try {
      const { admin_access: _adminAccess, ...payload } = data as Partial<User> & {
        admin_access?: boolean;
      };
      const result = await apiRequest<{ data: User }>('/api/users', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return result.data;
    } catch (err) {
      const message = parseDaaSError(err);
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Update a user (edits-only PATCH — pass only the changed fields).
   * `admin_access` is computed server-side and is always stripped before
   * sending, even if present on the payload.
   */
  const updateUser = useCallback(async (
    id: string,
    data: Partial<User>
  ): Promise<User> => {
    setLoading(true);
    setError(null);

    try {
      const { admin_access: _adminAccess, ...payload } = data as Partial<User> & {
        admin_access?: boolean;
      };
      const result = await apiRequest<{ data: User }>(`/api/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      return result.data;
    } catch (err) {
      const message = parseDaaSError(err);
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  /** Update the currently authenticated user's own profile. */
  const updateMe = useCallback(async (data: Partial<User>): Promise<User> => {
    setLoading(true);
    setError(null);

    try {
      const { admin_access: _adminAccess, ...payload } = data as Partial<User> & {
        admin_access?: boolean;
      };
      const result = await apiRequest<{ data: User }>('/api/users/me', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      return result.data;
    } catch (err) {
      const message = parseDaaSError(err);
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  /** Delete a user. */
  const deleteUser = useCallback(async (id: string): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      await apiRequest(`/api/users/${id}`, { method: 'DELETE' });
    } catch (err) {
      const message = parseDaaSError(err);
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Bulk-update role membership for multiple users in one call.
   * `role` replaces all existing roles (legacy); `addRoles`/`removeRoles`
   * perform fine-grained M2M add/remove and can be combined.
   */
  const bulkUpdateUsers = useCallback(async (
    ids: string[],
    change: { role?: string | null; addRoles?: string[]; removeRoles?: string[] }
  ): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      await apiRequest('/api/users/bulk-update', {
        method: 'PATCH',
        body: JSON.stringify({ userIds: ids, ...change }),
      });
    } catch (err) {
      const message = parseDaaSError(err);
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * List policies directly attached to a user.
   *
   * Returns the flattened `Policy` objects the backend responds with (not
   * raw `daas_access` junction rows) — this matches both the actual
   * `/api/users/[id]/policies` response shape and what `UserPoliciesManager`
   * needs to render (name/icon/admin_access/etc. without an extra unwrap).
   */
  const fetchUserPolicies = useCallback(async (userId: string): Promise<Policy[]> => {
    setLoading(true);
    setError(null);

    try {
      const result = await apiRequest<{ data: Policy[] }>(
        `/api/users/${userId}/policies`
      );
      return result.data || [];
    } catch (err) {
      const message = parseDaaSError(err);
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  /** Attach one or more policies directly to a user. */
  const attachUserPolicy = useCallback(async (
    userId: string,
    policyId: string | string[]
  ): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const policyIds = Array.isArray(policyId) ? policyId : [policyId];
      await apiRequest(`/api/users/${userId}/policies`, {
        method: 'POST',
        body: JSON.stringify({ policyIds }),
      });
    } catch (err) {
      const message = parseDaaSError(err);
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  /** Detach a policy directly attached to a user. */
  const detachUserPolicy = useCallback(async (
    userId: string,
    policyId: string
  ): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      await apiRequest(`/api/users/${userId}/policies/${policyId}`, {
        method: 'DELETE',
      });
    } catch (err) {
      const message = parseDaaSError(err);
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    fetchUsers,
    getUser,
    getMe,
    createUser,
    updateUser,
    updateMe,
    deleteUser,
    bulkUpdateUsers,
    fetchUserPolicies,
    attachUserPolicy,
    detachUserPolicy,
  };
}

export default useUsers;
