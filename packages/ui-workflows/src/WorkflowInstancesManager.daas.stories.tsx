import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Paper } from '@mantine/core';
import { WorkflowInstancesManager } from './WorkflowInstancesManager';
import { WorkflowInstanceDetail } from './WorkflowInstanceDetail';
import { DaaSConnectionGate } from './_daasStory';

/**
 * WorkflowInstancesManager + WorkflowInstanceDetail — DaaS Connected Playground
 *
 * Connects to a real DaaS instance (via the Storybook Host proxy) to browse
 * the workflow instances and open one: its fields, its workflow's diagram and
 * its transition history. Read-only — instances are created by the backend
 * when an item enters an assigned collection.
 *
 * 1. Start the host: `pnpm dev:host`
 * 2. Visit http://localhost:3000 and enter your DaaS URL + static token
 * 3. Start this Storybook: `pnpm --filter @buildpad/ui-workflows storybook`
 */
const meta: Meta<typeof WorkflowInstancesManager> = {
  title: 'Workflows/WorkflowInstancesManager (DaaS)',
  component: WorkflowInstancesManager,
  tags: ['!autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Browse the workflow instances of a real DaaS instance and open one. Authentication is handled by the Storybook Host app.',
      },
    },
  },
};

export default meta;

/** In-story navigation: list ↔ detail, exercising the navigation props. */
const InstancesPlayground: React.FC = () => {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <DaaSConnectionGate>
      <Paper p="md" withBorder>
        {selectedId ? (
          <WorkflowInstanceDetail id={selectedId} onBack={() => setSelectedId(null)} />
        ) : (
          <WorkflowInstancesManager
            // The story's URL belongs to Storybook
            urlParams={false}
            onInstanceClick={(instance) => setSelectedId(instance.id)}
          />
        )}
      </Paper>
    </DaaSConnectionGate>
  );
};

/**
 * DaaS Connected Playground
 *
 * The instances list against a live backend, with in-story list ↔ detail navigation.
 */
export const Playground: StoryObj<typeof WorkflowInstancesManager> = {
  render: () => <InstancesPlayground />,
};
