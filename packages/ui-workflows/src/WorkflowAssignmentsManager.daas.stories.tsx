import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Paper } from '@mantine/core';
import { WorkflowAssignmentsManager } from './WorkflowAssignmentsManager';
import { WorkflowAssignmentDetail } from './WorkflowAssignmentDetail';
import { DaaSConnectionGate } from './_daasStory';

/**
 * WorkflowAssignmentsManager + WorkflowAssignmentDetail — DaaS Connected Playground
 *
 * Connects to a real DaaS instance (via the Storybook Host proxy) to exercise
 * the whole assignments flow: list, search, assign a workflow to a collection
 * with or without a filter rule, edit, and delete.
 *
 * 1. Start the host: `pnpm dev:host`
 * 2. Visit http://localhost:3000 and enter your DaaS URL + static token
 * 3. Start this Storybook: `pnpm --filter @buildpad/ui-workflows storybook`
 */
const meta: Meta<typeof WorkflowAssignmentsManager> = {
  // Same title as WorkflowAssignmentsManager.stories.tsx: the live story joins that component
  // and loads last (see the stories glob in main.ts).
  title: 'Workflows/WorkflowAssignmentsManager',
  component: WorkflowAssignmentsManager,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Connect the workflow assignments admin to a real DaaS instance: list, create, edit, and delete. Authentication is handled by the Storybook Host app.',
      },
    },
  },
};

export default meta;

/** In-story navigation: list ↔ form, exercising the navigation props. */
const AssignmentsPlayground: React.FC = () => {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <DaaSConnectionGate>
      <Paper p="md" withBorder>
        {selectedId ? (
          <WorkflowAssignmentDetail
            id={selectedId}
            onBack={() => setSelectedId(null)}
            // As the reference admin UI does: back to the list after a save
            onSaved={() => setSelectedId(null)}
          />
        ) : (
          <WorkflowAssignmentsManager
            // The story's URL belongs to Storybook
            urlParams={false}
            onAssignmentClick={(assignment) => setSelectedId(assignment.id)}
            onCreateAssignment={() => setSelectedId('new')}
          />
        )}
      </Paper>
    </DaaSConnectionGate>
  );
};

/**
 * DaaS Connected Playground
 *
 * The assignments list against a live backend, with in-story list ↔ form navigation.
 */
export const Playground: StoryObj<typeof WorkflowAssignmentsManager> = {
  name: 'Live DaaS',
  render: () => <AssignmentsPlayground />,
  // Shows the shared connect notice until the host has a DaaS instance.
  parameters: { liveDaaS: true },
};
