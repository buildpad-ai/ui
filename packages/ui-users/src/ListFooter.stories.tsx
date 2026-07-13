import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Paper } from '@mantine/core';
import { ListFooter } from './ListFooter';

const meta: Meta<typeof ListFooter> = {
  title: 'Users/ListFooter',
  component: ListFooter,
};

export default meta;
type Story = StoryObj<typeof ListFooter>;

const Interactive: React.FC<{ totalCount: number }> = ({ totalCount }) => {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));
  return (
    <Paper radius="md" withBorder>
      <ListFooter
        shown={Math.min(limit, totalCount)}
        totalCount={totalCount}
        itemsLabel="users"
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        limit={limit}
        sizeOptions={[10, 25, 50, 100]}
        onLimitChange={(next) => {
          setLimit(next);
          setPage(1);
        }}
      />
    </Paper>
  );
};

export const ManyPages: Story = { render: () => <Interactive totalCount={137} /> };
export const SinglePage: Story = { render: () => <Interactive totalCount={8} /> };
