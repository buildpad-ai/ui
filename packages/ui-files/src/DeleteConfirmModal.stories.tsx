import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from '@mantine/core';
import { DeleteConfirmModal } from './DeleteConfirmModal';

const meta: Meta<typeof DeleteConfirmModal> = {
  title: 'Files/DeleteConfirmModal',
  component: DeleteConfirmModal,
};

export default meta;
type Story = StoryObj<typeof DeleteConfirmModal>;

function ModalHarness(props: { count: number; noun?: string }) {
  const [opened, setOpened] = useState(true);
  return (
    <>
      <Button color="red" onClick={() => setOpened(true)}>
        Delete…
      </Button>
      <DeleteConfirmModal
        opened={opened}
        count={props.count}
        noun={props.noun}
        onConfirm={() => setOpened(false)}
        onCancel={() => setOpened(false)}
      />
    </>
  );
}

export const SingleFile: Story = { render: () => <ModalHarness count={1} /> };

export const Folder: Story = {
  render: () => <ModalHarness count={1} noun="folder" />,
};

export const Bulk: Story = { render: () => <ModalHarness count={5} /> };
