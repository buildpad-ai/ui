import React from 'react';
import type { Preview } from '@storybook/react';
import { MantineProvider } from '@mantine/core';
import { DaaSProvider } from '@buildpad/services';
import { enterpriseTheme } from '../../storybook-enterprise-theme';

// Mantine CSS
import '@mantine/core/styles.css';
import '@mantine/tiptap/styles.css';

// VForm CSS
import '../src/VForm.css';

// Enterprise preview styles
import '../../storybook-enterprise-preview.css';
import './preview.css';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    docs: {
      toc: true,
    },
    layout: 'padded',
  },
  decorators: [
    (Story: React.ComponentType) => (
      <MantineProvider theme={enterpriseTheme} defaultColorScheme="light">
        <DaaSProvider autoFetchUser={false}>
          <div className="sb-enterprise-wrapper sb-form-wrapper">
            <Story />
          </div>
        </DaaSProvider>
      </MantineProvider>
    ),
  ],
  tags: ['autodocs'],
};

export default preview;
