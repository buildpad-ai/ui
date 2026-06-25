'use client';

import { useState, useCallback } from 'react';
import { buildApiUrl, getApiHeaders, apiRequest } from '@buildpad/services';

/**
 * File upload options
 */
export interface FileUploadOptions {
  /** Storage location */
  storage?: string;
  /** Optional folder to place file in */
  folder?: string;
  /** Custom title */
  title?: string;
  /** Description */
  description?: string;
  /** Progress callback */
  onProgress?: (progress: number) => void;
}

/**
 * DaaS file representation
 */
export interface DaaSFile {
  id: string;
  storage: string;
  filename_disk: string | null;
  filename_download: string;
  title: string | null;
  type: string | null;
  folder: string | null;
  uploaded_by: string | null;
  uploaded_on: string | null;
  modified_on?: string;
  filesize: number;
  width?: number | null;
  height?: number | null;
  duration?: number | null;
  description?: string | null;
  location?: string | null;
  tags?: string[] | null;
  focal_point_x?: number | null;
  focal_point_y?: number | null;
}

/**
 * File upload result matching the Upload component's FileUpload interface
 */
export interface FileUpload {
  id: string;
  filename_download: string;
  filename_disk: string;
  type: string;
  filesize: number;
  storage?: string;
  width?: number;
  height?: number;
  duration?: number;
  title?: string;
  description?: string;
  folder?: string;
  location?: string;
  tags?: string[];
  focal_point_x?: number;
  focal_point_y?: number;
  uploaded_on: string;
  uploaded_by: string;
  modified_on?: string;
}

/**
 * Convert DaaSFile to FileUpload format
 */
function toFileUpload(file: DaaSFile): FileUpload {
  return {
    id: file.id,
    filename_download: file.filename_download,
    filename_disk: file.filename_disk || file.filename_download,
    type: file.type || 'application/octet-stream',
    filesize: file.filesize,
    storage: file.storage || undefined,
    width: file.width || undefined,
    height: file.height || undefined,
    duration: file.duration || undefined,
    title: file.title || undefined,
    description: file.description || undefined,
    folder: file.folder || undefined,
    location: file.location || undefined,
    tags: file.tags || undefined,
    focal_point_x: file.focal_point_x ?? undefined,
    focal_point_y: file.focal_point_y ?? undefined,
    uploaded_on: file.uploaded_on || new Date().toISOString(),
    uploaded_by: file.uploaded_by || '',
    modified_on: file.modified_on || undefined,
  };
}

/**
 * Hook for file operations - upload, fetch, import
 * Integrates with the DaaS Files API
 */
export function useFiles() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Upload files to the server
   */
  const uploadFiles = useCallback(async (
    files: File[],
    options: FileUploadOptions = {}
  ): Promise<FileUpload[]> => {
    setLoading(true);
    setError(null);
    
    const uploadedFiles: FileUpload[] = [];
    
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        
        if (options.folder) {
          formData.append('folder', options.folder);
        }
        if (options.title) {
          formData.append('title', options.title);
        }
        if (options.description) {
          formData.append('description', options.description);
        }
        if (options.storage) {
          formData.append('storage', options.storage);
        }
        
        // Build URL and headers using DaaS configuration
        const url = buildApiUrl('/api/files');
        const baseHeaders = getApiHeaders();
        // Remove Content-Type as FormData sets its own boundary
        const { 'Content-Type': _contentType, ...headers } = baseHeaders;
        
        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: formData,
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ errors: [{ message: 'Upload failed' }] }));
          throw new Error(errorData.errors?.[0]?.message || 'Failed to upload file');
        }
        
        const { data } = await response.json();
        uploadedFiles.push(toFileUpload(data));
        
        // Call progress callback if provided
        if (options.onProgress) {
          const progress = ((uploadedFiles.length) / files.length) * 100;
          options.onProgress(progress);
        }
      }
      
      return uploadedFiles;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to upload files';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Fetch files from library with optional filters
   */
  const fetchFiles = useCallback(async (params: {
    page?: number;
    limit?: number;
    search?: string;
    folder?: string;
    filter?: Record<string, unknown>;
  } = {}): Promise<{ files: FileUpload[]; total: number }> => {
    setLoading(true);
    setError(null);
    
    try {
      const queryParams = new URLSearchParams();
      
      const limit = params.limit || 25;
      const page = params.page || 1;
      const offset = (page - 1) * limit;
      
      queryParams.set('limit', limit.toString());
      queryParams.set('offset', offset.toString());
      queryParams.set('meta', 'total_count');
      
      if (params.search) {
        queryParams.set('search', params.search);
      }
      
      // Build filter
      const filter: Record<string, unknown> = params.filter || {};
      if (params.folder) {
        filter.folder = { _eq: params.folder };
      } else if (!params.filter?.folder) {
        // Default to root folder if no folder specified
        // filter.folder = { _null: true };
      }
      
      if (Object.keys(filter).length > 0) {
        queryParams.set('filter', JSON.stringify(filter));
      }
      
      const result = await apiRequest<{ data: DaaSFile[]; meta?: { total_count?: number } }>(
        `/api/files?${queryParams.toString()}`
      );
      
      return {
        files: (result.data || []).map(toFileUpload),
        total: result.meta?.total_count || result.data?.length || 0,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch files';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Import file from URL
   */
  const importFromUrl = useCallback(async (
    url: string,
    options: { folder?: string; title?: string; description?: string } = {}
  ): Promise<FileUpload> => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await apiRequest<{ data: DaaSFile }>('/api/files/import', {
        method: 'POST',
        body: JSON.stringify({
          url,
          data: {
            folder: options.folder,
            title: options.title,
            description: options.description,
          },
        }),
      });
      
      return toFileUpload(result.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to import file';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Get a single file by ID
   */
  const getFile = useCallback(async (id: string): Promise<FileUpload> => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await apiRequest<{ data: DaaSFile }>(`/api/files/${id}`);
      return toFileUpload(result.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch file';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Update file metadata
   */
  const updateFile = useCallback(async (
    id: string,
    data: {
      title?: string;
      description?: string;
      folder?: string | null;
      tags?: string[];
      location?: string;
      filename_download?: string;
      focal_point_x?: number | null;
      focal_point_y?: number | null;
    }
  ): Promise<FileUpload> => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await apiRequest<{ data: DaaSFile }>(`/api/files/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
      
      return toFileUpload(result.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update file';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Delete a file
   */
  const deleteFile = useCallback(async (id: string): Promise<void> => {
    setLoading(true);
    setError(null);
    
    try {
      await apiRequest(`/api/files/${id}`, {
        method: 'DELETE',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete file';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Delete multiple files
   */
  const deleteFiles = useCallback(async (ids: string[]): Promise<void> => {
    setLoading(true);
    setError(null);
    
    try {
      await apiRequest('/api/files', {
        method: 'DELETE',
        body: JSON.stringify({ keys: ids }),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete files';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Replace the binary contents of an existing file (keeps the same id/metadata).
   */
  const replaceFile = useCallback(async (
    id: string,
    file: File
  ): Promise<FileUpload> => {
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const url = buildApiUrl(`/api/files/${id}`);
      const baseHeaders = getApiHeaders();
      // FormData sets its own multipart boundary — drop Content-Type.
      const { 'Content-Type': _contentType, ...headers } = baseHeaders;

      const response = await fetch(url, {
        method: 'PATCH',
        headers,
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ errors: [{ message: 'Replace failed' }] }));
        throw new Error(errorData.errors?.[0]?.message || 'Failed to replace file');
      }

      const { data } = await response.json();
      return toFileUpload(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to replace file';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Get a (typically signed, time-limited) download URL for a file.
   * Falls back to the direct asset URL with `?download` when the
   * dedicated download endpoint is unavailable.
   */
  const getDownloadUrl = useCallback(async (
    id: string,
    expiresIn = 3600
  ): Promise<string> => {
    try {
      const result = await apiRequest<{ url?: string }>(
        `/api/files/${id}/download?expires_in=${expiresIn}`
      );
      if (result?.url) return result.url;
    } catch {
      // Endpoint not available — fall back to the direct asset route.
    }
    return `/api/assets/${id}?download`;
  }, []);

  return {
    loading,
    error,
    uploadFiles,
    fetchFiles,
    importFromUrl,
    getFile,
    updateFile,
    replaceFile,
    getDownloadUrl,
    deleteFile,
    deleteFiles,
  };
}

export default useFiles;
