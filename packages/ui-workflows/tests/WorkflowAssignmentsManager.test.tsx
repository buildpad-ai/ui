/**
 * WorkflowAssignmentsManager unit tests: the list and its gates, the three
 * reasons a list can have no rows (none, refused, failed), and deleting — the
 * page it lands on and the confirm button's pending state. `@buildpad/hooks`
 * is mocked.
 */
import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { WorkflowAssignmentRecord, WorkflowListResult } from '@buildpad/types';
import { DaaSRequestError } from '../../hooks/src/daasRequest';
import { WorkflowAssignmentsManager } from '../src/WorkflowAssignmentsManager';
import { manyMockAssignments, mockAssignments } from '../src/_fixtures';

const { fetchAssignmentsMock, deleteAssignmentMock, usePermissionsMock } = vi.hoisted(() => ({
  fetchAssignmentsMock: vi.fn(),
  deleteAssignmentMock: vi.fn(),
  usePermissionsMock: vi.fn(),
}));

vi.mock('@buildpad/hooks', async () => {
  // The URL-persistence helpers and the typed error are used as they are, so
  // the manager's URL wiring and its error branches are exercised, not stubbed.
  const url = await import('../../hooks/src/useUrlListParams');
  const request = await import('../../hooks/src/daasRequest');
  return {
    useUrlListParams: url.useUrlListParams,
    useHydrated: url.useHydrated,
    readUrlParam: url.readUrlParam,
    readUrlIntParam: url.readUrlIntParam,
    DaaSRequestError: request.DaaSRequestError,
    useWorkflowAssignments: () => ({
      fetchAssignments: fetchAssignmentsMock,
      deleteAssignment: deleteAssignmentMock,
    }),
    usePermissions: usePermissionsMock,
  };
});

/** One page of `all`, as the hook answers it. */
function pageOf(
  all: WorkflowAssignmentRecord[],
  { page = 1, limit = 25 }: { page?: number; limit?: number } = {},
): WorkflowListResult<WorkflowAssignmentRecord> {
  return {
    items: all.slice((page - 1) * limit, page * limit),
    total: all.length,
    totalPages: Math.max(1, Math.ceil(all.length / limit)),
    page,
    limit,
  };
}

/** Serves `store.rows` page by page, so a delete that shrinks it is seen by the next load. */
function serve(store: { rows: WorkflowAssignmentRecord[] }) {
  fetchAssignmentsMock.mockImplementation(async (params: { page?: number; limit?: number }) =>
    pageOf(store.rows, params),
  );
  deleteAssignmentMock.mockImplementation(async (id: string) => {
    store.rows = store.rows.filter((a) => a.id !== id);
  });
}

function renderManager(props: Partial<React.ComponentProps<typeof WorkflowAssignmentsManager>> = {}) {
  return render(
    <MantineProvider>
      <WorkflowAssignmentsManager urlParams={false} {...props} />
    </MantineProvider>,
  );
}

function grant(actions: string[], isAdmin = false) {
  usePermissionsMock.mockReturnValue({
    canPerform: (_collection: string, action: string) => actions.includes(action),
    isAdmin,
    loading: false,
  });
}

const rowOf = (collection: string) => screen.getByText(collection).closest('tr') as HTMLElement;

async function openDeleteFor(collection: string) {
  await waitFor(() => expect(screen.getByText(collection)).toBeInTheDocument());
  fireEvent.click(rowOf(collection).querySelector('[aria-label="Row actions"]') as HTMLElement);
  fireEvent.click(await screen.findByText('Delete'));
  return screen.findByTestId('workflow-delete-confirm-btn');
}

let show: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  fetchAssignmentsMock.mockReset().mockResolvedValue(pageOf(mockAssignments));
  deleteAssignmentMock.mockReset().mockResolvedValue(undefined);
  usePermissionsMock.mockReset();
  grant([], true);
  show = vi.spyOn(notifications, 'show').mockImplementation(() => '');
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  show.mockRestore();
});

describe('WorkflowAssignmentsManager', () => {
  describe('the list', () => {
    it('names the rows in its footer by their number: one assignment, three assignments', async () => {
      const { unmount } = renderManager();
      expect(await screen.findByText('Showing 3 of 3 assignments')).toBeInTheDocument();
      unmount();

      fetchAssignmentsMock.mockResolvedValue(pageOf(mockAssignments.slice(0, 1)));
      renderManager();
      expect(await screen.findByText('Showing 1 of 1 assignment')).toBeInTheDocument();
      expect(screen.getByTestId('workflow-assignments-manager-count')).toHaveTextContent('1 assignment');
    });

    it('lists the assignments with their workflow, filter indicator and creation date', async () => {
      renderManager();
      await waitFor(() => expect(screen.getByText('articles')).toBeInTheDocument());

      expect(rowOf('articles')).toHaveTextContent('Article review');
      expect(rowOf('articles')).toHaveTextContent('Has filter');
      expect(rowOf('articles')).toHaveTextContent('2026');
      expect(rowOf('tickets')).toHaveTextContent('Support ticket');
      expect(rowOf('tickets')).toHaveTextContent('No filter');

      expect(screen.getByRole('heading', { name: 'Workflow Assignments' })).toBeInTheDocument();
      expect(screen.getByTestId('workflow-assignments-manager-count')).toHaveTextContent('3 assignments');
      expect(fetchAssignmentsMock).toHaveBeenCalledWith({ page: 1, limit: 25, search: undefined });
    });

    it('shows the workflow id when the definition is withheld, and the marker for a missing date', async () => {
      renderManager();
      await waitFor(() => expect(screen.getByText('pages')).toBeInTheDocument());
      expect(rowOf('pages')).toHaveTextContent(mockAssignments[2].workflow);
      expect(rowOf('pages')).toHaveTextContent('—');
    });

    it('a filter rule the grant withholds is not reported as "No filter"', async () => {
      const { filter_rule: _withheld, ...withoutRule } = mockAssignments[0];
      fetchAssignmentsMock.mockResolvedValue(pageOf([withoutRule]));
      renderManager();
      await waitFor(() => expect(screen.getByText('articles')).toBeInTheDocument());
      expect(rowOf('articles')).not.toHaveTextContent('No filter');
      expect(rowOf('articles')).not.toHaveTextContent('Has filter');
    });

    it('counts one assignment in the singular', async () => {
      fetchAssignmentsMock.mockResolvedValue(pageOf(mockAssignments.slice(0, 1)));
      renderManager();
      const count = await screen.findByTestId('workflow-assignments-manager-count');
      await waitFor(() => expect(count).toHaveTextContent('1 assignment'));
      expect(count).not.toHaveTextContent('assignments');
    });

    it('hideHeader hides the heading and subtitle but keeps the New Assignment button', async () => {
      renderManager({ hideHeader: true, onCreateAssignment: vi.fn() });
      await waitFor(() => expect(fetchAssignmentsMock).toHaveBeenCalled());
      expect(screen.queryByRole('heading', { name: 'Workflow Assignments' })).not.toBeInTheDocument();
      expect(screen.getByTestId('workflow-assignments-manager-add-btn')).toBeInTheDocument();
    });

    it('searches after the debounce, from page 1', async () => {
      renderManager();
      await waitFor(() => expect(screen.getByText('articles')).toBeInTheDocument());

      fireEvent.change(screen.getByTestId('workflow-assignments-manager-search'), { target: { value: 'tick' } });
      await waitFor(() =>
        expect(fetchAssignmentsMock).toHaveBeenLastCalledWith({ page: 1, limit: 25, search: 'tick' }),
      );

      fireEvent.click(screen.getByLabelText('Clear search'));
      await waitFor(() =>
        expect(fetchAssignmentsMock).toHaveBeenLastCalledWith({ page: 1, limit: 25, search: undefined }),
      );
    });

    it('hands the typed text to the data layer as it was typed', async () => {
      renderManager();
      await waitFor(() => expect(screen.getByText('articles')).toBeInTheDocument());

      // Characters a pattern match or a filter string would read as syntax
      const typed = '50%_off, (a.b) *';
      fireEvent.change(screen.getByTestId('workflow-assignments-manager-search'), { target: { value: typed } });
      await waitFor(() =>
        expect(fetchAssignmentsMock).toHaveBeenLastCalledWith({ page: 1, limit: 25, search: typed }),
      );
    });

    it('changing the page size refetches with the new limit at page 1', async () => {
      renderManager();
      await waitFor(() => expect(screen.getByText('articles')).toBeInTheDocument());

      fireEvent.click(screen.getByTestId('workflow-assignments-manager-page-size'));
      // hidden: true — the dropdown stays display:none in jsdom (no transitions).
      fireEvent.click(await screen.findByRole('option', { name: '50 / page', hidden: true }));

      await waitFor(() =>
        expect(fetchAssignmentsMock).toHaveBeenLastCalledWith(expect.objectContaining({ limit: 50, page: 1 })),
      );
    });

    it('reads its strings from the translations prop', async () => {
      renderManager({ translations: { assignmentsManager: { title: 'Penugasan Alur Kerja' } } });
      expect(await screen.findByRole('heading', { name: 'Penugasan Alur Kerja' })).toBeInTheDocument();
    });
  });

  describe('URL state', () => {
    it('restores the page and the search from the URL', async () => {
      serve({ rows: manyMockAssignments(60) });
      window.history.replaceState(null, '', '/?page=2&search=collection');
      renderManager({ urlParams: true });

      await waitFor(() =>
        expect(fetchAssignmentsMock).toHaveBeenCalledWith({ page: 2, limit: 25, search: 'collection' }),
      );
      expect((screen.getByTestId('workflow-assignments-manager-search') as HTMLInputElement).value).toBe(
        'collection',
      );
    });

    it('prefixes its parameters when two lists share a page', async () => {
      serve({ rows: manyMockAssignments(60) });
      window.history.replaceState(null, '', '/?wa_page=3');
      renderManager({ urlParams: true, urlParamPrefix: 'wa_' });
      await waitFor(() =>
        expect(fetchAssignmentsMock).toHaveBeenCalledWith({ page: 3, limit: 25, search: undefined }),
      );
    });
  });

  describe('navigation is by callback', () => {
    it('a row click and the menu\'s Edit call onAssignmentClick with the assignment', async () => {
      const onAssignmentClick = vi.fn();
      renderManager({ onAssignmentClick });
      await waitFor(() => expect(screen.getByText('articles')).toBeInTheDocument());

      fireEvent.click(screen.getByText('articles'));
      expect(onAssignmentClick).toHaveBeenCalledWith(mockAssignments[0]);

      fireEvent.click(rowOf('tickets').querySelector('[aria-label="Row actions"]') as HTMLElement);
      // The menu items say which row they act on
      await screen.findByText('Edit');
      expect(screen.getByLabelText('Delete assignment for tickets')).toHaveTextContent('Delete');
      fireEvent.click(screen.getByLabelText('Edit assignment for tickets'));
      expect(onAssignmentClick).toHaveBeenLastCalledWith(mockAssignments[1]);
      expect(onAssignmentClick).toHaveBeenCalledTimes(2);
    });

    it('New Assignment calls onCreateAssignment', async () => {
      const onCreateAssignment = vi.fn();
      renderManager({ onCreateAssignment });
      fireEvent.click(await screen.findByTestId('workflow-assignments-manager-add-btn'));
      expect(onCreateAssignment).toHaveBeenCalledTimes(1);
    });

    it('renders no link at all', async () => {
      const { container } = renderManager({ onAssignmentClick: vi.fn(), onCreateAssignment: vi.fn() });
      await waitFor(() => expect(screen.getByText('articles')).toBeInTheDocument());
      expect(container.querySelector('a[href]')).toBeNull();
    });
  });

  describe('permission gates', () => {
    // WF-29, WF-30: the reference gated on 'daas_workflow_assignments', a name no backend knows
    it('checks permissions on the collection the API enforces', async () => {
      renderManager();
      await waitFor(() => expect(fetchAssignmentsMock).toHaveBeenCalled());
      expect(usePermissionsMock).toHaveBeenCalledWith({ collections: ['daas_wf_assignment'] });
      expect(usePermissionsMock).not.toHaveBeenCalledWith({ collections: ['daas_workflow_assignments'] });
    });

    it('the gated collection can be overridden', async () => {
      const canPerform = vi.fn(() => true);
      usePermissionsMock.mockReturnValue({ canPerform, isAdmin: false, loading: false });
      renderManager({ assignmentsCollection: 'my_assignments', onCreateAssignment: vi.fn() });
      await waitFor(() => expect(fetchAssignmentsMock).toHaveBeenCalled());
      expect(usePermissionsMock).toHaveBeenCalledWith({ collections: ['my_assignments'] });
      expect(canPerform).toHaveBeenCalledWith('my_assignments', 'create');
    });

    // WF-30: a user the API serves gets the list, whatever else they lack
    it('a reader gets the list and can open a row, but gets no New button and no row menu', async () => {
      grant(['read']);
      const onAssignmentClick = vi.fn();
      renderManager({ onAssignmentClick, onCreateAssignment: vi.fn() });
      await waitFor(() => expect(screen.getByText('articles')).toBeInTheDocument());

      expect(screen.queryByTestId('workflow-assignments-manager-add-btn')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Row actions')).not.toBeInTheDocument();
      fireEvent.click(screen.getByText('articles'));
      expect(onAssignmentClick).toHaveBeenCalledWith(mockAssignments[0]);
    });

    it('update without delete offers Edit only; delete without update offers Delete only', async () => {
      grant(['read', 'update']);
      const { unmount } = renderManager({ onAssignmentClick: vi.fn() });
      await waitFor(() => expect(screen.getByText('articles')).toBeInTheDocument());
      fireEvent.click(screen.getAllByLabelText('Row actions')[0]);
      expect(await screen.findByText('Edit')).toBeInTheDocument();
      expect(screen.queryByText('Delete')).not.toBeInTheDocument();
      unmount();

      grant(['read', 'delete']);
      renderManager({ onAssignmentClick: vi.fn() });
      await waitFor(() => expect(screen.getByText('articles')).toBeInTheDocument());
      fireEvent.click(screen.getAllByLabelText('Row actions')[0]);
      expect(await screen.findByText('Delete')).toBeInTheDocument();
      expect(screen.queryByText('Edit')).not.toBeInTheDocument();
    });

    it('draws no write control while permissions load, and the allowed ones once they are known', async () => {
      // What a user who will turn out to be an administrator gets meanwhile
      usePermissionsMock.mockReturnValue({ canPerform: () => true, isAdmin: true, loading: true });
      const onAssignmentClick = vi.fn();
      const view = renderManager({ onAssignmentClick, onCreateAssignment: vi.fn() });
      await waitFor(() => expect(screen.getByText('articles')).toBeInTheDocument());

      expect(screen.queryByTestId('workflow-assignments-manager-add-btn')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Row actions')).not.toBeInTheDocument();
      // Reading does not wait: the rows are there, counted, and open
      expect(screen.getByTestId('workflow-assignments-manager-count')).toHaveTextContent('3 assignments');
      fireEvent.click(screen.getByText('articles'));
      expect(onAssignmentClick).toHaveBeenCalledWith(mockAssignments[0]);

      grant([], true);
      view.rerender(
        <MantineProvider>
          <WorkflowAssignmentsManager
            urlParams={false}
            onAssignmentClick={onAssignmentClick}
            onCreateAssignment={vi.fn()}
          />
        </MantineProvider>,
      );
      expect(await screen.findByTestId('workflow-assignments-manager-add-btn')).toBeInTheDocument();
      expect(screen.getAllByLabelText('Row actions')).toHaveLength(3);
      // The list was loaded once: the permissions arriving do not fetch it again
      expect(fetchAssignmentsMock).toHaveBeenCalledTimes(1);
    });

    it('a reader is never shown a write control, not even while permissions load', async () => {
      usePermissionsMock.mockReturnValue({ canPerform: () => false, isAdmin: false, loading: true });
      const view = renderManager({ onAssignmentClick: vi.fn(), onCreateAssignment: vi.fn() });
      await waitFor(() => expect(screen.getByText('articles')).toBeInTheDocument());
      expect(screen.queryByTestId('workflow-assignments-manager-add-btn')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Row actions')).not.toBeInTheDocument();

      grant(['read']);
      view.rerender(
        <MantineProvider>
          <WorkflowAssignmentsManager urlParams={false} onAssignmentClick={vi.fn()} onCreateAssignment={vi.fn()} />
        </MantineProvider>,
      );
      expect(screen.getByText('articles')).toBeInTheDocument();
      expect(screen.queryByTestId('workflow-assignments-manager-add-btn')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Row actions')).not.toBeInTheDocument();
    });

    it('a later refresh of the permissions does not take the controls away meanwhile', async () => {
      const view = renderManager({ onAssignmentClick: vi.fn(), onCreateAssignment: vi.fn() });
      await waitFor(() => expect(screen.getByText('articles')).toBeInTheDocument());
      expect(screen.getByTestId('workflow-assignments-manager-add-btn')).toBeInTheDocument();

      // The hook loads again (a renewed token, another scope) and answers from what it knew meanwhile
      usePermissionsMock.mockReturnValue({ canPerform: () => true, isAdmin: true, loading: true });
      view.rerender(
        <MantineProvider>
          <WorkflowAssignmentsManager urlParams={false} onAssignmentClick={vi.fn()} onCreateAssignment={vi.fn()} />
        </MantineProvider>,
      );
      expect(screen.getByTestId('workflow-assignments-manager-add-btn')).toBeInTheDocument();
      expect(screen.getAllByLabelText('Row actions')).toHaveLength(3);
    });
  });

  describe('a list without rows says why', () => {
    it('no assignments yet', async () => {
      fetchAssignmentsMock.mockResolvedValue(pageOf([]));
      renderManager();
      const empty = await screen.findByTestId('workflow-assignments-manager-empty');
      expect(empty).toHaveTextContent('Create your first assignment to link a workflow with a collection.');
      expect(screen.getByTestId('workflow-assignments-manager-count')).toHaveTextContent('0 assignments');
    });

    it('a search without matches', async () => {
      fetchAssignmentsMock.mockImplementation(async ({ search }: { search?: string }) =>
        pageOf(search ? [] : mockAssignments),
      );
      renderManager();
      await waitFor(() => expect(screen.getByText('articles')).toBeInTheDocument());
      fireEvent.change(screen.getByTestId('workflow-assignments-manager-search'), { target: { value: 'zzz' } });
      const empty = await screen.findByTestId('workflow-assignments-manager-empty');
      expect(empty).toHaveTextContent('No workflow assignments match your search.');
      expect(empty).not.toHaveTextContent('Create your first assignment');
    });

    it('a failed load shows the load-error state and a notification, not an empty list', async () => {
      fetchAssignmentsMock.mockRejectedValue(
        new DaaSRequestError('service unavailable', { kind: 'failure', status: 500 }),
      );
      renderManager();

      const error = await screen.findByTestId('workflow-assignments-manager-load-error');
      expect(error).toHaveTextContent('Failed to load workflow assignments — service unavailable');
      expect(screen.queryByTestId('workflow-assignments-manager-empty')).not.toBeInTheDocument();
      expect(screen.queryByTestId('workflow-assignments-manager-count')).not.toBeInTheDocument();
      expect(show).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Failed to load workflow assignments', color: 'red' }),
      );
    });

    it('a failure that is not a typed error is still a load error', async () => {
      fetchAssignmentsMock.mockRejectedValue('nope');
      renderManager();
      expect(await screen.findByTestId('workflow-assignments-manager-load-error')).toHaveTextContent(
        'Failed to load workflow assignments — Failed to load workflow assignments',
      );
    });

    // WF-29: the API refused the system reader and the page showed "No workflow assignments found"
    it('a refused load shows the access-denied state', async () => {
      fetchAssignmentsMock.mockRejectedValue(
        new DaaSRequestError('Permission denied', { kind: 'forbidden', status: 403 }),
      );
      renderManager({ onCreateAssignment: vi.fn() });

      const denied = await screen.findByTestId('workflow-assignments-manager-access-denied');
      expect(denied).toHaveTextContent('Access denied');
      expect(denied).toHaveTextContent('You do not have permission to view this.');
      expect(screen.queryByTestId('workflow-assignments-manager-empty')).not.toBeInTheDocument();
      expect(screen.queryByTestId('workflow-assignments-manager-search')).not.toBeInTheDocument();
      // A refusal is not an outage: no error toast
      expect(show).not.toHaveBeenCalled();
    });

    it('a session that needs a second factor is told what the server said', async () => {
      fetchAssignmentsMock.mockRejectedValue(
        new DaaSRequestError('Multi-factor authentication is required', {
          kind: 'mfaRequired',
          status: 403,
          code: 'MFA_REQUIRED',
        }),
      );
      renderManager();
      expect(await screen.findByTestId('workflow-assignments-manager-access-denied')).toHaveTextContent(
        'Multi-factor authentication is required',
      );
    });

    it('recovers when a later load succeeds', async () => {
      fetchAssignmentsMock.mockRejectedValueOnce(new DaaSRequestError('down', { kind: 'failure' }));
      renderManager();
      await screen.findByTestId('workflow-assignments-manager-load-error');

      fireEvent.change(screen.getByTestId('workflow-assignments-manager-search'), { target: { value: 'a' } });
      await waitFor(() => expect(screen.getByText('articles')).toBeInTheDocument());
      expect(screen.queryByTestId('workflow-assignments-manager-load-error')).not.toBeInTheDocument();
    });

    it('draws only the answer to the latest search', async () => {
      let answerFirst: (value: WorkflowListResult<WorkflowAssignmentRecord>) => void = () => {};
      fetchAssignmentsMock.mockImplementation(({ search }: { search?: string }) => {
        if (search === 'slow') {
          return new Promise((resolve) => {
            answerFirst = resolve;
          });
        }
        return Promise.resolve(pageOf(search === 'fast' ? mockAssignments.slice(1, 2) : mockAssignments));
      });
      renderManager();
      await waitFor(() => expect(screen.getByText('articles')).toBeInTheDocument());

      const box = screen.getByTestId('workflow-assignments-manager-search');
      fireEvent.change(box, { target: { value: 'slow' } });
      await waitFor(() => expect(fetchAssignmentsMock).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'slow' })));
      fireEvent.change(box, { target: { value: 'fast' } });
      await waitFor(() => expect(screen.queryByText('articles')).not.toBeInTheDocument());

      // The slow answer arrives after the fast one and is dropped
      await act(async () => {
        answerFirst(pageOf(mockAssignments.slice(0, 1)));
      });
      expect(screen.queryByText('articles')).not.toBeInTheDocument();
      expect(screen.getByText('tickets')).toBeInTheDocument();
    });
  });

  describe('deleting', () => {
    it('asks about the collection by name, deletes, says so, and reloads the page', async () => {
      const store = { rows: [...mockAssignments] };
      serve(store);
      renderManager();

      const confirm = await openDeleteFor('tickets');
      const dialog = screen.getByTestId('workflow-delete-confirm-modal');
      expect(within(dialog).getByText('Delete Workflow Assignment')).toBeInTheDocument();
      expect(within(dialog).getByText('tickets').tagName).toBe('STRONG');
      fireEvent.click(confirm);

      await waitFor(() => expect(screen.queryByTestId('workflow-delete-confirm-btn')).not.toBeInTheDocument());
      expect(deleteAssignmentMock).toHaveBeenCalledWith(mockAssignments[1].id);
      expect(show).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Workflow assignment deleted successfully', color: 'green' }),
      );
      await waitFor(() =>
        expect(screen.getByTestId('workflow-assignments-manager-count')).toHaveTextContent('2 assignments'),
      );
      expect(screen.queryByText('tickets')).not.toBeInTheDocument();
    });

    // WF-01: deleting the only row of the last page left "No workflow assignments found" and no pager
    it('deleting the only row of the last page loads the page before it', async () => {
      const store = { rows: manyMockAssignments(26) };
      serve(store);
      window.history.replaceState(null, '', '/?page=2');
      renderManager({ urlParams: true });

      // Page 2 holds the 26th assignment alone
      fireEvent.click(await openDeleteFor('collection_26'));

      await waitFor(() => expect(screen.getByText('collection_25')).toBeInTheDocument());
      expect(fetchAssignmentsMock).toHaveBeenLastCalledWith({ page: 1, limit: 25, search: undefined });
      // The emptied page 2 is never asked for again
      const afterDelete = fetchAssignmentsMock.mock.calls.slice(1);
      expect(afterDelete.every(([params]) => params.page === 1)).toBe(true);
      expect(screen.queryByTestId('workflow-assignments-manager-empty')).not.toBeInTheDocument();
      expect(screen.getByTestId('workflow-assignments-manager-count')).toHaveTextContent('25 assignments');
      await waitFor(() => expect(window.location.search).toBe(''));
    });

    it('deleting one of several rows of the last page stays on that page', async () => {
      const store = { rows: manyMockAssignments(27) };
      serve(store);
      window.history.replaceState(null, '', '/?page=2');
      renderManager({ urlParams: true });

      fireEvent.click(await openDeleteFor('collection_27'));

      await waitFor(() => expect(screen.queryByText('collection_27')).not.toBeInTheDocument());
      expect(screen.getByText('collection_26')).toBeInTheDocument();
      expect(fetchAssignmentsMock).toHaveBeenLastCalledWith({ page: 2, limit: 25, search: undefined });
    });

    it('falls back to the last page when the page it asked for no longer exists', async () => {
      // Someone else deleted rows: page 3 of a list that now has 2 pages
      serve({ rows: manyMockAssignments(30) });
      window.history.replaceState(null, '', '/?page=3');
      renderManager({ urlParams: true });

      await waitFor(() => expect(screen.getByText('collection_30')).toBeInTheDocument());
      expect(fetchAssignmentsMock).toHaveBeenLastCalledWith({ page: 2, limit: 25, search: undefined });
      expect(screen.queryByTestId('workflow-assignments-manager-empty')).not.toBeInTheDocument();
    });

    // The reference's confirm closed on the click; nothing showed the request was out
    it('a double click on the confirm button sends one delete, and the button is pending meanwhile', async () => {
      let finish: () => void = () => {};
      deleteAssignmentMock.mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          }),
      );
      renderManager();

      const confirm = await openDeleteFor('articles');
      fireEvent.click(confirm);
      fireEvent.click(confirm);
      fireEvent.click(confirm);

      expect(deleteAssignmentMock).toHaveBeenCalledTimes(1);
      expect(confirm).toBeDisabled();
      expect(confirm).toHaveAttribute('data-loading', 'true');
      // Nor can the dialog be dismissed while the request is out
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();

      await act(async () => {
        finish();
      });
      await waitFor(() => expect(screen.queryByTestId('workflow-delete-confirm-btn')).not.toBeInTheDocument());
      expect(deleteAssignmentMock).toHaveBeenCalledTimes(1);
    });

    it('a refused delete is a notification with the server\'s sentence, and the dialog stays open', async () => {
      deleteAssignmentMock.mockRejectedValue(
        new DaaSRequestError('Permission denied', { kind: 'forbidden', status: 403 }),
      );
      renderManager();

      fireEvent.click(await openDeleteFor('articles'));

      await waitFor(() =>
        expect(show).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Failed to delete workflow assignment',
            message: 'Permission denied',
            color: 'red',
          }),
        ),
      );
      expect(screen.getByTestId('workflow-delete-confirm-modal')).toBeInTheDocument();
      // The button is ready for another try
      await waitFor(() => expect(screen.getByTestId('workflow-delete-confirm-btn')).not.toBeDisabled());
      expect(screen.getByText('Article review')).toBeInTheDocument();
    });

    it('a delete that fails without a sentence uses the dictionary\'s', async () => {
      deleteAssignmentMock.mockRejectedValue('nope');
      renderManager();
      fireEvent.click(await openDeleteFor('articles'));
      await waitFor(() =>
        expect(show).toHaveBeenCalledWith(
          expect.objectContaining({ message: 'Failed to delete workflow assignment', color: 'red' }),
        ),
      );
    });

    it('Cancel closes the dialog without deleting', async () => {
      renderManager();
      await openDeleteFor('articles');
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      await waitFor(() => expect(screen.queryByTestId('workflow-delete-confirm-btn')).not.toBeInTheDocument());
      expect(deleteAssignmentMock).not.toHaveBeenCalled();
    });
  });
});
