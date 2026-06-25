import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { FolderBreadcrumb, type FolderPathItem } from './FolderBreadcrumb';

const meta: Meta<typeof FolderBreadcrumb> = {
  title: 'Files/FolderBreadcrumb',
  component: FolderBreadcrumb,
};

export default meta;
type Story = StoryObj<typeof FolderBreadcrumb>;

export const Nested: Story = {
  render: () => {
    const [path, setPath] = useState<FolderPathItem[]>([
      { id: 'a', name: 'Marketing' },
      { id: 'b', name: 'Campaigns' },
      { id: 'c', name: '2026' },
    ]);
    return (
      <FolderBreadcrumb
        path={path}
        onNavigate={(id) => {
          if (id === null) setPath([]);
          else {
            const idx = path.findIndex((p) => p.id === id);
            if (idx >= 0) setPath(path.slice(0, idx + 1));
          }
        }}
      />
    );
  },
};

export const Root: Story = {
  args: { path: [], onNavigate: () => {} },
};
