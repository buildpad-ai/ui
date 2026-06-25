'use client';

import React from 'react';
import { ActionIcon, Badge, Button, Group, Tooltip } from '@mantine/core';
import { IconTrash, IconX } from '@tabler/icons-react';

export interface BulkActionsBarProps {
  count: number;
  deleting?: boolean;
  onDelete: () => void;
  onClear: () => void;
}

/**
 * Floating action bar shown when one or more files are selected.
 */
export const BulkActionsBar: React.FC<BulkActionsBarProps> = ({
  count,
  deleting = false,
  onDelete,
  onClear,
}) => {
  return (
    <Group gap="xs" data-testid="files-bulk-actions">
      <Badge variant="light" size="lg">
        {count} selected
      </Badge>

      <Tooltip label="Delete selected">
        <Button
          variant="light"
          color="red"
          size="compact-sm"
          leftSection={<IconTrash size={16} />}
          loading={deleting}
          onClick={onDelete}
          data-testid="files-bulk-delete"
        >
          Delete
        </Button>
      </Tooltip>

      <ActionIcon
        variant="subtle"
        color="gray"
        onClick={onClear}
        title="Clear selection"
        aria-label="Clear selection"
        data-testid="files-clear-selection"
      >
        <IconX size={16} />
      </ActionIcon>
    </Group>
  );
};

export default BulkActionsBar;
