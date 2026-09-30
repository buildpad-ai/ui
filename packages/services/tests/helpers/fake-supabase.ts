/**
 * Fake Supabase boundary for the auth tests.
 *
 * Only the outermost boundary is faked: the Supabase client factories
 * (`createClient` / `createServerClient`), the request headers and the cookie
 * store that `configureAuth()` receives. The real `session.ts` / `enforcer.ts`
 * code runs on top of it. Every client records the calls made on it so tests
 * can assert which client (anon, service role, cookie/server) was used for
 * which query.
 */

import { vi } from 'vitest';
import type { AuthClientConfig, User } from '../../src/auth/session';

export interface Result {
  data: unknown;
  error: unknown;
}

export type Call = [method: string, ...args: unknown[]];

/** A table result, or a function of the recorded query calls (e.g. to answer by `.eq()` value). */
export type TableSpec = Result | ((query: Call[]) => Result);
export type RpcSpec = Result | ((params: Record<string, unknown>) => Result);

export interface FakeDbSpec {
  tables?: Record<string, TableSpec>;
  rpc?: Record<string, RpcSpec>;
  /** What `auth.getUser()` resolves to (or rejects with, when a function throws). */
  getUser?: { user: User | null; error?: { message: string } | null } | (() => never);
}

export type ClientLabel = 'anon' | 'service' | 'server' | 'other';

export const SUPABASE_URL = 'http://supabase.test';
export const ANON_KEY = 'anon-key';
export const SERVICE_KEY = 'service-role-key';

export class FakeSupabase {
  /** One entry per `.from()` call: `[['from', table], ['select', …], ['eq', …], …]`. */
  readonly queries: Call[][] = [];
  readonly rpcCalls: Array<[fn: string, params: Record<string, unknown>]> = [];
  readonly auth: { getUser: ReturnType<typeof vi.fn> };

  constructor(
    readonly label: ClientLabel,
    readonly key: string,
    readonly options: Record<string, unknown> | undefined,
    private readonly spec: FakeDbSpec
  ) {
    this.auth = {
      getUser: vi.fn(async () => {
        const g = this.spec.getUser;
        if (typeof g === 'function') return g();
        return { data: { user: g?.user ?? null }, error: g?.error ?? null };
      }),
    };
  }

  from(table: string): unknown {
    const calls: Call[] = [['from', table]];
    this.queries.push(calls);
    const spec = this.spec.tables?.[table];
    if (spec === undefined) throw new Error(`unexpected table ${table}`);
    const resolve = (): Promise<Result> =>
      Promise.resolve(typeof spec === 'function' ? spec(calls) : spec);

    const q: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'in', 'order', 'limit']) {
      q[m] = (...args: unknown[]) => {
        calls.push([m, ...args]);
        return q;
      };
    }
    q.single = () => {
      calls.push(['single']);
      return resolve();
    };
    q.maybeSingle = () => {
      calls.push(['maybeSingle']);
      return resolve();
    };
    q.then = (onOk: (r: Result) => unknown, onErr: (e: unknown) => unknown) =>
      resolve().then(onOk, onErr);
    return q;
  }

  async rpc(fn: string, params: Record<string, unknown>): Promise<Result> {
    this.rpcCalls.push([fn, params]);
    const spec = this.spec.rpc?.[fn];
    if (spec === undefined) throw new Error(`unexpected rpc ${fn}`);
    return typeof spec === 'function' ? spec(params) : spec;
  }

  /** Tables queried on this client, in order. */
  tables(): string[] {
    return this.queries.map((q) => q[0][1] as string);
  }
}

/** Value passed to `.eq(column, …)` in a recorded query, if any. */
export function eqValue(query: Call[], column: string): unknown {
  const call = query.find((c) => c[0] === 'eq' && c[1] === column);
  return call ? call[2] : undefined;
}

export interface FakeCookieStore {
  getAll: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
}

export interface FakeAuthEnv {
  config: AuthClientConfig;
  /** Every client created, in creation order. */
  clients: FakeSupabase[];
  createClient: ReturnType<typeof vi.fn>;
  createServerClient: ReturnType<typeof vi.fn>;
  getHeaders: ReturnType<typeof vi.fn>;
  getCookies: ReturnType<typeof vi.fn>;
  cookieStore: FakeCookieStore;
  byLabel(label: ClientLabel): FakeSupabase[];
}

export interface FakeAuthOptions {
  /** Value of the `Authorization` request header (omit for none). */
  authorization?: string;
  /** Service role key; pass `null` to leave it unconfigured. */
  serviceKey?: string | null;
  cookieConfig?: AuthClientConfig['cookieConfig'];
  cookies?: { name: string; value: string }[];
  db?: FakeDbSpec;
}

/** Build an `AuthClientConfig` whose factories hand out recording fake clients. */
export function fakeAuthEnv(opts: FakeAuthOptions = {}): FakeAuthEnv {
  const db = opts.db ?? {};
  const clients: FakeSupabase[] = [];
  const serviceKey = opts.serviceKey === null ? undefined : (opts.serviceKey ?? SERVICE_KEY);

  const labelFor = (key: string): ClientLabel =>
    key === ANON_KEY ? 'anon' : key === SERVICE_KEY ? 'service' : 'other';

  const createClient = vi.fn((_url: string, key: string, options?: Record<string, unknown>) => {
    const c = new FakeSupabase(labelFor(key), key, options, db);
    clients.push(c);
    return c;
  });
  const createServerClient = vi.fn(
    (_url: string, key: string, options: Record<string, unknown>) => {
      const c = new FakeSupabase(key === ANON_KEY ? 'server' : 'other', key, options, db);
      clients.push(c);
      return c;
    }
  );

  const headers = new Headers();
  if (opts.authorization !== undefined) headers.set('authorization', opts.authorization);
  const getHeaders = vi.fn(async () => headers);

  const cookieStore: FakeCookieStore = {
    getAll: vi.fn(() => opts.cookies ?? []),
    set: vi.fn(),
  };
  const getCookies = vi.fn(async () => cookieStore);

  const config: AuthClientConfig = {
    supabaseUrl: SUPABASE_URL,
    supabaseAnonKey: ANON_KEY,
    supabaseServiceKey: serviceKey,
    cookieConfig: opts.cookieConfig,
    getHeaders,
    getCookies,
    createClient: createClient as unknown as AuthClientConfig['createClient'],
    createServerClient: createServerClient as unknown as AuthClientConfig['createServerClient'],
  };

  return {
    config,
    clients,
    createClient,
    createServerClient,
    getHeaders,
    getCookies,
    cookieStore,
    byLabel: (label) => clients.filter((c) => c.label === label),
  };
}

/** A three-segment token, recognised by session.ts as a JWT. */
export const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1MSJ9.c2lnbmF0dXJl';
