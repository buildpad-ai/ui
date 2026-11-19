import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NotificationBell } from '../src/NotificationBell';
import { mockAdapter } from '../src/_mockAdapter';
import { ME, note, renderWithProvider } from './fixtures';

const many = (n: number) => Array.from({ length: n }, (_, i) => note({ id: `b${i}`, title: `Bell ${i}`, link: i === 0 ? '/tickets/1' : null }));

describe('NotificationBell', () => {
  it('shows "9+" and opens the latest', async () => {
    renderWithProvider(<NotificationBell />, { adapter: mockAdapter({ meId: ME, items: many(12) }) });
    const button = await screen.findByRole('button', { name: 'Notifications, 12 unread' });
    expect(screen.getByText('9+')).toBeInTheDocument();
    await userEvent.click(button);
    expect(await screen.findByText('Bell 11')).toBeInTheDocument();
    expect(screen.getAllByLabelText('Unread').length).toBeGreaterThan(0);
  });

  it('click marks read and navigates to the resolved link, or the inbox', async () => {
    const onNavigate = vi.fn();
    const adapter = mockAdapter({ meId: ME, items: many(2) });
    renderWithProvider(<NotificationBell onNavigate={onNavigate} />, { adapter });
    await userEvent.click(await screen.findByRole('button', { name: /2 unread/ }));
    await userEvent.click(await screen.findByText('Bell 0'));
    expect(onNavigate).toHaveBeenCalledWith('/tickets/1', expect.objectContaining({ id: 'b0' }));
    await waitFor(() => expect(adapter.calls).toContain('markRead:b0'));
    await userEvent.click(await screen.findByRole('button', { name: /1 unread/ }));
    await userEvent.click(await screen.findByText('Bell 1'));
    expect(onNavigate).toHaveBeenLastCalledWith('/notifications?id=b1', expect.anything());
  });

  it('ignores links that are not app-relative (javascript:, https://, //host, /\\host): opens the inbox instead', async () => {
    const bad = ['javascript:alert(1)', 'https://evil.example', '//evil.example', '/\\evil.example'];
    const onNavigate = vi.fn();
    const adapter = mockAdapter({ meId: ME, items: bad.map((link, i) => note({ id: `x${i}`, title: `Bad ${i}`, link })) });
    renderWithProvider(<NotificationBell onNavigate={onNavigate} />, { adapter });
    for (let i = 0; i < bad.length; i++) {
      await userEvent.click(await screen.findByRole('button', { name: /Notifications/ }));
      await userEvent.click(await screen.findByText(`Bad ${i}`));
      expect(onNavigate).toHaveBeenLastCalledWith(`/notifications?id=x${i}`, expect.anything());
    }
  });

  it('marks all read and links to the inbox', async () => {
    const onNavigate = vi.fn();
    const adapter = mockAdapter({ meId: ME, items: [note({ message: 'hi @[Ana](user:x)' }), note({ read_at: 'x' })] });
    renderWithProvider(<NotificationBell onNavigate={onNavigate} href="/inbox" />, { adapter });
    await userEvent.click(await screen.findByRole('button', { name: /1 unread/ }));
    expect(await screen.findByText('hi @Ana')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Mark all as read' }));
    await waitFor(() => expect(adapter.calls).toContain('markAllRead'));
    expect(screen.getByRole('button', { name: 'Mark all as read' })).toBeDisabled();
    await userEvent.click(screen.getByRole('link', { name: 'See all notifications' }));
    expect(onNavigate).toHaveBeenCalledWith('/inbox');
  });

  it('shows empty and loading states', async () => {
    renderWithProvider(<NotificationBell />, { adapter: mockAdapter({ meId: ME, items: [], latency: 2000 }) });
    await userEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    expect(screen.getByLabelText('Loading notifications…')).toBeInTheDocument();
    expect(await screen.findByText('No notifications yet.', undefined, { timeout: 4000 })).toBeInTheDocument();
  });

  it('navigates with window.location by default', async () => {
    const assign = vi.fn();
    const original = window.location;
    Object.defineProperty(window, 'location', { configurable: true, value: { ...original, assign } });
    renderWithProvider(<NotificationBell />, { adapter: mockAdapter({ meId: ME, items: many(1) }) });
    await userEvent.click(await screen.findByRole('button', { name: /1 unread/ }));
    await act(async () => within(document.body).getByText('Bell 0').click());
    expect(assign).toHaveBeenCalledWith('/tickets/1');
    Object.defineProperty(window, 'location', { configurable: true, value: original });
  });
});
