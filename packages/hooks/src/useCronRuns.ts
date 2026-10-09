'use client';

import { useCallback } from 'react';
import { apiRequest } from '@buildpad/services';
import type { CronRunListParams, CronRunListResult, CronRunRecord } from '@buildpad/types';
import {
  missingWhenIdIsMalformed,
  readDaaSListResponse,
  toDaaSRequestError,
  useDaaSRequest,
} from './daasRequest';

const BASE_PATH = '/api/cron';

/** Page size of a runs list when none is given; both backends default to it. */
const DEFAULT_LIMIT = 50;

/** A run row as the routes answer it: `logs` can be `null` or missing. */
type StoredRun = Omit<CronRunRecord, 'logs'> & { logs?: unknown };

/** A run row whose `logs` is always a list of lines. */
function readRun(row: StoredRun): CronRunRecord {
  const logs = Array.isArray(row.logs)
    ? row.logs.filter((line): line is string => typeof line === 'string')
    : [];
  return { ...row, logs };
}

/** A whole number from `min` up, or `fallback` for anything else. */
function wholeNumber(value: number | undefined, min: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  const whole = Math.floor(value);
  return whole < min ? fallback : whole;
}

/**
 * The `limit` and `offset` of a runs request, and the page they are.
 *
 * Both are always sent. The history routes page by `limit` and `offset` on
 * both backends (the Next.js routes read nothing else), so a `page` is turned
 * into the offset of its first run; an `offset` that is given wins.
 */
function runsRequest(params: CronRunListParams): {
  limit: number;
  offset: number;
  page: number;
  query: string;
} {
  const limit = wholeNumber(params.limit, 1, DEFAULT_LIMIT);
  const offset =
    params.offset === undefined
      ? (wholeNumber(params.page, 1, 1) - 1) * limit
      : wholeNumber(params.offset, 0, 0);
  const query = new URLSearchParams();
  query.set('limit', String(limit));
  query.set('offset', String(offset));
  return { limit, offset, page: Math.floor(offset / limit) + 1, query: query.toString() };
}

/**
 * One page of runs out of a history answer.
 *
 * The Next.js routes count in `meta.total` / `meta.limit` / `meta.offset`;
 * the engine sends those and its own `meta.filter_count` / `meta.total_pages`
 * / `meta.page` beside them. The total is the number of runs the caller can
 * reach — of one job on the per-job route — so the pager it draws never
 * counts runs that are not listed. `data: null` is an empty page.
 */
function readRuns(
  response: unknown,
  request: { limit: number; offset: number; page: number },
): CronRunListResult {
  const list = readDaaSListResponse<StoredRun>(response, request);
  const meta = (response as { meta?: { offset?: unknown } } | null | undefined)?.meta;
  const served = meta && typeof meta.offset === 'number' && Number.isFinite(meta.offset) ? meta.offset : null;
  const offset = served ?? request.offset;

  return {
    ...list,
    items: list.items.map(readRun),
    offset,
    // The page the served offset is, when the answer names no page of its own.
    page: list.limit > 0 ? Math.floor(offset / list.limit) + 1 : list.page,
  };
}

/**
 * Hook for reading the runs of cron jobs (`/api/cron/history`,
 * `/api/cron/:id/history`). Follows the `useUsers.ts` conventions:
 * `'use client'`, `loading` / `error` state, `useCallback` methods,
 * `apiRequest` transport.
 *
 * Read-only by design: a run is written by the backend when a job fires or
 * is run by hand (`useCronJobs().runJob`), and neither backend serves a
 * create, update or delete here. Each backend keeps the newest runs of a job
 * only (100 by default) and deletes a job's runs with the job.
 *
 * Works against both backends. Every method rejects with a
 * `DaaSRequestError`, whose `kind` tells a missing job (`notFound`) from a
 * refusal (`forbidden`, `mfaRequired`) from a failure; a load that failed
 * never resolves to an empty list. Both routes are decided by the caller's
 * `read` grant on `daas_cron_jobs`, and list only the runs of jobs that grant
 * reaches.
 */
export function useCronRuns() {
  const { loading, error, errorInfo, run } = useDaaSRequest();

  /**
   * List the runs of every job the caller can read, newest first. `limit`
   * and `offset` are always sent (defaults 50 and 0); pass `page` to have the
   * offset computed.
   *
   * Compare the answer's `totalPages` with the page you asked for
   * (`clampPage`): runs are pruned as new ones are written, so a page can
   * stop existing.
   */
  const fetchRuns = useCallback(
    (params: CronRunListParams = {}): Promise<CronRunListResult> =>
      run(async () => {
        const request = runsRequest(params);
        const result = await apiRequest(`${BASE_PATH}/history?${request.query}`);
        return readRuns(result, request);
      }),
    [run],
  );

  /**
   * List the runs of one job, newest first, paged like `fetchRuns`.
   *
   * Rejects with `kind: 'notFound'` when the id names no job the caller may
   * read, including an id that is not a valid one — so an empty page always
   * means a job that has not run yet.
   */
  const fetchJobRuns = useCallback(
    (jobId: string, params: CronRunListParams = {}): Promise<CronRunListResult> =>
      run(async () => {
        const request = runsRequest(params);
        try {
          const result = await apiRequest(
            `${BASE_PATH}/${encodeURIComponent(jobId)}/history?${request.query}`,
          );
          return readRuns(result, request);
        } catch (err) {
          throw missingWhenIdIsMalformed(toDaaSRequestError(err));
        }
      }),
    [run],
  );

  return {
    loading,
    error,
    errorInfo,
    fetchRuns,
    fetchJobRuns,
  };
}

export default useCronRuns;
