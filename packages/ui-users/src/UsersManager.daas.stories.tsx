import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Paper } from '@mantine/core';
import { UsersManager } from './UsersManager';
import { UserDetail } from './UserDetail';
import { DaaSConnectionGate } from './_daasStory';

/**
 * UsersManager + UserDetail — DaaS Connected Playground
 *
 * Connects to a real DaaS instance (via the Storybook Host proxy) to exercise
 * the full users admin flow: list, search, role/status filters, create,
 * edit (roles M2M, status, token), policy attachment, and delete.
 *
 * 1. Start the host: `pnpm dev:host`
 * 2. Visit http://localhost:3000 and enter your DaaS URL + static token
 * 3. Start this Storybook: `pnpm storybook:users`
 */
const meta: Meta<typeof UsersManager> = {
  title: 'Users/UsersManager (DaaS)',
  component: UsersManager,
  tags: ['!autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Connect the users admin to a real DaaS instance: list, create, edit, assign roles, attach policies, and delete. Authentication is handled by the Storybook Host app.',
      },
    },
  },
};

export default meta;

/** In-story navigation: list ↔ detail, exercising the navigation props. */
const UsersPlayground: React.FC = () => {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <DaaSConnectionGate>
      <Paper p="md" withBorder>
        {selectedId ? (
          <UserDetail
            id={selectedId}
            onBack={() => setSelectedId(null)}
            onDeleted={() => setSelectedId(null)}
            onSaved={() => setSelectedId(null)}
          />
        ) : (
          <UsersManager
            onUserClick={(user) => setSelectedId(user.id)}
            onCreateUser={() => setSelectedId('new')}
          />
        )}
      </Paper>
    </DaaSConnectionGate>
  );
};

/**
 * DaaS Connected Playground
 *
 * Full users admin against a live backend, with in-story list ↔ detail navigation.
 */
export const Playground: StoryObj<typeof UsersManager> = {
  render: () => <UsersPlayground />,
};
