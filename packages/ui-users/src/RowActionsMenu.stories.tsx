import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { RowActionsMenu } from './RowActionsMenu';

const meta: Meta<typeof RowActionsMenu> = {
  title: 'Users/RowActionsMenu',
  component: RowActionsMenu,
};

export default meta;
type Story = StoryObj<typeof RowActionsMenu>;

const noop = () => undefined;

export const EditAndDelete: Story = { args: { onEdit: noop, onDelete: noop } };
export const EditOnly: Story = { args: { onEdit: noop } };
export const DeleteOnly: Story = { args: { onDelete: noop } };
