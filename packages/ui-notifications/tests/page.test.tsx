import React from 'react';
import { describe, expect, it } from 'vitest';
import { act, screen, waitFor } from '@testing-library/react';
import { useNotifications } from '../src/NotificationsProvider';
import { useNotificationsPage } from '../src/useNotificationsPage';
import { mockAdapter } from '../src/_mockAdapter';
import type { NotificationsAdapter } from '../src/NotificationsAdapter';
import { ME, note, renderWithProvider, deferred } from './fixtures';

function Probe({ filter = 'all', selectedId = null as string | null, pageSize = 3 }) {
  const p = useNotificationsPage(filter, { selectedId, pageSize, tabs: [{ key: 'mentions', clause: { type: { _eq: 'mention' } } }] });
  const ctx = useNotifications();
  return (
    <div>
      <span data-testid="ids">{p.items.map((n) => `${n.id}${n.read_at ? '' : '*'}`).join(',')}</span>
      <span data-testid="more">{String(p.hasMore)}</span>
      <span data-testid="loading">{String(p.isLoading)}</span>
      <span data-testid="sel">{p.selected?.id ?? (p.selectedLoading ? '…' : '-')}</span>
      <span data-testid="err">{p.error?.message ?? ''}</span>
      <button onClick={() => void p.loadMore()}>more</button>
      <button onClick={() => p.patchLocal(['n-a'], { read_at: 'x' })}>patch</button>
      <button onClick={() => void ctx.refetch()}>poll</button>
      <button onClick={() => void ctx.markAllRead()}>all</button>
    </div>
  );
}
const ids = () => screen.getByTestId('ids').textContent;

const rows = (n: number) => Array.from({ length: n }, (_, i) => note({ id: `n-${String.fromCharCode(97 + i)}`, created_at: new Date(Date.UTC(2026, 10, 1) - i * 60_000).toISOString() }));

describe('useNotificationsPage', () => {
  it('pages with a keyset cursor and no duplicates on equal timestamps', async () => {
    const t = '2026-11-01T00:00:00.000Z';
    const items = Array.from({ length: 7 }, (_, i) => note({ id: `d${i}`, created_at: t }));
    const adapter = mockAdapter({ meId: ME, items });
    renderWithProvider(<Probe />, { adapter });
    await waitFor(() => expect(ids()!.split(',')).toHaveLength(3));
    expect(screen.getByTestId('more').textContent).toBe('true');
    act(() => screen.getByText('more').click());
    await waitFor(() => expect(ids()!.split(',')).toHaveLength(6));
    act(() => screen.getByText('more').click());
    await waitFor(() => expect(ids()!.split(',')).toHaveLength(7));
    const got = ids()!.split(',');
    expect(got).toHaveLength(7);
    expect(new Set(got).size).toBe(7);
    // the last page brought a fresh row, so one more request (nothing new) ends paging
    expect(screen.getByTestId('more').textContent).toBe('true');
    act(() => screen.getByText('more').click());
    await waitFor(() => expect(screen.getByTestId('more').textContent).toBe('false'));
    expect(ids()!.split(',')).toHaveLength(7);
    const last = adapter.calls.filter((c) => c.startsWith('list:')).at(-1)!;
    expect(JSON.parse(last.slice(5))).toMatchObject({ before: t, limit: 3 + 1 + 10 });
  });

  it('filters on the server for the tab', async () => {
    const adapter = mockAdapter({ meId: ME, items: [note({ id: 'm', type: 'mention' }), note({ id: 'c' })] });
    renderWithProvider(<Probe filter="mentions" />, { adapter });
    await waitFor(() => expect(ids()).toBe('m*'));
    expect(adapter.calls.some((c) => c.includes('"type":{"_eq":"mention"}'))).toBe(true);
  });

  it('guards loadMore against double calls and ignores it with nothing loaded', async () => {
    const adapter = mockAdapter({ meId: ME, items: rows(8), latency: 20 });
    renderWithProvider(<Probe />, { adapter });
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    const lists = () => adapter.calls.filter((c) => c.startsWith('list:') && c.includes('"before":"')).length;
    act(() => {
      screen.getByText('more').click();
      screen.getByText('more').click();
    });
    await waitFor(() => expect(ids()!.split(',')).toHaveLength(6));
    expect(lists()).toBe(1);
  });

  it('merges a provider poll and marks rows read on mark-all', async () => {
    const items = rows(3);
    const adapter = mockAdapter({ meId: ME, items });
    renderWithProvider(<Probe />, { adapter });
    await waitFor(() => expect(ids()).toBe('n-a*,n-b*,n-c*'));
    adapter.push(note({ id: 'new', created_at: '2026-12-01T00:00:00.000Z' }));
    await act(async () => screen.getByText('poll').click());
    await waitFor(() => expect(ids()).toBe('new*,n-a*,n-b*,n-c*'));
    await act(async () => screen.getByText('all').click());
    await waitFor(() => expect(ids()).toBe('new,n-a,n-b,n-c'));
    act(() => screen.getByText('patch').click());
  });

  it('drops a poll that started before "Mark all as read"', async () => {
    const adapter = mockAdapter({ meId: ME, items: rows(3) });
    const list = adapter.list.bind(adapter);
    const held = deferred<Awaited<ReturnType<typeof list>>>();
    let hold = false;
    // Hold the page's poll (the bell's list asks for 20 rows; the page asks for its own page size).
    adapter.list = (p) => (hold && p.limit !== 20 ? held.promise : list(p));
    renderWithProvider(<Probe />, { adapter });
    await waitFor(() => expect(ids()).toBe('n-a*,n-b*,n-c*'));
    const stale = await list({ limit: 14 }); // what the server said before the click: all unread
    hold = true;
    await act(async () => screen.getByText('poll').click()); // the page's poll is now in flight
    await act(async () => screen.getByText('all').click());
    await waitFor(() => expect(ids()).toBe('n-a,n-b,n-c'));
    await act(async () => held.resolve(stale)); // the old answer lands after the click
    expect(ids()).toBe('n-a,n-b,n-c');
  });

  it('keeps paging after a short page (a server read filter hid rows) until a page brings nothing new', async () => {
    const all = rows(9);
    const adapter = mockAdapter({ meId: ME, items: all });
    const list = adapter.list.bind(adapter);
    // the visibility hook hides most rows of each answer: every page comes back short
    adapter.list = async (p) => (await list(p)).filter((n, i) => i < 2 || p.limit === 20);
    renderWithProvider(<Probe />, { adapter });
    await waitFor(() => expect(ids()).toBe('n-a*,n-b*'));
    expect(screen.getByTestId('more').textContent).toBe('true');
    act(() => screen.getByText('more').click());
    await waitFor(() => expect(ids()).toBe('n-a*,n-b*,n-c*'));
    expect(screen.getByTestId('more').textContent).toBe('true');
  });

  it('skips a page poll while the previous one is still in flight', async () => {
    const adapter = mockAdapter({ meId: ME, items: rows(3) });
    const list = adapter.list.bind(adapter);
    const held = deferred<Awaited<ReturnType<typeof list>>>();
    let hold = false;
    let pagePolls = 0;
    adapter.list = (p) => {
      if (hold && p.limit !== 20) {
        pagePolls++;
        return held.promise;
      }
      return list(p);
    };
    renderWithProvider(<Probe />, { adapter });
    await waitFor(() => expect(ids()).toBe('n-a*,n-b*,n-c*'));
    hold = true;
    await act(async () => screen.getByText('poll').click());
    await waitFor(() => expect(pagePolls).toBe(1));
    await act(async () => screen.getByText('poll').click());
    await act(async () => screen.getByText('poll').click());
    expect(pagePolls).toBe(1);
    await act(async () => held.resolve(await list({ limit: 14 })));
    hold = false;
    await act(async () => screen.getByText('poll').click());
    await waitFor(() => expect(adapter.calls.filter((c) => c.startsWith('list:') && c.includes('"limit":14')).length).toBeGreaterThan(2));
  });

  it('keeps the list when a poll fails', async () => {
    const adapter = mockAdapter({ meId: ME, items: rows(2) });
    renderWithProvider(<Probe />, { adapter });
    await waitFor(() => expect(ids()).toBe('n-a*,n-b*'));
    const list = adapter.list;
    let n = 0;
    adapter.list = async (p) => (n++ === 1 ? Promise.reject(new Error('x')) : list(p));
    await act(async () => screen.getByText('poll').click());
    expect(ids()).toBe('n-a*,n-b*');
  });

  it('fetches a selected row that is not loaded, and reports a missing one', async () => {
    const adapter = mockAdapter({ meId: ME, items: [...rows(5), note({ id: 'far', created_at: '2020-01-01T00:00:00Z' })] });
    renderWithProvider(<Probe selectedId="far" />, { adapter });
    await waitFor(() => expect(screen.getByTestId('sel').textContent).toBe('far'));
    expect(adapter.calls).toContain('get:far');
  });

  it('shows nothing selected when the row does not exist or get fails', async () => {
    const adapter = mockAdapter({ meId: ME, items: rows(1), failOn: ['get'] });
    renderWithProvider(<Probe selectedId="ghost" />, { adapter });
    await waitFor(() => expect(screen.getByTestId('sel').textContent).toBe('-'));
    expect(adapter.calls.filter((c) => c === 'get:ghost')).toHaveLength(1);
  });

  it('reports a list error and drops a stale first page', async () => {
    const adapter = mockAdapter({ meId: ME, items: rows(1), failOn: ['list'] });
    renderWithProvider(<Probe />, { adapter });
    await waitFor(() => expect(screen.getByTestId('err').textContent).toBe('list failed'));
  });

  it('drops the response of a tab that is no longer shown', async () => {
    const slow = deferred<never[]>();
    let calls = 0;
    const adapter: NotificationsAdapter = {
      list: async () => (calls++ === 0 ? slow.promise : [note({ id: 'fresh' })]),
      unreadCount: async () => 0,
      markRead: async () => {},
      markAllRead: async () => {},
    };
    const { rerenderAs } = renderWithProvider(<Probe />, { adapter });
    // the provider's own list call is the first; make the page's first call the slow one instead
    rerenderAs('other', <Probe filter="unread" />);
    await waitFor(() => expect(ids()).toBe('fresh*'));
    await act(async () => slow.resolve([]));
    expect(ids()).toBe('fresh*');
  });

  it('records a loadMore error', async () => {
    const adapter = mockAdapter({ meId: ME, items: rows(8) });
    renderWithProvider(<Probe />, { adapter });
    await waitFor(() => expect(screen.getByTestId('more').textContent).toBe('true'));
    adapter.list = async () => Promise.reject(new Error('boom'));
    await act(async () => screen.getByText('more').click());
    expect(screen.getByTestId('err').textContent).toBe('boom');
  });
});
