/**
 * FileInfoPanel unit tests: the markup of the metadata rows.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { describe, it, expect } from 'vitest';
import { FileInfoPanel } from '../src/FileInfoPanel';
import { mockFiles } from '../src/_fixtures';

describe('FileInfoPanel', () => {
  it('renders valid markup: no <p> inside a <p>', () => {
    render(
      <MantineProvider>
        <FileInfoPanel file={mockFiles[0]} />
      </MantineProvider>,
    );

    // The ID row nests the truncated id (a Text) and a copy button in its value.
    const panel = screen.getByTestId('file-info-panel');
    expect(panel.querySelector('p p')).toBeNull();
    expect(panel.querySelector('p div')).toBeNull();
  });
});
