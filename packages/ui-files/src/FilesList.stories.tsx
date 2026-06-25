import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { FilesList } from './FilesList';
import { mockFiles, mockFolders } from './_fixtures';

const meta: Meta<typeof FilesList> = {
  title: 'Files/FilesList',
  component: FilesList,
};

export default meta;
type Story = StoryObj<typeof FilesList>;

export const Default: Story = {
  render: () => (
    <FilesList
      folders={mockFolders}
      files={mockFiles}
      selectedIds={new Set()}
      onToggleSelect={() => {}}
      onOpenFolder={() => {}}
      onOpenFile={() => {}}
    />
  ),
};

/** Select-all + per-row download/delete actions wired up with local state. */
export const WithRowActions: Story = {
  render: () => {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const toggle = (id: string, checked: boolean) =>
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (checked) next.add(id);
        else next.delete(id);
        return next;
      });
    const toggleAll = (checked: boolean) =>
      setSelectedIds(checked ? new Set(mockFiles.map((f) => f.id)) : new Set());
    return (
      <FilesList
        folders={mockFolders}
        files={mockFiles}
        selectedIds={selectedIds}
        onToggleSelect={toggle}
        onToggleAll={toggleAll}
        onOpenFolder={() => {}}
        onOpenFile={() => {}}
        onDownloadFile={() => {}}
        onDeleteFile={() => {}}
        canUpdate
        canDelete
      />
    );
  },
};
