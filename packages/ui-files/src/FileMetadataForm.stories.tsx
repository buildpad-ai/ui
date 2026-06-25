import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Box } from '@mantine/core';
import { FileMetadataForm } from './FileMetadataForm';
import { mockFile, mockFolderOptions } from './_fixtures';

const meta: Meta<typeof FileMetadataForm> = {
  title: 'Files/FileMetadataForm',
  component: FileMetadataForm,
  render: (args) => (
    <Box maw={520}>
      <FileMetadataForm {...args} />
    </Box>
  ),
  args: {
    file: mockFile,
    folderOptions: mockFolderOptions,
    onSave: () => {},
  },
};

export default meta;
type Story = StoryObj<typeof FileMetadataForm>;

export const Editable: Story = {};

/** Images additionally expose focal-point inputs. */
export const WithFocalPoint: Story = {
  args: { showFocalPoint: true },
};

/** Read-only (no update permission) — every field is disabled. */
export const Disabled: Story = {
  args: { disabled: true },
};
