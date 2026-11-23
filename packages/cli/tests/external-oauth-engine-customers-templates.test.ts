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
 * The real `lib/customer-hosts.ts` reads the server variable
 * `BUILDPAD_CUSTOMER_HOSTS` when it loads; its block re-imports it with the
 * variable stubbed.
 *
 * The scope mode (and a project without the `tenancy` member) installs
 * external-oauth-engine, whose files this change leaves as they were: the
 * last block pins its registry entry and its sources' bytes.
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

describe('lib/customer-hosts: the map is the server variable BUILDPAD_CUSTOMER_HOSTS', () => {
  const GLOBEX_TENANT = 'bbbbbbbb-0000-4000-8000-000000000002';
  type HostsModule = typeof import('../templates/lib/customer-hosts');

  /** The template as the server loads it, with `raw` as the variable (undefined: unset). */
  async function load(raw: string | undefined): Promise<HostsModule> {
    vi.resetModules();
    if (raw === undefined) delete process.env.BUILDPAD_CUSTOMER_HOSTS;
    else vi.stubEnv('BUILDPAD_CUSTOMER_HOSTS', raw);
    return import('../templates/lib/customer-hosts');
  }
  const warnings = () => (console.warn as unknown as ReturnType<typeof vi.fn>).mock.calls.map(c => c.join(' '));

  afterEach(() => {
    delete process.env.BUILDPAD_CUSTOMER_HOSTS;
    vi.resetModules();
  });

  test('parses a map: slug → tenant id, keys lower-cased', async () => {
    const hosts = await load(JSON.stringify({ acme: ACME_TENANT, Globex: GLOBEX_TENANT }));

    expect(hosts.tenantIdForSlug('acme')).toBe(ACME_TENANT);
    expect(hosts.tenantIdForSlug('ACME')).toBe(ACME_TENANT);
    expect(hosts.tenantIdForSlug('globex')).toBe(GLOBEX_TENANT);
    expect(hosts.tenantIdForSlug('initech')).toBeNull();
    expect(hosts.CUSTOMER_HOSTS).toEqual({
      acme: { tenantId: ACME_TENANT, name: 'acme' },
      globex: { tenantId: GLOBEX_TENANT, name: 'globex' },
    });
    expect(warnings()).toEqual([]);
  });

  test('drops a key that is not one DNS label, and a value that is not a non-empty string', async () => {
    const { parseCustomerHosts } = await load(undefined);
    const map = parseCustomerHosts(
      JSON.stringify({
        acme: ACME_TENANT,
        'a.b': 't',
        '-acme': 't',
        'acme-': 't',
        under_score: 't',
        '': 't',
        [`a${'b'.repeat(63)}`]: 't',
        'xn--bcher-kva': GLOBEX_TENANT,
        number: 42,
        nothing: null,
        object: { tenantId: 't' },
        list: ['t'],
        empty: '',
        blank: '   ',
      })
    );
    expect({ ...map }).toEqual({ acme: ACME_TENANT, 'xn--bcher-kva': GLOBEX_TENANT });
  });

  test('a slug that is an Object.prototype member, or __proto__, is never a customer', async () => {
    const hosts = await load('{"__proto__": {"polluted": "yes"}, "acme": "' + ACME_TENANT + '"}');
    expect(hosts.tenantIdForSlug('constructor')).toBeNull();
    expect(hosts.tenantIdForSlug('__proto__')).toBeNull();
    expect(hosts.tenantIdForSlug('toString')).toBeNull();
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  test.each([
    ['missing', undefined, 'is not set'],
    ['empty', '', 'is not set'],
    ['blank', '   ', 'is not set'],
    ['not JSON', '{acme: secret-tenant}', 'is not JSON'],
    ['an array', '["secret-tenant"]', 'is not a JSON object'],
    ['a string', '"secret-tenant"', 'is not a JSON object'],
    ['null', 'null', 'is not a JSON object'],
  ])('a value that is %s is the empty map, logged once without the value', async (_label, raw, reason) => {
    const hosts = await load(raw);

    expect(hosts.tenantIdForSlug('acme')).toBeNull();
    expect(hosts.CUSTOMER_HOSTS).toEqual({});
    // The same reason again (a second parse) is not logged again.
    expect({ ...hosts.parseCustomerHosts(raw) }).toEqual({});
    expect(warnings()).toHaveLength(1);
    expect(warnings()[0]).toContain('BUILDPAD_CUSTOMER_HOSTS');
    expect(warnings()[0]).toContain(reason);
    expect(warnings()[0]).not.toContain('secret-tenant');
  });

  test('the variable is read once, when the module loads', async () => {
    const hosts = await load(JSON.stringify({ acme: ACME_TENANT }));
    vi.stubEnv('BUILDPAD_CUSTOMER_HOSTS', JSON.stringify({ acme: GLOBEX_TENANT }));
    expect(hosts.tenantIdForSlug('acme')).toBe(ACME_TENANT);
  });

  test('lib/oauth/tenant serves the customers the variable names', async () => {
    vi.resetModules();
    vi.stubEnv('BUILDPAD_CUSTOMER_HOSTS', JSON.stringify({ acme: ACME_TENANT }));
    vi.doMock('@/lib/customer-hosts', async () => import('../templates/lib/customer-hosts'));
    try {
      const fresh = await import('../templates/lib/oauth/tenant');
      // The generated suffix is empty, so <slug>.localhost (development) is the customer host.
      expect(fresh.tenantForRequest(headersOf({ host: 'acme.localhost:3000' }))).toEqual({
        kind: 'customer',
        slug: 'acme',
        tenantId: ACME_TENANT,
      });
      expect(fresh.tenantForRequest(headersOf({ host: 'globex.localhost:3000' }))).toEqual({ kind: 'unknown', slug: 'globex' });
    } finally {
      vi.doUnmock('@/lib/customer-hosts');
    }
  });
});

describe('BUILDPAD_CUSTOMER_HOSTS stays on the server', () => {
  const templatesRoot = path.join(__dirname, '../templates');
  const walk = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
      entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]
    );

  test('no template, and no registry entry, names NEXT_PUBLIC_BUILDPAD_CUSTOMER_HOSTS', () => {
    const offenders = walk(templatesRoot).filter(file =>
      fs.readFileSync(file, 'utf8').includes('NEXT_PUBLIC_BUILDPAD_CUSTOMER_HOSTS')
    );
    expect(offenders).toEqual([]);
    for (const file of ['../../registry.json', '../../registry.template.json']) {
      expect(fs.readFileSync(path.join(__dirname, file), 'utf8')).not.toContain('NEXT_PUBLIC_BUILDPAD_CUSTOMER_HOSTS');
    }
  });

  test('the map module reads the plain name and is not a client module', () => {
    const text = fs.readFileSync(path.join(templatesRoot, 'lib/customer-hosts.ts'), 'utf8');
    expect(text).toContain('process.env.BUILDPAD_CUSTOMER_HOSTS');
    expect(text).not.toMatch(/^\s*['"]use client['"]/m);
    // Only the resolver imports it; no component does.
    const importers = walk(templatesRoot).filter(
      file => file !== path.join(templatesRoot, 'lib/customer-hosts.ts') && fs.readFileSync(file, 'utf8').includes('@/lib/customer-hosts')
    );
    expect(importers.map(file => path.relative(templatesRoot, file))).toEqual(['lib/oauth/tenant.ts']);
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

  test("external-oauth-engine's sources are byte-for-byte those of 3.9.0, and it asks for no server variable", () => {
    const PINNED: Record<string, string> = {
      'lib/oauth/config.ts': 'fc29c703f02cc276e38a605e5e85a61eddd953e2f398d6abba594034f7177457',
      'lib/oauth/pkce.ts': '7d3e305b8381791f8aef8bbe0374fea1c63092df8e1192adcae9b4481de9e68c',
      'lib/oauth/validate.ts': '4eb09e0c3426d9472950739b9ce70c2aa374a344f5ea1a21d85b2038cc5b836c',
      'lib/oauth/index.ts': '79ab2ac7632b26fe88715f24ebc88a068e7ed920b6bc9910737dcbd53a9bdeed',
      'lib/oauth/engine.ts': 'a97eb6f6d246503a5aa06e26f061e26eba675eb7071ea5cb1ae1c64cbf02dacb',
      'api/auth-callback-oauth-engine-route.ts': '97dcb7a5311cfc2feac871ccc89f952e366564a7aab1ba0d7eb5d6726ee1a72e',
      'api/auth-oauth-provider-engine-route.ts': '0fa32600e94432776f968651e51f214cca6fcf9ed74247dd66fc4e4f51fd50f1',
      'components/auth/OAuthLoginButtonsEngine.tsx': 'd93472739beacf50672f2798c41bfbb50ba45d5be41234ed99e150b4f4e46e9a',
      'app/auth-pending-access-page.tsx': '17d70ba5223ad9acf5a7689a7a14481f82dfc1a4e319cdaf2f6f9048f1569726',
    };
    const mod = registry.lib['external-oauth-engine'];
    const actual = Object.fromEntries(
      mod.files!.map(f => {
        const rel = f.source.replace(/^cli\/templates\//, '');
        return [rel, crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, '../templates', rel))).digest('hex')];
      })
    );
    expect(actual).toEqual(PINNED);
    expect(mod.serverEnv).toBeUndefined();
  });

  test('the customers variant asks for BUILDPAD_CUSTOMER_HOSTS, a server variable', () => {
    const serverEnv = registry.lib['external-oauth-engine-customers'].serverEnv;
    expect(serverEnv).toEqual(['BUILDPAD_CUSTOMER_HOSTS']);
    expect(serverEnv!.filter(name => name.startsWith('NEXT_PUBLIC_'))).toEqual([]);
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
