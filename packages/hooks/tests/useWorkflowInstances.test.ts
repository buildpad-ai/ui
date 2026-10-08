/**
 * useWorkflowInstances unit tests
 *
 * Covers the requests each method makes, both list vocabularies, the embedded
 * definition in one shape, the whole history read from a backend that pages it
 * and from one that does not, and failures as typed errors that never look
 * like an empty list. `apiRequest` is mocked so no network is required.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const { apiRequestMock } = vi.hoisted(() => ({ apiRequestMock: vi.fn() }));
vi.mock('@buildpad/services', () => ({ apiRequest: apiRequestMock }));

import { DaaSRequestError } from '../src/daasRequest';
import { useWorkflowInstances } from '../src/useWorkflowInstances';

/** Path+query of every `apiRequest` call so far. */
function paths(): string[] {
  return apiRequestMock.mock.calls.map(([path]) => path as string);
}

/** Pull the path+query used in the last `apiRequest` call. */
function lastPath(): string {
  return apiRequestMock.mock.calls.at(-1)?.[0] as string;
}

/** An error as `apiRequest` throws it for a non-2xx answer. */
function apiError(status: number, body: unknown): Error {
  return new Error(`API error: ${status} - ${JSON.stringify(body)}`);
}

const instance = {
  id: 'i1',
  workflow: { id: 'd1', name: 'Review flow' },
  current_state: 'Review',
  collection: 'articles',
  item_id: '42',
  terminated: false,
  version_key: null,
  date_created: '2026-10-01T00:00:00Z',
  date_updated: '2026-10-02T00:00:00Z',
};

/** `count` transitions, newest first. */
function transitions(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `h${count - i}`,
    instance_id: 'i1',
    command: 'Submit',
    from_state: 'Draft',
    to_state: 'Review',
    transitioned_by: 'u1',
    transitioned_date: `2026-10-01T00:00:${String(count - i).padStart(2, '0')}Z`,
  }));
}

beforeEach(() => {
  apiRequestMock.mockReset();
});

describe('useWorkflowInstances.fetchInstances', () => {
  it('sends page and limit even when none are given', async () => {
    apiRequestMock.mockResolvedValueOnce({ data: [], count: 0, totalCount: 0, totalPages: 0 });
    const { result } = renderHook(() => useWorkflowInstances());

    await act(async () => {
      await result.current.fetchInstances();
    });

    expect(lastPath()).toBe('/api/workflow-instances?page=1&limit=25');
  });

  it('sends the page, the page size and the search term it is given', async () => {
    apiRequestMock.mockResolvedValueOnce({ data: [], count: 0, totalCount: 0, totalPages: 0 });
    const { result } = renderHook(() => useWorkflowInstances());

    await act(async () => {
      await result.current.fetchInstances({ page: 4, limit: 10, search: 'Review' });
    });

    expect(lastPath()).toBe('/api/workflow-instances?page=4&limit=10&search=Review');
  });

  it.each([
    [
      'the top-level counts of the Next.js backend',
      { data: [instance], count: 51, totalCount: 51, page: 3, pageSize: 25, totalPages: 3 },
    ],
    [
      'the meta counts of the engine',
      { data: [instance], meta: { total_count: 90, filter_count: 51, page: 3, limit: 25, offset: 50, total_pages: 3, total: 51 } },
    ],
  ])('reads %s', async (_vocabulary, answer) => {
    apiRequestMock.mockResolvedValueOnce(answer);
    const { result } = renderHook(() => useWorkflowInstances());

    let out: Awaited<ReturnType<typeof result.current.fetchInstances>> | undefined;
    await act(async () => {
      out = await result.current.fetchInstances({ page: 3 });
    });

    expect(out).toEqual({ items: [instance], total: 51, totalPages: 3, page: 3, limit: 25 });
  });

  it('reads data: null as an empty first page', async () => {
    apiRequestMock.mockResolvedValueOnce({ data: null, meta: { total_count: 0, filter_count: 0, total_pages: 1 } });
    const { result } = renderHook(() => useWorkflowInstances());

    let out: Awaited<ReturnType<typeof result.current.fetchInstances>> | undefined;
    await act(async () => {
      out = await result.current.fetchInstances();
    });

    expect(out).toEqual({ items: [], total: 0, totalPages: 1, page: 1, limit: 25 });
  });

  it('gives every row its definition in one shape', async () => {
    apiRequestMock.mockResolvedValueOnce({
      data: [
        instance,
        { ...instance, id: 'i2', workflow: null },
        { ...instance, id: 'i3', workflow: 'd9' },
        { id: 'i4', current_state: 'Draft', collection: 'pages', item_id: '7', terminated: true, version_key: 'v2' },
      ],
      count: 4,
      totalPages: 1,
    });
    const { result } = renderHook(() => useWorkflowInstances());

    let out: Awaited<ReturnType<typeof result.current.fetchInstances>> | undefined;
    await act(async () => {
      out = await result.current.fetchInstances();
    });

    expect(out?.items.map((row) => row.workflow)).toEqual([
      { id: 'd1', name: 'Review flow' },
      // Withheld by the caller's grant: null, which a `typeof … === 'object'` check would dereference.
      null,
      { id: 'd9', name: '' },
      null,
    ]);
  });

  it.each([
    ['a failed load', 500, { errors: [{ message: 'Failed to fetch workflow instances', extensions: { code: 'INTERNAL_SERVER_ERROR' } }] }, 'failure'],
    ['a refused load', 403, { errors: [{ message: 'Permission denied', extensions: { code: 'FORBIDDEN' } }] }, 'forbidden'],
    ['a session that must step up', 403, { error: 'MFA required', code: 'MFA_REQUIRED' }, 'mfaRequired'],
  ])('rejects %s instead of resolving to an empty list', async (_case, status, body, kind) => {
    apiRequestMock.mockRejectedValueOnce(apiError(status, body));
    const { result } = renderHook(() => useWorkflowInstances());

    let thrown: unknown;
    await act(async () => {
      thrown = await result.current.fetchInstances().catch((err: unknown) => err);
    });

    expect(thrown).toBeInstanceOf(DaaSRequestError);
    expect(thrown).toMatchObject({ kind, status });
    await waitFor(() => expect(result.current.errorInfo?.kind).toBe(kind));
  });
});

describe('useWorkflowInstances.getInstance', () => {
  it('reads one instance by id, with its definition’s document normalised', async () => {
    apiRequestMock.mockResolvedValueOnce({
      data: {
        ...instance,
        workflow: {
          id: 'd1',
          name: 'Review flow',
          workflow_json: { initial_state: 'Draft', states: [{ name: 'Draft', commands: [{ name: 'Submit', next_state: 'Review' }] }] },
        },
      },
    });
    const { result } = renderHook(() => useWorkflowInstances());

    let out: Awaited<ReturnType<typeof result.current.getInstance>> | undefined;
    await act(async () => {
      out = await result.current.getInstance('i1');
    });

    expect(lastPath()).toBe('/api/workflow-instances/i1');
    expect(out?.current_state).toBe('Review');
    expect(out?.workflow?.workflow_json?.states[0].commands[0]).toEqual({
      name: 'Submit',
      next_state: 'Review',
      actions: [],
      policies: [],
    });
  });

  it('leaves an embedded definition without a document as it is', async () => {
    apiRequestMock.mockResolvedValueOnce({ data: instance });
    const { result } = renderHook(() => useWorkflowInstances());

    let out: Awaited<ReturnType<typeof result.current.getInstance>> | undefined;
    await act(async () => {
      out = await result.current.getInstance('i1');
    });

    expect(out).toEqual(instance);
  });

  it.each([
    ['a missing id', 404, { errors: [{ message: 'Workflow instance not found', extensions: { code: 'NOT_FOUND' } }] }],
    ['an id that is not a valid one, on the engine', 404, { errors: [{ message: 'Workflow instance not found', extensions: { code: 'NOT_FOUND' } }] }],
    ['an id that is not a valid one, answered 400', 400, { errors: [{ message: 'Invalid workflow instance ID format', extensions: { code: 'INVALID_ID' } }] }],
  ])('rejects %s as not found', async (_case, status, body) => {
    apiRequestMock.mockRejectedValueOnce(apiError(status, body));
    const { result } = renderHook(() => useWorkflowInstances());

    let thrown: unknown;
    await act(async () => {
      thrown = await result.current.getInstance('missing').catch((err: unknown) => err);
    });

    expect(thrown).toMatchObject({ kind: 'notFound', status });
    await waitFor(() => expect(result.current.errorInfo?.kind).toBe('notFound'));
  });

  it('rejects an answer without a record as not found, never an empty page', async () => {
    apiRequestMock.mockResolvedValueOnce({ data: undefined });
    const { result } = renderHook(() => useWorkflowInstances());

    await act(async () => {
      await expect(result.current.getInstance('i1')).rejects.toMatchObject({
        kind: 'notFound',
        message: 'Workflow instance not found',
      });
    });
  });

  it('rejects a refusal as forbidden and a failure as a failure', async () => {
    const { result } = renderHook(() => useWorkflowInstances());

    apiRequestMock.mockRejectedValueOnce(
      apiError(403, { errors: [{ message: 'Permission denied', extensions: { code: 'FORBIDDEN' } }] }),
    );
    await act(async () => {
      await expect(result.current.getInstance('i1')).rejects.toMatchObject({ kind: 'forbidden' });
    });

    apiRequestMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await act(async () => {
      await expect(result.current.getInstance('i1')).rejects.toMatchObject({
        kind: 'failure',
        status: null,
        message: 'Failed to fetch',
      });
    });
  });
});

describe('useWorkflowInstances.fetchInstanceHistory', () => {
  /** A backend that pages the history (the engine): `limit` rows a page, no counts. */
  function servePaged(all: ReturnType<typeof transitions>) {
    apiRequestMock.mockImplementation(async (path: string) => {
      const query = new URLSearchParams(path.split('?')[1]);
      const page = Number(query.get('page'));
      const limit = Number(query.get('limit'));
      const rows = all.slice((page - 1) * limit, page * limit);
      return { data: rows.length ? rows : null };
    });
  }

  /** A backend that ignores page and limit (the Next.js route): every row, every time. */
  function serveWhole(all: ReturnType<typeof transitions>) {
    apiRequestMock.mockImplementation(async () => ({ data: all }));
  }

  it('asks for the first page with an explicit page and limit', async () => {
    servePaged(transitions(3));
    const { result } = renderHook(() => useWorkflowInstances());

    let history: unknown[] = [];
    await act(async () => {
      history = await result.current.fetchInstanceHistory('i1');
    });

    expect(paths()).toEqual(['/api/workflow-instances/i1/history?page=1&limit=100']);
    expect(history).toEqual(transitions(3));
  });

  it('reads past the first page of a backend that pages the history', async () => {
    // The engine serves 50 rows when no limit is sent; 230 transitions need three pages of 100.
    servePaged(transitions(230));
    const { result } = renderHook(() => useWorkflowInstances());

    let history: Array<{ id: string }> = [];
    await act(async () => {
      history = await result.current.fetchInstanceHistory('i1');
    });

    expect(history).toHaveLength(230);
    expect(history[0].id).toBe('h230');
    expect(history.at(-1)?.id).toBe('h1');
    expect(apiRequestMock).toHaveBeenCalledTimes(3);
  });

  it('asks once more when the last page is exactly full, and stops on the empty page', async () => {
    servePaged(transitions(100));
    const { result } = renderHook(() => useWorkflowInstances());

    let history: unknown[] = [];
    await act(async () => {
      history = await result.current.fetchInstanceHistory('i1');
    });

    expect(history).toHaveLength(100);
    expect(apiRequestMock).toHaveBeenCalledTimes(2);
  });

  it('takes the whole answer of a backend that ignores the limit', async () => {
    serveWhole(transitions(230));
    const { result } = renderHook(() => useWorkflowInstances());

    let history: unknown[] = [];
    await act(async () => {
      history = await result.current.fetchInstanceHistory('i1');
    });

    expect(history).toHaveLength(230);
    expect(apiRequestMock).toHaveBeenCalledTimes(1);
  });

  it('does not double the rows of a backend that ignores the page', async () => {
    // Exactly one full page from a backend that answers the same rows for page 2.
    serveWhole(transitions(100));
    const { result } = renderHook(() => useWorkflowInstances());

    let history: unknown[] = [];
    await act(async () => {
      history = await result.current.fetchInstanceHistory('i1');
    });

    expect(history).toHaveLength(100);
    expect(apiRequestMock).toHaveBeenCalledTimes(2);
  });

  it('keeps a row that arrived between two pages of a backend that ignores the page', async () => {
    const before = transitions(100);
    const after = [{ ...before[0], id: 'h101' }, ...before];
    apiRequestMock.mockResolvedValueOnce({ data: before }).mockResolvedValueOnce({ data: after });
    const { result } = renderHook(() => useWorkflowInstances());

    let history: Array<{ id: string }> = [];
    await act(async () => {
      history = await result.current.fetchInstanceHistory('i1');
    });

    expect(history).toHaveLength(101);
    expect(new Set(history.map((row) => row.id)).size).toBe(101);
  });

  it('does not double rows whose id the grant withholds', async () => {
    const withoutIds = transitions(100).map(({ id: _id, ...row }) => row);
    apiRequestMock.mockImplementation(async () => ({ data: withoutIds }));
    const { result } = renderHook(() => useWorkflowInstances());

    let history: unknown[] = [];
    await act(async () => {
      history = await result.current.fetchInstanceHistory('i1');
    });

    expect(history).toHaveLength(100);
  });

  it.each([[{ data: [] }], [{ data: null }]])('reads %j as no transitions', async (answer) => {
    apiRequestMock.mockResolvedValueOnce(answer);
    const { result } = renderHook(() => useWorkflowInstances());

    let history: unknown;
    await act(async () => {
      history = await result.current.fetchInstanceHistory('i1');
    });

    expect(history).toEqual([]);
  });

  it('rejects a caller without read access to the history, instead of "no transitions"', async () => {
    apiRequestMock.mockRejectedValueOnce(
      apiError(403, { errors: [{ message: 'Permission denied', extensions: { code: 'FORBIDDEN' } }] }),
    );
    const { result } = renderHook(() => useWorkflowInstances());

    let thrown: unknown;
    await act(async () => {
      thrown = await result.current.fetchInstanceHistory('i1').catch((err: unknown) => err);
    });

    expect(thrown).toBeInstanceOf(DaaSRequestError);
    expect(thrown).toMatchObject({ kind: 'forbidden', message: 'Permission denied' });
    await waitFor(() => expect(result.current.errorInfo?.kind).toBe('forbidden'));
  });

  it('rejects a failed load, and a load that fails on a later page', async () => {
    const { result } = renderHook(() => useWorkflowInstances());

    apiRequestMock.mockRejectedValueOnce(
      apiError(500, { errors: [{ message: 'Failed to fetch workflow history', extensions: { code: 'INTERNAL_SERVER_ERROR' } }] }),
    );
    await act(async () => {
      await expect(result.current.fetchInstanceHistory('i1')).rejects.toMatchObject({ kind: 'failure' });
    });

    apiRequestMock
      .mockResolvedValueOnce({ data: transitions(100) })
      .mockRejectedValueOnce(apiError(500, { error: 'Failed' }));
    await act(async () => {
      await expect(result.current.fetchInstanceHistory('i1')).rejects.toMatchObject({ kind: 'failure' });
    });
  });

  it('rejects an answer that is not a list', async () => {
    apiRequestMock.mockResolvedValueOnce({ error: 'Failed to fetch workflow history' });
    const { result } = renderHook(() => useWorkflowInstances());

    await act(async () => {
      await expect(result.current.fetchInstanceHistory('i1')).rejects.toMatchObject({ kind: 'failure' });
    });
  });
});

describe('useWorkflowInstances state', () => {
  it('stays loading while the instance and its history are both in flight', async () => {
    const pending: Array<(value: unknown) => void> = [];
    apiRequestMock.mockImplementation(() => new Promise((resolve) => { pending.push(resolve); }));
    const { result } = renderHook(() => useWorkflowInstances());

    let record!: Promise<unknown>;
    let history!: Promise<unknown>;
    act(() => {
      record = result.current.getInstance('i1');
      history = result.current.fetchInstanceHistory('i1');
    });
    await waitFor(() => expect(pending).toHaveLength(2));
    expect(result.current.loading).toBe(true);

    await act(async () => {
      pending[0]({ data: instance });
      await record;
    });
    expect(result.current.loading).toBe(true);

    await act(async () => {
      pending[1]({ data: [] });
      await history;
    });
    expect(result.current.loading).toBe(false);
  });
});
