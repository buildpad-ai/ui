import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Code, Stack, Text } from '@mantine/core';
import { WorkflowAssignmentsManager } from './WorkflowAssignmentsManager';
import { MockWorkflowApi, type MockWorkflowApiOptions } from './_mockApi';
import { manyMockAssignments } from './_fixtures';

/**
 * Fixture stories: `WorkflowAssignmentsManager` loads through
 * `useWorkflowAssignments`, so these run against an in-memory API
 * (`_mockApi.tsx`) instead of props. For a real backend see
 * `Workflows/WorkflowAssignmentsManager (DaaS)`.
 */
const meta: Meta<typeof WorkflowAssignmentsManager> = {
  title: 'Workflows/WorkflowAssignmentsManager',
  component: WorkflowAssignmentsManager,
  // One in-memory API at a time: these stories do not share a docs page.
  tags: ['!autodocs'],
  parameters: {
    layout: 'padded',
  },
};

export default meta;
type Story = StoryObj<typeof WorkflowAssignmentsManager>;

function Harness({
  api,
  ...props
}: { api?: MockWorkflowApiOptions } & React.ComponentProps<typeof WorkflowAssignmentsManager>) {
  const [last, setLast] = useState('—');

  return (
    <MockWorkflowApi {...api}>
      <Stack gap="sm">
        <WorkflowAssignmentsManager
          urlParams={false}
          onAssignmentClick={(assignment) => setLast(`onAssignmentClick(${assignment.collection})`)}
          onCreateAssignment={() => setLast('onCreateAssignment()')}
          {...props}
        />
        <Text size="sm">
          Last callback: <Code>{last}</Code>
        </Text>
      </Stack>
    </MockWorkflowApi>
  );
}

/** Three assignments, as an administrator: one with a filter rule, two without. */
export const Default: Story = {
  render: () => <Harness />,
};

/**
 * 26 assignments at 25 per page. Delete the only row of page 2: the list
 * falls back to page 1 instead of showing an empty page.
 */
export const Paged: Story = {
  render: () => <Harness api={{ assignments: manyMockAssignments(26) }} />,
};

/** No assignments yet. */
export const Empty: Story = {
  render: () => <Harness api={{ assignments: [] }} />,
};

/** Read access only: rows open, but there is no New Assignment button and no row menu. */
export const ReadOnlyAccess: Story = {
  render: () => <Harness api={{ access: 'readOnly' }} />,
};

/** The list request is refused (403): the access-denied state, not an empty list. */
export const AccessDenied: Story = {
  render: () => <Harness api={{ access: 'none' }} />,
};

/** The list request fails (500): the load-error state and a notification. */
export const LoadError: Story = {
  render: () => <Harness api={{ listStatus: 500 }} />,
};

/** `hideHeader` for an embedded list: no heading, the New Assignment button stays. */
export const WithoutHeader: Story = {
  render: () => <Harness hideHeader />,
};
