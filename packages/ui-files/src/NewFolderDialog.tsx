'use client';

import React, { useEffect, useState } from 'react';
import { Button, Group, Modal, Stack, TextInput } from '@mantine/core';

export interface NewFolderDialogProps {
  opened: boolean;
  loading?: boolean;
  /** Pre-fill the name (used when renaming). */
  initialName?: string;
  /** Modal title. */
  title?: string;
  /** Submit button label. */
  submitLabel?: string;
  onSubmit: (name: string) => void;
  onClose: () => void;
}

/**
 * Dialog for creating (or renaming) a folder.
 */
export const NewFolderDialog: React.FC<NewFolderDialogProps> = ({
  opened,
  loading = false,
  initialName = '',
  title = 'New Folder',
  submitLabel = 'Create',
  onSubmit,
  onClose,
}) => {
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
    <Modal opened={opened} onClose={onClose} title={title} centered size="sm">
      <Stack gap="md">
        <TextInput
          label="Folder name"
          placeholder="My folder"
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
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            loading={loading}
            disabled={!trimmed}
            data-testid="new-folder-submit"
          >
            {submitLabel}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};

export default NewFolderDialog;
