'use client';

import React from 'react';
import {
  ActionIcon,
  CopyButton,
  Group,
  Paper,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core';
import { IconCheck, IconCopy } from '@tabler/icons-react';
import { formatFileSize } from '@buildpad/types';
import type { FileUpload } from '@buildpad/hooks';

export interface FileInfoPanelProps {
  file: FileUpload;
}

function formatDateTime(value?: string): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

function formatDuration(seconds?: number): string {
  if (!seconds || Number.isNaN(seconds)) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <Group justify="space-between" gap="md" wrap="nowrap" align="flex-start">
    <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
      {label}
    </Text>
    <Text size="xs" fw={500} ta="right" style={{ wordBreak: 'break-word' }}>
      {children}
    </Text>
  </Group>
);

/**
 * Read-only metadata panel for a file: id (copyable), MIME type, size,
 * dimensions, duration, storage, and timestamps.
 */
export const FileInfoPanel: React.FC<FileInfoPanelProps> = ({ file }) => {
  const hasDimensions = Boolean(file.width && file.height);
  const hasDuration = Boolean(file.duration);

  return (
    <Paper withBorder radius="md" p="md" data-testid="file-info-panel">
      <Stack gap="sm">
        <Text size="sm" fw={600}>
          File info
        </Text>

        <Row label="ID">
          <Group gap={4} wrap="nowrap" justify="flex-end">
            <Text size="xs" ff="monospace">
              {file.id.slice(0, 8)}…
            </Text>
            <CopyButton value={file.id} timeout={1500}>
              {({ copied, copy }) => (
                <Tooltip label={copied ? 'Copied' : 'Copy ID'} withArrow>
                  <ActionIcon
                    size="xs"
                    variant="subtle"
                    color={copied ? 'teal' : 'gray'}
                    onClick={copy}
                    aria-label="Copy file ID"
                    data-testid="file-info-copy-id"
                  >
                    {copied ? <IconCheck size={12} /> : <IconCopy size={12} />}
                  </ActionIcon>
                </Tooltip>
              )}
            </CopyButton>
          </Group>
        </Row>

        <Row label="Type">{file.type || '—'}</Row>
        <Row label="Size">{formatFileSize(file.filesize)}</Row>
        {hasDimensions && (
          <Row label="Dimensions">
            {file.width} × {file.height} px
          </Row>
        )}
        {hasDuration && <Row label="Duration">{formatDuration(file.duration)}</Row>}
        <Row label="Storage">{file.storage || '—'}</Row>
        <Row label="Uploaded">{formatDateTime(file.uploaded_on)}</Row>
        <Row label="Modified">{formatDateTime(file.modified_on)}</Row>
      </Stack>
    </Paper>
  );
};

export default FileInfoPanel;
