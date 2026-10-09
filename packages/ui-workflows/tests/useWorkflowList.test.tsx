/**
 * useWorkflowList unit tests: what a list asks its data hook for. The point of
 * most of them is the COUNT of requests — a change of search or of page size
 * on a later page is one request (the new filter on page 1), not one for the
 * old page of the new filter followed by one for page 1.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { WorkflowListParams, WorkflowListResult } from '@buildpad/types';
import { useWorkflowList, type UseWorkflowListOptions } from '../src/useWorkflowList';

vi.mock('@buildpad/hooks', async () => {
  // The URL-persistence helpers and the typed error are used as they are.
  const url = await import('../../hooks/src/useUrlListParams');
  const request = await import('../../hooks/src/daasRequest');
  return {
    useUrlListParams: url.useUrlListParams,
    readUrlParam: url.readUrlParam,
    readUrlIntParam: url.readUrlIntParam,
    DaaSRequestError: request.DaaSRequestError,
  };
});

type Row = { id: string };
type Params = WorkflowListParams;

/** 60 rows whatever is asked for, so every page of every search exists. */
const fetchPage = vi.fn(async ({ page = 1, limit = 25 }: Params): Promise<WorkflowListResult<Row>> => ({
  items: Array.from({ length: limit }, (_, index) => ({ id: `${page}-${index}` })),
  total: 60,
  totalPages: Math.ceil(60 / limit),
  page,
  limit,
}));

function renderList(options: Partial<UseWorkflowListOptions<Row>> = {}) {
  return renderHook(() =>
    useWorkflowList<Row>({
      fetchPage,
      pageSize: 25,
      pageSizeOptions: [10, 25, 50],
      urlParams: false,
      urlParamPrefix: '',
      loadFailedMessage: 'Failed to load',
      ...options,
    }),
  );
}

/** What the list asked for since the last `mockClear()`, in order. */
const requests = () => fetchPage.mock.calls.map(([params]) => params);

/** Long enough for the 300 ms search debounce and for any request it would start after it. */
const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 500)));

describe('useWorkflowList', () => {
  beforeEach(() => {
    fetchPage.mockClear();
    window.history.replaceState(null, '', '/');
  });

  afterEach(() => {
    window.history.replaceState(null, '', '/');
  });

  it('loads page 1 once on mount', async () => {
    const { result } = renderList();
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(requests()).toEqual([{ page: 1, limit: 25, search: undefined }]);
    expect(result.current.page).toBe(1);
    expect(result.current.totalPages).toBe(3);
  });

  it('a search typed on page 2 is ONE request: that search, on page 1', async () => {
    const { result } = renderList();
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.setPage(2));
    await waitFor(() => expect(requests()).toContainEqual({ page: 2, limit: 25, search: undefined }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    fetchPage.mockClear();

    act(() => result.current.setSearch('report'));
    await settle();

    // Not [{ page: 2, search: 'report' }, { page: 1, search: 'report' }]
    expect(requests()).toEqual([{ page: 1, limit: 25, search: 'report' }]);
    expect(result.current.page).toBe(1);
    expect(result.current.debouncedSearch).toBe('report');
  });

  it('a page-size change on page 2 is ONE request: that size, on page 1', async () => {
    const { result } = renderList();
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.setPage(2));
    await waitFor(() => expect(requests()).toContainEqual({ page: 2, limit: 25, search: undefined }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    fetchPage.mockClear();

    act(() => result.current.setLimit(10));
    await settle();

    expect(requests()).toEqual([{ page: 1, limit: 10, search: undefined }]);
    expect(result.current.page).toBe(1);
  });

  it('clearing a search on a later page is one request as well', async () => {
    const { result } = renderList();
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.setSearch('report'));
    await settle();
    act(() => result.current.setPage(3));
    await waitFor(() => expect(requests()).toContainEqual({ page: 3, limit: 25, search: 'report' }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    fetchPage.mockClear();

    act(() => result.current.setSearch(''));
    await settle();

    expect(requests()).toEqual([{ page: 1, limit: 25, search: undefined }]);
  });

  it('what is typed sends nothing until the debounce has passed, and keeps the page until then', async () => {
    const { result } = renderList();
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.setPage(2));
    await waitFor(() => expect(result.current.loading).toBe(false));
    fetchPage.mockClear();

    // Typed and taken back within the debounce: the list never searched for it
    act(() => result.current.setSearch('rep'));
    expect(result.current.page).toBe(2);
    act(() => result.current.setSearch(''));
    await settle();

    expect(requests()).toEqual([]);
    expect(result.current.page).toBe(2);
  });

  it('a page and a search restored from the URL are one request, and the page is kept', async () => {
    window.history.replaceState(null, '', '/?search=report&page=2');
    const { result } = renderList({ urlParams: true });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await settle();

    expect(requests()).toEqual([{ page: 2, limit: 25, search: 'report' }]);
    expect(result.current.page).toBe(2);
    expect(result.current.search).toBe('report');
  });

  it('keeps the page off the URL after a new search', async () => {
    window.history.replaceState(null, '', '/?page=2');
    const { result } = renderList({ urlParams: true });
    await waitFor(() => expect(result.current.loading).toBe(false));
    fetchPage.mockClear();

    act(() => result.current.setSearch('report'));
    await settle();

    expect(requests()).toEqual([{ page: 1, limit: 25, search: 'report' }]);
    expect(window.location.search).toBe('?search=report');
  });

  it('an answer that puts the page past the end loads the last page', async () => {
    // Two pages now; the list was on page 3 (rows deleted elsewhere)
    fetchPage.mockImplementationOnce(async ({ page = 1, limit = 25 }: Params) => ({
      items: [],
      total: 40,
      totalPages: 2,
      page,
      limit,
    }));
    window.history.replaceState(null, '', '/?page=3');
    const { result } = renderList({ urlParams: true });
    await waitFor(() => expect(result.current.page).toBe(2));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(requests()).toEqual([
      { page: 3, limit: 25, search: undefined },
      { page: 2, limit: 25, search: undefined },
    ]);
  });
});
