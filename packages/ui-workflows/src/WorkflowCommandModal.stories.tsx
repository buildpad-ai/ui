import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Button, Code, Stack, Text } from '@mantine/core';
import type { WorkflowJson, WorkflowJsonCommand } from '@buildpad/types';
import { WorkflowCommandModal } from './WorkflowCommandModal';
import type { WorkflowPolicyOption } from './workflowPolicies';
import { mockPolicyOptions, reviewWorkflowJson } from './_fixtures';

const meta: Meta<typeof WorkflowCommandModal> = {
  title: 'Workflows/WorkflowCommandModal',
  component: WorkflowCommandModal,
  parameters: {
    docs: {
      description: {
        component:
          'Add/Edit Command dialog of the workflow editor: General (name, target state), Actions (events with JSON parameters) and Policies (who may run the command). The policy options arrive through `policies` or `loadPolicies`; the dialog fetches nothing itself. A refused save opens the tab that holds the failing field.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof WorkflowCommandModal>;

function Harness({
  command,
  stateName,
  workflowJson = reviewWorkflowJson,
  ...props
}: {
  command: WorkflowJsonCommand | null;
  stateName: string;
  workflowJson?: WorkflowJson;
  targetState?: string;
  policies?: WorkflowPolicyOption[];
  loadPolicies?: () => Promise<WorkflowPolicyOption[]>;
}) {
  const [opened, setOpened] = useState(true);
  const [saved, setSaved] = useState('—');

  return (
    <Stack gap="sm" align="flex-start">
      <Button onClick={() => setOpened(true)}>Open dialog</Button>
      <Text size="sm">
        Last save: <Code>{saved}</Code>
      </Text>
      <WorkflowCommandModal
        opened={opened}
        onClose={() => setOpened(false)}
        command={command}
        stateName={stateName}
        workflowJson={workflowJson}
        onSave={(next, isNew) => setSaved(JSON.stringify({ command: next, isNew }))}
        {...props}
      />
    </Stack>
  );
}

/** A new command drawn from Draft to Published: the target is filled in. */
export const AddCommand: Story = {
  render: () => (
    <Harness command={null} stateName="Draft" targetState="Published" policies={mockPolicyOptions} />
  ),
};

/**
 * A stored command with an action, a policy and module access keys. The
 * Policies tab says the keys are there; saving unchanged keeps them.
 */
export const EditCommand: Story = {
  render: () => (
    <Harness command={reviewWorkflowJson.states[0].commands[0]} stateName="Draft" policies={mockPolicyOptions} />
  ),
};

/** A command with no policy and no module access key: the Policies tab warns that it is open. */
export const OpenToAllUsers: Story = {
  render: () => (
    <Harness
      command={{ name: 'Reopen', next_state: 'Draft', actions: [], policies: [] }}
      stateName="Review"
      policies={mockPolicyOptions}
    />
  ),
};

/** Policies loaded through `loadPolicies`: the picker is disabled until they arrive. */
export const LoadingPolicies: Story = {
  render: () => (
    <Harness
      command={reviewWorkflowJson.states[1].commands[0]}
      stateName="Review"
      loadPolicies={() =>
        new Promise((resolve) => {
          setTimeout(() => resolve(mockPolicyOptions), 2000);
        })
      }
    />
  ),
};

/** `loadPolicies` rejects: the picker says so and keeps the stored policy ids. */
export const PoliciesFailedToLoad: Story = {
  render: () => (
    <Harness
      command={reviewWorkflowJson.states[1].commands[0]}
      stateName="Review"
      loadPolicies={() => Promise.reject(new Error('Permission denied'))}
    />
  ),
};

/** The only state of a workflow: there is no state to lead to. */
export const NoTargetStates: Story = {
  render: () => (
    <Harness
      command={null}
      stateName="Draft"
      workflowJson={{ initial_state: 'Draft', states: [{ name: 'Draft', isEndState: false, commands: [] }] }}
      policies={mockPolicyOptions}
    />
  ),
};
