import React, { useMemo, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Box, Button, Group, Stack, Text, Textarea } from '@mantine/core';
import { NotificationsProvider } from './NotificationsProvider';
import { NotificationBell } from './NotificationBell';
import { NotificationsInbox } from './NotificationsInbox';
import { NotificationDetail } from './NotificationDetail';
import { mockAdapter, sampleNotifications, type MockOptions } from './_mockAdapter';
import type { NotificationsAdapter } from './NotificationsAdapter';
import { useLocalUrlState } from './urlState';
import type { Notification } from './core/types';

/** 16px gutter on phones, 24px from tablet up. */
const pagePadding = (Story: React.ComponentType) => (
  <Box p={{ base: 16, sm: 24 }}>
    <Story />
  </Box>
);

const meta: Meta = { title: 'Notifications/Notifications', parameters: { layout: 'fullscreen' }, decorators: [pagePadding] };
export default meta;

/** Fill the viewport minus the story padding, so the list never stops on a bare day header. */
const FILL = 'calc(100dvh - 48px)';

function WithProvider({
  children,
  empty = false,
  options,
  adapter: given,
}: {
  children: React.ReactNode;
  empty?: boolean;
  options?: MockOptions;
  adapter?: NotificationsAdapter;
}) {
  const adapter = useMemo(
    () => given ?? mockAdapter({ items: empty ? [] : sampleNotifications(), latency: 300, ...options }),
    [empty, given, options],
  );
  return (
    <NotificationsProvider adapter={adapter} meId="me">
      {children}
    </NotificationsProvider>
  );
}

const log = (href: string) => console.info('navigate', href);

function ReplyBox({ n }: { n: Notification }) {
  const [text, setText] = useState('');
  return (
    // Wraps: textarea full width with the button below on narrow screens.
    <Group align="flex-end" wrap="wrap" gap="sm">
      <Textarea style={{ flex: '1 1 240px', minWidth: 0 }} placeholder={`Reply to ${n.actor_name ?? 'sender'}…`} value={text} onChange={(e) => setText(e.currentTarget.value)} autosize minRows={2} />
      <Button onClick={() => setText('')} disabled={!text.trim()}>
        Reply
      </Button>
    </Group>
  );
}

export const Bell: StoryObj = {
  render: () => (
    <WithProvider>
      <Group justify="flex-end">
        <NotificationBell onNavigate={log} />
      </Group>
    </WithProvider>
  ),
};

export const Inbox: StoryObj = {
  render: () => (
    <WithProvider>
      <NotificationsInbox
        height={FILL}
        onNavigate={log}
        tabs={[{ key: 'mentions', label: 'Mentions', clause: { type: { _eq: 'mention' } } }]}
        renderReply={(n) => <ReplyBox n={n} />}
        renderActions={(n) => (n.type === 'assigned' ? <Button size="xs">Accept</Button> : null)}
      />
    </WithProvider>
  ),
};

export const EmptyInbox: StoryObj = {
  render: () => (
    <WithProvider empty>
      <NotificationsInbox height={FILL} />
    </WithProvider>
  ),
};

export const DetailWithReply: StoryObj = {
  render: () => {
    const n = sampleNotifications()[0];
    return (
      <NotificationDetail
        notification={n}
        onNavigate={log}
        renderPreview={() => <div style={{ padding: 12, border: '1px dashed var(--mantine-color-default-border)' }}>Ticket #100 — Printer on fire</div>}
        renderActions={() => <Button size="xs">Assign to me</Button>}
        renderReply={(x) => <ReplyBox n={x} />}
      />
    );
  },
};

/** An adapter whose calls never resolve: the inbox stays in its loading state. */
const neverAdapter: NotificationsAdapter = {
  list: () => new Promise(() => {}),
  unreadCount: () => new Promise(() => {}),
  markRead: () => new Promise(() => {}),
  markAllRead: () => new Promise(() => {}),
};

export const Loading: StoryObj = {
  render: () => (
    <WithProvider adapter={neverAdapter}>
      <NotificationsInbox height={FILL} />
    </WithProvider>
  ),
};

const failing: MockOptions = { failOn: ['list', 'unreadCount'] };

export const ErrorState: StoryObj = {
  name: 'Error',
  render: () => (
    <WithProvider options={failing}>
      <NotificationsInbox height={FILL} />
    </WithProvider>
  ),
};

function InboxWithUrl() {
  const url = useLocalUrlState({ id: 'n1' });
  return (
    <Stack gap="xs" style={{ height: FILL }}>
      <Text size="xs" c="dimmed" ff="monospace">
        ?{new URLSearchParams(Object.entries({ filter: url.filter, id: url.id }).filter((e): e is [string, string] => !!e[1])).toString() || '(none)'}
      </Text>
      <Box style={{ flex: 1, minHeight: 0 }}>
        <NotificationsInbox
          urlState={url}
          height="100%"
          onNavigate={log}
          tabs={[{ key: 'mentions', label: 'Mentions', clause: { type: { _eq: 'mention' } } }]}
          renderReply={(n) => <ReplyBox n={n} />}
        />
      </Box>
    </Stack>
  );
}

export const InboxWithUrlState: StoryObj = {
  render: () => (
    <WithProvider>
      <InboxWithUrl />
    </WithProvider>
  ),
};
