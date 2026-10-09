'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDebouncedValue } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { DaaSRequestError, readUrlIntParam, readUrlParam, useUrlListParams } from '@buildpad/hooks';
import type { WorkflowListParams, WorkflowListResult } from '@buildpad/types';
import { clampPage } from '@buildpad/utils';

/** Why a list has no rows to show, when the reason is not "there are none". */
export type WorkflowListFailure =
  | {
      kind: 'accessDenied';
      /** The server's own sentence, when it says what to do (a second factor is required) */
      description?: string;
    }
  | { kind: 'error'; message: string };

export interface UseWorkflowListOptions<T> {
  /** One page of the list — a data hook's `fetch…` method. Its identity must be stable. */
  fetchPage: (params: WorkflowListParams) => Promise<WorkflowListResult<T>>;
  /** Initial items per page. */
  pageSize: number;
  /** Choices of the footer's page-size selector; `pageSize` is added when it is not one of them. */
  pageSizeOptions: number[];
  /** Keep search and page in the URL query string. */
  urlParams: boolean;
  /** Prefix of the managed URL parameters. */
  urlParamPrefix: string;
  /** Title of the notification a failed load raises, and its message when the failure has none. */
  loadFailedMessage: string;
}

export interface WorkflowListState<T> {
  rows: T[];
  loading: boolean;
  /** Set while the last load ended without a list; `rows` is empty then. */
  failure: WorkflowListFailure | null;
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
 * The state of a paged, searchable workflow list — what the definitions,
 * assignments and instances managers share:
 *
 * - search is debounced (300 ms) and, like a page-size change, returns to
 *   page 1 — in one request: the new search and the page reset reach the
 *   load together, so no request goes out for the old page of the new search;
 * - search and page are kept in the URL (`useUrlListParams`) when asked;
 * - only the answer to the latest request is drawn;
 * - an answer that puts the page past the end of the list loads the last page
 *   (`clampPage`);
 * - a load that fails is a `failure`, never an empty list: a refusal is
 *   `accessDenied`, anything else an `error` with a notification.
 *
 * Private to the package.
 */
export function useWorkflowList<T>({
  fetchPage,
  pageSize,
  pageSizeOptions,
  urlParams,
  urlParamPrefix,
  loadFailedMessage,
}: UseWorkflowListOptions<T>): WorkflowListState<T> {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<WorkflowListFailure | null>(null);
  const param = useCallback((name: string) => urlParamPrefix + name, [urlParamPrefix]);
  const [limit, setLimit] = useState(pageSize);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [search, setSearch] = useState(() => (urlParams ? (readUrlParam(param('search')) ?? '') : ''));
  const [debouncedSearch] = useDebouncedValue(search, 300);

  // A page belongs to the search and the page size it was reached under: it is
  // kept with them, and a page kept under other filters is page 1. The reset
  // is decided while rendering, not in an effect after it, so the load below
  // sees the new search and page 1 as one change and sends one request. (An
  // effect would run after the load had already asked for the old page of the
  // new search.) A page restored from the URL is kept: it is stored with the
  // filters of the first render.
  const filtersKey = JSON.stringify([debouncedSearch, limit]);
  const [pageState, setPageState] = useState(() => ({
    page: urlParams ? readUrlIntParam(param('page'), 1) : 1,
    filtersKey,
  }));
  let page = pageState.page;
  if (pageState.filtersKey !== filtersKey) {
    page = 1;
    setPageState({ page: 1, filtersKey });
  }
  const setPage = useCallback((next: number) => {
    setPageState((current) => (current.page === next ? current : { ...current, page: next }));
  }, []);

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
        setPage(nextPage);
      },
      [param, setPage],
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
      setRows([]);
      setTotalCount(0);
      setTotalPages(1);
      setLoading(false);
      if (kind === 'forbidden' || kind === 'mfaRequired') {
        setFailure({ kind: 'accessDenied', description: kind === 'mfaRequired' ? message : undefined });
      } else {
        setFailure({ kind: 'error', message });
        notifications.show({ title: loadFailedMessage, message, color: 'red' });
      }
    }
  }, [fetchPage, page, limit, debouncedSearch, setPage, loadFailedMessage]);

  useEffect(() => {
    void reload();
  }, [reload]);

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
