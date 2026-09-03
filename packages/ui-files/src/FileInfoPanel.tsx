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
import { useBuildpadI18n, useBuildpadTranslations, type FileUpload } from '@buildpad/hooks';
import { interpolate, type DeepPartial, type FilesTranslations } from '@buildpad/utils';

export interface FileInfoPanelProps {
  file: FileUpload;
  /** Per-instance overrides of the `files` dictionary namespace (prop > provider > defaults). */
  translations?: DeepPartial<FilesTranslations>;
}

/** The components `Date#toLocaleString()` renders with no options. */
const DATE_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
};

/** "m:ss" from a duration in seconds, or `null` when there is none. */
function formatDuration(seconds: number | undefined, template: string): string | null {
  if (!seconds || Number.isNaN(seconds)) return null;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return interpolate(template, { minutes: m, seconds: s.toString().padStart(2, '0') });
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
export const FileInfoPanel: React.FC<FileInfoPanelProps> = ({ file, translations }) => {
  const t = useBuildpadTranslations((d) => d.files, translations);
  const { formatDateTime } = useBuildpadI18n();
  const hasDimensions = Boolean(file.width && file.height);
  const hasDuration = Boolean(file.duration);

  // `formatDateTime` returns '' for an empty or invalid value.
  const dateTime = (value?: string) => formatDateTime(value, DATE_TIME_OPTIONS) || t.emptyValue;

  return (
    <Paper withBorder radius="md" p="md" data-testid="file-info-panel">
      <Stack gap="sm">
        <Text size="sm" fw={600}>
          {t.fileInfoPanel.heading}
        </Text>

        <Row label={t.fileInfoPanel.rows.id}>
          <Group gap={4} wrap="nowrap" justify="flex-end">
            <Text size="xs" ff="monospace">
              {interpolate(t.fileInfoPanel.idTruncated, { id: file.id.slice(0, 8) })}
            </Text>
            <CopyButton value={file.id} timeout={1500}>
              {({ copied, copy }) => (
                <Tooltip label={copied ? t.fileInfoPanel.copied : t.fileInfoPanel.copyId} withArrow>
                  <ActionIcon
                    size="xs"
                    variant="subtle"
                    color={copied ? 'teal' : 'gray'}
                    onClick={copy}
                    aria-label={t.fileInfoPanel.copyFileIdAriaLabel}
                    data-testid="file-info-copy-id"
                  >
                    {copied ? <IconCheck size={12} /> : <IconCopy size={12} />}
                  </ActionIcon>
                </Tooltip>
              )}
            </CopyButton>
          </Group>
        </Row>

        <Row label={t.fileInfoPanel.rows.type}>{file.type || t.emptyValue}</Row>
        <Row label={t.fileInfoPanel.rows.size}>{formatFileSize(file.filesize)}</Row>
        {hasDimensions && (
          <Row label={t.fileInfoPanel.rows.dimensions}>
            {interpolate(t.fileInfoPanel.dimensionsFormat, { width: file.width, height: file.height })}
          </Row>
        )}
        {hasDuration && (
          <Row label={t.fileInfoPanel.rows.duration}>
            {formatDuration(file.duration, t.fileInfoPanel.durationFormat) ?? t.emptyValue}
          </Row>
        )}
        <Row label={t.fileInfoPanel.rows.storage}>{file.storage || t.emptyValue}</Row>
        <Row label={t.fileInfoPanel.rows.uploaded}>{dateTime(file.uploaded_on)}</Row>
        <Row label={t.fileInfoPanel.rows.modified}>{dateTime(file.modified_on)}</Row>
      </Stack>
    </Paper>
  );
};

export default FileInfoPanel;
