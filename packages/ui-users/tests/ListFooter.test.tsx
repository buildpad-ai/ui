/**
 * ListFooter unit tests: the shared footer contract — hidden entirely at
 * zero rows, "Showing N of M" + page-size selector whenever rows exist,
 * Pagination only past one page.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { describe, it, expect, vi } from 'vitest';
import { ListFooter } from '../src/ListFooter';

function renderFooter(props: Partial<React.ComponentProps<typeof ListFooter>> = {}) {
  return render(
    <MantineProvider>
      <ListFooter
        shown={10}
        totalCount={42}
        itemsLabel="users"
        page={1}
        totalPages={5}
        onPageChange={vi.fn()}
        limit={10}
        sizeOptions={[10, 25, 50, 100]}
        onLimitChange={vi.fn()}
        data-testid="footer-page-size"
        {...props}
      />
    </MantineProvider>
  );
}

describe('ListFooter', () => {
  it('renders nothing when totalCount is 0', () => {
    renderFooter({ totalCount: 0, shown: 0 });
    expect(screen.queryByText(/Showing/)).not.toBeInTheDocument();
    expect(screen.queryByTestId('footer-page-size')).not.toBeInTheDocument();
  });

  it('shows the count line and page-size selector, with Pagination only past one page', () => {
    renderFooter({ totalPages: 1, totalCount: 8, shown: 8 });
    expect(screen.getByText('Showing 8 of 8 users')).toBeInTheDocument();
    expect(screen.getByTestId('footer-page-size')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '2' })).not.toBeInTheDocument();

    renderFooter({ totalPages: 5 });
    expect(screen.getByRole('button', { name: '2' })).toBeInTheDocument();
  });

  it('emits onLimitChange with the numeric size', async () => {
    const onLimitChange = vi.fn();
    renderFooter({ onLimitChange });

    fireEvent.click(screen.getByTestId('footer-page-size'));
    // hidden: true — the dropdown stays display:none in jsdom (no transitions).
    fireEvent.click(await screen.findByRole('option', { name: '50 / page', hidden: true }));

    expect(onLimitChange).toHaveBeenCalledWith(50);
  });
});
