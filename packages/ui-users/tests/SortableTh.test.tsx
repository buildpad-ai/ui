/**
 * SortableTh unit tests: label rendering, aria-sort state mapping, and the
 * onSort click contract.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MantineProvider, Table } from '@mantine/core';
import { describe, it, expect, vi } from 'vitest';
import { SortableTh } from '../src/SortableTh';

function renderTh(props: Partial<React.ComponentProps<typeof SortableTh>> = {}) {
  return render(
    <MantineProvider>
      <Table>
        <Table.Thead>
          <Table.Tr>
            <SortableTh
              label="Email"
              field="email"
              sort={null}
              onSort={() => undefined}
              data-testid="sortable-th"
              {...props}
            />
          </Table.Tr>
        </Table.Thead>
      </Table>
    </MantineProvider>
  );
}

describe('SortableTh', () => {
  it('renders the label inside a clickable header', () => {
    renderTh();
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByTestId('sortable-th')).toBeInTheDocument();
  });

  it('exposes aria-sort="none" when the column is not sorted', () => {
    const { container } = renderTh({ sort: null });
    expect(container.querySelector('th')).toHaveAttribute('aria-sort', 'none');
  });

  it('exposes aria-sort="ascending" when sorted by the field', () => {
    const { container } = renderTh({ sort: 'email' });
    expect(container.querySelector('th')).toHaveAttribute('aria-sort', 'ascending');
  });

  it('exposes aria-sort="descending" when sorted by -field', () => {
    const { container } = renderTh({ sort: '-email' });
    expect(container.querySelector('th')).toHaveAttribute('aria-sort', 'descending');
  });

  it('treats another column\'s sort as unsorted', () => {
    const { container } = renderTh({ sort: 'first_name' });
    expect(container.querySelector('th')).toHaveAttribute('aria-sort', 'none');
  });

  it('invokes onSort with its field when clicked', () => {
    const onSort = vi.fn();
    renderTh({ onSort });
    fireEvent.click(screen.getByTestId('sortable-th'));
    expect(onSort).toHaveBeenCalledWith('email');
  });
});
