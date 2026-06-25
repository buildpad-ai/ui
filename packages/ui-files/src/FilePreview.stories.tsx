import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Paper } from '@mantine/core';
import { FilePreview } from './FilePreview';
import type { FileUpload } from '@buildpad/hooks';

const baseFile: FileUpload = {
  id: 'demo',
  filename_download: 'example.png',
  filename_disk: 'example.png',
  type: 'image/png',
  filesize: 482000,
  uploaded_on: new Date().toISOString(),
  uploaded_by: 'user',
};

const meta: Meta<typeof FilePreview> = {
  title: 'Files/FilePreview',
  component: FilePreview,
  render: (args) => (
    <Paper withBorder radius="md" p="md">
      <FilePreview {...args} />
    </Paper>
  ),
};

export default meta;
type Story = StoryObj<typeof FilePreview>;

export const Document: Story = {
  args: {
    file: {
      ...baseFile,
      filename_download: 'report.docx',
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    },
  },
};

export const Pdf: Story = {
  args: {
    file: { ...baseFile, filename_download: 'spec.pdf', type: 'application/pdf' },
  },
};

export const Audio: Story = {
  args: {
    file: { ...baseFile, filename_download: 'track.mp3', type: 'audio/mpeg' },
  },
};
