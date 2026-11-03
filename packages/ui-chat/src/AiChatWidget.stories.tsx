import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Stack, Text, Title } from '@mantine/core';
import { AiChat } from './AiChat';
import { AiChatWidget } from './AiChatWidget';
import { mockBackend } from './_mockBackend';

/**
 * The chat as a floating widget for customer-facing apps: a launcher bubble in a
 * bottom corner opens a chat window above it (full screen on a phone). It keeps
 * its own open state, or shares `AiChatProvider`'s with an `AiChatButton`.
 */
const meta: Meta<typeof AiChatWidget> = {
  title: 'AI Chat/Widget',
  component: AiChatWidget,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof AiChatWidget>;

function Page() {
  return (
    <Stack p="lg" gap="sm" maw={640}>
      <Title order={3}>Acme Store</Title>
      <Text c="dimmed">The launcher sits in the bottom corner. Open it and ask anything.</Text>
    </Stack>
  );
}

export const BottomRight: Story = {
  render: (args) => (
    <>
      <Page />
      <AiChatWidget {...args} />
    </>
  ),
  args: {
    backend: mockBackend(),
    title: 'Acme Support',
    greeting: 'Hi! How can we help today?',
    suggestions: ['How do I invite a teammate?', 'What are your opening hours?'],
    defaultOpened: true,
    storageKey: 'storybook-widget',
  },
};

export const BottomLeft: Story = {
  render: BottomRight.render,
  args: { ...BottomRight.args, position: 'bottom-left', defaultOpened: false, storageKey: 'storybook-widget-left' },
};

/** `AiChat` on its own, for an app's own shell (a page, a drawer, a card). */
export const Inline: StoryObj<typeof AiChat> = {
  render: () => (
    <div style={{ height: 600, maxWidth: 480, margin: 24, border: '1px solid var(--mantine-color-default-border)', borderRadius: 12, overflow: 'hidden' }}>
      <AiChat backend={mockBackend()} title="Assistant" suggestions={['How do I invite a teammate?']} storageKey="storybook-inline" />
    </div>
  ),
};
