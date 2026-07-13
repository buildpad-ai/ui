import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Paper } from '@mantine/core';
import { PoliciesManager } from './PoliciesManager';
import { PolicyDetail } from './PolicyDetail';
import { DaaSConnectionGate } from './_daasStory';

/**
 * PoliciesManager + PolicyDetail — DaaS Connected Playground
 *
 * Connects to a real DaaS instance (via the Storybook Host proxy) to exercise
 * the full policies admin flow: list with user/role counts, create, edit
 * access flags (app/admin/delegate), the per-collection permissions matrix
 * (SystemPermissions), and delete.
 *
 * 1. Start the host: `pnpm dev:host`
 * 2. Visit http://localhost:3000 and enter your DaaS URL + static token
 * 3. Start this Storybook: `pnpm storybook:users`
 */
const meta: Meta<typeof PoliciesManager> = {
  title: 'Users/PoliciesManager (DaaS)',
  component: PoliciesManager,
  tags: ['!autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Connect the policies admin to a real DaaS instance: list, create, edit access flags and the permissions matrix, and delete. Authentication is handled by the Storybook Host app.',
      },
    },
  },
};

export default meta;

/** In-story navigation: list ↔ detail, exercising the navigation props. */
const PoliciesPlayground: React.FC = () => {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <DaaSConnectionGate>
      <Paper p="md" withBorder>
        {selectedId ? (
          <PolicyDetail
            id={selectedId}
            onBack={() => setSelectedId(null)}
            onDeleted={() => setSelectedId(null)}
            onSaved={(policy) => {
              // Stay on the detail after create so the permissions matrix appears.
              if (selectedId === 'new') setSelectedId(policy.id);
            }}
          />
        ) : (
          <PoliciesManager
            onPolicyClick={(policy) => setSelectedId(policy.id)}
            onCreatePolicy={() => setSelectedId('new')}
          />
        )}
      </Paper>
    </DaaSConnectionGate>
  );
};

/**
 * DaaS Connected Playground
 *
 * Full policies admin against a live backend, with in-story list ↔ detail navigation.
 */
export const Playground: StoryObj<typeof PoliciesManager> = {
  render: () => <PoliciesPlayground />,
};
