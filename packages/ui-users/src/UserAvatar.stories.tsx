import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Group } from '@mantine/core';
import { UserAvatar } from './UserAvatar';
import { mockUsers } from './_fixtures';

const meta: Meta<typeof UserAvatar> = {
  title: 'Users/UserAvatar',
  component: UserAvatar,
};

export default meta;
type Story = StoryObj<typeof UserAvatar>;

export const WithFullName: Story = { args: { user: mockUsers[0] } };

export const EmailFallback: Story = {
  args: { user: mockUsers[2] },
};

export const Inactive: Story = { args: { user: mockUsers[3] } };

/** Deterministic inline-SVG avatar image (no network) rendered via `user.avatar`. */
const AVATAR_DATA_URI = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#4c6ef5"/><circle cx="32" cy="24" r="12" fill="#fff"/><ellipse cx="32" cy="52" rx="20" ry="14" fill="#fff"/></svg>'
)}`;

export const WithImage: Story = {
  args: { user: { ...mockUsers[0], avatar: AVATAR_DATA_URI }, size: 48 },
};

/** A broken image src must fall back to the initials placeholder (Mantine children fallback). */
export const BrokenSrc: Story = {
  args: { user: { ...mockUsers[0], avatar: 'https://invalid.local/missing.png' }, size: 48 },
};

export const Sizes: Story = {
  render: () => (
    <Group gap="sm" align="center">
      <UserAvatar user={mockUsers[0]} size={24} />
      <UserAvatar user={mockUsers[0]} size={32} />
      <UserAvatar user={mockUsers[0]} size={48} />
      <UserAvatar user={mockUsers[0]} size={64} />
    </Group>
  ),
};
