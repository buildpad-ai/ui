import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Paper } from '@mantine/core';
import { CronJobsManager } from './CronJobsManager';
import { CronJobDetail } from './CronJobDetail';
import { DaaSConnectionGate } from './_daasStory';

/**
 * CronJobsManager + CronJobDetail — DaaS Connected Playground
 *
 * Connects to a real DaaS instance (via the Storybook Host proxy) to exercise
 * the whole cron flow: list, search, create, edit the code and the settings,
 * run now, activate and deactivate, clone, read the run history and its logs,
 * and delete.
 *
 * 1. Start the host: `pnpm dev:host`
 * 2. Visit http://localhost:3000 and enter your DaaS URL + static token
 * 3. Start this Storybook: `pnpm --filter @buildpad/ui-cron storybook`
 */
const meta: Meta<typeof CronJobsManager> = {
  title: 'Cron/CronJobsManager (DaaS)',
  component: CronJobsManager,
  tags: ['!autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Connect the cron jobs admin to a real DaaS instance: list, create, edit, run, activate, clone and delete jobs, and read their run history. Authentication is handled by the Storybook Host app.',
      },
    },
  },
};

export default meta;

/** In-story navigation: list ↔ editor, exercising the navigation props. */
const CronPlayground: React.FC = () => {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <DaaSConnectionGate>
      <Paper p="md" withBorder>
        {selectedId ? (
          <CronJobDetail
            id={selectedId}
            onBack={() => setSelectedId(null)}
            // As the reference admin UI does: open the new job's editor
            onCreated={(job) => setSelectedId(job.id)}
          />
        ) : (
          <CronJobsManager
            // The story's URL belongs to Storybook
            urlParams={false}
            onJobClick={(job) => setSelectedId(job.id)}
            onCreateJob={() => setSelectedId('new')}
          />
        )}
      </Paper>
    </DaaSConnectionGate>
  );
};

/**
 * DaaS Connected Playground
 *
 * The jobs list against a live backend, with in-story list ↔ editor navigation.
 */
export const Playground: StoryObj<typeof CronJobsManager> = {
  render: () => <CronPlayground />,
};
