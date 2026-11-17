/**
 * `lib/daas-token.ts` and `app/api/auth/token/route.ts`, run as the app runs
 * them.
 *
 * The templates are imported from `templates/` with the Supabase clients
 * replaced by fakes. An idle tab's browser token expires or goes missing;
 * `getDaaSToken` must then take one from the server session through the
 * route (one request for every caller at once) and report null when the
 * server has no session either. The route must hand out the verified
 * session's token, never cached, and 401 otherwise.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const fake = vi.hoisted(() => ({
  browserSession: null as { access_token: string } | null,
  server: {
    user: null as { id: string } | null,
    session: null as { access_token: string; expires_at?: number } | null,
    throws: false,
  },
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getSession: async () => ({ data: { session: fake.browserSession } }) },
  }),
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => {
    if (fake.server.throws) throw new Error('cookie store unavailable');
    return {
      auth: {
        getUser: async () => ({ data: { user: fake.server.user } }),
        getSession: async () => ({ data: { session: fake.server.session } }),
      },
    };
  },
}));

function jwt(expSecondsFromNow: number): string {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'HS256' })}.${b64({ exp: Math.floor(Date.now() / 1000) + expSecondsFromNow })}.sig`;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const fetchMock = vi.fn();

beforeEach(() => {
  vi.resetModules();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  fake.browserSession = null;
  fake.server = { user: null, session: null, throws: false };
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const daasToken = () => import('../templates/lib/daas-token');

describe('getDaaSToken', () => {
  test('uses the browser token while it has more than a minute left', async () => {
    const { getDaaSToken } = await daasToken();
    fake.browserSession = { access_token: jwt(600) };

    await expect(getDaaSToken()).resolves.toBe(fake.browserSession.access_token);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test.each([
    ['expired', () => ({ access_token: jwt(-30) })],
    ['about to expire', () => ({ access_token: jwt(30) })],
    ['unreadable', () => ({ access_token: 'not-a-jwt' })],
    ['missing', () => null],
  ])('asks the server when the browser token is %s', async (_label, session) => {
    const { getDaaSToken } = await daasToken();
    fake.browserSession = session();
    fetchMock.mockResolvedValue(json(200, { access_token: 'from-server' }));

    await expect(getDaaSToken()).resolves.toBe('from-server');
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/token', { cache: 'no-store', credentials: 'same-origin' });
  });

  test('every caller at once shares one request, and the next renewal makes a new one', async () => {
    const { getDaaSToken } = await daasToken();
    fetchMock.mockImplementation(async () => json(200, { access_token: 'from-server' }));

    await expect(Promise.all([getDaaSToken(), getDaaSToken(), getDaaSToken()])).resolves.toEqual([
      'from-server',
      'from-server',
      'from-server',
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await getDaaSToken();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("calls the route under the zone's basePath", async () => {
    vi.stubEnv('NEXT_PUBLIC_BASE_PATH', '/crm');
    const { renewDaaSToken } = await daasToken();
    fetchMock.mockResolvedValue(json(200, { access_token: 't' }));

    await renewDaaSToken();
    expect(fetchMock.mock.calls[0][0]).toBe('/crm/api/auth/token');
  });

  test.each([
    ['answers 401', () => fetchMock.mockResolvedValue(json(401, {}))],
    ['answers with no token', () => fetchMock.mockResolvedValue(json(200, {}))],
    ['answers with an HTML page', () => fetchMock.mockResolvedValue(new Response('<html></html>', { status: 200 }))],
    ['cannot be reached', () => fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))],
  ])('is null when the server %s', async (_label, arrange) => {
    const { getDaaSToken } = await daasToken();
    arrange();
    await expect(getDaaSToken()).resolves.toBeNull();
  });
});

describe('GET /api/auth/token', () => {
  const route = () => import('../templates/api/auth-token-route');

  test("returns the verified session's token, never cached", async () => {
    fake.server = { user: { id: 'u1' }, session: { access_token: 'server-at', expires_at: 1700000000 }, throws: false };
    const { GET, dynamic } = await route();

    const res = await GET();
    expect(dynamic).toBe('force-dynamic');
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store, must-revalidate');
    await expect(res.json()).resolves.toEqual({ access_token: 'server-at', expires_at: 1700000000 });
  });

  test.each([
    ['no signed-in user', { user: null, session: { access_token: 'x' }, throws: false }],
    ['a user without a session', { user: { id: 'u1' }, session: null, throws: false }],
  ])('is 401 for %s', async (_label, server) => {
    fake.server = server;
    const { GET } = await route();

    const res = await GET();
    expect(res.status).toBe(401);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store, must-revalidate');
    expect(await res.json()).not.toHaveProperty('access_token');
  });

  test('is 500 when the session cannot be read', async () => {
    fake.server = { user: null, session: null, throws: true };
    const { GET } = await route();

    expect((await GET()).status).toBe(500);
  });
});
