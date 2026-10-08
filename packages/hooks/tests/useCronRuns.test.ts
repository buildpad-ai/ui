/**
 * useCronRuns unit tests
 *
 * Covers the requests the two history methods make, a page computed into an
 * offset, the two meta vocabularies read to one result, `logs` as a list
 * whatever the row carries, and failures as typed errors that never look
 * like "no runs yet". `apiRequest` is mocked so no network is required.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const { apiRequestMock } = vi.hoisted(() => ({ apiRequestMock: vi.fn() }));
vi.mock('@buildpad/services', () => ({ apiRequest: apiRequestMock }));

import { DaaSRequestError } from '../src/daasRequest';
import { useCronRuns } from '../src/useCronRuns';

/** Pull the path+query used in the last `apiRequest` call. */
function lastPath(): string {
  return apiRequestMock.mock.calls.at(-1)?.[0] as string;
}

/** An error as `apiRequest` throws it for a non-2xx answer. */
function apiError(status: number, body: unknown): Error {
  return new Error(`API error: ${status} - ${JSON.stringify(body)}`);
}

/** The error envelope both backends use for most refusals. */
function envelope(message: string, code: string) {
  return { errors: [{ message, extensions: { code } }] };
}

const JOB_ID = '3f0c8e2a-6c53-4a0e-9a59-0f8f2f1d7b11';

/** `count` runs of one job, newest first. */
function runs(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `r${count - i}`,
    job_id: JOB_ID,
    job_name: 'nightly-report',
    triggered_at: `2026-10-08T02:00:${String(count - i).padStart(2, '0')}.000Z`,
    started_at: `2026-10-08T02:00:${String(count - i).padStart(2, '0')}.010Z`,
    finished_at: `2026-10-08T02:00:${String(count - i).padStart(2, '0')}.250Z`,
    duration_ms: 240,
    status: 'success',
    error: null,
    logs: ['[2026-10-08T02:00:00.020Z] [INFO] Job started: nightly-report'],
    triggered_by: 'schedule',
  }));
}

/** The Next.js routes' answer: `meta.total` / `limit` / `offset` and nothing else. */
function nextAnswer(rows: unknown[], total: number, limit: number, offset: number) {
  return { data: rows, meta: { total, limit, offset } };
}

/** The engine's answer: its own pagination keys, with `total` / `limit` / `offset` beside them. */
function engineAnswer(rows: unknown[] | null, total: number, limit: number, offset: number) {
  return {
    data: rows,
    meta: {
      total_count: total,
      filter_count: total,
      page: Math.floor(offset / limit) + 1,
      total_pages: Math.max(1, Math.ceil(total / limit)),
      total,
      limit,
      offset,
    },
  };
}

beforeEach(() => {
  apiRequestMock.mockReset();
});

describe('useCronRuns.fetchRuns', () => {
  it('sends limit and offset even when none are given', async () => {
    apiRequestMock.mockResolvedValueOnce(nextAnswer([], 0, 50, 0));
    const { result } = renderHook(() => useCronRuns());

    await act(async () => {
      await result.current.fetchRuns();
    });

    expect(lastPath()).toBe('/api/cron/history?limit=50&offset=0');
  });

  it('turns a page into the offset of its first run', async () => {
    apiRequestMock.mockResolvedValue(nextAnswer([], 0, 50, 0));
    const { result } = renderHook(() => useCronRuns());

    await act(async () => {
      await result.current.fetchRuns({ page: 3 });
    });
    expect(lastPath()).toBe('/api/cron/history?limit=50&offset=100');

    await act(async () => {
      await result.current.fetchRuns({ page: 2, limit: 20 });
    });
    expect(lastPath()).toBe('/api/cron/history?limit=20&offset=20');
  });

  it('sends an offset it is given, which wins over a page', async () => {
    apiRequestMock.mockResolvedValueOnce(nextAnswer([], 0, 10, 35));
    const { result } = renderHook(() => useCronRuns());

    await act(async () => {
      await result.current.fetchRuns({ limit: 10, offset: 35, page: 9 });
    });

    expect(lastPath()).toBe('/api/cron/history?limit=10&offset=35');
  });

  // The engine refuses a limit, a page or an offset that is not a number in range
  it.each([
    [{ limit: 0 }, 'limit=50&offset=0'],
    [{ limit: -1 }, 'limit=50&offset=0'],
    [{ limit: Number.NaN }, 'limit=50&offset=0'],
    [{ limit: 20.9 }, 'limit=20&offset=0'],
    [{ page: 0 }, 'limit=50&offset=0'],
    [{ page: -3 }, 'limit=50&offset=0'],
    [{ page: 2.7 }, 'limit=50&offset=50'],
    [{ offset: -10 }, 'limit=50&offset=0'],
    [{ offset: Number.POSITIVE_INFINITY }, 'limit=50&offset=0'],
    [{ offset: 12.5 }, 'limit=50&offset=12'],
  ])('asks for a page that exists when it is given %j', async (params, query) => {
    apiRequestMock.mockResolvedValueOnce(nextAnswer([], 0, 50, 0));
    const { result } = renderHook(() => useCronRuns());

    await act(async () => {
      await result.current.fetchRuns(params);
    });

    expect(lastPath()).toBe(`/api/cron/history?${query}`);
  });

  it('reads the meta of the Next.js backend', async () => {
    const page = runs(120).slice(50, 100);
    apiRequestMock.mockResolvedValueOnce(nextAnswer(page, 120, 50, 50));
    const { result } = renderHook(() => useCronRuns());

    let out: Awaited<ReturnType<typeof result.current.fetchRuns>> | undefined;
    await act(async () => {
      out = await result.current.fetchRuns({ page: 2 });
    });

    expect(out).toEqual({ items: page, total: 120, totalPages: 3, page: 2, limit: 50, offset: 50 });
  });

  it('reads the meta of the engine to the same result', async () => {
    const page = runs(120).slice(50, 100);
    apiRequestMock.mockResolvedValueOnce(engineAnswer(page, 120, 50, 50));
    const { result } = renderHook(() => useCronRuns());

    let out: Awaited<ReturnType<typeof result.current.fetchRuns>> | undefined;
    await act(async () => {
      out = await result.current.fetchRuns({ page: 2 });
    });

    expect(out).toEqual({ items: page, total: 120, totalPages: 3, page: 2, limit: 50, offset: 50 });
  });

  it('reads data: null as an empty first page, and no runs as one page', async () => {
    const { result } = renderHook(() => useCronRuns());
    const empty = { items: [], total: 0, totalPages: 1, page: 1, limit: 50, offset: 0 };

    apiRequestMock.mockResolvedValueOnce(engineAnswer(null, 0, 50, 0));
    let out: Awaited<ReturnType<typeof result.current.fetchRuns>> | undefined;
    await act(async () => {
      out = await result.current.fetchRuns();
    });
    expect(out).toEqual(empty);

    apiRequestMock.mockResolvedValueOnce(nextAnswer([], 0, 50, 0));
    await act(async () => {
      out = await result.current.fetchRuns();
    });
    expect(out).toEqual(empty);
  });

  it('falls back to what it asked for when the answer has no meta', async () => {
    const page = runs(3);
    apiRequestMock.mockResolvedValueOnce({ data: page });
    const { result } = renderHook(() => useCronRuns());

    let out: Awaited<ReturnType<typeof result.current.fetchRuns>> | undefined;
    await act(async () => {
      out = await result.current.fetchRuns({ page: 2, limit: 10 });
    });

    expect(out).toEqual({ items: page, total: 3, totalPages: 1, page: 2, limit: 10, offset: 10 });
  });

  it('keeps the page it asked for when the answer names a page size of zero', async () => {
    apiRequestMock.mockResolvedValueOnce(nextAnswer([], 0, 0, 0));
    const { result } = renderHook(() => useCronRuns());

    let out: Awaited<ReturnType<typeof result.current.fetchRuns>> | undefined;
    await act(async () => {
      out = await result.current.fetchRuns({ page: 2 });
    });

    expect(out).toEqual({ items: [], total: 0, totalPages: 1, page: 2, limit: 0, offset: 0 });
  });

  it('reports the page size and the page the backend served when it caps the limit', async () => {
    apiRequestMock.mockResolvedValueOnce(engineAnswer(runs(2), 2500, 1000, 2000));
    const { result } = renderHook(() => useCronRuns());

    let out: Awaited<ReturnType<typeof result.current.fetchRuns>> | undefined;
    await act(async () => {
      out = await result.current.fetchRuns({ limit: 2000, offset: 2000 });
    });

    expect(out).toMatchObject({ total: 2500, totalPages: 3, page: 3, limit: 1000, offset: 2000 });
  });

  it('tells a page past the last one by the totalPages of its empty answer', async () => {
    // Runs are pruned as new ones are written: page 3 held runs when the pager was drawn
    apiRequestMock.mockResolvedValueOnce(nextAnswer([], 100, 50, 100));
    const { result } = renderHook(() => useCronRuns());

    let out: Awaited<ReturnType<typeof result.current.fetchRuns>> | undefined;
    await act(async () => {
      out = await result.current.fetchRuns({ page: 3 });
    });

    expect(out).toMatchObject({ items: [], total: 100, totalPages: 2, page: 3 });
  });

  it.each([
    ['null', null],
    ['no key at all', undefined],
    ['text', 'one line'],
  ])('gives a run whose logs are %s an empty list of lines', async (_what, logs) => {
    const [row] = runs(1);
    const { logs: _stored, ...withoutLogs } = row;
    const stored = logs === undefined ? withoutLogs : { ...withoutLogs, logs };
    apiRequestMock.mockResolvedValueOnce(nextAnswer([stored], 1, 50, 0));
    const { result } = renderHook(() => useCronRuns());

    let out: Awaited<ReturnType<typeof result.current.fetchRuns>> | undefined;
    await act(async () => {
      out = await result.current.fetchRuns();
    });

    expect(out?.items[0].logs).toEqual([]);
    expect(out?.items[0]).toMatchObject(withoutLogs);
  });

  it('keeps the lines of a run as written, and drops an entry that is not a line', async () => {
    const [row] = runs(1);
    const logs = ['[2026-10-08T02:00:00.020Z] [INFO] {\n  "rows": 3\n}', null, 'raw text', 7];
    apiRequestMock.mockResolvedValueOnce(nextAnswer([{ ...row, logs }], 1, 50, 0));
    const { result } = renderHook(() => useCronRuns());

    let out: Awaited<ReturnType<typeof result.current.fetchRuns>> | undefined;
    await act(async () => {
      out = await result.current.fetchRuns();
    });

    expect(out?.items[0].logs).toEqual(['[2026-10-08T02:00:00.020Z] [INFO] {\n  "rows": 3\n}', 'raw text']);
  });

  it('keeps a run that is still running, and one that failed, as stored', async () => {
    const [row] = runs(1);
    const running = { ...row, id: 'r2', status: 'running', finished_at: null, duration_ms: null, logs: [] };
    const failed = { ...row, id: 'r3', status: 'error', error: 'Row 12 has no address', triggered_by: 'manual' };
    apiRequestMock.mockResolvedValueOnce(nextAnswer([running, failed], 2, 50, 0));
    const { result } = renderHook(() => useCronRuns());

    let out: Awaited<ReturnType<typeof result.current.fetchRuns>> | undefined;
    await act(async () => {
      out = await result.current.fetchRuns();
    });

    expect(out?.items).toEqual([running, failed]);
  });

  it('rejects a failed load instead of resolving to "no runs"', async () => {
    apiRequestMock.mockRejectedValueOnce(apiError(500, envelope('Failed to fetch cron history', 'INTERNAL_SERVER_ERROR')));
    const { result } = renderHook(() => useCronRuns());

    let thrown: unknown;
    await act(async () => {
      thrown = await result.current.fetchRuns().catch((err: unknown) => err);
    });

    expect(thrown).toBeInstanceOf(DaaSRequestError);
    expect(thrown).toMatchObject({ kind: 'failure', status: 500, message: 'Failed to fetch cron history' });
    await waitFor(() => expect(result.current.error).toBe('Failed to fetch cron history'));
    expect(result.current.errorInfo).toBe(thrown);
  });

  it('rejects an answer that is not a list', async () => {
    apiRequestMock.mockResolvedValueOnce({ meta: { total: 0, limit: 50, offset: 0 } });
    const { result } = renderHook(() => useCronRuns());

    await act(async () => {
      await expect(result.current.fetchRuns()).rejects.toMatchObject({ kind: 'failure' });
    });
  });

  it('tells a refusal and a session that must step up apart', async () => {
    const { result } = renderHook(() => useCronRuns());

    apiRequestMock.mockRejectedValueOnce(apiError(403, envelope('Admin access required', 'FORBIDDEN')));
    await act(async () => {
      await expect(result.current.fetchRuns()).rejects.toMatchObject({ kind: 'forbidden', status: 403 });
    });

    apiRequestMock.mockRejectedValueOnce(
      apiError(403, { error: 'MFA required', code: 'MFA_REQUIRED', current_aal: 'aal1', required_aal: 'aal2' }),
    );
    await act(async () => {
      await expect(result.current.fetchRuns()).rejects.toMatchObject({ kind: 'mfaRequired', message: 'MFA required' });
    });
  });
});

describe('useCronRuns.fetchJobRuns', () => {
  it('asks the job’s own history, with limit and offset', async () => {
    apiRequestMock.mockResolvedValue(nextAnswer([], 0, 50, 0));
    const { result } = renderHook(() => useCronRuns());

    await act(async () => {
      await result.current.fetchJobRuns(JOB_ID);
    });
    expect(lastPath()).toBe(`/api/cron/${JOB_ID}/history?limit=50&offset=0`);

    await act(async () => {
      await result.current.fetchJobRuns(JOB_ID, { page: 2, limit: 25 });
    });
    expect(lastPath()).toBe(`/api/cron/${JOB_ID}/history?limit=25&offset=25`);
  });

  it('escapes the id in the path', async () => {
    apiRequestMock.mockResolvedValueOnce(nextAnswer([], 0, 50, 0));
    const { result } = renderHook(() => useCronRuns());

    await act(async () => {
      await result.current.fetchJobRuns('a/b?c');
    });

    expect(lastPath()).toBe('/api/cron/a%2Fb%3Fc/history?limit=50&offset=0');
  });

  it.each([
    ['the Next.js backend', nextAnswer(runs(70).slice(50), 70, 50, 50)],
    ['the engine', engineAnswer(runs(70).slice(50), 70, 50, 50)],
  ])('reads a page of the job’s runs with the job’s own total (%s)', async (_backend, answer) => {
    apiRequestMock.mockResolvedValueOnce(answer);
    const { result } = renderHook(() => useCronRuns());

    let out: Awaited<ReturnType<typeof result.current.fetchJobRuns>> | undefined;
    await act(async () => {
      out = await result.current.fetchJobRuns(JOB_ID, { page: 2 });
    });

    expect(out).toEqual({ items: runs(70).slice(50), total: 70, totalPages: 2, page: 2, limit: 50, offset: 50 });
  });

  it('resolves to an empty page for a job that has not run yet', async () => {
    apiRequestMock.mockResolvedValueOnce(engineAnswer(null, 0, 50, 0));
    const { result } = renderHook(() => useCronRuns());

    let out: Awaited<ReturnType<typeof result.current.fetchJobRuns>> | undefined;
    await act(async () => {
      out = await result.current.fetchJobRuns(JOB_ID);
    });

    expect(out).toEqual({ items: [], total: 0, totalPages: 1, page: 1, limit: 50, offset: 0 });
  });

  it('rejects a job the caller cannot read as not found, instead of "no runs yet"', async () => {
    apiRequestMock.mockRejectedValueOnce(apiError(404, envelope('Cron job not found', 'NOT_FOUND')));
    const { result } = renderHook(() => useCronRuns());

    let thrown: unknown;
    await act(async () => {
      thrown = await result.current.fetchJobRuns(JOB_ID).catch((err: unknown) => err);
    });

    expect(thrown).toMatchObject({ kind: 'notFound', status: 404, message: 'Cron job not found' });
    await waitFor(() => expect(result.current.errorInfo?.kind).toBe('notFound'));
  });

  it.each([
    ['404 (Next.js backend)', 404, envelope('Cron job not found', 'NOT_FOUND')],
    ['400 INVALID_ID (engine)', 400, envelope('invalid cron id', 'INVALID_ID')],
  ])('rejects an id that is not a valid one as not found, answered %s', async (_answer, status, body) => {
    apiRequestMock.mockRejectedValueOnce(apiError(status, body));
    const { result } = renderHook(() => useCronRuns());

    await act(async () => {
      await expect(result.current.fetchJobRuns('nope')).rejects.toMatchObject({ kind: 'notFound', status });
    });
  });

  it('leaves a list request the engine refuses an invalid request, not a missing job', async () => {
    apiRequestMock.mockRejectedValueOnce(
      apiError(400, envelope('offset must be a non-negative integer.', 'INVALID_QUERY')),
    );
    const { result } = renderHook(() => useCronRuns());

    await act(async () => {
      await expect(result.current.fetchJobRuns(JOB_ID)).rejects.toMatchObject({
        kind: 'invalid',
        code: 'INVALID_QUERY',
      });
    });
  });

  it('rejects a refusal as forbidden and a failure as a failure', async () => {
    const { result } = renderHook(() => useCronRuns());

    apiRequestMock.mockRejectedValueOnce(apiError(403, envelope('Admin access required', 'FORBIDDEN')));
    await act(async () => {
      await expect(result.current.fetchJobRuns(JOB_ID)).rejects.toMatchObject({ kind: 'forbidden' });
    });

    apiRequestMock.mockRejectedValueOnce(apiError(500, envelope('Failed to fetch cron history', 'INTERNAL_SERVER_ERROR')));
    await act(async () => {
      await expect(result.current.fetchJobRuns(JOB_ID)).rejects.toMatchObject({ kind: 'failure', status: 500 });
    });
  });
});

describe('useCronRuns state', () => {
  it('stays loading while two history requests are both in flight', async () => {
    const pending: Array<(value: unknown) => void> = [];
    apiRequestMock.mockImplementation(() => new Promise((resolve) => { pending.push(resolve); }));
    const { result } = renderHook(() => useCronRuns());

    let all!: Promise<unknown>;
    let one!: Promise<unknown>;
    act(() => {
      all = result.current.fetchRuns();
      one = result.current.fetchJobRuns(JOB_ID);
    });
    await waitFor(() => expect(pending).toHaveLength(2));
    expect(result.current.loading).toBe(true);

    await act(async () => {
      pending[0](nextAnswer([], 0, 50, 0));
      await all;
    });
    expect(result.current.loading).toBe(true);

    await act(async () => {
      pending[1](nextAnswer([], 0, 50, 0));
      await one;
    });
    expect(result.current.loading).toBe(false);
  });

  it('keeps its methods stable across renders', () => {
    const { result, rerender } = renderHook(() => useCronRuns());
    const first = result.current;
    rerender();
    expect(result.current.fetchRuns).toBe(first.fetchRuns);
    expect(result.current.fetchJobRuns).toBe(first.fetchJobRuns);
  });
});
