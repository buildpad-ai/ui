/**
 * Scope Context
 *
 * React context that holds the active scope URI and exposes helpers to read
 * and update it. The scope URI is persisted in the `daas_resource_uri` cookie
 * so every same-origin request automatically carries scope context.
 *
 * Usage:
 *   1. Wrap root layout with <ScopeProvider>
 *   2. Read scope in any client component with useScope()
 *
 * @buildpad/origin: scope-routes/scope-context
 * @buildpad/version: 1.0.0
 */

'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

const COOKIE_NAME = 'daas_resource_uri';
const COOKIE_MAX_AGE = 30 * 24 * 3600; // 30 days

export interface ScopeContextValue {
  /** The active resource URI, e.g. "/<type-uuid>:<item-uuid>/..." */
  resourceUri: string | null;
  /** Set (or clear) the active scope URI. Updates the cookie immediately. */
  setScope: (uri: string | null) => void;
  /** True while the initial cookie read has not yet completed (avoids SSR mismatch) */
  isHydrating: boolean;
}

const ScopeContext = createContext<ScopeContextValue>({
  resourceUri: null,
  setScope: () => {},
  isHydrating: true,
});

export function ScopeProvider({ children }: { children: ReactNode }) {
  const [resourceUri, setResourceUri] = useState<string | null>(null);
  const [isHydrating, setIsHydrating] = useState(true);

  // Hydrate from cookie on first client render
  useEffect(() => {
    const match = document.cookie.match(/(?:^|;\s*)daas_resource_uri=([^;]*)/);
    setResourceUri(match ? decodeURIComponent(match[1]) : null);
    setIsHydrating(false);
  }, []);

  const setScope = (uri: string | null) => {
    if (uri) {
      document.cookie = `${COOKIE_NAME}=${encodeURIComponent(uri)}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
    } else {
      document.cookie = `${COOKIE_NAME}=; path=/; max-age=0`;
    }
    setResourceUri(uri);
  };

  return (
    <ScopeContext.Provider value={{ resourceUri, setScope, isHydrating }}>
      {children}
    </ScopeContext.Provider>
  );
}

/**
 * Access the active scope URI and the setScope setter from any client component.
 *
 * @example
 * const { resourceUri, setScope } = useScope();
 */
export function useScope(): ScopeContextValue {
  return useContext(ScopeContext);
}
