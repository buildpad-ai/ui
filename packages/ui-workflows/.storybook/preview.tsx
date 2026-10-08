import React from 'react';
import type { Preview } from '@storybook/react';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { enterpriseTheme } from '../../storybook-enterprise-theme';
import { i18nGlobalTypes, i18nInitialGlobals, withBuildpadI18n } from '../../storybook-i18n';

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
  globalTypes: {
    ...i18nGlobalTypes,
    // The state diagram draws its own cards, edges and handles, so it has to
    // be checked in both schemes; a story can also pin one with
    // `globals: { colorScheme: 'dark' }`.
    colorScheme: {
      description: 'Mantine color scheme',
      toolbar: {
        title: 'Color scheme',
        icon: 'mirror',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { ...i18nInitialGlobals, colorScheme: 'light' },
  decorators: [
    (Story: React.ComponentType, context: { globals: Record<string, unknown> }) => {
      const dark = context.globals.colorScheme === 'dark';
      return (
        // Forced, not default: a forced scheme is never written to
        // localStorage, so it cannot leak from one story into the next page load.
        <MantineProvider theme={enterpriseTheme} forceColorScheme={dark ? 'dark' : 'light'}>
          <Notifications />
          {/* The shared enterprise skin sets light-only colors (its own text
              and dimmed colors), so the dark scheme is shown without it: what
              is on screen is then what a dark Mantine app draws. */}
          <div className={dark ? 'sb-workflows-wrapper sb-workflows-dark' : 'sb-enterprise-wrapper sb-workflows-wrapper'}>
            <Story />
          </div>
        </MantineProvider>
      );
    },
    withBuildpadI18n,
  ],
  tags: ['autodocs'],
};

export default preview;
