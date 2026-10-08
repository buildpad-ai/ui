import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Button, Group, Paper, Stack, Text, TextInput } from '@mantine/core';
import { CronJobDetail } from './CronJobDetail';
import { DaaSConnectionGate } from './_daasStory';

/**
 * CronJobDetail — DaaS Connected Playground
 *
 * Opens one cron job of a real DaaS instance by id (or `new`), without the
 * list in front of it — the way a route `/cron/[id]` mounts it. Paste an id
 * that does not exist to see the not-found state, or connect with a token
 * that may only read to see the read-only editor.
 *
 * 1. Start the host: `pnpm dev:host`
 * 2. Visit http://localhost:3000 and enter your DaaS URL + static token
 * 3. Start this Storybook: `pnpm --filter @buildpad/ui-cron storybook`
 */
const meta: Meta<typeof CronJobDetail> = {
  title: 'Cron/CronJobDetail (DaaS)',
  component: CronJobDetail,
  tags: ['!autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Open a cron job of a real DaaS instance by id, or create one. Authentication is handled by the Storybook Host app.',
      },
    },
  },
};

export default meta;

const DetailPlayground: React.FC = () => {
  const [draftId, setDraftId] = useState('new');
  const [id, setId] = useState<string | null>(null);

  return (
    <DaaSConnectionGate>
      <Stack gap="md">
        <Paper p="md" withBorder>
          <Group align="flex-end">
            <TextInput
              label="Job id"
              description="A daas_cron_jobs id, or new"
              value={draftId}
              onChange={(e) => setDraftId(e.currentTarget.value)}
              style={{ flex: 1 }}
            />
            <Button onClick={() => setId(draftId.trim() || 'new')}>Open</Button>
          </Group>
        </Paper>

        <Paper p="md" withBorder>
          {id ? (
            <CronJobDetail
              // A different id is a different editor
              key={id}
              id={id}
              onBack={() => setId(null)}
              onCreated={(job) => {
                setDraftId(job.id);
                setId(job.id);
              }}
            />
          ) : (
            <Text size="sm" c="dimmed">
              Enter an id and press Open.
            </Text>
          )}
        </Paper>
      </Stack>
    </DaaSConnectionGate>
  );
};

/**
 * DaaS Connected Playground
 *
 * One cron job against a live backend.
 */
export const Playground: StoryObj<typeof CronJobDetail> = {
  render: () => <DetailPlayground />,
};
