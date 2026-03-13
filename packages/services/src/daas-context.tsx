'use client';

import { createContext, useContext, useMemo, useState, useEffect, useCallback, type ReactNode } from 'react';

/**
 * DaaS Configuration
 *
 * Configuration for direct DaaS API access.
 * The browser calls the DaaS backend directly — no Next.js proxy needed.
 * CORS is handled on the DaaS side via the CORS_ORIGINS env variable.
 *
 * Authentication: provide a static `token` (Storybook/testing) or a `getToken`
 * async callback (Next.js apps using Supabase session JWT).
 */
export interface DaaSConfig {
  /** DaaS API base URL, e.g. https://xxx.buildpad-daas.xtremax.com */
  url: string;
  /** Static auth token — for Storybook or programmatic access only. */
  token?: string;
  /**
   * Async function to retrieve the current auth token dynamically.
   * Use in Next.js apps: `() => supabase.auth.getSession().then(s => s.data.session?.access_token ?? null)`
   * Refreshed on mount and whenever `onAuthChange` is triggered.
   * If both `token` and `getToken` are provided, `token` takes precedence.
   */
  getToken?: () => Promise<string | null>;
}

/**
 * Authenticated user from DaaS
 */
export interface DaaSUser {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  avatar: string | null;
  status: string;
  role: string | null;
  admin_access: boolean;
  language?: string;
  theme?: string;
}

/**
 * DaaS Context Value
 */
export interface DaaSContextValue {
  /** DaaS configuration */
  config: DaaSConfig | null;
  /** Build full DaaS URL for a path (always direct, never proxy) */
  buildUrl: (path: string) => string;
  /** Get synchronous auth headers using the currently-stored token */
  getHeaders: () => Record<string, string>;
  /** Async: refresh the stored token by calling config.getToken() */
  refreshToken: () => Promise<void>;
  /** Current authenticated user (null if not authenticated) */
  user: DaaSUser | null;
  /** Whether user is admin */
  isAdmin: boolean;
  /** Whether auth is loading */
  authLoading: boolean;
  /** Auth error if any */
  authError: string | null;
  /** Refresh current user */
  refreshUser: () => Promise<void>;
}

const DaaSContext = createContext<DaaSContextValue | null>(null);

/**
 * DaaSProvider Props
 */
export interface DaaSProviderProps {
  /** DaaS configuration. URL falls back to `NEXT_PUBLIC_BUILDPAD_DAAS_URL` env var. */
  config?: DaaSConfig | null;
  /** Auto-fetch user on mount (default: true) */
  autoFetchUser?: boolean;
  /** Callback when user is authenticated */
  onAuthenticated?: (user: DaaSUser) => void;
  /** Callback when auth fails */
  onAuthError?: (error: Error) => void;
  children: ReactNode;
}

/**
 * DaaSProvider
 *
 * Configures global DaaS URL and authentication for all services and components.
 * The browser calls DaaS directly — no proxy routes are used.
 *
 * @example
 * ```tsx
 * // In Next.js app layout (Supabase JWT)
 * import { createBrowserClient } from '@supabase/ssr';
 * const supabase = createBrowserClient(
 *   process.env.NEXT_PUBLIC_SUPABASE_URL!,
 *   process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
 * );
 *
 * <DaaSProvider
 *   config={{
 *     url: process.env.NEXT_PUBLIC_BUILDPAD_DAAS_URL!,
 *     getToken: () => supabase.auth.getSession().then(({ data }) => data.session?.access_token ?? null),
 *   }}
 * >
 *   <App />
 * </DaaSProvider>
 *
 * // In Storybook or testing with static token
 * <DaaSProvider
 *   config={{ url: 'https://xxx.buildpad-daas.xtremax.com', token: 'your-static-token' }}
 * >
 *   <VForm collection="articles" />
 * </DaaSProvider>
 * ```
 */
export function DaaSProvider({
  config,
  children,
  autoFetchUser = true,
  onAuthenticated,
  onAuthError,
}: DaaSProviderProps) {
  // Resolve URL: from prop or from env var
  const resolvedUrl = config?.url ?? (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_BUILDPAD_DAAS_URL : undefined) ?? null;

  // Token storage: static token wins; otherwise dynamic from getToken()
  const [dynamicToken, setDynamicToken] = useState<string | null>(null);
  const effectiveToken = config?.token ?? dynamicToken;

  const [user, setUser] = useState<DaaSUser | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  /** Refresh the stored dynamic token */
  const refreshToken = useCallback(async () => {
    if (config?.token) return; // static token — nothing to refresh
    if (!config?.getToken) return;
    const tok = await config.getToken();
    setDynamicToken(tok ?? null);
  }, [config]);

  // Initial token fetch
  useEffect(() => {
    refreshToken();
  }, [refreshToken]);

  /** Build a full DaaS URL from a path like /api/items/orders */
  const buildUrl = useCallback((path: string): string => {
    if (!resolvedUrl) {
      throw new Error(
        'DaaS URL is not configured. Set NEXT_PUBLIC_BUILDPAD_DAAS_URL or provide config.url to DaaSProvider.'
      );
    }
    const baseUrl = resolvedUrl.replace(/\/$/, '');
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${baseUrl}${cleanPath}`;
  }, [resolvedUrl]);

  /** Sync headers using the currently-stored token */
  const getHeaders = useCallback((): Record<string, string> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (effectiveToken) headers['Authorization'] = `Bearer ${effectiveToken}`;
    return headers;
  }, [effectiveToken]);

  /** Fetch current user */
  const refreshUser = useCallback(async (): Promise<void> => {
    if (!resolvedUrl) return;
    try {
      setAuthLoading(true);
      setAuthError(null);

      const response = await fetch(buildUrl('/api/auth/me'), {
        headers: getHeaders(),
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 401) { setUser(null); return; }
        throw new Error(`Authentication failed: ${response.status}`);
      }

      const data = await response.json();
      const userData = data.data || data;
      setUser(userData);
      onAuthenticated?.(userData);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Authentication failed';
      setAuthError(msg);
      setUser(null);
      onAuthError?.(err instanceof Error ? err : new Error(msg));
    } finally {
      setAuthLoading(false);
    }
  }, [resolvedUrl, buildUrl, getHeaders, onAuthenticated, onAuthError]);

  useEffect(() => {
    if (autoFetchUser && resolvedUrl) {
      refreshUser();
    }
  }, [autoFetchUser, resolvedUrl, effectiveToken]); // re-run when token changes

  const value = useMemo<DaaSContextValue>(() => ({
    config: config ?? null,
    buildUrl,
    getHeaders,
    refreshToken,
    user,
    isAdmin: user?.admin_access ?? false,
    authLoading,
    authError,
    refreshUser,
  }), [config, buildUrl, getHeaders, refreshToken, user, authLoading, authError, refreshUser]);

  return (
    <DaaSContext.Provider value={value}>
      {children}
    </DaaSContext.Provider>
  );
}

/**
 * Hook to access DaaS context.
 * Throws if used outside a DaaSProvider.
 */
export function useDaaSContext(): DaaSContextValue {
  const context = useContext(DaaSContext);
  if (!context) {
    throw new Error('useDaaSContext must be used inside a <DaaSProvider>. Wrap your root layout with DaaSProvider.');
  }
  return context;
}

/**
 * Hook to check if DaaS is configured and ready.
 */
export function useIsDaaSReady(): boolean {
  const context = useContext(DaaSContext);
  return Boolean(context?.config?.url ?? process.env.NEXT_PUBLIC_BUILDPAD_DAAS_URL);
}

// ---------------------------------------------------------------------------
// Global (non-React) helpers — for services called outside React components
// ---------------------------------------------------------------------------

let globalDaaSConfig: DaaSConfig | null = null;

/** Set global DaaS config for non-React contexts (e.g. server actions, test setup) */
export function setGlobalDaaSConfig(config: DaaSConfig | null) {
  globalDaaSConfig = config;
}

/** Get global DaaS config */
export function getGlobalDaaSConfig(): DaaSConfig | null {
  return globalDaaSConfig;
}

/**
 * Build full DaaS URL for a path (non-React, reads global config or env var).
 * Path should include the full route, e.g. `/api/items/orders`.
 */
export function buildApiUrl(path: string, config?: DaaSConfig | null): string {
  const effectiveConfig = config ?? globalDaaSConfig;
  const baseUrl =
    effectiveConfig?.url ??
    (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_BUILDPAD_DAAS_URL : undefined);

  if (!baseUrl) {
    throw new Error(
      'DaaS URL is not configured. Set NEXT_PUBLIC_BUILDPAD_DAAS_URL or call setGlobalDaaSConfig().'
    );
  }

  const cleanBase = baseUrl.replace(/\/$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${cleanBase}${cleanPath}`;
}

/**
 * Get auth headers for the given config (non-React, sync).
 * Returns Bearer token header if token is available in config.
 * For dynamic tokens (getToken callback), this returns no auth header —
 * use `getApiHeadersAsync` for reliable token access.
 */
export function getApiHeaders(config?: DaaSConfig | null): Record<string, string> {
  const effectiveConfig = config ?? globalDaaSConfig;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (effectiveConfig?.token) {
    headers['Authorization'] = `Bearer ${effectiveConfig.token}`;
  }
  return headers;
}

/**
 * Get auth headers async — calls `getToken()` callback if no static token.
 * Use this in services when dynamic JWT tokens are needed.
 */
export async function getApiHeadersAsync(config?: DaaSConfig | null): Promise<Record<string, string>> {
  const effectiveConfig = config ?? globalDaaSConfig;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (effectiveConfig?.token) {
    headers['Authorization'] = `Bearer ${effectiveConfig.token}`;
  } else if (effectiveConfig?.getToken) {
    const tok = await effectiveConfig.getToken();
    if (tok) headers['Authorization'] = `Bearer ${tok}`;
  }

  return headers;
}

/** @deprecated Use useDaaSContext() instead. Kept for backward compatibility. */
export function useIsDirectDaaSMode(): boolean {
  const context = useContext(DaaSContext);
  return Boolean(context);
}
