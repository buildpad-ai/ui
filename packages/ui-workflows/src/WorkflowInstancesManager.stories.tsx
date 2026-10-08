import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Code, Stack, Text } from '@mantine/core';
import { WorkflowInstancesManager } from './WorkflowInstancesManager';
import { MockWorkflowApi, type MockWorkflowApiOptions } from './_mockApi';
import { manyMockInstances } from './_fixtures';

/**
 * Fixture stories: `WorkflowInstancesManager` loads through
 * `useWorkflowInstances`, so these run against an in-memory API
 * (`_mockApi.tsx`) instead of props. For a real backend see
 * `Workflows/WorkflowInstancesManager (DaaS)`.
 */
const meta: Meta<typeof WorkflowInstancesManager> = {
  title: 'Workflows/WorkflowInstancesManager',
  component: WorkflowInstancesManager,
  // One in-memory API at a time: these stories do not share a docs page.
  tags: ['!autodocs'],
  parameters: {
    layout: 'padded',
  },
};

export default meta;
type Story = StoryObj<typeof WorkflowInstancesManager>;

function Harness({
  api,
  ...props
}: { api?: MockWorkflowApiOptions } & React.ComponentProps<typeof WorkflowInstancesManager>) {
  const [last, setLast] = useState('—');

  return (
    <MockWorkflowApi {...api}>
      <Stack gap="sm">
        <WorkflowInstancesManager
          urlParams={false}
          onInstanceClick={(instance) => setLast(`onInstanceClick(${instance.collection} ${instance.item_id})`)}
          {...props}
        />
        <Text size="sm">
          Last callback: <Code>{last}</Code>
        </Text>
      </Stack>
    </MockWorkflowApi>
  );
}

/** An active instance, a terminated one that governs a version, and one whose definition is withheld. */
export const Default: Story = {
  render: () => <Harness />,
};

/** 60 instances at 25 per page. */
export const Paged: Story = {
  render: () => <Harness api={{ instances: manyMockInstances(60) }} />,
};

/** No instances yet. */
export const Empty: Story = {
  render: () => <Harness api={{ instances: [] }} />,
};

/** The list request is refused (403): the access-denied state, not an empty list. */
export const AccessDenied: Story = {
  render: () => <Harness api={{ access: 'none' }} />,
};

/** The list request fails (500): the load-error state and a notification. */
export const LoadError: Story = {
  render: () => <Harness api={{ listStatus: 500 }} />,
};

/** `hideHeader` for an embedded list, without `onInstanceClick`: rows do not open. */
export const Embedded: Story = {
  render: () => (
    <MockWorkflowApi>
      <WorkflowInstancesManager urlParams={false} hideHeader />
    </MockWorkflowApi>
  ),
};
