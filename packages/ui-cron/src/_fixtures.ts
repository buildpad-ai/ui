/**
 * Shared mock data for the Storybook stories and the unit tests.
 *
 * Internal to stories and tests only — intentionally NOT exported from
 * `index.ts` and not bundled by tsup (it builds `src/index.ts` alone).
 */
import type { CronJobRecord, CronRunRecord } from '@buildpad/types';

export const JOB_REPORT_ID = '3d0a5a52-6f0e-4d0b-9a8e-0c5b7a1f1001';
export const JOB_SWEEP_ID = '3d0a5a52-6f0e-4d0b-9a8e-0c5b7a1f1002';
export const JOB_SYNC_ID = '3d0a5a52-6f0e-4d0b-9a8e-0c5b7a1f1003';

// Uses only what both backends give a job: `context`, `console` and a `return`
const REPORT_CODE = `const orders = [12, 7, 23];
const total = orders.reduce((sum, count) => sum + count, 0);
console.log('Orders in the report:', total);
if (orders.length < 5) console.warn('Two orders have no customer');

return { sent: total, run: context.runId };
`;

/**
 * Three jobs, in the order the API lists them (by name):
 *
 * - Cache sweep — inactive, never ran, no description, UTC+7. Both backends
 *   leave the last computed `next_run_at` on a job that is deactivated.
 * - Legacy sync — active, last run failed, a timezone outside the UTC-offset
 *   options (stored through the API).
 * - Nightly report — active, last run succeeded.
 */
export const mockJobs: CronJobRecord[] = [
  {
    id: JOB_SWEEP_ID,
    name: 'Cache sweep',
    description: null,
    schedule: '*/15 * * * *',
    timezone: 'Etc/GMT-7',
    code: "console.log('Sweeping the cache');\n",
    status: 'inactive',
    timeout_ms: 10000,
    memory_limit_mb: 64,
    running: false,
    running_since: null,
    last_run_at: null,
    last_run_status: null,
    next_run_at: '2026-03-02T09:15:00.000Z',
    created_at: '2026-02-01T08:00:00.000Z',
    updated_at: '2026-02-20T08:00:00.000Z',
  },
  {
    id: JOB_SYNC_ID,
    name: 'Legacy sync',
    description: 'Pulls the day’s orders from the legacy system.',
    schedule: '30 2 * * *',
    timezone: 'Asia/Jakarta',
    code: "throw new Error('The legacy system did not answer');\n",
    status: 'active',
    timeout_ms: 30000,
    memory_limit_mb: 128,
    running: false,
    running_since: null,
    last_run_at: '2026-03-01T19:30:00.000Z',
    last_run_status: 'error',
    next_run_at: '2026-03-02T19:30:00.000Z',
    created_at: '2026-01-10T08:00:00.000Z',
    updated_at: '2026-02-11T08:00:00.000Z',
  },
  {
    id: JOB_REPORT_ID,
    name: 'Nightly report',
    description: 'Sends the report of the day to the sales team.',
    schedule: '0 9 * * 1-5',
    timezone: 'UTC',
    code: REPORT_CODE,
    status: 'active',
    timeout_ms: 10000,
    memory_limit_mb: 64,
    running: false,
    running_since: null,
    last_run_at: '2026-03-02T09:00:00.000Z',
    last_run_status: 'success',
    next_run_at: '2026-03-03T09:00:00.000Z',
    created_at: '2026-01-05T08:00:00.000Z',
    updated_at: '2026-02-28T08:00:00.000Z',
  },
];

/** The job the editor stories and tests open. */
export const reportJob: CronJobRecord = mockJobs[2];

/** `count` jobs named "Job 001" … for the paging stories and tests. */
export function manyMockJobs(count: number): CronJobRecord[] {
  return Array.from({ length: count }, (_, index) => {
    const number = String(index + 1).padStart(3, '0');
    return {
      ...reportJob,
      id: `4e1b6b63-7a1f-4e1c-8b9f-1d6c8b2a2${number}`,
      name: `Job ${number}`,
      description: null,
      status: index % 2 === 0 ? 'active' : 'inactive',
    } satisfies CronJobRecord;
  });
}

/**
 * Five runs, newest first, one of each kind a history shows:
 *
 * - a manual run that succeeded and printed an INFO and a WARN line;
 * - a scheduled run that failed, with its error and an ERROR line;
 * - a scheduled run that was stopped at its timeout, with no output;
 * - a run started by stored code (`services.cron.trigger`) whose output is an
 *   object printed over several lines and an entry in no known form;
 * - a run that is still going.
 */
export const mockRuns: CronRunRecord[] = [
  {
    id: '5f2c7c74-8b20-4f2d-9ca0-2e7d9c3b3001',
    job_id: JOB_REPORT_ID,
    job_name: 'Nightly report',
    triggered_at: '2026-03-02T09:00:00.000Z',
    started_at: '2026-03-02T09:00:00.020Z',
    finished_at: '2026-03-02T09:00:01.254Z',
    duration_ms: 1234,
    status: 'success',
    error: null,
    logs: [
      '[2026-03-02T09:00:00.120Z] [INFO] Orders in the report: 42',
      '[2026-03-02T09:00:01.200Z] [WARN] Two orders have no customer',
    ],
    triggered_by: 'manual',
  },
  {
    id: '5f2c7c74-8b20-4f2d-9ca0-2e7d9c3b3002',
    job_id: JOB_SYNC_ID,
    job_name: 'Legacy sync',
    triggered_at: '2026-03-01T19:30:00.000Z',
    started_at: '2026-03-01T19:30:00.015Z',
    finished_at: '2026-03-01T19:30:00.101Z',
    duration_ms: 86,
    status: 'error',
    error: 'The legacy system did not answer',
    logs: ['[2026-03-01T19:30:00.090Z] [ERROR] Giving up after 3 attempts'],
    triggered_by: 'schedule',
  },
  {
    id: '5f2c7c74-8b20-4f2d-9ca0-2e7d9c3b3003',
    job_id: JOB_REPORT_ID,
    job_name: 'Nightly report',
    triggered_at: '2026-03-01T09:00:00.000Z',
    started_at: '2026-03-01T09:00:00.010Z',
    finished_at: '2026-03-01T09:00:10.010Z',
    duration_ms: 10000,
    status: 'timeout',
    error: 'Cron job timed out after 10000ms',
    logs: [],
    triggered_by: 'schedule',
  },
  {
    id: '5f2c7c74-8b20-4f2d-9ca0-2e7d9c3b3004',
    job_id: JOB_REPORT_ID,
    job_name: 'Daily report',
    triggered_at: '2026-02-28T09:00:00.000Z',
    started_at: '2026-02-28T09:00:00.010Z',
    finished_at: '2026-02-28T09:00:00.052Z',
    duration_ms: 42,
    status: 'success',
    error: null,
    logs: ['[2026-02-28T09:00:00.030Z] [INFO] {\n  "sent": 40\n}', 'a line in no known form'],
    triggered_by: 'extension',
  },
  {
    id: '5f2c7c74-8b20-4f2d-9ca0-2e7d9c3b3005',
    job_id: JOB_SWEEP_ID,
    job_name: 'Cache sweep',
    triggered_at: '2026-02-27T09:15:00.000Z',
    started_at: '2026-02-27T09:15:00.010Z',
    finished_at: null,
    duration_ms: null,
    status: 'running',
    error: null,
    logs: [],
    triggered_by: 'manual',
  },
];

/** The run the log stories and tests open: succeeded, two lines. */
export const successRun: CronRunRecord = mockRuns[0];

/** `count` runs of one job, newest first, for the paging stories and tests. */
export function manyMockRuns(count: number, job: CronJobRecord = reportJob): CronRunRecord[] {
  const newest = Date.parse('2026-03-02T09:00:00.000Z');
  return Array.from({ length: count }, (_, index) => {
    const number = String(index + 1).padStart(3, '0');
    return {
      ...successRun,
      id: `6a3d8d85-9c31-4a3e-8db1-3f8e0d4c4${number}`,
      job_id: job.id,
      job_name: job.name,
      triggered_at: new Date(newest - index * 60 * 60 * 1000).toISOString(),
      duration_ms: 100 + index,
      logs: [`[2026-03-02T09:00:00.120Z] [INFO] Run ${number}`],
    } satisfies CronRunRecord;
  });
}

/**
 * Jobs and runs whose texts are longer than any column should become: a long
 * name, a long description, a schedule with lists, the longest date an
 * English locale writes, and an error of a sentence or two. For the
 * narrow-container stories and the layout checks: these must end in an
 * ellipsis, not widen the table.
 */
export const longTextJobs: CronJobRecord[] = [
  {
    ...reportJob,
    id: '7b4e9e96-0d42-4b4f-9ec2-4a9f1e5d5001',
    name: 'Quarterly reconciliation of the regional sales ledgers against the warehouse',
    description:
      'Compares every regional ledger with the warehouse stock counts and mails the differences to the finance team before the offices open.',
    schedule: '0,15,30,45 8-18 1-7,15-21 1,4,7,10 1-5',
    timezone: 'America/Argentina/Buenos_Aires',
    status: 'active',
    last_run_at: '2026-09-30T22:59:59.000Z',
    last_run_status: 'timeout',
    next_run_at: '2026-12-31T22:59:59.000Z',
  },
  ...mockJobs,
];

export const longTextRuns: CronRunRecord[] = [
  {
    ...successRun,
    id: '7b4e9e96-0d42-4b4f-9ec2-4a9f1e5d6001',
    job_id: longTextJobs[0].id,
    job_name: longTextJobs[0].name,
    triggered_at: '2026-09-30T22:59:59.000Z',
    duration_ms: 1234567,
    status: 'error',
    error:
      'The warehouse API answered 503 Service Unavailable three times in a row; the reconciliation was abandoned after the third attempt and nothing was mailed.',
    logs: ['[2026-09-30T22:59:59.120Z] [ERROR] Giving up after 3 attempts'],
    triggered_by: 'extension',
  },
  ...mockRuns,
];
