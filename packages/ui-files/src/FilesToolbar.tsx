'use client';

import React from 'react';
import { Button, Group, SegmentedControl, TextInput, VisuallyHidden } from '@mantine/core';
import {
  IconFolderPlus,
  IconLayoutGrid,
  IconList,
  IconSearch,
} from '@tabler/icons-react';
import { useBuildpadTranslations } from '@buildpad/hooks';
import type { DeepPartial, FilesTranslations } from '@buildpad/utils';

export type FilesView = 'grid' | 'list';

export interface FilesToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  view: FilesView;
  onViewChange: (view: FilesView) => void;
  onNewFolder?: () => void;
  /** Extra controls rendered on the right (e.g. the Upload affordance). */
  actions?: React.ReactNode;
  /** Per-instance overrides of the `files` dictionary namespace (prop > provider > defaults). */
  translations?: DeepPartial<FilesTranslations>;
}

/**
 * Toolbar for the file manager: search, New Folder, view toggle, and a
 * slot for upload/import actions.
 */
export const FilesToolbar: React.FC<FilesToolbarProps> = ({
  search,
  onSearchChange,
  view,
  onViewChange,
  onNewFolder,
  actions,
  translations,
}) => {
  const t = useBuildpadTranslations((d) => d.files, translations);

  return (
    <Group justify="space-between" wrap="wrap" gap="sm" data-testid="files-toolbar">
      <TextInput
        placeholder={t.filesToolbar.searchPlaceholder}
        value={search}
        onChange={(e) => onSearchChange(e.currentTarget.value)}
        leftSection={<IconSearch size={16} />}
        style={{ flex: 1, minWidth: 220 }}
        data-testid="files-search"
      />

      <Group gap="sm">
        {onNewFolder && (
          <Button
            variant="default"
            leftSection={<IconFolderPlus size={16} />}
            onClick={onNewFolder}
            data-testid="files-new-folder"
          >
            {t.filesToolbar.newFolder}
          </Button>
        )}

        {actions}

        <SegmentedControl
          value={view}
          onChange={(v) => onViewChange(v as FilesView)}
          data-testid="files-view-toggle"
          data={[
            {
              value: 'grid',
              label: (
                <>
                  <IconLayoutGrid size={16} />
                  <VisuallyHidden>{t.filesToolbar.gridView}</VisuallyHidden>
                </>
              ),
            },
            {
              value: 'list',
              label: (
                <>
                  <IconList size={16} />
                  <VisuallyHidden>{t.filesToolbar.listView}</VisuallyHidden>
                </>
              ),
            },
          ]}
        />
      </Group>
    </Group>
  );
};

export default FilesToolbar;
