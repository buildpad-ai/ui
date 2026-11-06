/**
 * A stand-in for the DaaS runtime that runs the shipped hook and service code the way the DaaS
 * does (lib/utils/code-sandbox.ts): a vm context with `process`, `require`, timers and `fetch`
 * blocked, the builtins frozen, and the code compiled as the body of a strict-mode function with a
 * fixed parameter list. Only the services are fake (in-memory items, a recording mailer).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

const here = import.meta.dirname;
export const readSchemaFile = (relative: string) => readFileSync(resolve(here, '../schema', relative), 'utf8');

export interface Logger {
  errors: string[];
  console: { log: (...a: unknown[]) => void; error: (...a: unknown[]) => void; warn: (...a: unknown[]) => void };
}

export function makeLogger(): Logger {
  const errors: string[] = [];
  const line = (a: unknown[]) => a.map((x) => String(x)).join(' ');
  return { errors, console: { log: () => {}, warn: () => {}, error: (...a) => void errors.push(line(a)) } };
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
    context
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
export type MailBehaviour = 'ok' | 'result-failure' | 'throw';

/** Compile code the way the DaaS does and run it with these arguments (to check what the sandbox blocks). */
export function runSandboxed(code: string, params: string[] = [], args: unknown[] = []) {
  return compile(code, params, false, makeLogger())(...args);
}
export interface Sent {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
}

export interface FakeDaaS {
  logger: Logger;
  sent: Sent[];
  /** Every `services.items(...)` call: which collection, and whether it was elevated. */
  access: Array<{ collection: string; elevated: boolean }>;
  store: Store;
  mailBehaviour: MailBehaviour;
  /** Addresses whose mail is refused (the others still go). */
  failTo: string[];
  /** Make every items read throw. */
  breakReads: boolean;
  /** How long each `services.mail` call takes, in ms (0: it resolves at once). */
  mailLatencyMs: number;
  /** The most `services.mail` calls that were in progress at the same moment. */
  maxMailsInFlight: number;
  env: Record<string, string>;
  /** Run a hook body with a create event. */
  runHook(file: string, meta: Record<string, unknown>): Promise<void>;
  /** The compiled mail service. */
  service(): { notifyMentions(id: string): Promise<{ sent: string[]; skipped: string[] }>; notifyReply(id: string): Promise<{ sent: string[]; skipped: string[] }> };
}

const project = (row: Row, fields?: string[]) => {
  if (!fields) return { ...row };
  const out: Record<string, unknown> = {};
  for (const f of fields) if (f in row) out[f] = row[f];
  return out;
};

/**
 * The edit an integrator makes to `CONFIG` before pasting the service. The default is the documented
 * setup: the add-comments create hook (step 3) already turns mentions of non-readers into text.
 * Throws if the line it edits has moved, so a test can never quietly run the unconfigured service.
 */
export const trustCreateHook = (code: string) => {
  const from = 'mentionsCheckedByCreateHook: false,';
  if (!code.includes(from)) throw new Error(`comment_mail CONFIG no longer contains "${from}"`);
  return code.replace(from, 'mentionsCheckedByCreateHook: true,');
};

/** The service exactly as shipped: no access rule configured. */
export const asShipped = (code: string) => code;

export interface FakeDaaSOptions {
  serviceFile?: string;
  /** Applied to the service's source before it is compiled. Defaults to `trustCreateHook`. */
  configure?: (code: string) => string;
}

export function fakeDaaS(
  store: Store,
  { serviceFile = 'services/comment_mail.js', configure = trustCreateHook }: FakeDaaSOptions = {},
): FakeDaaS {
  const logger = makeLogger();
  const daas: FakeDaaS = {
    logger,
    sent: [],
    access: [],
    store,
    mailBehaviour: 'ok',
    failTo: [],
    breakReads: false,
    mailLatencyMs: 0,
    maxMailsInFlight: 0,
    env: {},
    runHook: async () => {},
    service: () => {
      throw new Error('not built');
    },
  };

  let inFlight = 0;
  const services = {
    async items(collection: string, opts?: { elevated?: boolean }) {
      daas.access.push({ collection, elevated: !!opts?.elevated });
      const rows = () => store[collection] ?? [];
      return {
        async readOne(id: string, query: { fields?: string[] } = {}) {
          if (daas.breakReads) throw new Error('database is down');
          const row = rows().find((r) => r.id === id);
          if (!row) throw new Error(`Item not found: ${collection}/${id}`);
          return project(row, query.fields);
        },
        async readByQuery(query: { filter?: { id?: { _in?: string[] } }; fields?: string[]; limit?: number } = {}) {
          if (daas.breakReads) throw new Error('database is down');
          const ids = query.filter?.id?._in;
          const hit = rows().filter((r) => !ids || ids.includes(r.id));
          return hit.slice(0, query.limit ?? hit.length).map((r) => project(r, query.fields));
        },
      };
    },
    async mail(message: Sent) {
      inFlight += 1;
      daas.maxMailsInFlight = Math.max(daas.maxMailsInFlight, inFlight);
      try {
        if (daas.mailLatencyMs > 0) await new Promise((r) => setTimeout(r, daas.mailLatencyMs));
        if (daas.mailBehaviour === 'throw') throw new Error('smtp is down');
        if (daas.mailBehaviour === 'result-failure' || daas.failTo.includes(message.to)) return { success: false, error: 'mailbox full' };
        daas.sent.push(message);
        return { success: true };
      } finally {
        inFlight -= 1;
      }
    },
    async custom(name: string) {
      if (name !== 'comment_mail') throw new Error(`No such service: ${name}`);
      return daas.service();
    },
  };

  let instance: ReturnType<FakeDaaS['service']> | null = null;
  daas.service = () => {
    // The real services object is built per call, so env is read when the service is made.
    const factory = compile(configure(readSchemaFile(serviceFile)), ['context'], false, logger);
    instance ??= factory({ services: { ...services, env: daas.env }, env: daas.env }) as ReturnType<FakeDaaS['service']>;
    return instance;
  };

  daas.runHook = async (file, meta) => {
    const handler = compile(readSchemaFile(file), ['meta', 'context', 'services', 'console', 'JSON', 'Date', 'Math'], true, logger);
    await handler(meta, { accountability: null }, services, logger.console, JSON, Date, Math);
  };
  return daas;
}
