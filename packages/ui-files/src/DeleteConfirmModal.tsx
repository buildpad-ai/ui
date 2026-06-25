'use client';

import React from 'react';
import { Button, Group, Modal, Stack, Text } from '@mantine/core';

export interface DeleteConfirmModalProps {
  opened: boolean;
  count: number;
  loading?: boolean;
  /** Noun for the items being deleted. */
  noun?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmation dialog shown before deleting one or more files/folders.
 */
export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  opened,
  count,
  loading = false,
  noun = 'file',
  onConfirm,
  onCancel,
}) => {
  return (
    <Modal
      opened={opened}
      onClose={onCancel}
      title="Confirm Delete"
      centered
      size="sm"
      data-testid="files-delete-confirm-modal"
    >
      <Stack gap="md">
        <Text size="sm">
          Are you sure you want to delete {count} {count === 1 ? noun : `${noun}s`}? This
          action cannot be undone.
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button
            color="red"
            onClick={onConfirm}
            loading={loading}
            data-testid="files-delete-confirm-btn"
          >
            Delete
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};

export default DeleteConfirmModal;
