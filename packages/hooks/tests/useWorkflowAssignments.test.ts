/**
 * useWorkflowAssignments unit tests
 *
 * Covers the requests each method makes, both list vocabularies, the filter
 * rule refused before it is sent, and failures as typed errors that never
 * look like an empty list or a blank form. `apiRequest` is mocked so no
 * network is required.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const { apiRequestMock } = vi.hoisted(() => ({ apiRequestMock: vi.fn() }));
vi.mock('@buildpad/services', () => ({ apiRequest: apiRequestMock }));

import { DaaSRequestError } from '../src/daasRequest';
import { useWorkflowAssignments } from '../src/useWorkflowAssignments';

/** Pull the path+query used in the last `apiRequest` call. */
function lastPath(): string {
  return apiRequestMock.mock.calls.at(-1)?.[0] as string;
}

/** Pull the method and parsed JSON body of the last `apiRequest` call. */
function lastRequest(): { method?: string; body?: Record<string, unknown> } {
  const [, opts] = apiRequestMock.mock.calls.at(-1) ?? [];
  const { method, body } = (opts ?? {}) as { method?: string; body?: string };
  return { method, body: body ? JSON.parse(body) : undefined };
}

/** An error as `apiRequest` throws it for a non-2xx answer. */
function apiError(status: number, body: unknown): Error {
  return new Error(`API error: ${status} - ${JSON.stringify(body)}`);
}

const assignment = {
  id: 'a1',
  workflow: 'd1',
  collection: 'articles',
  filter_rule: { status: { _eq: 'draft' } },
  date_created: '2026-10-01T00:00:00Z',
  workflow_definition: { id: 'd1', name: 'Review flow' },
};

beforeEach(() => {
  apiRequestMock.mockReset();
});

describe('useWorkflowAssignments.fetchAssignments', () => {
  it('sends page and limit even when none are given', async () => {
    apiRequestMock.mockResolvedValueOnce({ data: [], count: 0, totalCount: 0, totalPages: 0 });
    const { result } = renderHook(() => useWorkflowAssignments());

    await act(async () => {
      await result.current.fetchAssignments();
    });

    expect(lastPath()).toBe('/api/workflow-assignments?page=1&limit=25');
  });

  it('sends the page, the page size and the search term it is given', async () => {
    apiRequestMock.mockResolvedValueOnce({ data: [], count: 0, totalCount: 0, totalPages: 0 });
    const { result } = renderHook(() => useWorkflowAssignments());

    await act(async () => {
      await result.current.fetchAssignments({ page: 2, limit: 50, search: 'art' });
    });

    expect(lastPath()).toBe('/api/workflow-assignments?page=2&limit=50&search=art');
  });

  it.each([
    [
      'the top-level counts of the Next.js backend',
      { data: [assignment], count: 26, totalCount: 26, page: 2, pageSize: 25, totalPages: 2 },
    ],
    [
      'the meta counts of the engine',
      { data: [assignment], meta: { total_count: 30, filter_count: 26, page: 2, limit: 25, offset: 25, total_pages: 2, total: 26 } },
    ],
  ])('reads %s', async (_vocabulary, answer) => {
    apiRequestMock.mockResolvedValueOnce(answer);
    const { result } = renderHook(() => useWorkflowAssignments());

    let out: Awaited<ReturnType<typeof result.current.fetchAssignments>> | undefined;
    await act(async () => {
      out = await result.current.fetchAssignments({ page: 2 });
    });

    expect(out).toEqual({ items: [assignment], total: 26, totalPages: 2, page: 2, limit: 25 });
  });

  it('reads data: null as an empty first page', async () => {
    apiRequestMock.mockResolvedValueOnce({ data: null, meta: { total_count: 0, filter_count: 0, total_pages: 1 } });
    const { result } = renderHook(() => useWorkflowAssignments());

    let out: Awaited<ReturnType<typeof result.current.fetchAssignments>> | undefined;
    await act(async () => {
      out = await result.current.fetchAssignments();
    });

    expect(out).toEqual({ items: [], total: 0, totalPages: 1, page: 1, limit: 25 });
  });

  it('shows a page past the last one as it is answered, for the caller to step back', async () => {
    // Page 2 held one assignment and it was deleted.
    apiRequestMock.mockResolvedValueOnce({ data: [], count: 25, totalCount: 25, page: 2, pageSize: 25, totalPages: 1 });
    const { result } = renderHook(() => useWorkflowAssignments());

    let out: Awaited<ReturnType<typeof result.current.fetchAssignments>> | undefined;
    await act(async () => {
      out = await result.current.fetchAssignments({ page: 2 });
    });

    expect(out).toMatchObject({ items: [], total: 25, totalPages: 1, page: 2 });
  });

  it.each([
    ['a failed load', 500, { errors: [{ message: 'Failed to fetch workflow assignments', extensions: { code: 'INTERNAL_SERVER_ERROR' } }] }, 'failure'],
    ['a refused load', 403, { errors: [{ message: 'Permission denied', extensions: { code: 'FORBIDDEN' } }] }, 'forbidden'],
    ['a signed-out session', 401, { errors: [{ message: 'Not authenticated', extensions: { code: 'UNAUTHORIZED' } }] }, 'unauthenticated'],
  ])('rejects %s instead of resolving to an empty list', async (_case, status, body, kind) => {
    apiRequestMock.mockRejectedValueOnce(apiError(status, body));
    const { result } = renderHook(() => useWorkflowAssignments());

    let thrown: unknown;
    await act(async () => {
      thrown = await result.current.fetchAssignments().catch((err: unknown) => err);
    });

    expect(thrown).toBeInstanceOf(DaaSRequestError);
    expect(thrown).toMatchObject({ kind, status });
    await waitFor(() => expect(result.current.errorInfo?.kind).toBe(kind));
  });
});

describe('useWorkflowAssignments.getAssignment', () => {
  it('reads one assignment by id', async () => {
    apiRequestMock.mockResolvedValueOnce({ data: assignment });
    const { result } = renderHook(() => useWorkflowAssignments());

    let out: unknown;
    await act(async () => {
      out = await result.current.getAssignment('a1');
    });

    expect(lastPath()).toBe('/api/workflow-assignments/a1');
    expect(out).toEqual(assignment);
  });

  it('rejects a missing id as not found', async () => {
    apiRequestMock.mockRejectedValueOnce(
      apiError(404, { errors: [{ message: 'Workflow assignment not found', extensions: { code: 'NOT_FOUND' } }] }),
    );
    const { result } = renderHook(() => useWorkflowAssignments());

    let thrown: unknown;
    await act(async () => {
      thrown = await result.current.getAssignment('missing').catch((err: unknown) => err);
    });

    expect(thrown).toMatchObject({ kind: 'notFound', code: 'NOT_FOUND', message: 'Workflow assignment not found' });
    await waitFor(() => expect(result.current.error).toBe('Workflow assignment not found'));
  });

  it('rejects an id that is not a valid one as not found', async () => {
    apiRequestMock.mockRejectedValueOnce(
      apiError(400, { errors: [{ message: 'Invalid workflow assignment ID format', extensions: { code: 'INVALID_ID' } }] }),
    );
    const { result } = renderHook(() => useWorkflowAssignments());

    await act(async () => {
      await expect(result.current.getAssignment('nope')).rejects.toMatchObject({ kind: 'notFound' });
    });
  });

  it('rejects an answer without a record as not found, never a blank form', async () => {
    apiRequestMock.mockResolvedValueOnce({});
    const { result } = renderHook(() => useWorkflowAssignments());

    await act(async () => {
      await expect(result.current.getAssignment('a1')).rejects.toMatchObject({
        kind: 'notFound',
        message: 'Workflow assignment not found',
      });
    });
  });

  it('rejects a refusal as forbidden and a failure as a failure', async () => {
    const { result } = renderHook(() => useWorkflowAssignments());

    apiRequestMock.mockRejectedValueOnce(
      apiError(403, { errors: [{ message: 'Permission denied', extensions: { code: 'FORBIDDEN' } }] }),
    );
    await act(async () => {
      await expect(result.current.getAssignment('a1')).rejects.toMatchObject({ kind: 'forbidden' });
    });

    apiRequestMock.mockRejectedValueOnce(
      apiError(500, { errors: [{ message: 'Failed to fetch workflow assignment', extensions: { code: 'INTERNAL_SERVER_ERROR' } }] }),
    );
    await act(async () => {
      await expect(result.current.getAssignment('a1')).rejects.toMatchObject({ kind: 'failure' });
    });
  });
});

describe('useWorkflowAssignments.createAssignment', () => {
  it('POSTs the workflow, the collection and the rule, and resolves to the row', async () => {
    apiRequestMock.mockResolvedValueOnce({ data: assignment });
    const { result } = renderHook(() => useWorkflowAssignments());

    let out: unknown;
    await act(async () => {
      out = await result.current.createAssignment({
        workflow: 'd1',
        collection: 'articles',
        filter_rule: { status: { _eq: 'draft' } },
      });
    });

    expect(lastPath()).toBe('/api/workflow-assignments');
    expect(lastRequest()).toEqual({
      method: 'POST',
      body: { workflow: 'd1', collection: 'articles', filter_rule: { status: { _eq: 'draft' } } },
    });
    expect(out).toEqual(assignment);
  });

  it.each([[null], [undefined]])('sends no filter_rule key for %j', async (rule) => {
    apiRequestMock.mockResolvedValueOnce({ data: { ...assignment, filter_rule: null } });
    const { result } = renderHook(() => useWorkflowAssignments());

    await act(async () => {
      await result.current.createAssignment({ workflow: 'd1', collection: 'articles', filter_rule: rule });
    });

    expect(lastRequest().body).toEqual({ workflow: 'd1', collection: 'articles' });
  });

  it.each([[[]], [[{ status: { _eq: 'draft' } }]], [123], ['{"a":1}'], [true]])(
    'refuses the rule %j without calling the API',
    async (rule) => {
      const { result } = renderHook(() => useWorkflowAssignments());

      let thrown: unknown;
      await act(async () => {
        thrown = await result.current
          .createAssignment({ workflow: 'd1', collection: 'articles', filter_rule: rule as never })
          .catch((err: unknown) => err);
      });

      expect(apiRequestMock).not.toHaveBeenCalled();
      expect(thrown).toBeInstanceOf(DaaSRequestError);
      expect(thrown).toMatchObject({
        kind: 'invalid',
        code: 'INVALID_PAYLOAD',
        message: 'filter_rule must be a JSON object or null',
      });
      await waitFor(() => expect(result.current.error).toBe('filter_rule must be a JSON object or null'));
    },
  );

  it('rejects a save that is answered without the row', async () => {
    apiRequestMock.mockResolvedValueOnce({ data: null });
    const { result } = renderHook(() => useWorkflowAssignments());

    await act(async () => {
      await expect(
        result.current.createAssignment({ workflow: 'd1', collection: 'articles' }),
      ).rejects.toMatchObject({ kind: 'failure' });
    });
  });

  it('rejects a refused save as forbidden', async () => {
    apiRequestMock.mockRejectedValueOnce(
      apiError(403, { errors: [{ message: 'Permission denied', extensions: { code: 'FORBIDDEN' } }] }),
    );
    const { result } = renderHook(() => useWorkflowAssignments());

    await act(async () => {
      await expect(
        result.current.createAssignment({ workflow: 'd1', collection: 'articles' }),
      ).rejects.toMatchObject({ kind: 'forbidden', message: 'Permission denied' });
    });
  });
});

describe('useWorkflowAssignments.updateAssignment', () => {
  it('PATCHes only the keys it is given and resolves to the row', async () => {
    apiRequestMock.mockResolvedValueOnce({ data: { ...assignment, collection: 'pages' } });
    const { result } = renderHook(() => useWorkflowAssignments());

    let out: Awaited<ReturnType<typeof result.current.updateAssignment>> | undefined;
    await act(async () => {
      out = await result.current.updateAssignment('a1', { collection: 'pages' });
    });

    expect(lastPath()).toBe('/api/workflow-assignments/a1');
    expect(lastRequest()).toEqual({ method: 'PATCH', body: { collection: 'pages' } });
    expect(out?.collection).toBe('pages');
  });

  it('sends filter_rule: null to clear the rule', async () => {
    apiRequestMock.mockResolvedValueOnce({ data: { ...assignment, filter_rule: null } });
    const { result } = renderHook(() => useWorkflowAssignments());

    await act(async () => {
      await result.current.updateAssignment('a1', { filter_rule: null });
    });

    expect(lastRequest().body).toEqual({ filter_rule: null });
  });

  it('refuses a rule that is not an object without calling the API', async () => {
    const { result } = renderHook(() => useWorkflowAssignments());

    await act(async () => {
      await expect(
        result.current.updateAssignment('a1', { filter_rule: [] as never }),
      ).rejects.toMatchObject({ kind: 'invalid', code: 'INVALID_PAYLOAD' });
    });

    expect(apiRequestMock).not.toHaveBeenCalled();
  });

  it('rejects the server’s own refusal of a rule as invalid', async () => {
    apiRequestMock.mockRejectedValueOnce(
      apiError(400, { errors: [{ message: 'filter_rule must be a JSON object or null', extensions: { code: 'INVALID_PAYLOAD' } }] }),
    );
    const { result } = renderHook(() => useWorkflowAssignments());

    await act(async () => {
      await expect(result.current.updateAssignment('a1', { collection: 'pages' })).rejects.toMatchObject({
        kind: 'invalid',
        status: 400,
      });
    });
  });

  it('rejects a missing id as not found', async () => {
    apiRequestMock.mockRejectedValueOnce(
      apiError(404, { errors: [{ message: 'Workflow assignment not found', extensions: { code: 'NOT_FOUND' } }] }),
    );
    const { result } = renderHook(() => useWorkflowAssignments());

    await act(async () => {
      await expect(result.current.updateAssignment('gone', { collection: 'pages' })).rejects.toMatchObject({
        kind: 'notFound',
      });
    });
  });
});

describe('useWorkflowAssignments.deleteAssignment', () => {
  it.each([
    ['{ success } (Next.js backend)', { success: true }],
    ['{ data: { success } } (engine)', { data: { success: true } }],
  ])('DELETEs by id and resolves, answered %s', async (_answer, answer) => {
    apiRequestMock.mockResolvedValueOnce(answer);
    const { result } = renderHook(() => useWorkflowAssignments());

    await act(async () => {
      await result.current.deleteAssignment('a1');
    });

    expect(lastPath()).toBe('/api/workflow-assignments/a1');
    expect(lastRequest().method).toBe('DELETE');
  });

  it('rejects a failed delete with what the server said', async () => {
    apiRequestMock.mockRejectedValueOnce(
      apiError(500, { errors: [{ message: 'Failed to delete workflow assignment', extensions: { code: 'INTERNAL_SERVER_ERROR' } }] }),
    );
    const { result } = renderHook(() => useWorkflowAssignments());

    await act(async () => {
      await expect(result.current.deleteAssignment('a1')).rejects.toMatchObject({
        kind: 'failure',
        message: 'Failed to delete workflow assignment',
      });
    });
  });
});

describe('useWorkflowAssignments state', () => {
  it('exposes loading=true while a request is in flight', async () => {
    let resolve!: (value: unknown) => void;
    apiRequestMock.mockImplementationOnce(() => new Promise((r) => { resolve = r; }));
    const { result } = renderHook(() => useWorkflowAssignments());

    let pending: Promise<unknown>;
    act(() => {
      pending = result.current.getAssignment('a1');
    });

    await waitFor(() => expect(result.current.loading).toBe(true));

    await act(async () => {
      resolve({ data: assignment });
      await pending;
    });

    expect(result.current.loading).toBe(false);
  });
});
