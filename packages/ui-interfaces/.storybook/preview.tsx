import React from 'react';
import type { Preview } from '@storybook/nextjs-vite';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { DaaSProvider, setGlobalDaaSConfig } from '@buildpad/services';
import { enterpriseTheme } from '../../storybook-enterprise-theme';
import { i18nGlobalTypes, i18nInitialGlobals, withBuildpadI18n } from '../../storybook-i18n';
// Relational interfaces (ListO2M/M2M/M2A, relational fields in a standalone
// VForm) read CollectionForm / CollectionList / VForm from a provider. Imported
// by relative path on purpose: a package.json edge to @buildpad/ui-collections
// would re-create the ui-form ⇄ ui-interfaces ⇄ ui-collections dependency cycle.
import { CollectionsRelationalProvider } from '../../ui-collections/src/CollectionsRelationalProvider';
import { LiveDaaSGate } from './LiveDaaSGate';

/**
 * Wraps a story in the relational provider unless it opts out with
 * `parameters: { relationalUI: false }` — the "Without provider" stories, which
 * show the missing-provider alert and the hidden create / select / edit actions.
 */
function RelationalUI({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  return enabled ? <CollectionsRelationalProvider>{children}</CollectionsRelationalProvider> : <>{children}</>;
}

/**
 * Proxy mode, as in the live CollectionList / VForm stories: an empty DaaS URL
 * makes every request a relative `/api/*` path, served by the Storybook host
 * app (same origin on ui.buildpad.ai; the Vite proxy forwards it to
 * localhost:3000 in dev), which forwards it to the DaaS instance connected on
 * the host's home page. The global config covers hooks that call DaaS outside
 * React context (useRelationM2A and friends); DaaSProvider covers
 * usePermissions.
 */
const PROXY_DAAS_CONFIG = { url: '' } as const;
setGlobalDaaSConfig(PROXY_DAAS_CONFIG);

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
  globalTypes: i18nGlobalTypes,
  initialGlobals: i18nInitialGlobals,
  decorators: [
    (Story, context) => (
      <MantineProvider theme={enterpriseTheme} defaultColorScheme="light">
        <Notifications position="top-right" />
        {/* ListO2M / M2M / M2A check permissions through usePermissions, which
            requires a DaaSProvider. No user fetch on mount. */}
        <DaaSProvider config={PROXY_DAAS_CONFIG} autoFetchUser={false}>
          <RelationalUI enabled={context.parameters.relationalUI !== false}>
            <div className="sb-enterprise-wrapper sb-interfaces-pad">
              <LiveDaaSGate enabled={context.parameters.liveDaaS === true}>
                <Story />
              </LiveDaaSGate>
            </div>
          </RelationalUI>
        </DaaSProvider>
      </MantineProvider>
    ),
    withBuildpadI18n,
  ],
  tags: ['autodocs'],
};

export default preview;
