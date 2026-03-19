import React from 'react';
import type { Preview } from '@storybook/nextjs-vite';
import { MantineProvider } from '@mantine/core';
import { DatesProvider } from '@mantine/dates';
import { Notifications } from '@mantine/notifications';
import { enterpriseTheme } from '../../storybook-enterprise-theme';

// Mantine CSS
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/tiptap/styles.css';

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
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <MantineProvider theme={enterpriseTheme} defaultColorScheme="light">
        <DatesProvider settings={{ locale: 'en' }}>
          <Notifications position="top-right" />
          <div className="sb-enterprise-wrapper sb-interfaces-pad">
            <Story />
          </div>
        </DatesProvider>
      </MantineProvider>
    ),
  ],
  tags: ['autodocs'],
};

export default preview;
