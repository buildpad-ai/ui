import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import '@testing-library/jest-dom';
import { DaaSProvider } from '@buildpad/services';
import { RelationalUIProvider } from '@buildpad/services/relational-ui-context';
import type { M2MDisplayItem } from '@buildpad/hooks';

import { ListM2M } from '../list-m2m/ListM2M';

// ListM2M renders the CollectionList/CollectionForm a relational provider
// supplies; these tests only exercise ListM2M's own pagination/rendering
// logic, not the create/select dialogs' internals, so supply stubs.
const RELATIONAL_STUBS = {
  CollectionList: () => <div data-testid="collection-list" />,
  CollectionForm: () => <div data-testid="collection-form" />,
};

const renderWithProvider = (component: React.ReactElement) => {
  return render(
    <DaaSProvider config={{ url: 'https://example.test', token: 'test-token' }} autoFetchUser={false}>
      <MantineProvider>
        <RelationalUIProvider components={RELATIONAL_STUBS}>{component}</RelationalUIProvider>
      </MantineProvider>
    </DaaSProvider>,
  );
};

const defaultProps = {
  collection: 'articles',
  field: 'tags',
  primaryKey: 1,
};

/** Build `count` plain (fetched) mock items with sequential ids. */
function fetchedItems(count: number): M2MDisplayItem[] {
  return Array.from({ length: count }, (_, i) => ({ id: i + 1, sort: i + 1 }));
}

describe('ListM2M mockItems rendering', () => {
  it('renders provided mock items in list layout', () => {
    renderWithProvider(
      <ListM2M {...defaultProps} layout="list" mockItems={fetchedItems(2)} />,
    );

    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('shows the "new" badge on locally-created items', () => {
    const items: M2MDisplayItem[] = [
      { id: 1, sort: 1 },
      { id: '$new-0', sort: 2, $type: 'created' },
    ];

    renderWithProvider(
      <ListM2M {...defaultProps} layout="list" limit={10} mockItems={items} />,
    );

    // Only 2 items total (below the limit) => single page => created item visible.
    expect(screen.getByText('NEW')).toBeInTheDocument();
  });
});

describe('ListM2M pagination (bug 3.5: staged creates rendered on every page)', () => {
  it('hides locally-created items on non-last pages and shows them on the last page', () => {
    // 3 fetched items + 1 staged create = 4 total, limit 2 => 2 pages.
    // The create should only be visible once currentPage reaches the last page (2).
    const items: M2MDisplayItem[] = [
      ...fetchedItems(3),
      { id: '$new-0', sort: 4, $type: 'created' },
    ];

    renderWithProvider(
      <ListM2M {...defaultProps} layout="list" limit={2} mockItems={items} />,
    );

    // Page 1 (default): created item must not render.
    expect(screen.queryByText('NEW')).not.toBeInTheDocument();

    // Navigate to the last page (2).
    const pageTwoButton = screen.getByRole('button', { name: '2' });
    fireEvent.click(pageTwoButton);

    // Now on the last page: the staged create becomes visible.
    expect(screen.getByText('NEW')).toBeInTheDocument();
  });

  it('does not render the staged create more than once while paging back and forth', () => {
    const items: M2MDisplayItem[] = [
      ...fetchedItems(2),
      { id: '$new-0', sort: 3, $type: 'created' },
    ];

    renderWithProvider(
      <ListM2M {...defaultProps} layout="list" limit={2} mockItems={items} />,
    );

    const pageTwoButton = screen.getByRole('button', { name: '2' });
    fireEvent.click(pageTwoButton);
    expect(screen.getAllByText('NEW')).toHaveLength(1);

    const pageOneButton = screen.getByRole('button', { name: '1' });
    fireEvent.click(pageOneButton);
    expect(screen.queryByText('NEW')).not.toBeInTheDocument();
  });
});

describe('ListM2M relational UI provider (cycle-break)', () => {
  const renderBare = (component: React.ReactElement) =>
    render(
      <DaaSProvider config={{ url: 'https://example.test', token: 'test-token' }} autoFetchUser={false}>
        <MantineProvider>{component}</MantineProvider>
      </DaaSProvider>,
    );

  it('without a provider: shows the alert and hides create, select and edit', () => {
    renderBare(<ListM2M {...defaultProps} layout="list" mockItems={fetchedItems(2)} />);

    const alert = screen.getByTestId('m2m-missing-relational-ui');
    expect(alert).toHaveAttribute('data-missing', 'CollectionForm CollectionList');
    expect(screen.queryByRole('button', { name: /Add Existing/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Create New/ })).not.toBeInTheDocument();
  });

  it('with a provider: offers create and select and shows no alert', () => {
    renderWithProvider(<ListM2M {...defaultProps} layout="list" mockItems={fetchedItems(2)} />);

    expect(screen.queryByTestId('m2m-missing-relational-ui')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add Existing/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create New/ })).toBeInTheDocument();
  });

  it('the `components` prop alone is enough (no provider)', () => {
    renderBare(
      <ListM2M {...defaultProps} layout="list" mockItems={fetchedItems(2)} components={RELATIONAL_STUBS} />,
    );
    expect(screen.queryByTestId('m2m-missing-relational-ui')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create New/ })).toBeInTheDocument();
  });

  it('a disabled field shows no alert', () => {
    renderBare(<ListM2M {...defaultProps} layout="list" mockItems={fetchedItems(2)} disabled />);
    expect(screen.queryByTestId('m2m-missing-relational-ui')).not.toBeInTheDocument();
  });
});
