/**
 * enforcer.ts unit tests — authorization decisions.
 *
 * Complements enforcer-permission-filters.test.ts (filter translation). Here
 * the real session.ts runs on top of a faked Supabase boundary (client
 * factories, headers, cookies — see ./helpers/fake-supabase), so the tests
 * also pin which client and which user id every lookup uses.
 *
 * Rule under test: a lookup that errors, returns nothing, or returns an
 * unexpected shape must never grant access (fail closed). Only an explicit
 * boolean `true` counts as admin / as a granted permission.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { AuthenticationError, configureAuth } from '../src/auth/session';
import {
  enforcePermission,
  filterFields,
  filterFieldsArray,
  filterResponseFields,
  getAccessibleFields,
  getPermissionFilters,
  getUserPermissions,
  isFieldAccessible,
  PermissionError,
  validateFieldsAccess,
} from '../src/auth/enforcer';
import {
  eqValue,
  fakeAuthEnv,
  type Call,
  type FakeAuthOptions,
  type FakeSupabase,
  type Result,
  type RpcSpec,
  type TableSpec,
} from './helpers/fake-supabase';

const DENY_ALL = { _and: [{ id: { _null: true } }, { id: { _nnull: true } }] };

const ok = (data: unknown): Result => ({ data, error: null });
const fail = (data: unknown = null): Result => ({ data, error: { message: 'boom' } });

interface Db {
  admin?: Result;
  roles?: Result;
  permissions?: TableSpec;
  rpc?: Record<string, RpcSpec>;
  /** daas_users.status of the static-token user (default 'active'). */
  staticStatus?: string;
}

/**
 * Cookie-session user `u1` by default. With `authorization: 'Bearer static-token'`
 * the static-token user `s1` (service-role client) is used instead.
 */
function setup(db: Db = {}, opts: FakeAuthOptions = {}) {
  const daasUsers = (q: Call[]): Result => {
    if (eqValue(q, 'token') === 'static-token') {
      return ok({ id: 's1', email: 's@x', status: db.staticStatus ?? 'active', admin_access: false });
    }
    if (eqValue(q, 'token') !== undefined) return fail();
    return db.admin ?? ok({ admin_access: false });
  };
  const env = fakeAuthEnv({
    ...opts,
    db: {
      getUser: { user: { id: 'u1' } },
      tables: {
        daas_users: daasUsers,
        daas_user_roles: db.roles ?? ok([{ role_id: 'r1' }]),
        daas_permissions: db.permissions ?? ok([]),
      },
      rpc: {
        check_permission: ok(false),
        get_user_policies: ok(['p1', 'p2']),
        get_user_permission_fields: ok([]),
        ...db.rpc,
      },
    },
  });
  configureAuth(env.config);
  /** The client the enforcer ran its lookups on. */
  const client = (): FakeSupabase => env.clients[0];
  return { env, client };
}

/** Queries (after the auth lookups) made on `table`. */
function queriesOn(c: FakeSupabase, table: string): Call[][] {
  return c.queries.filter((q) => q[0][1] === table && eqValue(q, 'token') === undefined);
}

const NON_TRUE_VALUES: Array<[string, unknown]> = [
  ['"true" (string)', 'true'],
  ['"false" (string)', 'false'],
  ['1', 1],
  ['{}', {}],
  ['[]', []],
  ['[false]', [false]],
];

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
});

// ─── enforcePermission ───────────────────────────────────────────

describe('enforcePermission', () => {
  const check = { collection: 'articles', action: 'update' as const };

  it('admin → allowed without a permission lookup', async () => {
    const { client } = setup({ admin: ok({ admin_access: true }) });
    expect(await enforcePermission(check)).toEqual({ user: { id: 'u1' }, isAdmin: true });
    expect(client().queries).toEqual([
      [['from', 'daas_users'], ['select', 'admin_access'], ['eq', 'id', 'u1'], ['single']],
    ]);
    expect(client().rpcCalls).toEqual([]);
  });

  it('non-admin with check_permission = true → allowed; the RPC gets the session user id', async () => {
    const { client } = setup({ rpc: { check_permission: ok(true) } });
    expect(await enforcePermission(check)).toEqual({ user: { id: 'u1' }, isAdmin: false });
    expect(client().rpcCalls).toEqual([
      ['check_permission', { user_id: 'u1', collection: 'articles', action: 'update' }],
    ]);
  });

  it('check_permission = false → 403 PermissionError with collection/action', async () => {
    setup();
    const err = await enforcePermission(check).catch((e) => e);
    expect(err).toBeInstanceOf(PermissionError);
    expect(err).toMatchObject({
      statusCode: 403,
      collection: 'articles',
      action: 'update',
      message: 'Permission denied: update on articles',
    });
  });

  it.each([['null', null], ['undefined', undefined], ['0', 0], ['""', ''], ...NON_TRUE_VALUES])(
    'check_permission returning %s → 403 (only boolean true grants)',
    async (_label, value) => {
      setup({ rpc: { check_permission: ok(value) } });
      await expect(enforcePermission(check)).rejects.toMatchObject({ statusCode: 403 });
    }
  );

  it('check_permission error → 500 PermissionError even if data says true', async () => {
    setup({ rpc: { check_permission: fail(true) } });
    await expect(enforcePermission(check)).rejects.toMatchObject({
      name: 'PermissionError',
      statusCode: 500,
      message: 'Failed to check permission',
    });
  });

  it('admin lookup error → 500 PermissionError, permission never checked', async () => {
    const { client } = setup({ admin: fail({ admin_access: true }), rpc: { check_permission: ok(true) } });
    await expect(enforcePermission(check)).rejects.toMatchObject({
      statusCode: 500,
      message: 'Failed to verify permissions',
    });
    expect(client().rpcCalls).toEqual([]);
  });

  it('no daas_users row (no error) → treated as non-admin and checked', async () => {
    const { client } = setup({ admin: ok(null) });
    await expect(enforcePermission(check)).rejects.toMatchObject({ statusCode: 403 });
    expect(client().rpcCalls).toHaveLength(1);
  });

  it.each(NON_TRUE_VALUES.filter(([, v]) => v !== undefined))(
    'admin_access = %s is not admin (permission still checked)',
    async (_label, value) => {
      const { client } = setup({ admin: ok({ admin_access: value }) });
      await expect(enforcePermission(check)).rejects.toMatchObject({ statusCode: 403 });
      expect(client().rpcCalls.map(([fn]) => fn)).toEqual(['check_permission']);
    }
  );

  it('unauthenticated → AuthenticationError before any lookup', async () => {
    const env = fakeAuthEnv({ db: { getUser: { user: null } } });
    configureAuth(env.config);
    await expect(enforcePermission(check)).rejects.toBeInstanceOf(AuthenticationError);
    expect(env.clients[0].queries).toEqual([]);
    expect(env.clients[0].rpcCalls).toEqual([]);
  });

  it('static-token user → checks run on the service-role client with the token owner id', async () => {
    const { env, client } = setup({ rpc: { check_permission: ok(true) } }, { authorization: 'Bearer static-token' });
    expect(await enforcePermission(check)).toMatchObject({ user: { id: 's1' }, isAdmin: false });
    expect(env.clients).toHaveLength(1);
    expect(client().label).toBe('service');
    expect(eqValue(queriesOn(client(), 'daas_users')[0], 'id')).toBe('s1');
    expect(client().rpcCalls[0][1]).toMatchObject({ user_id: 's1' });
  });

  it('unknown static token → AuthenticationError, no permission lookup', async () => {
    const { client } = setup({ rpc: { check_permission: ok(true) } }, { authorization: 'Bearer nope' });
    await expect(enforcePermission(check)).rejects.toBeInstanceOf(AuthenticationError);
    expect(client().rpcCalls).toEqual([]);
  });
});

// ─── getUserPermissions ──────────────────────────────────────────

describe('getUserPermissions', () => {
  const FULL = { fields: ['*'], permissions: null, validation: null, presets: null };

  it('admin → full access for every action, no policy lookup', async () => {
    const { client } = setup({ admin: ok({ admin_access: true }) });
    expect(await getUserPermissions('articles')).toEqual({
      create: FULL,
      read: FULL,
      update: FULL,
      delete: FULL,
      share: FULL,
    });
    expect(client().rpcCalls).toEqual([]);
  });

  it.each([['admin lookup error', fail({ admin_access: true })], ...NON_TRUE_VALUES.map(([l, v]) => [`admin_access = ${l}`, ok({ admin_access: v })] as [string, Result])])(
    '%s → not treated as admin',
    async (_label, admin) => {
      setup({ admin, rpc: { get_user_policies: ok([]) } });
      expect(await getUserPermissions('articles')).toEqual({});
    }
  );

  it.each([
    ['null', ok(null)],
    ['[]', ok([])],
    ['an RPC error', fail(['p1'])],
    ['a non-array string', ok('p1')],
    ['a non-array object', ok({ length: 1, 0: 'p1' })],
  ])('policies = %s → no permissions, daas_permissions never queried', async (_label, policies) => {
    const { client } = setup({
      rpc: { get_user_policies: policies },
      permissions: ok([{ action: 'read', fields: ['*'], permissions: null }]),
    });
    expect(await getUserPermissions('articles')).toEqual({});
    expect(queriesOn(client(), 'daas_permissions')).toEqual([]);
  });

  it('queries the collection’s permissions for the user’s policies (ids stringified)', async () => {
    const { client } = setup({ rpc: { get_user_policies: ok(['p1', 42]) } });
    await getUserPermissions('articles');
    expect(client().rpcCalls).toEqual([['get_user_policies', { user_id: 'u1' }]]);
    expect(queriesOn(client(), 'daas_permissions')).toEqual([
      [
        ['from', 'daas_permissions'],
        ['select', 'action, fields, permissions, validation, presets'],
        ['eq', 'collection', 'articles'],
        ['in', 'policy', ['p1', '42']],
      ],
    ]);
  });

  it.each([['an error', fail([{ action: 'read', fields: ['*'] }])], ['null data', ok(null)]])(
    'permission query with %s → no permissions',
    async (_label, permissions) => {
      setup({ permissions });
      expect(await getUserPermissions('articles')).toEqual({});
    }
  );

  it('merges rows per action: fields union, wildcard wins, filters and validation ORed', async () => {
    setup({
      permissions: ok([
        { action: 'read', fields: ['id', 'title'], permissions: { a: { _eq: 1 } }, validation: null, presets: null },
        { action: 'read', fields: ['title', 'body'], permissions: { b: { _eq: 2 } }, validation: null, presets: null },
        { action: 'update', fields: ['title'], permissions: null, validation: { v: { _eq: 1 } }, presets: { p: 1 } },
        { action: 'update', fields: ['*'], permissions: null, validation: { w: { _eq: 2 } }, presets: { p: 2 } },
        { action: 'delete', fields: null, permissions: { c: { _eq: 3 } }, validation: null, presets: null },
      ]),
    });
    expect(await getUserPermissions('articles')).toEqual({
      read: {
        fields: ['id', 'title', 'body'],
        permissions: { _or: [{ a: { _eq: 1 } }, { b: { _eq: 2 } }] },
        validation: null,
        presets: null,
      },
      update: {
        fields: ['*'],
        permissions: null,
        validation: { _or: [{ v: { _eq: 1 } }, { w: { _eq: 2 } }] },
        presets: { p: 1 },
      },
      // null fields grant no fields
      delete: { fields: [], permissions: { c: { _eq: 3 } }, validation: null, presets: null },
    });
  });

  it('a wildcard in an earlier row survives later field lists', async () => {
    setup({
      permissions: ok([
        { action: 'read', fields: ['*'], permissions: null, validation: null, presets: null },
        { action: 'read', fields: ['id'], permissions: null, validation: null, presets: null },
      ]),
    });
    expect((await getUserPermissions('articles')).read.fields).toEqual(['*']);
  });

  it('actions without a permission row are absent (denied)', async () => {
    setup({ permissions: ok([{ action: 'read', fields: ['id'], permissions: null, validation: null, presets: null }]) });
    const perms = await getUserPermissions('articles');
    expect(Object.keys(perms)).toEqual(['read']);
  });

  it('unauthenticated → rejects', async () => {
    configureAuth(fakeAuthEnv({ db: { getUser: { user: null } } }).config);
    await expect(getUserPermissions('articles')).rejects.toBeInstanceOf(AuthenticationError);
  });
});

// ─── Field-level access ──────────────────────────────────────────

describe('getAccessibleFields', () => {
  it('returns the merged field list from get_user_permission_fields for the session user', async () => {
    const { client } = setup({ rpc: { get_user_permission_fields: ok(['id', 'title']) } });
    expect(await getAccessibleFields('articles', 'read')).toEqual(['id', 'title']);
    expect(client().rpcCalls).toEqual([
      ['get_user_permission_fields', { user_id: 'u1', collection: 'articles', action: 'read' }],
    ]);
  });

  it.each([
    ['an RPC error', fail(['*'])],
    ['null', ok(null)],
    ['a "*" string (not an array)', ok('*')],
    ['an object', ok({ 0: '*', length: 1 })],
  ])('%s → no fields', async (_label, result) => {
    setup({ rpc: { get_user_permission_fields: result } });
    expect(await getAccessibleFields('articles', 'read')).toEqual([]);
  });

  it('drops non-string entries', async () => {
    setup({ rpc: { get_user_permission_fields: ok(['title', null, 5, { f: '*' }]) } });
    expect(await getAccessibleFields('articles', 'read')).toEqual(['title']);
  });

  it('static-token user → service-role client, token owner id', async () => {
    const { client } = setup(
      { rpc: { get_user_permission_fields: ok(['*']) } },
      { authorization: 'Bearer static-token' }
    );
    expect(await getAccessibleFields('articles', 'read')).toEqual(['*']);
    expect(client().label).toBe('service');
    expect(client().rpcCalls[0][1]).toMatchObject({ user_id: 's1' });
  });

  it('unauthenticated → rejects', async () => {
    configureAuth(fakeAuthEnv({ db: { getUser: { user: null } } }).config);
    await expect(getAccessibleFields('articles', 'read')).rejects.toBeInstanceOf(AuthenticationError);
  });
});

describe('validateFieldsAccess', () => {
  function withFields(result: Result) {
    setup({ rpc: { get_user_permission_fields: result } });
  }

  it('wildcard → allowed', async () => {
    withFields(ok(['*']));
    expect(await validateFieldsAccess(['a', 'b'], 'articles', 'update')).toEqual({ allowed: true, forbiddenFields: [] });
  });

  it('all requested fields listed → allowed', async () => {
    withFields(ok(['a', 'b', 'c']));
    expect(await validateFieldsAccess(['a', 'c'], 'articles', 'update')).toEqual({ allowed: true, forbiddenFields: [] });
  });

  it('unlisted fields → denied, listing exactly those fields', async () => {
    withFields(ok(['a']));
    expect(await validateFieldsAccess(['a', 'b', 'c'], 'articles', 'update')).toEqual({
      allowed: false,
      forbiddenFields: ['b', 'c'],
    });
  });

  it('field names are matched exactly (no prefix / case / wildcard-substring matching)', async () => {
    withFields(ok(['title', 'a*']));
    expect(await validateFieldsAccess(['Title', 'title_x', 'ab'], 'articles', 'update')).toEqual({
      allowed: false,
      forbiddenFields: ['Title', 'title_x', 'ab'],
    });
  });

  it.each([['no fields', ok([])], ['an RPC error', fail(['*'])], ['a "*" string', ok('*')]])(
    '%s → denied (even for an empty request)',
    async (_label, result) => {
      withFields(result);
      expect(await validateFieldsAccess(['a'], 'articles', 'create')).toEqual({ allowed: false, forbiddenFields: ['a'] });
      expect((await validateFieldsAccess([], 'articles', 'create')).allowed).toBe(false);
    }
  );
});

describe('isFieldAccessible', () => {
  it.each([
    ['wildcard', ok(['*']), 'secret', true],
    ['listed', ok(['title']), 'title', true],
    ['not listed', ok(['title']), 'secret', false],
    ['no fields', ok([]), 'title', false],
    ['RPC error', fail(['*']), 'title', false],
    ['"*" string', ok('*'), 'title', false],
  ])('%s → %s', async (_label, result, field, expected) => {
    setup({ rpc: { get_user_permission_fields: result as Result } });
    expect(await isFieldAccessible(field as string, 'articles', 'read')).toBe(expected);
  });
});

describe('filterFields / filterFieldsArray', () => {
  const row = { id: 1, title: 't', secret: 's' };

  it('wildcard keeps every field', () => {
    expect(filterFields(row, ['*'])).toEqual(row);
    expect(filterFields(row, ['id', '*'])).toEqual(row);
  });

  it('keeps only allowed fields and never invents missing ones', () => {
    expect(filterFields(row, ['id', 'title', 'missing'])).toEqual({ id: 1, title: 't' });
  });

  it('no allowed fields → empty object', () => {
    expect(filterFields(row, [])).toEqual({});
  });

  it('does not mutate the input', () => {
    const input = { ...row };
    filterFields(input, ['id']);
    expect(input).toEqual(row);
  });

  it('filterFieldsArray applies to each row', () => {
    expect(filterFieldsArray([row, { id: 2, secret: 'x' }], ['id'])).toEqual([{ id: 1 }, { id: 2 }]);
    expect(filterFieldsArray([], ['id'])).toEqual([]);
  });
});

describe('filterResponseFields', () => {
  const row = { id: 1, title: 't', secret: 's' };

  it('filters an object and an array with the user’s read fields', async () => {
    setup({ rpc: { get_user_permission_fields: ok(['id', 'title']) } });
    expect(await filterResponseFields(row, 'articles', 'read')).toEqual({ id: 1, title: 't' });
    expect(await filterResponseFields([row, row], 'articles', 'read')).toEqual([
      { id: 1, title: 't' },
      { id: 1, title: 't' },
    ]);
  });

  it('field lookup error → every field stripped', async () => {
    setup({ rpc: { get_user_permission_fields: fail(['*']) } });
    expect(await filterResponseFields(row, 'articles', 'read')).toEqual({});
    expect(await filterResponseFields([row], 'articles', 'read')).toEqual([{}]);
  });
});

// ─── getPermissionFilters — lookup paths ─────────────────────────
// (filter translation / dynamic variables: enforcer-permission-filters.test.ts)

describe('getPermissionFilters — lookups', () => {
  const OWNER = { owner: { _eq: '$CURRENT_USER' } };

  it('admin → null (no filter), nothing else queried', async () => {
    const { client } = setup({ admin: ok({ admin_access: true }) });
    expect(await getPermissionFilters('articles', 'read')).toBeNull();
    expect(client().tables()).toEqual(['daas_users']);
    expect(client().rpcCalls).toEqual([]);
  });

  it('queries roles and permissions for the session user, collection and action', async () => {
    const { client } = setup({ permissions: ok([{ permissions: OWNER }]) });
    expect(await getPermissionFilters('articles', 'update')).toEqual({ owner: { _eq: 'u1' } });
    expect(queriesOn(client(), 'daas_user_roles')).toEqual([
      [['from', 'daas_user_roles'], ['select', 'role_id'], ['eq', 'user_id', 'u1'], ['order', 'sort', { ascending: true }]],
    ]);
    expect(client().rpcCalls).toEqual([['get_user_policies', { user_id: 'u1' }]]);
    expect(queriesOn(client(), 'daas_permissions')).toEqual([
      [
        ['from', 'daas_permissions'],
        ['select', 'permissions'],
        ['eq', 'collection', 'articles'],
        ['eq', 'action', 'update'],
        ['in', 'policy', ['p1', 'p2']],
      ],
    ]);
  });

  it.each([['admin lookup error', fail({ admin_access: true })], ...NON_TRUE_VALUES.map(([l, v]) => [`admin_access = ${l}`, ok({ admin_access: v })] as [string, Result])])(
    '%s → not admin: the user’s own filter applies',
    async (_label, admin) => {
      setup({ admin, permissions: ok([{ permissions: OWNER }]) });
      expect(await getPermissionFilters('articles', 'read')).toEqual({ owner: { _eq: 'u1' } });
    }
  );

  it.each([
    ['null', ok(null)],
    ['an RPC error', fail(['p1'])],
    ['a non-array string', ok('p1')],
    ['a non-array object', ok({ length: 1, 0: 'p1' })],
  ])('policies = %s → deny all, daas_permissions never queried', async (_label, policies) => {
    const { client } = setup({ rpc: { get_user_policies: policies }, permissions: ok([{ permissions: null }]) });
    expect(await getPermissionFilters('articles', 'read')).toEqual(DENY_ALL);
    expect(queriesOn(client(), 'daas_permissions')).toEqual([]);
  });

  it.each([
    ['null', ok(null)],
    ['a non-array object', ok({ permissions: null })],
    ['an error with rows', fail([{ permissions: null }])],
  ])('permission rows = %s → deny all', async (_label, permissions) => {
    setup({ permissions });
    expect(await getPermissionFilters('articles', 'read')).toEqual(DENY_ALL);
  });

  it.each([
    ['a row without a permissions key', [{}]],
    ['a row without a permissions key next to a null (full-access) row', [{}, { permissions: null }]],
    ['a null row', [null]],
    ['a double-encoded JSON string', [{ permissions: '{"owner":{"_eq":"$CURRENT_USER"}}' }]],
    ['a number', [{ permissions: 1 }]],
    ['an array', [{ permissions: [OWNER] }]],
  ])('malformed permission rows (%s) → deny all', async (_label, rows) => {
    setup({ permissions: ok(rows) });
    expect(await getPermissionFilters('articles', 'read')).toEqual(DENY_ALL);
  });

  it.each([
    ['one row with a null filter', [{ permissions: null }]],
    ['every row with a null filter', [{ permissions: null }, { permissions: null }]],
    ['a null filter next to a restricted one', [{ permissions: OWNER }, { permissions: null }]],
  ])('%s → null (full access, as granted)', async (_label, rows) => {
    setup({ permissions: ok(rows) });
    expect(await getPermissionFilters('articles', 'read')).toBeNull();
  });

  it('non-string policy ids are stringified for the permission lookup', async () => {
    const { client } = setup({ rpc: { get_user_policies: ok([7, 'p2']) }, permissions: ok([{ permissions: OWNER }]) });
    await getPermissionFilters('articles', 'read');
    expect(queriesOn(client(), 'daas_permissions')[0]).toContainEqual(['in', 'policy', ['7', 'p2']]);
  });

  it('an empty filter object {} is unrestricted (DaaS semantics), like null', async () => {
    setup({ permissions: ok([{ permissions: {} }]) });
    expect(await getPermissionFilters('articles', 'read')).toEqual({});
  });

  it('static-token user → service-role client, token owner id in filters and lookups', async () => {
    const { client } = setup({ permissions: ok([{ permissions: OWNER }]) }, { authorization: 'Bearer static-token' });
    expect(await getPermissionFilters('articles', 'read')).toEqual({ owner: { _eq: 's1' } });
    expect(client().label).toBe('service');
    expect(client().rpcCalls).toEqual([['get_user_policies', { user_id: 's1' }]]);
    expect(eqValue(queriesOn(client(), 'daas_user_roles')[0], 'user_id')).toBe('s1');
  });

  it('inactive static-token user → AuthenticationError, no permission lookup', async () => {
    const { client } = setup(
      { permissions: ok([{ permissions: null }]), staticStatus: 'suspended' },
      { authorization: 'Bearer static-token' }
    );
    await expect(getPermissionFilters('articles', 'read')).rejects.toThrow('user is not active');
    expect(client().rpcCalls).toEqual([]);
    expect(queriesOn(client(), 'daas_permissions')).toEqual([]);
  });

  it('unauthenticated → rejects', async () => {
    configureAuth(fakeAuthEnv({ db: { getUser: { user: null } } }).config);
    await expect(getPermissionFilters('articles', 'read')).rejects.toBeInstanceOf(AuthenticationError);
  });
});
