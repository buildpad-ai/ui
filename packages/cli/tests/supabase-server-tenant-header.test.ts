/**
 * `lib/supabase/server.ts` and the password login route, run as the app runs
 * them.
 *
 * The templates are imported from `templates/` with `@supabase/ssr` and
 * `next/headers` replaced by fakes, so each test sees the options the server
 * client is created with and the sign-in the login route makes through it.
 * On an Engine project (`NEXT_PUBLIC_BUILDPAD_TENANT_ID` set) every request
 * names the tenant in `X-Tenant-Id`; on a Supabase project (unset) the
 * options are the ones the template always passed.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { NextRequest } from 'next/server';

const fake = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  cookieStore: {
    getAll: vi.fn(() => [{ name: 'sb-test-auth-token', value: 'v' }]),
    set: vi.fn(),
  },
}));

vi.mock('@supabase/ssr', () => ({ createServerClient: fake.createServerClient }));
vi.mock('next/headers', () => ({ cookies: async () => fake.cookieStore }));
vi.mock('@/lib/supabase/server', async () => import('../templates/supabase/server'));

const { createClient } = await import('../templates/supabase/server');
const loginRoute = await import('../templates/api/auth-login-route');

const URL_ = 'https://engine.test';
const ANON = 'public-anon-key';
const TENANT = '11111111-2222-3333-4444-555555555555';

let signInWithPassword: ReturnType<typeof vi.fn>;

type ClientOptions = {
  global?: { headers?: Record<string, string> };
  cookies: { getAll(): unknown; setAll(c: unknown[]): void };
};
const lastOptions = (): ClientOptions =>
  fake.createServerClient.mock.calls.at(-1)?.[2] as ClientOptions;

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', URL_);
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', ANON);
  vi.stubEnv('NEXT_PUBLIC_BUILDPAD_TENANT_ID', '');
  signInWithPassword = vi.fn(async () => ({
    data: { user: { id: 'u1' }, session: { access_token: 'at', expires_at: 123 } },
    error: null,
  }));
  fake.createServerClient.mockReset();
  fake.createServerClient.mockImplementation(() => ({ auth: { signInWithPassword } }));
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function loginRequest(body: unknown) {
  return new NextRequest('http://localhost:3000/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

describe('lib/supabase/server createClient', () => {
  test('an Engine project sends X-Tenant-Id on every request', async () => {
    vi.stubEnv('NEXT_PUBLIC_BUILDPAD_TENANT_ID', TENANT);
    await createClient();

    expect(fake.createServerClient).toHaveBeenCalledTimes(1);
    const [url, key, options] = fake.createServerClient.mock.calls[0];
    expect(url).toBe(URL_);
    expect(key).toBe(ANON);
    expect((options as ClientOptions).global).toEqual({ headers: { 'X-Tenant-Id': TENANT } });
  });

  test('a Supabase project (no tenant id) gets the options it always had', async () => {
    await createClient();

    const options = lastOptions();
    expect(Object.keys(options)).toEqual(['cookies']);
    expect(options).not.toHaveProperty('global');
  });

  test('the env var absent altogether is the same as empty', async () => {
    delete process.env.NEXT_PUBLIC_BUILDPAD_TENANT_ID;
    await createClient();
    expect(Object.keys(lastOptions())).toEqual(['cookies']);
  });

  test('cookies still read from and write to the Next cookie store', async () => {
    vi.stubEnv('NEXT_PUBLIC_BUILDPAD_TENANT_ID', TENANT);
    await createClient();
    const { cookies } = lastOptions();

    expect(cookies.getAll()).toEqual([{ name: 'sb-test-auth-token', value: 'v' }]);
    cookies.setAll([{ name: 'a', value: 'b', options: { path: '/' } }]);
    expect(fake.cookieStore.set).toHaveBeenCalledWith('a', 'b', { path: '/' });
  });

  test('missing Supabase URL or key still throws', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    await expect(createClient()).rejects.toThrow(/Missing Supabase environment variables/);
  });
});

describe('POST /api/auth/login', () => {
  test('an Engine project signs in on a client that names the tenant', async () => {
    vi.stubEnv('NEXT_PUBLIC_BUILDPAD_TENANT_ID', TENANT);
    const res = await loginRoute.POST(loginRequest({ email: 'a@b.test', password: 'pw' }));

    expect(res.status).toBe(200);
    expect(lastOptions().global?.headers).toEqual({ 'X-Tenant-Id': TENANT });
    expect(signInWithPassword).toHaveBeenCalledWith({ email: 'a@b.test', password: 'pw' });
    const body = await res.json();
    expect(body.data.session).toEqual({ access_token: 'at', expires_at: 123 });
  });

  test('a Supabase project signs in without the header', async () => {
    const res = await loginRoute.POST(loginRequest({ email: 'a@b.test', password: 'pw' }));

    expect(res.status).toBe(200);
    expect(lastOptions()).not.toHaveProperty('global');
    expect(signInWithPassword).toHaveBeenCalledWith({ email: 'a@b.test', password: 'pw' });
  });

  test('a refused sign-in is 401 with the Engine message', async () => {
    vi.stubEnv('NEXT_PUBLIC_BUILDPAD_TENANT_ID', TENANT);
    signInWithPassword.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { message: 'Invalid login credentials' },
    });
    const res = await loginRoute.POST(loginRequest({ email: 'a@b.test', password: 'bad' }));

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ errors: [{ message: 'Invalid login credentials' }] });
  });

  test('missing credentials are 400 and create no client', async () => {
    const res = await loginRoute.POST(loginRequest({ email: 'a@b.test' }));
    expect(res.status).toBe(400);
    expect(fake.createServerClient).not.toHaveBeenCalled();
  });
});
