import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Stack } from '@mantine/core';
import { TokenInput } from './TokenInput';

const meta: Meta<typeof TokenInput> = {
  title: 'Users/TokenInput',
  component: TokenInput,
};

export default meta;
type Story = StoryObj<typeof TokenInput>;

/** Controlled harness so generate/clear behave as they do inside UserDetail. */
const Controlled = ({ initial, disabled }: { initial: string | null; disabled?: boolean }) => {
  const [value, setValue] = useState<string | null>(initial);
  return (
    <TokenInput
      label="Static API Token"
      description="Token for API access without a session. Generate a new value to rotate it; clear it to revoke."
      value={value}
      onChange={setValue}
      disabled={disabled}
      data-testid="token-input"
    />
  );
};

/** No token yet — generate placeholder with a plus-icon action. */
export const Empty: Story = { render: () => <Controlled initial={null} /> };

/**
 * A saved token as the backend returns it: concealed as asterisks →
 * "Value Securely Saved", regenerate and clear actions, no copy.
 */
export const SecurelySaved: Story = { render: () => <Controlled initial="**********" /> };

/** Read-only rendering with a saved token. */
export const Disabled: Story = { render: () => <Controlled initial="**********" disabled /> };

/** All three states side by side. */
export const AllStates: Story = {
  render: () => (
    <Stack gap="lg">
      <Controlled initial={null} />
      <Controlled initial="**********" />
      <Controlled initial="**********" disabled />
    </Stack>
  ),
};
