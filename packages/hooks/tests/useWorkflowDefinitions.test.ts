/**
 * useWorkflowDefinitions unit tests
 *
 * Covers the requests each method makes, both list vocabularies, the document
 * normalised on read, loading every page for a picker, and failures as typed
 * errors that never look like an empty list or an empty record. `apiRequest`
 * is mocked so no network is required.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const { apiRequestMock } = vi.hoisted(() => ({ apiRequestMock: vi.fn() }));
vi.mock('@buildpad/services', () => ({ apiRequest: apiRequestMock }));

import { DaaSRequestError } from '../src/daasRequest';
import { useWorkflowDefinitions } from '../src/useWorkflowDefinitions';

/** Path+query of every `apiRequest` call so far. */
function paths(): string[] {
  return apiRequestMock.mock.calls.map(([path]) => path as string);
}

/** Pull the path+query used in the last `apiRequest` call. */
function lastPath(): string {
  return apiRequestMock.mock.calls.at(-1)?.[0] as string;
}

/** Pull the method and parsed JSON body of the last `apiRequest` call. */
function lastRequest(): { method?: string; body?: unknown } {
  const [, opts] = apiRequestMock.mock.calls.at(-1) ?? [];
  const { method, body } = (opts ?? {}) as { method?: string; body?: string };
  return { method, body: body ? JSON.parse(body) : undefined };
}

/** An error as `apiRequest` throws it for a non-2xx answer. */
function apiError(status: number, body: unknown): Error {
  return new Error(`API error: ${status} - ${JSON.stringify(body)}`);
}

const machine = {
  initial_state: 'Draft',
  states: [
    {
      name: 'Draft',
      isEndState: false,
      commands: [{ name: 'Submit', next_state: 'Review', actions: [], policies: ['p1'] }],
    },
    { name: 'Review', isEndState: true, commands: [] },
  ],
};

const definition = { id: 'd1', name: 'Review flow', description: null, workflow_json: machine };

beforeEach(() => {
  apiRequestMock.mockReset();
});

describe('useWorkflowDefinitions.fetchDefinitions', () => {
  it('sends page and limit even when none are given', async () => {
    apiRequestMock.mockResolvedValueOnce({ data: [], count: 0, totalCount: 0, totalPages: 0 });
    const { result } = renderHook(() => useWorkflowDefinitions());

    await act(async () => {
      await result.current.fetchDefinitions();
    });

    expect(lastPath()).toBe('/api/workflows?page=1&limit=25');
  });

  it('sends the page, the page size and the search term it is given', async () => {
    apiRequestMock.mockResolvedValueOnce({ data: [], count: 0, totalCount: 0, totalPages: 0 });
    const { result } = renderHook(() => useWorkflowDefinitions());

    await act(async () => {
      await result.current.fetchDefinitions({ page: 3, limit: 10, search: 'review, legal' });
    });

    const query = new URLSearchParams(lastPath().split('?')[1]);
    expect(lastPath().split('?')[0]).toBe('/api/workflows');
    expect(query.get('page')).toBe('3');
    expect(query.get('limit')).toBe('10');
    expect(query.get('search')).toBe('review, legal');
  });

  it('reads the top-level counts of the Next.js backend', async () => {
    apiRequestMock.mockResolvedValueOnce({
      data: [definition],
      count: 26,
      totalCount: 26,
      page: 2,
      pageSize: 25,
      totalPages: 2,
    });
    const { result } = renderHook(() => useWorkflowDefinitions());

    let out: Awaited<ReturnType<typeof result.current.fetchDefinitions>> | undefined;
    await act(async () => {
      out = await result.current.fetchDefinitions({ page: 2 });
    });

    expect(out).toEqual({ items: [definition], total: 26, totalPages: 2, page: 2, limit: 25 });
  });

  it('reads the meta counts of the engine to the same result', async () => {
    apiRequestMock.mockResolvedValueOnce({
      data: [definition],
      meta: { total_count: 40, filter_count: 26, page: 2, limit: 25, offset: 25, total_pages: 2, total: 26 },
    });
    const { result } = renderHook(() => useWorkflowDefinitions());

    let out: Awaited<ReturnType<typeof result.current.fetchDefinitions>> | undefined;
    await act(async () => {
      out = await result.current.fetchDefinitions({ page: 2 });
    });

    expect(out).toEqual({ items: [definition], total: 26, totalPages: 2, page: 2, limit: 25 });
  });

  it('reads data: null as an empty first page', async () => {
    apiRequestMock.mockResolvedValueOnce({
      data: null,
      meta: { total_count: 0, filter_count: 0, page: 1, limit: 25, offset: 0, total_pages: 1, total: 0 },
    });
    const { result } = renderHook(() => useWorkflowDefinitions());

    let out: Awaited<ReturnType<typeof result.current.fetchDefinitions>> | undefined;
    await act(async () => {
      out = await result.current.fetchDefinitions();
    });

    expect(out).toEqual({ items: [], total: 0, totalPages: 1, page: 1, limit: 25 });
  });

  it('gives each row a document the editor can walk', async () => {
    const stored = {
      ...definition,
      workflow_json: { initial_state: 'Draft', states: [{ name: 'Draft', commands: [{ name: 'Go', next_state: 'B' }] }] },
    };
    apiRequestMock.mockResolvedValueOnce({ data: [stored, { id: 'd2', name: 'Bare' }], count: 2, totalPages: 1 });
    const { result } = renderHook(() => useWorkflowDefinitions());

    let out: Awaited<ReturnType<typeof result.current.fetchDefinitions>> | undefined;
    await act(async () => {
      out = await result.current.fetchDefinitions();
    });

    expect(out?.items[0].workflow_json.states[0].commands[0]).toEqual({
      name: 'Go',
      next_state: 'B',
      actions: [],
      policies: [],
    });
    // A row whose grant withholds the document still has one to read.
    expect(out?.items[1].workflow_json).toEqual({ initial_state: '', states: [] });
  });

  it('rejects a failed load instead of resolving to an empty list', async () => {
    apiRequestMock.mockRejectedValueOnce(apiError(500, { error: 'Failed to fetch workflow definitions' }));
    const { result } = renderHook(() => useWorkflowDefinitions());

    let thrown: unknown;
    await act(async () => {
      thrown = await result.current.fetchDefinitions().catch((err: unknown) => err);
    });

    expect(thrown).toBeInstanceOf(DaaSRequestError);
    expect(thrown).toMatchObject({ kind: 'failure', status: 500, message: 'Failed to fetch workflow definitions' });
    await waitFor(() => expect(result.current.error).toBe('Failed to fetch workflow definitions'));
    expect(result.current.errorInfo).toBe(thrown);
  });

  it('rejects an answer that is not a list', async () => {
    apiRequestMock.mockResolvedValueOnce({ error: 'Failed to fetch workflow definitions' });
    const { result } = renderHook(() => useWorkflowDefinitions());

    await act(async () => {
      await expect(result.current.fetchDefinitions()).rejects.toMatchObject({ kind: 'failure' });
    });
  });

  it('rejects a refused load as forbidden', async () => {
    apiRequestMock.mockRejectedValueOnce(
      apiError(403, { errors: [{ message: 'Permission denied', extensions: { code: 'FORBIDDEN' } }] }),
    );
    const { result } = renderHook(() => useWorkflowDefinitions());

    await act(async () => {
      await expect(result.current.fetchDefinitions()).rejects.toMatchObject({
        kind: 'forbidden',
        code: 'FORBIDDEN',
        message: 'Permission denied',
      });
    });
  });
});

describe('useWorkflowDefinitions.fetchAllDefinitions', () => {
  /** `count` definitions named wf-1…, served `limit` a page. */
  function serve(count: number) {
    apiRequestMock.mockImplementation(async (path: string) => {
      const query = new URLSearchParams(path.split('?')[1]);
      const page = Number(query.get('page'));
      const limit = Number(query.get('limit'));
      const all = Array.from({ length: count }, (_, i) => ({ id: `d${i + 1}`, name: `wf-${i + 1}`, workflow_json: machine }));
      return {
        data: all.slice((page - 1) * limit, page * limit),
        count,
        totalCount: count,
        page,
        pageSize: limit,
        totalPages: Math.ceil(count / limit),
      };
    });
  }

  it('loads the definitions past the first page', async () => {
    serve(230);
    const { result } = renderHook(() => useWorkflowDefinitions());

    let all: Awaited<ReturnType<typeof result.current.fetchAllDefinitions>> = [];
    await act(async () => {
      all = await result.current.fetchAllDefinitions();
    });

    expect(all).toHaveLength(230);
    expect(all.at(-1)?.name).toBe('wf-230');
    expect(paths()).toEqual([
      '/api/workflows?page=1&limit=100',
      '/api/workflows?page=2&limit=100',
      '/api/workflows?page=3&limit=100',
    ]);
  });

  it('makes one request when everything fits on a page', async () => {
    serve(26);
    const { result } = renderHook(() => useWorkflowDefinitions());

    let all: unknown[] = [];
    await act(async () => {
      all = await result.current.fetchAllDefinitions();
    });

    expect(all).toHaveLength(26);
    expect(apiRequestMock).toHaveBeenCalledTimes(1);
  });

  it('passes the search term on every page', async () => {
    serve(0);
    const { result } = renderHook(() => useWorkflowDefinitions());

    await act(async () => {
      await result.current.fetchAllDefinitions({ search: 'legal' });
    });

    expect(paths()).toEqual(['/api/workflows?page=1&limit=100&search=legal']);
  });

  it('stops at an empty page even when the count says there is more', async () => {
    apiRequestMock.mockResolvedValue({ data: [], count: 500, totalCount: 500, totalPages: 5 });
    const { result } = renderHook(() => useWorkflowDefinitions());

    await act(async () => {
      await result.current.fetchAllDefinitions();
    });

    expect(apiRequestMock).toHaveBeenCalledTimes(1);
  });

  it('rejects when a later page fails, rather than returning the pages it has', async () => {
    apiRequestMock
      .mockResolvedValueOnce({ data: [definition], count: 150, totalCount: 150, totalPages: 2 })
      .mockRejectedValueOnce(apiError(500, { error: 'Failed to fetch workflow definitions' }));
    const { result } = renderHook(() => useWorkflowDefinitions());

    await act(async () => {
      await expect(result.current.fetchAllDefinitions()).rejects.toMatchObject({ kind: 'failure', status: 500 });
    });
  });
});

describe('useWorkflowDefinitions.getDefinition', () => {
  it('reads one definition by id, with its document normalised', async () => {
    apiRequestMock.mockResolvedValueOnce({
      data: { ...definition, workflow_json: { initial_state: 'Draft', states: [{ name: 'Draft' }] } },
    });
    const { result } = renderHook(() => useWorkflowDefinitions());

    let out: Awaited<ReturnType<typeof result.current.getDefinition>> | undefined;
    await act(async () => {
      out = await result.current.getDefinition('d1');
    });

    expect(lastPath()).toBe('/api/workflows/d1');
    expect(out?.workflow_json).toEqual({ initial_state: 'Draft', states: [{ name: 'Draft', commands: [] }] });
  });

  it('escapes the id in the path', async () => {
    apiRequestMock.mockResolvedValueOnce({ data: definition });
    const { result } = renderHook(() => useWorkflowDefinitions());

    await act(async () => {
      await result.current.getDefinition('a/b?c');
    });

    expect(lastPath()).toBe('/api/workflows/a%2Fb%3Fc');
  });

  it.each([
    ['the Next.js backend', { error: 'Workflow definition not found' }],
    ['the engine', { errors: [{ message: 'Workflow definition not found', extensions: { code: 'NOT_FOUND' } }] }],
  ])('rejects a missing id as not found (%s)', async (_backend, body) => {
    apiRequestMock.mockRejectedValueOnce(apiError(404, body));
    const { result } = renderHook(() => useWorkflowDefinitions());

    let thrown: unknown;
    await act(async () => {
      thrown = await result.current.getDefinition('missing').catch((err: unknown) => err);
    });

    expect(thrown).toMatchObject({ kind: 'notFound', status: 404, message: 'Workflow definition not found' });
    await waitFor(() => expect(result.current.errorInfo?.kind).toBe('notFound'));
  });

  it('rejects an id that is not a valid one as not found', async () => {
    apiRequestMock.mockRejectedValueOnce(apiError(400, { error: 'Invalid workflow definition ID format' }));
    const { result } = renderHook(() => useWorkflowDefinitions());

    await act(async () => {
      await expect(result.current.getDefinition('nope')).rejects.toMatchObject({ kind: 'notFound', status: 400 });
    });
    await waitFor(() => expect(result.current.errorInfo?.kind).toBe('notFound'));
  });

  it('rejects an answer without a record as not found, never an empty definition', async () => {
    apiRequestMock.mockResolvedValueOnce({ data: null });
    const { result } = renderHook(() => useWorkflowDefinitions());

    await act(async () => {
      await expect(result.current.getDefinition('d1')).rejects.toMatchObject({
        kind: 'notFound',
        message: 'Workflow definition not found',
      });
    });
  });

  it('tells a refusal and a session that must step up from a missing id', async () => {
    const { result } = renderHook(() => useWorkflowDefinitions());

    apiRequestMock.mockRejectedValueOnce(apiError(403, { error: 'Permission denied' }));
    await act(async () => {
      await expect(result.current.getDefinition('d1')).rejects.toMatchObject({ kind: 'forbidden' });
    });

    apiRequestMock.mockRejectedValueOnce(
      apiError(403, { error: 'MFA required', code: 'MFA_REQUIRED', current_aal: 'aal1', required_aal: 'aal2' }),
    );
    await act(async () => {
      await expect(result.current.getDefinition('d1')).rejects.toMatchObject({
        kind: 'mfaRequired',
        code: 'MFA_REQUIRED',
        message: 'MFA required',
      });
    });
  });
});

describe('useWorkflowDefinitions writes', () => {
  it('createDefinition POSTs the definition and resolves to the id both backends answer', async () => {
    apiRequestMock.mockResolvedValueOnce({ data: 'new-id' });
    const { result } = renderHook(() => useWorkflowDefinitions());

    let id: string | undefined;
    await act(async () => {
      id = await result.current.createDefinition({ name: 'Flow', description: '', workflow_json: machine });
    });

    expect(lastPath()).toBe('/api/workflows');
    expect(lastRequest()).toEqual({
      method: 'POST',
      body: { name: 'Flow', description: '', workflow_json: machine },
    });
    expect(id).toBe('new-id');
  });

  it('createDefinition sends keys the editor has no field for', async () => {
    const gated = {
      initial_state: 'A',
      states: [
        {
          name: 'A',
          isEndState: false,
          position: { x: 1, y: 2 },
          commands: [
            { name: 'Go', next_state: 'B', actions: [], policies: [], module_access_keys: ['workflow:approve'], sourceHandle: 'right-1' },
          ],
        },
      ],
    };
    apiRequestMock.mockResolvedValueOnce({ data: 'new-id' });
    const { result } = renderHook(() => useWorkflowDefinitions());

    await act(async () => {
      await result.current.createDefinition({ name: 'Flow', workflow_json: gated });
    });

    expect(lastRequest().body).toEqual({ name: 'Flow', workflow_json: gated });
  });

  it('createDefinition reads the id out of a row, too', async () => {
    apiRequestMock.mockResolvedValueOnce({ data: { id: 'row-id', name: 'Flow' } });
    const { result } = renderHook(() => useWorkflowDefinitions());

    let id: string | undefined;
    await act(async () => {
      id = await result.current.createDefinition({ name: 'Flow', workflow_json: machine });
    });

    expect(id).toBe('row-id');
  });

  it.each([[undefined], [{}], [{ data: null }], [{ data: '' }], [{ data: { name: 'Flow' } }]])(
    'createDefinition rejects %j, an answer without an id',
    async (answer) => {
      apiRequestMock.mockResolvedValueOnce(answer);
      const { result } = renderHook(() => useWorkflowDefinitions());

      await act(async () => {
        await expect(
          result.current.createDefinition({ name: 'Flow', workflow_json: machine }),
        ).rejects.toMatchObject({ kind: 'failure' });
      });
    },
  );

  it('createDefinition rejects a refused save with the server’s sentence', async () => {
    apiRequestMock.mockRejectedValueOnce(apiError(400, { error: 'Workflow name is required' }));
    const { result } = renderHook(() => useWorkflowDefinitions());

    await act(async () => {
      await expect(
        result.current.createDefinition({ name: '', workflow_json: machine }),
      ).rejects.toMatchObject({ kind: 'invalid', status: 400, message: 'Workflow name is required' });
    });
  });

  it.each([
    ['the id (Next.js backend)', { data: 'd1' }],
    ['the stored row (engine)', { data: definition }],
  ])('updateDefinition PATCHes only what it is given and resolves, answered %s', async (_answer, answer) => {
    apiRequestMock.mockResolvedValueOnce(answer);
    const { result } = renderHook(() => useWorkflowDefinitions());

    let out: unknown = 'unset';
    await act(async () => {
      out = await result.current.updateDefinition('d1', { name: 'Renamed' });
    });

    expect(lastPath()).toBe('/api/workflows/d1');
    expect(lastRequest()).toEqual({ method: 'PATCH', body: { name: 'Renamed' } });
    expect(out).toBeUndefined();
  });

  // The engine binds `description` to a pointer: a JSON null is "not sent",
  // the request answers 200 and the stored text stays. '' clears it on both.
  it('updateDefinition clears a description with an empty string, which both backends store', async () => {
    apiRequestMock.mockResolvedValueOnce({ data: 'd1' });
    const { result } = renderHook(() => useWorkflowDefinitions());

    await act(async () => {
      await result.current.updateDefinition('d1', { description: null });
    });

    expect(lastRequest()).toEqual({ method: 'PATCH', body: { description: '' } });
  });

  it('updateDefinition sends a description it is given, and none when the key is absent', async () => {
    apiRequestMock.mockResolvedValue({ data: 'd1' });
    const { result } = renderHook(() => useWorkflowDefinitions());

    await act(async () => {
      await result.current.updateDefinition('d1', { description: 'Two reviewers' });
    });
    expect(lastRequest().body).toEqual({ description: 'Two reviewers' });

    await act(async () => {
      await result.current.updateDefinition('d1', { name: 'Flow' });
    });
    expect(lastRequest().body).toEqual({ name: 'Flow' });
  });

  it('updateDefinition rejects a field the grant withholds as forbidden', async () => {
    apiRequestMock.mockRejectedValueOnce(
      apiError(403, { error: 'Permission denied: Cannot update restricted fields', forbidden_fields: ['workflow_json'] }),
    );
    const { result } = renderHook(() => useWorkflowDefinitions());

    await act(async () => {
      await expect(result.current.updateDefinition('d1', { workflow_json: machine })).rejects.toMatchObject({
        kind: 'forbidden',
        message: 'Permission denied: Cannot update restricted fields',
      });
    });
  });

  it.each([
    ['{ success } (Next.js backend)', { success: true }],
    ['{ data: { success } } (engine)', { data: { success: true } }],
    ['no body', undefined],
  ])('deleteDefinition DELETEs by id and resolves, answered %s', async (_answer, answer) => {
    apiRequestMock.mockResolvedValueOnce(answer);
    const { result } = renderHook(() => useWorkflowDefinitions());

    await act(async () => {
      await result.current.deleteDefinition('d1');
    });

    expect(lastPath()).toBe('/api/workflows/d1');
    expect(lastRequest().method).toBe('DELETE');
  });

  it('deleteDefinition rejects a definition in use with the reason', async () => {
    const reason = 'Cannot delete workflow definition: it is assigned to one or more collections';
    apiRequestMock.mockRejectedValueOnce(apiError(400, { errors: [{ message: reason, extensions: { code: 'INVALID_PAYLOAD' } }] }));
    const { result } = renderHook(() => useWorkflowDefinitions());

    await act(async () => {
      await expect(result.current.deleteDefinition('d1')).rejects.toMatchObject({ kind: 'invalid', message: reason });
    });
    await waitFor(() => expect(result.current.error).toBe(reason));
  });

  it('deleteDefinition rejects an id that is already gone as not found', async () => {
    apiRequestMock.mockRejectedValueOnce(apiError(404, { error: 'Workflow definition not found' }));
    const { result } = renderHook(() => useWorkflowDefinitions());

    await act(async () => {
      await expect(result.current.deleteDefinition('d1')).rejects.toMatchObject({ kind: 'notFound' });
    });
  });
});

describe('useWorkflowDefinitions state', () => {
  it('exposes loading=true while a request is in flight', async () => {
    let resolve!: (value: unknown) => void;
    apiRequestMock.mockImplementationOnce(() => new Promise((r) => { resolve = r; }));
    const { result } = renderHook(() => useWorkflowDefinitions());

    let pending: Promise<unknown>;
    act(() => {
      pending = result.current.fetchDefinitions();
    });

    await waitFor(() => expect(result.current.loading).toBe(true));

    await act(async () => {
      resolve({ data: [], count: 0, totalPages: 1 });
      await pending;
    });

    expect(result.current.loading).toBe(false);
  });

  it('keeps its methods stable across renders', () => {
    const { result, rerender } = renderHook(() => useWorkflowDefinitions());
    const first = result.current;
    rerender();
    expect(result.current.fetchDefinitions).toBe(first.fetchDefinitions);
    expect(result.current.getDefinition).toBe(first.getDefinition);
    expect(result.current.deleteDefinition).toBe(first.deleteDefinition);
  });
});
