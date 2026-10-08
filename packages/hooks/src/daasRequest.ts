'use client';

/**
 * daasRequest
 *
 * What a data hook needs in order to work against either DaaS backend (the
 * Next.js routes of buildpad-daas and the Go engine), which answer the same
 * routes with different envelopes:
 *
 *   - `DaaSRequestError` / `toDaaSRequestError` — a failure as typed
 *     information: `apiRequest` (see `@buildpad/services`) throws a string
 *     `API error: <status> - <body>`, so the status and the error code have to
 *     be read back out of it before a component can tell "not found" from
 *     "not allowed" from "failed";
 *   - `buildDaaSListQuery` / `readDaaSListResponse` — a list request that
 *     always names its page and page size, and one page of the answer,
 *     whichever pagination vocabulary the backend used;
 *   - `readDaaSRecord` / `missingWhenIdIsMalformed` — one record, or a
 *     `notFound` when there is none to show;
 *   - `useDaaSRequest` — the `loading` / `error` state the data hooks share.
 */

import { useCallback, useRef, useState } from 'react';
import { parseDaaSError } from './parseDaaSError';

// ============================================================================
// Errors
// ============================================================================

/**
 * What a failed request means to the component that made it.
 *
 *   - `notFound`        — the record does not exist, or the caller's row rule
 *                         hides it (both backends answer 404 for either);
 *   - `forbidden`       — the caller may not do this (403);
 *   - `mfaRequired`     — the session has to prove a second factor first
 *                         (403 with code `MFA_REQUIRED`);
 *   - `unauthenticated` — no valid session (401);
 *   - `invalid`         — the request was refused as sent (400, 409, 422);
 *                         `message` says why;
 *   - `failure`         — anything else: a 5xx, a network error, an answer
 *                         that is not what the route promises.
 */
export type DaaSErrorKind =
  | 'notFound'
  | 'forbidden'
  | 'mfaRequired'
  | 'unauthenticated'
  | 'invalid'
  | 'failure';

/**
 * A failed DaaS request. `message` is the human sentence `parseDaaSError`
 * extracts, so the error can be shown as it is.
 */
export class DaaSRequestError extends Error {
  /** What the failure means; branch on this. */
  readonly kind: DaaSErrorKind;

  /** HTTP status, or null when the request never got an answer. */
  readonly status: number | null;

  /** The backend's error code (`NOT_FOUND`, `FORBIDDEN`, `MFA_REQUIRED`, …), or null. */
  readonly code: string | null;

  constructor(
    message: string,
    info: { kind: DaaSErrorKind; status?: number | null; code?: string | null },
  ) {
    super(message);
    // Keeps `instanceof` true when the class is compiled down to ES5.
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = 'DaaSRequestError';
    this.kind = info.kind;
    this.status = info.status ?? null;
    this.code = info.code ?? null;
  }
}

/** The text a thrown value carries, read the way `parseDaaSError` reads it. */
function rawMessageOf(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    try {
      return JSON.stringify(err);
    } catch {
      return '';
    }
  }
  return '';
}

/**
 * The error code of a response body. The backends put it in two places:
 * `{ errors: [{ extensions: { code } }] }` and `{ error, code }`.
 */
function codeOf(body: string): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;

  const errors = (parsed as { errors?: unknown }).errors;
  if (Array.isArray(errors) && errors.length > 0) {
    const extensions = (errors[0] as { extensions?: { code?: unknown } } | null)?.extensions;
    if (extensions && typeof extensions.code === 'string' && extensions.code) {
      return extensions.code;
    }
  }

  const code = (parsed as { code?: unknown }).code;
  return typeof code === 'string' && code ? code : null;
}

const KIND_BY_STATUS: Record<number, DaaSErrorKind> = {
  400: 'invalid',
  401: 'unauthenticated',
  403: 'forbidden',
  404: 'notFound',
  409: 'invalid',
  422: 'invalid',
};

/** Used only when the error carries no status (it did not come from `apiRequest`). */
const KIND_BY_CODE: Record<string, DaaSErrorKind> = {
  NOT_FOUND: 'notFound',
  FORBIDDEN: 'forbidden',
  UNAUTHORIZED: 'unauthenticated',
  INVALID_PAYLOAD: 'invalid',
  INVALID_QUERY: 'invalid',
  INVALID_ID: 'invalid',
};

/**
 * Any thrown value as a `DaaSRequestError`.
 *
 * Reads the status out of an `apiRequest` error and the code out of its body,
 * whichever of the backends' error shapes the body has: `{ error }`,
 * `{ errors: [{ message, extensions: { code } }] }`, `{ message }`, or
 * `{ error, code: 'MFA_REQUIRED' }`. A value that is already a
 * `DaaSRequestError` is returned as it is.
 */
export function toDaaSRequestError(err: unknown): DaaSRequestError {
  if (err instanceof DaaSRequestError) return err;

  const raw = rawMessageOf(err);
  const match = raw.match(/^API error:\s*(\d{3})\s*-\s*([\s\S]*)$/); // NOSONAR: fixed literals separate each quantifier, no ambiguous overlap
  const status = match ? Number.parseInt(match[1], 10) : null;
  const code = codeOf((match ? match[2] : raw).trim());

  let kind: DaaSErrorKind = 'failure';
  if (code === 'MFA_REQUIRED') {
    kind = 'mfaRequired';
  } else if (status !== null) {
    kind = KIND_BY_STATUS[status] ?? 'failure';
  } else if (code !== null) {
    kind = KIND_BY_CODE[code] ?? 'failure';
  }

  return new DaaSRequestError(parseDaaSError(err), { kind, status, code });
}

/**
 * A refused GET by id whose refusal is about the id itself, as the `notFound`
 * it is to a page that was opened with that id.
 *
 * A malformed id cannot name a record, but the routes do not agree on the
 * status: the engine's instance route answers 404, while its definition and
 * assignment routes answer 400 with the code `INVALID_ID`, and the Next.js
 * definition route answers 400 with the sentence "Invalid … ID format" and
 * no code. Any other error is returned unchanged — including a route that
 * answers a malformed id with a 500, which nothing tells apart from a failure.
 */
export function missingWhenIdIsMalformed(err: DaaSRequestError): DaaSRequestError {
  const aboutTheId = err.code === 'INVALID_ID' || /^invalid\b.*\bid format\b/i.test(err.message);
  if (err.status !== 400 || !aboutTheId) return err;
  return new DaaSRequestError(err.message, { kind: 'notFound', status: err.status, code: err.code });
}

/**
 * The record of a `{ data: <record> }` answer.
 *
 * An answer without a record throws, carrying `missing` as its message, so a
 * caller never receives `undefined` and renders a blank form for it. To a
 * read that is a `notFound` (the default); a write that is answered without
 * the saved record passes `'failure'`.
 */
export function readDaaSRecord<T>(
  response: unknown,
  missing: string,
  kind: DaaSErrorKind = 'notFound',
): T {
  const data =
    response && typeof response === 'object' ? (response as { data?: unknown }).data : undefined;
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new DaaSRequestError(missing, { kind });
  }
  return data as T;
}

// ============================================================================
// Lists
// ============================================================================

/**
 * The query string of a list request: `page` and `limit` always, `search`
 * when there is one.
 *
 * Both are always sent because the backends' defaults differ per route (25
 * rows, 50 rows, or every row), and a list that relies on a default shows a
 * different number of rows on each backend.
 */
export function buildDaaSListQuery(params: { page?: number; limit?: number; search?: string } = {}): {
  page: number;
  limit: number;
  query: string;
} {
  const page = params.page ?? 1;
  const limit = params.limit ?? 25;
  const query = new URLSearchParams();
  query.set('page', String(page));
  query.set('limit', String(limit));
  if (params.search) query.set('search', params.search);
  return { page, limit, query: query.toString() };
}

/** One page of a list, in one vocabulary. */
export interface DaaSListPage<T> {
  /** Rows of this page */
  items: T[];
  /** Rows matching the request across all pages */
  total: number;
  /** Number of pages, at least 1 */
  totalPages: number;
  /** Page the backend served (1-indexed) */
  page: number;
  /** Page size the backend served */
  limit: number;
}

function firstNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return undefined;
}

/**
 * One page out of a list answer.
 *
 * The backends count a list in two vocabularies and the Go engine sends both:
 * top-level `count` / `totalCount` / `totalPages` / `page` / `pageSize`, and
 * `meta.filter_count` / `meta.total_pages` / `meta.page` / `meta.limit`. Both
 * are read, top-level first. The total is always the count after the search
 * (`meta.total_count`, the count before it, is only the last resort).
 * `data: null`, which the engine sends for no rows, is an empty page. An empty
 * list is one page, not zero.
 *
 * `request` is the page and page size that were asked for, used when the
 * answer does not say what it served.
 *
 * An answer without a `data` array is not a list: it throws a `failure`, so a
 * broken answer cannot be shown as "no rows".
 */
export function readDaaSListResponse<T>(
  response: unknown,
  request: { page: number; limit: number },
): DaaSListPage<T> {
  const body = response as
    | {
        data?: unknown;
        count?: unknown;
        totalCount?: unknown;
        totalPages?: unknown;
        page?: unknown;
        pageSize?: unknown;
        meta?: unknown;
      }
    | null
    | undefined;

  const data = body && typeof body === 'object' ? body.data : undefined;
  if (data !== null && !Array.isArray(data)) {
    throw new DaaSRequestError('The server answered the list request without a list of rows', {
      kind: 'failure',
    });
  }

  const items = (data ?? []) as T[];
  const meta = (body?.meta && typeof body.meta === 'object' ? body.meta : {}) as {
    filter_count?: unknown;
    total?: unknown;
    total_count?: unknown;
    total_pages?: unknown;
    page?: unknown;
    limit?: unknown;
  };

  const limit = firstNumber(body?.pageSize, meta.limit, request.limit) ?? items.length;
  const total =
    firstNumber(body?.totalCount, body?.count, meta.filter_count, meta.total, meta.total_count) ??
    items.length;
  const totalPages =
    firstNumber(body?.totalPages, meta.total_pages) ?? (limit > 0 ? Math.ceil(total / limit) : 1);

  return {
    items,
    total,
    totalPages: Math.max(1, totalPages),
    page: firstNumber(body?.page, meta.page, request.page) ?? 1,
    limit,
  };
}

// ============================================================================
// Request state
// ============================================================================

/** The state `useDaaSRequest` keeps for the hook that uses it. */
export interface DaaSRequestState {
  /** True while at least one request is in flight */
  loading: boolean;
  /** Message of the last request that failed; cleared when a new one starts */
  error: string | null;
  /** The same failure, typed; cleared when a new request starts */
  errorInfo: DaaSRequestError | null;
  /**
   * Runs one request: tracks `loading`, records a failure in `error` /
   * `errorInfo`, and rethrows it as a `DaaSRequestError`.
   */
  run: <T>(request: () => Promise<T>) => Promise<T>;
}

/**
 * `loading` / `error` state for a data hook, in the shape of `useUsers`:
 * every method sets `loading`, a failure sets `error` and rejects.
 *
 * Two things differ from that precedent. A failure rejects with a
 * `DaaSRequestError` (still an `Error` whose `message` is the parsed text), so
 * the caller can branch on `kind`. And `loading` counts the requests in
 * flight, so two concurrent calls (a record and its history) do not report
 * "done" when the first of them returns.
 */
export function useDaaSRequest(): DaaSRequestState {
  const [loading, setLoading] = useState(false);
  const [errorInfo, setErrorInfo] = useState<DaaSRequestError | null>(null);
  const inFlight = useRef(0);

  const run = useCallback(async <T>(request: () => Promise<T>): Promise<T> => {
    inFlight.current += 1;
    setLoading(true);
    setErrorInfo(null);

    try {
      return await request();
    } catch (err) {
      const failure = toDaaSRequestError(err);
      setErrorInfo(failure);
      throw failure;
    } finally {
      inFlight.current -= 1;
      if (inFlight.current === 0) setLoading(false);
    }
  }, []);

  return { loading, error: errorInfo?.message ?? null, errorInfo, run };
}
