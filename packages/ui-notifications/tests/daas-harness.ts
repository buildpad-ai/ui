/**
 * A stand-in for the DaaS runtime that runs the shipped service, hook and cron code the way the DaaS
 * does (lib/utils/code-sandbox.ts): a vm context with `process`, `require`, timers and `fetch`
 * blocked, the builtins frozen, and the code compiled as the body of a strict-mode function with a
 * fixed parameter list. Only the services are fake (in-memory items with a small filter evaluator,
 * a unique index, and a recording mailer). Adapted from packages/ui-comments/tests/daas-harness.ts.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

const here = import.meta.dirname;
export const readSchemaFile = (relative: string) => readFileSync(resolve(here, '../schema', relative), 'utf8');

export interface Logger {
  errors: string[];
  logs: string[];
  console: { log: (...a: unknown[]) => void; error: (...a: unknown[]) => void; warn: (...a: unknown[]) => void };
}

export function makeLogger(): Logger {
  const errors: string[] = [];
  const logs: string[] = [];
  const line = (a: unknown[]) => a.map((x) => String(x)).join(' ');
  return {
    errors,
    logs,
    console: { log: (...a) => void logs.push(line(a)), warn: () => {}, error: (...a) => void errors.push(line(a)) },
  };
}

function sandbox(logger: Logger) {
  const context = vm.createContext({
    setTimeout: undefined,
    setInterval: undefined,
    setImmediate: undefined,
    require: undefined,
    process: undefined,
    global: undefined,
    globalThis: undefined,
    import: undefined,
    fetch: undefined,
    console: logger.console,
    URL,
    URLSearchParams,
    TextEncoder,
    TextDecoder,
  });
  vm.runInContext(
    `(function () {
      "use strict";
      for (const target of [Object, Object.prototype, Function, Function.prototype, Array, Array.prototype,
        String, String.prototype, Number, Number.prototype, Boolean, Boolean.prototype, RegExp, RegExp.prototype,
        Promise, Promise.prototype, Map, Map.prototype, Set, Set.prototype]) {
        try { Object.freeze(target); } catch (_) {}
      }
    })();`,
    context,
  );
  return context;
}

function compile(code: string, params: string[], async: boolean, logger: Logger) {
  const keyword = async ? 'async function' : 'function';
  const body = `return (${keyword}(${params.join(', ')}) {\n"use strict";\n${code}\n});`;
  return vm.compileFunction(body, [], { parsingContext: sandbox(logger) })() as (...args: unknown[]) => unknown;
}

export type Row = Record<string, unknown> & { id: string };
export type Store = Record<string, Row[]>;

export interface Sent {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface Accountability {
  user: string | null;
  admin?: boolean;
}

type Filter = Record<string, unknown>;

/** The subset of the DaaS filter language the shipped code uses. */
export function matches(row: Row, filter?: Filter): boolean {
  if (!filter) return true;
  return Object.entries(filter).every(([key, cond]) => {
    if (key === '_and') return (cond as Filter[]).every((f) => matches(row, f));
    if (key === '_or') return (cond as Filter[]).some((f) => matches(row, f));
    const value = row[key] ?? null;
    return Object.entries(cond as Record<string, unknown>).every(([op, arg]) => {
      switch (op) {
        case '_eq': return value === arg;
        case '_neq': return value !== arg;
        case '_in': return (arg as unknown[]).includes(value);
        case '_null': return arg ? value === null : value !== null;
        case '_nnull': return arg ? value !== null : value === null;
        case '_gte': return value !== null && String(value) >= String(arg);
        case '_lte': return value !== null && String(value) <= String(arg);
        default: throw new Error(`fake DaaS: unsupported filter operator ${op}`);
      }
    });
  });
}

const project = (row: Row, fields?: string[]) => {
  if (!fields) return { ...row };
  const out: Record<string, unknown> = {};
  for (const f of fields) if (f in row) out[f] = row[f];
  return out;
};

export interface FakeDaaS {
  logger: Logger;
  sent: Sent[];
  store: Store;
  /** Unique columns per collection (a duplicate insert throws a 23505 error). */
  unique: Record<string, string[]>;
  mailBehaviour: 'ok' | 'result-failure' | 'throw';
  breakCreate: boolean;
  breakReads: boolean;
  /** Collections a non-elevated read throws on (to test fail-closed). */
  breakUserReads: string[];
  /** Called once just before each insert: lets a test slip in a concurrent row. */
  beforeCreate?: (collection: string, data: Record<string, unknown>) => void;
  /** Which rows a non-elevated caller may read. Default: all. */
  canRead: (collection: string, row: Row, who: Accountability | null) => boolean;
  env: Record<string, string>;
  /** Every services.items(...) call. */
  access: Array<{ collection: string; elevated: boolean }>;
  /** Apply to the service source before compiling. */
  configure: (code: string) => string;
  service(): NotificationsService;
  runHook(file: string, meta: Record<string, unknown>, accountability?: Accountability | null, configure?: (c: string) => string): Promise<void>;
  runFilter(file: string, payload: unknown, accountability: Accountability | null, configure?: (c: string) => string): Promise<unknown>;
  runCron(file: string, configure?: (c: string) => string): Promise<Record<string, unknown>>;
}

export interface NotifyResult {
  created: number;
  merged: number;
  skipped: number;
  ids: string[];
}
export interface NotificationsService {
  notify(rows: unknown): Promise<NotifyResult>;
  audience(ids: unknown, actor?: unknown): string[];
  markEmailed(ids: unknown): Promise<number>;
}

/** Replace one exact CONFIG line; throws if it has moved so a test never runs the wrong config. */
export const edit = (from: string, to: string) => (code: string) => {
  if (!code.includes(from)) throw new Error(`CONFIG no longer contains "${from}"`);
  return code.replace(from, to);
};

export function fakeDaaS(store: Store): FakeDaaS {
  const logger = makeLogger();
  let seq = 0;
  const daas: FakeDaaS = {
    logger,
    sent: [],
    store,
    unique: { notifications: ['dedupe_key'] },
    mailBehaviour: 'ok',
    breakCreate: false,
    breakReads: false,
    breakUserReads: [],
    canRead: () => true,
    env: {},
    access: [],
    configure: (c) => c,
    service: () => {
      throw new Error('not built');
    },
    runHook: async () => {},
    runFilter: async () => undefined,
    runCron: async () => ({}),
  };

  const servicesFor = (who: Accountability | null) => ({
    async items(collection: string, opts?: { elevated?: boolean }) {
      const elevated = !!opts?.elevated || who === null || who.admin === true;
      daas.access.push({ collection, elevated: !!opts?.elevated });
      store[collection] ??= [];
      const rows = () => store[collection];
      const visible = () => rows().filter((r) => elevated || daas.canRead(collection, r, who));
      const keysOf = (query: { filter?: Filter }) => visible().filter((r) => matches(r, query.filter)).map((r) => r.id);
      const update = (keys: string[], data: Record<string, unknown>) => {
        for (const r of rows()) if (keys.includes(r.id)) Object.assign(r, data);
        return keys;
      };
      return {
        async readOne(id: string, query: { fields?: string[] } = {}) {
          if (daas.breakReads) throw new Error('database is down');
          const row = visible().find((r) => r.id === id);
          if (!row) throw new Error(`Item not found: ${collection}/${id}`);
          return project(row, query.fields);
        },
        async readByQuery(query: { filter?: Filter; fields?: string[]; limit?: number; sort?: string[] } = {}) {
          if (daas.breakReads) throw new Error('database is down');
          if (!elevated && daas.breakUserReads.includes(collection)) throw new Error('permission check failed');
          let hit = visible().filter((r) => matches(r, query.filter));
          const sort = query.sort?.[0];
          if (sort) {
            const desc = sort.startsWith('-');
            const f = sort.replace(/^-/, '');
            hit = [...hit].sort((a, b) => (String(a[f]) < String(b[f]) ? -1 : 1) * (desc ? -1 : 1));
          }
          const limit = query.limit == null || query.limit < 0 ? hit.length : query.limit;
          return hit.slice(0, limit).map((r) => project(r, query.fields));
        },
        async createOne(data: Record<string, unknown>) {
          if (daas.breakCreate) throw new Error('insert failed');
          daas.beforeCreate?.(collection, data);
          for (const col of daas.unique[collection] ?? []) {
            if (data[col] != null && rows().some((r) => r[col] === data[col])) {
              throw Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' });
            }
          }
          const id = (data.id as string) ?? `N${++seq}`;
          rows().push({ read_at: null, emailed_at: null, ...data, id } as Row);
          return id;
        },
        async updateOne(id: string, data: Record<string, unknown>) {
          update([id], data);
          return id;
        },
        async updateMany(keys: string[], data: Record<string, unknown>) {
          return update(keys, data);
        },
        async updateByQuery(query: { filter?: Filter }, data: Record<string, unknown>) {
          return update(keysOf(query), data);
        },
      };
    },
    async mail(message: Sent) {
      if (daas.mailBehaviour === 'throw') throw new Error('smtp is down');
      if (daas.mailBehaviour === 'result-failure') return { success: false, error: 'mailbox full' };
      daas.sent.push(message);
      return { success: true };
    },
    async custom(name: string) {
      if (name !== 'notifications') throw new Error(`No such service: ${name}`);
      return daas.service();
    },
    env: daas.env,
  });

  let instance: NotificationsService | null = null;
  daas.service = () => {
    if (!instance) {
      const factory = compile(daas.configure(readSchemaFile('services/notifications.js')), ['context'], false, logger);
      instance = factory({ services: servicesFor(null), env: daas.env }) as NotificationsService;
    }
    return instance;
  };

  daas.runHook = async (file, meta, accountability = null, configure = (c) => c) => {
    const handler = compile(configure(readSchemaFile(file)), ['meta', 'context', 'services', 'console', 'JSON', 'Date', 'Math'], true, logger);
    const services = servicesFor(accountability);
    await handler(meta, { accountability, services }, services, logger.console, JSON, Date, Math);
  };

  daas.runFilter = async (file, payload, accountability, configure = (c) => c) => {
    const handler = compile(
      configure(readSchemaFile(file)),
      ['payload', 'meta', 'context', 'services', 'console', 'JSON', 'Date', 'Math'],
      true,
      logger,
    );
    const services = servicesFor(accountability);
    return handler(payload, { collection: 'notifications' }, { accountability, services }, services, logger.console, JSON, Date, Math);
  };

  daas.runCron = async (file, configure = (c) => c) => {
    const handler = compile(configure(readSchemaFile(file)), ['context', 'services', 'console', 'JSON', 'Date', 'Math'], true, logger);
    const services = servicesFor(null);
    return (await handler({ env: daas.env }, services, logger.console, JSON, Date, Math)) as Record<string, unknown>;
  };

  return daas;
}
