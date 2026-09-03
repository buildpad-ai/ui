'use client';

import React from 'react';
import { Button, Group, Modal, Stack, Text } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import { useBuildpadTranslations } from '@buildpad/services';
import type { DeepPartial, UsersTranslations } from '@buildpad/utils';

export interface DeleteConfirmModalProps {
  opened: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  /** Default: the dictionary's "Confirm deletion". */
  title?: string;
  /** Default: the dictionary's generic "Are you sure you want to delete this item? …". */
  description?: string;
  /** Default: the dictionary's "Delete" (`common.delete`). */
  confirmLabel?: string;
  loading?: boolean;
  /** Per-instance overrides of the `users` dictionary namespace (prop > provider > defaults). */
  translations?: DeepPartial<UsersTranslations>;
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
  title,
  description,
  confirmLabel,
  loading = false,
  translations,
}) => {
  const t = useBuildpadTranslations((d) => d.users, translations);
  const common = useBuildpadTranslations((d) => d.common);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconAlertTriangle size={20} color="var(--mantine-color-red-6)" />
          <Text fw={600}>{title ?? t.deleteConfirm.title}</Text>
        </Group>
      }
      size="sm"
      centered
      data-testid="users-delete-confirm-modal"
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          {description ?? t.deleteConfirm.description}
        </Text>
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onClose} disabled={loading}>
            {common.cancel}
          </Button>
          <Button
            color="red"
            onClick={onConfirm}
            loading={loading}
            data-testid="users-delete-confirm-btn"
          >
            {confirmLabel ?? common.delete}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};

export default DeleteConfirmModal;
