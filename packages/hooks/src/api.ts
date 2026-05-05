/**
 * DaaS-compatible API helpers
 * 
 * These provide a typed interface for the DaaS API.
 * Supports both proxy mode (Next.js apps) and direct DaaS mode (Storybook/testing).
 */

export interface DaaSAPIConfig {
  baseUrl?: string;
  token?: string;
}

export interface QueryParams {
  fields?: string[];
  filter?: Record<string, unknown>;
  search?: string;
  limit?: number;
  offset?: number;
  page?: number;
  sort?: string[];
  meta?: string;
  version?: string;
}

export interface ListResponse<T> {
  data: T[];
  meta?: {
    total_count?: number;
    filter_count?: number;
    page?: number;
    limit?: number;
  };
}

/**
 * DaaS file representation - matches the actual DaaS API response
 */
export interface DaaSFile {
  id: string;
  storage: string;
  filename_disk: string | null;
  filename_download: string;
  title: string | null;
  description?: string | null;
  type: string | null;
  filesize: number;
  width?: number | null;
  height?: number | null;
  uploaded_on: string | null;
  uploaded_by: string | null;
  modified_on?: string;
  folder: string | null;
  tags?: string[] | null;
}

/**
 * User representation
 */
export interface DaaSUser {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  avatar: string | null;
  status: string;
  role?: string | null;
  roles?: { id: string; name: string; icon?: string | null }[];
  admin_access: boolean;
  language: string;
  theme: string;
  created_at: string;
  updated_at: string;
}

/**
 * Permission representation
 */
export interface DaaSPermission {
  id: string;
  policy: string;
  collection: string;
  action: 'create' | 'read' | 'update' | 'delete' | 'share';
  fields: string[] | null;
  permissions: Record<string, unknown> | null;
  validation: Record<string, unknown> | null;
  presets: Record<string, unknown> | null;
}

/**
 * Aggregated permissions for a collection
 */
export interface CollectionPermissions {
  create?: boolean;
  read?: boolean;
  update?: boolean;
  delete?: boolean;
  share?: boolean;
}

/**
 * DaaS API helper class
 * Provides methods for common API operations
 */
class DaaSAPI {
  private baseUrl: string;
  private token: string | null;

  constructor(config: DaaSAPIConfig = {}) {
    this.baseUrl = config.baseUrl || '/api';
    this.token = config.token || null;
  }

  /**
   * Set authorization token
   */
  setToken(token: string | null): void {
    this.token = token;
  }

  /**
   * Generic GET request with options (for downloading files/assets)
   */
  async get(path: string, options?: { responseType?: 'arraybuffer' | 'blob'; params?: Record<string, unknown> }): Promise<{ data: ArrayBuffer | Blob; headers: Record<string, string> }> {
    const url = new URL(`${this.baseUrl}${path}`, window.location.origin);
    if (options?.params) {
      Object.entries(options.params).forEach(([key, value]) => {
        url.searchParams.set(key, String(value));
      });
    }
    const headers: HeadersInit = {};
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    const response = await fetch(url.toString(), { headers });
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });
    if (options?.responseType === 'blob') {
      return { data: await response.blob(), headers: responseHeaders };
    }
    return { data: await response.arrayBuffer(), headers: responseHeaders };
  }

  private async request<T>(path: string, options: RequestInit = {}, fullEnvelope = false): Promise<T> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return fullEnvelope ? data : (data.data ?? data);
  }

  /**
   * Get items from a collection
   */
  async getItems<T = unknown>(collection: string, params?: QueryParams): Promise<T[]> {
    const query = new URLSearchParams();
    if (params?.fields) query.set('fields', params.fields.join(','));
    if (params?.filter) query.set('filter', JSON.stringify(params.filter));
    if (params?.search) query.set('search', params.search);
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    if (params?.page) query.set('page', String(params.page));
    if (params?.sort) query.set('sort', params.sort.join(','));
    if (params?.meta) query.set('meta', params.meta);

    const queryString = query.toString();
    const path = `/items/${collection}${queryString ? `?${queryString}` : ''}`;
    return this.request<T[]>(path);
  }

  /**
   * Get items with metadata
   */
  async getItemsWithMeta<T = unknown>(collection: string, params?: QueryParams): Promise<ListResponse<T>> {
    const query = new URLSearchParams();
    if (params?.fields) query.set('fields', params.fields.join(','));
    if (params?.filter) query.set('filter', JSON.stringify(params.filter));
    if (params?.search) query.set('search', params.search);
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    if (params?.page) query.set('page', String(params.page));
    if (params?.sort) query.set('sort', params.sort.join(','));
    query.set('meta', params?.meta || '*');

    const queryString = query.toString();
    const path = `/items/${collection}?${queryString}`;
    
    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: this.token ? { 'Authorization': `Bearer ${this.token}` } : {},
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Get a single item by ID
   */
  async getItem<T = unknown>(collection: string, id: string | number, params?: QueryParams): Promise<T> {
    const query = new URLSearchParams();
    if (params?.fields) query.set('fields', params.fields.join(','));
    if (params?.version) query.set('version', params.version);

    const queryString = query.toString();
    const path = `/items/${collection}/${id}${queryString ? `?${queryString}` : ''}`;
    return this.request<T>(path);
  }

  /**
   * Create a new item
   */
  async createItem<T = unknown>(collection: string, data: Record<string, unknown>): Promise<T> {
    return this.request<T>(`/items/${collection}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Update an existing item
   */
  async updateItem<T = unknown>(collection: string, id: string | number, data: Record<string, unknown>): Promise<T> {
    return this.request<T>(`/items/${collection}/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  /**
   * Upsert an item (create or update)
   */
  async upsertItem<T = unknown>(collection: string, id: string | number, data: Record<string, unknown>): Promise<T> {
    return this.request<T>(`/items/${collection}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  /**
   * Delete an item
   */
  async deleteItem(collection: string, id: string | number): Promise<void> {
    await this.request(`/items/${collection}/${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * Batch update items matching a filter
   */
  async batchUpdateItems<T = unknown>(
    collection: string,
    filter: Record<string, unknown>,
    data: Record<string, unknown>
  ): Promise<{ updated: number; keys: string[] }> {
    const query = new URLSearchParams();
    query.set('filter', JSON.stringify(filter));
    
    return this.request(`/items/${collection}?${query.toString()}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  /**
   * Batch delete items matching a filter
   */
  async batchDeleteItems(
    collection: string,
    filter: Record<string, unknown>
  ): Promise<{ deleted: number; keys: string[] }> {
    const query = new URLSearchParams();
    query.set('filter', JSON.stringify(filter));
    
    return this.request(`/items/${collection}?${query.toString()}`, {
      method: 'DELETE',
    });
  }

  // ==================== Users API ====================

  /**
   * Get current user
   */
  async getMe(params?: QueryParams): Promise<DaaSUser> {
    const query = new URLSearchParams();
    if (params?.fields) query.set('fields', params.fields.join(','));
    
    const queryString = query.toString();
    const path = `/users/me${queryString ? `?${queryString}` : ''}`;
    return this.request<DaaSUser>(path);
  }

  /**
   * Update current user
   */
  async updateMe(data: Partial<DaaSUser>): Promise<DaaSUser> {
    return this.request<DaaSUser>('/users/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  /**
   * Get users
   */
  async getUsers(params?: QueryParams): Promise<DaaSUser[]> {
    return this.getItems<DaaSUser>('daas_users', params);
  }

  /**
   * Get user by ID
   */
  async getUser(id: string, params?: QueryParams): Promise<DaaSUser> {
    return this.getItem<DaaSUser>('daas_users', id, params);
  }

  // ==================== Permissions API ====================

  /**
   * Get current user's permissions
   * Uses fullEnvelope=true to preserve the outer { data, isAdmin } wrapper that
   * this.request would otherwise strip via its default data.data ?? data unwrapping.
   */
  async getMyPermissions(): Promise<{ data: Record<string, Record<string, unknown>>; isAdmin: boolean }> {
    return this.request('/permissions/me', {}, true);
  }

  /**
   * Check if current user can perform action on collection
   */
  async checkPermission(collection: string, action: 'create' | 'read' | 'update' | 'delete'): Promise<boolean> {
    try {
      const { data, isAdmin } = await this.getMyPermissions();
      if (isAdmin) return true;
      // If the collection has no explicit permissions entry, fail open (DaaS enforces at API level)
      if (!data || Object.keys(data).length === 0) return true;
      return !!data[collection]?.[action];
    } catch {
      return true;
    }
  }

  /**
   * Get collection permissions for current user
   */
  async getCollectionPermissions(collection: string): Promise<CollectionPermissions> {
    try {
      const { data, isAdmin } = await this.getMyPermissions();
      if (isAdmin) {
        return { create: true, read: true, update: true, delete: true, share: true };
      }
      const perms = data[collection] || {};
      return {
        create: !!perms.create,
        read: !!perms.read,
        update: !!perms.update,
        delete: !!perms.delete,
        share: !!perms.share,
      };
    } catch {
      return { create: true, read: true, update: true, delete: true, share: true };
    }
  }

  // ==================== Files API ====================

  /**
   * Get a file by ID
   */
  async getFile(id: string): Promise<DaaSFile> {
    return this.request<DaaSFile>(`/files/${id}`);
  }

  /**
   * Get files with optional filtering
   */
  async getFiles(params?: QueryParams & { folder?: string }): Promise<DaaSFile[]> {
    const query = new URLSearchParams();
    if (params?.fields) query.set('fields', params.fields.join(','));
    if (params?.filter) query.set('filter', JSON.stringify(params.filter));
    if (params?.search) query.set('search', params.search);
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.page) query.set('page', String(params.page));
    if (params?.sort) query.set('sort', params.sort.join(','));
    if (params?.folder) query.set('folder', params.folder);
    
    const queryString = query.toString();
    const path = `/files${queryString ? `?${queryString}` : ''}`;
    return this.request<DaaSFile[]>(path);
  }

  /**
   * Update a file's metadata
   */
  async updateFile(id: string, data: Partial<DaaSFile>): Promise<DaaSFile> {
    return this.request<DaaSFile>(`/files/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  /**
   * Delete a file
   */
  async deleteFile(id: string): Promise<void> {
    await this.request(`/files/${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * Upload files
   */
  async uploadFiles(
    files: File[],
    options?: { folder?: string; onProgress?: (progress: number) => void }
  ): Promise<DaaSFile[]> {
    const results: DaaSFile[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const formData = new FormData();
      formData.append('file', file);
      if (options?.folder) {
        formData.append('folder', options.folder);
      }

      const response = await fetch(`${this.baseUrl}/files`, {
        method: 'POST',
        headers: this.token ? { Authorization: `Bearer ${this.token}` } : {},
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed for ${file.name}`);
      }

      const data = await response.json();
      results.push(data.data);
      
      options?.onProgress?.(((i + 1) / files.length) * 100);
    }

    return results;
  }

  /**
   * Import file from URL
   */
  async importFromUrl(url: string, data?: Partial<DaaSFile>): Promise<DaaSFile> {
    return this.request<DaaSFile>('/files/import', {
      method: 'POST',
      body: JSON.stringify({ url, data }),
    });
  }

  /**
   * Bulk update files
   */
  async bulkUpdateFiles(keys: string[], data: Partial<DaaSFile>): Promise<{ updated: number; keys: string[] }> {
    return this.request('/files', {
      method: 'PATCH',
      body: JSON.stringify({ keys, data }),
    });
  }

  /**
   * Bulk delete files
   */
  async bulkDeleteFiles(keys: string[]): Promise<{ deleted: number; keys: string[] }> {
    return this.request('/files', {
      method: 'DELETE',
      body: JSON.stringify({ keys }),
    });
  }

  /**
   * Get file URL (for displaying/downloading)
   */
  getFileUrl(id: string, transform?: { width?: number; height?: number; quality?: number; format?: string }): string {
    let url = `${this.baseUrl}/assets/${id}`;
    if (transform) {
      const params = new URLSearchParams();
      if (transform.width) params.set('width', String(transform.width));
      if (transform.height) params.set('height', String(transform.height));
      if (transform.quality) params.set('quality', String(transform.quality));
      if (transform.format) params.set('format', transform.format);
      const queryString = params.toString();
      if (queryString) url += `?${queryString}`;
    }
    return url;
  }

  // ==================== Versions API ====================

  /**
   * Get versions for an item
   */
  async getVersions(collection: string, itemId: string): Promise<unknown[]> {
    return this.getItems('daas_versions', {
      filter: { collection: { _eq: collection }, item: { _eq: itemId } },
      sort: ['-date_updated'],
    });
  }

  /**
   * Create a new version
   */
  async createVersion(data: {
    key: string;
    name?: string;
    collection: string;
    item: string;
  }): Promise<unknown> {
    return this.request('/versions', {
      method: 'POST',
      body: JSON.stringify({ ...data, delta: {} }),
    });
  }

  /**
   * Save changes to a version
   */
  async saveVersion(versionId: string, delta: Record<string, unknown>): Promise<unknown> {
    return this.request(`/versions/${versionId}/save`, {
      method: 'POST',
      body: JSON.stringify(delta),
    });
  }

  /**
   * Promote version to main item
   */
  async promoteVersion(versionId: string): Promise<unknown> {
    return this.request(`/versions/${versionId}/promote`, {
      method: 'POST',
    });
  }

  /**
   * Delete a version
   */
  async deleteVersion(versionId: string): Promise<void> {
    await this.request(`/versions/${versionId}`, {
      method: 'DELETE',
    });
  }

  // ==================== Workflow API ====================

  /**
   * Execute a workflow transition
   */
  async executeTransition(data: {
    instance: string;
    command: string;
    comment?: string;
  }): Promise<{ data: { success: boolean; previousState: string; currentState: string } }> {
    return this.request('/workflow/transition', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Get workflow instance for an item
   */
  async getWorkflowInstance(collection: string, itemId: string): Promise<unknown | null> {
    const instances = await this.getItems('daas_wf_instance', {
      filter: { collection: { _eq: collection }, item_id: { _eq: itemId } },
      limit: 1,
    });
    return instances[0] || null;
  }

  // ==================== Utilities API ====================

  /**
   * Generate a bcrypt hash
   */
  async generateHash(value: string): Promise<string> {
    const result = await this.request<{ data: string }>('/utils/hash/generate', {
      method: 'POST',
      body: JSON.stringify({ string: value }),
    });
    return typeof result === 'string' ? result : (result as { data?: string }).data || result as unknown as string;
  }

  /**
   * Verify a value against a hash
   */
  async verifyHash(value: string, hash: string): Promise<boolean> {
    const result = await this.request<boolean | { data: boolean }>('/utils/hash/verify', {
      method: 'POST',
      body: JSON.stringify({ string: value, hash }),
    });
    return typeof result === 'boolean' ? result : (result as { data?: boolean }).data ?? false;
  }

  /**
   * Generate a random string
   */
  async generateRandomString(length: number = 32): Promise<string> {
    const result = await this.request<string | { data: string }>(`/utils/random/string?length=${length}`);
    return typeof result === 'string' ? result : (result as { data?: string }).data || result as unknown as string;
  }

  // ==================== Collections & Schema API ====================

  /**
   * Get all collections
   */
  async getCollections(): Promise<unknown[]> {
    return this.request('/collections');
  }

  /**
   * Get collection by name
   */
  async getCollection(name: string): Promise<unknown> {
    return this.request(`/collections/${name}`);
  }

  /**
   * Get fields for a collection
   */
  async getFields(collection: string): Promise<unknown[]> {
    return this.request(`/fields/${collection}`);
  }

  /**
   * Get relations for a collection
   */
  async getRelations(collection?: string): Promise<unknown[]> {
    const path = collection ? `/relations/${collection}` : '/relations';
    return this.request(path);
  }

  /**
   * Get available interfaces
   */
  async getInterfaces(params?: { grouped?: boolean; type?: string; localType?: string }): Promise<unknown> {
    const query = new URLSearchParams();
    if (params?.grouped) query.set('grouped', 'true');
    if (params?.type) query.set('type', params.type);
    if (params?.localType) query.set('localType', params.localType);
    
    const queryString = query.toString();
    const path = `/interfaces${queryString ? `?${queryString}` : ''}`;
    return this.request(path);
  }
}

/**
 * Default API instance
 */
export const daasAPI = new DaaSAPI();

/**
 * Generic API helper (alias for daasAPI)
 */
export const api = daasAPI;

/**
 * Create a configured API instance
 */
export function createDaaSAPI(config: DaaSAPIConfig): DaaSAPI {
  return new DaaSAPI(config);
}
