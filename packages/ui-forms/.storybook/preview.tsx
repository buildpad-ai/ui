import React from 'react';
import type { Preview } from '@storybook/react';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { enterpriseTheme } from '../../storybook-enterprise-theme';

// Mantine CSS
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';

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
        <Notifications />
        <div className="sb-enterprise-wrapper sb-forms-wrapper">
          <Story />
        </div>
      </MantineProvider>
    ),
  ],
  tags: ['autodocs'],
};

export default preview;
