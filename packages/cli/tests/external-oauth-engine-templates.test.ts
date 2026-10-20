/**
 * The external-oauth-engine templates, run as the app would run them.
 *
 * The provider route and the callback route are imported from
 * `templates/` with their `@/` imports pointed at the sibling templates and
 * `@supabase/ssr` replaced by a fake client, so each test drives one My Apps
 * sign-in end to end: authorize redirect, code exchange, `signInWithIdToken`
 * against the Engine with `X-Tenant-Id`, the role check, and the cookies.
 */
import crypto from 'node:crypto';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { NextRequest } from 'next/server';

const fake = vi.hoisted(() => ({
  createServerClient: vi.fn(),
}));

vi.mock('@supabase/ssr', () => ({ createServerClient: fake.createServerClient }));
vi.mock('@/lib/oauth/config', async () => import('../templates/lib/oauth/config'));
vi.mock('@/lib/oauth/engine', async () => import('../templates/lib/oauth/engine'));
vi.mock('@/lib/origin', async () => import('../templates/lib/origin'));

const engine = await import('../templates/lib/oauth/engine');
const providerRoute = await import('../templates/api/auth-oauth-provider-engine-route');
const callbackRoute = await import('../templates/api/auth-callback-oauth-engine-route');

const ENV = {
  OAUTH_CLIENT_ID: 'client-123',
  OAUTH_CLIENT_SECRET: 'super-secret-value',
  OAUTH_AUTHORIZATION_URL: 'https://idp.test/api/idp/authorize',
  OAUTH_TOKEN_URL: 'https://idp.test/api/idp/token',
  NEXT_PUBLIC_SUPABASE_URL: 'https://engine.test/',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'buildpad-engine-public-anon-key',
  NEXT_PUBLIC_BUILDPAD_TENANT_ID: '11111111-2222-3333-4444-555555555555',
};
const ID_TOKEN = 'header.payload-with-claims.signature';
const ENGINE_ACCESS_TOKEN = 'engine-access-token';
const ORIGIN = 'http://localhost:3000';

const sha256hex = (v: string) => crypto.createHash('sha256').update(v).digest('hex');

interface FakeAuth {
  signInWithIdToken: ReturnType<typeof vi.fn>;
  signOut: ReturnType<typeof vi.fn>;
}
let auth: FakeAuth;
let clientOptions: { global?: { headers?: Record<string, string> } } | undefined;
let clientArgs: unknown[] = [];

/** Engine answers and My Apps answers, by URL. */
let tokenAnswer: { status: number; body: unknown };
let meAnswer: { status: number; body: unknown };
let fetchMock: ReturnType<typeof vi.fn>;
let logged: string[];

beforeEach(() => {
  for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v);
  vi.stubEnv('HOST_ORIGIN', '');
  vi.stubEnv('NEXT_PUBLIC_HOST_ORIGIN', '');

  auth = {
    signInWithIdToken: vi.fn(async () => {
      // A real client writes the session cookies through setAll.
      (clientOptions as { cookies: { setAll: (c: unknown[]) => void } }).cookies.setAll([
        { name: 'sb-engine-auth-token', value: 'session-cookie', options: { path: '/', httpOnly: false } },
      ]);
      return { data: { session: { access_token: ENGINE_ACCESS_TOKEN } }, error: null };
    }),
    signOut: vi.fn(async () => ({ error: null })),
  };
  fake.createServerClient.mockImplementation((...args: unknown[]) => {
    clientArgs = args;
    clientOptions = args[2] as typeof clientOptions;
    return { auth };
  });

  tokenAnswer = { status: 200, body: { id_token: ID_TOKEN, access_token: 'idp-access', token_type: 'Bearer' } };
  meAnswer = { status: 200, body: { data: { id: 'u1', roles: [{ role_id: 'r1' }], admin_access: false } } };
  fetchMock = vi.fn(async (url: string) => {
    const answer = url === ENV.OAUTH_TOKEN_URL ? tokenAnswer : url === 'https://engine.test/api/users/me' ? meAnswer : null;
    if (!answer) throw new Error(`unexpected fetch ${url}`);
    return new Response(JSON.stringify(answer.body), { status: answer.status, headers: { 'Content-Type': 'application/json' } });
  });
  vi.stubGlobal('fetch', fetchMock);

  logged = [];
  for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const) {
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      logged.push(args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
    });
  }
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  fake.createServerClient.mockReset();
});

async function start(provider = 'my-apps', query = '?returnTo=/orders') {
  const request = new NextRequest(`${ORIGIN}/api/auth/oauth/${provider}${query}`);
  return providerRoute.GET(request, { params: Promise.resolve({ provider }) });
}

function flowCookieOf(response: Response): string {
  const header = response.headers.get('set-cookie') ?? '';
  const match = header.match(new RegExp(`${engine.ENGINE_FLOW_COOKIE}=([^;]*)`));
  if (!match) throw new Error(`no flow cookie in: ${header}`);
  return match[1];
}

async function callback(query: string, flowCookie?: string) {
  const request = new NextRequest(`${ORIGIN}/api/auth/callback${query}`, {
    headers: flowCookie ? { cookie: `${engine.ENGINE_FLOW_COOKIE}=${flowCookie}` } : {},
  });
  return callbackRoute.GET(request);
}

/** Starts a sign-in and returns the flow cookie and the decoded flow. */
async function started() {
  const cookie = flowCookieOf(await start());
  const flow = engine.decodeFlowState(cookie)!;
  return { cookie, flow };
}

function expectNothingSecretLogged() {
  const all = logged.join('\n');
  for (const secret of [ID_TOKEN, ENGINE_ACCESS_TOKEN, ENV.OAUTH_CLIENT_SECRET, 'idp-access', 'session-cookie']) {
    expect(all).not.toContain(secret);
  }
}

describe('lib/oauth/engine', () => {
  test('the OIDC nonce is the lower-case SHA-256 hex of the raw nonce', () => {
    expect(engine.hashNonce('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  test('a flow cookie round-trips, and an expired or malformed one reads as none', () => {
    const flow = engine.createEngineFlowState('/x');
    expect(engine.decodeFlowState(engine.encodeFlowState(flow))).toEqual(flow);
    const old = { ...flow, createdAt: Date.now() - (engine.ENGINE_FLOW_MAX_AGE + 1) * 1000 };
    expect(engine.decodeFlowState(engine.encodeFlowState(old))).toBeNull();
    expect(engine.decodeFlowState('not-base64-json')).toBeNull();
    expect(engine.decodeFlowState(undefined)).toBeNull();
  });

  test('the Engine’s answers map to the codes the login buttons explain', () => {
    expect(engine.signInErrorOf({ status: 400, code: 'invalid_credentials' })).toBe('sign_in_refused');
    expect(engine.signInErrorOf({ status: 400, code: 'user_banned' })).toBe('account_disabled');
    expect(engine.signInErrorOf({ status: 503, code: 'unexpected_failure' })).toBe('engine_unavailable');
    expect(engine.signInErrorOf({ status: 400 })).toBe('sign_in_failed');
  });
});

describe('GET /api/auth/oauth/[provider] (Engine)', () => {
  test('redirects to My Apps with state, PKCE and the hashed nonce, and keeps the raw values in an httpOnly cookie', async () => {
    const response = await start();

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get('location')!);
    expect(`${location.origin}${location.pathname}`).toBe(ENV.OAUTH_AUTHORIZATION_URL);
    const q = location.searchParams;
    expect(q.get('client_id')).toBe(ENV.OAUTH_CLIENT_ID);
    expect(q.get('response_type')).toBe('code');
    expect(q.get('redirect_uri')).toBe(`${ORIGIN}/api/auth/callback`);
    expect(q.get('scope')).toBe('openid email profile');
    expect(q.get('code_challenge_method')).toBe('S256');
    expect(q.has('client_secret')).toBe(false);

    const setCookie = response.headers.get('set-cookie')!;
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=lax/i);
    const flow = engine.decodeFlowState(flowCookieOf(response))!;
    expect(q.get('state')).toBe(flow.state);
    expect(q.get('nonce')).toBe(sha256hex(flow.nonce));
    expect(q.get('nonce')).not.toBe(flow.nonce);
    expect(q.get('code_challenge')).toBe(crypto.createHash('sha256').update(flow.codeVerifier).digest('base64url'));
    expect(flow.returnTo).toBe('/orders');
  });

  test('accepts only my-apps', async () => {
    const response = await start('google');
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: 'unsupported_provider' });
  });

  test('names the missing variables, never their values', async () => {
    vi.stubEnv('OAUTH_CLIENT_SECRET', '');
    vi.stubEnv('NEXT_PUBLIC_BUILDPAD_TENANT_ID', '');
    const response = await start();
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.message).toContain('OAUTH_CLIENT_SECRET');
    expect(body.message).toContain('NEXT_PUBLIC_BUILDPAD_TENANT_ID');
    expect(JSON.stringify(body)).not.toContain(ENV.OAUTH_CLIENT_ID);
  });

  test('an absolute returnTo is not kept (no open redirect)', async () => {
    const response = await start('my-apps', '?returnTo=https://evil.example');
    expect(engine.decodeFlowState(flowCookieOf(response))!.returnTo).toBe('/');
  });
});

describe('GET /api/auth/callback (Engine)', () => {
  test('exchanges the code server-side and signs in to the Engine with the ID token and the raw nonce', async () => {
    const { cookie, flow } = await started();

    const response = await callback(`?code=the-code&state=${flow.state}`, cookie);

    // Code exchange at My Apps, with the secret and the PKCE verifier.
    const [tokenUrl, tokenInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(tokenUrl).toBe(ENV.OAUTH_TOKEN_URL);
    const form = new URLSearchParams(tokenInit.body as string);
    expect(form.get('grant_type')).toBe('authorization_code');
    expect(form.get('code')).toBe('the-code');
    expect(form.get('client_secret')).toBe(ENV.OAUTH_CLIENT_SECRET);
    expect(form.get('code_verifier')).toBe(flow.codeVerifier);
    expect(form.get('redirect_uri')).toBe(`${ORIGIN}/api/auth/callback`);

    // The Engine sign-in: its URL (no trailing slash), the public value, X-Tenant-Id.
    expect(clientArgs[0]).toBe('https://engine.test');
    expect(clientArgs[1]).toBe(ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    expect(clientOptions?.global?.headers).toEqual({ 'X-Tenant-Id': ENV.NEXT_PUBLIC_BUILDPAD_TENANT_ID });
    expect(auth.signInWithIdToken).toHaveBeenCalledWith({ provider: 'my-apps', token: ID_TOKEN, nonce: flow.nonce });

    // The secret goes to My Apps only, never to the Engine.
    for (const [url, init] of fetchMock.mock.calls as [string, RequestInit | undefined][]) {
      if (url.startsWith('https://engine.test')) expect(JSON.stringify(init ?? {})).not.toContain(ENV.OAUTH_CLIENT_SECRET);
    }

    // Role check with the Engine session, then the session cookies and returnTo.
    expect(fetchMock.mock.calls[1][0]).toBe('https://engine.test/api/users/me');
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(`${ORIGIN}/orders`);
    const setCookie = response.headers.get('set-cookie')!;
    expect(setCookie).toContain('sb-engine-auth-token=session-cookie');
    expect(setCookie).toMatch(new RegExp(`${engine.ENGINE_FLOW_COOKIE}=;[^,]*Max-Age=0`, 'i'));
    expect(auth.signOut).not.toHaveBeenCalled();
    expectNothingSecretLogged();
  });

  test('an account with no role yet is sent to the pending-access page, its session ended and no cookie set', async () => {
    meAnswer = { status: 200, body: { data: { id: 'u1', roles: [], admin_access: false } } };
    const { cookie, flow } = await started();

    const response = await callback(`?code=c&state=${flow.state}`, cookie);

    expect(response.headers.get('location')).toBe(`${ORIGIN}/auth/pending-access`);
    expect(auth.signOut).toHaveBeenCalledTimes(1);
    expect(response.headers.get('set-cookie')).not.toContain('sb-engine-auth-token');
    expectNothingSecretLogged();
  });

  test('keeps the session when the role check cannot be made', async () => {
    meAnswer = { status: 502, body: {} };
    const { cookie, flow } = await started();

    const response = await callback(`?code=c&state=${flow.state}`, cookie);

    expect(response.headers.get('location')).toBe(`${ORIGIN}/orders`);
    expect(response.headers.get('set-cookie')).toContain('sb-engine-auth-token');
  });

  test.each([
    [{ status: 400, code: 'invalid_credentials', message: 'Invalid login credentials' }, 'sign_in_refused'],
    [{ status: 400, code: 'user_banned', message: 'User is banned' }, 'account_disabled'],
    [{ status: 503, code: 'unexpected_failure', message: 'unavailable' }, 'engine_unavailable'],
  ])('an Engine refusal %o reads as %s, with no session cookie', async (error, code) => {
    auth.signInWithIdToken.mockResolvedValueOnce({ data: { session: null, user: null }, error });
    const { cookie, flow } = await started();

    const response = await callback(`?code=c&state=${flow.state}`, cookie);

    expect(response.headers.get('location')).toBe(`${ORIGIN}/login?error=${code}`);
    expect(response.headers.get('set-cookie')).not.toContain('sb-engine-auth-token');
    expect(response.headers.get('set-cookie')).toMatch(new RegExp(`${engine.ENGINE_FLOW_COOKIE}=;`));
    expectNothingSecretLogged();
  });

  test('a state that does not match stops before the code exchange', async () => {
    const { cookie } = await started();

    const response = await callback('?code=c&state=forged', cookie);

    expect(response.headers.get('location')).toBe(`${ORIGIN}/login?error=sign_in_failed`);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(auth.signInWithIdToken).not.toHaveBeenCalled();
  });

  test('no flow cookie (expired, or another browser) reads as sign_in_expired', async () => {
    const response = await callback('?code=c&state=s');
    expect(response.headers.get('location')).toBe(`${ORIGIN}/login?error=sign_in_expired`);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('a cancelled sign-in at My Apps', async () => {
    const { cookie } = await started();
    const response = await callback('?error=access_denied&error_description=User%20cancelled', cookie);
    expect(response.headers.get('location')).toBe(`${ORIGIN}/login?error=sign_in_cancelled`);
  });

  test('a failed code exchange, or one without an ID token, never reaches the Engine', async () => {
    tokenAnswer = { status: 400, body: { error: 'invalid_grant' } };
    let { cookie, flow } = await started();
    expect((await callback(`?code=c&state=${flow.state}`, cookie)).headers.get('location')).toBe(
      `${ORIGIN}/login?error=sign_in_failed`
    );

    tokenAnswer = { status: 200, body: { access_token: 'idp-access' } };
    ({ cookie, flow } = await started());
    expect((await callback(`?code=c&state=${flow.state}`, cookie)).headers.get('location')).toBe(
      `${ORIGIN}/login?error=sign_in_failed`
    );
    expect(auth.signInWithIdToken).not.toHaveBeenCalled();
    expectNothingSecretLogged();
  });
});
