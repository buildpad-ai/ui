/**
 * WorkflowsManager unit tests: the list and its gates, the three reasons a
 * list can have no rows (none, refused, failed), and deleting — the page it
 * lands on and the confirm button's pending state. `@buildpad/hooks` is mocked.
 */
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { WorkflowDefinitionRecord, WorkflowListResult } from '@buildpad/types';
import { DaaSRequestError } from '../../hooks/src/daasRequest';
import { WorkflowsManager } from '../src/WorkflowsManager';
import { manyMockWorkflows, mockWorkflows } from '../src/_fixtures';

const { fetchDefinitionsMock, deleteDefinitionMock, usePermissionsMock } = vi.hoisted(() => ({
  fetchDefinitionsMock: vi.fn(),
  deleteDefinitionMock: vi.fn(),
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
    useWorkflowDefinitions: () => ({
      fetchDefinitions: fetchDefinitionsMock,
      deleteDefinition: deleteDefinitionMock,
    }),
    usePermissions: usePermissionsMock,
  };
});

/** One page of `all`, as the hook answers it. */
function pageOf(
  all: WorkflowDefinitionRecord[],
  { page = 1, limit = 25 }: { page?: number; limit?: number } = {},
): WorkflowListResult<WorkflowDefinitionRecord> {
  return {
    items: all.slice((page - 1) * limit, page * limit),
    total: all.length,
    totalPages: Math.max(1, Math.ceil(all.length / limit)),
    page,
    limit,
  };
}

/** Serves `store.rows` page by page, so a delete that shrinks it is seen by the next load. */
function serve(store: { rows: WorkflowDefinitionRecord[] }) {
  fetchDefinitionsMock.mockImplementation(async (params: { page?: number; limit?: number }) =>
    pageOf(store.rows, params),
  );
}

function renderManager(props: Partial<React.ComponentProps<typeof WorkflowsManager>> = {}) {
  return render(
    <MantineProvider>
      <WorkflowsManager urlParams={false} {...props} />
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

async function openDeleteFor(name: string) {
  await waitFor(() => expect(screen.getByText(name)).toBeInTheDocument());
  const row = screen.getByText(name).closest('tr') as HTMLElement;
  fireEvent.click(row.querySelector('[aria-label="Row actions"]') as HTMLElement);
  fireEvent.click(await screen.findByText('Delete'));
  return screen.findByTestId('workflow-delete-confirm-btn');
}

let show: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  fetchDefinitionsMock.mockReset().mockResolvedValue(pageOf(mockWorkflows));
  deleteDefinitionMock.mockReset().mockResolvedValue(undefined);
  usePermissionsMock.mockReset();
  grant([], true);
  show = vi.spyOn(notifications, 'show').mockImplementation(() => '');
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  show.mockRestore();
});

describe('WorkflowsManager', () => {
  describe('the list', () => {
    it('lists the definitions with their initial state, number of states and description', async () => {
      renderManager();
      await waitFor(() => expect(screen.getByText('Article review')).toBeInTheDocument());

      const row = screen.getByText('Article review').closest('tr') as HTMLElement;
      expect(row).toHaveTextContent('Draft');
      expect(row).toHaveTextContent('3');
      expect(row).toHaveTextContent('Editors submit, reviewers approve or send back, publishers release.');
      // A definition without a description shows the marker
      expect(screen.getByText('Support ticket').closest('tr')).toHaveTextContent('-');

      expect(screen.getByRole('heading', { name: 'Workflow Definitions' })).toBeInTheDocument();
      expect(screen.getByTestId('workflows-manager-count')).toHaveTextContent('3 workflows');
      expect(fetchDefinitionsMock).toHaveBeenCalledWith({ page: 1, limit: 25, search: undefined });
    });

    it('marks the states of a definition answered without its document, instead of counting 0', async () => {
      // Both backends drop a column the caller's read grant withholds
      const { workflow_json: _withheld, ...bare } = mockWorkflows[0];
      fetchDefinitionsMock.mockResolvedValue(pageOf([bare, { ...mockWorkflows[1], workflow_json: { initial_state: '', states: [] } }]));
      renderManager();
      await waitFor(() => expect(screen.getByText('Article review')).toBeInTheDocument());

      const cells = (name: string) =>
        Array.from((screen.getByText(name).closest('tr') as HTMLElement).querySelectorAll('td')).map(
          (cell) => cell.textContent,
        );
      // name, initial state, states, description
      expect(cells('Article review').slice(1, 4)).toEqual(['Article review', '-', '-']);
      expect(cells('Support ticket').slice(1, 4)).toEqual(['Support ticket', '-', '0']);
    });

    it('counts one workflow in the singular', async () => {
      fetchDefinitionsMock.mockResolvedValue(pageOf(mockWorkflows.slice(0, 1)));
      renderManager();
      await waitFor(() => expect(screen.getByTestId('workflows-manager-count')).toHaveTextContent('1 workflow'));
      expect(screen.getByTestId('workflows-manager-count')).not.toHaveTextContent('workflows');
    });

    it('checks permissions on the collection the API enforces', async () => {
      renderManager();
      await waitFor(() => expect(fetchDefinitionsMock).toHaveBeenCalled());
      expect(usePermissionsMock).toHaveBeenCalledWith({ collections: ['daas_wf_definition'] });
    });

    it('hideHeader hides the heading and subtitle but keeps the Add button', async () => {
      renderManager({ hideHeader: true, onCreateWorkflow: vi.fn() });
      await waitFor(() => expect(fetchDefinitionsMock).toHaveBeenCalled());
      expect(screen.queryByRole('heading', { name: 'Workflow Definitions' })).not.toBeInTheDocument();
      expect(screen.getByTestId('workflows-manager-add-btn')).toBeInTheDocument();
    });

    it('searches after the debounce, from page 1', async () => {
      renderManager();
      await waitFor(() => expect(screen.getByText('Article review')).toBeInTheDocument());

      fireEvent.change(screen.getByTestId('workflows-manager-search'), { target: { value: 'ticket' } });
      await waitFor(() =>
        expect(fetchDefinitionsMock).toHaveBeenLastCalledWith({ page: 1, limit: 25, search: 'ticket' }),
      );

      // The clear affordance searches for everything again
      fireEvent.click(screen.getByLabelText('Clear search'));
      await waitFor(() =>
        expect(fetchDefinitionsMock).toHaveBeenLastCalledWith({ page: 1, limit: 25, search: undefined }),
      );
    });

    it('changing the page size refetches with the new limit at page 1', async () => {
      renderManager();
      await waitFor(() => expect(screen.getByText('Article review')).toBeInTheDocument());

      fireEvent.click(screen.getByTestId('workflows-manager-page-size'));
      // hidden: true — the dropdown stays display:none in jsdom (no transitions).
      fireEvent.click(await screen.findByRole('option', { name: '50 / page', hidden: true }));

      await waitFor(() =>
        expect(fetchDefinitionsMock).toHaveBeenLastCalledWith(expect.objectContaining({ limit: 50, page: 1 })),
      );
    });

    it('reads its strings from the translations prop', async () => {
      renderManager({ translations: { workflowsManager: { title: 'Definisi Alur Kerja' } } });
      expect(await screen.findByRole('heading', { name: 'Definisi Alur Kerja' })).toBeInTheDocument();
    });
  });

  describe('URL state', () => {
    it('restores the page and the search from the URL, and writes them back', async () => {
      const store = { rows: manyMockWorkflows(60) };
      serve(store);
      window.history.replaceState(null, '', '/?page=2&search=Workflow');
      renderManager({ urlParams: true });

      await waitFor(() =>
        expect(fetchDefinitionsMock).toHaveBeenCalledWith({ page: 2, limit: 25, search: 'Workflow' }),
      );
      expect((screen.getByTestId('workflows-manager-search') as HTMLInputElement).value).toBe('Workflow');
    });

    it('prefixes its parameters when two lists share a page', async () => {
      const store = { rows: manyMockWorkflows(60) };
      serve(store);
      window.history.replaceState(null, '', '/?wf_page=3');
      renderManager({ urlParams: true, urlParamPrefix: 'wf_' });
      await waitFor(() =>
        expect(fetchDefinitionsMock).toHaveBeenCalledWith({ page: 3, limit: 25, search: undefined }),
      );
    });
  });

  describe('navigation is by callback', () => {
    it('a row click and the menu\'s Edit call onWorkflowClick with the definition', async () => {
      const onWorkflowClick = vi.fn();
      renderManager({ onWorkflowClick });
      await waitFor(() => expect(screen.getByText('Article review')).toBeInTheDocument());

      fireEvent.click(screen.getByText('Article review'));
      expect(onWorkflowClick).toHaveBeenCalledWith(mockWorkflows[0]);

      const row = screen.getByText('Support ticket').closest('tr') as HTMLElement;
      fireEvent.click(row.querySelector('[aria-label="Row actions"]') as HTMLElement);
      fireEvent.click(await screen.findByText('Edit'));
      expect(onWorkflowClick).toHaveBeenLastCalledWith(mockWorkflows[1]);
      expect(onWorkflowClick).toHaveBeenCalledTimes(2);
    });

    it('Add Workflow calls onCreateWorkflow', async () => {
      const onCreateWorkflow = vi.fn();
      renderManager({ onCreateWorkflow });
      fireEvent.click(await screen.findByTestId('workflows-manager-add-btn'));
      expect(onCreateWorkflow).toHaveBeenCalledTimes(1);
    });

    // WF-22: the reference's links dropped the locale; a module has no links to get wrong
    it('renders no link at all', async () => {
      const { container } = renderManager({ onWorkflowClick: vi.fn(), onCreateWorkflow: vi.fn() });
      await waitFor(() => expect(screen.getByText('Article review')).toBeInTheDocument());
      expect(container.querySelector('a[href]')).toBeNull();
    });
  });

  describe('permission gates', () => {
    it('a reader gets the list and can open a row, but gets no Add button and no row menu', async () => {
      grant(['read']);
      const onWorkflowClick = vi.fn();
      renderManager({ onWorkflowClick, onCreateWorkflow: vi.fn() });
      await waitFor(() => expect(screen.getByText('Article review')).toBeInTheDocument());

      expect(screen.queryByTestId('workflows-manager-add-btn')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Row actions')).not.toBeInTheDocument();
      fireEvent.click(screen.getByText('Article review'));
      expect(onWorkflowClick).toHaveBeenCalledWith(mockWorkflows[0]);
    });

    it('update without delete offers Edit only; delete without update offers Delete only', async () => {
      grant(['read', 'update']);
      const { unmount } = renderManager({ onWorkflowClick: vi.fn() });
      await waitFor(() => expect(screen.getByText('Article review')).toBeInTheDocument());
      fireEvent.click(screen.getAllByLabelText('Row actions')[0]);
      expect(await screen.findByText('Edit')).toBeInTheDocument();
      expect(screen.queryByText('Delete')).not.toBeInTheDocument();
      unmount();

      grant(['read', 'delete']);
      renderManager({ onWorkflowClick: vi.fn() });
      await waitFor(() => expect(screen.getByText('Article review')).toBeInTheDocument());
      fireEvent.click(screen.getAllByLabelText('Row actions')[0]);
      expect(await screen.findByText('Delete')).toBeInTheDocument();
      expect(screen.queryByText('Edit')).not.toBeInTheDocument();
    });

    it('stays optimistic while permissions load', async () => {
      usePermissionsMock.mockReturnValue({ canPerform: () => false, isAdmin: false, loading: true });
      renderManager({ onCreateWorkflow: vi.fn() });
      expect(await screen.findByTestId('workflows-manager-add-btn')).toBeInTheDocument();
    });
  });

  describe('a list without rows says why', () => {
    it('no definitions yet', async () => {
      fetchDefinitionsMock.mockResolvedValue(pageOf([]));
      renderManager();
      const empty = await screen.findByTestId('workflows-manager-empty');
      expect(empty).toHaveTextContent('No workflow definitions found');
      expect(empty).toHaveTextContent('Create a workflow to automate state transitions.');
      expect(screen.getByTestId('workflows-manager-count')).toHaveTextContent('0 workflows');
    });

    it('a search without matches', async () => {
      fetchDefinitionsMock.mockImplementation(async ({ search }: { search?: string }) =>
        pageOf(search ? [] : mockWorkflows),
      );
      renderManager();
      await waitFor(() => expect(screen.getByText('Article review')).toBeInTheDocument());
      fireEvent.change(screen.getByTestId('workflows-manager-search'), { target: { value: 'zzz' } });
      const empty = await screen.findByTestId('workflows-manager-empty');
      expect(empty).toHaveTextContent('Try adjusting your search terms.');
    });

    // WF-27: a failed list load looked like 'No workflow definitions found'
    it('a failed load shows the load-error state and a notification, not an empty list', async () => {
      fetchDefinitionsMock.mockRejectedValue(
        new DaaSRequestError('service unavailable', { kind: 'failure', status: 500 }),
      );
      renderManager();

      const error = await screen.findByTestId('workflows-manager-load-error');
      expect(error).toHaveTextContent('Failed to load workflow definitions — service unavailable');
      expect(screen.queryByTestId('workflows-manager-empty')).not.toBeInTheDocument();
      expect(screen.queryByText('No workflow definitions found')).not.toBeInTheDocument();
      expect(screen.queryByTestId('workflows-manager-count')).not.toBeInTheDocument();
      expect(show).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Failed to load workflow definitions', color: 'red' }),
      );
    });

    it('a failure that is not a typed error is still a load error', async () => {
      fetchDefinitionsMock.mockRejectedValue(new Error('boom'));
      renderManager();
      expect(await screen.findByTestId('workflows-manager-load-error')).toHaveTextContent('boom');
    });

    // WF-27 (and WF-25's list half): a refusal is not an empty list either
    it('a refused load shows the access-denied state', async () => {
      fetchDefinitionsMock.mockRejectedValue(
        new DaaSRequestError('Permission denied', { kind: 'forbidden', status: 403 }),
      );
      renderManager({ onCreateWorkflow: vi.fn() });

      const denied = await screen.findByTestId('workflows-manager-access-denied');
      expect(denied).toHaveTextContent('Access denied');
      expect(denied).toHaveTextContent('You do not have permission to view this.');
      expect(screen.queryByTestId('workflows-manager-empty')).not.toBeInTheDocument();
      expect(screen.queryByTestId('workflows-manager-load-error')).not.toBeInTheDocument();
      expect(screen.queryByTestId('workflows-manager-search')).not.toBeInTheDocument();
      // A refusal is not an outage: no error toast
      expect(show).not.toHaveBeenCalled();
    });

    it('a session that needs a second factor is told what the server said', async () => {
      fetchDefinitionsMock.mockRejectedValue(
        new DaaSRequestError('Multi-factor authentication is required', {
          kind: 'mfaRequired',
          status: 403,
          code: 'MFA_REQUIRED',
        }),
      );
      renderManager();
      expect(await screen.findByTestId('workflows-manager-access-denied')).toHaveTextContent(
        'Multi-factor authentication is required',
      );
    });

    it('recovers when a later load succeeds', async () => {
      fetchDefinitionsMock.mockRejectedValueOnce(new DaaSRequestError('down', { kind: 'failure' }));
      renderManager();
      await screen.findByTestId('workflows-manager-load-error');

      fireEvent.change(screen.getByTestId('workflows-manager-search'), { target: { value: 'a' } });
      await waitFor(() => expect(screen.getByText('Article review')).toBeInTheDocument());
      expect(screen.queryByTestId('workflows-manager-load-error')).not.toBeInTheDocument();
    });
  });

  describe('deleting', () => {
    it('deletes after confirmation, says so, and reloads the page', async () => {
      const store = { rows: [...mockWorkflows] };
      serve(store);
      deleteDefinitionMock.mockImplementation(async (id: string) => {
        store.rows = store.rows.filter((w) => w.id !== id);
      });
      renderManager();

      fireEvent.click(await openDeleteFor('Support ticket'));

      await waitFor(() => expect(screen.queryByText('Support ticket')).not.toBeInTheDocument());
      expect(deleteDefinitionMock).toHaveBeenCalledWith(mockWorkflows[1].id);
      expect(show).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Workflow deleted successfully', color: 'green' }),
      );
      await waitFor(() => expect(screen.queryByTestId('workflow-delete-confirm-btn')).not.toBeInTheDocument());
      expect(screen.getByTestId('workflows-manager-count')).toHaveTextContent('2 workflows');
    });

    // WF-23: deleting the only row of the last page left an empty page
    it('deleting the only row of the last page loads the page before it', async () => {
      const store = { rows: manyMockWorkflows(26) };
      serve(store);
      deleteDefinitionMock.mockImplementation(async (id: string) => {
        store.rows = store.rows.filter((w) => w.id !== id);
      });
      window.history.replaceState(null, '', '/?page=2');
      renderManager({ urlParams: true });

      // Page 2 holds the 26th definition alone
      fireEvent.click(await openDeleteFor('Workflow 26'));

      await waitFor(() => expect(screen.getByText('Workflow 25')).toBeInTheDocument());
      expect(fetchDefinitionsMock).toHaveBeenLastCalledWith({ page: 1, limit: 25, search: undefined });
      // The emptied page 2 is never asked for again
      const afterDelete = fetchDefinitionsMock.mock.calls.slice(1);
      expect(afterDelete.every(([params]) => params.page === 1)).toBe(true);
      expect(screen.queryByTestId('workflows-manager-empty')).not.toBeInTheDocument();
      expect(screen.getByTestId('workflows-manager-count')).toHaveTextContent('25 workflows');
      await waitFor(() => expect(window.location.search).toBe(''));
    });

    it('deleting one of several rows of the last page stays on that page', async () => {
      const store = { rows: manyMockWorkflows(27) };
      serve(store);
      deleteDefinitionMock.mockImplementation(async (id: string) => {
        store.rows = store.rows.filter((w) => w.id !== id);
      });
      window.history.replaceState(null, '', '/?page=2');
      renderManager({ urlParams: true });

      fireEvent.click(await openDeleteFor('Workflow 27'));

      await waitFor(() => expect(screen.queryByText('Workflow 27')).not.toBeInTheDocument());
      expect(screen.getByText('Workflow 26')).toBeInTheDocument();
      expect(fetchDefinitionsMock).toHaveBeenLastCalledWith({ page: 2, limit: 25, search: undefined });
    });

    it('falls back to the last page when the page it asked for no longer exists', async () => {
      // Someone else deleted rows: page 3 of a list that now has 2 pages
      serve({ rows: manyMockWorkflows(30) });
      window.history.replaceState(null, '', '/?page=3');
      renderManager({ urlParams: true });

      await waitFor(() => expect(screen.getByText('Workflow 30')).toBeInTheDocument());
      expect(fetchDefinitionsMock).toHaveBeenLastCalledWith({ page: 2, limit: 25, search: undefined });
      expect(screen.queryByTestId('workflows-manager-empty')).not.toBeInTheDocument();
    });

    // WF-24: Delete could be double-clicked into two requests
    it('a double click on the confirm button sends one delete, and the button is pending meanwhile', async () => {
      let finish: () => void = () => {};
      deleteDefinitionMock.mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          }),
      );
      renderManager();

      const confirm = await openDeleteFor('Article review');
      fireEvent.click(confirm);
      fireEvent.click(confirm);
      fireEvent.click(confirm);

      expect(deleteDefinitionMock).toHaveBeenCalledTimes(1);
      expect(confirm).toBeDisabled();
      expect(confirm).toHaveAttribute('data-loading', 'true');
      // Nor can the dialog be dismissed while the request is out
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();

      await act(async () => {
        finish();
      });
      await waitFor(() => expect(screen.queryByTestId('workflow-delete-confirm-btn')).not.toBeInTheDocument());
      expect(deleteDefinitionMock).toHaveBeenCalledTimes(1);
    });

    it('a refused delete is a notification with the server\'s sentence, and the dialog stays open', async () => {
      deleteDefinitionMock.mockRejectedValue(
        new DaaSRequestError('Cannot delete workflow definition: it is assigned to one or more collections', {
          kind: 'invalid',
          status: 400,
        }),
      );
      const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
      renderManager();

      const confirm = await openDeleteFor('Article review');
      fireEvent.click(confirm);

      await waitFor(() =>
        expect(show).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Failed to delete workflow',
            message: 'Cannot delete workflow definition: it is assigned to one or more collections',
            color: 'red',
          }),
        ),
      );
      expect(alert).not.toHaveBeenCalled();
      expect(screen.getByTestId('workflow-delete-confirm-modal')).toBeInTheDocument();
      // The button is ready for another try
      await waitFor(() => expect(screen.getByTestId('workflow-delete-confirm-btn')).not.toBeDisabled());
      expect(screen.getByText('Article review')).toBeInTheDocument();
      alert.mockRestore();
    });

    it('Cancel closes the dialog without deleting', async () => {
      renderManager();
      await openDeleteFor('Article review');
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      await waitFor(() => expect(screen.queryByTestId('workflow-delete-confirm-btn')).not.toBeInTheDocument());
      expect(deleteDefinitionMock).not.toHaveBeenCalled();
    });
  });
});
