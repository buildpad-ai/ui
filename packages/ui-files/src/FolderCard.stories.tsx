import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Box } from '@mantine/core';
import { FolderCard } from './FolderCard';
import { mockFolder } from './_fixtures';

const meta: Meta<typeof FolderCard> = {
  title: 'Files/FolderCard',
  component: FolderCard,
  render: (args) => (
    <Box maw={260}>
      <FolderCard {...args} />
    </Box>
  ),
  args: {
    folder: mockFolder,
    onOpen: () => {},
  },
};

export default meta;
type Story = StoryObj<typeof FolderCard>;

export const Default: Story = {};

/** With rename/delete actions surfaced through the overflow menu. */
export const WithMenu: Story = {
  args: {
    onRename: () => {},
    onDelete: () => {},
  },
};
