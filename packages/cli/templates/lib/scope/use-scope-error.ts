/**
 * Scope Error Handler
 *
 * A React hook + typed error class for handling 400/403 scope-related API errors.
 *
 * Error codes:
 *  401  UNAUTHENTICATED   → redirect to /login
 *  403  FORBIDDEN         → show in-page error or redirect to /select-scope
 *  403  FORBIDDEN_SCOPE   → user has no role at the active scope → /select-scope
 *  400  INVALID_SCOPE     → stale/deleted scope in cookie → clear + /select-scope
 *
 * Usage:
 *   const handleScopeError = useScopeErrorHandler();
 *   scopedFetch('/api/items/orders').catch(err => handleScopeError(err));
 *
 * @buildpad/origin: scope-routes/use-scope-error
 * @buildpad/version: 1.0.0
 */

'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

export class ScopeError extends Error {
  constructor(public type: 'forbidden' | 'invalid_scope' | 'unauthenticated') {
    super(type);
    this.name = 'ScopeError';
  }
}

/**
 * Wraps fetch with scope-aware error handling.
 * Automatically clears the scope cookie on INVALID_SCOPE errors.
 *
 * Call with a full DaaS URL and proper headers:
 *   scopedFetch(buildUrl('/api/scope/items/orders'), {
 *     headers: { ...getHeaders(), 'X-Resource-Uri': resourceUri ?? '' },
 *   })
 */
export async function scopedFetch(url: string, options?: RequestInit): Promise<unknown> {
  const res = await fetch(url, { ...options });

  if (res.ok) return res.json();

  const body = await res.json().catch(() => ({}));
  const code: string = body?.errors?.[0]?.extensions?.code ?? '';

  switch (res.status) {
    case 401:
      throw new ScopeError('unauthenticated');

    case 403:
      // FORBIDDEN_SCOPE: no role at this scope; FORBIDDEN: role exists but no permission
      throw new ScopeError('forbidden');

    case 400:
      if (code === 'INVALID_SCOPE') {
        // Stale or deleted scope in cookie — clear it before throwing
        document.cookie = 'daas_resource_uri=; path=/; max-age=0';
        throw new ScopeError('invalid_scope');
      }
      throw new Error(body?.errors?.[0]?.message ?? `Bad request (${res.status})`);

    default:
      throw new Error(body?.errors?.[0]?.message ?? `Request failed (${res.status})`);
  }
}

/**
 * Returns a stable callback that routes scope errors to the correct page.
 * Returns `true` if the error was handled, `false` if it was an unrelated error.
 *
 * @example
 * const handleScopeError = useScopeErrorHandler();
 * someApiCall().catch(err => {
 *   if (!handleScopeError(err)) console.error('Unexpected:', err);
 * });
 */
export function useScopeErrorHandler() {
  const router = useRouter();

  return useCallback(
    (error: unknown): boolean => {
      if (!(error instanceof ScopeError)) return false;

      switch (error.type) {
        case 'unauthenticated':
          router.push('/login');
          break;
        case 'forbidden':
          // User switched to a scope their roles don't cover
          router.push('/select-scope?error=access_denied');
          break;
        case 'invalid_scope':
          // Cookie was stale — already cleared by scopedFetch
          router.push('/select-scope?error=invalid_scope');
          break;
      }
      return true;
    },
    [router],
  );
}
