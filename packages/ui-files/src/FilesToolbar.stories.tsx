import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from '@mantine/core';
import { IconUpload } from '@tabler/icons-react';
import { FilesToolbar, type FilesView } from './FilesToolbar';

const meta: Meta<typeof FilesToolbar> = {
  title: 'Files/FilesToolbar',
  component: FilesToolbar,
};

export default meta;
type Story = StoryObj<typeof FilesToolbar>;

function ToolbarHarness(props: { newFolder?: boolean; actions?: React.ReactNode }) {
  const [search, setSearch] = useState('');
  const [view, setView] = useState<FilesView>('grid');
  return (
    <FilesToolbar
      search={search}
      onSearchChange={setSearch}
      view={view}
      onViewChange={setView}
      onNewFolder={props.newFolder ? () => {} : undefined}
      actions={props.actions}
    />
  );
}

export const Default: Story = { render: () => <ToolbarHarness /> };

export const WithNewFolder: Story = {
  render: () => <ToolbarHarness newFolder />,
};

/** The `actions` slot holds upload/import affordances on the right. */
export const WithActionsSlot: Story = {
  render: () => (
    <ToolbarHarness
      newFolder
      actions={
        <Button leftSection={<IconUpload size={16} />}>Upload</Button>
      }
    />
  ),
};
