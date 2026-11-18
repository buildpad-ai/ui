import { describe, expect, it } from 'vitest';
import { fakeDaaS, type Row } from './daas-harness';

const file = 'hooks/notifications-visible.hook.js';
const ME = 'u-me';
const n = (nid: string, source_collection: string | null, source_id: string | null): Row => ({ id: nid, recipient: ME, source_collection, source_id });

function world() {
  const d = fakeDaaS({
    tickets: [{ id: 'T1' }, { id: 'T2' }],
    deals: [{ id: 'D1' }],
    notifications: [n('n1', 'tickets', 'T1'), n('n2', 'tickets', 'T2'), n('n3', 'deals', 'D1'), n('n4', null, null)],
  });
  // The reader may read T1 and D1, not T2.
  d.canRead = (collection, row) => !(collection === 'tickets' && row.id === 'T2');
  return d;
}
const ids = (rows: unknown) => (rows as Row[]).map((r) => r.id);

describe('notifications-visible', () => {
  it('drops rows whose source the reader cannot read, keeps rows without a source', async () => {
    const d = world();
    expect(ids(await d.runFilter(file, d.store.notifications.map((r) => ({ ...r })), { user: ME }))).toEqual(['n1', 'n3', 'n4']);
  });

  it('checks once per source collection (memoised)', async () => {
    const d = world();
    await d.runFilter(file, d.store.notifications.map((r) => ({ ...r })), { user: ME });
    expect(d.access.filter((a) => a.collection === 'tickets')).toHaveLength(1);
  });

  it('looks up the source of rows read without it', async () => {
    const d = world();
    expect(ids(await d.runFilter(file, [{ id: 'n1' }, { id: 'n2' }, { id: 'gone' }], { user: ME }))).toEqual(['n1']);
  });

  it('lets admins and the system through without a lookup', async () => {
    const d = world();
    const rows = d.store.notifications.map((r) => ({ ...r }));
    expect(ids(await d.runFilter(file, rows, { user: ME, admin: true }))).toHaveLength(4);
    expect(ids(await d.runFilter(file, rows, null))).toHaveLength(4);
    expect(d.access).toHaveLength(0);
  });

  it('fails closed when a check fails', async () => {
    const d = world();
    d.breakUserReads = ['tickets'];
    expect(ids(await d.runFilter(file, d.store.notifications.map((r) => ({ ...r })), { user: ME }))).toEqual(['n3', 'n4']);
    expect(d.logger.errors.join()).toContain('tickets');
  });

  it('hides every row when everything fails, but passes aggregates', async () => {
    const d = world();
    d.breakReads = true;
    const out = await d.runFilter(file, [{ id: 'n1' }, { count: 4 }], { user: ME });
    expect(out).toEqual([{ count: 4 }]);
  });

  it('passes non-array payloads unchanged', async () => {
    const d = world();
    expect(await d.runFilter(file, { id: 'n1' }, { user: ME })).toEqual({ id: 'n1' });
  });
});
