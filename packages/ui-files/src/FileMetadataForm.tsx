'use client';

import React, { useEffect, useState } from 'react';
import {
  Button,
  Group,
  NumberInput,
  Select,
  Stack,
  TagsInput,
  Textarea,
  TextInput,
} from '@mantine/core';
import { IconDeviceFloppy } from '@tabler/icons-react';
import type { FileUpload } from '@buildpad/hooks';

export interface FileMetadataValues {
  title: string;
  description: string;
  tags: string[];
  location: string;
  filename_download: string;
  folder: string | null;
  focal_point_x: number | null;
  focal_point_y: number | null;
}

export interface FolderOption {
  value: string;
  label: string;
}

export interface FileMetadataFormProps {
  file: FileUpload;
  saving?: boolean;
  disabled?: boolean;
  /** Folder choices for the move-to-folder selector. */
  folderOptions?: FolderOption[];
  /** Show focal-point inputs (images only). */
  showFocalPoint?: boolean;
  onSave: (values: FileMetadataValues) => void;
}

function toValues(file: FileUpload): FileMetadataValues {
  return {
    title: file.title ?? '',
    description: file.description ?? '',
    tags: file.tags ?? [],
    location: file.location ?? '',
    filename_download: file.filename_download ?? '',
    folder: file.folder ?? null,
    focal_point_x: file.focal_point_x ?? null,
    focal_point_y: file.focal_point_y ?? null,
  };
}

/**
 * Editable metadata form for a single file: title, description, tags,
 * location, download filename, folder (move), and focal point (images).
 */
export const FileMetadataForm: React.FC<FileMetadataFormProps> = ({
  file,
  saving = false,
  disabled = false,
  folderOptions = [],
  showFocalPoint = false,
  onSave,
}) => {
  const [values, setValues] = useState<FileMetadataValues>(() => toValues(file));

  useEffect(() => {
    setValues(toValues(file));
  }, [file]);

  const update = <K extends keyof FileMetadataValues>(key: K, value: FileMetadataValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  return (
    <Stack gap="md" data-testid="file-metadata-form">
      <TextInput
        label="Title"
        placeholder="Display name"
        value={values.title}
        onChange={(e) => update('title', e.currentTarget.value)}
        disabled={disabled}
      />
      <Textarea
        label="Description"
        placeholder="Free-text description"
        autosize
        minRows={2}
        value={values.description}
        onChange={(e) => update('description', e.currentTarget.value)}
        disabled={disabled}
      />
      <TagsInput
        label="Tags"
        placeholder="Add tag and press Enter"
        value={values.tags}
        onChange={(tags) => update('tags', tags)}
        disabled={disabled}
        clearable
      />
      <Select
        label="Folder"
        placeholder="Root"
        data={folderOptions}
        value={values.folder}
        onChange={(v) => update('folder', v)}
        disabled={disabled}
        clearable
        searchable
        nothingFoundMessage="No folders"
        data-testid="file-folder-select"
      />
      <TextInput
        label="Location"
        placeholder="Optional location"
        value={values.location}
        onChange={(e) => update('location', e.currentTarget.value)}
        disabled={disabled}
      />
      <TextInput
        label="Download filename"
        description="Filename used when the file is downloaded"
        value={values.filename_download}
        onChange={(e) => update('filename_download', e.currentTarget.value)}
        disabled={disabled}
      />

      {showFocalPoint && (
        <Group grow>
          <NumberInput
            label="Focal point X"
            description="Crop center (px)"
            value={values.focal_point_x ?? ''}
            onChange={(v) => update('focal_point_x', v === '' ? null : Number(v))}
            disabled={disabled}
            allowNegative={false}
          />
          <NumberInput
            label="Focal point Y"
            description="Crop center (px)"
            value={values.focal_point_y ?? ''}
            onChange={(v) => update('focal_point_y', v === '' ? null : Number(v))}
            disabled={disabled}
            allowNegative={false}
          />
        </Group>
      )}

      <Group justify="flex-end">
        <Button
          leftSection={<IconDeviceFloppy size={16} />}
          loading={saving}
          disabled={disabled}
          onClick={() => onSave(values)}
          data-testid="file-metadata-save"
        >
          Save
        </Button>
      </Group>
    </Stack>
  );
};

export default FileMetadataForm;
