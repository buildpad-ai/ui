/**
 * WorkflowInstanceDetail unit tests: the instance's fields, its diagram and
 * its transition history, the three ways a load can end without an instance,
 * and the ways the history can be missing. `@buildpad/hooks` is mocked; the
 * diagram is the real one.
 */
import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { WorkflowHistoryRecord } from '@buildpad/types';
import { DaaSRequestError } from '../../hooks/src/daasRequest';
import { WorkflowInstanceDetail } from '../src/WorkflowInstanceDetail';
import { mockHistory, mockInstance, mockInstances } from '../src/_fixtures';

const mocks = vi.hoisted(() => ({
  getInstance: vi.fn(),
  fetchInstanceHistory: vi.fn(),
  usePermissions: vi.fn(),
}));

vi.mock('@buildpad/hooks', async () => {
  const request = await import('../../hooks/src/daasRequest');
  return {
    DaaSRequestError: request.DaaSRequestError,
    useWorkflowInstances: () => ({
      getInstance: mocks.getInstance,
      fetchInstanceHistory: mocks.fetchInstanceHistory,
    }),
    usePermissions: mocks.usePermissions,
  };
});

function renderDetail(props: Partial<React.ComponentProps<typeof WorkflowInstanceDetail>> = {}) {
  const onBack = vi.fn();
  const utils = render(
    <MantineProvider>
      <WorkflowInstanceDetail id={mockInstance.id} onBack={onBack} {...props} />
    </MantineProvider>,
  );
  return { ...utils, onBack };
}

const field = (name: string) => screen.getByTestId(`workflow-instance-detail-${name}`);
const loaded = () => screen.findByTestId('workflow-instance-detail-information');

let show: ReturnType<typeof vi.spyOn>;
let historyBack: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  mocks.getInstance.mockReset().mockResolvedValue(mockInstance);
  mocks.fetchInstanceHistory.mockReset().mockResolvedValue(mockHistory);
  mocks.usePermissions.mockReset().mockReturnValue({ canPerform: () => false, isAdmin: false, loading: false });
  show = vi.spyOn(notifications, 'show').mockImplementation(() => '');
  historyBack = vi.spyOn(window.history, 'back').mockImplementation(() => {});
});

afterEach(() => {
  show.mockRestore();
  historyBack.mockRestore();
});

describe('WorkflowInstanceDetail', () => {
  describe('an instance', () => {
    it('shows its fields', async () => {
      renderDetail();
      await loaded();

      expect(mocks.getInstance).toHaveBeenCalledWith(mockInstance.id);
      expect(screen.getByRole('heading', { name: 'Workflow Instance Details' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Instance Information' })).toBeInTheDocument();
      expect(field('status')).toHaveTextContent('Active');
      expect(field('workflow')).toHaveTextContent('Article review');
      expect(field('current-state')).toHaveTextContent('Review');
      expect(field('collection')).toHaveTextContent('articles');
      expect(field('item-id')).toHaveTextContent('42');
      expect(field('version-key')).toHaveTextContent('—');
      expect(field('created')).toHaveTextContent('2026');
      expect(field('updated')).toHaveTextContent('2026');
      expect(field('id')).toHaveTextContent(mockInstance.id);
    });

    it('shows a terminated instance, its version, and the markers for what is missing', async () => {
      mocks.getInstance.mockResolvedValue({
        ...mockInstances[1],
        workflow: null,
        date_created: null,
        date_updated: undefined,
      });
      renderDetail({ id: mockInstances[1].id });
      await loaded();

      expect(field('status')).toHaveTextContent('Terminated');
      expect(field('version-key')).toHaveTextContent('spring-edit');
      // The definition is withheld by the caller's grant
      expect(field('workflow')).toHaveTextContent('—');
      expect(field('created')).toHaveTextContent('—');
      expect(field('updated')).toHaveTextContent('—');
    });

    it('shows the definition id when the backend answered no name', async () => {
      mocks.getInstance.mockResolvedValue({ ...mockInstance, workflow: { id: 'definition-id-1', name: '' } });
      renderDetail();
      await loaded();
      expect(field('workflow')).toHaveTextContent('definition-id-1');
    });

    it('reads its strings from the translations prop', async () => {
      renderDetail({ translations: { instanceDetail: { title: 'Detail Instans' } } });
      expect(await screen.findByRole('heading', { name: 'Detail Instans' })).toBeInTheDocument();
    });

    // WF-29, WF-30: the reference gated on 'daas_workflow_instances', a name no backend knows
    it('makes no permission check of its own: the API\'s answer decides', async () => {
      renderDetail();
      await loaded();
      expect(mocks.usePermissions).not.toHaveBeenCalled();
    });
  });

  describe('the workflow diagram', () => {
    it('draws the definition read-only when the instance carries its document', async () => {
      renderDetail();
      await loaded();

      const diagram = screen.getByTestId('workflow-instance-detail-diagram');
      expect(within(diagram).getByRole('heading', { name: 'State Diagram' })).toBeInTheDocument();
      await waitFor(() => expect(within(diagram).getAllByTestId('workflow-diagram-state')).toHaveLength(3));
      // Nothing to change it with
      expect(screen.queryByTestId('workflow-diagram-add-state')).not.toBeInTheDocument();
    });

    it('is left out when the definition came without its document, or is withheld', async () => {
      mocks.getInstance.mockResolvedValue(mockInstances[0]);
      const { unmount } = renderDetail();
      await loaded();
      expect(screen.queryByTestId('workflow-instance-detail-diagram')).not.toBeInTheDocument();
      unmount();

      mocks.getInstance.mockResolvedValue({ ...mockInstance, workflow: null });
      renderDetail();
      await loaded();
      expect(screen.queryByTestId('workflow-instance-detail-diagram')).not.toBeInTheDocument();
    });

    it('is left out for a document without states, and when showDiagram is false', async () => {
      mocks.getInstance.mockResolvedValue({
        ...mockInstance,
        workflow: { ...mockInstance.workflow, workflow_json: { initial_state: '', states: [] } },
      });
      const { unmount } = renderDetail();
      await loaded();
      expect(screen.queryByTestId('workflow-instance-detail-diagram')).not.toBeInTheDocument();
      unmount();

      mocks.getInstance.mockResolvedValue(mockInstance);
      renderDetail({ showDiagram: false });
      await loaded();
      expect(screen.queryByTestId('workflow-instance-detail-diagram')).not.toBeInTheDocument();
    });
  });

  describe('the transition history', () => {
    it('lists the transitions in the order the hook answers them, with a count', async () => {
      renderDetail();
      await loaded();

      const rows = await screen.findAllByTestId('workflow-instance-detail-history-row');
      expect(mocks.fetchInstanceHistory).toHaveBeenCalledWith(mockInstance.id);
      expect(rows).toHaveLength(2);
      expect(rows[0]).toHaveTextContent('Submit');
      expect(rows[0]).toHaveTextContent('Draft');
      expect(rows[0]).toHaveTextContent('Review');
      expect(rows[0]).toHaveTextContent(mockHistory[0].transitioned_by);
      expect(rows[0]).toHaveTextContent('2026');
      expect(rows[1]).toHaveTextContent('Reject');
      expect(screen.getByTestId('workflow-instance-detail-history-count')).toHaveTextContent('2 transitions');
      expect(within(screen.getByTestId('workflow-instance-detail-history-table')).getByText('Transitioned By')).toBeInTheDocument();
    });

    it('counts one transition in the singular, and draws a row whose id and user are withheld', async () => {
      const { id: _id, transitioned_by: _by, ...withheld } = mockHistory[0];
      mocks.fetchInstanceHistory.mockResolvedValue([withheld as WorkflowHistoryRecord]);
      renderDetail();
      await loaded();
      const count = await screen.findByTestId('workflow-instance-detail-history-count');
      expect(count).toHaveTextContent('1 transition');
      expect(count).not.toHaveTextContent('transitions');
      expect(screen.getByTestId('workflow-instance-detail-history-row')).toHaveTextContent('—');
    });

    it('an instance without transitions says it is in its initial state', async () => {
      mocks.fetchInstanceHistory.mockResolvedValue([]);
      renderDetail();
      await loaded();
      expect(await screen.findByTestId('workflow-instance-detail-history-empty')).toHaveTextContent(
        'No transitions recorded yet. This instance is in its initial state.',
      );
      expect(screen.getByTestId('workflow-instance-detail-history-count')).toHaveTextContent('0 transitions');
    });

    it('a history the caller may not read says so, not "No transitions recorded yet"', async () => {
      mocks.fetchInstanceHistory.mockRejectedValue(
        new DaaSRequestError('Permission denied', { kind: 'forbidden', status: 403 }),
      );
      renderDetail();
      await loaded();

      expect(await screen.findByTestId('workflow-instance-detail-history-access-denied')).toHaveTextContent(
        'You do not have permission to view the transition history.',
      );
      expect(screen.queryByTestId('workflow-instance-detail-history-empty')).not.toBeInTheDocument();
      expect(screen.queryByTestId('workflow-instance-detail-history-count')).not.toBeInTheDocument();
      // The instance itself is still shown, and a refusal is not an outage
      expect(field('workflow')).toHaveTextContent('Article review');
      expect(show).not.toHaveBeenCalled();
    });

    it('a history that failed to load says so, and Retry loads it again', async () => {
      mocks.fetchInstanceHistory.mockRejectedValueOnce(new DaaSRequestError('timeout', { kind: 'failure' }));
      renderDetail();
      await loaded();

      expect(await screen.findByTestId('workflow-instance-detail-history-load-error')).toHaveTextContent(
        'Failed to load transition history — timeout',
      );
      expect(screen.queryByTestId('workflow-instance-detail-history-empty')).not.toBeInTheDocument();
      expect(show).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Failed to load transition history', message: 'timeout', color: 'red' }),
      );

      fireEvent.click(screen.getByTestId('workflow-instance-detail-history-retry-btn'));
      expect(await screen.findAllByTestId('workflow-instance-detail-history-row')).toHaveLength(2);
      expect(mocks.getInstance).toHaveBeenCalledTimes(1);
    });

    it('a history failure without a sentence uses the dictionary\'s', async () => {
      mocks.fetchInstanceHistory.mockRejectedValue('nope');
      renderDetail();
      await loaded();
      expect(await screen.findByTestId('workflow-instance-detail-history-load-error')).toHaveTextContent(
        'Failed to load transition history — Failed to load transition history',
      );
    });

    it('is shown loading until it arrives', async () => {
      let answer: (rows: WorkflowHistoryRecord[]) => void = () => {};
      mocks.fetchInstanceHistory.mockImplementation(
        () =>
          new Promise<WorkflowHistoryRecord[]>((resolve) => {
            answer = resolve;
          }),
      );
      renderDetail();
      await loaded();
      expect(await screen.findByTestId('workflow-instance-detail-history-loading')).toBeInTheDocument();
      await act(async () => {
        answer(mockHistory);
      });
      expect(screen.queryByTestId('workflow-instance-detail-history-loading')).not.toBeInTheDocument();
    });
  });

  describe('a load that ends without an instance', () => {
    // WF-07: a missing id rendered an empty card and "0 transitions"
    it('an id that names no instance shows the not-found state', async () => {
      mocks.getInstance.mockRejectedValue(
        new DaaSRequestError('Workflow instance not found', { kind: 'notFound', status: 404 }),
      );
      const { onBack } = renderDetail({ id: 'missing' });

      const state = await screen.findByTestId('workflow-instance-detail-not-found');
      expect(state).toHaveTextContent('Workflow instance not found');
      expect(state).toHaveTextContent('It may have been deleted, or you may not have access to it.');
      expect(screen.queryByTestId('workflow-instance-detail-information')).not.toBeInTheDocument();
      expect(screen.queryByTestId('workflow-instance-detail-history')).not.toBeInTheDocument();
      expect(screen.queryByText(/transitions/)).not.toBeInTheDocument();
      // The history of an instance that did not load is never asked for
      expect(mocks.fetchInstanceHistory).not.toHaveBeenCalled();
      // Missing is not an outage: no error toast
      expect(show).not.toHaveBeenCalled();

      fireEvent.click(within(state).getByRole('button', { name: 'Back' }));
      expect(onBack).toHaveBeenCalledTimes(1);
    });

    it('an instance the caller may not read shows the access-denied state', async () => {
      mocks.getInstance.mockRejectedValue(
        new DaaSRequestError('Permission denied', { kind: 'forbidden', status: 403 }),
      );
      renderDetail();
      const state = await screen.findByTestId('workflow-instance-detail-access-denied');
      expect(state).toHaveTextContent('Access denied');
      expect(state).toHaveTextContent('You do not have permission to view this.');
      expect(mocks.fetchInstanceHistory).not.toHaveBeenCalled();
      expect(show).not.toHaveBeenCalled();
    });

    it('a session that needs a second factor is told what the server said', async () => {
      mocks.getInstance.mockRejectedValue(
        new DaaSRequestError('Multi-factor authentication is required', { kind: 'mfaRequired', status: 403 }),
      );
      renderDetail();
      expect(await screen.findByTestId('workflow-instance-detail-access-denied')).toHaveTextContent(
        'Multi-factor authentication is required',
      );
    });

    it('a failed load shows the load-error state, and Retry loads again', async () => {
      mocks.getInstance.mockRejectedValueOnce(new DaaSRequestError('service unavailable', { kind: 'failure' }));
      renderDetail();

      const state = await screen.findByTestId('workflow-instance-detail-load-error');
      expect(state).toHaveTextContent('Failed to load workflow instance — service unavailable');
      expect(show).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Failed to load workflow instance', color: 'red' }),
      );

      fireEvent.click(within(state).getByRole('button', { name: 'Retry' }));
      await loaded();
      expect(field('workflow')).toHaveTextContent('Article review');
    });

    it('a failure without a sentence uses the dictionary\'s', async () => {
      mocks.getInstance.mockRejectedValue('nope');
      renderDetail();
      expect(await screen.findByTestId('workflow-instance-detail-load-error')).toHaveTextContent(
        'Failed to load workflow instance — Failed to load workflow instance',
      );
    });
  });

  describe('navigation is by callback', () => {
    // WF-05: Back was history.back(), which leaves the app on a directly opened page
    it('Back and the breadcrumb call onBack and never touch the browser history', async () => {
      const { onBack, container } = renderDetail();
      await loaded();

      fireEvent.click(screen.getByTestId('workflow-instance-detail-back-btn'));
      expect(onBack).toHaveBeenCalledTimes(1);
      fireEvent.click(screen.getByTestId('workflow-instance-detail-breadcrumb-root'));
      expect(onBack).toHaveBeenCalledTimes(2);

      expect(historyBack).not.toHaveBeenCalled();
      // The only link on the page is React Flow's attribution, which leaves the app on purpose
      const links = Array.from(container.querySelectorAll('a[href]'));
      expect(links.every((link) => link.closest('.react-flow__attribution'))).toBe(true);
    });

    it('without onBack there is no Back button and the breadcrumb is text', async () => {
      render(
        <MantineProvider>
          <WorkflowInstanceDetail id={mockInstance.id} />
        </MantineProvider>,
      );
      await loaded();
      expect(screen.queryByTestId('workflow-instance-detail-back-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('workflow-instance-detail-breadcrumb-root')).not.toBeInTheDocument();
      expect(screen.getByText('Workflow Instances')).toBeInTheDocument();
    });
  });

  it('draws only the instance of the latest id', async () => {
    let answerFirst: (value: typeof mockInstance) => void = () => {};
    mocks.getInstance.mockImplementation((id: string) =>
      id === 'slow'
        ? new Promise((resolve) => {
            answerFirst = resolve;
          })
        : Promise.resolve({ ...mockInstances[1], workflow: null }),
    );
    const { rerender } = render(
      <MantineProvider>
        <WorkflowInstanceDetail id="slow" />
      </MantineProvider>,
    );
    rerender(
      <MantineProvider>
        <WorkflowInstanceDetail id={mockInstances[1].id} />
      </MantineProvider>,
    );
    await loaded();
    await act(async () => {
      answerFirst(mockInstance);
    });
    expect(field('item-id')).toHaveTextContent('7');
  });
});
