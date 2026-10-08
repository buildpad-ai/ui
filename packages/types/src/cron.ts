/**
 * Cron Types
 *
 * TypeScript type definitions for the DaaS cron domain: a job (a JavaScript
 * snippet the server runs on a schedule or on demand) and a run (one row of a
 * job's history, with its outcome and captured console lines). Mirrors the
 * reference admin UI in buildpad-daas (`app/[lang]/cron`) and the two tables
 * both backends serve (`daas_cron_jobs`, `daas_cron_history`) through the nine
 * `/api/cron` routes.
 *
 * Naming follows `workflow.ts`: a table row is a `…Record`.
 */

// ============================================================================
// Collections
// ============================================================================

/** Collection that stores cron jobs. */
export const CRON_JOBS_COLLECTION = 'daas_cron_jobs';

/** Collection that stores the runs of cron jobs. */
export const CRON_HISTORY_COLLECTION = 'daas_cron_history';

/**
 * The two cron collections.
 *
 * Gate a component on `CRON_JOBS_COLLECTION` (`usePermissions().canPerform`)
 * and on nothing else. Both backends decide every cron route — the two history
 * routes included — by the caller's grant on `daas_cron_jobs`: `read` lists
 * and opens jobs and their runs, `create` creates (clone needs `create`, and
 * on the engine `read` as well), `update` saves, activates, deactivates and
 * runs, `delete` deletes. A grant on `daas_cron_history` opens nothing here.
 */
export const CRON_COLLECTIONS = {
  jobs: CRON_JOBS_COLLECTION,
  history: CRON_HISTORY_COLLECTION,
} as const;

/** Name of one of the two cron collections. */
export type CronCollection = (typeof CRON_COLLECTIONS)[keyof typeof CRON_COLLECTIONS];

// ============================================================================
// Vocabularies
// ============================================================================

/** Whether the scheduler fires a job. */
export type CronJobStatus = 'active' | 'inactive';

/** Every value of `daas_cron_jobs.status`. */
export const CRON_JOB_STATUSES: readonly CronJobStatus[] = ['active', 'inactive'];

/** How a run ended, or `running` while it has not. */
export type CronRunStatus = 'running' | 'success' | 'error' | 'timeout';

/** Every value of `daas_cron_history.status` and `daas_cron_jobs.last_run_status`. */
export const CRON_RUN_STATUSES: readonly CronRunStatus[] = ['running', 'success', 'error', 'timeout'];

/**
 * What started a run: the job's schedule, a user (Run Now), or stored code
 * calling `services.cron.trigger`.
 */
export type CronTriggeredBy = 'schedule' | 'manual' | 'extension';

/** Every value of `daas_cron_history.triggered_by`. */
export const CRON_TRIGGERS: readonly CronTriggeredBy[] = ['schedule', 'manual', 'extension'];

// ============================================================================
// Rows
// ============================================================================

/**
 * A `daas_cron_jobs` row.
 *
 * Only `id` and `name` are certain. Both backends drop a column the caller's
 * grant withholds, so every other key can be absent — `code` above all, which
 * a grant may hide from a user who can still see that the job exists. An
 * absent key is not an empty value: a form that did not receive a field must
 * not show a default in its place as if it were stored, and must not send one
 * back (see `cronJobToForm` and `withheldCronJobFields` in `@buildpad/utils`).
 */
export interface CronJobRecord {
  id: string;

  /** Display name; not unique */
  name: string;

  description?: string | null;

  /** Five-field cron expression, e.g. `0 9 * * 1-5`; the engine also takes `@hourly`-style descriptors */
  schedule?: string;

  /**
   * Zone the schedule is read in. Free text on the server (the engine accepts
   * any IANA name), so it is not limited to the options a form offers.
   */
  timezone?: string;

  /** The JavaScript the job runs; receives `context`, `services`, `console`, `JSON`, `Date`, `Math` */
  code?: string;

  status?: CronJobStatus;

  /** Longest a run may take before it is stopped, in milliseconds; a positive integer */
  timeout_ms?: number;

  /** Memory cap of the sandbox in megabytes; a positive integer */
  memory_limit_mb?: number;

  /** Whether a run holds the job's lock right now */
  running?: boolean;

  /** When the lock was taken */
  running_since?: string | null;

  last_run_at?: string | null;
  last_run_status?: CronRunStatus | null;

  /**
   * Next scheduled run. Meaningful for an `active` job only: both backends
   * leave the last computed time on a job that is deactivated, and an
   * inactive job never fires.
   */
  next_run_at?: string | null;

  created_at?: string | null;
  updated_at?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
}

/** A `daas_cron_history` row: one run of a job. */
export interface CronRunRecord {
  id: string;

  /** ID of the job that ran */
  job_id: string;

  /** The job's name when it ran; kept when the job is renamed */
  job_name: string;

  triggered_at: string;
  started_at?: string | null;
  finished_at?: string | null;

  /** How long the run took, in milliseconds; `null` while it is running */
  duration_ms?: number | null;

  status: CronRunStatus;

  /** Why the run failed or was stopped; `null` for a run that succeeded */
  error?: string | null;

  /**
   * The run's console output, one entry per call, each `[<ISO time>] [<LEVEL>]
   * <message>` (`parseCronLogLine` in `@buildpad/utils`). Always an array as
   * the hooks return it.
   */
  logs: string[];

  triggered_by: CronTriggeredBy;
}

// ============================================================================
// Inputs
// ============================================================================

/**
 * Body of a job create. The optional keys default on the server: `timezone`
 * `UTC`, `status` `inactive`, `timeout_ms` 30000, `memory_limit_mb` 64, and no
 * description.
 */
export interface CronJobInput {
  name: string;

  /** Leave out (or pass `null` or `''`) for a job without a description */
  description?: string | null;

  schedule: string;
  timezone?: string;
  code: string;
  status?: CronJobStatus;
  timeout_ms?: number;
  memory_limit_mb?: number;
}

/**
 * Body of a job update: only the keys to change. A key that is absent is a
 * column the server leaves as it is, so a save that sends the whole form
 * writes back every value the form was loaded with — `status` included, which
 * may have been changed elsewhere since (build the body with
 * `changedCronJobFields` in `@buildpad/utils`).
 */
export interface CronJobPatch {
  name?: string;

  /** `null` clears the description */
  description?: string | null;

  schedule?: string;
  timezone?: string;
  code?: string;
  status?: CronJobStatus;
  timeout_ms?: number;
  memory_limit_mb?: number;

  /** `false` releases the lock of a run that is stuck; not a form field */
  running?: boolean;

  /** `null` clears the time the lock was taken; not a form field */
  running_since?: string | null;
}

/**
 * What Run Now answered. The request returns when the run has ended, so a
 * result is the run's end, not its start — and not its success: a run whose
 * code threw is answered the same way, and its outcome is in the history row
 * `historyId` names.
 */
export interface CronRunResult {
  /** ID of the run's history row; `null` when the run was skipped */
  historyId: string | null;

  /**
   * True when nothing ran: the job was already running, so the request was
   * answered without a run and without a history row.
   */
  skipped: boolean;

  /** The backend's own sentence about the request (English) */
  message: string;
}

// ============================================================================
// Lists
// ============================================================================

/** Parameters of a jobs list request. */
export interface CronJobListParams {
  /** Page number (1-indexed). Default: 1. */
  page?: number;

  /** Jobs per page. Default: 25. */
  limit?: number;

  /** Free-text search over the name, the schedule and the description. */
  search?: string;

  /** Only jobs with this status. */
  status?: CronJobStatus;
}

/** One page of a cron list. */
export interface CronListResult<T> {
  /** Rows of this page */
  items: T[];

  /** Rows matching the request across all pages */
  total: number;

  /** Number of pages, at least 1 */
  totalPages: number;

  /** Page that was served (1-indexed) */
  page: number;

  /** Page size that was served; smaller than the request when the backend caps it */
  limit: number;
}

/**
 * Parameters of a runs list request. The routes page by `limit` and `offset`;
 * pass `page` instead of `offset` to have it computed.
 */
export interface CronRunListParams {
  /** Page number (1-indexed). Default: 1. Ignored when `offset` is given. */
  page?: number;

  /** Runs per page. Default: 50. */
  limit?: number;

  /** Number of runs to skip, newest first. */
  offset?: number;
}

/** One page of runs, newest first. */
export interface CronRunListResult extends CronListResult<CronRunRecord> {
  /** Number of runs skipped before this page */
  offset: number;
}
