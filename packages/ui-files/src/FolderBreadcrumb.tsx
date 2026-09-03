'use client';

import React from 'react';
import { Anchor, Breadcrumbs, Text } from '@mantine/core';
import { IconChevronRight } from '@tabler/icons-react';
import { useBuildpadTranslations } from '@buildpad/hooks';
import type { DeepPartial, FilesTranslations } from '@buildpad/utils';

export interface FolderPathItem {
  id: string;
  name: string;
}

export interface FolderBreadcrumbProps {
  /** Ancestors from root → current (excluding the implicit root entry). */
  path: FolderPathItem[];
  /** Label for the root crumb. Defaults to the dictionary's `files.folderBreadcrumb.root`. */
  rootLabel?: string;
  /** Navigate to a folder id, or `null` for root. */
  onNavigate: (folderId: string | null) => void;
  /** Per-instance overrides of the `files` dictionary namespace (prop > provider > defaults). */
  translations?: DeepPartial<FilesTranslations>;
}

/**
 * Breadcrumb trail for folder navigation. The last crumb is the current
 * folder and is rendered as plain text.
 */
export const FolderBreadcrumb: React.FC<FolderBreadcrumbProps> = ({
  path,
  rootLabel,
  onNavigate,
  translations,
}) => {
  const t = useBuildpadTranslations((d) => d.files, translations);
  const items = [{ id: null as string | null, name: rootLabel ?? t.folderBreadcrumb.root }, ...path];

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
