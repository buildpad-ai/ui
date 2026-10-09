/**
 * WorkflowInstancesManager unit tests: the read-only list, and the three
 * reasons it can have no rows (none, refused, failed). `@buildpad/hooks` is
 * mocked.
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { WorkflowInstanceRecord, WorkflowListResult } from '@buildpad/types';
import { DaaSRequestError } from '../../hooks/src/daasRequest';
import { WorkflowInstancesManager } from '../src/WorkflowInstancesManager';
import { manyMockInstances, mockInstances } from '../src/_fixtures';

const { fetchInstancesMock, usePermissionsMock } = vi.hoisted(() => ({
  fetchInstancesMock: vi.fn(),
  usePermissionsMock: vi.fn(),
}));

vi.mock('@buildpad/hooks', async () => {
  const url = await import('../../hooks/src/useUrlListParams');
  const request = await import('../../hooks/src/daasRequest');
  return {
    useUrlListParams: url.useUrlListParams,
    useHydrated: url.useHydrated,
    readUrlParam: url.readUrlParam,
    readUrlIntParam: url.readUrlIntParam,
    DaaSRequestError: request.DaaSRequestError,
    useWorkflowInstances: () => ({ fetchInstances: fetchInstancesMock }),
    usePermissions: usePermissionsMock,
  };
});

/** One page of `all`, as the hook answers it. */
function pageOf(
  all: WorkflowInstanceRecord[],
  { page = 1, limit = 25 }: { page?: number; limit?: number } = {},
): WorkflowListResult<WorkflowInstanceRecord> {
  return {
    items: all.slice((page - 1) * limit, page * limit),
    total: all.length,
    totalPages: Math.max(1, Math.ceil(all.length / limit)),
    page,
    limit,
  };
}

function serve(rows: WorkflowInstanceRecord[]) {
  fetchInstancesMock.mockImplementation(async (params: { page?: number; limit?: number }) => pageOf(rows, params));
}

function renderManager(props: Partial<React.ComponentProps<typeof WorkflowInstancesManager>> = {}) {
  return render(
    <MantineProvider>
      <WorkflowInstancesManager urlParams={false} {...props} />
    </MantineProvider>,
  );
}

/** The row of the instance that tracks item `itemId`. */
const rowOf = (itemId: string) => screen.getByText(itemId).closest('tr') as HTMLElement;
const listed = () => waitFor(() => expect(screen.getByText('42')).toBeInTheDocument());

let show: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  fetchInstancesMock.mockReset().mockResolvedValue(pageOf(mockInstances));
  usePermissionsMock.mockReset().mockReturnValue({ canPerform: () => false, isAdmin: false, loading: false });
  show = vi.spyOn(notifications, 'show').mockImplementation(() => '');
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  show.mockRestore();
});

describe('WorkflowInstancesManager', () => {
  describe('the list', () => {
    it('names the rows in its footer by their number: one instance, three instances', async () => {
      const { unmount } = renderManager();
      expect(await screen.findByText('Showing 3 of 3 instances')).toBeInTheDocument();
      unmount();

      fetchInstancesMock.mockResolvedValue(pageOf(mockInstances.slice(0, 1)));
      renderManager();
      expect(await screen.findByText('Showing 1 of 1 instance')).toBeInTheDocument();
    });

    it('lists the instances with workflow, collection, item, state, version, status and date', async () => {
      renderManager();
      await listed();

      const active = rowOf('42');
      expect(active).toHaveTextContent('Article review');
      expect(active).toHaveTextContent('articles');
      expect(active).toHaveTextContent('Review');
      expect(active).toHaveTextContent('Active');
      expect(active).toHaveTextContent('2026');

      const terminated = rowOf('7');
      expect(terminated).toHaveTextContent('Published');
      expect(terminated).toHaveTextContent('spring-edit');
      expect(terminated).toHaveTextContent('Terminated');

      expect(screen.getByRole('heading', { name: 'Workflow Instances' })).toBeInTheDocument();
      expect(screen.getByTestId('workflow-instances-manager-count')).toHaveTextContent('3 instances');
      expect(fetchInstancesMock).toHaveBeenCalledWith({ page: 1, limit: 25, search: undefined });
    });

    it('shows the marker for a withheld definition, a missing version and a missing date', async () => {
      renderManager();
      await listed();
      const cells = Array.from(rowOf('9f1c').querySelectorAll('td')).map((cell) => cell.textContent);
      // workflow, version and created
      expect(cells.filter((text) => text === '—')).toHaveLength(3);
    });

    it('shows the definition id when the backend answered no name', async () => {
      fetchInstancesMock.mockResolvedValue(
        pageOf([{ ...mockInstances[0], workflow: { id: 'definition-id-1', name: '' } }]),
      );
      renderManager();
      await listed();
      expect(rowOf('42')).toHaveTextContent('definition-id-1');
    });

    it('counts one instance in the singular', async () => {
      fetchInstancesMock.mockResolvedValue(pageOf(mockInstances.slice(0, 1)));
      renderManager();
      const count = await screen.findByTestId('workflow-instances-manager-count');
      await waitFor(() => expect(count).toHaveTextContent('1 instance'));
      expect(count).not.toHaveTextContent('instances');
    });

    it('is read-only: no add button, no row menu, no delete', async () => {
      renderManager({ onInstanceClick: vi.fn() });
      await listed();
      expect(screen.queryByRole('button', { name: /new|add|create/i })).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Row actions')).not.toBeInTheDocument();
      expect(screen.queryByTestId('workflow-delete-confirm-modal')).not.toBeInTheDocument();
    });

    it('hideHeader hides the heading and subtitle', async () => {
      renderManager({ hideHeader: true });
      await listed();
      expect(screen.queryByRole('heading', { name: 'Workflow Instances' })).not.toBeInTheDocument();
    });

    it('searches after the debounce, from page 1', async () => {
      renderManager();
      await listed();

      fireEvent.change(screen.getByTestId('workflow-instances-manager-search'), { target: { value: 'Review' } });
      await waitFor(() =>
        expect(fetchInstancesMock).toHaveBeenLastCalledWith({ page: 1, limit: 25, search: 'Review' }),
      );

      fireEvent.click(screen.getByLabelText('Clear search'));
      await waitFor(() =>
        expect(fetchInstancesMock).toHaveBeenLastCalledWith({ page: 1, limit: 25, search: undefined }),
      );
    });

    it('pages through the list and changes the page size', async () => {
      serve(manyMockInstances(60));
      renderManager();
      await waitFor(() => expect(screen.getByTestId('workflow-instances-manager-count')).toHaveTextContent('60'));

      fireEvent.click(screen.getByRole('button', { name: '3' }));
      await waitFor(() =>
        expect(fetchInstancesMock).toHaveBeenLastCalledWith({ page: 3, limit: 25, search: undefined }),
      );

      fireEvent.click(screen.getByTestId('workflow-instances-manager-page-size'));
      fireEvent.click(await screen.findByRole('option', { name: '50 / page', hidden: true }));
      await waitFor(() =>
        expect(fetchInstancesMock).toHaveBeenLastCalledWith({ page: 1, limit: 50, search: undefined }),
      );
    });

    it('falls back to the last page when the page it asked for no longer exists', async () => {
      serve(manyMockInstances(30));
      window.history.replaceState(null, '', '/?page=5');
      renderManager({ urlParams: true });
      await waitFor(() =>
        expect(fetchInstancesMock).toHaveBeenLastCalledWith({ page: 2, limit: 25, search: undefined }),
      );
      expect(screen.queryByTestId('workflow-instances-manager-empty')).not.toBeInTheDocument();
    });

    it('restores the search from the URL, under its prefix', async () => {
      window.history.replaceState(null, '', '/?wi_search=tickets');
      renderManager({ urlParams: true, urlParamPrefix: 'wi_' });
      await waitFor(() =>
        expect(fetchInstancesMock).toHaveBeenCalledWith({ page: 1, limit: 25, search: 'tickets' }),
      );
    });

    it('reads its strings from the translations prop', async () => {
      renderManager({ translations: { instancesManager: { title: 'Instans Alur Kerja' } } });
      expect(await screen.findByRole('heading', { name: 'Instans Alur Kerja' })).toBeInTheDocument();
    });
  });

  describe('navigation is by callback', () => {
    it('a row click and View Details call onInstanceClick once each, with the instance', async () => {
      const onInstanceClick = vi.fn();
      renderManager({ onInstanceClick });
      await listed();

      fireEvent.click(screen.getByText('42'));
      expect(onInstanceClick).toHaveBeenCalledTimes(1);
      expect(onInstanceClick).toHaveBeenLastCalledWith(mockInstances[0]);

      fireEvent.click(rowOf('7').querySelector('[aria-label="View Details"]') as HTMLElement);
      expect(onInstanceClick).toHaveBeenCalledTimes(2);
      expect(onInstanceClick).toHaveBeenLastCalledWith(mockInstances[1]);
    });

    it('without onInstanceClick there is no View Details button', async () => {
      renderManager();
      await listed();
      expect(screen.queryByLabelText('View Details')).not.toBeInTheDocument();
    });

    it('renders no link at all', async () => {
      const { container } = renderManager({ onInstanceClick: vi.fn() });
      await listed();
      expect(container.querySelector('a[href]')).toBeNull();
    });
  });

  describe('who may see the list is the API\'s answer', () => {
    // WF-30: the reference gated on 'daas_workflow_instances', a name no backend
    // knows, and sent away a user the API serves
    it('a user the API serves gets the list, with no permission check of the page\'s own', async () => {
      renderManager();
      await listed();
      expect(usePermissionsMock).not.toHaveBeenCalled();
      expect(screen.queryByTestId('workflow-instances-manager-access-denied')).not.toBeInTheDocument();
    });

    // WF-29: the API refused the system reader and the page showed "No workflow instances found"
    it('a refused load shows the access-denied state, not an empty list', async () => {
      fetchInstancesMock.mockRejectedValue(
        new DaaSRequestError('Permission denied', { kind: 'forbidden', status: 403 }),
      );
      renderManager();

      const denied = await screen.findByTestId('workflow-instances-manager-access-denied');
      expect(denied).toHaveTextContent('Access denied');
      expect(denied).toHaveTextContent('You do not have permission to view this.');
      expect(screen.queryByTestId('workflow-instances-manager-empty')).not.toBeInTheDocument();
      expect(screen.queryByText(/No workflow instances found/)).not.toBeInTheDocument();
      expect(screen.queryByTestId('workflow-instances-manager-search')).not.toBeInTheDocument();
      // A refusal is not an outage: no error toast
      expect(show).not.toHaveBeenCalled();
    });

    it('a session that needs a second factor is told what the server said', async () => {
      fetchInstancesMock.mockRejectedValue(
        new DaaSRequestError('Multi-factor authentication is required', {
          kind: 'mfaRequired',
          status: 403,
          code: 'MFA_REQUIRED',
        }),
      );
      renderManager();
      expect(await screen.findByTestId('workflow-instances-manager-access-denied')).toHaveTextContent(
        'Multi-factor authentication is required',
      );
    });
  });

  describe('a list without rows says why', () => {
    it('no instances yet', async () => {
      fetchInstancesMock.mockResolvedValue(pageOf([]));
      renderManager();
      const empty = await screen.findByTestId('workflow-instances-manager-empty');
      expect(empty).toHaveTextContent('Instances are created automatically when items enter a workflow.');
      expect(screen.getByTestId('workflow-instances-manager-count')).toHaveTextContent('0 instances');
    });

    it('a search without matches', async () => {
      fetchInstancesMock.mockImplementation(async ({ search }: { search?: string }) =>
        pageOf(search ? [] : mockInstances),
      );
      renderManager();
      await listed();
      fireEvent.change(screen.getByTestId('workflow-instances-manager-search'), { target: { value: 'zzz' } });
      const empty = await screen.findByTestId('workflow-instances-manager-empty');
      expect(empty).toHaveTextContent('No workflow instances match your search.');
    });

    // WF-08: a failed list load looked like "No workflow instances found"
    it('a failed load shows the load-error state and a notification, not an empty list', async () => {
      fetchInstancesMock.mockRejectedValue(
        new DaaSRequestError('service unavailable', { kind: 'failure', status: 500 }),
      );
      renderManager();

      const error = await screen.findByTestId('workflow-instances-manager-load-error');
      expect(error).toHaveTextContent('Failed to load workflow instances — service unavailable');
      expect(error).toHaveAttribute('role', 'alert');
      expect(screen.queryByTestId('workflow-instances-manager-empty')).not.toBeInTheDocument();
      expect(screen.queryByText(/No workflow instances found/)).not.toBeInTheDocument();
      expect(screen.queryByTestId('workflow-instances-manager-count')).not.toBeInTheDocument();
      expect(show).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Failed to load workflow instances',
          message: 'service unavailable',
          color: 'red',
        }),
      );
    });

    // WF-08: an answer that is not a list is a failure too (the hook rejects it)
    it('a failure that is not a typed error is still a load error', async () => {
      fetchInstancesMock.mockRejectedValue(new Error('boom'));
      renderManager();
      expect(await screen.findByTestId('workflow-instances-manager-load-error')).toHaveTextContent('boom');
    });

    it('recovers when a later load succeeds', async () => {
      fetchInstancesMock.mockRejectedValueOnce(new DaaSRequestError('down', { kind: 'failure' }));
      renderManager();
      await screen.findByTestId('workflow-instances-manager-load-error');

      fireEvent.change(screen.getByTestId('workflow-instances-manager-search'), { target: { value: 'a' } });
      await listed();
      expect(screen.queryByTestId('workflow-instances-manager-load-error')).not.toBeInTheDocument();
    });
  });
});
