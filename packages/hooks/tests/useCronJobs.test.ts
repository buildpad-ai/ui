/**
 * useCronJobs unit tests
 *
 * Covers the requests each method makes, both list vocabularies, a job
 * answered without the columns a grant withholds, Run Now's skipped answer,
 * and failures as typed errors — including the refusals the Next.js routes
 * answer as a 500 — that never look like an empty list or an empty record.
 * `apiRequest` is mocked so no network is required.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const { apiRequestMock } = vi.hoisted(() => ({ apiRequestMock: vi.fn() }));
vi.mock('@buildpad/services', () => ({ apiRequest: apiRequestMock }));

import { DaaSRequestError } from '../src/daasRequest';
import { useCronJobs } from '../src/useCronJobs';

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

/** Whether the last `apiRequest` call carried a body at all. */
function lastHasBody(): boolean {
  const [, opts] = apiRequestMock.mock.calls.at(-1) ?? [];
  return 'body' in ((opts ?? {}) as object);
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

/** The Next.js routes' sentence for a schedule the scheduler cannot run. */
const SCHEDULE_REFUSAL =
  'Cron job schedule is invalid: not a valid cron expression. Use five fields (minute, hour, day of month, month, weekday), such as "0 9 * * 1-5"';

/** The engine's sentence for a write naming a column the caller's grant withholds. */
const FIELD_REFUSAL = 'your access to "daas_cron_jobs" does not permit writing: code';

const job = {
  id: JOB_ID,
  name: 'nightly-report',
  description: 'Sends the report',
  schedule: '0 2 * * *',
  timezone: 'Asia/Jakarta',
  code: "console.log('report');",
  status: 'active',
  timeout_ms: 30000,
  memory_limit_mb: 64,
  running: false,
  running_since: null,
  last_run_at: '2026-10-07T19:00:00.000Z',
  last_run_status: 'success',
  next_run_at: '2026-10-08T19:00:00.000Z',
  created_at: '2026-10-01T00:00:00.000Z',
  updated_at: '2026-10-01T00:00:00.000Z',
};

const input = {
  name: 'nightly-report',
  schedule: '0 2 * * *',
  timezone: 'UTC',
  code: "console.log('report');",
  status: 'inactive' as const,
  timeout_ms: 10000,
  memory_limit_mb: 64,
};

beforeEach(() => {
  apiRequestMock.mockReset();
});

describe('useCronJobs.fetchJobs', () => {
  it('sends page and limit even when none are given', async () => {
    // Without them the Next.js route serves 25 jobs and the engine every job
    apiRequestMock.mockResolvedValueOnce({ data: [], count: 0, totalCount: 0, totalPages: 0 });
    const { result } = renderHook(() => useCronJobs());

    await act(async () => {
      await result.current.fetchJobs();
    });

    expect(lastPath()).toBe('/api/cron?page=1&limit=25');
  });

  it('sends the page, the page size, the search term and the status it is given', async () => {
    apiRequestMock.mockResolvedValueOnce({ data: [], count: 0, totalCount: 0, totalPages: 0 });
    const { result } = renderHook(() => useCronJobs());

    await act(async () => {
      await result.current.fetchJobs({ page: 3, limit: 10, search: 'report, 50% *', status: 'active' });
    });

    const query = new URLSearchParams(lastPath().split('?')[1]);
    expect(lastPath().split('?')[0]).toBe('/api/cron');
    expect(query.get('page')).toBe('3');
    expect(query.get('limit')).toBe('10');
    expect(query.get('search')).toBe('report, 50% *');
    expect(query.get('status')).toBe('active');
  });

  it('sends no search and no status when there are none', async () => {
    apiRequestMock.mockResolvedValueOnce({ data: [], count: 0, totalPages: 0 });
    const { result } = renderHook(() => useCronJobs());

    await act(async () => {
      await result.current.fetchJobs({ page: 2, search: '' });
    });

    expect(lastPath()).toBe('/api/cron?page=2&limit=25');
  });

  it('reads the top-level counts of the Next.js backend', async () => {
    apiRequestMock.mockResolvedValueOnce({
      data: [job],
      count: 26,
      totalCount: 26,
      page: 2,
      pageSize: 25,
      totalPages: 2,
    });
    const { result } = renderHook(() => useCronJobs());

    let out: Awaited<ReturnType<typeof result.current.fetchJobs>> | undefined;
    await act(async () => {
      out = await result.current.fetchJobs({ page: 2 });
    });

    expect(out).toEqual({ items: [job], total: 26, totalPages: 2, page: 2, limit: 25 });
  });

  it('reads the meta counts of the engine to the same result', async () => {
    // total_count is the count before the search; the total is the count after it
    apiRequestMock.mockResolvedValueOnce({
      data: [job],
      meta: { total_count: 40, filter_count: 26, page: 2, limit: 25, offset: 25, total_pages: 2 },
    });
    const { result } = renderHook(() => useCronJobs());

    let out: Awaited<ReturnType<typeof result.current.fetchJobs>> | undefined;
    await act(async () => {
      out = await result.current.fetchJobs({ page: 2, search: 'report' });
    });

    expect(out).toEqual({ items: [job], total: 26, totalPages: 2, page: 2, limit: 25 });
  });

  it('reads data: null as an empty first page, and an empty list as one page', async () => {
    const { result } = renderHook(() => useCronJobs());

    apiRequestMock.mockResolvedValueOnce({
      data: null,
      meta: { total_count: 0, filter_count: 0, page: 1, limit: 25, offset: 0, total_pages: 1 },
    });
    let out: Awaited<ReturnType<typeof result.current.fetchJobs>> | undefined;
    await act(async () => {
      out = await result.current.fetchJobs();
    });
    expect(out).toEqual({ items: [], total: 0, totalPages: 1, page: 1, limit: 25 });

    // The Next.js route answers totalPages 0 for no rows
    apiRequestMock.mockResolvedValueOnce({ data: [], count: 0, totalCount: 0, page: 1, pageSize: 25, totalPages: 0 });
    await act(async () => {
      out = await result.current.fetchJobs();
    });
    expect(out).toEqual({ items: [], total: 0, totalPages: 1, page: 1, limit: 25 });
  });

  it('reports the page size the backend served when it caps the one asked for', async () => {
    apiRequestMock.mockResolvedValueOnce({
      data: [job],
      meta: { total_count: 1, filter_count: 1, page: 1, limit: 1000, offset: 0, total_pages: 1 },
    });
    const { result } = renderHook(() => useCronJobs());

    let out: Awaited<ReturnType<typeof result.current.fetchJobs>> | undefined;
    await act(async () => {
      out = await result.current.fetchJobs({ limit: 5000 });
    });

    expect(out?.limit).toBe(1000);
  });

  it('tells a page past the last one by the totalPages of its empty answer', async () => {
    // The only job of page 2 was deleted: page 2 is empty and the list has one page
    apiRequestMock.mockResolvedValueOnce({ data: [], count: 25, totalCount: 25, page: 2, pageSize: 25, totalPages: 1 });
    const { result } = renderHook(() => useCronJobs());

    let out: Awaited<ReturnType<typeof result.current.fetchJobs>> | undefined;
    await act(async () => {
      out = await result.current.fetchJobs({ page: 2 });
    });

    expect(out).toMatchObject({ items: [], total: 25, totalPages: 1, page: 2 });
  });

  // Both backends drop a column the caller's read grant withholds
  it('leaves a row answered without its code without one', async () => {
    const { code: _withheld, ...withoutCode } = job;
    apiRequestMock.mockResolvedValueOnce({ data: [withoutCode], count: 1, totalPages: 1 });
    const { result } = renderHook(() => useCronJobs());

    let out: Awaited<ReturnType<typeof result.current.fetchJobs>> | undefined;
    await act(async () => {
      out = await result.current.fetchJobs();
    });

    expect(out?.items[0]).toEqual(withoutCode);
    expect('code' in (out?.items[0] ?? {})).toBe(false);
  });

  it('rejects a failed load instead of resolving to an empty list', async () => {
    apiRequestMock.mockRejectedValueOnce(apiError(500, envelope('Failed to list cron jobs', 'INTERNAL_SERVER_ERROR')));
    const { result } = renderHook(() => useCronJobs());

    let thrown: unknown;
    await act(async () => {
      thrown = await result.current.fetchJobs().catch((err: unknown) => err);
    });

    expect(thrown).toBeInstanceOf(DaaSRequestError);
    expect(thrown).toMatchObject({ kind: 'failure', status: 500, message: 'Failed to list cron jobs' });
    await waitFor(() => expect(result.current.error).toBe('Failed to list cron jobs'));
    expect(result.current.errorInfo).toBe(thrown);
  });

  it('rejects an answer that is not a list', async () => {
    apiRequestMock.mockResolvedValueOnce({ errors: [{ message: 'Failed to list cron jobs' }] });
    const { result } = renderHook(() => useCronJobs());

    await act(async () => {
      await expect(result.current.fetchJobs()).rejects.toMatchObject({ kind: 'failure' });
    });
  });

  it('rejects a list request the engine refuses as invalid', async () => {
    apiRequestMock.mockRejectedValueOnce(apiError(400, envelope('limit must be a positive integer, or -1 for no limit.', 'INVALID_QUERY')));
    const { result } = renderHook(() => useCronJobs());

    await act(async () => {
      await expect(result.current.fetchJobs()).rejects.toMatchObject({
        kind: 'invalid',
        status: 400,
        code: 'INVALID_QUERY',
      });
    });
  });

  it('tells a refusal, a missing session and a session that must step up apart', async () => {
    const { result } = renderHook(() => useCronJobs());

    apiRequestMock.mockRejectedValueOnce(apiError(403, envelope('Admin access required', 'FORBIDDEN')));
    await act(async () => {
      await expect(result.current.fetchJobs()).rejects.toMatchObject({
        kind: 'forbidden',
        code: 'FORBIDDEN',
        message: 'Admin access required',
      });
    });

    apiRequestMock.mockRejectedValueOnce(apiError(401, envelope('Not authenticated', 'UNAUTHENTICATED')));
    await act(async () => {
      await expect(result.current.fetchJobs()).rejects.toMatchObject({ kind: 'unauthenticated', status: 401 });
    });

    // The MFA refusal is a flat body, not the errors[] envelope
    apiRequestMock.mockRejectedValueOnce(
      apiError(403, { error: 'MFA required', code: 'MFA_REQUIRED', current_aal: 'aal1', required_aal: 'aal2' }),
    );
    await act(async () => {
      await expect(result.current.fetchJobs()).rejects.toMatchObject({
        kind: 'mfaRequired',
        code: 'MFA_REQUIRED',
        message: 'MFA required',
      });
    });
  });
});

describe('useCronJobs.getJob', () => {
  it('reads one job by id', async () => {
    apiRequestMock.mockResolvedValueOnce({ data: job });
    const { result } = renderHook(() => useCronJobs());

    let out: Awaited<ReturnType<typeof result.current.getJob>> | undefined;
    await act(async () => {
      out = await result.current.getJob(JOB_ID);
    });

    expect(lastPath()).toBe(`/api/cron/${JOB_ID}`);
    expect(out).toEqual(job);
  });

  it('keeps a timezone outside any list, and a job answered in part, as answered', async () => {
    const partial = { id: JOB_ID, name: 'nightly-report', timezone: 'Europe/Berlin' };
    apiRequestMock.mockResolvedValueOnce({ data: partial });
    const { result } = renderHook(() => useCronJobs());

    let out: Awaited<ReturnType<typeof result.current.getJob>> | undefined;
    await act(async () => {
      out = await result.current.getJob(JOB_ID);
    });

    expect(out).toEqual(partial);
    expect(out?.code).toBeUndefined();
  });

  it('escapes the id in the path', async () => {
    apiRequestMock.mockResolvedValueOnce({ data: job });
    const { result } = renderHook(() => useCronJobs());

    await act(async () => {
      await result.current.getJob('a/b?c');
    });

    expect(lastPath()).toBe('/api/cron/a%2Fb%3Fc');
  });

  it('rejects a missing id as not found', async () => {
    apiRequestMock.mockRejectedValueOnce(apiError(404, envelope('Cron job not found', 'NOT_FOUND')));
    const { result } = renderHook(() => useCronJobs());

    let thrown: unknown;
    await act(async () => {
      thrown = await result.current.getJob(JOB_ID).catch((err: unknown) => err);
    });

    expect(thrown).toMatchObject({ kind: 'notFound', status: 404, code: 'NOT_FOUND', message: 'Cron job not found' });
    await waitFor(() => expect(result.current.errorInfo?.kind).toBe('notFound'));
  });

  it.each([
    ['404 (Next.js backend)', 404, envelope('Cron job not found', 'NOT_FOUND')],
    ['400 INVALID_ID (engine)', 400, envelope('invalid cron id', 'INVALID_ID')],
  ])('rejects an id that is not a valid one as not found, answered %s', async (_answer, status, body) => {
    apiRequestMock.mockRejectedValueOnce(apiError(status, body));
    const { result } = renderHook(() => useCronJobs());

    await act(async () => {
      await expect(result.current.getJob('nope')).rejects.toMatchObject({ kind: 'notFound', status });
    });
    await waitFor(() => expect(result.current.errorInfo?.kind).toBe('notFound'));
  });

  it.each([[undefined], [{}], [{ data: null }], [{ data: [] }], [{ data: 'text' }]])(
    'rejects %j, an answer without a record, as not found and never an empty job',
    async (answer) => {
      apiRequestMock.mockResolvedValueOnce(answer);
      const { result } = renderHook(() => useCronJobs());

      await act(async () => {
        await expect(result.current.getJob(JOB_ID)).rejects.toMatchObject({
          kind: 'notFound',
          message: 'Cron job not found',
        });
      });
    },
  );

  it('tells a refusal and a session that must step up from a missing id', async () => {
    const { result } = renderHook(() => useCronJobs());

    apiRequestMock.mockRejectedValueOnce(apiError(403, envelope('Admin access required', 'FORBIDDEN')));
    await act(async () => {
      await expect(result.current.getJob(JOB_ID)).rejects.toMatchObject({ kind: 'forbidden', status: 403 });
    });

    apiRequestMock.mockRejectedValueOnce(
      apiError(403, { error: 'MFA required', code: 'MFA_REQUIRED', current_aal: 'aal1', required_aal: 'aal2' }),
    );
    await act(async () => {
      await expect(result.current.getJob(JOB_ID)).rejects.toMatchObject({ kind: 'mfaRequired', message: 'MFA required' });
    });
  });

  it('rejects a server failure as a failure, not as a missing job', async () => {
    apiRequestMock.mockRejectedValueOnce(apiError(500, envelope('connection refused', 'DATABASE_ERROR')));
    const { result } = renderHook(() => useCronJobs());

    await act(async () => {
      await expect(result.current.getJob(JOB_ID)).rejects.toMatchObject({ kind: 'failure', status: 500 });
    });
  });
});

describe('useCronJobs.createJob', () => {
  it('POSTs the job and resolves to the stored one', async () => {
    const stored = { ...job, ...input, description: 'Nightly' };
    apiRequestMock.mockResolvedValueOnce({ data: stored });
    const { result } = renderHook(() => useCronJobs());

    let out: Awaited<ReturnType<typeof result.current.createJob>> | undefined;
    await act(async () => {
      out = await result.current.createJob({ ...input, description: 'Nightly' });
    });

    expect(lastPath()).toBe('/api/cron');
    expect(lastRequest()).toEqual({ method: 'POST', body: { ...input, description: 'Nightly' } });
    expect(out).toEqual(stored);
  });

  it.each([[''], [null], [undefined]])(
    'leaves a description of %j out, so both backends store none',
    async (description) => {
      apiRequestMock.mockResolvedValueOnce({ data: job });
      const { result } = renderHook(() => useCronJobs());

      await act(async () => {
        await result.current.createJob({ ...input, description });
      });

      expect(lastRequest().body).toEqual(input);
      expect(lastRequest().body).not.toHaveProperty('description');
    },
  );

  it('sends only the required fields when only they are given, leaving the rest to the server defaults', async () => {
    apiRequestMock.mockResolvedValueOnce({ data: job });
    const { result } = renderHook(() => useCronJobs());

    await act(async () => {
      await result.current.createJob({ name: 'n', schedule: '* * * * *', code: 'return 1;' });
    });

    expect(lastRequest().body).toEqual({ name: 'n', schedule: '* * * * *', code: 'return 1;' });
  });

  it('resolves to a job answered without the columns the grant withholds, as long as it has its id', async () => {
    apiRequestMock.mockResolvedValueOnce({ data: { id: JOB_ID } });
    const { result } = renderHook(() => useCronJobs());

    let out: Awaited<ReturnType<typeof result.current.createJob>> | undefined;
    await act(async () => {
      out = await result.current.createJob(input);
    });

    expect(out).toEqual({ id: JOB_ID });
  });

  it.each([[undefined], [{}], [{ data: null }], [{ data: JOB_ID }], [{ data: { name: 'nightly-report' } }], [{ data: { id: '' } }]])(
    'rejects %j, an answer without the new job',
    async (answer) => {
      apiRequestMock.mockResolvedValueOnce(answer);
      const { result } = renderHook(() => useCronJobs());

      await act(async () => {
        await expect(result.current.createJob(input)).rejects.toMatchObject({
          kind: 'failure',
          message: 'The server did not answer the new cron job',
        });
      });
    },
  );

  it.each([
    ['a schedule that is not a cron expression (engine)', 'schedule is not a valid cron expression: use five fields or a descriptor such as @hourly'],
    ['a schedule that is not a cron expression (Next.js backend)', SCHEDULE_REFUSAL],
    ['a timezone the engine does not know', 'timezone is not a valid IANA time zone name'],
    ['a decimal timeout (engine)', 'timeout_ms and memory_limit_mb must be positive integers'],
    ['missing fields (engine)', 'name, schedule and code are required'],
  ])('rejects %s as invalid, with the server’s sentence', async (_what, message) => {
    apiRequestMock.mockRejectedValueOnce(apiError(400, envelope(message, 'INVALID_PAYLOAD')));
    const { result } = renderHook(() => useCronJobs());

    await act(async () => {
      await expect(result.current.createJob(input)).rejects.toMatchObject({
        kind: 'invalid',
        status: 400,
        code: 'INVALID_PAYLOAD',
        message,
      });
    });
    await waitFor(() => expect(result.current.error).toBe(message));
  });

  it.each([
    ['400 (engine)', 400, 'INVALID_PAYLOAD', 'Cron job code is invalid: cron:nightly-report failed to compile at line 1, column 7: Unexpected token'],
    ['500 (Next.js backend)', 500, 'INTERNAL_SERVER_ERROR', 'Cron job code is invalid: Failed to compile cron job: Unexpected token'],
  ])('rejects code that does not compile as invalid, answered %s', async (_answer, status, code, message) => {
    apiRequestMock.mockRejectedValueOnce(apiError(status, envelope(message, code)));
    const { result } = renderHook(() => useCronJobs());

    await act(async () => {
      await expect(result.current.createJob(input)).rejects.toMatchObject({ kind: 'invalid', status, message });
    });
    await waitFor(() => expect(result.current.errorInfo?.kind).toBe('invalid'));
  });

  it('rejects a value that is too long as invalid, and a column the grant withholds as forbidden', async () => {
    const { result } = renderHook(() => useCronJobs());

    const tooLong = 'Value for field "name" in collection "daas_cron_jobs" is too long.';
    apiRequestMock.mockRejectedValueOnce(apiError(400, envelope(tooLong, 'VALUE_TOO_LONG')));
    await act(async () => {
      await expect(result.current.createJob(input)).rejects.toMatchObject({
        kind: 'invalid',
        code: 'VALUE_TOO_LONG',
        message: tooLong,
      });
    });

    apiRequestMock.mockRejectedValueOnce(apiError(403, envelope(FIELD_REFUSAL, 'FORBIDDEN')));
    await act(async () => {
      await expect(result.current.createJob(input)).rejects.toMatchObject({ kind: 'forbidden', status: 403 });
    });
  });
});

describe('useCronJobs.updateJob', () => {
  it('PATCHes only what it is given and resolves to the stored job', async () => {
    const stored = { ...job, name: 'renamed' };
    apiRequestMock.mockResolvedValueOnce({ data: stored });
    const { result } = renderHook(() => useCronJobs());

    let out: Awaited<ReturnType<typeof result.current.updateJob>> | undefined;
    await act(async () => {
      out = await result.current.updateJob(JOB_ID, { name: 'renamed' });
    });

    expect(lastPath()).toBe(`/api/cron/${JOB_ID}`);
    expect(lastRequest()).toEqual({ method: 'PATCH', body: { name: 'renamed' } });
    expect(out).toEqual(stored);
  });

  it.each([['active'], ['inactive']] as const)('sets a job %s with the status alone', async (status) => {
    apiRequestMock.mockResolvedValueOnce({ data: { ...job, status } });
    const { result } = renderHook(() => useCronJobs());

    let out: Awaited<ReturnType<typeof result.current.updateJob>> | undefined;
    await act(async () => {
      out = await result.current.updateJob(JOB_ID, { status });
    });

    expect(lastRequest().body).toEqual({ status });
    expect(out?.status).toBe(status);
  });

  it('clears a description with null, sent as it is: both backends store NULL for it', async () => {
    apiRequestMock.mockResolvedValueOnce({ data: { ...job, description: null } });
    const { result } = renderHook(() => useCronJobs());

    let out: Awaited<ReturnType<typeof result.current.updateJob>> | undefined;
    await act(async () => {
      out = await result.current.updateJob(JOB_ID, { description: null });
    });

    // Not '' and not a missing key: the body names the column and its new value
    expect(lastRequest()).toEqual({ method: 'PATCH', body: { description: null } });
    expect(out?.description).toBeNull();
  });

  it('sends an empty description as an empty string when that is what it is given', async () => {
    apiRequestMock.mockResolvedValueOnce({ data: { ...job, description: '' } });
    const { result } = renderHook(() => useCronJobs());

    await act(async () => {
      await result.current.updateJob(JOB_ID, { description: '' });
    });

    expect(lastRequest()).toEqual({ method: 'PATCH', body: { description: '' } });
  });

  it('sends a description it is given, and none when the key is absent', async () => {
    apiRequestMock.mockResolvedValue({ data: job });
    const { result } = renderHook(() => useCronJobs());

    await act(async () => {
      await result.current.updateJob(JOB_ID, { description: 'Two reports' });
    });
    expect(lastRequest().body).toEqual({ description: 'Two reports' });

    await act(async () => {
      await result.current.updateJob(JOB_ID, { timeout_ms: 5000 });
    });
    expect(lastRequest().body).toEqual({ timeout_ms: 5000 });
  });

  it('sends the keys that release a stuck run lock', async () => {
    apiRequestMock.mockResolvedValueOnce({ data: job });
    const { result } = renderHook(() => useCronJobs());

    await act(async () => {
      await result.current.updateJob(JOB_ID, { running: false, running_since: null });
    });

    expect(lastRequest().body).toEqual({ running: false, running_since: null });
  });

  it('gives a job answered without its id the id that was saved', async () => {
    apiRequestMock.mockResolvedValueOnce({ data: { name: 'renamed' } });
    const { result } = renderHook(() => useCronJobs());

    let out: Awaited<ReturnType<typeof result.current.updateJob>> | undefined;
    await act(async () => {
      out = await result.current.updateJob(JOB_ID, { name: 'renamed' });
    });

    expect(out).toEqual({ id: JOB_ID, name: 'renamed' });
  });

  it.each([[undefined], [{}], [{ data: null }], [{ data: JOB_ID }]])(
    'rejects %j, an answer without the saved job',
    async (answer) => {
      apiRequestMock.mockResolvedValueOnce(answer);
      const { result } = renderHook(() => useCronJobs());

      await act(async () => {
        await expect(result.current.updateJob(JOB_ID, { name: 'renamed' })).rejects.toMatchObject({
          kind: 'failure',
          message: 'The server did not answer the saved cron job',
        });
      });
    },
  );

  it.each([
    ['404 (engine)', 404, 'NOT_FOUND', 'Cron job not found'],
    ['500 "Item not found" (Next.js backend)', 500, 'INTERNAL_SERVER_ERROR', 'Item not found'],
  ])('rejects a job that is gone as not found, answered %s', async (_answer, status, code, message) => {
    apiRequestMock.mockRejectedValueOnce(apiError(status, envelope(message, code)));
    const { result } = renderHook(() => useCronJobs());

    await act(async () => {
      await expect(result.current.updateJob(JOB_ID, { name: 'renamed' })).rejects.toMatchObject({
        kind: 'notFound',
        status,
        code,
        message,
      });
    });
    await waitFor(() => expect(result.current.errorInfo?.kind).toBe('notFound'));
  });

  it.each([
    ['403 (the route’s own check)', 403, 'FORBIDDEN', 'Admin access required'],
    ['403 (engine, a column the grant withholds)', 403, 'FORBIDDEN', FIELD_REFUSAL],
    ['500 (Next.js backend, the row rule)', 500, 'INTERNAL_SERVER_ERROR', 'Permission denied: update on daas_cron_jobs'],
  ])('rejects a save the caller may not make as forbidden, answered %s', async (_answer, status, code, message) => {
    apiRequestMock.mockRejectedValueOnce(apiError(status, envelope(message, code)));
    const { result } = renderHook(() => useCronJobs());

    await act(async () => {
      await expect(result.current.updateJob(JOB_ID, { code: 'return 1;' })).rejects.toMatchObject({
        kind: 'forbidden',
        status,
        message,
      });
    });
  });

  it('rejects an invalid schedule as invalid, and code that does not compile on either backend', async () => {
    const { result } = renderHook(() => useCronJobs());

    apiRequestMock.mockRejectedValueOnce(
      apiError(400, envelope(SCHEDULE_REFUSAL, 'INVALID_PAYLOAD')),
    );
    await act(async () => {
      await expect(result.current.updateJob(JOB_ID, { schedule: 'often' })).rejects.toMatchObject({ kind: 'invalid' });
    });

    apiRequestMock.mockRejectedValueOnce(
      apiError(500, envelope('Cron job code is invalid: Failed to compile cron job: Unexpected token', 'INTERNAL_SERVER_ERROR')),
    );
    await act(async () => {
      await expect(result.current.updateJob(JOB_ID, { code: 'if (' })).rejects.toMatchObject({ kind: 'invalid', status: 500 });
    });
  });

  it.each([
    // PostgreSQL's own refusal: the deployment is broken, the caller is not short of a grant
    ['a database role without rights', 'permission denied for table daas_cron_jobs'],
    // A compile error that happens to end the way the "job is gone" sentence does
    ['a compile error ending in "not found"', 'Cron job code is invalid: module "x" not found'],
    ['a sentence that only begins like "Item not found"', 'Item not found in cache, and the database is unreachable'],
  ])('does not read %s as a missing job or as a refusal', async (_what, message) => {
    apiRequestMock.mockRejectedValue(apiError(500, envelope(message, 'INTERNAL_SERVER_ERROR')));
    const { result } = renderHook(() => useCronJobs());

    let thrown: unknown;
    await act(async () => {
      thrown = await result.current.getJob(JOB_ID).catch((err: unknown) => err);
    });
    expect(thrown).toMatchObject({ status: 500, message });
    expect((thrown as { kind: string }).kind).not.toBe('notFound');
    expect((thrown as { kind: string }).kind).not.toBe('forbidden');
  });

  it('reads the service\'s "Item not found: <collection>/<id>" as a missing job', async () => {
    apiRequestMock.mockRejectedValueOnce(
      apiError(500, envelope(`Item not found: daas_cron_jobs/${JOB_ID}`, 'INTERNAL_SERVER_ERROR')),
    );
    const { result } = renderHook(() => useCronJobs());

    await act(async () => {
      await expect(result.current.updateJob(JOB_ID, { name: 'x' })).rejects.toMatchObject({
        kind: 'notFound',
        status: 500,
      });
    });
  });

  it('leaves any other 500 a failure', async () => {
    apiRequestMock.mockRejectedValueOnce(
      apiError(500, envelope('invalid input syntax for type integer: "1500.5"', 'INTERNAL_SERVER_ERROR')),
    );
    const { result } = renderHook(() => useCronJobs());

    await act(async () => {
      await expect(result.current.updateJob(JOB_ID, { timeout_ms: 1500.5 })).rejects.toMatchObject({
        kind: 'failure',
        status: 500,
      });
    });
  });
});

describe('useCronJobs.deleteJob', () => {
  it.each([
    ['{ data: { success, message } } (both backends)', { data: { success: true, message: `Cron job ${JOB_ID} deleted` } }],
    ['no body', undefined],
  ])('DELETEs by id and resolves, answered %s', async (_answer, answer) => {
    apiRequestMock.mockResolvedValueOnce(answer);
    const { result } = renderHook(() => useCronJobs());

    let out: unknown = 'unset';
    await act(async () => {
      out = await result.current.deleteJob(JOB_ID);
    });

    expect(lastPath()).toBe(`/api/cron/${JOB_ID}`);
    expect(lastRequest().method).toBe('DELETE');
    expect(out).toBeUndefined();
  });

  // A second click on Delete, or a job deleted in another tab
  it.each([
    ['404 (engine)', 404, 'Cron job not found'],
    ['500 "Item not found" (Next.js backend)', 500, 'Item not found'],
  ])('rejects a job that is already gone as not found, answered %s', async (_answer, status, message) => {
    apiRequestMock.mockRejectedValueOnce(apiError(status, envelope(message, 'X')));
    const { result } = renderHook(() => useCronJobs());

    await act(async () => {
      await expect(result.current.deleteJob(JOB_ID)).rejects.toMatchObject({ kind: 'notFound', status });
    });
  });

  it('rejects a delete the row rule refuses as forbidden, and an id that is not one as not found', async () => {
    const { result } = renderHook(() => useCronJobs());

    apiRequestMock.mockRejectedValueOnce(
      apiError(500, envelope('Permission denied: delete on daas_cron_jobs', 'INTERNAL_SERVER_ERROR')),
    );
    await act(async () => {
      await expect(result.current.deleteJob(JOB_ID)).rejects.toMatchObject({ kind: 'forbidden' });
    });

    apiRequestMock.mockRejectedValueOnce(apiError(400, envelope('invalid cron id', 'INVALID_ID')));
    await act(async () => {
      await expect(result.current.deleteJob('nope')).rejects.toMatchObject({ kind: 'notFound', status: 400 });
    });
  });
});

describe('useCronJobs.cloneJob', () => {
  const copy = { ...job, id: 'copy-id', name: 'nightly-report (copy)', status: 'inactive' };

  it('POSTs without a body when no name is given, and resolves to the copy', async () => {
    apiRequestMock.mockResolvedValueOnce({ data: copy });
    const { result } = renderHook(() => useCronJobs());

    let out: Awaited<ReturnType<typeof result.current.cloneJob>> | undefined;
    await act(async () => {
      out = await result.current.cloneJob(JOB_ID);
    });

    expect(lastPath()).toBe(`/api/cron/${JOB_ID}/clone`);
    expect(lastRequest().method).toBe('POST');
    expect(lastHasBody()).toBe(false);
    expect(out).toEqual(copy);
  });

  it('sends the name it is given', async () => {
    apiRequestMock.mockResolvedValueOnce({ data: { ...copy, name: 'weekly-report' } });
    const { result } = renderHook(() => useCronJobs());

    await act(async () => {
      await result.current.cloneJob(JOB_ID, '  weekly-report ');
    });

    expect(lastRequest()).toEqual({ method: 'POST', body: { name: 'weekly-report' } });
  });

  // The Next.js route would store an empty name as the copy's name
  it.each([[''], ['   ']])('treats a blank name %j as none', async (name) => {
    apiRequestMock.mockResolvedValueOnce({ data: copy });
    const { result } = renderHook(() => useCronJobs());

    await act(async () => {
      await result.current.cloneJob(JOB_ID, name);
    });

    expect(lastHasBody()).toBe(false);
  });

  it.each([[undefined], [{ data: null }], [{ data: { name: 'nightly-report (copy)' } }]])(
    'rejects %j, an answer without the copy',
    async (answer) => {
      apiRequestMock.mockResolvedValueOnce(answer);
      const { result } = renderHook(() => useCronJobs());

      await act(async () => {
        await expect(result.current.cloneJob(JOB_ID)).rejects.toMatchObject({
          kind: 'failure',
          message: 'The server did not answer the copy of the cron job',
        });
      });
    },
  );

  it.each([
    ['404 NOT_FOUND (engine)', envelope('Cron job not found', 'NOT_FOUND')],
    ['404 INTERNAL_ERROR (Next.js backend)', envelope(`Cron job ${JOB_ID} not found`, 'INTERNAL_ERROR')],
  ])('rejects a source that is gone as not found, answered %s', async (_answer, body) => {
    apiRequestMock.mockRejectedValueOnce(apiError(404, body));
    const { result } = renderHook(() => useCronJobs());

    await act(async () => {
      await expect(result.current.cloneJob(JOB_ID)).rejects.toMatchObject({ kind: 'notFound', status: 404 });
    });
  });

  it('rejects a caller who may not create as forbidden', async () => {
    apiRequestMock.mockRejectedValueOnce(apiError(403, envelope('Admin access required', 'FORBIDDEN')));
    const { result } = renderHook(() => useCronJobs());

    await act(async () => {
      await expect(result.current.cloneJob(JOB_ID)).rejects.toMatchObject({ kind: 'forbidden' });
    });
  });
});

describe('useCronJobs.runJob', () => {
  it.each([
    ['the Next.js backend', `Cron job ${JOB_ID} triggered manually. History ID: run-1`],
    ['the engine', 'Cron job nightly-report triggered manually'],
  ])('POSTs without a body and resolves to the run’s history id (%s)', async (_backend, message) => {
    apiRequestMock.mockResolvedValueOnce({ data: { historyId: 'run-1', message } });
    const { result } = renderHook(() => useCronJobs());

    let out: Awaited<ReturnType<typeof result.current.runJob>> | undefined;
    await act(async () => {
      out = await result.current.runJob(JOB_ID);
    });

    expect(lastPath()).toBe(`/api/cron/${JOB_ID}/run`);
    expect(lastRequest().method).toBe('POST');
    expect(lastHasBody()).toBe(false);
    expect(out).toEqual({ historyId: 'run-1', skipped: false, message });
  });

  // Both backends answer 200 with an empty historyId when the job's lock is held
  it.each([
    ['the Next.js backend', `Cron job ${JOB_ID} triggered manually (was already running — skipped)`],
    ['the engine', 'Cron job nightly-report triggered manually (was already running — skipped)'],
  ])('says a run was skipped when the job was already running (%s)', async (_backend, message) => {
    apiRequestMock.mockResolvedValueOnce({ data: { historyId: '', message } });
    const { result } = renderHook(() => useCronJobs());

    let out: Awaited<ReturnType<typeof result.current.runJob>> | undefined;
    await act(async () => {
      out = await result.current.runJob(JOB_ID);
    });

    expect(out).toEqual({ historyId: null, skipped: true, message });
  });

  it('resolves without a message when the answer has none', async () => {
    apiRequestMock.mockResolvedValueOnce({ data: { historyId: 'run-1' } });
    const { result } = renderHook(() => useCronJobs());

    let out: Awaited<ReturnType<typeof result.current.runJob>> | undefined;
    await act(async () => {
      out = await result.current.runJob(JOB_ID);
    });

    expect(out).toEqual({ historyId: 'run-1', skipped: false, message: '' });
  });

  it.each([[undefined], [{}], [{ data: null }], [{ data: {} }], [{ data: { historyId: null } }], [{ data: { message: 'triggered' } }]])(
    'rejects %j, an answer that does not say whether a run happened',
    async (answer) => {
      apiRequestMock.mockResolvedValueOnce(answer);
      const { result } = renderHook(() => useCronJobs());

      await act(async () => {
        await expect(result.current.runJob(JOB_ID)).rejects.toMatchObject({
          kind: 'failure',
          message: 'The server did not answer the outcome of the run',
        });
      });
    },
  );

  it.each([
    ['404 (engine)', 404, 'Cron job not found'],
    ['500 (Next.js backend)', 500, `Cron job ${JOB_ID} not found`],
  ])('rejects a job that is gone as not found, answered %s', async (_answer, status, message) => {
    apiRequestMock.mockRejectedValueOnce(apiError(status, envelope(message, 'X')));
    const { result } = renderHook(() => useCronJobs());

    await act(async () => {
      await expect(result.current.runJob(JOB_ID)).rejects.toMatchObject({ kind: 'notFound', status, message });
    });
  });

  it('rejects a job outside the caller’s update rule as forbidden', async () => {
    apiRequestMock.mockRejectedValueOnce(
      apiError(403, envelope('Permission denied: update on daas_cron_jobs', 'FORBIDDEN')),
    );
    const { result } = renderHook(() => useCronJobs());

    await act(async () => {
      await expect(result.current.runJob(JOB_ID)).rejects.toMatchObject({ kind: 'forbidden', status: 403 });
    });
  });

  it('stays loading until the run has ended', async () => {
    let end!: (value: unknown) => void;
    apiRequestMock.mockImplementationOnce(() => new Promise((resolve) => { end = resolve; }));
    const { result } = renderHook(() => useCronJobs());

    let pending!: Promise<unknown>;
    act(() => {
      pending = result.current.runJob(JOB_ID);
    });
    await waitFor(() => expect(result.current.loading).toBe(true));

    await act(async () => {
      end({ data: { historyId: 'run-1', message: 'done' } });
      await pending;
    });
    expect(result.current.loading).toBe(false);
  });
});

describe('useCronJobs state', () => {
  it('exposes loading=true while a request is in flight', async () => {
    let resolve!: (value: unknown) => void;
    apiRequestMock.mockImplementationOnce(() => new Promise((r) => { resolve = r; }));
    const { result } = renderHook(() => useCronJobs());

    let pending: Promise<unknown>;
    act(() => {
      pending = result.current.fetchJobs();
    });

    await waitFor(() => expect(result.current.loading).toBe(true));

    await act(async () => {
      resolve({ data: [], count: 0, totalPages: 1 });
      await pending;
    });

    expect(result.current.loading).toBe(false);
  });

  it('stays loading while a run and a save are both in flight', async () => {
    const pending: Array<(value: unknown) => void> = [];
    apiRequestMock.mockImplementation(() => new Promise((resolve) => { pending.push(resolve); }));
    const { result } = renderHook(() => useCronJobs());

    let running!: Promise<unknown>;
    let saving!: Promise<unknown>;
    act(() => {
      running = result.current.runJob(JOB_ID);
      saving = result.current.updateJob(JOB_ID, { name: 'renamed' });
    });
    await waitFor(() => expect(pending).toHaveLength(2));

    await act(async () => {
      pending[1]({ data: job });
      await saving;
    });
    expect(result.current.loading).toBe(true);

    await act(async () => {
      pending[0]({ data: { historyId: 'run-1', message: 'done' } });
      await running;
    });
    expect(result.current.loading).toBe(false);
  });

  it('clears the last error when a new request starts', async () => {
    const { result } = renderHook(() => useCronJobs());

    apiRequestMock.mockRejectedValueOnce(apiError(404, envelope('Cron job not found', 'NOT_FOUND')));
    await act(async () => {
      await result.current.getJob(JOB_ID).catch(() => undefined);
    });
    await waitFor(() => expect(result.current.error).toBe('Cron job not found'));

    apiRequestMock.mockResolvedValueOnce({ data: job });
    await act(async () => {
      await result.current.getJob(JOB_ID);
    });
    expect(result.current.error).toBeNull();
    expect(result.current.errorInfo).toBeNull();
  });

  it('keeps its methods stable across renders', () => {
    const { result, rerender } = renderHook(() => useCronJobs());
    const first = result.current;
    rerender();
    expect(result.current.fetchJobs).toBe(first.fetchJobs);
    expect(result.current.getJob).toBe(first.getJob);
    expect(result.current.createJob).toBe(first.createJob);
    expect(result.current.updateJob).toBe(first.updateJob);
    expect(result.current.deleteJob).toBe(first.deleteJob);
    expect(result.current.cloneJob).toBe(first.cloneJob);
    expect(result.current.runJob).toBe(first.runJob);
  });
});
