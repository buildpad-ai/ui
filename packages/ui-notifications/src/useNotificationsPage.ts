'use client';
/**
 * The inbox list for one tab: keyset paging, a merge of each poll into what is loaded, and the
 * selected row even when it is not on a loaded page.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNotifications } from './NotificationsProvider';
import { findTab, resolveTabs, type NotificationTab } from './core/filters';
import { mergePoll } from './core/merge';
import { appendPage, cursorOf, PAGE_SIZE, requestLimit } from './core/paging';
import type { Notification } from './core/types';

export interface UseNotificationsPageOptions {
  /** App tabs on top of `all` and `unread`. */
  tabs?: NotificationTab[];
  /** The selected id; fetched with `adapter.get` when it is not loaded. */
  selectedId?: string | null;
  pageSize?: number;
}

export interface NotificationsPage {
  items: Notification[];
  /** The selected notification, loaded or fetched on its own; null when none / not found. */
  selected: Notification | null;
  /** True while the selected row is still being looked for. */
  selectedLoading: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: Error | null;
  loadMore(): Promise<void>;
  refetch(): Promise<void>;
  /** Change rows on screen without a request (e.g. after mark as read). */
  patchLocal(ids: string[] | 'all', patch: Partial<Notification>): void;
}

const toError = (e: unknown) => (e instanceof Error ? e : new Error(String(e)));

export function useNotificationsPage(filterKey: string, options: UseNotificationsPageOptions = {}): NotificationsPage {
  const { adapter, meId, pollTick, allReadTick } = useNotifications();
  const pageSize = options.pageSize ?? PAGE_SIZE;
  const clauseJson = JSON.stringify(findTab(resolveTabs(options.tabs), filterKey).clause ?? null);
  const [items, setItems] = useState<Notification[]>([]);
  const [extra, setExtra] = useState<Notification | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const generation = useRef(0);
  const loadingMore = useRef(false);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const filter = useCallback(() => JSON.parse(clauseJson) ?? undefined, [clauseJson]);

  const refetch = useCallback(async () => {
    const gen = ++generation.current;
    setIsLoading(true);
    setError(null);
    try {
      const limit = requestLimit(pageSize);
      const rows = await adapter.list({ filter: filter(), limit });
      if (gen !== generation.current) return;
      const page = appendPage([], rows, limit, pageSize);
      setItems(page.items);
      setHasMore(page.hasMore);
    } catch (e) {
      if (gen === generation.current) setError(toError(e));
    } finally {
      if (gen === generation.current) setIsLoading(false);
    }
  }, [adapter, filter, pageSize]);

  // Reset on tab or user change.
  useEffect(() => {
    loadingMore.current = false;
    setIsLoadingMore(false);
    setItems([]);
    setHasMore(false);
    setExtra(null);
    asked.current = null;
    setLookedUp(null);
    void refetch();
  }, [refetch, meId]);

  const loadMore = useCallback(async () => {
    if (loadingMore.current || !itemsRef.current.length) return;
    loadingMore.current = true;
    setIsLoadingMore(true);
    const gen = generation.current;
    try {
      const limit = requestLimit(pageSize);
      const rows = await adapter.list({ filter: filter(), before: cursorOf(itemsRef.current), limit });
      if (gen !== generation.current) return;
      const page = appendPage(itemsRef.current, rows, limit, pageSize);
      setItems(page.items);
      setHasMore(page.hasMore);
    } catch (e) {
      if (gen === generation.current) setError(toError(e));
    } finally {
      if (gen === generation.current) {
        loadingMore.current = false;
        setIsLoadingMore(false);
      }
    }
  }, [adapter, filter, pageSize]);

  // Merge each provider poll into the loaded rows.
  // Bumped by every local change to read state. A poll that started before one would bring back
  // the old read state (e.g. rows unread again right after "Mark all as read"), so it is dropped.
  const mutations = useRef(0);
  const firstTick = useRef(pollTick);
  // One poll fetch at a time: a tick that lands while the last one is still out is skipped (the next
  // tick catches up).
  const polling = useRef(false);
  useEffect(() => {
    if (pollTick === firstTick.current || polling.current) return;
    const gen = generation.current;
    const seen = mutations.current;
    polling.current = true;
    adapter
      .list({ filter: filter(), limit: requestLimit(pageSize) })
      .then((rows) => {
        if (gen === generation.current && seen === mutations.current) setItems((current) => mergePoll(current, rows));
      })
      .catch(() => {
        /* a failed poll keeps what is on screen */
      })
      .finally(() => {
        polling.current = false;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollTick]);

  const patchLocal = useCallback((ids: string[] | 'all', patch: Partial<Notification>) => {
    const hit = (n: Notification) => ids === 'all' || ids.includes(n.id);
    mutations.current++;
    setItems((rows) => rows.map((n) => (hit(n) ? { ...n, ...patch } : n)));
    setExtra((n) => (n && hit(n) ? { ...n, ...patch } : n));
  }, []);

  const firstAllRead = useRef(allReadTick);
  useEffect(() => {
    if (allReadTick === firstAllRead.current) return;
    mutations.current++;
    const at = new Date().toISOString();
    setItems((rows) => rows.map((n) => (n.read_at ? n : { ...n, read_at: at })));
    setExtra((n) => (n && !n.read_at ? { ...n, read_at: at } : n));
  }, [allReadTick]);

  const selectedId = options.selectedId ?? null;
  const loaded = selectedId ? items.find((n) => n.id === selectedId) ?? null : null;
  const asked = useRef<string | null>(null);
  const [lookedUp, setLookedUp] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedId || loaded || isLoading || !adapter.get) return;
    if (asked.current === selectedId) return; // asked already (found or not)
    asked.current = selectedId;
    const gen = generation.current;
    const id = selectedId;
    const keep = () => gen === generation.current && asked.current === id;
    adapter
      .get(id)
      .then((n) => {
        if (keep()) setExtra(n);
      })
      .catch(() => {
        if (keep()) setExtra(null);
      })
      .finally(() => {
        if (keep()) setLookedUp(id);
      });
  }, [adapter, selectedId, loaded, isLoading]);

  const selected = loaded ?? (extra && extra.id === selectedId ? extra : null);
  const selectedLoading =
    !!selectedId && !selected && (isLoading || (!!adapter.get && lookedUp !== selectedId));
  return { items, selected, selectedLoading, isLoading, isLoadingMore, hasMore, error, loadMore, refetch, patchLocal };
}
