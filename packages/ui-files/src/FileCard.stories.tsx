import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Box } from '@mantine/core';
import { FileCard } from './FileCard';
import { mockFiles } from './_fixtures';

const [imageFile, pdfFile] = mockFiles;

const meta: Meta<typeof FileCard> = {
  title: 'Files/FileCard',
  component: FileCard,
  render: (args) => (
    <Box maw={220}>
      <FileCard {...args} />
    </Box>
  ),
};

export default meta;
type Story = StoryObj<typeof FileCard>;

/** Image files render a thumbnail; offline in Storybook it falls back to the category icon. */
export const Image: Story = { args: { file: imageFile } };

export const Document: Story = { args: { file: pdfFile } };

export const Selected: Story = {
  render: (args) => {
    const [selected, setSelected] = useState(true);
    return (
      <Box maw={220}>
        <FileCard
          {...args}
          selected={selected}
          onSelect={(_id, checked) => setSelected(checked)}
        />
      </Box>
    );
  },
  args: { file: imageFile },
};
