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
  title: 'Users/UsersManager',
  // Keeps the story IDs from the old "UsersManager (DaaS)" title, which the
  // Playwright specs and existing links use (…-daas--playground).
  id: 'users-usersmanager-daas',
  component: UsersManager,
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
  // Label only: the story ID stays `playground`.
  name: 'Live DaaS',
  render: () => <UsersPlayground />,
  // Shows the shared connect notice until the host has a DaaS instance.
  parameters: { liveDaaS: true },
};

/**
 * Headerless (embedded) mode — `hideHeader` suppresses the built-in heading
 * for surfaces that already have their own; the Add User button stays.
 */
export const Headerless: StoryObj<typeof UsersManager> = {
  // Label only: the story ID stays `headerless`.
  name: 'Live DaaS: Headerless',
  parameters: { liveDaaS: true },
  render: () => (
    <DaaSConnectionGate>
      <Paper p="md" withBorder>
        <UsersManager hideHeader onUserClick={() => undefined} onCreateUser={() => undefined} />
      </Paper>
    </DaaSConnectionGate>
  ),
};
