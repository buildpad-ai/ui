'use client';

import React from 'react';
import { Box, Stack, Text, Button, ThemeIcon } from '@mantine/core';
import { IconDownload, IconFile } from '@tabler/icons-react';
import { getAssetUrl, getFileCategory, formatFileSize } from '@buildpad/types';
import type { FileUpload } from '@buildpad/hooks';

export interface FilePreviewProps {
  /** The file to preview. */
  file: FileUpload;
  /** Max height of the preview surface (px). */
  maxHeight?: number;
}

/**
 * Renders an inline preview of a file based on its MIME type:
 * image, video, audio, and PDF are rendered inline; everything else
 * falls back to an icon with a download action.
 */
export const FilePreview: React.FC<FilePreviewProps> = ({ file, maxHeight = 520 }) => {
  const category = getFileCategory(file.type);
  const src = getAssetUrl(file.id);
  const isPdf = file.type === 'application/pdf';

  if (category === 'image') {
    return (
      <Box
        data-testid="file-preview-image"
        style={{ display: 'flex', justifyContent: 'center' }}
      >
        <img
          src={src}
          alt={file.title || file.filename_download}
          style={{ maxWidth: '100%', maxHeight, objectFit: 'contain', borderRadius: 8 }}
        />
      </Box>
    );
  }

  if (category === 'video') {
    return (
      <Box data-testid="file-preview-video" style={{ display: 'flex', justifyContent: 'center' }}>
        <video src={src} controls style={{ maxWidth: '100%', maxHeight, borderRadius: 8 }} />
      </Box>
    );
  }

  if (category === 'audio') {
    return (
      <Box data-testid="file-preview-audio">
        <audio src={src} controls style={{ width: '100%' }} />
      </Box>
    );
  }

  if (isPdf) {
    return (
      <Box data-testid="file-preview-pdf">
        <iframe
          src={src}
          title={file.filename_download}
          style={{ width: '100%', height: maxHeight, border: 'none', borderRadius: 8 }}
        />
      </Box>
    );
  }

  return (
    <Stack align="center" gap="sm" py="xl" data-testid="file-preview-fallback">
      <ThemeIcon size={64} variant="light" radius="md">
        <IconFile size={36} />
      </ThemeIcon>
      <Text fw={500}>{file.filename_download}</Text>
      <Text size="sm" c="dimmed">
        {file.type || 'Unknown type'} · {formatFileSize(file.filesize)}
      </Text>
      <Button
        component="a"
        href={getAssetUrl(file.id, { download: true })}
        leftSection={<IconDownload size={16} />}
        variant="light"
      >
        Download
      </Button>
    </Stack>
  );
};

export default FilePreview;
