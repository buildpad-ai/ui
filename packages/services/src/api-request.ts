/**
 * API Request Helper
 *
 * Makes requests directly to the DaaS backend.
 * The browser calls DaaS directly — no proxy routes are used.
 * Configure via DaaSProvider (React) or setGlobalDaaSConfig (non-React).
 *
 * CORS is handled on the DaaS side via the CORS_ORIGINS environment variable.
 */

import { buildApiUrl, getApiHeadersAsync, type DaaSConfig } from './daas-context';

export interface ApiRequestOptions extends RequestInit {
  /** Optional DaaS config override */
  daasConfig?: DaaSConfig | null;
}

/**
 * Make a request directly to the DaaS backend.
 * Automatically resolves the full DaaS URL and includes the auth token.
 */
export async function apiRequest<T = unknown>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const { daasConfig, ...fetchOptions } = options;

  // Build full DaaS URL from path (e.g. /api/items/orders → https://daas.example.com/api/items/orders)
  const url = buildApiUrl(path, daasConfig);

  // Get auth headers (async — resolves dynamic Supabase JWT if needed)
  const headers = await getApiHeadersAsync(daasConfig);
  
  const response = await fetch(url, {
    ...fetchOptions,
    headers: {
      ...headers,
      ...fetchOptions.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API error: ${response.status} - ${error}`);
  }

  // Handle 204 No Content (e.g. DELETE responses)
  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return undefined as T;
  }

  const text = await response.text();
  if (!text) return undefined as T;
  return JSON.parse(text);
}
