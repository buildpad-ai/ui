import { describe, expect, it, vi } from 'vitest';
import { notificationsItemsAdapter, mapFilterFields, DEFAULT_NOTIFICATION_FIELDS, READABLE_NOTIFICATION_FIELDS, UNREAD_CAP } from '../src/NotificationsAdapter';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ME } from './fixtures';

vi.mock('@buildpad/services', async (orig) => ({ ...(await orig<object>()), apiRequest: vi.fn(async () => ({ data: [] })) }));

const NOW = new Date('2026-11-17T10:00:00.000Z');
const setup = (data: unknown[] = [], extra: Partial<Parameters<typeof notificationsItemsAdapter>[0]> = {}) => {
  const request = vi.fn(async (_path: string, _init?: RequestInit) => ({ data }));
  const adapter = notificationsItemsAdapter({ meId: ME, request: request as never, now: () => NOW, ...extra });
  const call = (i = 0) => {
    const [path, init] = request.mock.calls[i];
    const url = new URL(path, 'http://x');
    return {
      path: url.pathname,
      filter: url.searchParams.get('filter') ? JSON.parse(url.searchParams.get('filter')!) : null,
      params: url.searchParams,
      init,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    };
  };
  return { adapter, request, call };
};
const recipient = { recipient: { _eq: ME } };
const schema = JSON.parse(readFileSync(resolve(import.meta.dirname, '../schema/notifications.schema.json'), 'utf8'));
const permitted: string[] = schema.permissions.notifications.read.fields;

describe('notificationsItemsAdapter', () => {
  it('lists with one JSON filter, sort and limit', async () => {
    const { adapter, call } = setup([{ id: 'a', title: 'T', created_at: 'x', extra: 1 }]);
    const rows = await adapter.list({ filter: { type: { _eq: 'mention' } }, before: '2026-11-01T00:00:00Z', limit: 41 });
    expect(rows).toEqual([{ id: 'a', title: 'T', created_at: 'x' }]);
    const c = call();
    expect(c.path).toBe('/api/items/notifications');
    expect(c.params.getAll('filter')).toHaveLength(1);
    expect(c.filter).toEqual({ _and: [recipient, { type: { _eq: 'mention' } }, { created_at: { _lte: '2026-11-01T00:00:00Z' } }] });
    expect(c.params.get('sort')).toBe('-created_at');
    expect(c.params.get('limit')).toBe('41');
  });

  it('list() and get() ask only for fields the shipped read permission grants (no 403)', async () => {
    const { adapter, call } = setup([{ id: 'a', created_at: 'x', dedupe_key: 'k', emailed_at: 'y', recipient_email: 'e' }]);
    const rows = await adapter.list({ limit: 5 });
    await adapter.get!('a');
    for (const i of [0, 1]) {
      const asked = call(i).params.get('fields')!.split(',');
      expect(asked.filter((f) => !permitted.includes(f)), `call ${i}`).toEqual([]);
      expect([...asked].sort()).toEqual([...permitted].sort());
    }
    expect(rows[0]).not.toHaveProperty('dedupe_key');
    expect(rows[0]).not.toHaveProperty('emailed_at');
  });

  it('never sends limit=-1', async () => {
    const { adapter, call } = setup();
    await adapter.list({ limit: -1 });
    expect(call().params.get('limit')).toBe('1');
    expect(call().filter).toEqual({ _and: [recipient] });
  });

  it('counts unread by ids, capped', async () => {
    const { adapter, call } = setup(Array.from({ length: 100 }, (_, i) => ({ id: String(i) })));
    expect(await adapter.unreadCount()).toBe(UNREAD_CAP);
    expect(call().params.get('limit')).toBe('100');
    expect(call().params.get('fields')).toBe('id');
    expect(call().filter).toEqual({ _and: [recipient, { read_at: { _null: true } }] });
  });

  it('marks read with a filtered PATCH that keeps the first read_at', async () => {
    const { adapter, call, request } = setup();
    await adapter.markRead([]);
    expect(request).not.toHaveBeenCalled();
    await adapter.markRead(['a', 'b']);
    const c = call();
    expect(c.init?.method).toBe('PATCH');
    expect(c.filter).toEqual({ _and: [recipient, { id: { _in: ['a', 'b'] } }, { read_at: { _null: true } }] });
    expect(c.body).toEqual({ read_at: NOW.toISOString() });
    expect(c.body).not.toHaveProperty('keys');
  });

  it('marks all read with ONE PATCH', async () => {
    const { adapter, call, request } = setup();
    await adapter.markAllRead();
    expect(request).toHaveBeenCalledTimes(1);
    expect(call().filter).toEqual({ _and: [recipient, { read_at: { _null: true } }] });
    expect(call().body).toEqual({ read_at: NOW.toISOString() });
  });

  it('marks unread and gets one', async () => {
    const { adapter, call, request } = setup([{ id: 'a' }]);
    await adapter.markUnread!([]);
    await adapter.markUnread!(['a']);
    expect(call().body).toEqual({ read_at: null });
    expect(call().filter).toEqual({ _and: [recipient, { id: { _in: ['a'] } }] });
    expect(await adapter.get!('a')).toEqual({ id: 'a' });
    expect(call(1).filter).toEqual({ _and: [recipient, { id: { _eq: 'a' } }] });
    request.mockResolvedValueOnce({ data: [] });
    expect(await adapter.get!('zz')).toBeNull();
    request.mockResolvedValueOnce(undefined as never);
    expect(await adapter.list({ limit: 1 })).toEqual([]);
  });

  it('maps custom collection and field names both ways', async () => {
    const { adapter, call } = setup([{ uid: 'a', seen_on: null, at: 't' }], {
      collection: 'app_alerts',
      fields: { id: 'uid', read_at: 'seen_on', recipient: 'to_user', created_at: 'at' },
    });
    expect(await adapter.list({ filter: { read_at: { _null: true } }, before: 'c', limit: 5 })).toEqual([{ id: 'a', read_at: null, created_at: 't' }]);
    const c = call();
    expect(c.path).toBe('/api/items/app_alerts');
    expect(c.filter).toEqual({ _and: [{ to_user: { _eq: ME } }, { seen_on: { _null: true } }, { at: { _lte: 'c' } }] });
    expect(c.params.get('sort')).toBe('-at');
    await adapter.markAllRead();
    expect(call(1).body).toEqual({ seen_on: NOW.toISOString() });
  });

  it('mapFilterFields walks arrays and leaves scalars', () => {
    expect(mapFilterFields({ _or: [{ read_at: { _null: true } }, 3] }, { ...DEFAULT_NOTIFICATION_FIELDS, read_at: 'r' })).toEqual({
      _or: [{ r: { _null: true } }, 3],
    });
  });

  it('defaults to apiRequest from @buildpad/services', async () => {
    const services = await import('@buildpad/services');
    const adapter = notificationsItemsAdapter({ meId: ME });
    await adapter.markAllRead();
    await adapter.list({ limit: 2 });
    expect(services.apiRequest).toHaveBeenCalledTimes(2);
    expect(String((services.apiRequest as ReturnType<typeof vi.fn>).mock.calls[0][0])).toContain('/api/items/notifications?filter=');
  });
});
