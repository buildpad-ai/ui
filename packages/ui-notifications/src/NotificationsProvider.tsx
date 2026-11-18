'use client';
/**
 * Holds the unread count and the latest notifications for the bell, polls every 30 s while the
 * tab is visible (and at once when it becomes visible or focused again), and offers optimistic
 * mark-as-read with a refetch on failure. Mount it once near the app root.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { NotificationsAdapter } from './NotificationsAdapter';
import type { Notification } from './core/types';

export const BELL_LIMIT = 20;
export const POLL_MS = 30_000;
/** Wake events (focus, visibilitychange) this close together trigger one refetch. */
export const WAKE_COALESCE_MS = 500;

export interface NotificationsContextValue {
  adapter: NotificationsAdapter;
  meId: string;
  unreadCount: number;
  /** Newest first, at most `bellLimit`. */
  latest: Notification[];
  isLoading: boolean;
  error: Error | null;
  /** Increments after each successful refresh; pages use it to merge the poll in. */
  pollTick: number;
  refetch(): Promise<void>;
  markRead(ids: string[]): Promise<void>;
  markUnread(ids: string[]): Promise<void>;
  markAllRead(): Promise<void>;
  /** Number of `markAllRead` calls so far; pages mark their own rows read when it changes. */
  allReadTick: number;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export interface NotificationsProviderProps {
  adapter: NotificationsAdapter;
  /** The signed-in user. Everything resets when it changes. */
  meId: string;
  /** Poll interval in ms (default 30000); 0 switches polling off. */
  pollMs?: number;
  /** How many latest rows the bell shows (default 20). */
  bellLimit?: number;
  /** Clock for optimistic `read_at` (tests). */
  now?: () => Date;
  children?: React.ReactNode;
}

const toError = (e: unknown) => (e instanceof Error ? e : new Error(String(e)));
const isHidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden';

export function NotificationsProvider({
  adapter,
  meId,
  pollMs = POLL_MS,
  bellLimit = BELL_LIMIT,
  now = () => new Date(),
  children,
}: NotificationsProviderProps) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [latest, setLatest] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [pollTick, setPollTick] = useState(0);
  const [allReadTick, setAllReadTick] = useState(0);
  const fetchId = useRef(0);
  // True once a fetch has landed for the current user. A mutation made before that (e.g. opening a
  // deep link marks it read) supersedes the first fetch, so it must load again afterwards.
  const loaded = useRef(false);
  const latestRef = useRef(latest);
  latestRef.current = latest;
  const nowRef = useRef(now);
  nowRef.current = now;

  // The refetch in flight. A second call while it runs (focus and visibilitychange fire together, a
  // poll lands on a wake) shares it, unless a mutation or a user change came in between: that one
  // already voids the in-flight result, so it starts a new fetch.
  const inflight = useRef<{ id: number; promise: Promise<void> } | null>(null);
  const lastWake = useRef(-Infinity);

  const refetch = useCallback((): Promise<void> => {
    if (inflight.current && inflight.current.id === fetchId.current) return inflight.current.promise;
    const id = ++fetchId.current;
    const load = async () => {
      const [count, list] = await Promise.allSettled([adapter.unreadCount(), adapter.list({ limit: bellLimit })]);
      if (id !== fetchId.current) return; // a newer fetch, a mutation or a user change won
      if (count.status === 'fulfilled') setUnreadCount(count.value);
      if (list.status === 'fulfilled') setLatest(list.value);
      const failed = [count, list].find((r): r is PromiseRejectedResult => r.status === 'rejected');
      setError(failed ? toError(failed.reason) : null);
      if (!failed) setPollTick((t) => t + 1);
      loaded.current = true;
      setIsLoading(false);
    };
    const promise = load().finally(() => {
      if (inflight.current?.promise === promise) inflight.current = null;
    });
    inflight.current = { id, promise };
    return promise;
  }, [adapter, bellLimit]);

  // Reset and load whenever the user (or adapter) changes.
  useEffect(() => {
    fetchId.current++;
    loaded.current = false;
    setUnreadCount(0);
    setLatest([]);
    setError(null);
    setIsLoading(true);
    void refetch();
  }, [meId, refetch]);

  useEffect(() => {
    if (!pollMs) return;
    const timer = setInterval(() => {
      if (!isHidden()) void refetch();
    }, pollMs);
    const wake = () => {
      if (isHidden()) return;
      const at = Date.now();
      if (at - lastWake.current < WAKE_COALESCE_MS) return; // one refetch per burst of wake events
      lastWake.current = at;
      void refetch();
    };
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('focus', wake);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('focus', wake);
    };
  }, [pollMs, refetch]);

  const markRead = useCallback(
    async (ids: string[]) => {
      if (!ids.length) return;
      const known = new Map(latestRef.current.map((n) => [n.id, n]));
      // Ids not in the bell list are assumed unread (callers only mark unread rows).
      const drop = ids.filter((id) => !known.get(id)?.read_at).length;
      const at = nowRef.current().toISOString();
      fetchId.current++; // an in-flight poll must not undo the optimistic state
      setLatest((rows) => rows.map((n) => (ids.includes(n.id) && !n.read_at ? { ...n, read_at: at } : n)));
      setUnreadCount((c) => Math.max(0, c - drop));
      try {
        await adapter.markRead(ids);
        if (!loaded.current) await refetch(); // the first load was superseded: load the truth now
      } catch (e) {
        setError(toError(e));
        await refetch(); // roll back to the server's truth
      }
    },
    [adapter, refetch],
  );

  const markUnread = useCallback(
    async (ids: string[]) => {
      if (!ids.length || !adapter.markUnread) return;
      const known = new Map(latestRef.current.map((n) => [n.id, n]));
      const add = ids.filter((id) => known.get(id)?.read_at !== null).length;
      fetchId.current++;
      setLatest((rows) => rows.map((n) => (ids.includes(n.id) ? { ...n, read_at: null } : n)));
      setUnreadCount((c) => c + add);
      try {
        await adapter.markUnread(ids);
      } catch (e) {
        setError(toError(e));
      }
      await refetch();
    },
    [adapter, refetch],
  );

  const markAllRead = useCallback(async () => {
    const at = nowRef.current().toISOString();
    fetchId.current++;
    setLatest((rows) => rows.map((n) => (n.read_at ? n : { ...n, read_at: at })));
    setUnreadCount(0);
    setAllReadTick((t) => t + 1);
    try {
      await adapter.markAllRead();
      if (!loaded.current) await refetch();
    } catch (e) {
      setError(toError(e));
      await refetch();
    }
  }, [adapter, refetch]);

  const value = useMemo<NotificationsContextValue>(
    () => ({ adapter, meId, unreadCount, latest, isLoading, error, pollTick, allReadTick, refetch, markRead, markUnread, markAllRead }),
    [adapter, meId, unreadCount, latest, isLoading, error, pollTick, allReadTick, refetch, markRead, markUnread, markAllRead],
  );
  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

/** The notifications state. Throws outside a `NotificationsProvider`. */
export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used inside a <NotificationsProvider>.');
  return ctx;
}
