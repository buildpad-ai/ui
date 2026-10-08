import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Code, Stack, Text, Textarea } from '@mantine/core';
import { CronJobDetail } from './CronJobDetail';
import { MockCronApi, type MockCronApiOptions } from './_mockApi';
import { JOB_REPORT_ID, JOB_SYNC_ID } from './_fixtures';

/**
 * Fixture stories: `CronJobDetail` loads through `useCronJobs`, so these run
 * against an in-memory API (`_mockApi.tsx`) instead of props. For a real
 * backend see `Cron/CronJobDetail (DaaS)`.
 */
const meta: Meta<typeof CronJobDetail> = {
  title: 'Cron/CronJobDetail',
  component: CronJobDetail,
  // One in-memory API at a time: these stories do not share a docs page.
  tags: ['!autodocs'],
  parameters: {
    layout: 'padded',
  },
};

export default meta;
type Story = StoryObj<typeof CronJobDetail>;

function Harness({
  api,
  id: initialId = JOB_REPORT_ID,
  ...props
}: { api?: MockCronApiOptions } & Partial<React.ComponentProps<typeof CronJobDetail>>) {
  const [id, setId] = useState(initialId);
  const [last, setLast] = useState('—');

  return (
    <MockCronApi {...api}>
      <Stack gap="sm">
        <CronJobDetail
          id={id}
          onBack={() => setLast('onBack()')}
          // As the reference admin UI does: open the new job's editor
          onCreated={(job) => {
            setLast(`onCreated(${job.name})`);
            setId(job.id);
          }}
          onSaved={(job) => setLast(`onSaved(${job.name})`)}
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
 * A stored job, as an administrator. Edit a field: the Unsaved Changes badge
 * appears, Save is enabled, and Run Now waits for the save (Deactivate does
 * not: it stops the job at once and keeps the edit). Run
 * Now is answered when the run has ended, and then opens the History tab.
 */
export const Existing: Story = {
  render: () => <Harness />,
};

/** A new job: the form's defaults and the default code. Create calls `onCreated` with the stored job. */
export const New: Story = {
  render: () => <Harness id="new" />,
};

/** Read access only: every field and the code are read-only, and there is no action button. */
export const ReadOnlyAccess: Story = {
  render: () => <Harness api={{ access: 'readOnly' }} />,
};

/**
 * A job whose timezone was stored through the API and is not one of the UTC
 * offsets: it is shown, and kept, as it is stored.
 */
export const UnlistedTimezone: Story = {
  render: () => <Harness id={JOB_SYNC_ID} />,
};

/** The caller's grant withholds the job's code: a note stands in for the editor, and the code is never sent. */
export const CodeWithheld: Story = {
  render: () => <Harness api={{ withheldFields: ['code'] }} />,
};

/** The job is running: Run Now starts nothing, says so, and the History tab opens. */
export const AlreadyRunning: Story = {
  render: () => <Harness api={{ runningJobIds: [JOB_REPORT_ID] }} />,
};

/** The id names no job: the not-found state, in place. */
export const NotFound: Story = {
  render: () => <Harness id="3d0a5a52-6f0e-4d0b-9a8e-0c5b7a1f1999" />,
};

/** The job request is refused (403): the access-denied state, in place. */
export const AccessDenied: Story = {
  render: () => <Harness api={{ access: 'none' }} />,
};

/** The job request fails (500): the load-error state with Retry, and a notification. */
export const LoadError: Story = {
  render: () => <Harness api={{ detailStatus: 500 }} />,
};

/**
 * `renderCodeEditor` puts a host's own editor in place of the built-in one —
 * here a plain Mantine `Textarea`; a host app would pass its syntax-highlighting
 * editor. `codeHelp` replaces the notice above it.
 */
export const CustomCodeEditor: Story = {
  render: () => (
    <Harness
      codeHelp={
        <>
          On this backend a job can call <Code>services.fetch</Code> and read <Code>services.env</Code>.
        </>
      }
      renderCodeEditor={({ value, onChange, readOnly, minHeight, placeholder, id, ...aria }) => (
        <Textarea
          id={id}
          value={value}
          onChange={(event) => onChange(event.currentTarget.value)}
          readOnly={readOnly}
          placeholder={placeholder}
          styles={{ input: { minHeight, fontFamily: 'var(--mantine-font-family-monospace)' } }}
          {...aria}
        />
      )}
    />
  ),
};
