'use client';

import React from 'react';
import { ActionIcon, Group, Menu, Paper, Text, ThemeIcon } from '@mantine/core';
import { IconDots, IconFolder, IconPencil, IconTrash } from '@tabler/icons-react';
import type { Folder } from '@buildpad/hooks';

export interface FolderCardProps {
  folder: Folder;
  onOpen?: (folder: Folder) => void;
  onRename?: (folder: Folder) => void;
  onDelete?: (folder: Folder) => void;
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
}) => {
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
                aria-label="Folder actions"
                data-testid="folder-card-menu"
              >
                <IconDots size={16} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown onClick={(e) => e.stopPropagation()}>
              {onRename && (
                <Menu.Item leftSection={<IconPencil size={14} />} onClick={() => onRename(folder)}>
                  Rename
                </Menu.Item>
              )}
              {onDelete && (
                <Menu.Item
                  color="red"
                  leftSection={<IconTrash size={14} />}
                  onClick={() => onDelete(folder)}
                >
                  Delete
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
