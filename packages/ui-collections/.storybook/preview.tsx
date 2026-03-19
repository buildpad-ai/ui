import React from 'react';
import type { Preview } from '@storybook/react';
import { MantineProvider } from '@mantine/core';
import { enterpriseTheme } from '../../storybook-enterprise-theme';

// Mantine CSS
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
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
    options: {
      storySort: {
        order: [
          'Collections',
          [
            'ContentLayout', ['Docs', '*'],
            'ContentNavigation', ['Docs', '*'],
            'SaveOptions', ['Docs', '*'],
            'FilterPanel', ['Docs', '*'],
            'CollectionForm', ['Docs', '*', 'Playground'],
            'CollectionList', ['Docs', '*', 'Playground'],
          ],
        ],
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
        <div className="sb-enterprise-wrapper sb-collections-wrapper">
          <Story />
        </div>
      </MantineProvider>
    ),
  ],
  tags: ['autodocs'],
};

export default preview;
