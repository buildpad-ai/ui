import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Box, Group, Stack, Text, Title } from '@mantine/core';
import { AiChatButton } from './AiChatButton';
import { AiChatContextChip } from './AiChatContextChip';
import { AiChatPanel } from './AiChatPanel';
import { AiChatProvider } from './AiChatProvider';
import { mockBackend } from './_mockBackend';

/**
 * The chat docked to the right edge, opened by the header's Ask AI button or
 * ⌘I / Ctrl+I. On a wide screen the page makes room (its main area uses
 * `margin-inline-end: var(--bp-ai-chat-offset, 0)`); narrower, the panel
 * overlays it; on a phone it fills the screen. The stories answer from a
 * scripted backend: ask anything.
 */
const meta: Meta<typeof AiChatPanel> = {
  title: 'AI Chat/Panel',
  component: AiChatPanel,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof AiChatPanel>;

function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AiChatProvider defaultOpened>
      <Box style={{ marginInlineEnd: 'var(--bp-ai-chat-offset, 0)', transition: 'margin 200ms ease', minHeight: '100vh' }}>
        <Group h={60} px="lg" justify="space-between" style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
          <Text fw={700}>Acme Console</Text>
          <AiChatButton />
        </Group>
        <Stack p="lg" gap="sm" maw={720}>
          <Title order={3}>Members</Title>
          <Text c="dimmed">
            The page makes room for the docked panel on wide screens. Try the paper clip, paste an image, or take a
            screenshot of this page and draw on it.
          </Text>
        </Stack>
      </Box>
      {children}
    </AiChatProvider>
  );
}

/** Docked beside the page, with starter questions and a badge. */
export const Docked: Story = {
  render: (args) => (
    <AppShell>
      <AiChatPanel {...args} />
    </AppShell>
  ),
  args: {
    backend: mockBackend(),
    title: 'Ask Acme',
    badge: 'Beta',
    description: 'Ask about members, billing, settings or anything else in Acme.',
    suggestions: ['How do I invite a teammate?', 'Where do I change my plan?', 'How do roles work?'],
    storageKey: 'storybook-panel',
    imageHosts: ['example.com'],
  },
};

/** The `context` slot says what the agent is told about; the app sends the same details as `vars`. */
export const WithPageContext: Story = {
  render: (args) => (
    <AppShell>
      <AiChatPanel
        {...args}
        context={<AiChatContextChip label="Settings › Members" title="/settings/members" onRemove={() => {}} removeLabel="Don't share this page" />}
        vars={{ page: 'Settings › Members', page_path: '/settings/members' }}
      />
    </AppShell>
  ),
  args: { ...Docked.args, storageKey: 'storybook-context' },
};

/** Without attachments, screenshots or recent chats: a text-only assistant. */
export const TextOnly: Story = {
  render: (args) => (
    <AppShell>
      <AiChatPanel {...args} />
    </AppShell>
  ),
  args: {
    ...Docked.args,
    features: { attachments: false, screenshot: false, recentChats: false },
    storageKey: 'storybook-text-only',
  },
};

/** When the agent can't answer: the error, with Try again. Ask anything to see it. */
export const AgentError: Story = {
  render: (args) => (
    <AppShell>
      <AiChatPanel {...args} />
    </AppShell>
  ),
  args: { ...Docked.args, backend: mockBackend({ fail: 'The assistant is misconfigured.' }), storageKey: 'storybook-error' },
};
