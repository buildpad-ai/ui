'use client';

import React, { useState } from 'react';
import { Badge, Box, Checkbox, Group, Paper, Stack, Text, ThemeIcon } from '@mantine/core';
import {
  IconFile,
  IconFileText,
  IconFileMusic,
  IconMovie,
  IconFileZip,
  IconCode,
} from '@tabler/icons-react';
import { getAssetUrl, getFileCategory, formatFileSize } from '@buildpad/types';
import type { FileUpload } from '@buildpad/hooks';

export interface FileCardProps {
  file: FileUpload;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (id: string, checked: boolean) => void;
  onOpen?: (file: FileUpload) => void;
}

const CATEGORY_ICON: Record<string, React.ReactNode> = {
  document: <IconFileText size={28} />,
  audio: <IconFileMusic size={28} />,
  video: <IconMovie size={28} />,
  archive: <IconFileZip size={28} />,
  code: <IconCode size={28} />,
  other: <IconFile size={28} />,
};

/**
 * A single file tile for the grid view: thumbnail (for images) or a
 * category icon, an optional selection checkbox, and name/size.
 */
export const FileCard: React.FC<FileCardProps> = ({
  file,
  selectable = true,
  selected = false,
  onSelect,
  onOpen,
}) => {
  const category = getFileCategory(file.type);
  const [imgError, setImgError] = useState(false);
  const showImage = category === 'image' && !imgError;
  const categoryIcon = CATEGORY_ICON[category] ?? CATEGORY_ICON.other;

  return (
    <Paper
      withBorder
      radius="md"
      p="xs"
      data-testid="file-card"
      data-selected={selected || undefined}
      style={{ cursor: onOpen ? 'pointer' : 'default', position: 'relative' }}
      onClick={() => onOpen?.(file)}
    >
      {selectable && (
        <Checkbox
          checked={selected}
          onChange={(e) => onSelect?.(file.id, e.currentTarget.checked)}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Select ${file.filename_download}`}
          data-testid="file-card-checkbox"
          style={{ position: 'absolute', top: 8, left: 8, zIndex: 2 }}
        />
      )}

      <Box
        style={{
          height: 120,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--mantine-color-gray-0)',
          borderRadius: 6,
          overflow: 'hidden',
        }}
      >
        {showImage ? (
          <img
            src={getAssetUrl(file.id, { width: 240, height: 240, fit: 'cover' })}
            alt={file.title || file.filename_download}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={() => setImgError(true)}
          />
        ) : (
          <ThemeIcon size={56} variant="light" radius="md">
            {categoryIcon}
          </ThemeIcon>
        )}
      </Box>

      <Stack gap={4} mt="xs">
        <Text size="sm" fw={500} truncate title={file.title || file.filename_download}>
          {file.title || file.filename_download}
        </Text>
        <Group justify="space-between" gap="xs" wrap="nowrap">
          <Badge size="xs" variant="light" color="gray" style={{ textTransform: 'capitalize' }}>
            {category}
          </Badge>
          <Text size="xs" c="dimmed">
            {formatFileSize(file.filesize)}
          </Text>
        </Group>
      </Stack>
    </Paper>
  );
};

export default FileCard;
