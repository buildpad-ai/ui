import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Code, Stack, Text } from '@mantine/core';
import type { WorkflowJson } from '@buildpad/types';
import { WorkflowDiagram } from './WorkflowDiagram';
import {
  dashedWorkflowJson,
  emptyWorkflowJson,
  reviewWorkflowJson,
  unpositionedWorkflowJson,
} from './_fixtures';

const meta: Meta<typeof WorkflowDiagram> = {
  title: 'Workflows/WorkflowDiagram',
  component: WorkflowDiagram,
  parameters: {
    docs: {
      description: {
        component:
          'The state diagram of a workflow: states as cards, commands as arrows. Controlled by `workflowJson` + `onChange` — every gesture that changes the machine (dropping a state, deleting a state or a command, moving an arrow to another state) is handed to `onChange` as the next document. Drag a state by its grip; edit a state from its menu; click a command (its row or its arrow) to edit it; drag from one state\'s dot to another state to add a command. React Flow\'s attribution is shown unless `hideAttribution` is set.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof WorkflowDiagram>;

/** Holds the document, as an editor would, and prints what each callback received. */
function Harness({
  initial,
  ...props
}: { initial: WorkflowJson } & Partial<React.ComponentProps<typeof WorkflowDiagram>>) {
  const [workflowJson, setWorkflowJson] = useState(initial);
  const [last, setLast] = useState('—');

  return (
    <Stack gap="sm">
      <WorkflowDiagram
        workflowJson={workflowJson}
        onChange={(next) => {
          setWorkflowJson(next);
          setLast('onChange');
        }}
        onEditState={(state) => setLast(`onEditState(${state.name})`)}
        onEditCommand={(stateName, command) => setLast(`onEditCommand(${stateName}, ${command.name})`)}
        onAddState={() => setLast('onAddState()')}
        onAddCommand={(from, to, sourceHandle, targetHandle) =>
          setLast(`onAddCommand(${from}, ${to}, ${sourceHandle}, ${targetHandle})`)
        }
        height={480}
        {...props}
      />
      <Text size="sm">
        Last callback: <Code>{last}</Code> · {workflowJson.states.length} states ·{' '}
        {workflowJson.states.reduce((total, s) => total + s.commands.length, 0)} commands · initial:{' '}
        <Code>{workflowJson.initial_state || 'none'}</Code>
      </Text>
    </Stack>
  );
}

/** A three-state machine with stored positions and handles. */
export const Default: Story = {
  render: () => <Harness initial={reviewWorkflowJson} />,
};

/** No stored positions: states fall on a three-column grid until they are dragged. */
export const WithoutStoredPositions: Story = {
  render: () => <Harness initial={unpositionedWorkflowJson} />,
};

/** No states yet: the canvas offers to add the first one. */
export const Empty: Story = {
  render: () => <Harness initial={emptyWorkflowJson} />,
};

/** `readOnly`: nothing can be dragged, connected, edited or deleted. */
export const ReadOnly: Story = {
  render: () => <Harness initial={reviewWorkflowJson} readOnly />,
};

/**
 * State and command names that contain dashes. Drag the end of the
 * `Go-review` arrow from `review-b` to `done-c`: the command's target follows.
 */
export const DashedNames: Story = {
  render: () => <Harness initial={dashedWorkflowJson} />,
};

/** `hideAttribution`: the "React Flow" mark in the corner is not drawn. */
export const WithoutAttribution: Story = {
  render: () => <Harness initial={reviewWorkflowJson} hideAttribution />,
};

/**
 * Cards, edge labels, handles and controls follow the color scheme. Any story
 * can be checked the same way with the "Color scheme" switch in the toolbar.
 */
export const DarkColorScheme: Story = {
  globals: { colorScheme: 'dark' },
  render: () => <Harness initial={reviewWorkflowJson} />,
};
