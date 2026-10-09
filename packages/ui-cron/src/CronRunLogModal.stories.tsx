import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { CronRunLogModal } from './CronRunLogModal';
import { mockRuns } from './_fixtures';

/**
 * The run log is fed by props: a run, and `onClose`. Each story opens it on
 * one of the fixture runs.
 */
const meta: Meta<typeof CronRunLogModal> = {
  title: 'Cron/CronRunLogModal',
  component: CronRunLogModal,
  // A dialog covers the page: one per page, so no shared docs page.
  tags: ['!autodocs'],
  parameters: {
    layout: 'padded',
  },
  args: {
    onClose: () => {},
  },
};

export default meta;
type Story = StoryObj<typeof CronRunLogModal>;

/** A manual run that succeeded: an INFO and a WARN line. */
export const Success: Story = {
  args: { run: mockRuns[0] },
};

/** A run that failed: the error box, and the ERROR line the code printed. */
export const Failed: Story = {
  args: { run: mockRuns[1] },
};

/** A run stopped at its timeout, which printed nothing. */
export const TimedOutWithoutOutput: Story = {
  args: { run: mockRuns[2] },
};

/** An object printed over several lines, and an entry in no known form, shown whole. */
export const MultiLineAndRawOutput: Story = {
  args: { run: mockRuns[3] },
};

/** A run that is still going: no duration yet. */
export const Running: Story = {
  args: { run: mockRuns[4] },
};

/** `showJobName={false}`, as a job's own History tab opens it. */
export const WithoutJobName: Story = {
  args: { run: mockRuns[0], showJobName: false },
};
