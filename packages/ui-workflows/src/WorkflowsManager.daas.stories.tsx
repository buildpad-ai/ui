import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Paper } from '@mantine/core';
import { WorkflowsManager } from './WorkflowsManager';
import { WorkflowDetail } from './WorkflowDetail';
import { DaaSConnectionGate } from './_daasStory';

/**
 * WorkflowsManager + WorkflowDetail — DaaS Connected Playground
 *
 * Connects to a real DaaS instance (via the Storybook Host proxy) to exercise
 * the whole definitions flow: list, search, create, draw the state machine,
 * edit states and commands, save, and delete.
 *
 * 1. Start the host: `pnpm dev:host`
 * 2. Visit http://localhost:3000 and enter your DaaS URL + static token
 * 3. Start this Storybook: `pnpm --filter @buildpad/ui-workflows storybook`
 */
const meta: Meta<typeof WorkflowsManager> = {
  title: 'Workflows/WorkflowsManager (DaaS)',
  component: WorkflowsManager,
  tags: ['!autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Connect the workflow definitions admin to a real DaaS instance: list, create, edit the state machine, and delete. Authentication is handled by the Storybook Host app.',
      },
    },
  },
};

export default meta;

/** In-story navigation: list ↔ editor, exercising the navigation props. */
const WorkflowsPlayground: React.FC = () => {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <DaaSConnectionGate>
      <Paper p="md" withBorder>
        {selectedId ? (
          <WorkflowDetail
            id={selectedId}
            onBack={() => setSelectedId(null)}
            // As the reference admin UI does: back to the list after a create,
            // stay on the editor after an update
            onSaved={() => {
              if (selectedId === 'new') setSelectedId(null);
            }}
          />
        ) : (
          <WorkflowsManager
            // The story's URL belongs to Storybook
            urlParams={false}
            onWorkflowClick={(workflow) => setSelectedId(workflow.id)}
            onCreateWorkflow={() => setSelectedId('new')}
          />
        )}
      </Paper>
    </DaaSConnectionGate>
  );
};

/**
 * DaaS Connected Playground
 *
 * The definitions list against a live backend, with in-story list ↔ editor navigation.
 */
export const Playground: StoryObj<typeof WorkflowsManager> = {
  render: () => <WorkflowsPlayground />,
};
