import React from 'react';
import type { Preview } from '@storybook/react';
import { MantineProvider } from '@mantine/core';
import { DaaSProvider } from '@buildpad/services';
import { enterpriseTheme } from '../../storybook-enterprise-theme';
import { i18nGlobalTypes, i18nInitialGlobals, withBuildpadI18n } from '../../storybook-i18n';
// Relational interfaces (ListO2M/M2M/M2A, relational fields in a standalone
// VForm) read CollectionForm / CollectionList / VForm from a provider. Imported
// by relative path on purpose: a package.json edge to @buildpad/ui-collections
// would re-create the ui-form ⇄ ui-interfaces ⇄ ui-collections dependency cycle.
import { CollectionsRelationalProvider } from '../../ui-collections/src/CollectionForm';

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
  globalTypes: i18nGlobalTypes,
  initialGlobals: i18nInitialGlobals,
  decorators: [
    (Story: React.ComponentType) => (
      <MantineProvider theme={enterpriseTheme} defaultColorScheme="light">
        <DaaSProvider autoFetchUser={false}>
          <CollectionsRelationalProvider>
            <div className="sb-enterprise-wrapper sb-form-wrapper">
              <Story />
            </div>
          </CollectionsRelationalProvider>
        </DaaSProvider>
      </MantineProvider>
    ),
    withBuildpadI18n,
  ],
  tags: ['autodocs'],
};

export default preview;
