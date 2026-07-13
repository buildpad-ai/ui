import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { SearchInput } from './SearchInput';

const meta: Meta<typeof SearchInput> = {
  title: 'Users/SearchInput',
  component: SearchInput,
};

export default meta;
type Story = StoryObj<typeof SearchInput>;

const Controlled: React.FC<{ initial?: string }> = ({ initial = '' }) => {
  const [value, setValue] = useState(initial);
  return (
    <SearchInput
      value={value}
      onChange={setValue}
      placeholder="Search users..."
      style={{ maxWidth: 360 }}
    />
  );
};

export const Empty: Story = { render: () => <Controlled /> };
export const WithValue: Story = { render: () => <Controlled initial="jane" /> };
