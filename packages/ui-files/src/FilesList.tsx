'use client';

import React from 'react';
import { ActionIcon, Checkbox, Group, Menu, Table, Text, ThemeIcon } from '@mantine/core';
import {
  IconDots,
  IconDownload,
  IconFile,
  IconFolder,
  IconPencil,
  IconTrash,
} from '@tabler/icons-react';
import { formatFileSize, getFileCategory } from '@buildpad/types';
import {
  useBuildpadI18n,
  useBuildpadTranslations,
  type FileUpload,
  type Folder,
} from '@buildpad/hooks';
import { interpolate, type DeepPartial, type FilesTranslations } from '@buildpad/utils';

export interface FilesListProps {
  folders: Folder[];
  files: FileUpload[];
  selectable?: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string, checked: boolean) => void;
  /** Toggle selection for every file currently shown. */
  onToggleAll?: (checked: boolean) => void;
  onOpenFolder: (folder: Folder) => void;
  onOpenFile: (file: FileUpload) => void;
  /** Per-row download action. */
  onDownloadFile?: (file: FileUpload) => void;
  /** Per-row delete action. */
  onDeleteFile?: (file: FileUpload) => void;
  canUpdate?: boolean;
  canDelete?: boolean;
  /** Per-instance overrides of the `files` dictionary namespace (prop > provider > defaults). */
  translations?: DeepPartial<FilesTranslations>;
}

/** The components `Date#toLocaleDateString()` renders with no options. */
const DATE_OPTIONS: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'numeric', day: 'numeric' };

/**
 * Table layout rendering folders first, then files, with a selection
 * column (incl. select-all) and a per-row actions menu.
 */
export const FilesList: React.FC<FilesListProps> = ({
  folders,
  files,
  selectable = true,
  selectedIds,
  onToggleSelect,
  onToggleAll,
  onOpenFolder,
  onOpenFile,
  onDownloadFile,
  onDeleteFile,
  canUpdate = true,
  canDelete = true,
  translations,
}) => {
  const t = useBuildpadTranslations((d) => d.files, translations);
  const common = useBuildpadTranslations((d) => d.common);
  const { formatDate } = useBuildpadI18n();

  const selectedCount = files.filter((f) => selectedIds.has(f.id)).length;
  const allSelected = files.length > 0 && selectedCount === files.length;
  const someSelected = selectedCount > 0 && !allSelected;
  const showRowMenu = Boolean(onDownloadFile || (onDeleteFile && canDelete) || canUpdate);

  // `formatDate` returns '' for an empty or invalid value.
  const uploadedOn = (value?: string) => formatDate(value, DATE_OPTIONS) || t.emptyValue;

  return (
    <Table highlightOnHover verticalSpacing="sm" data-testid="files-list">
      <Table.Thead>
        <Table.Tr>
          {selectable && (
            <Table.Th w={40}>
              {onToggleAll && (
                <Checkbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  onChange={(e) => onToggleAll(e.currentTarget.checked)}
                  aria-label={t.filesList.selectAllAriaLabel}
                  data-testid="files-select-all"
                />
              )}
            </Table.Th>
          )}
          <Table.Th>{t.filesList.columns.name}</Table.Th>
          <Table.Th w={140}>{t.filesList.columns.type}</Table.Th>
          <Table.Th w={120}>{t.filesList.columns.size}</Table.Th>
          <Table.Th w={140}>{t.filesList.columns.uploaded}</Table.Th>
          {showRowMenu && <Table.Th w={56} />}
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {folders.map((folder) => (
          <Table.Tr
            key={`folder-${folder.id}`}
            style={{ cursor: 'pointer' }}
            onClick={() => onOpenFolder(folder)}
            data-testid="files-list-folder-row"
          >
            {selectable && <Table.Td />}
            <Table.Td>
              <Group gap="xs" wrap="nowrap">
                <ThemeIcon size="sm" variant="light" color="yellow">
                  <IconFolder size={14} />
                </ThemeIcon>
                <Text size="sm" fw={500}>
                  {folder.name}
                </Text>
              </Group>
            </Table.Td>
            <Table.Td>
              <Text size="sm" c="dimmed">
                {t.filesList.folderType}
              </Text>
            </Table.Td>
            <Table.Td>{t.emptyValue}</Table.Td>
            <Table.Td>{t.emptyValue}</Table.Td>
            {showRowMenu && <Table.Td />}
          </Table.Tr>
        ))}

        {files.map((file) => (
          <Table.Tr
            key={`file-${file.id}`}
            style={{ cursor: 'pointer' }}
            data-testid="files-list-file-row"
          >
            {selectable && (
              <Table.Td onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={selectedIds.has(file.id)}
                  onChange={(e) => onToggleSelect(file.id, e.currentTarget.checked)}
                  aria-label={interpolate(t.filesList.selectAriaLabel, {
                    filename: file.filename_download,
                  })}
                />
              </Table.Td>
            )}
            <Table.Td onClick={() => onOpenFile(file)}>
              <Group gap="xs" wrap="nowrap">
                <ThemeIcon size="sm" variant="light">
                  <IconFile size={14} />
                </ThemeIcon>
                <Text size="sm" fw={500} truncate>
                  {file.title || file.filename_download}
                </Text>
              </Group>
            </Table.Td>
            <Table.Td onClick={() => onOpenFile(file)}>
              <Text size="sm" c="dimmed" style={{ textTransform: 'capitalize' }}>
                {t.fileCategory[getFileCategory(file.type)]}
              </Text>
            </Table.Td>
            <Table.Td onClick={() => onOpenFile(file)}>{formatFileSize(file.filesize)}</Table.Td>
            <Table.Td onClick={() => onOpenFile(file)}>{uploadedOn(file.uploaded_on)}</Table.Td>
            {showRowMenu && (
              <Table.Td onClick={(e) => e.stopPropagation()}>
                <Menu position="bottom-end" withinPortal>
                  <Menu.Target>
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      aria-label={t.filesList.fileActionsAriaLabel}
                      data-testid="files-list-row-menu"
                    >
                      <IconDots size={16} />
                    </ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown>
                    {canUpdate && (
                      <Menu.Item
                        leftSection={<IconPencil size={14} />}
                        onClick={() => onOpenFile(file)}
                      >
                        {common.edit}
                      </Menu.Item>
                    )}
                    {onDownloadFile && (
                      <Menu.Item
                        leftSection={<IconDownload size={14} />}
                        onClick={() => onDownloadFile(file)}
                      >
                        {common.download}
                      </Menu.Item>
                    )}
                    {onDeleteFile && canDelete && (
                      <Menu.Item
                        color="red"
                        leftSection={<IconTrash size={14} />}
                        onClick={() => onDeleteFile(file)}
                      >
                        {common.delete}
                      </Menu.Item>
                    )}
                  </Menu.Dropdown>
                </Menu>
              </Table.Td>
            )}
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
};

export default FilesList;
