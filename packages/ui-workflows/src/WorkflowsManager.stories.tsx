import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Code, Stack, Text } from '@mantine/core';
import { WorkflowsManager } from './WorkflowsManager';
import { MockWorkflowApi, type MockWorkflowApiOptions } from './_mockApi';
import { manyMockWorkflows } from './_fixtures';

/**
 * Fixture stories: `WorkflowsManager` loads through `useWorkflowDefinitions`,
 * so these run against an in-memory API (`_mockApi.tsx`) instead of props.
 * For a real backend see `Workflows/WorkflowsManager (DaaS)`.
 */
const meta: Meta<typeof WorkflowsManager> = {
  title: 'Workflows/WorkflowsManager',
  component: WorkflowsManager,
  // One in-memory API at a time: these stories do not share a docs page.
  tags: ['!autodocs'],
  parameters: {
    layout: 'padded',
  },
};

export default meta;
type Story = StoryObj<typeof WorkflowsManager>;

function Harness({ api, ...props }: { api?: MockWorkflowApiOptions } & React.ComponentProps<typeof WorkflowsManager>) {
  const [last, setLast] = useState('—');

  return (
    <MockWorkflowApi {...api}>
      <Stack gap="sm">
        <WorkflowsManager
          urlParams={false}
          onWorkflowClick={(workflow) => setLast(`onWorkflowClick(${workflow.name})`)}
          onCreateWorkflow={() => setLast('onCreateWorkflow()')}
          {...props}
        />
        <Text size="sm">
          Last callback: <Code>{last}</Code>
        </Text>
      </Stack>
    </MockWorkflowApi>
  );
}

/** Three definitions, as an administrator: search, open, edit, delete. */
export const Default: Story = {
  render: () => <Harness />,
};

/**
 * 26 definitions at 25 per page. Delete the only row of page 2: the list
 * falls back to page 1 instead of showing an empty page.
 */
export const Paged: Story = {
  render: () => <Harness api={{ workflows: manyMockWorkflows(26) }} />,
};

/** No definitions yet. */
export const Empty: Story = {
  render: () => <Harness api={{ workflows: [] }} />,
};

/** Read access only: rows open, but there is no Add button and no row menu. */
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

/** `hideHeader` for an embedded list: no heading, the Add button stays. */
export const WithoutHeader: Story = {
  render: () => <Harness hideHeader />,
};
