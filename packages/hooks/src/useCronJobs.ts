'use client';

import { useCallback } from 'react';
import { apiRequest } from '@buildpad/services';
import type {
  CronJobInput,
  CronJobListParams,
  CronJobPatch,
  CronJobRecord,
  CronListResult,
  CronRunResult,
} from '@buildpad/types';
import {
  buildDaaSListQuery,
  DaaSRequestError,
  missingWhenIdIsMalformed,
  readDaaSListResponse,
  readDaaSRecord,
  toDaaSRequestError,
  useDaaSRequest,
} from './daasRequest';

const BASE_PATH = '/api/cron';

const NOT_FOUND = 'Cron job not found';

/** A failure with another `kind`, everything else kept. */
function as(kind: DaaSRequestError['kind'], err: DaaSRequestError): DaaSRequestError {
  return new DaaSRequestError(err.message, { kind, status: err.status, code: err.code });
}

/**
 * A failed cron request as what it means, on either backend.
 *
 * The engine answers each refusal with its own status. The Next.js routes
 * hand three of them on as a 500 with the service's sentence, and a 500 reads
 * as "the server broke" where the user is owed "it is gone", "you may not" or
 * "fix the code":
 *
 *   - a write or a run on a job that no longer exists (`Item not found`,
 *     `Cron job <id> not found`) is a `notFound`, as the engine's 404 is;
 *   - a write the caller's row rule refuses (`Permission denied: update on
 *     daas_cron_jobs`) is a `forbidden`;
 *   - code that does not compile (`Cron job code is invalid: …`) is an
 *     `invalid`, as the engine's 400 is.
 *
 * An id that is not a valid one is a `notFound` too: the engine answers it
 * 400 `INVALID_ID`, the Next.js routes 404. Any other failure is returned as
 * it is, with its status and code.
 */
function readCronRefusal(err: unknown): DaaSRequestError {
  const failure = missingWhenIdIsMalformed(toDaaSRequestError(err));
  if (failure.status !== 500) return failure;

  if (/^item not found\b/i.test(failure.message) || /^cron job\b.*\bnot found$/i.test(failure.message)) {
    return as('notFound', failure);
  }
  if (/^permission denied\b/i.test(failure.message)) return as('forbidden', failure);
  if (/^cron job code is invalid\b/i.test(failure.message)) return as('invalid', failure);
  return failure;
}

/** The job a write was answered with; an answer without one is a `failure`. */
function readSavedJob(response: unknown, missing: string): CronJobRecord {
  return readDaaSRecord<CronJobRecord>(response, missing, 'failure');
}

/** The same, for a write whose answer has to name the new job. */
function readNewJob(response: unknown, missing: string): CronJobRecord {
  const job = readSavedJob(response, missing);
  if (typeof job.id !== 'string' || !job.id) {
    throw new DaaSRequestError(missing, { kind: 'failure' });
  }
  return job;
}

/**
 * Hook for cron jobs (`/api/cron`): list, get, create, update, delete, clone
 * and run. Follows the `useUsers.ts` conventions: `'use client'`, `loading` /
 * `error` state, `useCallback` methods, `apiRequest` transport. The runs of a
 * job are read with `useCronRuns`.
 *
 * Works against both backends. Every method rejects with a
 * `DaaSRequestError`, whose `kind` tells a missing job (`notFound`) from a
 * refusal (`forbidden`, `mfaRequired`), from a body the server would not
 * store (`invalid`: a schedule that is not a cron expression, code that does
 * not compile, a timezone the engine does not know — `message` is the
 * server's sentence), from a failure. A load that failed never resolves to an
 * empty list or an empty record. `error` and `errorInfo` hold the last
 * failure for a component that renders from state.
 *
 * `loading` is true while any request of this instance is in flight, a run
 * included — and a run is answered only when it has ended. Keep a pending
 * flag per action (or call the hook once more) where that matters.
 *
 * A job row carries only the columns the caller's grant allows: see
 * `CronJobRecord`.
 */
export function useCronJobs() {
  const { loading, error, errorInfo, run } = useDaaSRequest();

  /** `run`, with a failure read by `readCronRefusal`. */
  const request = useCallback(
    <T>(work: () => Promise<T>): Promise<T> =>
      run(async () => {
        try {
          return await work();
        } catch (err) {
          throw readCronRefusal(err);
        }
      }),
    [run],
  );

  /**
   * List jobs, ordered by name. `search` matches the name, the schedule and
   * the description, as literal text; `status` keeps only the jobs with that
   * status. `page` and `limit` are always sent (defaults 1 and 25): without
   * them one backend serves 25 jobs and the other every job.
   *
   * Compare the answer's `totalPages` with the page you asked for
   * (`clampPage`): after a delete the page may no longer exist.
   */
  const fetchJobs = useCallback(
    (params: CronJobListParams = {}): Promise<CronListResult<CronJobRecord>> =>
      request(async () => {
        const { page, limit, query } = buildDaaSListQuery(params);
        const filter = params.status ? `&status=${encodeURIComponent(params.status)}` : '';
        const result = await apiRequest(`${BASE_PATH}?${query}${filter}`);
        return readDaaSListResponse<CronJobRecord>(result, { page, limit });
      }),
    [request],
  );

  /**
   * Get one job. Rejects with `kind: 'notFound'` when the id names no job the
   * caller may read, including an id that is not a valid one.
   */
  const getJob = useCallback(
    (id: string): Promise<CronJobRecord> =>
      request(async () => {
        const result = await apiRequest(`${BASE_PATH}/${encodeURIComponent(id)}`);
        return readDaaSRecord<CronJobRecord>(result, NOT_FOUND);
      }),
    [request],
  );

  /**
   * Create a job. Resolves to the stored job, with its id.
   *
   * A description that is `null` or `''` is left out of the body, so the job
   * is stored without one on both backends.
   */
  const createJob = useCallback(
    (data: CronJobInput): Promise<CronJobRecord> =>
      request(async () => {
        const { description, ...rest } = data;
        const result = await apiRequest(BASE_PATH, {
          method: 'POST',
          body: JSON.stringify(description ? { ...rest, description } : rest),
        });
        return readNewJob(result, 'The server did not answer the new cron job');
      }),
    [request],
  );

  /**
   * Update a job (pass only the keys to change; `changedCronJobFields` builds
   * them from a form). Resolves to the stored job as the caller's grant
   * allows it to be read. Activate and Deactivate are `{ status }`.
   *
   * `description: null` clears the description. It is sent as `''`, the one
   * value both backends store on every route that takes a description (the
   * workflow hooks clear one the same way, where the engine does not read a
   * `null` as a change). The job then holds an empty description, which
   * reads back as none.
   */
  const updateJob = useCallback(
    (id: string, data: CronJobPatch): Promise<CronJobRecord> =>
      request(async () => {
        const result = await apiRequest(`${BASE_PATH}/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          body: JSON.stringify(data.description === null ? { ...data, description: '' } : data),
        });
        const job = readSavedJob(result, 'The server did not answer the saved cron job');
        // A grant can withhold any column of the answer; the id is known.
        return typeof job.id === 'string' && job.id ? job : { ...job, id };
      }),
    [request],
  );

  /**
   * Delete a job; its runs go with it. A job that is already gone rejects
   * with `kind: 'notFound'`.
   */
  const deleteJob = useCallback(
    (id: string): Promise<void> =>
      request(async () => {
        await apiRequest(`${BASE_PATH}/${encodeURIComponent(id)}`, { method: 'DELETE' });
      }),
    [request],
  );

  /**
   * Copy a job. The copy is inactive, keeps the source's other settings, and
   * is named `name` — or `<source name> (copy)` when no name is given (a
   * blank one counts as none). Resolves to the new job, with its id.
   */
  const cloneJob = useCallback(
    (id: string, name?: string): Promise<CronJobRecord> =>
      request(async () => {
        const custom = name?.trim();
        const result = await apiRequest(`${BASE_PATH}/${encodeURIComponent(id)}/clone`, {
          method: 'POST',
          ...(custom ? { body: JSON.stringify({ name: custom }) } : {}),
        });
        return readNewJob(result, 'The server did not answer the copy of the cron job');
      }),
    [request],
  );

  /**
   * Run a job now, outside its schedule. The request is answered when the run
   * has ENDED (up to the job's `timeout_ms`), so the promise stays pending
   * for the whole run.
   *
   * Read the result before telling the user anything:
   *
   *   - `skipped: true` — the job was already running. Nothing ran and there
   *     is no history row (`historyId` is `null`);
   *   - otherwise a run happened and `historyId` names its history row. That
   *     is not the run's success: a run whose code threw, or that timed out,
   *     resolves the same way, and its outcome is that row's `status`.
   *
   * A rejection carries no outcome. The job is gone (`notFound`), the caller
   * may not run it (`forbidden`), or the request failed — and a request that
   * was cut off on the way (a proxy or fetch timeout shorter than the run)
   * says nothing about the run, which goes on without it.
   */
  const runJob = useCallback(
    (id: string): Promise<CronRunResult> =>
      request(async () => {
        const result = await apiRequest(`${BASE_PATH}/${encodeURIComponent(id)}/run`, {
          method: 'POST',
        });
        const missing = 'The server did not answer the outcome of the run';
        const outcome = readDaaSRecord<{ historyId?: unknown; message?: unknown }>(
          result,
          missing,
          'failure',
        );
        // Both backends always send the key: '' for a skipped run, never no key.
        if (typeof outcome.historyId !== 'string') {
          throw new DaaSRequestError(missing, { kind: 'failure' });
        }
        return {
          historyId: outcome.historyId || null,
          skipped: outcome.historyId === '',
          message: typeof outcome.message === 'string' ? outcome.message : '',
        };
      }),
    [request],
  );

  return {
    loading,
    error,
    errorInfo,
    fetchJobs,
    getJob,
    createJob,
    updateJob,
    deleteJob,
    cloneJob,
    runJob,
  };
}

export default useCronJobs;
