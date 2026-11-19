import React from 'react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { useNotifications } from '../src/NotificationsProvider';
import { mockAdapter } from '../src/_mockAdapter';
import type { NotificationsAdapter } from '../src/NotificationsAdapter';
import { ME, note, renderWithProvider, deferred } from './fixtures';

function Probe() {
  const n = useNotifications();
  return (
    <div>
      <span data-testid="count">{n.unreadCount}</span>
      <span data-testid="ids">{n.latest.map((x) => `${x.id}${x.read_at ? '' : '*'}`).join(',')}</span>
      <span data-testid="loading">{String(n.isLoading)}</span>
      <span data-testid="error">{n.error?.message ?? ''}</span>
      <button onClick={() => void n.markRead(['a'])}>read-a</button>
      <button onClick={() => void n.markRead([])}>read-none</button>
      <button onClick={() => void n.markUnread(['b'])}>unread-b</button>
      <button onClick={() => void n.markUnread([])}>unread-none</button>
      <button onClick={() => void n.markAllRead()}>all</button>
    </div>
  );
}
const count = () => screen.getByTestId('count').textContent;
const ids = () => screen.getByTestId('ids').textContent;

afterEach(() => {
  vi.useRealTimers();
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
});

const seed = () => [note({ id: 'a' }), note({ id: 'b', read_at: '2026-11-01T00:00:00Z' }), note({ id: 'c' })];

describe('useNotifications', () => {
  it('throws outside the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/NotificationsProvider/);
    spy.mockRestore();
  });

  it('loads the unread count and the latest', async () => {
    renderWithProvider(<Probe />, { adapter: mockAdapter({ meId: ME, items: seed() }) });
    await waitFor(() => expect(count()).toBe('2'));
    expect(ids()).toBe('c*,b,a*');
    expect(screen.getByTestId('loading').textContent).toBe('false');
  });

  it('marks read optimistically', async () => {
    const adapter = mockAdapter({ meId: ME, items: seed(), latency: 50 });
    renderWithProvider(<Probe />, { adapter });
    await waitFor(() => expect(count()).toBe('2'));
    act(() => screen.getByText('read-a').click());
    expect(count()).toBe('1');
    expect(ids()).toBe('c*,b,a');
    act(() => screen.getByText('read-none').click());
    await waitFor(() => expect(adapter.calls).toContain('markRead:a'));
  });

  it('loads again when a markRead lands before the first load (deep link)', async () => {
    const adapter = mockAdapter({ meId: ME, items: seed(), latency: 50 });
    renderWithProvider(<Probe />, { adapter });
    act(() => screen.getByText('read-a').click()); // first load still in flight
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    await waitFor(() => expect(count()).toBe('1'));
    expect(ids()).toBe('c*,b,a');
  });

  it('loads again when markAllRead lands before the first load', async () => {
    const adapter = mockAdapter({ meId: ME, items: seed(), latency: 50 });
    renderWithProvider(<Probe />, { adapter });
    act(() => screen.getByText('all').click());
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(count()).toBe('0');
    expect(ids()).toBe('c,b,a');
  });

  it('rolls back with a refetch when markRead fails', async () => {
    const adapter = mockAdapter({ meId: ME, items: seed(), failOn: ['markRead'] });
    renderWithProvider(<Probe />, { adapter });
    await waitFor(() => expect(count()).toBe('2'));
    act(() => screen.getByText('read-a').click());
    expect(count()).toBe('1');
    await waitFor(() => expect(count()).toBe('2'));
    expect(ids()).toBe('c*,b,a*');
  });

  it('marks all read optimistically and rolls back on failure', async () => {
    const adapter = mockAdapter({ meId: ME, items: seed(), failOn: ['markAllRead'] });
    renderWithProvider(<Probe />, { adapter });
    await waitFor(() => expect(count()).toBe('2'));
    act(() => screen.getByText('all').click());
    expect(count()).toBe('0');
    await waitFor(() => expect(count()).toBe('2'));
  });

  it('marks all read', async () => {
    const adapter = mockAdapter({ meId: ME, items: seed() });
    renderWithProvider(<Probe />, { adapter });
    await waitFor(() => expect(count()).toBe('2'));
    await act(async () => screen.getByText('all').click());
    expect(count()).toBe('0');
    expect(adapter.calls).toContain('markAllRead');
  });

  it('marks unread, and does nothing without the adapter method', async () => {
    const adapter = mockAdapter({ meId: ME, items: seed() });
    renderWithProvider(<Probe />, { adapter });
    await waitFor(() => expect(count()).toBe('2'));
    act(() => screen.getByText('unread-b').click());
    expect(count()).toBe('3');
    act(() => screen.getByText('unread-none').click());
    await waitFor(() => expect(adapter.calls).toContain('markUnread:b'));
    await waitFor(() => expect(ids()).toBe('c*,b*,a*'));
  });

  it('records a markUnread failure and refetches', async () => {
    const adapter = mockAdapter({ meId: ME, items: seed(), failOn: ['markUnread'] });
    renderWithProvider(<Probe />, { adapter });
    await waitFor(() => expect(count()).toBe('2'));
    act(() => screen.getByText('unread-b').click());
    await waitFor(() => expect(count()).toBe('2'));
  });

  it('ignores markUnread when the adapter has none', async () => {
    const adapter = mockAdapter({ meId: ME, items: seed(), markUnread: false });
    renderWithProvider(<Probe />, { adapter });
    await waitFor(() => expect(count()).toBe('2'));
    act(() => screen.getByText('unread-b').click());
    expect(count()).toBe('2');
  });

  it('drops a stale response', async () => {
    const first = deferred<number>();
    const second = deferred<number>();
    const counts = [first, second];
    let i = 0;
    const adapter: NotificationsAdapter = {
      list: async () => [],
      unreadCount: () => counts[i++].promise,
      markRead: async () => {},
      markAllRead: async () => {},
    };
    const { rerenderAs } = renderWithProvider(<Probe />, { adapter });
    rerenderAs('someone-else');
    await act(async () => second.resolve(5));
    expect(count()).toBe('5');
    await act(async () => first.resolve(99));
    expect(count()).toBe('5');
  });

  it('keeps what it has and reports an error when a fetch fails', async () => {
    const adapter = mockAdapter({ meId: ME, items: seed(), failOn: ['unreadCount'] });
    renderWithProvider(<Probe />, { adapter });
    await waitFor(() => expect(screen.getByTestId('error').textContent).toBe('unreadCount failed'));
    expect(ids()).toBe('c*,b,a*');
  });

  it('resets when the user changes', async () => {
    const adapter = mockAdapter({ meId: ME, items: seed() });
    const { rerenderAs } = renderWithProvider(<Probe />, { adapter });
    await waitFor(() => expect(count()).toBe('2'));
    rerenderAs('other');
    expect(count()).toBe('0');
    expect(ids()).toBe('');
  });

  it('polls, skips while hidden, and refreshes on visibility and focus', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const adapter = mockAdapter({ meId: ME, items: seed() });
    renderWithProvider(<Probe />, { adapter, pollMs: 1000 });
    await waitFor(() => expect(count()).toBe('2'));
    const polls = () => adapter.calls.filter((c) => c === 'unreadCount').length;
    const before = polls();
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(polls()).toBe(before + 1);
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    await act(async () => {
      vi.advanceTimersByTime(3000);
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(polls()).toBe(before + 1);
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('focus'));
    });
    // visibilitychange and focus fire together when the tab comes back: one refetch
    expect(polls()).toBe(before + 2);
    await act(async () => {
      vi.advanceTimersByTime(600);
    });
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });
    expect(polls()).toBe(before + 3);
  });

  it('shares one in-flight refetch between overlapping calls', async () => {
    const adapter = mockAdapter({ meId: ME, items: seed(), latency: 30 });
    let ctx!: ReturnType<typeof useNotifications>;
    function Grab() {
      ctx = useNotifications();
      return null;
    }
    renderWithProvider(<Grab />, { adapter, pollMs: 0 });
    await waitFor(() => expect(ctx.isLoading).toBe(false));
    const counts = () => adapter.calls.filter((c) => c === 'unreadCount').length;
    const before = counts();
    await act(async () => {
      const a = ctx.refetch();
      const b = ctx.refetch();
      expect(b).toBe(a);
      await a;
    });
    expect(counts()).toBe(before + 1);
  });
});
