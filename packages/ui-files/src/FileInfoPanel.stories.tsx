import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Box } from '@mantine/core';
import { FileInfoPanel } from './FileInfoPanel';
import type { FileUpload } from '@buildpad/hooks';

const baseFile: FileUpload = {
  id: '70e79244-a2d5-45e4-ae98-612efa61eebc',
  filename_download: 'hero.png',
  filename_disk: '70e79244.png',
  type: 'image/png',
  filesize: 482000,
  storage: 'files',
  width: 1920,
  height: 1080,
  uploaded_on: new Date('2026-06-01T10:30:00Z').toISOString(),
  modified_on: new Date('2026-06-02T08:15:00Z').toISOString(),
  uploaded_by: 'user',
};

const meta: Meta<typeof FileInfoPanel> = {
  title: 'Files/FileInfoPanel',
  component: FileInfoPanel,
  render: (args) => (
    <Box maw={320}>
      <FileInfoPanel {...args} />
    </Box>
  ),
};

export default meta;
type Story = StoryObj<typeof FileInfoPanel>;

export const Image: Story = { args: { file: baseFile } };

export const Video: Story = {
  args: {
    file: {
      ...baseFile,
      filename_download: 'clip.mp4',
      type: 'video/mp4',
      filesize: 12_400_000,
      duration: 95,
    },
  },
};

export const Document: Story = {
  args: {
    file: {
      ...baseFile,
      filename_download: 'report.pdf',
      type: 'application/pdf',
      filesize: 240_000,
      width: undefined,
      height: undefined,
    },
  },
};
