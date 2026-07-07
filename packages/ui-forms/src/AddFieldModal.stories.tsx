import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Button, Code, Stack, Text } from '@mantine/core';
import { AddFieldModal, type AddFieldResult } from './AddFieldModal';

/**
 * AddFieldModal — standalone (no DaaS required).
 *
 * The "Add field" flow. The **Storage** control adapts to the target
 * collection's strategy:
 *   - **Hybrid** (`supportsExtras`) — pick *Real column* or *Extra (jsonb)*.
 *   - **Full** (`supportsExtras={false}`) — no extras tail, so only *Real column*
 *     is available and the segmented control collapses to a note.
 *
 * `canProvisionSchema` gates real-column provisioning (DDL / schema rights).
 */

const existing = new Set(['id', 'title', 'status']);

const Harness: React.FC<{
  canProvisionSchema: boolean;
  supportsExtras: boolean;
}> = ({ canProvisionSchema, supportsExtras }) => {
  const [opened, setOpened] = useState(true);
  const [result, setResult] = useState<AddFieldResult | null>(null);

  return (
    <Stack gap="md" maw={520}>
      <Button onClick={() => setOpened(true)}>Open “Add field”</Button>
      <AddFieldModal
        opened={opened}
        onClose={() => setOpened(false)}
        canProvisionSchema={canProvisionSchema}
        supportsExtras={supportsExtras}
        existingFieldNames={existing}
        onCreate={async (r) => {
          setResult(r);
        }}
      />
      <div>
        <Text size="xs" fw={500} mb={4}>
          Last AddFieldResult
        </Text>
        <Code block style={{ fontSize: 11 }}>
          {result ? JSON.stringify(result, null, 2) : '— submit the modal —'}
        </Code>
      </div>
    </Stack>
  );
};

const meta: Meta<typeof Harness> = {
  title: 'ui-forms/AddFieldModal',
  component: Harness,
};
export default meta;

type Story = StoryObj<typeof Harness>;

/** Hybrid collection — both Real column and Extra (jsonb) are offered. */
export const HybridWithSchemaRights: Story = {
  args: { canProvisionSchema: true, supportsExtras: true },
};

/** Full collection — no extras tail, so only Real column is available. */
export const FullCollection: Story = {
  args: { canProvisionSchema: true, supportsExtras: false },
};

/** Hybrid, but no schema rights — real columns disabled, extras only. */
export const HybridNoSchemaRights: Story = {
  args: { canProvisionSchema: false, supportsExtras: true },
};
