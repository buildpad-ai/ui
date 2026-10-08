import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Code, Stack, Text } from '@mantine/core';
import { WorkflowInstanceDetail } from './WorkflowInstanceDetail';
import { MockWorkflowApi, type MockWorkflowApiOptions } from './_mockApi';
import { mockInstances } from './_fixtures';

/**
 * Fixture stories: `WorkflowInstanceDetail` loads through
 * `useWorkflowInstances`, so these run against an in-memory API
 * (`_mockApi.tsx`). For a real backend see
 * `Workflows/WorkflowInstancesManager (DaaS)`.
 */
const meta: Meta<typeof WorkflowInstanceDetail> = {
  title: 'Workflows/WorkflowInstanceDetail',
  component: WorkflowInstanceDetail,
  // One in-memory API at a time: these stories do not share a docs page.
  tags: ['!autodocs'],
  parameters: {
    layout: 'padded',
  },
};

export default meta;
type Story = StoryObj<typeof WorkflowInstanceDetail>;

function Harness({
  api,
  ...props
}: { api?: MockWorkflowApiOptions } & React.ComponentProps<typeof WorkflowInstanceDetail>) {
  const [last, setLast] = useState('—');

  return (
    <MockWorkflowApi {...api}>
      <Stack gap="sm">
        <WorkflowInstanceDetail onBack={() => setLast('onBack()')} {...props} />
        <Text size="sm">
          Last callback: <Code>{last}</Code>
        </Text>
      </Stack>
    </MockWorkflowApi>
  );
}

/** An active instance with its workflow's diagram and two transitions. */
export const Default: Story = {
  render: () => <Harness id={mockInstances[0].id} />,
};

/** A terminated instance that governs a version. */
export const Terminated: Story = {
  render: () => <Harness id={mockInstances[1].id} />,
};

/** An instance whose definition the caller's grant withholds: no name, no diagram. */
export const DefinitionWithheld: Story = {
  render: () => <Harness id={mockInstances[2].id} />,
};

/** No transitions yet: the instance is in its initial state. */
export const NoTransitions: Story = {
  render: () => <Harness id={mockInstances[0].id} api={{ history: [] }} />,
};

/** `showDiagram={false}`: the fields and the history only. */
export const WithoutDiagram: Story = {
  render: () => <Harness id={mockInstances[0].id} showDiagram={false} />,
};

/** The history may not be read (403): the instance is shown, and the history says why it is not. */
export const HistoryDenied: Story = {
  render: () => <Harness id={mockInstances[0].id} api={{ historyStatus: 403 }} />,
};

/** The history fails to load (500): a message with Retry, not "No transitions recorded yet". */
export const HistoryLoadError: Story = {
  render: () => <Harness id={mockInstances[0].id} api={{ historyStatus: 500 }} />,
};

/** An id that names no instance: the not-found state, not an empty card. */
export const NotFound: Story = {
  render: () => <Harness id="2d2a5e3c-8e41-4c73-9f2a-000000000000" />,
};

/** The instance may not be read (403): the access-denied state. */
export const AccessDenied: Story = {
  render: () => <Harness id={mockInstances[0].id} api={{ detailStatus: 403 }} />,
};

/** The load fails (500): the load-error state with Retry. */
export const LoadError: Story = {
  render: () => <Harness id={mockInstances[0].id} api={{ detailStatus: 500 }} />,
};
