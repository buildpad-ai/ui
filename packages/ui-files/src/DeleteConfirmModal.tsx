'use client';

import React from 'react';
import { Button, Group, Modal, Stack, Text } from '@mantine/core';
import { useBuildpadI18n, useBuildpadTranslations } from '@buildpad/hooks';
import type { DeepPartial, FilesTranslations, PluralForms } from '@buildpad/utils';

export interface DeleteConfirmModalProps {
  opened: boolean;
  count: number;
  loading?: boolean;
  /**
   * Noun for the items being deleted. `'file'` (default) and `'folder'` use
   * the dictionary's plural forms; any other string is shown as given and
   * pluralised with a trailing "s".
   */
  noun?: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Per-instance overrides of the `files` dictionary namespace (prop > provider > defaults). */
  translations?: DeepPartial<FilesTranslations>;
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
  translations,
}) => {
  const t = useBuildpadTranslations((d) => d.files, translations);
  const common = useBuildpadTranslations((d) => d.common);
  const { formatCount } = useBuildpadI18n();

  const nounForms: PluralForms =
    noun === 'file'
      ? t.deleteConfirmModal.noun.file
      : noun === 'folder'
        ? t.deleteConfirmModal.noun.folder
        : { one: noun, other: `${noun}s` };
  const message = formatCount(count, t.deleteConfirmModal.message, {
    noun: formatCount(count, nounForms),
  });

  return (
    <Modal
      opened={opened}
      onClose={onCancel}
      title={t.deleteConfirmModal.title}
      centered
      size="sm"
      data-testid="files-delete-confirm-modal"
    >
      <Stack gap="md">
        <Text size="sm">{message}</Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={onCancel} disabled={loading}>
            {common.cancel}
          </Button>
          <Button
            color="red"
            onClick={onConfirm}
            loading={loading}
            data-testid="files-delete-confirm-btn"
          >
            {common.delete}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};

export default DeleteConfirmModal;
