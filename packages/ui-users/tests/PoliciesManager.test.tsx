/**
 * PoliciesManager unit tests: headerless mode, Name column sorting (the only
 * sortable column — count columns are computed server-side after the query),
 * and the page-size selector. `@buildpad/hooks` is mocked.
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PoliciesManager } from '../src/PoliciesManager';
import { mockPolicies } from '../src/_fixtures';

const { fetchPoliciesMock, deletePolicyMock, usePermissionsMock } = vi.hoisted(() => ({
  fetchPoliciesMock: vi.fn(),
  deletePolicyMock: vi.fn(),
  usePermissionsMock: vi.fn(),
}));

vi.mock('@buildpad/hooks', () => ({
  usePolicies: () => ({ fetchPolicies: fetchPoliciesMock, deletePolicy: deletePolicyMock }),
  usePermissions: usePermissionsMock,
}));

function renderManager(props: Partial<React.ComponentProps<typeof PoliciesManager>> = {}) {
  return render(
    <MantineProvider>
      <PoliciesManager {...props} />
    </MantineProvider>
  );
}

beforeEach(() => {
  fetchPoliciesMock
    .mockReset()
    .mockResolvedValue({ policies: mockPolicies, total: mockPolicies.length, totalPages: 1 });
  deletePolicyMock.mockReset().mockResolvedValue(undefined);
  usePermissionsMock.mockReset().mockReturnValue({ canPerform: () => true, isAdmin: true, loading: false });
});

describe('PoliciesManager', () => {
  it('renders the policies list from fetchPolicies', async () => {
    renderManager();
    await waitFor(() => expect(screen.getByText('Admin Policy')).toBeInTheDocument());
    expect(screen.getByText('Content Editor')).toBeInTheDocument();
  });

  it('hideHeader hides the heading + subtitle but keeps the Add button', async () => {
    renderManager({ hideHeader: true, onCreatePolicy: vi.fn() });
    await waitFor(() => expect(fetchPoliciesMock).toHaveBeenCalled());
    expect(screen.queryByRole('heading', { name: 'Policies' })).not.toBeInTheDocument();
    expect(screen.getByTestId('policies-manager-add-btn')).toBeInTheDocument();
  });

  it('cycles Name sort asc → desc → none, refetching at page 1', async () => {
    renderManager();
    await waitFor(() => expect(fetchPoliciesMock).toHaveBeenCalled());

    fireEvent.click(screen.getByTestId('policies-manager-sort-name'));
    await waitFor(() =>
      expect(fetchPoliciesMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ sort: 'name', page: 1 })
      )
    );

    fireEvent.click(screen.getByTestId('policies-manager-sort-name'));
    await waitFor(() =>
      expect(fetchPoliciesMock).toHaveBeenLastCalledWith(expect.objectContaining({ sort: '-name' }))
    );

    fireEvent.click(screen.getByTestId('policies-manager-sort-name'));
    await waitFor(() =>
      expect(fetchPoliciesMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ sort: undefined })
      )
    );
  });

  it('changing the page size refetches with the new limit at page 1', async () => {
    renderManager();
    await waitFor(() => expect(fetchPoliciesMock).toHaveBeenCalled());

    fireEvent.click(screen.getByTestId('policies-manager-page-size'));
    // hidden: true — the dropdown stays display:none in jsdom (no transitions).
    fireEvent.click(await screen.findByRole('option', { name: '50 / page', hidden: true }));

    await waitFor(() =>
      expect(fetchPoliciesMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ limit: 50, page: 1 })
      )
    );
  });

  it('surfaces a load failure as an error empty state plus a toast (not "no policies yet")', async () => {
    const show = vi.spyOn(notifications, 'show').mockImplementation(() => '');
    fetchPoliciesMock.mockRejectedValue(new Error('service unavailable'));

    renderManager();

    await waitFor(() => expect(screen.getByText('Failed to load policies')).toBeInTheDocument());
    expect(screen.getByText('service unavailable')).toBeInTheDocument();
    expect(screen.queryByText('No policies found')).not.toBeInTheDocument();
    expect(show).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Failed to load policies', color: 'red' })
    );
    show.mockRestore();
  });
});
