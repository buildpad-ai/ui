import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Box } from '@mantine/core';
import { InfoPanel } from './InfoPanel';

const meta: Meta<typeof InfoPanel> = {
  title: 'Users/InfoPanel',
  component: InfoPanel,
  render: (args) => (
    <Box maw={320}>
      <InfoPanel {...args} />
    </Box>
  ),
};

export default meta;
type Story = StoryObj<typeof InfoPanel>;

export const UserInfo: Story = {
  args: {
    title: 'Information',
    items: [
      { label: 'User ID', value: 'user-1' },
      { label: 'Last Access', value: 'Jul 5, 2026, 9:10 AM' },
      { label: 'Created', value: 'Jan 10, 2026, 9:00 AM' },
      { label: 'Updated', value: 'Jun 1, 2026, 9:00 AM' },
      { label: 'Policies', value: '1 policy' },
    ],
    description: 'User information and activity details',
  },
};

export const RoleInfo: Story = {
  args: {
    title: 'Role Information',
    items: [
      { label: 'ID', value: 'role-admin' },
      { label: 'Users', value: '2' },
      { label: 'Policies', value: '1' },
      { label: 'Created', value: 'Jan 10, 2026, 9:00 AM' },
      { label: 'Updated', value: 'May 1, 2026, 9:00 AM' },
    ],
  },
};

export const NoDescription: Story = {
  args: {
    items: [{ label: 'Policy ID', value: 'policy-admin' }],
  },
};
