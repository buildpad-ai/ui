import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Button, Stack } from '@mantine/core';
import { CronRunsTable } from './CronRunsTable';
import { MockCronApi, type MockCronApiOptions } from './_mockApi';
import { JOB_REPORT_ID, JOB_SWEEP_ID, longTextJobs, longTextRuns, manyMockRuns } from './_fixtures';

/**
 * Fixture stories: `CronRunsTable` loads through `useCronRuns`, so these run
 * against an in-memory API (`_mockApi.tsx`). It is the History tab of
 * `CronJobsManager` and of `CronJobDetail`, and can be used on its own.
 */
const meta: Meta<typeof CronRunsTable> = {
  title: 'Cron/CronRunsTable',
  component: CronRunsTable,
  // One in-memory API at a time: these stories do not share a docs page.
  tags: ['!autodocs'],
  parameters: {
    layout: 'padded',
  },
};

export default meta;
type Story = StoryObj<typeof CronRunsTable>;

function Harness({ api, ...props }: { api?: MockCronApiOptions } & React.ComponentProps<typeof CronRunsTable>) {
  return (
    <MockCronApi {...api}>
      <CronRunsTable {...props} />
    </MockCronApi>
  );
}

/** The runs of every job, with the Job column. A row, or its View logs button, opens the run log. */
export const AllJobs: Story = {
  render: () => <Harness />,
};

/** The runs of one job: no Job column, and the run log does not repeat the job's name. */
export const OneJob: Story = {
  render: () => <Harness jobId={JOB_REPORT_ID} />,
};

/** 120 runs at 50 per page. */
export const Paged: Story = {
  render: () => <Harness api={{ runs: manyMockRuns(120) }} />,
};

/** A job that has not run yet. */
export const Empty: Story = {
  render: () => <Harness api={{ runs: [] }} jobId={JOB_SWEEP_ID} />,
};

/** The history request fails (500): the load-error state and a notification. Refresh tries again. */
export const LoadError: Story = {
  render: () => <Harness api={{ historyStatus: 500 }} />,
};

/** The history request is refused (403). */
export const AccessDenied: Story = {
  render: () => <Harness api={{ access: 'none' }} />,
};

function RefreshKeyHarness() {
  const [key, setKey] = useState(0);
  return (
    <MockCronApi>
      <Stack gap="sm" align="flex-start">
        <Button variant="light" onClick={() => setKey((current) => current + 1)}>
          Change refreshKey ({key})
        </Button>
        <CronRunsTable refreshKey={key} />
      </Stack>
    </MockCronApi>
  );
}

/** A host reloads the table by changing `refreshKey` — after a Run Now of its own, for example. */
export const RefreshKey: Story = {
  render: () => <RefreshKeyHarness />,
};

/**
 * The runs of every job in a 970 px wide container, one of them with a long
 * job name and a long error: all seven columns and the View logs button are
 * on screen, and the long texts end in an ellipsis.
 */
export const NarrowAllJobs: Story = {
  render: () => (
    <div style={{ width: 970 }} data-testid="narrow-container">
      <Harness api={{ jobs: longTextJobs, runs: longTextRuns }} />
    </div>
  ),
};

/** The runs of one job in a 970 px wide container (no Job column). */
export const NarrowOneJob: Story = {
  render: () => (
    <div style={{ width: 970 }} data-testid="narrow-container">
      <Harness api={{ jobs: longTextJobs, runs: longTextRuns }} jobId={longTextJobs[0].id} />
    </div>
  ),
};
