'use client';

import React from 'react';
import { Button, Group, Modal, Stack, Text } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';

export interface DeleteConfirmModalProps {
  opened: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title?: string;
  description?: string;
  confirmLabel?: string;
  loading?: boolean;
}

/**
 * Confirmation dialog shown before a destructive action (delete user/role/
 * policy, detach a policy). Per-package local copy, matching the ui-files
 * convention of shipping its own `DeleteConfirmModal`.
 */
export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  opened,
  onClose,
  onConfirm,
  title = 'Confirm deletion',
  description = 'Are you sure you want to delete this item? This action cannot be undone.',
  confirmLabel = 'Delete',
  loading = false,
}) => {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconAlertTriangle size={20} color="var(--mantine-color-red-6)" />
          <Text fw={600}>{title}</Text>
        </Group>
      }
      size="sm"
      centered
      data-testid="users-delete-confirm-modal"
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          {description}
        </Text>
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            color="red"
            onClick={onConfirm}
            loading={loading}
            data-testid="users-delete-confirm-btn"
          >
            {confirmLabel}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};

export default DeleteConfirmModal;
