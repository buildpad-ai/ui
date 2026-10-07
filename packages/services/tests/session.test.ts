/**
 * session.ts unit tests — authentication decisions.
 *
 * Every path that cannot positively establish an active, known user must
 * DENY (throw AuthenticationError / return the safe default). The tests also
 * pin which Supabase client each path hands out:
 *   - JWT bearer  → anon-key client carrying the caller's JWT (RLS applies)
 *   - static token → service-role client (bypasses RLS) — only after the token
 *                    matched an *active* daas_users row
 *   - cookies     → anon-key server client bound to the cookie store
 *
 * Only the boundary is faked: the client factories, headers and cookie store
 * given to configureAuth() (see ./helpers/fake-supabase).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  AuthenticationError,
  configureAuth,
  createAuthenticatedClient,
  getAccountability,
  getAuthConfig,
  getCurrentUser,
  getUserProfile,
  getUserRole,
  isAdmin,
  isAuthenticationError,
  type User,
} from '../src/auth/session';
import {
  ANON_KEY,
  JWT,
  SERVICE_KEY,
  SUPABASE_URL,
  eqValue,
  fakeAuthEnv,
  type Call,
  type FakeAuthOptions,
  type FakeDbSpec,
  type Result,
} from './helpers/fake-supabase';

const SESSION_USER: User = { id: 'u1', email: 'u1@example.com' };

const STATIC_ROW = {
  id: 's1',
  email: 's1@example.com',
  first_name: 'Static',
  last_name: 'User',
  status: 'active',
  admin_access: false,
};

/** daas_users answering the static-token lookup by `token`, and by `id` otherwise. */
function daasUsers(opts: {
  token?: string;
  tokenResult?: Result;
  byId?: Result;
}): (q: Call[]) => Result {
  return (q) => {
    const token = eqValue(q, 'token');
    if (token !== undefined) {
      if (opts.tokenResult) return opts.tokenResult;
      return token === (opts.token ?? 'static-token')
        ? { data: STATIC_ROW, error: null }
        : { data: null, error: { message: 'JSON object requested, multiple (or no) rows returned' } };
    }
    return opts.byId ?? { data: { admin_access: false }, error: null };
  };
}

function setup(opts: FakeAuthOptions = {}) {
  const env = fakeAuthEnv({
    ...opts,
    db: {
      getUser: { user: SESSION_USER },
      tables: {
        daas_users: daasUsers({}),
        daas_user_roles: { data: { role_id: 'role-1' }, error: null },
      },
      ...opts.db,
    },
  });
  configureAuth(env.config);
  return env;
}

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
});

// ─── Configuration ───────────────────────────────────────────────

describe('configuration', () => {
  it('getAuthConfig throws before configureAuth() is called', async () => {
    vi.resetModules();
    const fresh = await import('../src/auth/session');
    expect(() => fresh.getAuthConfig()).toThrow(/Auth module not configured/);
  });

  it('createAuthenticatedClient rejects before configureAuth() (no client is created)', async () => {
    vi.resetModules();
    const fresh = await import('../src/auth/session');
    await expect(fresh.createAuthenticatedClient()).rejects.toThrow(/not configured/);
    await expect(fresh.getAccountability()).resolves.toBeNull();
  });

  it('configureAuth stores the config returned by getAuthConfig', () => {
    const env = setup();
    expect(getAuthConfig()).toBe(env.config);
  });
});

// ─── JWT bearer tokens ───────────────────────────────────────────

describe('createAuthenticatedClient — JWT bearer', () => {
  it('a valid JWT yields an anon-key client carrying the JWT (never the service role)', async () => {
    const env = setup({ authorization: `Bearer ${JWT}` });
    const { supabase, user } = await createAuthenticatedClient();

    expect(user).toEqual(SESSION_USER);
    expect(env.createClient).toHaveBeenCalledTimes(1);
    expect(env.createClient).toHaveBeenCalledWith(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${JWT}` } },
    });
    expect(supabase).toBe(env.byLabel('anon')[0]);
    expect(env.byLabel('service')).toEqual([]);
    expect(env.createServerClient).not.toHaveBeenCalled();
    expect(env.getCookies).not.toHaveBeenCalled();
  });

  it('a JWT rejected by Supabase with no service key → AuthenticationError', async () => {
    const env = setup({
      authorization: `Bearer ${JWT}`,
      serviceKey: null,
      db: { getUser: { user: null, error: { message: 'invalid JWT' } } },
    });
    await expect(createAuthenticatedClient()).rejects.toBeInstanceOf(AuthenticationError);
    expect(env.byLabel('service')).toEqual([]);
    // A bad bearer token never falls back to the cookie session.
    expect(env.getCookies).not.toHaveBeenCalled();
  });

  it('a JWT whose getUser() returns an error AND a user is still rejected as a JWT', async () => {
    const env = setup({
      authorization: `Bearer ${JWT}`,
      db: {
        getUser: { user: SESSION_USER, error: { message: 'expired' } },
        tables: { daas_users: daasUsers({}) },
      },
    });
    await expect(createAuthenticatedClient()).rejects.toThrow('invalid token');
    // It was then tried as a static token, via the service role.
    expect(eqValue(env.byLabel('service')[0].queries[0], 'token')).toBe(JWT);
  });

  it('a JWT with no user (and no error) falls through to the static-token lookup and is denied', async () => {
    const env = setup({ authorization: `Bearer ${JWT}`, db: { getUser: { user: null } } });
    await expect(createAuthenticatedClient()).rejects.toThrow('Authentication failed: invalid token');
    expect(env.byLabel('anon')).toHaveLength(1);
    expect(env.byLabel('service')).toHaveLength(1);
  });

  it('a JWT-shaped string that is a valid static token authenticates as that static user', async () => {
    const env = setup({
      authorization: `Bearer ${JWT}`,
      db: {
        getUser: { user: null, error: { message: 'invalid JWT' } },
        tables: {
          daas_users: daasUsers({ token: JWT }),
          daas_user_roles: { data: null, error: null },
        },
      },
    });
    const { supabase, user } = await createAuthenticatedClient();
    expect(user.id).toBe('s1');
    expect(supabase).toBe(env.byLabel('service')[0]);
  });

  it('getUser() rejecting propagates (no user is returned)', async () => {
    setup({
      authorization: `Bearer ${JWT}`,
      db: {
        getUser: () => {
          throw new Error('network down');
        },
      },
    });
    await expect(createAuthenticatedClient()).rejects.toThrow('network down');
  });

  it.each([['a.b'], ['a.b.c.d'], ['opaque-token']])(
    'a non-JWT token (%s) skips Supabase Auth and goes straight to the static-token lookup',
    async (token) => {
      const env = setup({ authorization: `Bearer ${token}` });
      await expect(createAuthenticatedClient()).rejects.toThrow('invalid token');
      expect(env.byLabel('anon')).toEqual([]);
      expect(env.byLabel('service')).toHaveLength(1);
    }
  );
});

// ─── Static tokens ───────────────────────────────────────────────

describe('createAuthenticatedClient — static token', () => {
  it('without a service role key → AuthenticationError, no client created, no cookie fallback', async () => {
    const env = setup({ authorization: 'Bearer static-token', serviceKey: null });
    await expect(createAuthenticatedClient()).rejects.toThrow(
      'Static token authentication requires service role key'
    );
    expect(env.createClient).not.toHaveBeenCalled();
    expect(env.getCookies).not.toHaveBeenCalled();
  });

  it('an active user: service-role client (RLS bypass), exact lookup queries, user shape', async () => {
    const env = setup({ authorization: 'Bearer static-token' });
    const { supabase, user } = await createAuthenticatedClient();

    expect(env.createClient).toHaveBeenCalledTimes(1);
    expect(env.createClient).toHaveBeenCalledWith(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const service = env.byLabel('service')[0];
    expect(supabase).toBe(service);
    expect(service.queries).toEqual([
      [
        ['from', 'daas_users'],
        ['select', 'id, email, first_name, last_name, status, admin_access'],
        ['eq', 'token', 'static-token'],
        ['single'],
      ],
      [
        ['from', 'daas_user_roles'],
        ['select', 'role_id'],
        ['eq', 'user_id', 's1'],
        ['order', 'sort', { ascending: true }],
        ['limit', 1],
        ['maybeSingle'],
      ],
    ]);
    expect(user).toEqual({
      id: 's1',
      email: 's1@example.com',
      app_metadata: {},
      user_metadata: { first_name: 'Static', last_name: 'User', role: 'role-1', admin_access: false },
      aud: 'authenticated',
      created_at: '',
    });
    expect(env.createServerClient).not.toHaveBeenCalled();
    expect(env.getCookies).not.toHaveBeenCalled();
  });

  it('the token is passed verbatim as an .eq() value (never interpolated into a filter string)', async () => {
    const token = 'x,token.neq.null)or(id.not.is.null';
    const env = setup({ authorization: `Bearer ${token}` });
    await expect(createAuthenticatedClient()).rejects.toThrow('invalid token');
    expect(env.byLabel('service')[0].queries[0]).toContainEqual(['eq', 'token', token]);
  });

  it('token lookup error → AuthenticationError, no role lookup', async () => {
    const env = setup({
      authorization: 'Bearer static-token',
      db: {
        tables: {
          daas_users: daasUsers({ tokenResult: { data: STATIC_ROW, error: { message: 'boom' } } }),
          daas_user_roles: { data: { role_id: 'role-1' }, error: null },
        },
      },
    });
    await expect(createAuthenticatedClient()).rejects.toThrow('Authentication failed: invalid token');
    expect(env.byLabel('service')[0].tables()).toEqual(['daas_users']);
  });

  it('unknown token (no row) → AuthenticationError', async () => {
    setup({
      authorization: 'Bearer static-token',
      db: {
        tables: {
          daas_users: daasUsers({ tokenResult: { data: null, error: null } }),
          daas_user_roles: { data: null, error: null },
        },
      },
    });
    const err = await createAuthenticatedClient().catch((e) => e);
    expect(err).toBeInstanceOf(AuthenticationError);
    expect(err.message).toBe('Authentication failed: invalid token');
  });

  it.each([['suspended'], ['invited'], ['draft'], ['archived'], ['ACTIVE'], [' active'], [null], [undefined], [true]])(
    'a user with status %j is rejected',
    async (status) => {
      const env = setup({
        authorization: 'Bearer static-token',
        db: {
          tables: {
            daas_users: daasUsers({ tokenResult: { data: { ...STATIC_ROW, status }, error: null } }),
            daas_user_roles: { data: { role_id: 'role-1' }, error: null },
          },
        },
      });
      await expect(createAuthenticatedClient()).rejects.toThrow(
        'Authentication failed: user is not active'
      );
      expect(env.byLabel('service')[0].tables()).toEqual(['daas_users']);
    }
  );

  it('with standard Headers, "Bearer " is trimmed to "Bearer" and treated as no bearer token', async () => {
    const env = setup({ authorization: 'Bearer ' });
    const { supabase } = await createAuthenticatedClient();
    expect(supabase).toBe(env.byLabel('server')[0]);
    expect(env.byLabel('service')).toEqual([]);
  });

  it.each([['Bearer '], ['Bearer    '], ['Bearer \t']])(
    'an empty bearer token (%j, from a non-normalising headers object) is rejected without a lookup',
    async (authorization) => {
      // A user row whose token is '' must never be reachable via "Bearer ".
      const env = setup({
        db: {
          tables: {
            daas_users: daasUsers({ tokenResult: { data: STATIC_ROW, error: null } }),
            daas_user_roles: { data: null, error: null },
          },
        },
      });
      env.getHeaders.mockResolvedValue({ get: (name: string) => (name === 'authorization' ? authorization : null) });
      await expect(createAuthenticatedClient()).rejects.toThrow('Authentication failed: invalid token');
      expect(env.byLabel('service')).toEqual([]);
      expect(env.getCookies).not.toHaveBeenCalled();
    }
  );

  it('role lookup error → still authenticated, role is null (authorization re-checks in the DB)', async () => {
    setup({
      authorization: 'Bearer static-token',
      db: {
        tables: {
          daas_users: daasUsers({}),
          daas_user_roles: { data: null, error: { message: 'boom' } },
        },
      },
    });
    const { user } = await createAuthenticatedClient();
    expect(user.user_metadata?.role).toBeNull();
  });

  it('a user without a role has role null', async () => {
    setup({
      authorization: 'Bearer static-token',
      db: { tables: { daas_users: daasUsers({}), daas_user_roles: { data: null, error: null } } },
    });
    const { user } = await createAuthenticatedClient();
    expect(user.user_metadata?.role).toBeNull();
  });
});

// ─── Cookie sessions ─────────────────────────────────────────────

describe('createAuthenticatedClient — cookie session', () => {
  it.each([[undefined], ['bearer lower-case'], ['Basic abc'], ['Bearer'], ['Token x']])(
    'authorization %j → anon-key server client bound to the cookie store (no service role)',
    async (authorization) => {
      const cookies = [{ name: 'sb-access-token', value: 'v' }];
      const env = setup({ authorization, cookies });
      const { supabase, user } = await createAuthenticatedClient();

      expect(user).toEqual(SESSION_USER);
      expect(env.createClient).not.toHaveBeenCalled();
      expect(env.createServerClient).toHaveBeenCalledTimes(1);
      const [url, key, options] = env.createServerClient.mock.calls[0];
      expect([url, key]).toEqual([SUPABASE_URL, ANON_KEY]);
      expect(supabase).toBe(env.byLabel('server')[0]);
      const cookieOpts = (options as { cookies: { getAll: () => unknown } }).cookies;
      expect(cookieOpts.getAll()).toEqual(cookies);
    }
  );

  it('getUser() error → AuthenticationError carrying the message', async () => {
    setup({ db: { getUser: { user: SESSION_USER, error: { message: 'session expired' } } } });
    const err = await createAuthenticatedClient().catch((e) => e);
    expect(err).toBeInstanceOf(AuthenticationError);
    expect(err.message).toBe('Authentication failed: session expired');
  });

  it('no user → AuthenticationError', async () => {
    setup({ db: { getUser: { user: null } } });
    await expect(createAuthenticatedClient()).rejects.toThrow('User not authenticated');
  });

  describe('cookie writes (setAll)', () => {
    type SetAll = (c: { name: string; value: string; options: Record<string, unknown> }[]) => void;

    async function setAllFor(opts: FakeAuthOptions = {}) {
      const env = setup(opts);
      await createAuthenticatedClient();
      const options = env.createServerClient.mock.calls[0][2] as { cookies: { setAll: SetAll } };
      return { env, setAll: options.cookies.setAll };
    }

    it('applies secure defaults (httpOnly, secure, sameSite=lax, path=/)', async () => {
      const { env, setAll } = await setAllFor();
      setAll([{ name: 'a', value: '1', options: {} }]);
      expect(env.cookieStore.set).toHaveBeenCalledWith('a', '1', {
        sameSite: 'lax',
        secure: true,
        path: '/',
        maxAge: undefined,
        httpOnly: true,
      });
    });

    it('cookieConfig overrides sameSite/secure/path; per-cookie maxAge wins over the config', async () => {
      const { env, setAll } = await setAllFor({
        cookieConfig: { sameSite: 'strict', secure: false, path: '/app', maxAge: 60 },
      });
      setAll([
        { name: 'a', value: '1', options: { sameSite: 'none', secure: true, path: '/x', maxAge: 5 } },
        { name: 'b', value: '2', options: {} },
      ]);
      expect(env.cookieStore.set).toHaveBeenNthCalledWith(1, 'a', '1', {
        sameSite: 'strict',
        secure: false,
        path: '/app',
        maxAge: 5,
        httpOnly: true,
      });
      expect(env.cookieStore.set).toHaveBeenNthCalledWith(2, 'b', '2', {
        sameSite: 'strict',
        secure: false,
        path: '/app',
        maxAge: 60,
        httpOnly: true,
      });
    });

    it('swallows cookie-store errors (Server Component context)', async () => {
      const { env, setAll } = await setAllFor();
      env.cookieStore.set.mockImplementation(() => {
        throw new Error('Cookies can only be modified in a Server Action');
      });
      expect(() => setAll([{ name: 'a', value: '1', options: {} }])).not.toThrow();
    });
  });
});

// ─── Known gap (not fixed here — see report) ─────────────────────

describe('KNOWN GAP: daas_users.status is only checked for static tokens', () => {
  // A cookie/JWT session is accepted on Supabase Auth's word alone; a daas user
  // that was suspended (or has no daas_users row) keeps authenticating until
  // their Supabase session ends. Fixing this changes authentication for every
  // consumer (extra query per request, RLS on daas_users), so it is left for a
  // deliberate decision. `it.fails` keeps the safe expectation visible: once
  // the check exists these start "failing" and should become plain `it`.
  const suspended: FakeDbSpec = {
    getUser: { user: SESSION_USER },
    tables: {
      daas_users: { data: { ...STATIC_ROW, id: 'u1', status: 'suspended' }, error: null },
      daas_user_roles: { data: null, error: null },
    },
  };

  it.fails('a cookie session of a suspended daas user is rejected', async () => {
    setup({ db: suspended });
    await expect(createAuthenticatedClient()).rejects.toBeInstanceOf(AuthenticationError);
  });

  it.fails('a JWT of a suspended daas user is rejected', async () => {
    setup({ authorization: `Bearer ${JWT}`, db: suspended });
    await expect(createAuthenticatedClient()).rejects.toBeInstanceOf(AuthenticationError);
  });
});

// ─── Helpers built on createAuthenticatedClient ──────────────────

describe('getCurrentUser', () => {
  it('returns the authenticated user', async () => {
    setup();
    expect(await getCurrentUser()).toEqual(SESSION_USER);
  });

  it('propagates AuthenticationError', async () => {
    setup({ db: { getUser: { user: null } } });
    await expect(getCurrentUser()).rejects.toBeInstanceOf(AuthenticationError);
  });
});

describe('isAdmin', () => {
  function withAdminRow(byId: Result, opts: FakeAuthOptions = {}) {
    return setup({
      ...opts,
      db: {
        tables: {
          daas_users: daasUsers({ byId }),
          daas_user_roles: { data: { role_id: 'role-1' }, error: null },
        },
      },
    });
  }

  it('true only when admin_access is true; looks the user up by id on the session client', async () => {
    const env = withAdminRow({ data: { admin_access: true }, error: null });
    expect(await isAdmin()).toBe(true);
    expect(env.byLabel('server')[0].queries).toEqual([
      [['from', 'daas_users'], ['select', 'admin_access'], ['eq', 'id', 'u1'], ['single']],
    ]);
  });

  it('a static-token user is checked with the service-role client, by their own id', async () => {
    const env = withAdminRow({ data: { admin_access: true }, error: null }, { authorization: 'Bearer static-token' });
    expect(await isAdmin()).toBe(true);
    const service = env.byLabel('service')[0];
    expect(eqValue(service.queries[2], 'id')).toBe('s1');
  });

  it.each([
    ['lookup error', { data: { admin_access: true }, error: { message: 'boom' } }],
    ['no row', { data: null, error: null }],
    ['admin_access false', { data: { admin_access: false }, error: null }],
    ['admin_access null', { data: { admin_access: null }, error: null }],
    ['admin_access missing', { data: {}, error: null }],
    ['admin_access "true" (string)', { data: { admin_access: 'true' }, error: null }],
    ['admin_access "false" (string)', { data: { admin_access: 'false' }, error: null }],
    ['admin_access 1', { data: { admin_access: 1 }, error: null }],
  ])('%s → false', async (_label, row) => {
    withAdminRow(row as Result);
    expect(await isAdmin()).toBe(false);
  });

  it('unauthenticated → rejects (never resolves false/true silently)', async () => {
    setup({ db: { getUser: { user: null } } });
    await expect(isAdmin()).rejects.toBeInstanceOf(AuthenticationError);
  });
});

describe('getUserRole', () => {
  it('returns the primary (lowest sort) role', async () => {
    const env = setup();
    expect(await getUserRole()).toBe('role-1');
    expect(env.byLabel('server')[0].queries[0]).toEqual([
      ['from', 'daas_user_roles'],
      ['select', 'role_id'],
      ['eq', 'user_id', 'u1'],
      ['order', 'sort', { ascending: true }],
      ['limit', 1],
      ['maybeSingle'],
    ]);
  });

  it.each([
    ['lookup error', { data: { role_id: 'role-1' }, error: { message: 'boom' } }],
    ['no role', { data: null, error: null }],
    ['row without role_id', { data: {}, error: null }],
  ])('%s → null', async (_label, result) => {
    setup({ db: { tables: { daas_user_roles: result as Result } } });
    expect(await getUserRole()).toBeNull();
  });

  it('unauthenticated → rejects', async () => {
    setup({ db: { getUser: { user: null } } });
    await expect(getUserRole()).rejects.toBeInstanceOf(AuthenticationError);
  });
});

describe('getUserProfile', () => {
  it('returns the profile of the authenticated user only', async () => {
    const profile = { id: 'u1', email: 'u1@example.com', roles: [] };
    const env = setup({ db: { tables: { daas_users: { data: profile, error: null } } } });
    expect(await getUserProfile()).toEqual(profile);
    const q = env.byLabel('server')[0].queries[0];
    expect(eqValue(q, 'id')).toBe('u1');
    expect(q[q.length - 1]).toEqual(['single']);
  });

  it('lookup error → throws', async () => {
    setup({ db: { tables: { daas_users: { data: null, error: { message: 'boom' } } } } });
    await expect(getUserProfile()).rejects.toThrow('Failed to fetch user profile: boom');
  });

  it('unauthenticated → rejects', async () => {
    setup({ db: { getUser: { user: null } } });
    await expect(getUserProfile()).rejects.toBeInstanceOf(AuthenticationError);
  });
});

describe('getAccountability', () => {
  it('authenticated → user, primary role and admin flag', async () => {
    setup({
      db: {
        tables: {
          daas_users: { data: { admin_access: true }, error: null },
          daas_user_roles: { data: { role_id: 'role-1' }, error: null },
        },
      },
    });
    expect(await getAccountability()).toEqual({
      user: 'u1',
      role: 'role-1',
      admin: true,
      app: true,
      ip: undefined,
    });
  });

  it('unauthenticated → null (does not throw)', async () => {
    setup({ db: { getUser: { user: null } } });
    expect(await getAccountability()).toBeNull();
  });

  it('lookup failures → non-admin, no role', async () => {
    setup({
      db: {
        tables: {
          daas_users: { data: { admin_access: true }, error: { message: 'boom' } },
          daas_user_roles: { data: { role_id: 'role-1' }, error: { message: 'boom' } },
        },
      },
    });
    expect(await getAccountability()).toMatchObject({ user: 'u1', role: null, admin: false });
  });

  it('an inactive static-token user → null', async () => {
    setup({
      authorization: 'Bearer static-token',
      db: {
        tables: {
          daas_users: daasUsers({ tokenResult: { data: { ...STATIC_ROW, status: 'suspended' }, error: null } }),
          daas_user_roles: { data: null, error: null },
        },
      },
    });
    expect(await getAccountability()).toBeNull();
  });
});

describe('isAuthenticationError', () => {
  it('recognises AuthenticationError only', () => {
    expect(isAuthenticationError(new AuthenticationError())).toBe(true);
    expect(new AuthenticationError().message).toBe('Not authenticated');
    expect(new AuthenticationError().name).toBe('AuthenticationError');
    expect(isAuthenticationError(new Error('Not authenticated'))).toBe(false);
    expect(isAuthenticationError({ name: 'AuthenticationError' })).toBe(false);
    expect(isAuthenticationError(null)).toBe(false);
  });
});
