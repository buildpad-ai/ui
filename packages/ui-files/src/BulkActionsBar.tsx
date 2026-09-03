'use client';

import React from 'react';
import { ActionIcon, Badge, Button, Group, Tooltip } from '@mantine/core';
import { IconTrash, IconX } from '@tabler/icons-react';
import { useBuildpadI18n, useBuildpadTranslations } from '@buildpad/hooks';
import type { DeepPartial, FilesTranslations } from '@buildpad/utils';

export interface BulkActionsBarProps {
  count: number;
  deleting?: boolean;
  onDelete: () => void;
  onClear: () => void;
  /** Per-instance overrides of the `files` dictionary namespace (prop > provider > defaults). */
  translations?: DeepPartial<FilesTranslations>;
}

/**
 * Floating action bar shown when one or more files are selected.
 */
export const BulkActionsBar: React.FC<BulkActionsBarProps> = ({
  count,
  deleting = false,
  onDelete,
  onClear,
  translations,
}) => {
  const t = useBuildpadTranslations((d) => d.files, translations);
  const common = useBuildpadTranslations((d) => d.common);
  const { formatCount } = useBuildpadI18n();

  return (
    <Group gap="xs" data-testid="files-bulk-actions">
      <Badge variant="light" size="lg">
        {formatCount(count, t.bulkActionsBar.selectedCount)}
      </Badge>

      <Tooltip label={t.bulkActionsBar.deleteSelectedTooltip}>
        <Button
          variant="light"
          color="red"
          size="compact-sm"
          leftSection={<IconTrash size={16} />}
          loading={deleting}
          onClick={onDelete}
          data-testid="files-bulk-delete"
        >
          {common.delete}
        </Button>
      </Tooltip>

      <ActionIcon
        variant="subtle"
        color="gray"
        onClick={onClear}
        title={t.bulkActionsBar.clearSelection}
        aria-label={t.bulkActionsBar.clearSelection}
        data-testid="files-clear-selection"
      >
        <IconX size={16} />
      </ActionIcon>
    </Group>
  );
};

export default BulkActionsBar;
