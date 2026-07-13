'use client';

import { useState, useCallback } from 'react';
import { apiRequest } from '@buildpad/services';
import type { Access } from '@buildpad/types';
import { parseDaaSError } from './parseDaaSError';

/**
 * Parameters for `fetchAccess`.
 */
export interface FetchAccessParams {
  /** Page number (1-indexed). */
  page?: number;
  /** Items per page. Default: 25. */
  limit?: number;
  /** Sort spec, comma-separated, prefix with `-` for descending. */
  sort?: string;
  /** DaaS-style filter object, e.g. `{ role: { _eq: roleId } }`. */
  filter?: Record<string, unknown>;
}

/**
 * Thin CRUD hook over `/api/access` — the `daas_access` junction table that
 * attaches a policy to either a role or a user. Most UI surfaces should
 * prefer the nested routes exposed by `useUsers`/`useRoles`
 * (`fetchUserPolicies`/`attachUserPolicy`/etc.); this hook is for advanced
 * consumers that need direct junction-row access.
 */
export function useAccess() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** List access (junction) rows, optionally filtered. */
  const fetchAccess = useCallback(async (
    params: FetchAccessParams = {}
  ): Promise<Access[]> => {
    setLoading(true);
    setError(null);

    try {
      const query = new URLSearchParams();
      if (params.page) query.set('page', String(params.page));
      query.set('limit', String(params.limit ?? 25));
      if (params.sort) query.set('sort', params.sort);
      if (params.filter) query.set('filter', JSON.stringify(params.filter));

      const qs = query.toString();
      const result = await apiRequest<{ data: Access[] }>(
        `/api/access${qs ? `?${qs}` : ''}`
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

  /**
   * Create an access (junction) row. Attaches `data.policy` to either
   * `data.role` or `data.user` (mutually exclusive; both null = public).
   */
  const createAccess = useCallback(async (
    data: Partial<Access> & { policy: string }
  ): Promise<Access> => {
    setLoading(true);
    setError(null);

    try {
      const result = await apiRequest<{ data: Access }>('/api/access', {
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

  /** Update an access (junction) row. */
  const updateAccess = useCallback(async (
    id: string,
    data: Partial<Access>
  ): Promise<Access> => {
    setLoading(true);
    setError(null);

    try {
      const result = await apiRequest<{ data: Access }>(`/api/access/${id}`, {
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

  /** Delete an access (junction) row. */
  const deleteAccess = useCallback(async (id: string): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      await apiRequest(`/api/access/${id}`, { method: 'DELETE' });
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
    fetchAccess,
    createAccess,
    updateAccess,
    deleteAccess,
  };
}

export default useAccess;
