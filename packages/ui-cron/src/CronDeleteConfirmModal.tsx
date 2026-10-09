'use client';

import React from 'react';
import { Button, Group, Modal, Stack, Text } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import { useBuildpadTranslations } from '@buildpad/services';

export interface CronDeleteConfirmModalProps {
  opened: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  /** Default: the dictionary's "Confirm delete" (`common.confirmDeleteTitle`). */
  title?: string;
  /** What is about to be deleted. A string, or rich text the caller composed. */
  description: React.ReactNode;
  /** Default: the dictionary's "Delete" (`common.delete`). */
  confirmLabel?: string;
  /**
   * True while the delete request is in flight: the confirm button shows a
   * loader and takes no second click, and the dialog cannot be dismissed (a
   * dialog that closes mid-request hides the failure it may end in).
   */
  loading?: boolean;
}

/**
 * Confirmation dialog shown before a cron job is
 * deleted. The caller keeps it open on failure, so the user can retry or
 * cancel.
 *
 * Package-local copy of ui-workflows' `WorkflowDeleteConfirmModal`; not exported from the
 * package (ui-files and ui-users already export that name).
 */
export const CronDeleteConfirmModal: React.FC<CronDeleteConfirmModalProps> = ({
  opened,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  loading = false,
}) => {
  const common = useBuildpadTranslations((d) => d.common);
  const close = () => {
    if (!loading) onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={close}
      closeOnClickOutside={!loading}
      closeOnEscape={!loading}
      withCloseButton={!loading}
      title={
        <Group gap="xs">
          <IconAlertTriangle size={20} color="var(--mantine-color-red-6)" />
          <Text fw={600}>{title ?? common.confirmDeleteTitle}</Text>
        </Group>
      }
      size="sm"
      centered
      data-testid="cron-delete-confirm-modal"
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed" component="div">
          {description}
        </Text>
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={close} disabled={loading}>
            {common.cancel}
          </Button>
          <Button
            color="red"
            onClick={() => void onConfirm()}
            loading={loading}
            data-testid="cron-delete-confirm-btn"
          >
            {confirmLabel ?? common.delete}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};

export default CronDeleteConfirmModal;
