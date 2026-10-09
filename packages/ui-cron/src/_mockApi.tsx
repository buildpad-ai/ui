/**
 * An in-memory DaaS for the fixture stories of the containers (the jobs list,
 * the run history and the job editor), which load through the data hooks and
 * so cannot be fed by props.
 *
 * `MockCronApi` replaces `window.fetch` while it is mounted, for the routes
 * the containers call — the nine `/api/cron` routes and `/api/permissions` —
 * and answers them from the fixtures, in the Studio routes' envelope. Every
 * other request goes to the real `fetch`. One mock at a time: the stories that
 * use it are tagged `!autodocs`, so two never share a page.
 *
 * Internal to the stories only (underscore-prefixed, not exported from
 * `index.ts`, not bundled by tsup). Nothing here is a contract: the live
 * `*.daas.stories.tsx` are what exercise a real backend.
 */
import React, { useEffect, useState } from 'react';
import { DaaSProvider } from '@buildpad/services';
import type { CronJobRecord, CronRunRecord } from '@buildpad/types';
import { mockJobs, mockRuns } from './_fixtures';

export interface MockCronApiOptions {
  /** The jobs the backend starts with. Default: the three fixture jobs. */
  jobs?: CronJobRecord[];
  /** The runs the backend starts with, newest first. Default: the five fixture runs. */
  runs?: CronRunRecord[];
  /**
   * What the caller may do with `daas_cron_jobs`. Default: 'admin'.
   * 'readOnly' grants read alone; 'none' grants nothing and refuses every read.
   */
  access?: 'admin' | 'readOnly' | 'none';
  /** Answer the jobs list with this status instead of a list (500: a failed load). */
  listStatus?: number;
  /** Answer every GET of one job with this status instead of the job (500, 403). */
  detailStatus?: number;
  /** Answer both history routes with this status instead of runs (500, 403). */
  historyStatus?: number;
  /** IDs of jobs that are running: Run Now on one is answered as skipped, with no new run. */
  runningJobIds?: string[];
  /** Columns left out of every job the API answers, as a grant that withholds them does. */
  withheldFields?: Array<keyof CronJobRecord>;
  /** Milliseconds a Run Now takes: the request is answered when the run has ended. Default: 1200. */
  runDuration?: number;
  /** Milliseconds every other answer takes; makes loading and pending states visible. Default: 150. */
  delay?: number;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const refusal = (status: number) =>
  json(status, {
    errors: [
      {
        message: status === 403 ? 'Permission denied' : 'The cron service is unavailable',
        extensions: { code: status === 403 ? 'FORBIDDEN' : 'INTERNAL_SERVER_ERROR' },
      },
    ],
  });

const missing = () =>
  json(404, { errors: [{ message: 'Cron job not found', extensions: { code: 'NOT_FOUND' } }] });

/** Replaces `window.fetch`; returns the function that puts the real one back. */
export function installMockCronApi(options: MockCronApiOptions = {}): () => void {
  const {
    access = 'admin',
    listStatus,
    detailStatus,
    historyStatus,
    runningJobIds = [],
    withheldFields = [],
    runDuration = 1200,
    delay = 150,
  } = options;
  let jobs = (options.jobs ?? mockJobs).map((job) => ({ ...job }));
  let runs = (options.runs ?? mockRuns).map((run) => ({ ...run }));
  let created = 0;
  const realFetch = window.fetch.bind(window);

  /** A job as the caller's grant lets it be read. */
  const readable = (job: CronJobRecord): CronJobRecord => {
    const copy: Partial<CronJobRecord> = { ...job };
    for (const field of withheldFields) delete copy[field];
    return copy as CronJobRecord;
  };

  /** One page of `rows`, in the history routes' envelope. */
  const runsPage = (rows: CronRunRecord[], url: URL): Response => {
    const limit = Number(url.searchParams.get('limit') ?? 50);
    const offset = Number(url.searchParams.get('offset') ?? 0);
    return json(200, { data: rows.slice(offset, offset + limit), meta: { total: rows.length, limit, offset } });
  };

  const newId = (prefix: string) => {
    created += 1;
    return `${prefix}${String(created).padStart(3, '0')}`;
  };

  const answer = (method: string, url: URL, body: unknown): { response: Response; wait?: number } | null => {
    const path = url.pathname;
    const reply = (response: Response, wait?: number) => ({ response, wait });

    if (path === '/api/permissions/me') {
      const read = { read: { fields: ['*'], permissions: null } };
      return reply(
        json(200, {
          data: access === 'readOnly' ? { daas_cron_jobs: read } : {},
          isAdmin: access === 'admin',
          moduleAccess: {},
        }),
      );
    }
    if (path.startsWith('/api/permissions/')) {
      return reply(
        json(200, { data: access === 'readOnly' ? { read: { fields: ['*'], permissions: null } } : {} }),
      );
    }

    if (path === '/api/cron' && method === 'GET') {
      if (access === 'none') return reply(refusal(403));
      if (listStatus) return reply(refusal(listStatus));
      const search = (url.searchParams.get('search') ?? '').toLowerCase();
      const status = url.searchParams.get('status');
      const page = Number(url.searchParams.get('page') ?? 1);
      const limit = Number(url.searchParams.get('limit') ?? 25);
      const matches = jobs
        .filter((job) => `${job.name} ${job.schedule ?? ''} ${job.description ?? ''}`.toLowerCase().includes(search))
        .filter((job) => !status || job.status === status)
        .sort((a, b) => a.name.localeCompare(b.name));
      return reply(
        json(200, {
          data: matches.slice((page - 1) * limit, page * limit).map(readable),
          count: matches.length,
          totalCount: matches.length,
          page,
          pageSize: limit,
          totalPages: Math.max(1, Math.ceil(matches.length / limit)),
        }),
      );
    }

    if (path === '/api/cron' && method === 'POST') {
      if (access !== 'admin') return reply(refusal(403));
      const job: CronJobRecord = {
        description: null,
        timezone: 'UTC',
        status: 'inactive',
        timeout_ms: 30000,
        memory_limit_mb: 64,
        running: false,
        last_run_at: null,
        last_run_status: null,
        next_run_at: null,
        ...(body as CronJobRecord),
        id: newId('7b4e9e96-ad42-4b4f-9ec2-4a9f1e5d5'),
      };
      jobs = [...jobs, job];
      return reply(json(201, { data: job }));
    }

    if (path === '/api/cron/history' && method === 'GET') {
      if (access === 'none') return reply(refusal(403));
      if (historyStatus) return reply(refusal(historyStatus));
      return reply(runsPage(runs, url));
    }

    const jobHistory = /^\/api\/cron\/([^/]+)\/history$/.exec(path);
    if (jobHistory && method === 'GET') {
      if (access === 'none') return reply(refusal(403));
      if (historyStatus) return reply(refusal(historyStatus));
      const id = decodeURIComponent(jobHistory[1]);
      if (!jobs.some((job) => job.id === id)) return reply(missing());
      return reply(runsPage(runs.filter((run) => run.job_id === id), url));
    }

    const jobRun = /^\/api\/cron\/([^/]+)\/run$/.exec(path);
    if (jobRun && method === 'POST') {
      if (access !== 'admin') return reply(refusal(403));
      const id = decodeURIComponent(jobRun[1]);
      const job = jobs.find((candidate) => candidate.id === id);
      if (!job) return reply(missing());
      if (runningJobIds.includes(id)) {
        // Both backends answer a skipped run at once, with an empty history id
        return reply(
          json(200, { data: { historyId: '', message: `Cron job ${job.name} triggered (was already running — skipped)` } }),
        );
      }
      // A job whose code throws still answers 200: the outcome is the history row's
      const failed = (job.code ?? '').includes('throw ');
      const now = new Date().toISOString();
      const run: CronRunRecord = {
        id: newId('8c5fafa7-be53-4c50-8fd3-5ba02f6e6'),
        job_id: job.id,
        job_name: job.name,
        triggered_at: now,
        started_at: now,
        finished_at: now,
        duration_ms: runDuration,
        status: failed ? 'error' : 'success',
        error: failed ? 'The job threw an error' : null,
        logs: failed ? [] : [`[${now}] [INFO] Job started: ${job.name}`, `[${now}] [INFO] Triggered by: manual`],
        triggered_by: 'manual',
      };
      runs = [run, ...runs];
      jobs = jobs.map((candidate) =>
        candidate.id === id ? { ...candidate, last_run_at: now, last_run_status: run.status } : candidate,
      );
      return reply(json(200, { data: { historyId: run.id, message: `Cron job ${job.name} triggered` } }), runDuration);
    }

    const jobClone = /^\/api\/cron\/([^/]+)\/clone$/.exec(path);
    if (jobClone && method === 'POST') {
      if (access !== 'admin') return reply(refusal(403));
      const source = jobs.find((job) => job.id === decodeURIComponent(jobClone[1]));
      if (!source) return reply(missing());
      const copy: CronJobRecord = {
        ...source,
        id: newId('7b4e9e96-ad42-4b4f-9ec2-4a9f1e5d5'),
        name: `${source.name} (copy)`,
        status: 'inactive',
        last_run_at: null,
        last_run_status: null,
        next_run_at: null,
      };
      jobs = [...jobs, copy];
      return reply(json(201, { data: copy }));
    }

    const byId = /^\/api\/cron\/([^/]+)$/.exec(path);
    if (byId) {
      const id = decodeURIComponent(byId[1]);
      const stored = jobs.find((job) => job.id === id);
      if (method === 'GET') {
        if (access === 'none') return reply(refusal(403));
        if (detailStatus) return reply(refusal(detailStatus));
        return reply(stored ? json(200, { data: readable(stored) }) : missing());
      }
      if (access !== 'admin') return reply(refusal(403));
      if (!stored) return reply(missing());
      if (method === 'PATCH') {
        const updated = { ...stored, ...(body as Partial<CronJobRecord>), updated_at: new Date().toISOString() };
        jobs = jobs.map((job) => (job.id === id ? updated : job));
        return reply(json(200, { data: readable(updated) }));
      }
      if (method === 'DELETE') {
        jobs = jobs.filter((job) => job.id !== id);
        runs = runs.filter((run) => run.job_id !== id);
        return reply(json(200, { data: { success: true, message: `Cron job ${id} deleted` } }));
      }
    }

    return null;
  };

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const raw = typeof input === 'string' || input instanceof URL ? String(input) : input.url;
    const url = new URL(raw, window.location.origin);
    const method = (init?.method ?? (typeof input === 'object' && 'method' in input ? input.method : 'GET')).toUpperCase();
    let body: unknown;
    try {
      body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
    } catch {
      body = undefined;
    }

    const answered = url.pathname.startsWith('/api/') ? answer(method, url, body) : null;
    if (!answered) return realFetch(input, init);
    await new Promise((resolve) => {
      setTimeout(resolve, answered.wait ?? delay);
    });
    return answered.response;
  };

  return () => {
    window.fetch = realFetch;
  };
}

/** An empty URL makes the hooks ask for relative `/api/*` paths, which the mock answers. */
const MOCK_DAAS_CONFIG = { url: '' } as const;

/**
 * Mounts the in-memory API around a story, with the `DaaSProvider` the data
 * hooks need. The children are drawn once the mock is in place, so their
 * first request already meets it.
 */
export const MockCronApi: React.FC<MockCronApiOptions & { children: React.ReactNode }> = ({
  children,
  ...options
}) => {
  const [ready, setReady] = useState(false);
  // The options of a story do not change while it is mounted
  const [initialOptions] = useState(options);

  useEffect(() => {
    const restore = installMockCronApi(initialOptions);
    setReady(true);
    return () => {
      restore();
      setReady(false);
    };
  }, [initialOptions]);

  if (!ready) return null;
  return (
    <DaaSProvider config={MOCK_DAAS_CONFIG} autoFetchUser={false}>
      {children}
    </DaaSProvider>
  );
};
