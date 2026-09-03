'use client';

import React from 'react';
import { ActionIcon, Group, Menu, Paper, Text, ThemeIcon } from '@mantine/core';
import { IconDots, IconFolder, IconPencil, IconTrash } from '@tabler/icons-react';
import { useBuildpadTranslations, type Folder } from '@buildpad/hooks';
import type { DeepPartial, FilesTranslations } from '@buildpad/utils';

export interface FolderCardProps {
  folder: Folder;
  onOpen?: (folder: Folder) => void;
  onRename?: (folder: Folder) => void;
  onDelete?: (folder: Folder) => void;
  /** Per-instance overrides of the `files` dictionary namespace (prop > provider > defaults). */
  translations?: DeepPartial<FilesTranslations>;
}

/**
 * A folder tile for the grid view. Click to navigate in; optional
 * rename/delete actions via an overflow menu.
 */
export const FolderCard: React.FC<FolderCardProps> = ({
  folder,
  onOpen,
  onRename,
  onDelete,
  translations,
}) => {
  const t = useBuildpadTranslations((d) => d.files, translations);
  const common = useBuildpadTranslations((d) => d.common);
  const hasMenu = Boolean(onRename || onDelete);

  return (
    <Paper
      withBorder
      radius="md"
      p="sm"
      data-testid="folder-card"
      style={{ cursor: onOpen ? 'pointer' : 'default' }}
      onClick={() => onOpen?.(folder)}
    >
      <Group justify="space-between" wrap="nowrap">
        <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
          <ThemeIcon size={40} variant="light" radius="md" color="yellow">
            <IconFolder size={24} />
          </ThemeIcon>
          <Text size="sm" fw={500} truncate title={folder.name}>
            {folder.name}
          </Text>
        </Group>

        {hasMenu && (
          <Menu position="bottom-end" withinPortal>
            <Menu.Target>
              <ActionIcon
                variant="subtle"
                color="gray"
                onClick={(e) => e.stopPropagation()}
                aria-label={t.folderCard.folderActionsAriaLabel}
                data-testid="folder-card-menu"
              >
                <IconDots size={16} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown onClick={(e) => e.stopPropagation()}>
              {onRename && (
                <Menu.Item leftSection={<IconPencil size={14} />} onClick={() => onRename(folder)}>
                  {t.folderCard.rename}
                </Menu.Item>
              )}
              {onDelete && (
                <Menu.Item
                  color="red"
                  leftSection={<IconTrash size={14} />}
                  onClick={() => onDelete(folder)}
                >
                  {common.delete}
                </Menu.Item>
              )}
            </Menu.Dropdown>
          </Menu>
        )}
      </Group>
    </Paper>
  );
};

export default FolderCard;
