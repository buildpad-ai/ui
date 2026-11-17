/**
 * apiRequest / ApiRequestError Unit Tests
 *
 * A response that is not OK is thrown as an ApiRequestError: the message
 * keeps the "API error: <status> - <body>" text callers parse, and the
 * status, the DaaS `errors` array and the backend's own sentence are fields.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { apiRequest, ApiRequestError } from '../src/api-request';

vi.mock('../src/daas-context', () => ({
  buildApiUrl: (path: string) => `https://daas.test${path}`,
  getApiHeadersAsync: async () => ({}),
  getGlobalDaaSConfig: () => null,
}));

function respond(status: number, body: string) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(body, { status, headers: { 'Content-Type': 'application/json' } })),
  );
}

describe('apiRequest', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('throws an ApiRequestError that keeps the message callers parse', async () => {
    respond(500, '{"error":"null value in column \\"title\\""}');

    const error = await apiRequest('/api/items/posts').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toBeInstanceOf(Error);
    expect((error as ApiRequestError).message).toBe('API error: 500 - {"error":"null value in column \\"title\\""}');
    expect((error as ApiRequestError).status).toBe(500);
    expect((error as ApiRequestError).detail).toBe('null value in column "title"');
    expect((error as ApiRequestError).errors).toBeUndefined();
  });

  it('reads the DaaS errors array and its first message', async () => {
    respond(400, JSON.stringify({ errors: [{ message: 'Value is required', extensions: { code: 'INVALID', field: 'code' } }] }));

    const error = (await apiRequest('/api/items/posts').catch((e: unknown) => e)) as ApiRequestError;

    expect(error.status).toBe(400);
    expect(error.errors).toEqual([{ message: 'Value is required', extensions: { code: 'INVALID', field: 'code' } }]);
    expect(error.detail).toBe('Value is required');
  });

  it('has no detail for a body that is not JSON', () => {
    const error = new ApiRequestError(502, '<html>Bad gateway</html>');

    expect(error.detail).toBeNull();
    expect(error.errors).toBeUndefined();
    expect(error.message).toBe('API error: 502 - <html>Bad gateway</html>');
  });

  it('reads a bare { message } body', () => {
    expect(new ApiRequestError(409, '{"message":"Transition not allowed"}').detail).toBe('Transition not allowed');
  });
});

describe('apiRequest on a 401', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function sequence(...responses: Response[]) {
    const fetchMock = vi.fn();
    responses.forEach((r) => fetchMock.mockResolvedValueOnce(r));
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  it('renews the token once and retries with it', async () => {
    const renewToken = vi.fn(async () => 'fresh');
    const fetchMock = sequence(json(401, { errors: [{ message: 'invalid token' }] }), json(200, { data: [{ id: 1 }] }));

    const result = await apiRequest('/api/items/posts', { daasConfig: { url: 'https://daas.test', getToken: async () => 'stale', renewToken } });

    expect(result).toEqual({ data: [{ id: 1 }] });
    expect(renewToken).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer fresh');
  });

  it('fails with the original 401 when no new token can be had', async () => {
    const fetchMock = sequence(json(401, { errors: [{ message: 'invalid token' }] }));

    const error = await apiRequest('/api/items/posts', {
      daasConfig: { url: 'https://daas.test', getToken: async () => 'stale', renewToken: async () => null },
    }).catch((e: unknown) => e);

    expect((error as ApiRequestError).status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not renew a static token', async () => {
    const renewToken = vi.fn(async () => 'fresh');
    sequence(json(401, {}));

    const error = await apiRequest('/api/items/posts', { daasConfig: { url: 'https://daas.test', token: 'static', renewToken } }).catch((e: unknown) => e);

    expect((error as ApiRequestError).status).toBe(401);
    expect(renewToken).not.toHaveBeenCalled();
  });
});
