/**
 * useAuth Hook
 * 
 * Client-side authentication hook following DaaS architecture.
 * Supports multiple authentication methods:
 * 1. Cookie-Based Sessions - For browser requests (automatic)
 * 2. Static Tokens - For programmatic access (DaaS-style)
 * 
 * @module @buildpad/hooks/useAuth
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useDaaSContext } from './useDaaSContext';

/**
 * User profile returned from /api/users/me
 */
export interface AuthUser {
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
}

/**
 * Authentication state
 */
export interface AuthState {
  /** Current authenticated user (null if not authenticated) */
  user: AuthUser | null;
  /** Whether the user has admin access */
  isAdmin: boolean;
  /** Whether authentication is in progress */
  loading: boolean;
  /** Authentication error if any */
  error: string | null;
  /** Whether the user is authenticated */
  isAuthenticated: boolean;
}

/**
 * Authentication methods
 */
export interface AuthMethods {
  /** Refresh the current user data */
  refresh: () => Promise<void>;
  /** Logout (clears token, doesn't affect cookie sessions) */
  logout: () => void;
  /** Set static token for authentication */
  setToken: (token: string | null) => void;
  /** Check if user has permission for an action */
  checkPermission: (collection: string, action: string) => Promise<boolean>;
}

/**
 * useAuth return type
 */
export interface UseAuthReturn extends AuthState, AuthMethods {}

/**
 * useAuth options
 */
export interface UseAuthOptions {
  /** Static token for authentication (overrides DaaSProvider config) */
  token?: string;
  /** Auto-fetch user on mount */
  autoFetch?: boolean;
  /** Callback when authentication fails */
  onError?: (error: Error) => void;
  /** Callback when user is authenticated */
  onAuthenticated?: (user: AuthUser) => void;
}

/**
 * useAuth - Client-side authentication hook
 * 
 * Provides authentication state and methods for DaaS API access.
 * Automatically uses DaaSProvider context for token/URL configuration.
 * 
 * @example
 * ```tsx
 * // Basic usage (uses DaaSProvider context)
 * const { user, isAdmin, isAuthenticated, loading } = useAuth();
 * 
 * // With static token
 * const { user } = useAuth({ token: 'your-static-token' });
 * 
 * // Check permissions
 * const { checkPermission } = useAuth();
 * const canEdit = await checkPermission('articles', 'update');
 * ```
 */
export function useAuth(options: UseAuthOptions = {}): UseAuthReturn {
  const { token: optionToken, autoFetch = true, onError, onAuthenticated } = options;
  
  // Get DaaS context
  const daasContext = useDaaSContext();
  
  // State
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(autoFetch);
  const [error, setError] = useState<string | null>(null);
  const [localToken, setLocalToken] = useState<string | null>(optionToken ?? null);
  
  // Effective token (option > local > context)
  const effectiveToken = useMemo(() => {
    return optionToken ?? localToken ?? daasContext?.config?.token ?? null;
  }, [optionToken, localToken, daasContext?.config?.token]);
  
  // Build API URL helper
  const buildUrl = useCallback((path: string): string => {
    if (daasContext?.isDirectMode && daasContext.config) {
      const baseUrl = daasContext.config.url.replace(/\/$/, '');
      const cleanPath = path.startsWith('/') ? path : `/${path}`;
      const daasPath = cleanPath.replace(/^\/api/, '');
      return `${baseUrl}${daasPath}`;
    }
    return path;
  }, [daasContext]);
  
  // Get headers helper
  const getHeaders = useCallback((): Record<string, string> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (effectiveToken) {
      headers['Authorization'] = `Bearer ${effectiveToken}`;
    }
    
    return headers;
  }, [effectiveToken]);
  
  // Fetch current user
  const fetchUser = useCallback(async (): Promise<AuthUser | null> => {
    try {
      setLoading(true);
      setError(null);
      
      const url = buildUrl('/api/users/me');
      const response = await fetch(url, {
        headers: getHeaders(),
        credentials: 'include', // Include cookies for session auth
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          setUser(null);
          return null;
        }
        throw new Error(`Authentication failed: ${response.status}`);
      }
      
      const data = await response.json();
      const userData = data.data || data;
      
      setUser(userData);
      onAuthenticated?.(userData);
      
      return userData;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Authentication failed';
      setError(errorMessage);
      setUser(null);
      onError?.(err instanceof Error ? err : new Error(errorMessage));
      return null;
    } finally {
      setLoading(false);
    }
  }, [buildUrl, getHeaders, onAuthenticated, onError]);
  
  // Refresh user data
  const refresh = useCallback(async (): Promise<void> => {
    await fetchUser();
  }, [fetchUser]);
  
  // Logout (clears local state)
  const logout = useCallback((): void => {
    setUser(null);
    setLocalToken(null);
    setError(null);
  }, []);
  
  // Set token
  const setToken = useCallback((token: string | null): void => {
    setLocalToken(token);
    // Clear user data when token changes (will re-fetch)
    setUser(null);
  }, []);
  
  // Check permission
  const checkPermission = useCallback(async (
    collection: string,
    action: string
  ): Promise<boolean> => {
    try {
      const url = buildUrl('/api/permissions/me');
      const response = await fetch(url, {
        headers: getHeaders(),
        credentials: 'include',
      });
      
      if (!response.ok) {
        return false;
      }
      
      const data = await response.json();
      
      // Admin has all permissions
      if (data.isAdmin) {
        return true;
      }
      
      // Check specific permission
      return !!data.data?.[collection]?.[action];
    } catch {
      return false;
    }
  }, [buildUrl, getHeaders]);
  
  // Auto-fetch on mount and when token changes
  useEffect(() => {
    if (autoFetch) {
      fetchUser();
    }
  }, [autoFetch, effectiveToken]); // eslint-disable-line react-hooks/exhaustive-deps
  
  // Computed values
  const isAuthenticated = user !== null;
  const isAdmin = user?.admin_access ?? false;
  
  return {
    // State
    user,
    isAdmin,
    loading,
    error,
    isAuthenticated,
    // Methods
    refresh,
    logout,
    setToken,
    checkPermission,
  };
}

export default useAuth;
