/**
 * PoliciesManager unit tests: headerless mode, Name column sorting (the only
 * sortable column — count columns are computed server-side after the query),
 * and the page-size selector. `@buildpad/hooks` is mocked.
 */
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

vi.mock('@buildpad/hooks', async () => {
  // The URL-persistence helpers are pure; use the real ones so the managers'
  // URL wiring is exercised, not stubbed.
  const url = await import('../../hooks/src/useUrlListParams');
  return {
    useUrlListParams: url.useUrlListParams,
    useHydrated: url.useHydrated,
    readUrlParam: url.readUrlParam,
    readUrlIntParam: url.readUrlIntParam,
  usePolicies: () => ({ fetchPolicies: fetchPoliciesMock, deletePolicy: deletePolicyMock }),
  usePermissions: usePermissionsMock,
  };
});

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

  it('names the rows in its footer by their number: one policy, three policies', async () => {
    const { unmount } = renderManager();
    expect(await screen.findByText('Showing 3 of 3 policies')).toBeInTheDocument();
    unmount();

    fetchPoliciesMock.mockResolvedValue({ policies: mockPolicies.slice(0, 1), total: 1, totalPages: 1 });
    renderManager();
    expect(await screen.findByText('Showing 1 of 1 policy')).toBeInTheDocument();
    expect(screen.getByText('1 policy')).toBeInTheDocument();
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

    fireEvent.click(screen.getByRole('columnheader', { name: 'Name' }));
    await waitFor(() =>
      expect(fetchPoliciesMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ sort: 'name', page: 1 })
      )
    );

    fireEvent.click(screen.getByRole('columnheader', { name: 'Name' }));
    await waitFor(() =>
      expect(fetchPoliciesMock).toHaveBeenLastCalledWith(expect.objectContaining({ sort: '-name' }))
    );

    fireEvent.click(screen.getByRole('columnheader', { name: 'Name' }));
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

    await waitFor(() =>
      expect(
        screen.getByText('Failed to load policies — service unavailable')
      ).toBeInTheDocument()
    );
    expect(show).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Failed to load policies', color: 'red' })
    );
    show.mockRestore();
  });

  describe('while the permissions are not known', () => {
    const rerender = (
      view: ReturnType<typeof renderManager>,
      props: Partial<React.ComponentProps<typeof PoliciesManager>>,
    ) =>
      view.rerender(
        <MantineProvider>
          <PoliciesManager {...props} />
        </MantineProvider>,
      );

    it('draws no write control while permissions load, and the allowed ones once they are known', async () => {
      // What a user who will turn out to be an administrator gets meanwhile
      usePermissionsMock.mockReturnValue({ canPerform: () => true, isAdmin: true, loading: true });
      const onClick = vi.fn();
      const props = { onPolicyClick: onClick, onCreatePolicy: vi.fn() };
      const view = renderManager(props);
      await waitFor(() => expect(screen.getByText('Admin Policy')).toBeInTheDocument());

      expect(screen.queryByTestId('policies-manager-add-btn')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Row actions')).not.toBeInTheDocument();
      // A row opens the editor for a user who may update: not before that is known
      fireEvent.click(screen.getByText('Admin Policy'));
      expect(onClick).not.toHaveBeenCalled();
      // Reading does not wait: the rows are there, and counted
      expect(screen.getByText(`${mockPolicies.length} policies`)).toBeInTheDocument();

      usePermissionsMock.mockReturnValue({ canPerform: () => true, isAdmin: true, loading: false });
      rerender(view, props);
      expect(await screen.findByTestId('policies-manager-add-btn')).toBeInTheDocument();
      expect(screen.getAllByLabelText('Row actions')).toHaveLength(mockPolicies.length);
      fireEvent.click(screen.getByText('Admin Policy'));
      expect(onClick).toHaveBeenCalledWith(mockPolicies[0]);
      // The list was loaded once: the permissions arriving do not fetch it again
      expect(fetchPoliciesMock).toHaveBeenCalledTimes(1);
    });

    it('a reader is never shown a write control, not even while permissions load', async () => {
      usePermissionsMock.mockReturnValue({ canPerform: () => false, isAdmin: false, loading: true });
      const onClick = vi.fn();
      const props = { onPolicyClick: onClick, onCreatePolicy: vi.fn() };
      const view = renderManager(props);
      await waitFor(() => expect(screen.getByText('Admin Policy')).toBeInTheDocument());
      expect(screen.queryByTestId('policies-manager-add-btn')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Row actions')).not.toBeInTheDocument();

      usePermissionsMock.mockReturnValue({
        canPerform: (_collection: string, action: string) => action === 'read',
        isAdmin: false,
        loading: false,
      });
      rerender(view, props);
      expect(screen.getByText('Admin Policy')).toBeInTheDocument();
      expect(screen.queryByTestId('policies-manager-add-btn')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Row actions')).not.toBeInTheDocument();
      fireEvent.click(screen.getByText('Admin Policy'));
      expect(onClick).not.toHaveBeenCalled();
    });

    it('a later refresh of the permissions does not take the controls away meanwhile', async () => {
      const props = { onPolicyClick: vi.fn(), onCreatePolicy: vi.fn() };
      const view = renderManager(props);
      await waitFor(() => expect(screen.getByText('Admin Policy')).toBeInTheDocument());
      expect(screen.getByTestId('policies-manager-add-btn')).toBeInTheDocument();

      // The hook loads again (a renewed token, another scope) and answers from what it knew meanwhile
      usePermissionsMock.mockReturnValue({ canPerform: () => true, isAdmin: true, loading: true });
      rerender(view, props);
      expect(screen.getByTestId('policies-manager-add-btn')).toBeInTheDocument();
      expect(screen.getAllByLabelText('Row actions')).toHaveLength(mockPolicies.length);
    });
  });

  // The point of these is the COUNT of requests: a change of search, filter,
  // sort or page size on a later page is one request (the new filter on page
  // 1), not one for the old page of the new filter followed by one for page 1.
  describe('requests from a later page', () => {
    /** What the list asked for since the last `mockClear()`, in order. */
    const requests = () =>
      fetchPoliciesMock.mock.calls.map(([params]) => ({
        page: params.page,
        limit: params.limit,
        search: params.search, sort: params.sort,
      }));
    /** Long enough for the 300 ms search debounce and for any request it would start after it. */
    const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 500)));
    const none = { sort: undefined };

    /** Three pages of 25, whatever is asked for; the list is left on page 2. */
    async function onPageTwo(props: Partial<React.ComponentProps<typeof PoliciesManager>> = {}) {
      fetchPoliciesMock.mockImplementation(async () => ({ policies: mockPolicies, total: 60, totalPages: 3 }));
      renderManager({ urlParams: false, ...props });
      await waitFor(() => expect(fetchPoliciesMock).toHaveBeenCalledTimes(1));
      fireEvent.click(await screen.findByRole('button', { name: '2' }));
      await waitFor(() => expect(fetchPoliciesMock).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })));
      await settle();
      fetchPoliciesMock.mockClear();
    }

    it('a search typed on page 2 is ONE request: that search, on page 1', async () => {
      await onPageTwo();
      fireEvent.change(screen.getByTestId('policies-manager-search'), { target: { value: 'report' } });
      await settle();
      // Not [{ page: 2, search: 'report' }, { page: 1, search: 'report' }]
      expect(requests()).toEqual([{ page: 1, limit: 25, search: 'report', ...none }]);
    });

    it('clearing a search on a later page is one request as well', async () => {
      fetchPoliciesMock.mockImplementation(async () => ({ policies: mockPolicies, total: 60, totalPages: 3 }));
      renderManager({ urlParams: false });
      await waitFor(() => expect(fetchPoliciesMock).toHaveBeenCalledTimes(1));
      fireEvent.change(screen.getByTestId('policies-manager-search'), { target: { value: 'report' } });
      await settle();
      fireEvent.click(await screen.findByRole('button', { name: '3' }));
      await waitFor(() => expect(fetchPoliciesMock).toHaveBeenLastCalledWith(expect.objectContaining({ page: 3, search: 'report' })));
      await settle();
      fetchPoliciesMock.mockClear();

      fireEvent.change(screen.getByTestId('policies-manager-search'), { target: { value: '' } });
      await settle();
      expect(requests()).toEqual([{ page: 1, limit: 25, search: undefined, ...none }]);
    });

    it('a page-size change on page 2 is ONE request: that size, on page 1', async () => {
      await onPageTwo();
      fireEvent.click(screen.getByTestId('policies-manager-page-size'));
      // hidden: true — the dropdown stays display:none in jsdom (no transitions).
      fireEvent.click(await screen.findByRole('option', { name: '50 / page', hidden: true }));
      await settle();
      expect(requests()).toEqual([{ page: 1, limit: 50, search: undefined, ...none }]);
    });

    it('a sort picked on page 2 is one request', async () => {
      await onPageTwo();
      fireEvent.click(screen.getByRole('columnheader', { name: 'Name' }));
      await settle();
      expect(requests()).toEqual([{ page: 1, limit: 25, search: undefined, sort: 'name' }]);
    });

    it('what is typed sends nothing until the debounce has passed, and keeps the page until then', async () => {
      await onPageTwo();
      // Typed and taken back within the debounce: the list never searched for it
      fireEvent.change(screen.getByTestId('policies-manager-search'), { target: { value: 'rep' } });
      fireEvent.change(screen.getByTestId('policies-manager-search'), { target: { value: '' } });
      await settle();
      expect(requests()).toEqual([]);
      expect(screen.getByRole('button', { name: '2' })).toHaveAttribute('aria-current', 'page');
    });

    it('a page and a search restored from the URL are one request, and the page is kept', async () => {
      window.history.replaceState(null, '', '/?search=report&page=2');
      fetchPoliciesMock.mockImplementation(async () => ({ policies: mockPolicies, total: 60, totalPages: 3 }));
      try {
        renderManager();
        await waitFor(() => expect(fetchPoliciesMock).toHaveBeenCalled());
        await settle();
        expect(requests()).toEqual([{ page: 2, limit: 25, search: 'report', ...none }]);
        expect(screen.getByRole('button', { name: '2' })).toHaveAttribute('aria-current', 'page');

        // A new search drops the page, in the list and in the URL
        fetchPoliciesMock.mockClear();
        fireEvent.change(screen.getByTestId('policies-manager-search'), { target: { value: 'audit' } });
        await settle();
        expect(requests()).toEqual([{ page: 1, limit: 25, search: 'audit', ...none }]);
        expect(window.location.search).toBe('?search=audit');
      } finally {
        window.history.replaceState(null, '', '/');
      }
    });
  });
});
