/** An in-memory `NotificationsAdapter` for the stories and the tests. */
import type { ListParams, NotificationsAdapter } from './NotificationsAdapter';
import type { Filter, Notification } from './core/types';

export interface MockOptions {
  meId?: string;
  items?: Notification[];
  latency?: number;
  failOn?: Array<'list' | 'unreadCount' | 'markRead' | 'markUnread' | 'markAllRead' | 'get'>;
  markUnread?: boolean;
  get?: boolean;
}

export interface MockAdapter extends NotificationsAdapter {
  items: Notification[];
  calls: string[];
  /** Add a notification as if the server created it. */
  push(n: Notification): void;
}

/** Evaluate the small subset of DaaS filters the UI sends. */
export function matches(n: Notification, filter: Filter | undefined): boolean {
  if (!filter) return true;
  return Object.entries(filter).every(([key, cond]) => {
    if (key === '_and') return (cond as Filter[]).every((c) => matches(n, c));
    if (key === '_or') return (cond as Filter[]).some((c) => matches(n, c));
    const value = (n as unknown as Record<string, unknown>)[key];
    return Object.entries(cond as Record<string, unknown>).every(([op, arg]) => {
      switch (op) {
        case '_eq': return value === arg;
        case '_neq': return value !== arg;
        case '_in': return (arg as unknown[]).includes(value);
        case '_null': return arg ? value == null : value != null;
        case '_lte': return String(value) <= String(arg);
        case '_gte': return String(value) >= String(arg);
        default: return true;
      }
    });
  });
}

export function mockAdapter(options: MockOptions = {}): MockAdapter {
  const me = options.meId ?? 'me';
  const fail = new Set(options.failOn ?? []);
  const wait = () => new Promise((r) => setTimeout(r, options.latency ?? 0));
  const items = [...(options.items ?? [])];
  const mine = () => items.filter((n) => n.recipient === me).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const step = async (name: string, detail = '') => {
    adapter.calls.push(detail ? `${name}:${detail}` : name);
    await wait();
    if (fail.has(name as never)) throw new Error(`${name} failed`);
  };
  const adapter: MockAdapter = {
    items,
    calls: [],
    push(n) {
      items.push(n);
    },
    async list({ filter, before, limit }: ListParams) {
      await step('list', JSON.stringify({ filter: filter ?? null, before: before ?? null, limit }));
      return mine()
        .filter((n) => matches(n, filter) && (!before || n.created_at <= before))
        .slice(0, limit)
        .map((n) => ({ ...n }));
    },
    async unreadCount() {
      await step('unreadCount');
      return Math.min(100, mine().filter((n) => !n.read_at).length);
    },
    async markRead(ids) {
      await step('markRead', ids.join(','));
      const at = new Date().toISOString();
      for (const n of mine()) if (ids.includes(n.id) && !n.read_at) n.read_at = at;
    },
    async markAllRead() {
      await step('markAllRead');
      const at = new Date().toISOString();
      for (const n of mine()) if (!n.read_at) n.read_at = at;
    },
  };
  if (options.markUnread !== false) {
    adapter.markUnread = async (ids) => {
      await step('markUnread', ids.join(','));
      for (const n of mine()) if (ids.includes(n.id)) n.read_at = null;
    };
  }
  if (options.get !== false) {
    adapter.get = async (id) => {
      await step('get', id);
      const n = mine().find((x) => x.id === id);
      return n ? { ...n } : null;
    };
  }
  return adapter;
}

/** Sample rows for the stories: spread over the last couple of weeks. */
export function sampleNotifications(me = 'me', count = 45, now = Date.now()): Notification[] {
  const types = ['mention', 'comment', 'reply', 'assigned', 'status', 'system', 'info', 'invoice_overdue'];
  return Array.from({ length: count }, (_, i) => {
    const type = types[i % types.length];
    return {
      id: `n${i + 1}`,
      recipient: me,
      type,
      title: `${type.replace(/_/g, ' ')} on Ticket #${100 + i}`,
      message: i % 3 === 0 ? `@[Ana Lim](user:ana) mentioned you: can you check ticket #${100 + i}?` : `Something happened on ticket #${100 + i}.`,
      link: `/tickets/${100 + i}`,
      actor: 'ana',
      actor_name: 'Ana Lim',
      source_collection: 'tickets',
      source_id: String(100 + i),
      read_at: i % 4 === 0 ? null : new Date(now - i * 3_600_000).toISOString(),
      created_at: new Date(now - i * 7 * 3_600_000).toISOString(),
    };
  });
}
