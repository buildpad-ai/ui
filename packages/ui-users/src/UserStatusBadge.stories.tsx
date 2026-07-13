import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Group } from '@mantine/core';
import { UserStatusBadge } from './UserStatusBadge';

const meta: Meta<typeof UserStatusBadge> = {
  title: 'Users/UserStatusBadge',
  component: UserStatusBadge,
};

export default meta;
type Story = StoryObj<typeof UserStatusBadge>;

export const Active: Story = { args: { status: 'active' } };
export const Invited: Story = { args: { status: 'invited' } };
export const Draft: Story = { args: { status: 'draft' } };
export const Suspended: Story = { args: { status: 'suspended' } };
export const Terminated: Story = { args: { status: 'terminated' } };

export const AllStatuses: Story = {
  render: () => (
    <Group gap="sm">
      <UserStatusBadge status="active" />
      <UserStatusBadge status="invited" />
      <UserStatusBadge status="draft" />
      <UserStatusBadge status="suspended" />
      <UserStatusBadge status="terminated" />
    </Group>
  ),
};
