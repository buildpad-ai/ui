'use client';

import { useEffect, useCallback, useState, useRef } from 'react';

export interface UseEditsGuardOptions {
  /** Path prefix to ignore (e.g., '/auth' won't trigger guard) */
  ignorePrefix?: string;
  /** Custom comparison function for deep equality */
  compareFunction?: (a: unknown, b: unknown) => boolean;
  /** Current pathname (for frameworks that provide it externally) */
  pathname?: string;
  /** Navigation function (for frameworks that provide it externally) */
  navigate?: (url: string) => void;
}

export interface UseEditsGuardReturn {
  /** Whether the confirmation dialog should be shown */
  confirmLeave: boolean;
  /** The path user is trying to navigate to */
  leaveTo: string | null;
  /** Confirm navigation (proceed with leave) */
  confirmNavigation: () => void;
  /** Cancel navigation (stay on page) */
  cancelNavigation: () => void;
  /** Reset the guard state */
  resetGuard: () => void;
  /** Guard function to wrap navigation calls */
  guardNavigation: (url: string) => boolean;
}

/**
 * Framework-agnostic hook to guard against navigation when there are unsaved changes
 * Inspired by DaaS useEditsGuard composable, ported for React
 * 
 * For Next.js, use with useRouter and usePathname:
 * @example
 * ```tsx
 * import { useRouter, usePathname } from 'next/navigation';
 * 
 * const router = useRouter();
 * const pathname = usePathname();
 * const { hasEdits } = useForm();
 * 
 * const { 
 *   confirmLeave, 
 *   leaveTo, 
 *   confirmNavigation, 
 *   cancelNavigation,
 *   guardNavigation 
 * } = useEditsGuard(hasEdits, {
 *   pathname,
 *   navigate: router.push
 * });
 * 
 * // Wrap navigation calls
 * const handleNavigate = (url: string) => {
 *   if (guardNavigation(url)) {
 *     router.push(url);
 *   }
 * };
 * 
 * return (
 *   <>
 *     <Form />
 *     <Modal opened={confirmLeave} onClose={cancelNavigation}>
 *       <Text>You have unsaved changes. Leave anyway?</Text>
 *       <Button onClick={cancelNavigation}>Stay</Button>
 *       <Button onClick={confirmNavigation}>Leave</Button>
 *     </Modal>
 *   </>
 * );
 * ```
 */
export function useEditsGuard(
  hasEdits: boolean,
  options: UseEditsGuardOptions = {}
): UseEditsGuardReturn {
  const { ignorePrefix, pathname = '', navigate } = options;
  
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [leaveTo, setLeaveTo] = useState<string | null>(null);
  const pendingNavigation = useRef<string | null>(null);

  // Handle browser beforeunload event
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (hasEdits) {
        event.preventDefault();
        // Modern browsers ignore custom messages, but this is required
        event.returnValue = ''; // NOSONAR: some browsers still require the deprecated returnValue alongside preventDefault()
        return '';
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }
  }, [hasEdits]);

  // Check if path should be ignored
  const isIgnoredPath = useCallback((path: string) => {
    if (!ignorePrefix) return false;
    return path.startsWith(ignorePrefix);
  }, [ignorePrefix]);

  // Check if new path is a subpath of current (allow drilling down)
  const isSubpath = useCallback((currentPath: string, newPath: string) => {
    return (
      currentPath === newPath ||
      (newPath.startsWith(currentPath) && newPath.substring(currentPath.length).startsWith('/'))
    );
  }, []);

  /**
   * Guard navigation - returns true if navigation should proceed, false if blocked
   */
  const guardNavigation = useCallback((url: string): boolean => {
    // If no edits, allow navigation
    if (!hasEdits) {
      return true;
    }

    // Check if this navigation should be blocked
    if (!isSubpath(pathname, url) && !isIgnoredPath(url)) {
      pendingNavigation.current = url;
      setLeaveTo(url);
      setConfirmLeave(true);
      return false; // Block navigation
    }

    // Allow navigation
    return true;
  }, [hasEdits, pathname, isSubpath, isIgnoredPath]);

  const confirmNavigation = useCallback(() => {
    setConfirmLeave(false);
    if (pendingNavigation.current) {
      const destination = pendingNavigation.current;
      pendingNavigation.current = null;
      setLeaveTo(null);
      
      // Use provided navigate function or fallback to window.location
      if (navigate) {
        // Use setTimeout to ensure state is updated before navigation
        setTimeout(() => navigate(destination), 0);
      } else if (typeof window !== 'undefined') {
        setTimeout(() => { window.location.href = destination; }, 0);
      }
    }
  }, [navigate]);

  const cancelNavigation = useCallback(() => {
    setConfirmLeave(false);
    setLeaveTo(null);
    pendingNavigation.current = null;
  }, []);

  const resetGuard = useCallback(() => {
    setConfirmLeave(false);
    setLeaveTo(null);
    pendingNavigation.current = null;
  }, []);

  return {
    confirmLeave,
    leaveTo,
    confirmNavigation,
    cancelNavigation,
    resetGuard,
    guardNavigation,
  };
}

/**
 * Simple hook for tracking if form has unsaved changes
 * Use with useEditsGuard for full navigation protection
 */
export function useHasEdits<T>(
  initialData: T | null,
  currentData: T | null,
  compareFunction?: (a: T | null, b: T | null) => boolean
): boolean {
  const defaultCompare = useCallback((a: T | null, b: T | null) => {
    try {
      return JSON.stringify(a) !== JSON.stringify(b);
    } catch {
      return a !== b;
    }
  }, []);

  const compare = compareFunction || defaultCompare;
  return compare(initialData, currentData);
}
