'use client';

import { useState, useCallback } from 'react';
import { apiRequest } from '@buildpad/services';
import type { Policy } from '@buildpad/types';
import { parseDaaSError } from './parseDaaSError';

/**
 * Parameters for `fetchPolicies`.
 */
export interface FetchPoliciesParams {
  /** Page number (1-indexed). Default: 1. */
  page?: number;
  /** Items per page. Default: 25. */
  limit?: number;
  /** Free-text search on policy name/description. */
  search?: string;
  /** Sort spec, comma-separated, prefix with `-` for descending. */
  sort?: string;
}

/**
 * Result of `fetchPolicies`.
 */
export interface PoliciesListResult {
  policies: Policy[];
  total: number;
  totalPages: number;
}

/**
 * Hook for policy CRUD. List/detail responses are enriched server-side with
 * `userCount`/`roleCount`. Mirrors the `useFiles.ts` conventions: `'use
 * client'`, `useState` loading/error, `useCallback` methods, `apiRequest`
 * transport.
 */
export function usePolicies() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** List policies with pagination and search. Enriched with userCount/roleCount. */
  const fetchPolicies = useCallback(async (
    params: FetchPoliciesParams = {}
  ): Promise<PoliciesListResult> => {
    setLoading(true);
    setError(null);

    try {
      const query = new URLSearchParams();
      query.set('page', String(params.page ?? 1));
      query.set('limit', String(params.limit ?? 25));
      if (params.search) query.set('search', params.search);
      if (params.sort) query.set('sort', params.sort);
      query.set('meta', 'total_count');

      const result = await apiRequest<{
        data: Policy[];
        count?: number;
        totalCount?: number;
        totalPages?: number;
        meta?: { total_count?: number };
      }>(`/api/policies?${query.toString()}`);

      const limit = params.limit ?? 25;
      const total = result.totalCount ?? result.meta?.total_count ?? result.count ?? 0;

      return {
        policies: result.data || [],
        total,
        totalPages: result.totalPages ?? Math.max(1, Math.ceil(total / limit)),
      };
    } catch (err) {
      const message = parseDaaSError(err);
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  /** Get a single policy by ID (enriched with userCount/roleCount). */
  const getPolicy = useCallback(async (id: string): Promise<Policy> => {
    setLoading(true);
    setError(null);

    try {
      const result = await apiRequest<{ data: Policy }>(`/api/policies/${id}`);
      return result.data;
    } catch (err) {
      const message = parseDaaSError(err);
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  /** Get the full policy records effective for the current user in the active scope. */
  const getMyPolicies = useCallback(async (): Promise<Policy[]> => {
    setLoading(true);
    setError(null);

    try {
      const result = await apiRequest<{ data: Policy[] }>('/api/policies/me');
      return result.data || [];
    } catch (err) {
      const message = parseDaaSError(err);
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  /** Create a policy. `name` is required. */
  const createPolicy = useCallback(async (
    data: Partial<Policy> & { name: string }
  ): Promise<Policy> => {
    setLoading(true);
    setError(null);

    try {
      const result = await apiRequest<{ data: Policy }>('/api/policies', {
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

  /** Update a policy. */
  const updatePolicy = useCallback(async (
    id: string,
    data: Partial<Policy>
  ): Promise<Policy> => {
    setLoading(true);
    setError(null);

    try {
      const result = await apiRequest<{ data: Policy }>(`/api/policies/${id}`, {
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

  /** Delete a policy. */
  const deletePolicy = useCallback(async (id: string): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      await apiRequest(`/api/policies/${id}`, { method: 'DELETE' });
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
    fetchPolicies,
    getPolicy,
    getMyPolicies,
    createPolicy,
    updatePolicy,
    deletePolicy,
  };
}

export default usePolicies;
