import React from 'react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NotificationsInbox, type NotificationsInboxProps } from '../src/NotificationsInbox';
import { nextUrlState, useLocalUrlState, type InboxUrlState } from '../src/urlState';
import { mockAdapter, type MockOptions } from '../src/_mockAdapter';
import { ME, note, renderWithProvider } from './fixtures';

const DAY = 86_400_000;
const now = Date.now();
const seed = () => [
  note({ id: 'a', title: 'Alpha', type: 'mention', message: 'ping @[Ana](user:1)', link: '/t/1', created_at: new Date(now - 1000).toISOString() }),
  note({ id: 'b', title: 'Bravo', read_at: new Date(now).toISOString(), created_at: new Date(now - 2000).toISOString() }),
  note({ id: 'c', title: 'Charlie', type: 'invoice_overdue', created_at: new Date(now - 3 * DAY).toISOString() }),
];

/** URL state that records every replace, like a router would. */
function useSpyUrl(spy: (p: unknown) => void, initial: { filter?: string | null; id?: string | null } = {}): InboxUrlState {
  const local = useLocalUrlState(initial);
  return { ...local, replace: (p) => (spy(p), local.replace(p)) };
}

function Harness({ spy = () => {}, initial, ...props }: Partial<NotificationsInboxProps> & { spy?: (p: unknown) => void; initial?: { filter?: string | null; id?: string | null } }) {
  const url = useSpyUrl(spy, initial);
  return (
    <>
      <NotificationsInbox urlState={url} height={500} {...props} />
      <input aria-label="elsewhere" />
    </>
  );
}

function setup(props: Parameters<typeof Harness>[0] = {}, options: MockOptions = {}) {
  const adapter = mockAdapter({ meId: ME, items: seed(), ...options });
  const utils = renderWithProvider(<Harness {...props} />, { adapter });
  return { adapter, ...utils };
}
const row = (title: string) => within(screen.getByTestId('bp-nt-list')).getByText(title).closest('button')!;

afterEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({ matches: false, media: query, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false }),
  });
});

describe('NotificationsInbox', () => {
  it('groups by day, styles unread rows and counts unread', async () => {
    setup();
    expect(await screen.findByText('Alpha')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Today' })).toBeInTheDocument();
    expect(screen.getByText('2 unread')).toBeInTheDocument();
    expect(within(row('Alpha')).getByLabelText('Unread')).toBeInTheDocument();
    expect(within(row('Bravo')).queryByLabelText('Unread')).toBeNull();
    expect(screen.getByText('ping @Ana')).toBeInTheDocument();
    expect(screen.getByText('Select a notification to see it here.')).toBeInTheDocument();
  });

  it('selecting writes ?id=, marks read and shows the detail with slots', async () => {
    const spy = vi.fn();
    const onNavigate = vi.fn();
    const { adapter } = setup({ spy, onNavigate, renderReply: (n) => <textarea aria-label={`reply ${n.id}`} />, renderActions: () => <button>Approve</button>, renderPreview: () => 'preview!' });
    await userEvent.click(await screen.findByText('Alpha'));
    expect(spy).toHaveBeenLastCalledWith({ filter: null, id: 'a' });
    expect(row('Alpha')).toHaveAttribute('aria-current', 'true');
    await waitFor(() => expect(adapter.calls).toContain('markRead:a'));
    expect(screen.getByText('1 unread')).toBeInTheDocument();
    expect(within(row('Alpha')).queryByLabelText('Unread')).toBeNull();
    const detail = screen.getByTestId('bp-nt-detail');
    expect(within(detail).getByRole('heading', { level: 2, name: 'Alpha' })).toBeInTheDocument();
    expect(within(detail).getByText('Mention')).toBeInTheDocument();
    expect(within(detail).getByRole('textbox', { name: 'reply a' })).toBeInTheDocument();
    expect(within(detail).getByText('preview!')).toBeInTheDocument();
    await userEvent.click(within(detail).getByRole('link', { name: 'Open full page' }));
    expect(onNavigate).toHaveBeenCalledWith('/t/1', expect.objectContaining({ id: 'a' }));
  });

  it('typing u inside the reply box does not toggle read', async () => {
    const { adapter } = setup({ initial: { id: 'b' }, renderReply: () => <textarea aria-label="reply" /> });
    const box = await screen.findByRole('textbox', { name: 'reply' });
    await userEvent.type(box, 'uj');
    expect(adapter.calls.some((c) => c.startsWith('markUnread'))).toBe(false);
  });

  it('changing the tab writes ?filter= and clears the id; per-tab empty state', async () => {
    const spy = vi.fn();
    const { adapter } = setup({ spy, initial: { id: 'a' }, tabs: [{ key: 'mentions', label: 'Mentions', clause: { type: { _eq: 'mention' } } }] }, { items: [note({ id: 'r', read_at: 'x', title: 'Read one' })] });
    await screen.findByText('Read one');
    await userEvent.click(screen.getByRole('tab', { name: 'Unread' }));
    expect(spy).toHaveBeenLastCalledWith({ filter: 'unread', id: null });
    expect(await screen.findByText('You have no unread notifications.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Mentions' }));
    expect(await screen.findByText('Nothing here yet.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'All' }));
    expect(spy).toHaveBeenLastCalledWith({ filter: null, id: null });
    expect(adapter.calls.some((c) => c.includes('"read_at":{"_null":true}'))).toBe(true);
  });

  it('marks all read', async () => {
    const { adapter } = setup();
    await screen.findByText('Alpha');
    await userEvent.click(screen.getByRole('button', { name: 'Mark all as read' }));
    await waitFor(() => expect(adapter.calls).toContain('markAllRead'));
    expect(screen.queryAllByLabelText('Unread')).toHaveLength(0);
    expect(screen.getByText('All caught up')).toBeInTheDocument();
  });

  it('moves with j/k/arrows and toggles read with u, but not while typing', async () => {
    const spy = vi.fn();
    const { adapter } = setup({ spy });
    await screen.findByText('Alpha');
    await userEvent.keyboard('j');
    expect(spy).toHaveBeenLastCalledWith({ filter: null, id: 'a' });
    await userEvent.keyboard('{ArrowDown}');
    expect(spy).toHaveBeenLastCalledWith({ filter: null, id: 'b' });
    await userEvent.keyboard('j');
    await userEvent.keyboard('j'); // at the end: stays
    expect(spy).toHaveBeenLastCalledWith({ filter: null, id: 'c' });
    await userEvent.keyboard('k');
    await userEvent.keyboard('{ArrowUp}');
    expect(spy).toHaveBeenLastCalledWith({ filter: null, id: 'a' });
    await waitFor(() => expect(adapter.calls).toContain('markRead:a'));
    await userEvent.keyboard('u');
    await waitFor(() => expect(adapter.calls).toContain('markUnread:a'));
    expect(within(row('Alpha')).getByLabelText('Unread')).toBeInTheDocument();
    await userEvent.keyboard('u');
    await waitFor(() => expect(adapter.calls.filter((c) => c === 'markRead:a')).toHaveLength(2));
    const calls = spy.mock.calls.length;
    await userEvent.type(screen.getByLabelText('elsewhere'), 'jku');
    fireEvent.keyDown(document, { key: 'j', ctrlKey: true });
    expect(spy.mock.calls.length).toBe(calls);
  });

  it('Mark as unread / read button in the detail', async () => {
    const { adapter } = setup({ initial: { id: 'b' } });
    await userEvent.click(await screen.findByRole('button', { name: 'Mark as unread' }));
    await waitFor(() => expect(adapter.calls).toContain('markUnread:b'));
    expect(screen.getByRole('button', { name: 'Mark as read' })).toBeInTheDocument();
  });

  it('hides the toggle on a read row without markUnread and ignores u', async () => {
    const { adapter } = setup({ initial: { id: 'b' } }, { markUnread: false });
    await screen.findByTestId('bp-nt-detail');
    expect(screen.queryByRole('button', { name: 'Mark as unread' })).toBeNull();
    await userEvent.keyboard('u');
    expect(adapter.calls.some((c) => c.startsWith('markUnread'))).toBe(false);
  });

  it('opens a selected id that is not loaded, and says when it does not exist', async () => {
    const far = note({ id: 'far', title: 'Far away', created_at: '2020-01-01T00:00:00Z', read_at: 'x' });
    setup({ initial: { id: 'far' }, pageSize: 2 }, { items: [...seed(), far] });
    expect(await screen.findByRole('heading', { name: 'Far away' })).toBeInTheDocument();
    act(() => undefined);
  });

  it('shows not found for an unknown id', async () => {
    setup({ initial: { id: 'nope' } });
    expect(await screen.findByText('This notification could not be found.')).toBeInTheDocument();
  });

  it('loads more with the button and shows isLoadingMore', async () => {
    const items = Array.from({ length: 5 }, (_, i) => note({ id: `p${i}`, title: `Page ${i}`, created_at: new Date(now - i * 1000).toISOString() }));
    const { adapter } = setup({ pageSize: 2 }, { items, latency: 20 });
    await screen.findByText('Page 0');
    expect(screen.queryByText('Page 2')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Load more' }));
    expect(await screen.findByText('Page 2')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Load more' }));
    expect(await screen.findByText('Page 4')).toBeInTheDocument();
    // that short page brought fresh rows, so one more (empty) request decides the end
    await userEvent.click(screen.getByRole('button', { name: 'Load more' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull());
    expect(adapter.calls.filter((c) => c.includes('"before":"')).length).toBe(3);
  });

  it('loads more when the sentinel scrolls into view', async () => {
    let cb: IntersectionObserverCallback | null = null;
    const observe = vi.fn();
    const IO = vi.fn(function (this: unknown, c: IntersectionObserverCallback, opts: IntersectionObserverInit) {
      cb = c;
      expect(opts.rootMargin).toBe('200px');
      return { observe, disconnect: vi.fn(), unobserve: vi.fn() };
    });
    vi.stubGlobal('IntersectionObserver', IO);
    const items = Array.from({ length: 4 }, (_, i) => note({ id: `s${i}`, title: `Scroll ${i}`, created_at: new Date(now - i * 1000).toISOString() }));
    setup({ pageSize: 2 }, { items });
    await screen.findByText('Scroll 0');
    await waitFor(() => expect(observe).toHaveBeenCalled());
    await act(async () => cb!([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
    expect(await screen.findByText('Scroll 2')).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it('does not claim "All caught up" when the unread count failed', async () => {
    setup({}, { failOn: ['unreadCount'] });
    await screen.findAllByRole('listitem');
    expect(screen.queryByText('All caught up')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mark all as read' })).toBeDisabled();
  });

  it('shows an error with retry', async () => {
    const { adapter } = setup({}, { failOn: ['list'] });
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load notifications');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(adapter.calls.filter((c) => c.startsWith('list')).length).toBeGreaterThan(2);
  });

  it('on mobile shows one pane with a back button', async () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({ matches: true, media: query, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false }),
    });
    const spy = vi.fn();
    setup({ spy });
    await userEvent.click(await screen.findByText('Alpha'));
    expect(screen.queryByTestId('bp-nt-list')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Back to notifications' }));
    expect(spy).toHaveBeenLastCalledWith({ filter: null, id: null });
    expect(screen.getByTestId('bp-nt-list')).toBeInTheDocument();
    expect(screen.queryByTestId('bp-nt-detail-pane')).toBeNull();
  });

  it('works with in-memory url state by default', async () => {
    const adapter = mockAdapter({ meId: ME, items: seed() });
    renderWithProvider(<NotificationsInbox />, { adapter });
    await userEvent.click(await screen.findByText('Bravo'));
    expect(row('Bravo')).toHaveAttribute('aria-current', 'true');
  });
});

describe('nextUrlState', () => {
  it('reads and replaces ?filter= and ?id= with scroll false, keeping other params', () => {
    const router = { replace: vi.fn() };
    const state = nextUrlState(new URLSearchParams('filter=unread&id=x&tab=2'), router, '/notifications');
    expect(state).toMatchObject({ filter: 'unread', id: 'x' });
    state.replace({ filter: 'mentions', id: null });
    expect(router.replace).toHaveBeenCalledWith('/notifications?filter=mentions&tab=2', { scroll: false });
    const empty = nextUrlState(null, router, '/n');
    expect(empty).toMatchObject({ filter: null, id: null });
    empty.replace({ filter: null, id: null });
    expect(router.replace).toHaveBeenLastCalledWith('/n', { scroll: false });
  });
});

