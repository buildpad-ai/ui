/**
 * daasRequest unit tests
 *
 * Covers what lets one hook serve both DaaS backends: an `apiRequest` failure
 * as a typed error across every error body the backends send, a list answer in
 * either pagination vocabulary, the record and list-query helpers, and the
 * shared `loading` / `error` state.
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import {
  buildDaaSListQuery,
  DaaSRequestError,
  missingWhenIdIsMalformed,
  readDaaSListResponse,
  readDaaSRecord,
  toDaaSRequestError,
  useDaaSRequest,
} from '../src/daasRequest';

/** An error as `apiRequest` throws it for a non-2xx answer. */
function apiError(status: number, body: unknown): Error {
  return new Error(`API error: ${status} - ${typeof body === 'string' ? body : JSON.stringify(body)}`);
}

describe('toDaaSRequestError', () => {
  describe('each error body the backends send', () => {
    it('{ error } — the definition routes of the Next.js backend', () => {
      const err = toDaaSRequestError(apiError(404, { error: 'Workflow definition not found' }));
      expect(err).toBeInstanceOf(DaaSRequestError);
      expect(err).toBeInstanceOf(Error);
      expect(err).toMatchObject({
        kind: 'notFound',
        status: 404,
        code: null,
        message: 'Workflow definition not found',
      });
    });

    it('{ errors: [{ message, extensions: { code } }] } — the engine, and the assignment routes', () => {
      const err = toDaaSRequestError(
        apiError(404, {
          errors: [{ message: 'Workflow assignment not found', extensions: { code: 'NOT_FOUND' } }],
        }),
      );
      expect(err).toMatchObject({
        kind: 'notFound',
        status: 404,
        code: 'NOT_FOUND',
        message: 'Workflow assignment not found',
      });
    });

    it('{ message } — the transition refusal', () => {
      const err = toDaaSRequestError(
        apiError(403, { message: 'You are not authorized to perform this transition' }),
      );
      expect(err).toMatchObject({
        kind: 'forbidden',
        status: 403,
        code: null,
        message: 'You are not authorized to perform this transition',
      });
    });

    it("{ error, code: 'MFA_REQUIRED' } — a session that has to step up", () => {
      const err = toDaaSRequestError(
        apiError(403, {
          error: 'Multi-factor authentication required',
          code: 'MFA_REQUIRED',
          current_aal: 'aal1',
          required_aal: 'aal2',
        }),
      );
      expect(err).toMatchObject({
        kind: 'mfaRequired',
        status: 403,
        code: 'MFA_REQUIRED',
        message: 'Multi-factor authentication required',
      });
    });

    it('the engine spells the same MFA refusal with an errors array', () => {
      const err = toDaaSRequestError(
        apiError(403, {
          errors: [{ message: 'MFA verification required', extensions: { code: 'MFA_REQUIRED' } }],
        }),
      );
      expect(err).toMatchObject({ kind: 'mfaRequired', status: 403, code: 'MFA_REQUIRED' });
    });
  });

  describe('kind', () => {
    it('tells a refusal from a missing record from a failure', () => {
      const forbidden = { errors: [{ message: 'Permission denied', extensions: { code: 'FORBIDDEN' } }] };
      expect(toDaaSRequestError(apiError(403, forbidden)).kind).toBe('forbidden');
      expect(toDaaSRequestError(apiError(403, { error: 'Permission denied' })).kind).toBe('forbidden');
      expect(toDaaSRequestError(apiError(404, { error: 'Not found' })).kind).toBe('notFound');
      expect(toDaaSRequestError(apiError(500, { error: 'Failed to fetch workflow definitions' })).kind).toBe(
        'failure',
      );
    });

    it('reads 401 as unauthenticated', () => {
      expect(toDaaSRequestError(apiError(401, { error: 'Not authenticated' })).kind).toBe('unauthenticated');
    });

    it('reads 400, 409 and 422 as a request refused as sent', () => {
      const inUse = { error: 'Cannot delete workflow definition: it is assigned to one or more collections' };
      expect(toDaaSRequestError(apiError(400, inUse))).toMatchObject({ kind: 'invalid', message: inUse.error });
      expect(toDaaSRequestError(apiError(409, { error: 'Conflict' })).kind).toBe('invalid');
      expect(toDaaSRequestError(apiError(422, { error: 'Unprocessable' })).kind).toBe('invalid');
    });

    it('reads any other status as a failure', () => {
      expect(toDaaSRequestError(apiError(429, { error: 'Too many requests' })).kind).toBe('failure');
      expect(toDaaSRequestError(apiError(502, '<html>Bad Gateway</html>'))).toMatchObject({
        kind: 'failure',
        status: 502,
        code: null,
      });
    });

    it('goes by the status when the status and the code disagree', () => {
      // A missing assignment answered 500 before the route was fixed.
      const body = { errors: [{ message: 'Failed', extensions: { code: 'NOT_FOUND' } }] };
      expect(toDaaSRequestError(apiError(500, body)).kind).toBe('failure');
    });
  });

  describe('errors that did not come from apiRequest', () => {
    it('a network failure has no status and is a failure', () => {
      const err = toDaaSRequestError(new TypeError('Failed to fetch'));
      expect(err).toMatchObject({ kind: 'failure', status: null, code: null, message: 'Failed to fetch' });
    });

    it('a bare JSON body is classified by its code', () => {
      const body = JSON.stringify({ errors: [{ message: 'Gone', extensions: { code: 'NOT_FOUND' } }] });
      expect(toDaaSRequestError(body)).toMatchObject({ kind: 'notFound', status: null, code: 'NOT_FOUND' });
      expect(toDaaSRequestError(JSON.stringify({ error: 'No', code: 'FORBIDDEN' })).kind).toBe('forbidden');
      expect(toDaaSRequestError(JSON.stringify({ error: 'Odd', code: 'SOMETHING_ELSE' })).kind).toBe('failure');
    });

    it('anything else is a failure with a message', () => {
      expect(toDaaSRequestError(undefined)).toMatchObject({ kind: 'failure', status: null });
      expect(toDaaSRequestError(undefined).message).toBeTruthy();
      expect(toDaaSRequestError({ odd: true }).kind).toBe('failure');
      expect(toDaaSRequestError('[1,2]').code).toBeNull();
      expect(toDaaSRequestError(42)).toMatchObject({ kind: 'failure', code: null });
    });

    it('a thrown response body object is read like its JSON text', () => {
      expect(toDaaSRequestError({ error: 'Permission denied', code: 'FORBIDDEN' })).toMatchObject({
        kind: 'forbidden',
        code: 'FORBIDDEN',
        message: 'Permission denied',
      });
      const circular: Record<string, unknown> = {};
      circular.self = circular;
      expect(toDaaSRequestError(circular)).toMatchObject({ kind: 'failure', code: null });
    });
  });

  it('returns a DaaSRequestError as it is', () => {
    const original = new DaaSRequestError('Nope', { kind: 'invalid', code: 'INVALID_PAYLOAD' });
    expect(toDaaSRequestError(original)).toBe(original);
    expect(original).toMatchObject({ name: 'DaaSRequestError', status: null, code: 'INVALID_PAYLOAD' });
  });
});

describe('missingWhenIdIsMalformed', () => {
  it('reads the engine’s INVALID_ID refusal as not found', () => {
    const refused = toDaaSRequestError(
      apiError(400, {
        errors: [{ message: 'Invalid workflow assignment ID format', extensions: { code: 'INVALID_ID' } }],
      }),
    );
    expect(refused.kind).toBe('invalid');
    expect(missingWhenIdIsMalformed(refused)).toMatchObject({
      kind: 'notFound',
      status: 400,
      code: 'INVALID_ID',
      message: 'Invalid workflow assignment ID format',
    });
  });

  it('reads the Next.js backend’s codeless sentence as not found', () => {
    const refused = toDaaSRequestError(apiError(400, { error: 'Invalid workflow definition ID format' }));
    expect(missingWhenIdIsMalformed(refused).kind).toBe('notFound');
  });

  it('leaves every other error unchanged', () => {
    const scope = toDaaSRequestError(apiError(400, { error: 'Invalid scope', code: 'INVALID_SCOPE' }));
    expect(missingWhenIdIsMalformed(scope)).toBe(scope);
    const failed = toDaaSRequestError(apiError(500, { error: 'Invalid workflow definition ID format' }));
    expect(missingWhenIdIsMalformed(failed)).toBe(failed);
    const forbidden = toDaaSRequestError(apiError(403, { error: 'Permission denied' }));
    expect(missingWhenIdIsMalformed(forbidden)).toBe(forbidden);
  });
});

describe('readDaaSRecord', () => {
  it('returns the record of a { data } answer', () => {
    expect(readDaaSRecord({ data: { id: 'a1' } }, 'Missing')).toEqual({ id: 'a1' });
  });

  it.each([[undefined], [null], [{}], [{ data: null }], [{ data: 'a1' }], [{ data: [] }], ['text']])(
    'throws not found for %j, which holds no record',
    (response) => {
      let thrown: unknown;
      try {
        readDaaSRecord(response, 'Workflow instance not found');
      } catch (err) {
        thrown = err;
      }
      expect(thrown).toBeInstanceOf(DaaSRequestError);
      expect(thrown).toMatchObject({ kind: 'notFound', status: null, message: 'Workflow instance not found' });
    },
  );

  it('throws the kind a write asks for', () => {
    expect(() => readDaaSRecord({ data: null }, 'Not answered', 'failure')).toThrow(
      expect.objectContaining({ kind: 'failure', message: 'Not answered' }),
    );
  });
});

describe('buildDaaSListQuery', () => {
  it('always names the page and the page size', () => {
    expect(buildDaaSListQuery()).toEqual({ page: 1, limit: 25, query: 'page=1&limit=25' });
    expect(buildDaaSListQuery({})).toEqual({ page: 1, limit: 25, query: 'page=1&limit=25' });
    expect(buildDaaSListQuery({ page: 3, limit: 10 })).toEqual({ page: 3, limit: 10, query: 'page=3&limit=10' });
  });

  it('adds the search term, encoded, only when there is one', () => {
    expect(buildDaaSListQuery({ search: 'a,b & c' }).query).toBe('page=1&limit=25&search=a%2Cb+%26+c');
    expect(buildDaaSListQuery({ search: '' }).query).toBe('page=1&limit=25');
  });
});

describe('readDaaSListResponse', () => {
  const rows = [{ id: 'r1' }, { id: 'r2' }];
  const asked = { page: 2, limit: 25 };

  it('reads the top-level vocabulary of the Next.js backend', () => {
    const answer = { data: rows, count: 27, totalCount: 27, page: 2, pageSize: 25, totalPages: 2 };
    expect(readDaaSListResponse(answer, asked)).toEqual({
      items: rows,
      total: 27,
      totalPages: 2,
      page: 2,
      limit: 25,
    });
  });

  it('reads the meta vocabulary', () => {
    const answer = {
      data: rows,
      meta: { total_count: 40, filter_count: 27, page: 2, limit: 25, offset: 25, total_pages: 2 },
    };
    expect(readDaaSListResponse(answer, asked)).toEqual({
      items: rows,
      total: 27,
      totalPages: 2,
      page: 2,
      limit: 25,
    });
  });

  it('reads an engine answer, which carries both, to the same page', () => {
    const answer = {
      data: rows,
      meta: { total_count: 40, filter_count: 27, page: 2, limit: 25, offset: 25, total_pages: 2, total: 27 },
      count: 27,
      totalCount: 27,
      page: 2,
      pageSize: 25,
      totalPages: 2,
    };
    expect(readDaaSListResponse(answer, asked)).toEqual({
      items: rows,
      total: 27,
      totalPages: 2,
      page: 2,
      limit: 25,
    });
  });

  it('counts the rows after the search, not the whole collection', () => {
    expect(readDaaSListResponse({ data: rows, meta: { total_count: 40, filter_count: 2 } }, asked).total).toBe(2);
    expect(readDaaSListResponse({ data: rows, meta: { total_count: 40, total: 2 } }, asked).total).toBe(2);
    // The count before the search is used only when nothing else is sent.
    expect(readDaaSListResponse({ data: rows, meta: { total_count: 40 } }, asked).total).toBe(40);
  });

  it('reads data: null as an empty page', () => {
    const answer = { data: null, count: 0, totalCount: 0, page: 1, pageSize: 25, totalPages: 1 };
    expect(readDaaSListResponse(answer, { page: 1, limit: 25 })).toEqual({
      items: [],
      total: 0,
      totalPages: 1,
      page: 1,
      limit: 25,
    });
  });

  it('reads an empty list as one page, though the Next.js backend answers zero', () => {
    const answer = { data: [], count: 0, totalCount: 0, page: 1, pageSize: 25, totalPages: 0 };
    expect(readDaaSListResponse(answer, { page: 1, limit: 25 }).totalPages).toBe(1);
  });

  it('reports the page size that was served when the backend clamped it', () => {
    const answer = { data: rows, count: 250, totalCount: 250, page: 1, pageSize: 100, totalPages: 3 };
    expect(readDaaSListResponse(answer, { page: 1, limit: 1000 })).toMatchObject({ limit: 100, totalPages: 3 });
  });

  it('falls back to the request and the rows for an answer with no counts', () => {
    expect(readDaaSListResponse({ data: rows }, asked)).toEqual({
      items: rows,
      total: 2,
      totalPages: 1,
      page: 2,
      limit: 25,
    });
    // Derived from the total when only the total is sent.
    expect(readDaaSListResponse({ data: rows, count: 60 }, asked).totalPages).toBe(3);
    expect(readDaaSListResponse({ data: rows, count: '60' }, asked).total).toBe(2);
    expect(readDaaSListResponse({ data: rows, count: 60 }, { page: 1, limit: 0 }).totalPages).toBe(1);
  });

  it.each([[undefined], [null], [{}], [{ error: 'Failed' }], [{ data: 'rows' }], [{ data: {} }], ['<html>']])(
    'throws a failure for %j instead of reporting an empty list',
    (answer) => {
      let thrown: unknown;
      try {
        readDaaSListResponse(answer, asked);
      } catch (err) {
        thrown = err;
      }
      expect(thrown).toBeInstanceOf(DaaSRequestError);
      expect(thrown).toMatchObject({ kind: 'failure', status: null });
    },
  );
});

describe('useDaaSRequest', () => {
  it('starts idle with no error', () => {
    const { result } = renderHook(() => useDaaSRequest());
    expect(result.current).toMatchObject({ loading: false, error: null, errorInfo: null });
  });

  it('resolves to what the request resolves to', async () => {
    const { result } = renderHook(() => useDaaSRequest());
    let out: unknown;
    await act(async () => {
      out = await result.current.run(async () => 'done');
    });
    expect(out).toBe('done');
    expect(result.current).toMatchObject({ loading: false, error: null, errorInfo: null });
  });

  it('records a failure, typed, and rejects with it', async () => {
    const { result } = renderHook(() => useDaaSRequest());
    let thrown: unknown;
    await act(async () => {
      thrown = await result.current
        .run(async () => {
          throw apiError(403, { errors: [{ message: 'Permission denied', extensions: { code: 'FORBIDDEN' } }] });
        })
        .catch((err: unknown) => err);
    });

    expect(thrown).toBeInstanceOf(DaaSRequestError);
    expect(thrown).toMatchObject({ kind: 'forbidden', message: 'Permission denied' });
    await waitFor(() => expect(result.current.error).toBe('Permission denied'));
    expect(result.current.errorInfo).toBe(thrown);
    expect(result.current.loading).toBe(false);
  });

  it('clears the last failure when the next request starts', async () => {
    const { result } = renderHook(() => useDaaSRequest());
    await act(async () => {
      await result.current.run(async () => Promise.reject(new Error('Boom'))).catch(() => undefined);
    });
    expect(result.current.error).toBe('Boom');

    await act(async () => {
      await result.current.run(async () => 'ok');
    });
    expect(result.current).toMatchObject({ error: null, errorInfo: null });
  });

  it('stays loading until every concurrent request has returned', async () => {
    const { result } = renderHook(() => useDaaSRequest());
    let finishFirst!: (value: string) => void;
    let finishSecond!: (value: string) => void;
    let first!: Promise<string>;
    let second!: Promise<string>;

    act(() => {
      first = result.current.run(() => new Promise<string>((resolve) => { finishFirst = resolve; }));
      second = result.current.run(() => new Promise<string>((resolve) => { finishSecond = resolve; }));
    });
    await waitFor(() => expect(result.current.loading).toBe(true));

    await act(async () => {
      finishFirst('record');
      await first;
    });
    expect(result.current.loading).toBe(true);

    await act(async () => {
      finishSecond('history');
      await second;
    });
    expect(result.current.loading).toBe(false);
  });
});
