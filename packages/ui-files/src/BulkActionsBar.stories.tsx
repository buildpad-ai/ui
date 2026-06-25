import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { BulkActionsBar } from './BulkActionsBar';

const meta: Meta<typeof BulkActionsBar> = {
  title: 'Files/BulkActionsBar',
  component: BulkActionsBar,
  args: {
    count: 3,
    onDelete: () => {},
    onClear: () => {},
  },
};

export default meta;
type Story = StoryObj<typeof BulkActionsBar>;

export const Selection: Story = {};

/** Delete in progress — the button shows a loading spinner. */
export const Deleting: Story = {
  args: { deleting: true },
};
