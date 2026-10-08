'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDebouncedValue } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { DaaSRequestError, readUrlIntParam, readUrlParam, useUrlListParams } from '@buildpad/hooks';
import type { CronListResult } from '@buildpad/types';
import { clampPage } from '@buildpad/utils';

/** Why a list has no rows to show, when the reason is not "there are none". */
export type CronListFailure =
  | {
      kind: 'accessDenied';
      /** The server's own sentence, when it says what to do (a second factor is required) */
      description?: string;
    }
  | { kind: 'error'; message: string };

export interface UseCronListOptions<T> {
  /** One page of the list — a data hook's `fetch…` method. Its identity must be stable. */
  fetchPage: (params: { page: number; limit: number; search?: string }) => Promise<CronListResult<T>>;
  /** Initial items per page. */
  pageSize: number;
  /** Choices of the footer's page-size selector; `pageSize` is added when it is not one of them. */
  pageSizeOptions: number[];
  /** Keep search and page in the URL query string. */
  urlParams: boolean;
  /** Prefix of the managed URL parameters. */
  urlParamPrefix: string;
  /** Title of the notification a failed load raises ("Error"). */
  loadFailedTitle: string;
  /** Message of that notification, and of the load-error state, when the failure has none. */
  loadFailedMessage: string;
}

export interface CronListState<T> {
  rows: T[];
  loading: boolean;
  /** Set while the last load ended without a list; `rows` is empty then. */
  failure: CronListFailure | null;
  page: number;
  setPage: (page: number) => void;
  limit: number;
  setLimit: (limit: number) => void;
  totalPages: number;
  totalCount: number;
  /** The text in the search box. */
  search: string;
  setSearch: (search: string) => void;
  /** The text the rows on screen were searched with. */
  debouncedSearch: string;
  sizeOptions: number[];
  /** Loads the current page again. */
  reload: () => Promise<void>;
}

/**
 * The state of a paged cron list — what the jobs list and the run history
 * share:
 *
 * - search is debounced (300 ms) and, like a page-size change, returns to
 *   page 1;
 * - search and page are kept in the URL (`useUrlListParams`) when asked;
 * - only the answer to the latest request is drawn, so a slow answer never
 *   replaces the rows of a later request;
 * - an answer that puts the page past the end of the list loads the last page
 *   (`clampPage`);
 * - a load that fails is a `failure`, never an empty list and never the rows
 *   of the load before it: a refusal is `accessDenied`, anything else an
 *   `error` with a notification.
 *
 * Package-local adaptation of ui-workflows' `useWorkflowList`; private to the
 * package.
 */
export function useCronList<T>({
  fetchPage,
  pageSize,
  pageSizeOptions,
  urlParams,
  urlParamPrefix,
  loadFailedTitle,
  loadFailedMessage,
}: UseCronListOptions<T>): CronListState<T> {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<CronListFailure | null>(null);
  const param = useCallback((name: string) => urlParamPrefix + name, [urlParamPrefix]);
  const [page, setPage] = useState(() => (urlParams ? readUrlIntParam(param('page'), 1) : 1));
  const [limit, setLimit] = useState(pageSize);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [search, setSearch] = useState(() => (urlParams ? (readUrlParam(param('search')) ?? '') : ''));
  const [debouncedSearch] = useDebouncedValue(search, 300);

  // URL persistence — see useUrlListParams. Defaults serialize to null so they
  // stay off the URL; Back/Forward and bridge rewrites flow back in below.
  useUrlListParams({
    enabled: urlParams,
    params: {
      [param('search')]: debouncedSearch || null,
      [param('page')]: page > 1 ? String(page) : null,
    },
    onExternalChange: useCallback(
      (get: (name: string) => string | null) => {
        const nextSearch = get(param('search')) ?? '';
        setSearch((current) => (current === nextSearch ? current : nextSearch));
        const rawPage = get(param('page'));
        const value = rawPage ? Number.parseInt(rawPage, 10) : 1;
        const nextPage = Number.isInteger(value) && value > 0 ? value : 1;
        setPage((current) => (current === nextPage ? current : nextPage));
      },
      [param],
    ),
  });

  const sizeOptions = useMemo(() => {
    return Array.from(new Set([...pageSizeOptions, pageSize])).sort((a, b) => a - b);
  }, [pageSizeOptions, pageSize]);

  // Only the answer to the latest request may be drawn: a slow answer to an
  // earlier search must not replace the rows of a later one.
  const requestRef = useRef(0);

  const reload = useCallback(async () => {
    const request = ++requestRef.current;
    setLoading(true);
    try {
      const result = await fetchPage({ page, limit, search: debouncedSearch || undefined });
      if (request !== requestRef.current) return;

      // Rows can also go because someone else deleted them: a page past the
      // end of the list is answered empty, so load the last page instead.
      const lastPage = clampPage(page, result.totalPages);
      if (lastPage !== page) {
        setPage(lastPage);
        return;
      }

      setRows(result.items);
      setTotalCount(result.total);
      setTotalPages(result.totalPages);
      setFailure(null);
      setLoading(false);
    } catch (err) {
      if (request !== requestRef.current) return;
      const message = err instanceof Error && err.message ? err.message : loadFailedMessage;
      const kind = err instanceof DaaSRequestError ? err.kind : 'failure';
      // The rows of the load before this one are not what is stored now, and
      // nothing on screen would say so: they go, and the failure is drawn.
      setRows([]);
      setTotalCount(0);
      setTotalPages(1);
      setLoading(false);
      if (kind === 'forbidden' || kind === 'mfaRequired') {
        setFailure({ kind: 'accessDenied', description: kind === 'mfaRequired' ? message : undefined });
      } else {
        setFailure({ kind: 'error', message });
        notifications.show({ title: loadFailedTitle, message, color: 'red' });
      }
    }
  }, [fetchPage, page, limit, debouncedSearch, loadFailedTitle, loadFailedMessage]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Only on CHANGES — not mount, or a ?page= restored from the URL is clobbered.
  // StrictMode-safe: compare against the previous values rather than "has
  // mounted" (StrictMode re-runs mount effects with refs intact).
  const filtersKey = JSON.stringify([debouncedSearch, limit]);
  const previousFiltersKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (previousFiltersKeyRef.current !== null && previousFiltersKeyRef.current !== filtersKey) {
      setPage(1);
    }
    previousFiltersKeyRef.current = filtersKey;
  }, [filtersKey]);

  return {
    rows,
    loading,
    failure,
    page,
    setPage,
    limit,
    setLimit,
    totalPages,
    totalCount,
    search,
    setSearch,
    debouncedSearch,
    sizeOptions,
    reload,
  };
}
