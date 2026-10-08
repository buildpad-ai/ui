import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Code, Stack, Text } from '@mantine/core';
import { CronJobsManager } from './CronJobsManager';
import { MockCronApi, type MockCronApiOptions } from './_mockApi';
import { JOB_REPORT_ID, longTextJobs, longTextRuns, manyMockJobs, manyMockRuns } from './_fixtures';

/**
 * Fixture stories: `CronJobsManager` loads through `useCronJobs` and
 * `useCronRuns`, so these run against an in-memory API (`_mockApi.tsx`)
 * instead of props. For a real backend see `Cron/CronJobsManager (DaaS)`.
 */
const meta: Meta<typeof CronJobsManager> = {
  title: 'Cron/CronJobsManager',
  component: CronJobsManager,
  // One in-memory API at a time: these stories do not share a docs page.
  tags: ['!autodocs'],
  parameters: {
    layout: 'padded',
  },
};

export default meta;
type Story = StoryObj<typeof CronJobsManager>;

function Harness({ api, ...props }: { api?: MockCronApiOptions } & React.ComponentProps<typeof CronJobsManager>) {
  const [last, setLast] = useState('—');

  return (
    <MockCronApi {...api}>
      <Stack gap="sm">
        <CronJobsManager
          urlParams={false}
          onJobClick={(job) => setLast(`onJobClick(${job.name})`)}
          onCreateJob={() => setLast('onCreateJob()')}
          {...props}
        />
        <Text size="sm">
          Last callback: <Code>{last}</Code>
        </Text>
      </Stack>
    </MockCronApi>
  );
}

/**
 * Three jobs, as an administrator: search, open, and the row menu's Run Now
 * (answered when the run has ended), Activate / Deactivate, Clone and Delete.
 * The History tab lists the runs of every job; a row opens its log.
 */
export const Default: Story = {
  render: () => <Harness />,
};

/**
 * 26 jobs at 25 per page. Delete the only row of page 2: the list falls back
 * to page 1 instead of showing an empty page. The History tab has 120 runs.
 */
export const Paged: Story = {
  render: () => <Harness api={{ jobs: manyMockJobs(26), runs: manyMockRuns(120) }} />,
};

/** No jobs and no runs yet. */
export const Empty: Story = {
  render: () => <Harness api={{ jobs: [], runs: [] }} />,
};

/** Read access only: rows open, but there is no New Cron Job button and no row menu. */
export const ReadOnlyAccess: Story = {
  render: () => <Harness api={{ access: 'readOnly' }} />,
};

/** The list request is refused (403): the access-denied state, not an empty list. */
export const AccessDenied: Story = {
  render: () => <Harness api={{ access: 'none' }} />,
};

/** The list request fails (500): the load-error state and a notification. */
export const LoadError: Story = {
  render: () => <Harness api={{ listStatus: 500, historyStatus: 500 }} />,
};

/**
 * "Nightly report" is running. Run Now on it starts nothing, and the
 * notification says so instead of "started".
 */
export const AlreadyRunning: Story = {
  render: () => <Harness api={{ runningJobIds: [JOB_REPORT_ID] }} />,
};

/** `hideHeader` for an embedded list: no heading, the New Cron Job button stays. */
export const WithoutHeader: Story = {
  render: () => <Harness hideHeader />,
};

/**
 * A 970 px wide container — what an admin shell with an open sidebar leaves
 * on a 1280 px screen — and texts longer than their columns. Every column is
 * on screen, the row menu included, with no horizontal scrollbar: the columns
 * share the width, and a long name, description, schedule or timezone ends in
 * an ellipsis. The History tab holds the same for its seven columns and the
 * View logs button.
 */
export const NarrowContainer: Story = {
  render: () => (
    <div style={{ width: 970 }} data-testid="narrow-container">
      <Harness api={{ jobs: longTextJobs, runs: longTextRuns }} />
    </div>
  ),
};
