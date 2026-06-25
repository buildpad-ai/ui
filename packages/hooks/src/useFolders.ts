'use client';

import { useState, useCallback } from 'react';
import { apiRequest } from '@buildpad/services';

/**
 * Folder representation for organizing files.
 */
export interface Folder {
  id: string;
  name: string;
  parent: string | null;
}

/**
 * Parameters for listing folders.
 */
export interface FetchFoldersParams {
  /** Limit results to children of this folder. Pass `null` for root-level folders. */
  parent?: string | null;
  /** Free-text search on folder name. */
  search?: string;
}

/**
 * Hook for folder operations - list, create, rename/move, delete.
 * Integrates with the DaaS Folders API via the /api/folders proxy routes.
 */
export function useFolders() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch folders, optionally scoped to a parent folder.
   */
  const fetchFolders = useCallback(async (
    params: FetchFoldersParams = {}
  ): Promise<Folder[]> => {
    setLoading(true);
    setError(null);

    try {
      const queryParams = new URLSearchParams();
      queryParams.set('sort', 'name');
      // Note: the DaaS folders endpoint rejects `limit=-1`; use a high finite cap.
      queryParams.set('limit', '1000');

      if (params.search) {
        queryParams.set('search', params.search);
      }

      // Only apply a parent filter when not searching (search spans all folders).
      if (!params.search && params.parent !== undefined) {
        const filter =
          params.parent === null
            ? { parent: { _null: true } }
            : { parent: { _eq: params.parent } };
        queryParams.set('filter', JSON.stringify(filter));
      }

      const result = await apiRequest<{ data: Folder[] }>(
        `/api/folders?${queryParams.toString()}`
      );

      return result.data || [];
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch folders';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Create a folder.
   */
  const createFolder = useCallback(async (
    data: { name: string; parent?: string | null }
  ): Promise<Folder> => {
    setLoading(true);
    setError(null);

    try {
      const result = await apiRequest<{ data: Folder }>('/api/folders', {
        method: 'POST',
        body: JSON.stringify({ name: data.name, parent: data.parent ?? null }),
      });

      return result.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create folder';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Rename or move a folder.
   */
  const updateFolder = useCallback(async (
    id: string,
    data: { name?: string; parent?: string | null }
  ): Promise<Folder> => {
    setLoading(true);
    setError(null);

    try {
      const result = await apiRequest<{ data: Folder }>(`/api/folders/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });

      return result.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update folder';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Delete a folder.
   */
  const deleteFolder = useCallback(async (id: string): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      await apiRequest(`/api/folders/${id}`, { method: 'DELETE' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete folder';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    fetchFolders,
    createFolder,
    updateFolder,
    deleteFolder,
  };
}

export default useFolders;
