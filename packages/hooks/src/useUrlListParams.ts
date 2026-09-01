'use client';

/**
 * URL persistence for list-manager state (search, filters, sort, page).
 *
 * The list managers (`UsersManager`, `RolesManager`, `PoliciesManager`,
 * `FileManager`, …) keep their state in local `useState` for input
 * responsiveness. This hook mirrors the *settled* values into the URL query
 * string so a filtered list is shareable, reload-safe, and — under the
 * micro-frontend bridge — mirrorable into a host application's URL.
 *
 * Design constraints, in order:
 *
 * 1. **No framework imports.** These packages also render in Storybook, so
 *    `next/navigation` is off the table. Writes go through the native History
 *    API (`history.replaceState`), which Next.js ≥ 14.1 intercepts and feeds
 *    back into `useSearchParams` — app-side observers (e.g. a micro-frontend
 *    bridge) see every write without this package knowing Next exists.
 * 2. **`replaceState`, never `pushState`.** Filter and search changes must not
 *    grow the browser history — Back should leave the page, not step through
 *    every debounced keystroke.
 * 3. **Debounced upstream.** Callers pass their *debounced* search value (the
 *    managers already debounce at 300 ms for fetching), so URL writes ride the
 *    same debounce and cost nothing extra per keystroke.
 * 4. **Merge, don't clobber.** Only the keys a caller manages are touched;
 *    unrelated parameters on the URL survive.
 * 5. **SSR-safe.** All `window` access is inside effects or guarded readers.
 *
 * Inbound changes (browser Back/Forward, or a programmatic rewrite by a
 * micro-frontend bridge applying the host's URL) arrive via `popstate` and the
 * {@link URL_STATE_EVENT} custom event. Anything that rewrites the URL
 * programmatically and wants list components to notice must dispatch:
 *
 *     window.dispatchEvent(new Event(URL_STATE_EVENT));
 */

import { useEffect, useRef } from 'react';

/**
 * Dispatched (by external actors — this hook never dispatches it) after a
 * programmatic URL rewrite that components should re-read. The micro-frontend
 * bridge dispatches it after applying a host-driven `SET_QUERY_PARAMS`.
 */
export const URL_STATE_EVENT = 'buildpad:urlchange';

/** SSR-safe read of a single query parameter from the current URL. */
export function readUrlParam(name: string): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get(name);
}

/** SSR-safe positive-integer parse for `page`-style parameters. */
export function readUrlIntParam(name: string, fallback: number): number {
  const raw = readUrlParam(name);
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

export interface UseUrlListParamsOptions {
  /**
   * Set `false` to disable both directions — for embedded lists (a picker
   * modal, a sub-list on a detail page) that must not fight the page's own
   * URL state.
   */
  enabled?: boolean;
  /**
   * The managed parameters, already serialized. `null`/`''` removes the key,
   * which keeps default state (`page=1`, empty search) off the URL entirely.
   * Keys are the FINAL parameter names — apply any prefix before passing.
   */
  params: Record<string, string | null>;
  /**
   * Called when the URL changes underneath the component (Back/Forward, or a
   * {@link URL_STATE_EVENT} dispatch). Read the new values through the getter
   * and write them into local state, guarding each setter with an equality
   * check. Keep the callback's identity stable or ensure it is cheap — it is
   * re-subscribed on change.
   */
  onExternalChange?: (get: (name: string) => string | null) => void;
}

/**
 * Mirror serialized list state into the URL, and surface external URL changes.
 *
 * See the managers for the wiring pattern: initial state comes from
 * {@link readUrlParam} in `useState` initializers; this hook then keeps the
 * URL following the state, and `onExternalChange` keeps the state following
 * the URL.
 */
export function useUrlListParams({ enabled = true, params, onExternalChange }: UseUrlListParamsOptions): void {
  // The keys this instance manages — used by the write effect to know what it
  // may delete, held in a ref so the effect key is the serialized values only.
  const managedRef = useRef(params);
  managedRef.current = params;

  const serialized = serializeManaged(params);

  /* ------------------------------ state → URL ------------------------------ */
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const next = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(managedRef.current)) {
      if (value === null || value === '') next.delete(key);
      else next.set(key, value);
    }

    const nextQuery = next.toString();
    const currentQuery = window.location.search.replace(/^\?/, '');
    if (nextQuery === currentQuery) return; // already in sync — no write, no loop

    const url =
      window.location.pathname + (nextQuery ? `?${nextQuery}` : '') + window.location.hash;
    // Preserve the existing history state: Next.js stores router state there,
    // and replacing it with null corrupts app-router navigation.
    window.history.replaceState(window.history.state, '', url);
  }, [enabled, serialized]);

  /* ------------------------------ URL → state ------------------------------ */
  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || !onExternalChange) return;

    const notify = () => {
      const current = new URLSearchParams(window.location.search);
      onExternalChange((name) => current.get(name));
    };

    window.addEventListener('popstate', notify);
    window.addEventListener(URL_STATE_EVENT, notify);
    return () => {
      window.removeEventListener('popstate', notify);
      window.removeEventListener(URL_STATE_EVENT, notify);
    };
  }, [enabled, onExternalChange]);
}

function serializeManaged(params: Record<string, string | null>): string {
  const search = new URLSearchParams();
  for (const key of Object.keys(params).sort()) {
    const value = params[key];
    if (value !== null && value !== '') search.set(key, value);
  }
  return search.toString();
}
