import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Paper } from '@mantine/core';
import { RolesManager } from './RolesManager';
import { RoleDetail } from './RoleDetail';
import { DaaSConnectionGate } from './_daasStory';

/**
 * RolesManager + RoleDetail — DaaS Connected Playground
 *
 * Connects to a real DaaS instance (via the Storybook Host proxy) to exercise
 * the full roles admin flow: list with member counts, create, edit (icon,
 * parent role, scope-assignment rules), membership management, policy
 * attachment, and delete.
 *
 * 1. Start the host: `pnpm dev:host`
 * 2. Visit http://localhost:3000 and enter your DaaS URL + static token
 * 3. Start this Storybook: `pnpm storybook:users`
 */
const meta: Meta<typeof RolesManager> = {
  title: 'Users/RolesManager (DaaS)',
  component: RolesManager,
  tags: ['!autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Connect the roles admin to a real DaaS instance: list, create, edit hierarchy and scope rules, manage members, and attach policies. Authentication is handled by the Storybook Host app.',
      },
    },
  },
};

export default meta;

/** In-story navigation: list ↔ detail, exercising the navigation props. */
const RolesPlayground: React.FC = () => {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <DaaSConnectionGate>
      <Paper p="md" withBorder>
        {selectedId ? (
          <RoleDetail
            id={selectedId}
            onBack={() => setSelectedId(null)}
            onDeleted={() => setSelectedId(null)}
            onSaved={(role, action) => {
              if (action === 'quit') setSelectedId(null);
              else if (action === 'addNew') setSelectedId('new');
              else setSelectedId(role.id);
            }}
          />
        ) : (
          <RolesManager
            onRoleClick={(role) => setSelectedId(role.id)}
            onCreateRole={() => setSelectedId('new')}
          />
        )}
      </Paper>
    </DaaSConnectionGate>
  );
};

/**
 * DaaS Connected Playground
 *
 * Full roles admin against a live backend, with in-story list ↔ detail navigation.
 */
export const Playground: StoryObj<typeof RolesManager> = {
  render: () => <RolesPlayground />,
};
