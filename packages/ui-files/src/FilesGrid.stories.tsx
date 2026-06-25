import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { FilesGrid } from './FilesGrid';
import { mockFiles, mockFolders } from './_fixtures';

const meta: Meta<typeof FilesGrid> = {
  title: 'Files/FilesGrid',
  component: FilesGrid,
};

export default meta;
type Story = StoryObj<typeof FilesGrid>;

/** Folders render first, then files. */
export const Default: Story = {
  render: () => (
    <FilesGrid
      folders={mockFolders}
      files={mockFiles}
      selectedIds={new Set()}
      onToggleSelect={() => {}}
      onOpenFolder={() => {}}
      onOpenFile={() => {}}
    />
  ),
};

/** Interactive selection — click the card checkboxes to toggle. */
export const WithSelection: Story = {
  render: () => {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(
      new Set([mockFiles[0].id])
    );
    const toggle = (id: string, checked: boolean) =>
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (checked) next.add(id);
        else next.delete(id);
        return next;
      });
    return (
      <FilesGrid
        folders={mockFolders}
        files={mockFiles}
        selectedIds={selectedIds}
        onToggleSelect={toggle}
        onOpenFolder={() => {}}
        onOpenFile={() => {}}
        onRenameFolder={() => {}}
        onDeleteFolder={() => {}}
      />
    );
  },
};
