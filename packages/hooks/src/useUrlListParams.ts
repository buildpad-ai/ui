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
 *    `next/navigation` is off the table. The hook itself only knows the
 *    History API; an app that has a router registers a writer for it (see
 *    {@link registerUrlStateWriter}). In a Next.js App Router app that
 *    registration is REQUIRED, not optional — see the note there.
 * 2. **`replaceState`, never `pushState`.** Filter and search changes must not
 *    grow the browser history — Back should leave the page, not step through
 *    every debounced keystroke.
 * 3. **Debounced upstream.** Callers pass their *debounced* search value (the
 *    managers already debounce at 300 ms for fetching), so URL writes ride the
 *    same debounce and cost nothing extra per keystroke.
 * 4. **Merge, don't clobber.** Only the keys a caller manages are touched;
 *    unrelated parameters on the URL survive — including the keys of another
 *    instance on the same page (see {@link currentQuery} for why that needs
 *    more than reading `location.search`).
 * 5. **SSR-safe.** All `window` access is inside effects or guarded readers.
 *    Seeding component state from the URL is only mismatch-free on the client
 *    after hydration; gate the component on {@link useHydrated} first.
 *
 * Inbound changes (browser Back/Forward, or a programmatic rewrite by a
 * micro-frontend bridge applying the host's URL) arrive via `popstate` and the
 * {@link URL_STATE_EVENT} custom event. Anything that rewrites the URL
 * programmatically and wants list components to notice must dispatch it.
 */

import { useEffect, useRef, useSyncExternalStore } from 'react';

/**
 * Dispatched after ANY programmatic URL rewrite that others should re-read:
 * this hook dispatches it after each of its own writes, and external actors —
 * e.g. a micro-frontend bridge applying a host-driven `SET_QUERY_PARAMS` —
 * dispatch it after theirs. Dispatch it as a `CustomEvent` whose
 * `detail.search` is the query string just written (no leading `?`): router
 * writes commit asynchronously, so `location.search` may still be stale when
 * listeners run — the detail is the truth. Listeners fall back to
 * `location.search` for plain-Event dispatchers. Equality guards make
 * self-echo harmless.
 */
export const URL_STATE_EVENT = 'buildpad:urlchange';

/** Read the query string a URL_STATE_EVENT announced, or the live URL. */
export function urlStateEventSearch(event: Event): string {
  const detail = (event as CustomEvent<{ search?: string }>).detail;
  if (detail && typeof detail.search === 'string') return detail.search;
  return typeof window === 'undefined' ? '' : window.location.search.replace(/^\?/, '');
}

type UrlStateWriter = (url: string) => void;
let urlStateWriter: UrlStateWriter | null = null;

/**
 * Install the URL writer for this runtime. REQUIRED inside a Next.js App
 * Router app: register `(url) => router.replace(url, { scroll: false })`
 * (the CLI's `DaaSProviderWrapper` does this). Without it the hook falls back
 * to native `history.replaceState`, which the App Router both ignores
 * (`useSearchParams` never updates) and actively FIGHTS — the router
 * re-asserts its own stale URL on the next render, silently stripping the
 * parameters (observed on Next 16). The native fallback exists for
 * router-less runtimes such as Storybook; in development the hook warns once
 * if it detects Next.js and no writer.
 */
export function registerUrlStateWriter(writer: UrlStateWriter | null): void {
  urlStateWriter = writer;
}

/**
 * The query string this module most recently asked to have written, and
 * where. Router writers (`router.replace`) commit asynchronously, so for a
 * short window `location.search` still shows the previous URL. Two instances
 * mounting in the same commit — the `urlParamPrefix` case — would each merge
 * into that stale value, and the second's write would drop the first's keys
 * and then announce a query without them, which the first would apply as a
 * reset. Merging into the last *requested* query keeps the writes additive.
 *
 * Scoped to a pathname and short-lived: `popstate` clears it (the browser is
 * the truth again), an external URL_STATE_EVENT replaces it (its detail is
 * the truth), and it expires quickly so a write the router never committed
 * cannot poison later merges.
 */
interface PendingWrite {
  pathname: string;
  query: string;
  at: number;
}
let pendingWrite: PendingWrite | null = null;
const PENDING_WRITE_TTL_MS = 1000;

/** The query string to merge into: the in-flight write if fresh, else the URL. */
function currentQuery(): string {
  const live = window.location.search.replace(/^\?/, '');
  if (!pendingWrite) return live;
  const fresh = Date.now() - pendingWrite.at < PENDING_WRITE_TTL_MS;
  if (!fresh || pendingWrite.pathname !== window.location.pathname) {
    pendingWrite = null;
    return live;
  }
  return pendingWrite.query;
}

let moduleListenersInstalled = false;
function installModuleListeners(): void {
  if (moduleListenersInstalled || typeof window === 'undefined') return;
  moduleListenersInstalled = true;
  window.addEventListener('popstate', () => {
    pendingWrite = null;
  });
  window.addEventListener(URL_STATE_EVENT, (event) => {
    // Our own dispatches restate what we just recorded; an external actor's
    // dispatch tells us what it wrote, and that becomes the merge base.
    pendingWrite = {
      pathname: window.location.pathname,
      query: urlStateEventSearch(event),
      at: Date.now(),
    };
  });
}

let warnedMissingWriter = false;
function warnIfNextWithoutWriter(): void {
  if (warnedMissingWriter || process.env.NODE_ENV === 'production') return;
  const w = window as unknown as { next?: unknown; __NEXT_DATA__?: unknown };
  if (!w.next && !w.__NEXT_DATA__) return;
  warnedMissingWriter = true;
  console.warn(
    '[useUrlListParams] Running inside Next.js with no URL writer registered. ' +
      'The App Router ignores native history.replaceState (useSearchParams never updates) ' +
      'and may strip these parameters on its next render. Call ' +
      'registerUrlStateWriter((url) => router.replace(url, { scroll: false })) from a ' +
      'client component rendered inside the router — the Buildpad DaaSProviderWrapper ' +
      'template does this.',
  );
}

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

const subscribeToNothing = () => () => {};

/**
 * `true` once rendering on the client after hydration (immediately on a plain
 * client mount, as in Storybook); `false` during SSR and the hydration render.
 *
 * A component that seeds `useState` from the URL renders differently on the
 * server (no URL) and the client (URL present) — a hydration mismatch on every
 * deep link. Rendering a placeholder until this is `true` keeps the server
 * HTML and the hydration render identical, and lets the real component mount
 * once with the URL in hand. The managers' server output was a loading shell
 * anyway (data is fetched client-side), so nothing meaningful is lost.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );
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
 * {@link readUrlParam} in `useState` initializers (behind {@link useHydrated});
 * this hook then keeps the URL following the state, and `onExternalChange`
 * keeps the state following the URL.
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
    installModuleListeners();

    const base = currentQuery();
    const next = new URLSearchParams(base);
    for (const [key, value] of Object.entries(managedRef.current)) {
      if (value === null || value === '') next.delete(key);
      else next.set(key, value);
    }

    const nextQuery = next.toString();
    if (nextQuery === base) return; // already in sync — no write, no loop

    const url =
      window.location.pathname + (nextQuery ? `?${nextQuery}` : '') + window.location.hash;
    // Record before writing: the router path commits later, and any instance
    // whose effect runs before then must merge into THIS query, not the URL.
    pendingWrite = { pathname: window.location.pathname, query: nextQuery, at: Date.now() };
    if (urlStateWriter) {
      // App-registered writer (Next: router.replace) — keeps the router's
      // internal URL state consistent so it cannot re-assert a stale URL over
      // this write.
      urlStateWriter(url);
    } else {
      warnIfNextWithoutWriter();
      // Router-less runtime (Storybook). Preserve the existing history state:
      // Next.js stores router state there, and replacing it with null corrupts
      // app-router navigation.
      window.history.replaceState(window.history.state, '', url);
    }
    // Announce the write, carrying the written query string: router writes
    // commit asynchronously, so listeners must not trust location.search yet.
    window.dispatchEvent(new CustomEvent(URL_STATE_EVENT, { detail: { search: nextQuery } }));
  }, [enabled, serialized]);

  /* ------------------------------ URL → state ------------------------------ */
  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || !onExternalChange) return;
    installModuleListeners();

    const notify = (event?: Event) => {
      const source =
        event && event.type === URL_STATE_EVENT
          ? urlStateEventSearch(event)
          : window.location.search;
      const current = new URLSearchParams(source);
      onExternalChange((name) => current.get(name));
    };

    const onPop = () => notify();
    window.addEventListener('popstate', onPop);
    window.addEventListener(URL_STATE_EVENT, notify);
    return () => {
      window.removeEventListener('popstate', onPop);
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
