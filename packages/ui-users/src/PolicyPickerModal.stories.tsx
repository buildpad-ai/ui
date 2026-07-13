import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from '@mantine/core';
import { PolicyPickerModal } from './PolicyPickerModal';
import { mockPolicies } from './_fixtures';

/**
 * `PolicyPickerModal` fetches live policies via `usePolicies()`. Outside a
 * `DaaSProvider` + backend connection the fetch fails gracefully to an empty
 * list — see `UserPoliciesManager (DaaS)` / `RolePoliciesManager (DaaS)` for
 * a fully connected picker. This fixture story documents the shell UI
 * (search input, selection table, footer actions) in isolation.
 */
const meta: Meta<typeof PolicyPickerModal> = {
  title: 'Users/PolicyPickerModal',
  component: PolicyPickerModal,
  parameters: {
    docs: {
      description: {
        component:
          'Searchable policy list excluding already-attached policies. Requires a DaaSProvider-connected backend to list real policies; see the `(DaaS)` stories for `UserPoliciesManager`/`RolePoliciesManager` for a live example.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof PolicyPickerModal>;

function Harness(props: { excludeIds?: string[] }) {
  const [opened, setOpened] = useState(true);
  return (
    <>
      <Button onClick={() => setOpened(true)}>Add Policies…</Button>
      <PolicyPickerModal
        opened={opened}
        excludeIds={props.excludeIds ?? []}
        onAttach={() => setOpened(false)}
        onClose={() => setOpened(false)}
      />
    </>
  );
}

export const Default: Story = { render: () => <Harness /> };

export const WithExclusions: Story = {
  render: () => <Harness excludeIds={mockPolicies.map((p) => p.id)} />,
};
