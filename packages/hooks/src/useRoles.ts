'use client';

import { useState, useCallback } from 'react';
import { apiRequest } from '@buildpad/services';
import type { Policy, Role } from '@buildpad/types';
import { parseDaaSError } from './parseDaaSError';

/**
 * Parameters for `fetchRoles`.
 */
export interface FetchRolesParams {
  /** Page number (1-indexed). Default: 1. */
  page?: number;
  /** Items per page. Default: 25. */
  limit?: number;
  /** Free-text search on role name/description. */
  search?: string;
  /** Sort spec, comma-separated, prefix with `-` for descending. */
  sort?: string;
  /** When true, each role includes `users: [{ count }]` (member count). */
  includeUsers?: boolean;
}

/**
 * Result of `fetchRoles`.
 */
export interface RolesListResult {
  roles: Role[];
  total: number;
  totalPages: number;
}

/**
 * Hook for role CRUD and role↔policy attachment. Mirrors the `useFiles.ts`
 * conventions: `'use client'`, `useState` loading/error, `useCallback`
 * methods, `apiRequest` transport.
 */
export function useRoles() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** List roles with pagination, search, and optional user-count enrichment. */
  const fetchRoles = useCallback(async (
    params: FetchRolesParams = {}
  ): Promise<RolesListResult> => {
    setLoading(true);
    setError(null);

    try {
      const query = new URLSearchParams();
      query.set('page', String(params.page ?? 1));
      query.set('limit', String(params.limit ?? 25));
      if (params.search) query.set('search', params.search);
      if (params.sort) query.set('sort', params.sort);
      if (params.includeUsers) query.set('includeUsers', 'true');

      const result = await apiRequest<{
        data: Role[];
        count?: number;
        totalCount?: number;
        totalPages?: number;
      }>(`/api/roles?${query.toString()}`);

      return {
        roles: result.data || [],
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

  /** Get a single role by ID, optionally including its attached policies. */
  const getRole = useCallback(async (
    id: string,
    opts: { includePolicies?: boolean } = {}
  ): Promise<Role> => {
    setLoading(true);
    setError(null);

    try {
      const query = new URLSearchParams();
      if (opts.includePolicies) query.set('includePolicies', 'true');
      const qs = query.toString();
      const result = await apiRequest<{ data: Role }>(
        `/api/roles/${id}${qs ? `?${qs}` : ''}`
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

  /**
   * Get the currently authenticated user's role(s). The backend's
   * `/api/roles/me` currently resolves a single primary role (the
   * lowest-`sort` role assignment for the active scope); it is returned
   * wrapped in an array to match this hook's plural contract, ready for a
   * future multi-role response without a breaking change.
   */
  const getMyRoles = useCallback(async (): Promise<Role[]> => {
    setLoading(true);
    setError(null);

    try {
      const result = await apiRequest<{ data: Role }>('/api/roles/me');
      return result.data ? [result.data] : [];
    } catch (err) {
      const message = parseDaaSError(err);
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  /** Create a role. `name` is required. */
  const createRole = useCallback(async (
    data: Partial<Role> & { name: string }
  ): Promise<Role> => {
    setLoading(true);
    setError(null);

    try {
      const result = await apiRequest<{ data: Role }>('/api/roles', {
        method: 'POST',
        body: JSON.stringify(data),
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

  /** Update a role. */
  const updateRole = useCallback(async (
    id: string,
    data: Partial<Role>
  ): Promise<Role> => {
    setLoading(true);
    setError(null);

    try {
      const result = await apiRequest<{ data: Role }>(`/api/roles/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
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

  /** Delete a role. */
  const deleteRole = useCallback(async (id: string): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      await apiRequest(`/api/roles/${id}`, { method: 'DELETE' });
    } catch (err) {
      const message = parseDaaSError(err);
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * List policies directly attached to a role. Returns the flattened
   * `Policy` objects the backend responds with (not raw junction rows).
   */
  const fetchRolePolicies = useCallback(async (roleId: string): Promise<Policy[]> => {
    setLoading(true);
    setError(null);

    try {
      const result = await apiRequest<{ data: Policy[] }>(
        `/api/roles/${roleId}/policies`
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

  /** Attach one or more policies directly to a role. */
  const attachRolePolicy = useCallback(async (
    roleId: string,
    policyId: string | string[]
  ): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const policyIds = Array.isArray(policyId) ? policyId : [policyId];
      await apiRequest(`/api/roles/${roleId}/policies`, {
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

  /** Detach a policy directly attached to a role. */
  const detachRolePolicy = useCallback(async (
    roleId: string,
    policyId: string
  ): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      await apiRequest(`/api/roles/${roleId}/policies/${policyId}`, {
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
    fetchRoles,
    getRole,
    getMyRoles,
    createRole,
    updateRole,
    deleteRole,
    fetchRolePolicies,
    attachRolePolicy,
    detachRolePolicy,
  };
}

export default useRoles;
