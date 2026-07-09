import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from '@mantine/core';
import { DeleteConfirmModal } from './DeleteConfirmModal';

const meta: Meta<typeof DeleteConfirmModal> = {
  title: 'Users/DeleteConfirmModal',
  component: DeleteConfirmModal,
};

export default meta;
type Story = StoryObj<typeof DeleteConfirmModal>;

function ModalHarness(props: { title?: string; description?: string; confirmLabel?: string }) {
  const [opened, setOpened] = useState(true);
  return (
    <>
      <Button color="red" onClick={() => setOpened(true)}>
        Delete…
      </Button>
      <DeleteConfirmModal
        opened={opened}
        title={props.title}
        description={props.description}
        confirmLabel={props.confirmLabel}
        onConfirm={() => setOpened(false)}
        onClose={() => setOpened(false)}
      />
    </>
  );
}

export const DeleteUser: Story = {
  render: () => (
    <ModalHarness
      title="Delete user"
      description="Are you sure you want to delete this user? This action cannot be undone."
    />
  ),
};

export const DeleteRole: Story = {
  render: () => (
    <ModalHarness
      title="Delete role"
      description="Are you sure you want to delete this role? Users in this role will need to be reassigned."
    />
  ),
};

export const DetachPolicy: Story = {
  render: () => (
    <ModalHarness
      title="Remove policy"
      description="Are you sure you want to remove this policy from the user?"
      confirmLabel="Remove"
    />
  ),
};
