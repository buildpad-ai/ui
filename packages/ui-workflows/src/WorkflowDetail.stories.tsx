import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Code, Stack, Text } from '@mantine/core';
import { WorkflowDetail } from './WorkflowDetail';
import { MockWorkflowApi, type MockWorkflowApiOptions } from './_mockApi';
import { mockWorkflows } from './_fixtures';

/**
 * Fixture stories: `WorkflowDetail` loads and saves through
 * `useWorkflowDefinitions`, so these run against an in-memory API
 * (`_mockApi.tsx`). For a real backend see `Workflows/WorkflowsManager (DaaS)`
 * and `Workflows/WorkflowDetail (DaaS)`.
 */
const meta: Meta<typeof WorkflowDetail> = {
  title: 'Workflows/WorkflowDetail',
  component: WorkflowDetail,
  // One in-memory API at a time: these stories do not share a docs page.
  tags: ['!autodocs'],
  parameters: {
    layout: 'padded',
  },
};

export default meta;
type Story = StoryObj<typeof WorkflowDetail>;

function Harness({ api, ...props }: { api?: MockWorkflowApiOptions } & React.ComponentProps<typeof WorkflowDetail>) {
  const [last, setLast] = useState('—');

  return (
    <MockWorkflowApi {...api}>
      <Stack gap="sm">
        <WorkflowDetail
          onBack={() => setLast('onBack()')}
          onSaved={(workflow) => setLast(`onSaved(${workflow.id})`)}
          diagramHeight={520}
          {...props}
        />
        <Text size="sm">
          Last callback: <Code>{last}</Code>
        </Text>
      </Stack>
    </MockWorkflowApi>
  );
}

/** An existing definition, as an administrator. */
export const EditWorkflow: Story = {
  render: () => <Harness id={mockWorkflows[0].id} />,
};

/** `id="new"`: an empty definition; the canvas offers to add the first state. */
export const NewWorkflow: Story = {
  render: () => <Harness id="new" />,
};

/** Read access only: the same page with nothing to change and no Save button. */
export const ReadOnlyAccess: Story = {
  render: () => <Harness id={mockWorkflows[0].id} api={{ access: 'readOnly' }} />,
};

/** An id that names no definition: the not-found state, not a blank form. */
export const NotFound: Story = {
  render: () => <Harness id="0b0e3c1a-6c2f-4a51-9d0e-000000000000" />,
};

/** The definition may not be read (403): the access-denied state. */
export const AccessDenied: Story = {
  render: () => <Harness id={mockWorkflows[0].id} api={{ detailStatus: 403 }} />,
};

/** The load fails (500): the load-error state with Retry. */
export const LoadError: Story = {
  render: () => <Harness id={mockWorkflows[0].id} api={{ detailStatus: 500 }} />,
};
