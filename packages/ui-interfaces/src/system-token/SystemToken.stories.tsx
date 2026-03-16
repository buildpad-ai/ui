import type { Meta, StoryObj } from '@storybook/react';
import { SystemToken } from './SystemToken';

const meta: Meta<typeof SystemToken> = {
  title: 'Interfaces/SystemToken',
  component: SystemToken,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `A secure token generation and management interface. Allows users to generate random tokens, copy them, and manage token lifecycle.

## Features
- Generate cryptographically random tokens via DaaS API
- Copy token to clipboard
- Token visibility toggle (masked until generated)
- Remove/regenerate existing tokens
- Success notice reminding users to copy the token
- Monospace font for token display

## Usage
\`\`\`tsx
import { SystemToken } from '@buildpad/ui-interfaces';

<SystemToken
  label="API Token"
  value={token}
  onChange={(val) => setToken(val)}
/>
\`\`\``,
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    value: { control: 'text', description: 'Current token value (or masked as asterisks)' },
    disabled: { control: 'boolean', description: 'Whether token operations are disabled' },
    label: { control: 'text', description: 'Field label' },
    description: { control: 'text', description: 'Help text' },
    error: { control: 'text', description: 'Error message' },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    label: 'API Token',
  },
};

export const WithExistingToken: Story = {
  args: {
    label: 'API Token',
    value: '**********************************************',
    description: 'This token is securely saved',
  },
};

export const WithVisibleToken: Story = {
  args: {
    label: 'API Token',
    value: 'X0FS1QAEUdPKhbsb3widcgaWiuxj9wA6',
    description: 'Token generated and visible',
  },
};

export const Disabled: Story = {
  args: {
    label: 'API Token',
    disabled: true,
    value: '**********************************************',
  },
};

export const DisabledNoToken: Story = {
  args: {
    label: 'API Token',
    disabled: true,
  },
};

export const WithError: Story = {
  args: {
    label: 'API Token',
    error: 'Token is required',
  },
};

export const WithDescription: Story = {
  args: {
    label: 'Static Token',
    description: 'Generate a static token for API access. Keep this token secure.',
  },
};
