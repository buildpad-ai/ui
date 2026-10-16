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
 * What `apiRequest` throws for a response that is not OK.
 *
 * `message` keeps the text callers already parse,
 * `API error: <status> - <body>`. The parts are also fields, so a caller can
 * show the backend's own sentence (`detail`) and read per-field validation
 * errors (`errors`) without parsing the message.
 */
export class ApiRequestError extends Error {
  /** HTTP status of the response. */
  readonly status: number;
  /** The response body as text. */
  readonly body: string;
  /**
   * The `errors` array of a DaaS error body
   * (`{ errors: [{ message, extensions: { code, field } }] }`), when it has one.
   */
  readonly errors?: unknown[];
  /**
   * The backend's own sentence: the first `errors[].message`, else the body's
   * `error`, else its `message`; null when the body carries none of them
   * (not JSON, or another shape).
   */
  readonly detail: string | null;

  constructor(status: number, body: string) {
    super(`API error: ${status} - ${body}`);
    // Keeps `instanceof` true when the class is compiled down to ES5.
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = 'ApiRequestError';
    this.status = status;
    this.body = body;

    let parsed: unknown = null;
    try {
      parsed = JSON.parse(body);
    } catch {
      // Not JSON: no fields to read.
    }
    const record = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
    if (Array.isArray(record.errors)) this.errors = record.errors;
    const first = this.errors?.[0] as { message?: unknown } | undefined;
    const candidates = [first?.message, record.error, record.message];
    const sentence = candidates.find((c): c is string => typeof c === 'string' && c.trim() !== '');
    this.detail = sentence ?? null;
  }
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
    throw new ApiRequestError(response.status, error);
  }

  // Handle 204 No Content (e.g. DELETE responses)
  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return undefined as T;
  }

  const text = await response.text();
  if (!text) return undefined as T;
  return JSON.parse(text);
}
