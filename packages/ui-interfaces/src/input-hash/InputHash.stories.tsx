import type { Meta, StoryObj } from '@storybook/react';
import { InputHash } from './InputHash';

const meta: Meta<typeof InputHash> = {
  title: 'Interfaces/InputHash',
  component: InputHash,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `A hashed input interface for securely storing values like passwords. The value is hashed server-side — this component shows whether a hashed value exists and accepts new plaintext input for re-hashing.

## Features
- Tracks whether a value is already hashed (lock icon indicator)
- Masked (password) or plaintext entry modes
- Monospace font for hash-style display
- Placeholder changes to "Value securely stored" when hashed
- Server-side hashing — component only emits raw input

## Usage
\`\`\`tsx
import { InputHash } from '@buildpad/ui-interfaces';

<InputHash
  label="Password"
  value={hashedPassword}
  onChange={(val) => setPassword(val)}
  masked
/>
\`\`\``,
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    value: { control: 'text', description: 'Current hashed value from server' },
    masked: { control: 'boolean', description: 'Whether to mask the input (password style)' },
    disabled: { control: 'boolean', description: 'Whether the input is disabled' },
    readonly: { control: 'boolean', description: 'Whether the input is readonly' },
    required: { control: 'boolean', description: 'Whether the field is required' },
    label: { control: 'text', description: 'Field label' },
    placeholder: { control: 'text', description: 'Placeholder text' },
    error: { control: 'text', description: 'Error message' },
    description: { control: 'text', description: 'Help text' },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { label: 'Hash Field', placeholder: 'Enter value to hash' },
};

export const WithHashedValue: Story = {
  args: {
    label: 'Password',
    value: '$argon2id$v=19$m=65536,t=3,p=4$abc123',
    description: 'This field already has a hashed value stored',
  },
};

export const Masked: Story = {
  args: {
    label: 'Secret Key',
    masked: true,
    placeholder: 'Enter secret key',
  },
};

export const MaskedWithHashedValue: Story = {
  args: {
    label: 'Password',
    masked: true,
    value: '$argon2id$v=19$m=65536,t=3,p=4$abc123',
    description: 'Existing hashed value — enter new value to replace',
  },
};

export const Required: Story = {
  args: {
    label: 'API Key',
    required: true,
    placeholder: 'Required field',
  },
};

export const WithError: Story = {
  args: {
    label: 'Password',
    error: 'Password is required',
  },
};

export const WithDescription: Story = {
  args: {
    label: 'Password',
    placeholder: 'Enter your password',
    description: 'Value will be securely hashed before storage',
  },
};

export const Disabled: Story = {
  args: {
    label: 'Disabled Hash',
    disabled: true,
    value: '$argon2id$v=19$m=65536,t=3,p=4$abc123',
  },
};

export const ReadOnly: Story = {
  args: {
    label: 'Read Only Hash',
    readonly: true,
    value: '$argon2id$v=19$m=65536,t=3,p=4$abc123',
  },
};

export const EmptyState: Story = {
  args: {
    label: 'New Password',
    placeholder: 'No value set yet',
  },
};
