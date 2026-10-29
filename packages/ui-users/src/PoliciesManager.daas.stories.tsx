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
  title: 'Users/PoliciesManager',
  // Keeps the story IDs from the old "PoliciesManager (DaaS)" title, which the
  // Playwright specs and existing links use (…-daas--playground).
  id: 'users-policiesmanager-daas',
  component: PoliciesManager,
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
              // After a create, open the stored policy by its own id (as a page
              // would go to its route); the form already shows its matrix.
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
  // Label only: the story ID stays `playground`.
  name: 'Live DaaS',
  render: () => <PoliciesPlayground />,
  // Shows the shared connect notice until the host has a DaaS instance.
  parameters: { liveDaaS: true },
};
