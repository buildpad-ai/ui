/** Keyboard and screen-reader behaviour of the bell, the inbox and the detail. */
import React from 'react';
import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { NotificationBell } from '../src/NotificationBell';
import { NotificationsInbox } from '../src/NotificationsInbox';
import { NotificationDetail } from '../src/NotificationDetail';
import { mockAdapter } from '../src/_mockAdapter';
import { renderWithMantine } from './helpers';
import { ME, note, renderWithProvider } from './fixtures';

describe('a11y', () => {
  it('the bell button names the unread count and reports expanded', async () => {
    renderWithProvider(<NotificationBell />, { adapter: mockAdapter({ meId: ME, items: [note()] }) });
    const bell = await screen.findByRole('button', { name: 'Notifications, 1 unread' });
    expect(bell).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(bell);
    expect(bell).toHaveAttribute('aria-expanded', 'true');
  });

  it('the inbox has a page heading, a labelled tab list, a labelled list and a live unread count', async () => {
    renderWithProvider(<NotificationsInbox headingLevel={2} />, { adapter: mockAdapter({ meId: ME, items: [note({ title: 'Hello' })] }) });
    await screen.findByText('Hello');
    expect(screen.getByRole('heading', { level: 2, name: 'Notifications' })).toBeInTheDocument();
    expect(screen.getByRole('tablist', { name: 'Filter notifications' })).toBeInTheDocument();
    const list = screen.getByRole('list', { name: 'Notifications' });
    expect(within(list).getByRole('heading', { level: 3 })).toBeInTheDocument();
    expect(screen.getByText('1 unread')).toHaveAttribute('aria-live', 'polite');
    expect(within(list).getByRole('img', { name: 'Unread' })).toBeInTheDocument();
  });

  it('the detail has a heading, a <time> and no link button without a link', () => {
    renderWithMantine(<NotificationDetail notification={note({ title: 'Plain', actor_name: 'Ana', created_at: '2026-11-01T00:00:00Z' })} headingLevel={3} />);
    expect(screen.getByRole('heading', { level: 3, name: 'Plain' })).toBeInTheDocument();
    expect(document.querySelector('time')).toHaveAttribute('dateTime', '2026-11-01T00:00:00Z');
    expect(screen.queryByRole('link')).toBeNull();
    // One flowing meta line: date · time-ago · actor, single spaces.
    expect(document.querySelector('time')!.parentElement!.textContent).toMatch(/ · [^ ].* · Ana$/);
  });

  it('the detail resets its slots when the notification changes (keyed by id)', async () => {
    const reply = () => <textarea aria-label="reply" />;
    const { rerender } = renderWithMantine(<NotificationDetail notification={note({ id: 'x1' })} renderReply={reply} />);
    await userEvent.type(screen.getByRole('textbox', { name: 'reply' }), 'draft');
    rerender(
      <MantineProvider env="test">
        <NotificationDetail notification={note({ id: 'x2' })} renderReply={reply} />
      </MantineProvider>,
    );
    expect(screen.getByRole('textbox', { name: 'reply' })).toHaveValue('');
  });
});
