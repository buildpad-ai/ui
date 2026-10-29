import React from 'react';
import type { Preview } from '@storybook/react';
import { MantineProvider } from '@mantine/core';
import { DaaSProvider, setGlobalDaaSConfig } from '@buildpad/services';
import { enterpriseTheme } from '../../storybook-enterprise-theme';
import { i18nGlobalTypes, i18nInitialGlobals, withBuildpadI18n } from '../../storybook-i18n';
import { LiveDaaSGate } from '../../storybook-live-daas';

/**
 * Proxy mode, as in the interfaces Storybook: an empty DaaS URL makes every
 * request a relative `/api/*` path. The stories' mock decorators answer those
 * requests with example data; the Live DaaS stories reach the Storybook host,
 * which forwards them to the DaaS instance connected on its home page. Without
 * it the components threw "DaaS URL is not configured" before a request was
 * made, so the mocks never ran.
 */
const PROXY_DAAS_CONFIG = { url: '' } as const;
setGlobalDaaSConfig(PROXY_DAAS_CONFIG);

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
            'CollectionForm', ['Docs', '*'],
            'CollectionList', ['Docs', '*'],
          ],
        ],
        // Within a component Storybook keeps file-load order, so the Live DaaS
        // stories come last through the stories glob in main.ts.
      },
    },
    docs: {
      toc: true,
    },
    layout: 'padded',
  },
  globalTypes: i18nGlobalTypes,
  initialGlobals: i18nInitialGlobals,
  decorators: [
    (Story: React.ComponentType, context: { parameters: Record<string, unknown> }) => (
      <MantineProvider theme={enterpriseTheme} defaultColorScheme="light">
        <DaaSProvider config={PROXY_DAAS_CONFIG} autoFetchUser={false}>
          <div className="sb-enterprise-wrapper sb-collections-wrapper">
            <LiveDaaSGate enabled={context.parameters.liveDaaS === true}>
              <Story />
            </LiveDaaSGate>
          </div>
        </DaaSProvider>
      </MantineProvider>
    ),
    withBuildpadI18n,
  ],
  tags: ['autodocs'],
};

export default preview;
