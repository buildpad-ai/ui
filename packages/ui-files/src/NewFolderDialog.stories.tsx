import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from '@mantine/core';
import { NewFolderDialog } from './NewFolderDialog';

const meta: Meta<typeof NewFolderDialog> = {
  title: 'Files/NewFolderDialog',
  component: NewFolderDialog,
};

export default meta;
type Story = StoryObj<typeof NewFolderDialog>;

function DialogHarness(props: {
  initialName?: string;
  title?: string;
  submitLabel?: string;
}) {
  const [opened, setOpened] = useState(true);
  return (
    <>
      <Button onClick={() => setOpened(true)}>Open dialog</Button>
      <NewFolderDialog
        opened={opened}
        initialName={props.initialName}
        title={props.title}
        submitLabel={props.submitLabel}
        onSubmit={() => setOpened(false)}
        onClose={() => setOpened(false)}
      />
    </>
  );
}

export const Create: Story = { render: () => <DialogHarness /> };

export const Rename: Story = {
  render: () => (
    <DialogHarness initialName="Marketing" title="Rename Folder" submitLabel="Rename" />
  ),
};
