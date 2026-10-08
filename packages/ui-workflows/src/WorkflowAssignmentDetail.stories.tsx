import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Code, Stack, Text } from '@mantine/core';
import { WorkflowAssignmentDetail } from './WorkflowAssignmentDetail';
import { MockWorkflowApi, type MockWorkflowApiOptions } from './_mockApi';
import { manyMockWorkflows, mockAssignments } from './_fixtures';

/**
 * Fixture stories: `WorkflowAssignmentDetail` loads and saves through
 * `useWorkflowAssignments`, so these run against an in-memory API
 * (`_mockApi.tsx`). For a real backend see
 * `Workflows/WorkflowAssignmentsManager (DaaS)`.
 */
const meta: Meta<typeof WorkflowAssignmentDetail> = {
  title: 'Workflows/WorkflowAssignmentDetail',
  component: WorkflowAssignmentDetail,
  // One in-memory API at a time: these stories do not share a docs page.
  tags: ['!autodocs'],
  parameters: {
    layout: 'padded',
  },
};

export default meta;
type Story = StoryObj<typeof WorkflowAssignmentDetail>;

function Harness({
  api,
  ...props
}: { api?: MockWorkflowApiOptions } & React.ComponentProps<typeof WorkflowAssignmentDetail>) {
  const [last, setLast] = useState('—');

  return (
    <MockWorkflowApi {...api}>
      <Stack gap="sm">
        <WorkflowAssignmentDetail
          onBack={() => setLast('onBack()')}
          onSaved={(assignment) => setLast(`onSaved(${assignment.id})`)}
          {...props}
        />
        <Text size="sm">
          Last callback: <Code>{last}</Code>
        </Text>
      </Stack>
    </MockWorkflowApi>
  );
}

/** An existing assignment with a filter rule, as an administrator. */
export const EditAssignment: Story = {
  render: () => <Harness id={mockAssignments[0].id} />,
};

/**
 * `id="new"`: an empty form. Type `[]` or `123` into Filter Rule and leave the
 * field: valid JSON that is not an object is refused, and nothing is sent.
 */
export const NewAssignment: Story = {
  render: () => <Harness id="new" />,
};

/** 60 definitions: the Workflow picker offers all of them, not the first 25. */
export const ManyWorkflows: Story = {
  render: () => <Harness id="new" api={{ workflows: manyMockWorkflows(60) }} />,
};

/**
 * `/api/collections` is refused (one backend serves it to administrators
 * only): a notification, and the Collection field becomes a text field.
 */
export const CollectionsNotListed: Story = {
  render: () => <Harness id="new" api={{ collectionsStatus: 403 }} />,
};

/** Read access only: the same form with nothing to change and no Save button. */
export const ReadOnlyAccess: Story = {
  render: () => <Harness id={mockAssignments[0].id} api={{ access: 'readOnly' }} />,
};

/** An id that names no assignment: the not-found state, not a blank form. */
export const NotFound: Story = {
  render: () => <Harness id="1c1f4d2b-7d30-4b62-8e1f-000000000000" />,
};

/** The assignment may not be read (403): the access-denied state. */
export const AccessDenied: Story = {
  render: () => <Harness id={mockAssignments[0].id} api={{ detailStatus: 403 }} />,
};

/** The load fails (500): the load-error state with Retry. */
export const LoadError: Story = {
  render: () => <Harness id={mockAssignments[0].id} api={{ detailStatus: 500 }} />,
};
