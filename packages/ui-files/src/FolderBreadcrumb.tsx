'use client';

import React from 'react';
import { Anchor, Breadcrumbs, Text } from '@mantine/core';
import { IconChevronRight } from '@tabler/icons-react';

export interface FolderPathItem {
  id: string;
  name: string;
}

export interface FolderBreadcrumbProps {
  /** Ancestors from root → current (excluding the implicit root entry). */
  path: FolderPathItem[];
  /** Label for the root crumb. */
  rootLabel?: string;
  /** Navigate to a folder id, or `null` for root. */
  onNavigate: (folderId: string | null) => void;
}

/**
 * Breadcrumb trail for folder navigation. The last crumb is the current
 * folder and is rendered as plain text.
 */
export const FolderBreadcrumb: React.FC<FolderBreadcrumbProps> = ({
  path,
  rootLabel = 'Files',
  onNavigate,
}) => {
  const items = [{ id: null as string | null, name: rootLabel }, ...path];

  return (
    <Breadcrumbs
      separator={<IconChevronRight size={14} />}
      data-testid="folder-breadcrumb"
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        if (isLast) {
          return (
            <Text key={item.id ?? 'root'} size="sm" fw={600}>
              {item.name}
            </Text>
          );
        }
        return (
          <Anchor
            key={item.id ?? 'root'}
            size="sm"
            onClick={() => onNavigate(item.id)}
          >
            {item.name}
          </Anchor>
        );
      })}
    </Breadcrumbs>
  );
};

export default FolderBreadcrumb;
