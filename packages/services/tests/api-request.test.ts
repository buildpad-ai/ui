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
