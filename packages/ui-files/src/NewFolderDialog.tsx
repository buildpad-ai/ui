'use client';

import React, { useEffect, useState } from 'react';
import { Button, Group, Modal, Stack, TextInput } from '@mantine/core';
import { useBuildpadTranslations } from '@buildpad/hooks';
import type { DeepPartial, FilesTranslations } from '@buildpad/utils';

export interface NewFolderDialogProps {
  opened: boolean;
  loading?: boolean;
  /** Pre-fill the name (used when renaming). */
  initialName?: string;
  /** Modal title. Defaults to the dictionary's `files.newFolderDialog.title`. */
  title?: string;
  /** Submit button label. Defaults to the dictionary's `files.newFolderDialog.submitLabel`. */
  submitLabel?: string;
  onSubmit: (name: string) => void;
  onClose: () => void;
  /** Per-instance overrides of the `files` dictionary namespace (prop > provider > defaults). */
  translations?: DeepPartial<FilesTranslations>;
}

/**
 * Dialog for creating (or renaming) a folder.
 */
export const NewFolderDialog: React.FC<NewFolderDialogProps> = ({
  opened,
  loading = false,
  initialName = '',
  title,
  submitLabel,
  onSubmit,
  onClose,
  translations,
}) => {
  const t = useBuildpadTranslations((d) => d.files, translations);
  const common = useBuildpadTranslations((d) => d.common);
  const [name, setName] = useState(initialName);

  useEffect(() => {
    if (opened) setName(initialName);
  }, [opened, initialName]);

  const trimmed = name.trim();

  const handleSubmit = () => {
    if (!trimmed) return;
    onSubmit(trimmed);
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={title ?? t.newFolderDialog.title}
      centered
      size="sm"
    >
      <Stack gap="md">
        <TextInput
          label={t.newFolderDialog.nameLabel}
          placeholder={t.newFolderDialog.namePlaceholder}
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          data-autofocus
          data-testid="new-folder-name"
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit();
          }}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose} disabled={loading}>
            {common.cancel}
          </Button>
          <Button
            onClick={handleSubmit}
            loading={loading}
            disabled={!trimmed}
            data-testid="new-folder-submit"
          >
            {submitLabel ?? t.newFolderDialog.submitLabel}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};

export default NewFolderDialog;
