/**
 * The external-oauth-engine-customers templates, run as the app would run them.
 *
 * On an Engine project with customer tenants, XAppHub sign-in signs a person
 * in to the customer whose host the request came to. `@/lib/customer-hosts`
 * is replaced by a map with one customer (acme) on `lms.apps.buildpad.ai`;
 * the other `@/` imports point at the sibling templates and `@supabase/ssr`
 * at a fake client, so each test drives the start route or the callback and
 * reads the `redirect_uri` and the `X-Tenant-Id` they produce.
 *
 * The scope mode (and a project without the `tenancy` member) installs
 * external-oauth-engine, whose files this change leaves as they were: the
 * last block pins its registry entry.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { libForBackend } from '../src/utils/project-backend.js';
import type { Registry } from '../src/resolver.js';

const fake = vi.hoisted(() => ({
  createServerClient: vi.fn(),
}));

const ACME_TENANT = 'aaaaaaaa-0000-4000-8000-000000000001';
const BLUEPRINT_TENANT = '11111111-2222-3333-4444-555555555555';

vi.mock('@supabase/ssr', () => ({ createServerClient: fake.createServerClient }));
vi.mock('@/lib/customer-hosts', () => ({
  CUSTOMER_HOST_SUFFIX: 'lms.apps.buildpad.ai',
  CUSTOMER_HOSTS: {
    acme: { tenantId: 'aaaaaaaa-0000-4000-8000-000000000001', name: 'Acme' },
  },
}));
vi.mock('@/lib/oauth/config', async () => import('../templates/lib/oauth/config'));
vi.mock('@/lib/oauth/engine', async () => import('../templates/lib/oauth/engine'));
vi.mock('@/lib/oauth/tenant', async () => import('../templates/lib/oauth/tenant'));
vi.mock('@/lib/origin', async () => import('../templates/lib/origin'));

const engine = await import('../templates/lib/oauth/engine');
const tenant = await import('../templates/lib/oauth/tenant');
const providerRoute = await import('../templates/api/auth-oauth-provider-engine-customers-route');
const callbackRoute = await import('../templates/api/auth-callback-oauth-engine-customers-route');

const ENV = {
  OAUTH_CLIENT_ID: 'client-123',
  OAUTH_CLIENT_SECRET: 'super-secret-value',
  OAUTH_AUTHORIZATION_URL: 'https://idp.test/api/idp/authorize',
  OAUTH_TOKEN_URL: 'https://idp.test/api/idp/token',
  NEXT_PUBLIC_SUPABASE_URL: 'https://engine.test/',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'buildpad-engine-public-anon-key',
  NEXT_PUBLIC_BUILDPAD_TENANT_ID: BLUEPRINT_TENANT,
};
const ID_TOKEN = 'header.payload-with-claims.signature';
/** The process behind the proxy; the host the browser used comes in a header. */
const PROCESS = 'http://localhost:3000';
const ACME = 'https://acme.lms.apps.buildpad.ai';
const BARE = 'https://lms.apps.buildpad.ai';

const sha256hex = (v: string) => crypto.createHash('sha256').update(v).digest('hex');
const headersOf = (init: Record<string, string>) => new Headers(init);

let clientOptions: { global?: { headers?: Record<string, string> }; cookies: { setAll: (c: unknown[]) => void } };
let signInWithIdToken: ReturnType<typeof vi.fn>;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v);
  vi.stubEnv('HOST_ORIGIN', '');
  vi.stubEnv('NEXT_PUBLIC_HOST_ORIGIN', '');

  signInWithIdToken = vi.fn(async () => {
    clientOptions.cookies.setAll([{ name: 'sb-engine-auth-token', value: 'session-cookie', options: { path: '/' } }]);
    return { data: { session: { access_token: 'engine-access-token' } }, error: null };
  });
  fake.createServerClient.mockImplementation((...args: unknown[]) => {
    clientOptions = args[2] as typeof clientOptions;
    return { auth: { signInWithIdToken, signOut: vi.fn(async () => ({ error: null })) } };
  });

  fetchMock = vi.fn(async (url: string) => {
    const body =
      url === ENV.OAUTH_TOKEN_URL
        ? { id_token: ID_TOKEN }
        : url === 'https://engine.test/api/users/me'
          ? { data: { roles: [{ role_id: 'r1' }], admin_access: false } }
          : null;
    if (!body) throw new Error(`unexpected fetch ${url}`);
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  vi.stubGlobal('fetch', fetchMock);
  for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const) {
    vi.spyOn(console, level).mockImplementation(() => {});
  }
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  fake.createServerClient.mockReset();
});

/** A request the proxy forwarded for `host` (as Amplify / CloudFront do). */
function forwarded(pathAndQuery: string, host: string | null, extra: Record<string, string> = {}) {
  const headers: Record<string, string> = { ...extra };
  if (host) {
    headers['x-forwarded-host'] = host;
    headers['x-forwarded-proto'] = 'https';
  }
  return new NextRequest(`${PROCESS}${pathAndQuery}`, { headers });
}

async function start(host: string | null, query = '?returnTo=/courses') {
  return providerRoute.GET(forwarded(`/api/auth/oauth/my-apps${query}`, host), {
    params: Promise.resolve({ provider: 'my-apps' }),
  });
}

function flowCookieOf(response: Response): string {
  const match = (response.headers.get('set-cookie') ?? '').match(new RegExp(`${engine.ENGINE_FLOW_COOKIE}=([^;]*)`));
  if (!match) throw new Error('no flow cookie');
  return match[1];
}

async function callback(host: string | null, query: string, cookie?: string) {
  return callbackRoute.GET(
    forwarded(`/api/auth/callback${query}`, host, cookie ? { cookie: `${engine.ENGINE_FLOW_COOKIE}=${cookie}` } : {})
  );
}

/** Starts a sign-in at `host` and finishes it at `callbackHost` (the same host unless given). */
async function signIn(host: string | null, callbackHost: string | null = host, extraQuery = '') {
  const started = await start(host);
  const cookie = flowCookieOf(started);
  const flow = engine.decodeFlowState(cookie)!;
  const response = await callback(callbackHost, `?code=the-code&state=${flow.state}${extraQuery}`, cookie);
  return { started, response, flow };
}

const tenantHeader = () => clientOptions?.global?.headers?.['X-Tenant-Id'];

describe('lib/oauth/tenant: tenantForRequest', () => {
  test.each([
    ['acme.lms.apps.buildpad.ai', { kind: 'customer', slug: 'acme', tenantId: ACME_TENANT }],
    ['ACME.LMS.Apps.BuildPad.AI', { kind: 'customer', slug: 'acme', tenantId: ACME_TENANT }],
    ['acme.lms.apps.buildpad.ai:443', { kind: 'customer', slug: 'acme', tenantId: ACME_TENANT }],
    ['globex.lms.apps.buildpad.ai', { kind: 'unknown', slug: 'globex' }],
    ['lms.apps.buildpad.ai', { kind: 'bare' }],
    ['a.acme.lms.apps.buildpad.ai', { kind: 'bare' }],
    ['evil-lms.apps.buildpad.ai', { kind: 'bare' }],
    ['acme.lms.apps.buildpad.ai.evil.com', { kind: 'bare' }],
    ['acme.lms.apps.buildpad.ai.', { kind: 'bare' }],
    ['main.d3b262p2aahkl5.amplifyapp.com', { kind: 'bare' }],
    ['localhost:3000', { kind: 'bare' }],
    ['[::1]:3000', { kind: 'bare' }],
  ])('host %s', (host, expected) => {
    expect(tenant.tenantForRequest(headersOf({ host }))).toEqual(expected);
  });

  test('the first x-forwarded-host entry wins over host', () => {
    const headers = headersOf({
      'x-forwarded-host': 'acme.lms.apps.buildpad.ai, internal.amplify',
      host: 'localhost:3000',
    });
    expect(tenant.tenantForRequest(headers)).toMatchObject({ kind: 'customer', tenantId: ACME_TENANT });
  });

  test('no host header at all is the bare host', () => {
    expect(tenant.tenantForRequest(headersOf({}))).toEqual({ kind: 'bare' });
  });

  test('<slug>.localhost stands for the customer host in development only', () => {
    expect(tenant.tenantForRequest(headersOf({ host: 'acme.localhost:3000' }))).toMatchObject({ kind: 'customer' });
    expect(tenant.tenantForRequest(headersOf({ host: 'globex.localhost:3000' }))).toEqual({ kind: 'unknown', slug: 'globex' });
    vi.stubEnv('NODE_ENV', 'production');
    expect(tenant.tenantForRequest(headersOf({ host: 'acme.localhost:3000' }))).toEqual({ kind: 'bare' });
  });

  test('a slug that is an Object.prototype member is not a customer', () => {
    expect(tenant.tenantForRequest(headersOf({ host: 'constructor.lms.apps.buildpad.ai' }))).toEqual({
      kind: 'unknown',
      slug: 'constructor',
    });
  });

  test('the generated, empty map makes every host bare outside development', async () => {
    vi.resetModules();
    vi.doMock('@/lib/customer-hosts', async () => import('../templates/lib/customer-hosts'));
    try {
      const fresh = await import('../templates/lib/oauth/tenant');
      expect(fresh.tenantForRequest(headersOf({ host: 'acme.lms.apps.buildpad.ai' }))).toEqual({ kind: 'bare' });
      expect(fresh.tenantForRequest(headersOf({ host: 'localhost:3000' }))).toEqual({ kind: 'bare' });
    } finally {
      vi.doUnmock('@/lib/customer-hosts');
      vi.resetModules();
    }
  });
});

describe('GET /api/auth/oauth/[provider] (Engine, customer tenants)', () => {
  test('an unknown customer host answers 404 before any redirect, cookie or configuration check', async () => {
    vi.stubEnv('OAUTH_CLIENT_SECRET', '');
    const response = await start('globex.lms.apps.buildpad.ai');

    expect(response.status).toBe(404);
    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(await response.json()).toMatchObject({ error: 'unknown_customer_host' });
  });

  test('a customer host gets redirect_uri on its own origin, and the tenant goes nowhere in the request', async () => {
    const response = await start('acme.lms.apps.buildpad.ai');

    expect(response.status).toBe(307);
    const q = new URL(response.headers.get('location')!).searchParams;
    expect(q.get('redirect_uri')).toBe(`${ACME}/api/auth/callback`);
    const flow = engine.decodeFlowState(flowCookieOf(response))!;
    expect(q.get('nonce')).toBe(sha256hex(flow.nonce));
    // Not in state, the authorize URL or the flow cookie: the callback resolves the host again.
    expect(response.headers.get('location')).not.toContain(ACME_TENANT);
    expect(JSON.stringify(flow)).not.toContain(ACME_TENANT);
  });

  test('a customer origin uses the checked host name, never the forwarded port or protocol', async () => {
    const request = new NextRequest(`${PROCESS}/api/auth/oauth/my-apps`, {
      headers: { 'x-forwarded-host': 'ACME.lms.apps.buildpad.ai:8443', 'x-forwarded-proto': 'http' },
    });
    const response = await providerRoute.GET(request, { params: Promise.resolve({ provider: 'my-apps' }) });
    expect(new URL(response.headers.get('location')!).searchParams.get('redirect_uri')).toBe(`${ACME}/api/auth/callback`);
  });

  test('NEXT_PUBLIC_HOST_ORIGIN (the bare host) does not override a customer host', async () => {
    vi.stubEnv('NEXT_PUBLIC_HOST_ORIGIN', BARE);
    const atAcme = await start('acme.lms.apps.buildpad.ai');
    expect(new URL(atAcme.headers.get('location')!).searchParams.get('redirect_uri')).toBe(`${ACME}/api/auth/callback`);

    const atBare = await start('lms.apps.buildpad.ai');
    expect(new URL(atBare.headers.get('location')!).searchParams.get('redirect_uri')).toBe(`${BARE}/api/auth/callback`);
  });

  test('<slug>.localhost:<port> keeps its port and protocol in development', async () => {
    const request = new NextRequest('http://acme.localhost:3000/api/auth/oauth/my-apps');
    const response = await providerRoute.GET(request, { params: Promise.resolve({ provider: 'my-apps' }) });
    expect(new URL(response.headers.get('location')!).searchParams.get('redirect_uri')).toBe(
      'http://acme.localhost:3000/api/auth/callback'
    );
  });

  test('accepts only my-apps, as before', async () => {
    const response = await providerRoute.GET(forwarded('/api/auth/oauth/google', 'acme.lms.apps.buildpad.ai'), {
      params: Promise.resolve({ provider: 'google' }),
    });
    expect(response.status).toBe(400);
  });
});

describe('GET /api/auth/callback (Engine, customer tenants)', () => {
  test('a customer host signs in to that customer: X-Tenant-Id is its tenant id, on its own origin', async () => {
    const { response, flow } = await signIn('acme.lms.apps.buildpad.ai');

    expect(tenantHeader()).toBe(ACME_TENANT);
    expect(signInWithIdToken).toHaveBeenCalledWith({ provider: 'my-apps', token: ID_TOKEN, nonce: flow.nonce });
    const form = new URLSearchParams((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(form.get('redirect_uri')).toBe(`${ACME}/api/auth/callback`);
    expect(response.headers.get('location')).toBe(`${ACME}/courses`);
    expect(response.headers.get('set-cookie')).toContain('sb-engine-auth-token=session-cookie');
  });

  test('the bare host signs in to the Blueprint (NEXT_PUBLIC_BUILDPAD_TENANT_ID), as before', async () => {
    const { response } = await signIn('lms.apps.buildpad.ai');

    expect(tenantHeader()).toBe(BLUEPRINT_TENANT);
    expect(response.headers.get('location')).toBe(`${BARE}/courses`);
  });

  test('localhost with no forwarded host is the bare host', async () => {
    const { response } = await signIn(null);
    expect(tenantHeader()).toBe(BLUEPRINT_TENANT);
    expect(response.headers.get('location')).toBe(`${PROCESS}/courses`);
  });

  test('an unknown customer host answers 404 and never reaches XAppHub or the Engine', async () => {
    const cookie = flowCookieOf(await start('acme.lms.apps.buildpad.ai'));
    const flow = engine.decodeFlowState(cookie)!;

    const response = await callback('globex.lms.apps.buildpad.ai', `?code=c&state=${flow.state}`, cookie);

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: 'unknown_customer_host' });
    expect(response.headers.get('set-cookie')).toMatch(new RegExp(`${engine.ENGINE_FLOW_COOKIE}=;[^,]*Max-Age=0`, 'i'));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(fake.createServerClient).not.toHaveBeenCalled();
  });

  test('nothing in the query or state names the tenant', async () => {
    await signIn('lms.apps.buildpad.ai', 'lms.apps.buildpad.ai', `&tenant=${ACME_TENANT}&tenantId=${ACME_TENANT}&slug=acme`);
    expect(tenantHeader()).toBe(BLUEPRINT_TENANT);
  });

  test('the callback resolves its own host: a sign-in started at the bare host and finished at acme targets acme', async () => {
    // The redirect_uri differs, so XAppHub would refuse the exchange; the
    // tenant still never comes from where the flow began.
    await signIn('lms.apps.buildpad.ai', 'acme.lms.apps.buildpad.ai');
    expect(tenantHeader()).toBe(ACME_TENANT);
  });

  test('errors stay on the customer host', async () => {
    const response = await callback('acme.lms.apps.buildpad.ai', '?code=c&state=s');
    expect(response.headers.get('location')).toBe(`${ACME}/login?error=sign_in_expired`);
  });
});

describe('the scope mode is unchanged', () => {
  const registry = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../../registry.json'), 'utf8')
  ) as Registry;

  test('external-oauth-engine still installs exactly the files it did, with the same sources', () => {
    const mod = registry.lib['external-oauth-engine'];
    expect(mod.files?.map(f => [f.source, f.target])).toEqual([
      ['cli/templates/lib/oauth/config.ts', 'lib/oauth/config.ts'],
      ['cli/templates/lib/oauth/pkce.ts', 'lib/oauth/pkce.ts'],
      ['cli/templates/lib/oauth/validate.ts', 'lib/oauth/validate.ts'],
      ['cli/templates/lib/oauth/index.ts', 'lib/oauth/index.ts'],
      ['cli/templates/lib/oauth/engine.ts', 'lib/oauth/engine.ts'],
      ['cli/templates/api/auth-callback-oauth-engine-route.ts', 'app/api/auth/callback/route.ts'],
      ['cli/templates/api/auth-oauth-provider-engine-route.ts', 'app/api/auth/oauth/[provider]/route.ts'],
      ['cli/templates/components/auth/OAuthLoginButtonsEngine.tsx', 'components/auth/OAuthLoginButtons.tsx'],
      ['cli/templates/app/auth-pending-access-page.tsx', 'app/[lang]/auth/pending-access/page.tsx'],
    ]);
    // The scope routes neither import the resolver nor read the host for a tenant.
    for (const source of ['auth-callback-oauth-engine-route.ts', 'auth-oauth-provider-engine-route.ts']) {
      const text = fs.readFileSync(path.join(__dirname, '../templates/api', source), 'utf8');
      expect(text).not.toContain('@/lib/oauth/tenant');
      expect(text).not.toContain('customer-hosts');
    }
  });

  test('scope and a missing tenancy pick external-oauth-engine; customer-tenants picks the customers variant', () => {
    expect(libForBackend('external-oauth', registry, 'engine', 'scope')).toBe('external-oauth-engine');
    expect(libForBackend('external-oauth', registry, 'engine', null)).toBe('external-oauth-engine');
    expect(libForBackend('external-oauth', registry, 'engine', 'customer-tenants')).toBe('external-oauth-engine-customers');
    expect(libForBackend('external-oauth-engine', registry, 'engine', 'customer-tenants')).toBe('external-oauth-engine-customers');
    // A Supabase project never gets it, whatever the file says.
    expect(libForBackend('external-oauth', registry, 'supabase', 'customer-tenants')).toBe('external-oauth');
  });

  test('the customers variant ships every target of external-oauth-engine (so it supersedes it), plus the resolver and the map', () => {
    const scope = registry.lib['external-oauth-engine'].files!.map(f => f.target);
    const customers = registry.lib['external-oauth-engine-customers'];
    const targets = customers.files!.map(f => f.target);
    expect(targets).toEqual(expect.arrayContaining(scope));
    expect(targets.filter(t => !scope.includes(t))).toEqual(['lib/oauth/tenant.ts', 'lib/customer-hosts.ts']);
    expect(customers.replaces).toContain('external-oauth-engine');
    expect(customers.files!.find(f => f.target === 'lib/customer-hosts.ts')?.adoptOnce).toBe(true);
  });
});
