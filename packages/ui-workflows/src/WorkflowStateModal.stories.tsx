import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Button, Code, Stack, Text } from '@mantine/core';
import type { WorkflowJsonState } from '@buildpad/types';
import { WorkflowStateModal } from './WorkflowStateModal';
import { emptyWorkflowJson, reviewWorkflowJson } from './_fixtures';

const meta: Meta<typeof WorkflowStateModal> = {
  title: 'Workflows/WorkflowStateModal',
  component: WorkflowStateModal,
  parameters: {
    docs: {
      description: {
        component:
          'Add/Edit State dialog of the workflow editor. `onSave` receives the state to store (built on the stored one, so its commands, position and key order carry over), whether it is new, and whether Initial State is on.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof WorkflowStateModal>;

function Harness({
  state,
  workflowJson = reviewWorkflowJson,
}: {
  state: WorkflowJsonState | null;
  workflowJson?: typeof reviewWorkflowJson;
}) {
  const [opened, setOpened] = useState(true);
  const [saved, setSaved] = useState('—');

  return (
    <Stack gap="sm" align="flex-start">
      <Button onClick={() => setOpened(true)}>Open dialog</Button>
      <Text size="sm">
        Last save: <Code>{saved}</Code>
      </Text>
      <WorkflowStateModal
        opened={opened}
        onClose={() => setOpened(false)}
        state={state}
        workflowJson={workflowJson}
        onSave={(next, isNew, isInitial) => setSaved(JSON.stringify({ state: next, isNew, isInitial }))}
      />
    </Stack>
  );
}

/** A new state in a workflow that already has states. */
export const AddState: Story = {
  render: () => <Harness state={null} />,
};

/** The first state of a workflow: Initial State starts on. */
export const AddFirstState: Story = {
  render: () => <Harness state={null} workflowJson={emptyWorkflowJson} />,
};

/** The initial state, which has a command: turning End State on is refused on save. */
export const EditStateWithCommands: Story = {
  render: () => <Harness state={reviewWorkflowJson.states[0]} />,
};

/** An end state. */
export const EditEndState: Story = {
  render: () => <Harness state={reviewWorkflowJson.states[2]} />,
};
