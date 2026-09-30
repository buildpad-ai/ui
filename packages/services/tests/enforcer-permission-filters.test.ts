/**
 * getPermissionFilters / applyFilterToQuery (enforcer) — deny-on-error tests
 *
 * A permission filter that cannot be translated faithfully must DENY:
 * - getPermissionFilters returns the deny-all filter instead of a filter that
 *   would later be dropped or throw mid-query;
 * - the exported applyFilterToQuery throws a 403 PermissionError before the
 *   query is modified, so the standard `catch (PermissionError) → 403` handler
 *   denies the request instead of running an unrestricted query.
 *
 * The session module is mocked with a fake Supabase client.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { createAuthenticatedClientMock } = vi.hoisted(() => ({
  createAuthenticatedClientMock: vi.fn(),
}));
vi.mock('../src/auth/session', () => ({
  createAuthenticatedClient: createAuthenticatedClientMock,
}));

import {
  applyFilterToQuery,
  getPermissionFilters,
  PermissionError,
  UnsupportedPermissionFilterError,
  type FilterObject,
} from '../src/auth/enforcer';
import type { QueryBuilder } from '../src/auth/filter-to-query';

const DENY_ALL = { id: { _eq: '__DENY_ALL__' } };

// ─── Fake Supabase client ────────────────────────────────────────

interface Result {
  data: unknown;
  error: unknown;
}

interface FakeDb {
  admin?: boolean;
  roles?: Result;
  policies?: unknown;
  permissions?: Result;
}

/** A chainable, awaitable table query that resolves to `result`. */
function tableQuery(result: Result) {
  const q: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'in', 'order', 'limit']) q[m] = () => q;
  q.single = () => Promise.resolve(result);
  q.maybeSingle = () => Promise.resolve(result);
  q.then = (resolve: (r: Result) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return q;
}

function mockSession(db: FakeDb) {
  const supabase = {
    from: (table: string) => {
      switch (table) {
        case 'daas_users':
          return tableQuery({ data: { admin_access: db.admin ?? false }, error: null });
        case 'daas_user_roles':
          return tableQuery(db.roles ?? { data: [{ role_id: 'r1' }, { role_id: 'r2' }], error: null });
        case 'daas_permissions':
          return tableQuery(db.permissions ?? { data: [], error: null });
        default:
          throw new Error(`unexpected table ${table}`);
      }
    },
    rpc: vi.fn(async (fn: string) => {
      if (fn === 'get_user_policies') return { data: db.policies ?? ['p1', 'p2'], error: null };
      throw new Error(`unexpected rpc ${fn}`);
    }),
    auth: { getUser: vi.fn() },
  };
  createAuthenticatedClientMock.mockResolvedValue({ supabase, user: { id: 'u1' } });
}

function withPermissions(...filters: Array<FilterObject | null>): FakeDb {
  return { permissions: { data: filters.map((permissions) => ({ permissions })), error: null } };
}

// ─── Fake query builder (records calls) ──────────────────────────

type Call = [string, ...unknown[]];

function fakeQuery(): QueryBuilder & { calls: Call[] } {
  const calls: Call[] = [];
  const q = { calls } as QueryBuilder & { calls: Call[] };
  for (const m of ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'like', 'ilike', 'is', 'or', 'filter', 'not']) {
    (q as unknown as Record<string, unknown>)[m] = (...args: unknown[]) => {
      calls.push([m, ...args]);
      return q;
    };
  }
  return q;
}

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  createAuthenticatedClientMock.mockReset();
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
  vi.useRealTimers();
});

// ─── Existing behaviour kept ─────────────────────────────────────

describe('getPermissionFilters — baseline', () => {
  it('admins get no filter', async () => {
    mockSession({ admin: true });
    expect(await getPermissionFilters('articles', 'read')).toBeNull();
  });

  it('no policies → deny all', async () => {
    mockSession({ policies: [] });
    expect(await getPermissionFilters('articles', 'read')).toEqual(DENY_ALL);
  });

  it('no permission rows → deny all', async () => {
    mockSession({ permissions: { data: [], error: null } });
    expect(await getPermissionFilters('articles', 'read')).toEqual(DENY_ALL);
  });

  it('permission query error → deny all', async () => {
    mockSession({ permissions: { data: null, error: { message: 'boom' } } });
    expect(await getPermissionFilters('articles', 'read')).toEqual(DENY_ALL);
  });

  it('a null permission filter means full access', async () => {
    mockSession(withPermissions(null, { owner: { _eq: '$CURRENT_USER' } }));
    expect(await getPermissionFilters('articles', 'read')).toBeNull();
  });

  it('multiple filters are ORed', async () => {
    mockSession(withPermissions({ owner: { _eq: '$CURRENT_USER' } }, { public: { _eq: true } }));
    expect(await getPermissionFilters('articles', 'read')).toEqual({
      _or: [{ owner: { _eq: 'u1' } }, { public: { _eq: true } }],
    });
  });
});

// ─── Dynamic variables ───────────────────────────────────────────

describe('getPermissionFilters — dynamic variables', () => {
  it('resolves $CURRENT_USER / $CURRENT_ROLE / $CURRENT_ROLES / $CURRENT_POLICIES / $NOW', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-06T07:08:09.000Z'));
    mockSession(
      withPermissions({
        _and: [
          { owner: { _eq: '$CURRENT_USER' } },
          { role: { _eq: '$CURRENT_ROLE' } },
          { team_role: { _in: '$CURRENT_ROLES' } },
          { policy: { _in: '$CURRENT_POLICIES' } },
          { publish_at: { _lte: '$NOW' } },
        ],
      })
    );
    const filter = await getPermissionFilters('articles', 'read');
    expect(filter).toEqual({
      _and: [
        { owner: { _eq: 'u1' } },
        { role: { _eq: 'r1' } },
        { team_role: { _in: ['r1', 'r2'] } },
        { policy: { _in: ['p1', 'p2'] } },
        { publish_at: { _lte: '2026-05-06T07:08:09.000Z' } },
      ],
    });
    expect(consoleError).not.toHaveBeenCalled();

    const q = fakeQuery();
    applyFilterToQuery(q, filter);
    expect(q.calls).toEqual([
      ['eq', 'owner', 'u1'],
      ['eq', 'role', 'r1'],
      ['filter', 'team_role', 'in', '("r1","r2")'],
      ['filter', 'policy', 'in', '("p1","p2")'],
      ['lte', 'publish_at', '2026-05-06T07:08:09.000Z'],
    ]);
  });

  it('$CURRENT_ROLES for a user without roles matches nothing (in.())', async () => {
    mockSession({ ...withPermissions({ role: { _in: '$CURRENT_ROLES' } }), roles: { data: [], error: null } });
    const filter = await getPermissionFilters('articles', 'read');
    expect(filter).toEqual({ role: { _in: [] } });
  });

  it('$CURRENT_ROLE for a user without a role → deny all', async () => {
    mockSession({ ...withPermissions({ role: { _eq: '$CURRENT_ROLE' } }), roles: { data: [], error: null } });
    expect(await getPermissionFilters('articles', 'read')).toEqual(DENY_ALL);
    expect(consoleError).toHaveBeenCalledOnce();
  });

  it('role lookup failure → filters using roles deny', async () => {
    mockSession({
      ...withPermissions({ role: { _in: '$CURRENT_ROLES' } }),
      roles: { data: null, error: { message: 'boom' } },
    });
    expect(await getPermissionFilters('articles', 'read')).toEqual(DENY_ALL);
  });

  it('role lookup failure does not affect filters that do not use roles', async () => {
    mockSession({
      ...withPermissions({ owner: { _eq: '$CURRENT_USER' } }),
      roles: { data: null, error: { message: 'boom' } },
    });
    expect(await getPermissionFilters('articles', 'read')).toEqual({ owner: { _eq: 'u1' } });
  });

  it('$CURRENT_USER.<field> → deny all', async () => {
    mockSession(withPermissions({ email: { _eq: '$CURRENT_USER.email' } }));
    expect(await getPermissionFilters('articles', 'read')).toEqual(DENY_ALL);
  });

  it('$NOW(adjustment) → deny all', async () => {
    mockSession(withPermissions({ created: { _gt: '$NOW(-7 days)' } }));
    expect(await getPermissionFilters('articles', 'read')).toEqual(DENY_ALL);
  });
});

// ─── Deny on untranslatable filters ──────────────────────────────

describe('getPermissionFilters — denies filters it cannot enforce', () => {
  it.each([
    ['unknown operator', { owner: { _intersects: 'x' } }],
    ['relational path', { owner: { id: { _eq: '$CURRENT_USER' } } }],
    ['non-array _in', { role: { _in: 'r1' } }],
    ['empty _or', { _or: [] }],
    ['bad field name', { 'a,b': { _eq: 1 } }],
    ['null value', { owner: { _eq: null } }],
  ])('%s → deny all + logged', async (_label, filter) => {
    mockSession(withPermissions(filter as FilterObject));
    expect(await getPermissionFilters('articles', 'read')).toEqual(DENY_ALL);
    expect(consoleError).toHaveBeenCalledOnce();
    expect(String(consoleError.mock.calls[0][0])).toContain('Denying read on articles');
  });

  it('one bad policy filter denies the whole combined filter (never widened)', async () => {
    mockSession(
      withPermissions({ public: { _eq: true } }, { owner: { id: { _eq: '$CURRENT_USER' } } })
    );
    expect(await getPermissionFilters('articles', 'read')).toEqual(DENY_ALL);
  });

  it('the deny-all filter itself translates to a restriction', async () => {
    mockSession(withPermissions({ owner: { _bogus: 1 } }));
    const q = fakeQuery();
    applyFilterToQuery(q, await getPermissionFilters('articles', 'read'));
    expect(q.calls).toEqual([['eq', 'id', '__DENY_ALL__']]);
  });

  it('returns a fresh deny-all object each time', async () => {
    mockSession({ policies: [] });
    const a = await getPermissionFilters('articles', 'read');
    const b = await getPermissionFilters('articles', 'read');
    expect(a).not.toBe(b);
  });

  it('non-filter errors still propagate (no silent allow)', async () => {
    createAuthenticatedClientMock.mockRejectedValue(new Error('not authenticated'));
    await expect(getPermissionFilters('articles', 'read')).rejects.toThrow('not authenticated');
  });
});

// ─── Caller pattern: catch PermissionError → 403 ─────────────────

describe('applyFilterToQuery (enforcer export) — caller deny behaviour', () => {
  /** The route pattern documented in the package README. */
  async function handle(filter: FilterObject | null): Promise<{ status: number; calls: Call[] }> {
    const q = fakeQuery();
    try {
      applyFilterToQuery(q, filter);
      return { status: 200, calls: q.calls };
    } catch (error) {
      if (error instanceof PermissionError) return { status: error.statusCode, calls: q.calls };
      throw error;
    }
  }

  it('an untranslatable filter becomes a 403 and the query is untouched', async () => {
    const res = await handle({ tenant: { _eq: 't1' }, owner: { id: { _eq: 'u1' } } });
    expect(res).toEqual({ status: 403, calls: [] });
  });

  it('an unresolved variable becomes a 403', async () => {
    expect(await handle({ role: { _in: '$CURRENT_ROLES' } })).toEqual({ status: 403, calls: [] });
  });

  it('the error is an UnsupportedPermissionFilterError and a PermissionError', () => {
    expect(() => applyFilterToQuery(fakeQuery(), { a: { _nope: 1 } })).toThrow(UnsupportedPermissionFilterError);
    expect(() => applyFilterToQuery(fakeQuery(), { a: { _nope: 1 } })).toThrow(PermissionError);
  });

  it('a supported filter is applied normally', async () => {
    expect(await handle({ owner: { _eq: 'u1' } })).toEqual({ status: 200, calls: [['eq', 'owner', 'u1']] });
  });
});
