import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { ListEmptyState } from './ListEmptyState';

const meta: Meta<typeof ListEmptyState> = {
  title: 'Users/ListEmptyState',
  component: ListEmptyState,
};

export default meta;
type Story = StoryObj<typeof ListEmptyState>;

export const NoData: Story = {
  args: { title: 'No users found', hint: 'Get started by adding your first user' },
};

export const Filtered: Story = {
  args: { title: 'No users found', hint: 'Try adjusting your filters' },
};

export const LoadFailure: Story = {
  args: { title: 'Failed to load users', hint: 'API error: 503 - service unavailable', error: true },
};
