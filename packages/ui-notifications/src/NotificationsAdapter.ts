/**
 * How notifications reach their data. `notificationsItemsAdapter` talks to the notifications collection
 * through the app's `/api/items/...` routes, so DaaS applies the signed-in user's own permissions;
 * the Storybook mock (`_mockAdapter.ts`) keeps everything in memory.
 *
 * Every request carries `recipient = meId` in ONE JSON `filter` value. Filtering is always done by
 * the server, never over rows already loaded.
 */
import { apiRequest } from '@buildpad/services';
import { buildFilter } from './core/filters';
import type { Filter, Notification } from './core/types';

export interface ListParams {
  /** The tab's clause (logical field names), ANDed with the recipient clause. */
  filter?: Filter;
  /** Cursor: only rows with `created_at <= before`. */
  before?: string;
  limit: number;
}

export interface NotificationsAdapter {
  /** Newest first. */
  list(params: ListParams): Promise<Notification[]>;
  /** Unread count, capped at `UNREAD_CAP` (show "99+" at the cap). */
  unreadCount(): Promise<number>;
  markRead(ids: string[]): Promise<void>;
  markUnread?(ids: string[]): Promise<void>;
  markAllRead(): Promise<void>;
  /** One notification of mine by id, or null. Used to show a selected row that is not loaded. */
  get?(id: string): Promise<Notification | null>;
}

/** The unread count asks for at most this many ids (never `limit=-1`). */
export const UNREAD_CAP = 100;

export type NotificationFields = Record<keyof Notification, string>;

export const DEFAULT_NOTIFICATION_FIELDS: NotificationFields = {
  id: 'id',
  recipient: 'recipient',
  recipient_email: 'recipient_email',
  type: 'type',
  title: 'title',
  message: 'message',
  link: 'link',
  actor: 'actor',
  actor_name: 'actor_name',
  source_collection: 'source_collection',
  source_id: 'source_id',
  dedupe_key: 'dedupe_key',
  read_at: 'read_at',
  emailed_at: 'emailed_at',
  created_at: 'created_at',
};

/**
 * The fields a signed-in person may read (the shipped read permission in
 * `schema/notifications.schema.json` grants exactly these). `list()` and `get()` ask only for these:
 * asking for a column the permission leaves out (recipient_email, dedupe_key, emailed_at) makes the
 * DaaS answer 403.
 */
export const READABLE_NOTIFICATION_FIELDS = [
  'id',
  'recipient',
  'type',
  'title',
  'message',
  'link',
  'actor',
  'actor_name',
  'source_collection',
  'source_id',
  'read_at',
  'created_at',
] as const satisfies ReadonlyArray<keyof Notification>;

type Request = <T>(path: string, options?: RequestInit) => Promise<T>;

export interface NotificationsItemsAdapterOptions {
  /** Default `notifications`. */
  collection?: string;
  /** The signed-in user's id; every request is limited to rows where `recipient = meId`. */
  meId: string;
  /** Column names, when the collection does not use the defaults. */
  fields?: Partial<NotificationFields>;
  /** Replaces `apiRequest` (tests, custom transports). */
  request?: Request;
  /** Clock for `read_at` (tests). */
  now?: () => Date;
}

/** Rename logical field keys in a filter to the collection's columns (deep). */
export function mapFilterFields(filter: unknown, fields: NotificationFields): unknown {
  if (Array.isArray(filter)) return filter.map((f) => mapFilterFields(f, fields));
  if (!filter || typeof filter !== 'object') return filter;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(filter as Record<string, unknown>)) {
    const column = (fields as Record<string, string>)[key] ?? key;
    out[column] = mapFilterFields(value, fields);
  }
  return out;
}

export function notificationsItemsAdapter(options: NotificationsItemsAdapterOptions): NotificationsAdapter {
  const collection = options.collection ?? 'notifications';
  const f: NotificationFields = { ...DEFAULT_NOTIFICATION_FIELDS, ...options.fields };
  const request: Request = options.request ?? ((path, init) => apiRequest(path, init));
  const now = options.now ?? (() => new Date());
  const base = `/api/items/${encodeURIComponent(collection)}`;
  const filterFields = { recipient: f.recipient, readAt: f.read_at, createdAt: f.created_at, id: f.id };
  const mine = (...clauses: Array<Filter | undefined>) =>
    buildFilter(options.meId, clauses.map((c) => (c ? (mapFilterFields(c, f) as Filter) : undefined)), filterFields);
  const columns = READABLE_NOTIFICATION_FIELDS.map((k) => f[k]).join(',');

  const toNotification = (row: Record<string, unknown>): Notification => {
    const n: Record<string, unknown> = {};
    for (const key of READABLE_NOTIFICATION_FIELDS) if (row[f[key]] !== undefined) n[key] = row[f[key]];
    return n as unknown as Notification;
  };

  const query = (params: Record<string, string>) => new URLSearchParams(params).toString();

  const fetchRows = async (filter: Filter, limit: number, fields = columns) => {
    const qs = query({ filter: JSON.stringify(filter), sort: `-${f.created_at}`, limit: String(limit), fields });
    const res = await request<{ data?: Array<Record<string, unknown>> }>(`${base}?${qs}`);
    return res?.data ?? [];
  };

  const patchWhere = (filter: Filter, body: Record<string, unknown>) =>
    request<unknown>(`${base}?${query({ filter: JSON.stringify(filter) })}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });

  return {
    async list({ filter, before, limit }) {
      const cursor = before ? { created_at: { _lte: before } } : undefined;
      const rows = await fetchRows(mine(filter, cursor), Math.max(1, Math.floor(limit)));
      return rows.map(toNotification);
    },
    async unreadCount() {
      const rows = await fetchRows(mine({ read_at: { _null: true } }), UNREAD_CAP, f.id);
      return Math.min(rows.length, UNREAD_CAP);
    },
    async markRead(ids) {
      if (!ids.length) return;
      // read_at _null keeps the first read time of a row already read elsewhere.
      await patchWhere(mine({ id: { _in: ids } }, { read_at: { _null: true } }), { [f.read_at]: now().toISOString() });
    },
    async markUnread(ids) {
      if (!ids.length) return;
      await patchWhere(mine({ id: { _in: ids } }), { [f.read_at]: null });
    },
    async markAllRead() {
      await patchWhere(mine({ read_at: { _null: true } }), { [f.read_at]: now().toISOString() });
    },
    async get(id) {
      const rows = await fetchRows(mine({ id: { _eq: id } }), 1);
      return rows[0] ? toNotification(rows[0]) : null;
    },
  };
}
