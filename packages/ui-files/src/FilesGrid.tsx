'use client';

import React from 'react';
import { SimpleGrid } from '@mantine/core';
import type { FileUpload, Folder } from '@buildpad/hooks';
import type { DeepPartial, FilesTranslations } from '@buildpad/utils';
import { FileCard } from './FileCard';
import { FolderCard } from './FolderCard';

export interface FilesGridProps {
  folders: Folder[];
  files: FileUpload[];
  selectable?: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string, checked: boolean) => void;
  onOpenFolder: (folder: Folder) => void;
  onOpenFile: (file: FileUpload) => void;
  onRenameFolder?: (folder: Folder) => void;
  onDeleteFolder?: (folder: Folder) => void;
  /** Per-instance overrides of the `files` dictionary namespace, forwarded to the cards. */
  translations?: DeepPartial<FilesTranslations>;
}

/**
 * Grid layout rendering folders first, then files.
 */
export const FilesGrid: React.FC<FilesGridProps> = ({
  folders,
  files,
  selectable = true,
  selectedIds,
  onToggleSelect,
  onOpenFolder,
  onOpenFile,
  onRenameFolder,
  onDeleteFolder,
  translations,
}) => {
  return (
    <SimpleGrid
      cols={{ base: 2, sm: 3, md: 4, lg: 5 }}
      spacing="md"
      data-testid="files-grid"
    >
      {folders.map((folder) => (
        <FolderCard
          key={`folder-${folder.id}`}
          folder={folder}
          onOpen={onOpenFolder}
          onRename={onRenameFolder}
          onDelete={onDeleteFolder}
          translations={translations}
        />
      ))}
      {files.map((file) => (
        <FileCard
          key={`file-${file.id}`}
          file={file}
          selectable={selectable}
          selected={selectedIds.has(file.id)}
          onSelect={onToggleSelect}
          onOpen={onOpenFile}
          translations={translations}
        />
      ))}
    </SimpleGrid>
  );
};

export default FilesGrid;
