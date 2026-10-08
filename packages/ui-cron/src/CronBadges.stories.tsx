import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Group, Stack, Text } from '@mantine/core';
import { CRON_JOB_STATUSES, CRON_RUN_STATUSES, CRON_TRIGGERS } from '@buildpad/types';
import { CronJobStatusBadge } from './CronJobStatusBadge';
import { CronRunStatusBadge } from './CronRunStatusBadge';
import { CronTriggerBadge } from './CronTriggerBadge';

/**
 * The three badges of the cron surfaces: a job's status, a run's outcome, and
 * what started a run. Each is one component for the list, the editor and the
 * run log.
 */
const meta: Meta = {
  title: 'Cron/Badges',
  parameters: {
    layout: 'padded',
  },
};

export default meta;
type Story = StoryObj;

/** Whether the scheduler fires a job. The last one is a job whose status the caller's grant withholds. */
export const JobStatus: Story = {
  render: () => (
    <Group>
      {CRON_JOB_STATUSES.map((status) => (
        <CronJobStatusBadge key={status} status={status} />
      ))}
      <CronJobStatusBadge status={undefined} />
    </Group>
  ),
};

/** How a run ended, or that it is running. The last one is a job that has not run yet. */
export const RunStatus: Story = {
  render: () => (
    <Group>
      {CRON_RUN_STATUSES.map((status) => (
        <CronRunStatusBadge key={status} status={status} />
      ))}
      <CronRunStatusBadge status={null} />
    </Group>
  ),
};

/** What started a run: the schedule, a user (Run Now), or stored code. */
export const Trigger: Story = {
  render: () => (
    <Group>
      {CRON_TRIGGERS.map((trigger) => (
        <CronTriggerBadge key={trigger} triggeredBy={trigger} />
      ))}
    </Group>
  ),
};

/** The `translations` prop overrides the dictionary for one instance. */
export const Translated: Story = {
  render: () => (
    <Stack gap="xs">
      <Text size="sm">With per-instance translations:</Text>
      <Group>
        <CronJobStatusBadge status="active" translations={{ jobStatus: { active: 'Aktif' } }} />
        <CronRunStatusBadge status="timeout" translations={{ runStatus: { timeout: 'Waktu habis' } }} />
        <CronTriggerBadge triggeredBy="schedule" translations={{ trigger: { schedule: 'jadwal' } }} />
      </Group>
    </Stack>
  ),
};
