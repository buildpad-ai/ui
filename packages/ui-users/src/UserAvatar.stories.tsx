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
