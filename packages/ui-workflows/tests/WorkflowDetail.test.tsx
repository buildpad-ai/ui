/**
 * WorkflowDetail unit tests: loading (and the three ways a load can end
 * without a definition), editing through the diagram and its dialogs, the
 * unsaved-changes badge, saving, and the read-only editor. `@buildpad/hooks`
 * is mocked; the diagram is the real one.
 */
import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { WorkflowDefinitionRecord, WorkflowJson } from '@buildpad/types';
import { DaaSRequestError } from '../../hooks/src/daasRequest';
import { WorkflowDetail } from '../src/WorkflowDetail';
import { mockPolicyOptions, mockWorkflow, reviewWorkflowJson } from '../src/_fixtures';
import { asStored } from './_stored';

const mocks = vi.hoisted(() => ({
  getDefinition: vi.fn(),
  createDefinition: vi.fn(),
  updateDefinition: vi.fn(),
  fetchPolicies: vi.fn(),
  usePermissions: vi.fn(),
}));

vi.mock('@buildpad/hooks', async () => {
  const request = await import('../../hooks/src/daasRequest');
  return {
    DaaSRequestError: request.DaaSRequestError,
    useWorkflowDefinitions: () => ({
      getDefinition: mocks.getDefinition,
      createDefinition: mocks.createDefinition,
      updateDefinition: mocks.updateDefinition,
    }),
    usePolicies: () => ({ fetchPolicies: mocks.fetchPolicies }),
    usePermissions: mocks.usePermissions,
  };
});

function renderDetail(props: Partial<React.ComponentProps<typeof WorkflowDetail>> = {}) {
  const onBack = vi.fn();
  const onSaved = vi.fn();
  const utils = render(
    <MantineProvider>
      <WorkflowDetail id={mockWorkflow.id} onBack={onBack} onSaved={onSaved} {...props} />
    </MantineProvider>,
  );
  return { ...utils, onBack, onSaved };
}

function grant(actions: string[], isAdmin = false) {
  mocks.usePermissions.mockReturnValue({
    canPerform: (_collection: string, action: string) => actions.includes(action),
    isAdmin,
    loading: false,
  });
}

const nameInput = () => screen.getByTestId('workflow-detail-name') as HTMLInputElement;
const descriptionInput = () => screen.getByTestId('workflow-detail-description') as HTMLTextAreaElement;
const saveButton = () => screen.getByTestId('workflow-detail-save-btn');
const loaded = () => waitFor(() => expect(nameInput().value).toBe('Article review'));

/** The card of the state named `name` on the diagram. */
function card(name: string): HTMLElement {
  const found = screen.getAllByTestId('workflow-diagram-state').find((el) => el.dataset.state === name);
  if (!found) throw new Error(`no card for state ${name}`);
  return found;
}

/** Adds a state through the diagram's + button and the State dialog. */
async function addState(name: string, { first = false } = {}) {
  fireEvent.click(screen.getByTestId(first ? 'workflow-diagram-add-first-state' : 'workflow-diagram-add-state'));
  fireEvent.change(await screen.findByTestId('workflow-state-name'), { target: { value: name } });
  fireEvent.click(screen.getByTestId('workflow-state-save-btn'));
  await waitFor(() => expect(card(name)).toBeInTheDocument());
}

let show: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  mocks.getDefinition.mockReset().mockResolvedValue(mockWorkflow);
  mocks.createDefinition.mockReset().mockResolvedValue('new-id-1');
  mocks.updateDefinition.mockReset().mockResolvedValue(undefined);
  mocks.fetchPolicies.mockReset().mockResolvedValue({ policies: mockPolicyOptions, total: 3, totalPages: 1 });
  mocks.usePermissions.mockReset();
  grant([], true);
  show = vi.spyOn(notifications, 'show').mockImplementation(() => '');
});

afterEach(() => {
  show.mockRestore();
});

describe('WorkflowDetail', () => {
  describe('loading a definition', () => {
    it('shows its name, description, statistics, states overview and diagram', async () => {
      renderDetail();
      await loaded();

      expect(mocks.getDefinition).toHaveBeenCalledWith(mockWorkflow.id);
      expect(screen.getByRole('heading', { name: 'Article review' })).toBeInTheDocument();
      expect(descriptionInput().value).toMatch(/^Editors submit/);
      expect(screen.getByTestId('workflow-detail-stat-states')).toHaveTextContent('3');
      expect(screen.getByTestId('workflow-detail-stat-commands')).toHaveTextContent('3');
      expect(screen.getByTestId('workflow-detail-stat-initial')).toHaveTextContent('Draft');

      const overview = screen.getByTestId('workflow-detail-states-overview');
      expect(within(overview).getByText('Initial')).toBeInTheDocument();
      expect(within(overview).getByText('End')).toBeInTheDocument();
      expect(within(overview).getByText('2 cmd')).toBeInTheDocument();

      expect(screen.getAllByTestId('workflow-diagram-state')).toHaveLength(3);
      expect(screen.queryByTestId('workflow-detail-unsaved-badge')).not.toBeInTheDocument();
    });

    // WF-19: the header said "Click to edit"
    it('describes the diagram the way the diagram works', async () => {
      renderDetail();
      await loaded();
      expect(screen.getByTestId('workflow-detail-diagram-hint')).toHaveTextContent(
        'Drag states to reposition • Edit a state from its menu • Click a command to edit it',
      );
    });

    it('checks permissions on the collection the API enforces', async () => {
      renderDetail();
      await loaded();
      expect(mocks.usePermissions).toHaveBeenCalledWith({ collections: ['daas_wf_definition'] });
    });

    // WF-21: a command stored without actions/policies crashed the dialog
    it('normalises the stored document, so a command without actions or policies opens', async () => {
      const bare = {
        ...mockWorkflow,
        workflow_json: {
          initial_state: 'Draft',
          states: [
            { name: 'Draft', isEndState: false, commands: [{ name: 'Go', next_state: 'Done' }] },
            // A state stored without a commands array
            { name: 'Done', isEndState: true },
          ],
        } as unknown as WorkflowJson,
      };
      mocks.getDefinition.mockResolvedValue(bare);
      renderDetail();
      await loaded();

      expect(screen.getByTestId('workflow-detail-stat-commands')).toHaveTextContent('1');
      fireEvent.click(within(card('Draft')).getByText('Go'));

      expect(((await screen.findByTestId('workflow-command-name')) as HTMLInputElement).value).toBe('Go');
      expect(screen.getByTestId('workflow-command-tab-actions')).toHaveTextContent('Actions (0)');
      expect(screen.getByTestId('workflow-command-tab-policies')).toHaveTextContent('Policies (0)');
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));

      // Every gesture walks every state's commands: deleting Draft has to read
      // the commands of Done, which was stored without any
      fireEvent.click(screen.getByLabelText('Actions for state Draft'));
      fireEvent.click(await screen.findByText('Delete State'));
      await waitFor(() => expect(screen.getByTestId('workflow-detail-stat-states')).toHaveTextContent('1'));
      expect(screen.getByTestId('workflow-detail-stat-initial')).toHaveTextContent('Done');
    });

    it('loads again when it is given another id', async () => {
      const { rerender } = renderDetail();
      await loaded();
      mocks.getDefinition.mockResolvedValue({ ...mockWorkflow, id: 'other', name: 'Other flow' });
      rerender(
        <MantineProvider>
          <WorkflowDetail id="other" />
        </MantineProvider>,
      );
      await waitFor(() => expect(nameInput().value).toBe('Other flow'));
      expect(mocks.getDefinition).toHaveBeenLastCalledWith('other');
    });
  });

  // WF-25: a 404, a refusal or a failed load rendered as a blank form
  describe('a load that ends without a definition says which way it ended', () => {
    it('a missing definition is not found, not a blank form', async () => {
      mocks.getDefinition.mockRejectedValue(
        new DaaSRequestError('Workflow definition not found', { kind: 'notFound', status: 404 }),
      );
      const { onBack } = renderDetail();

      const state = await screen.findByTestId('workflow-detail-not-found');
      expect(state).toHaveTextContent('Workflow definition not found');
      expect(state).toHaveTextContent('It may have been deleted, or you may not have access to it.');
      // Nothing to type into, nothing to save to a missing id
      expect(screen.queryByTestId('workflow-detail-name')).not.toBeInTheDocument();
      expect(screen.queryByTestId('workflow-detail-save-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('workflow-diagram')).not.toBeInTheDocument();
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      // A missing record is not an outage
      expect(show).not.toHaveBeenCalled();

      fireEvent.click(within(state).getByRole('button', { name: 'Back' }));
      expect(onBack).toHaveBeenCalledTimes(1);
    });

    it('a refused load is access denied', async () => {
      mocks.getDefinition.mockRejectedValue(
        new DaaSRequestError('Permission denied', { kind: 'forbidden', status: 403 }),
      );
      renderDetail();

      const state = await screen.findByTestId('workflow-detail-access-denied');
      expect(state).toHaveTextContent('Access denied');
      expect(state).toHaveTextContent('You do not have permission to view this.');
      expect(screen.queryByTestId('workflow-detail-not-found')).not.toBeInTheDocument();
      expect(screen.queryByTestId('workflow-detail-name')).not.toBeInTheDocument();
      expect(show).not.toHaveBeenCalled();
    });

    it('a session that needs a second factor is told what the server said', async () => {
      mocks.getDefinition.mockRejectedValue(
        new DaaSRequestError('Multi-factor authentication is required', {
          kind: 'mfaRequired',
          status: 403,
          code: 'MFA_REQUIRED',
        }),
      );
      renderDetail();
      expect(await screen.findByTestId('workflow-detail-access-denied')).toHaveTextContent(
        'Multi-factor authentication is required',
      );
    });

    it('a failed load is a load error with the reason, a notification, and a retry that works', async () => {
      mocks.getDefinition.mockRejectedValueOnce(
        new DaaSRequestError('service unavailable', { kind: 'failure', status: 503 }),
      );
      renderDetail();

      const state = await screen.findByTestId('workflow-detail-load-error');
      expect(state).toHaveTextContent('Failed to load workflow definition — service unavailable');
      expect(screen.queryByTestId('workflow-detail-name')).not.toBeInTheDocument();
      expect(show).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Failed to fetch workflow definition', color: 'red' }),
      );

      fireEvent.click(within(state).getByRole('button', { name: 'Retry' }));
      await loaded();
      expect(screen.queryByTestId('workflow-detail-load-error')).not.toBeInTheDocument();
    });

    it('an error that is not typed is a load error too', async () => {
      mocks.getDefinition.mockRejectedValue(new Error('boom'));
      renderDetail();
      expect(await screen.findByTestId('workflow-detail-load-error')).toHaveTextContent('boom');
    });

    it('offers no Back button when the host gave no onBack', async () => {
      mocks.getDefinition.mockRejectedValue(new DaaSRequestError('gone', { kind: 'notFound' }));
      render(
        <MantineProvider>
          <WorkflowDetail id="missing" />
        </MantineProvider>,
      );
      const state = await screen.findByTestId('workflow-detail-not-found');
      expect(within(state).queryByRole('button')).not.toBeInTheDocument();
    });
  });

  describe('navigation is by callback', () => {
    // WF-22: the breadcrumb was a link without the locale prefix
    it('has no link; the breadcrumb and Cancel call onBack', async () => {
      const { container, onBack } = renderDetail();
      await loaded();
      // The one link on the page is React Flow's own attribution
      const links = Array.from(container.querySelectorAll('a[href]')).filter(
        (link) => !link.closest('.react-flow__attribution'),
      );
      expect(links).toEqual([]);
      expect(screen.getByTestId('workflow-detail-breadcrumb-root').tagName).toBe('BUTTON');

      fireEvent.click(screen.getByTestId('workflow-detail-breadcrumb-root'));
      fireEvent.click(screen.getByTestId('workflow-detail-cancel-btn'));
      expect(onBack).toHaveBeenCalledTimes(2);
    });

    it('draws the breadcrumb as text and no Cancel when the host gave no onBack', async () => {
      render(
        <MantineProvider>
          <WorkflowDetail id={mockWorkflow.id} />
        </MantineProvider>,
      );
      await loaded();
      expect(screen.getByText('Workflow Definitions')).toBeInTheDocument();
      expect(screen.queryByTestId('workflow-detail-breadcrumb-root')).not.toBeInTheDocument();
      expect(screen.queryByTestId('workflow-detail-cancel-btn')).not.toBeInTheDocument();
    });
  });

  describe('unsaved changes', () => {
    it('flags an edited name and forgets it when the name is typed back', async () => {
      renderDetail();
      await loaded();
      expect(saveButton()).toBeDisabled();

      fireEvent.change(nameInput(), { target: { value: 'Article review v2' } });
      expect(screen.getByTestId('workflow-detail-unsaved-badge')).toHaveTextContent('Unsaved changes');
      expect(saveButton()).not.toBeDisabled();

      fireEvent.change(nameInput(), { target: { value: 'Article review' } });
      expect(screen.queryByTestId('workflow-detail-unsaved-badge')).not.toBeInTheDocument();
    });

    // WF-18: re-saving a positioned state unchanged flagged unsaved changes
    it('saving a stored state unchanged in its dialog is not an edit', async () => {
      mocks.getDefinition.mockResolvedValue({ ...mockWorkflow, workflow_json: asStored(reviewWorkflowJson) });
      renderDetail();
      await loaded();

      fireEvent.click(screen.getByLabelText('Actions for state Draft'));
      fireEvent.click(await screen.findByText('Edit State'));
      fireEvent.click(await screen.findByTestId('workflow-state-save-btn'));

      await waitFor(() => expect(screen.queryByTestId('workflow-state-save-btn')).not.toBeInTheDocument());
      expect(screen.queryByTestId('workflow-detail-unsaved-badge')).not.toBeInTheDocument();
    });

    // WF-17: re-saving a command unchanged flagged unsaved changes
    it('saving a stored command unchanged in its dialog is not an edit', async () => {
      mocks.getDefinition.mockResolvedValue({ ...mockWorkflow, workflow_json: asStored(reviewWorkflowJson) });
      renderDetail();
      await loaded();

      fireEvent.click(within(card('Draft')).getByText('Submit'));
      fireEvent.click(await screen.findByTestId('workflow-command-save-btn'));

      await waitFor(() => expect(screen.queryByTestId('workflow-command-save-btn')).not.toBeInTheDocument());
      expect(screen.queryByTestId('workflow-detail-unsaved-badge')).not.toBeInTheDocument();
    });

    it('a deleted command is an edit, and the statistics follow', async () => {
      renderDetail();
      await loaded();
      fireEvent.click(await screen.findByLabelText('Delete command Reject'));
      expect(screen.getByTestId('workflow-detail-stat-commands')).toHaveTextContent('2');
      expect(screen.getByTestId('workflow-detail-unsaved-badge')).toBeInTheDocument();
    });
  });

  describe('editing the machine', () => {
    it('a renamed state takes the commands that led to it and the initial state with it', async () => {
      renderDetail();
      await loaded();

      fireEvent.click(screen.getByLabelText('Actions for state Draft'));
      fireEvent.click(await screen.findByText('Edit State'));
      fireEvent.change(await screen.findByTestId('workflow-state-name'), { target: { value: 'New' } });
      fireEvent.click(screen.getByTestId('workflow-state-save-btn'));

      await waitFor(() => expect(card('New')).toBeInTheDocument());
      expect(screen.getByTestId('workflow-detail-stat-initial')).toHaveTextContent('New');
      expect(within(card('Review')).getByText('→ New')).toBeInTheDocument();
    });

    it('an edited command replaces the stored one on its state', async () => {
      renderDetail();
      await loaded();

      fireEvent.click(within(card('Review')).getByText('Reject'));
      fireEvent.change(await screen.findByTestId('workflow-command-name'), { target: { value: 'Send back' } });
      fireEvent.click(screen.getByTestId('workflow-command-save-btn'));

      await waitFor(() => expect(within(card('Review')).getByText('Send back')).toBeInTheDocument());
      expect(within(card('Review')).queryByText('Reject')).not.toBeInTheDocument();
      expect(screen.getByTestId('workflow-detail-stat-commands')).toHaveTextContent('3');
    });

    it('offers every policy to the Command dialog, read page after page, once per editor', async () => {
      const page = (n: number, total: number) => ({
        policies: Array.from({ length: n }, (_, i) => ({ id: `p-${total}-${i}`, name: `Policy ${total}-${i}` })),
        total: 130,
        totalPages: 2,
      });
      mocks.fetchPolicies.mockImplementation(async ({ page: number }: { page: number }) =>
        number === 1 ? page(100, 1) : page(30, 2),
      );
      renderDetail();
      await loaded();

      fireEvent.click(within(card('Review')).getByText('Reject'));
      await screen.findByTestId('workflow-command-name');
      await waitFor(() => expect(mocks.fetchPolicies).toHaveBeenCalledTimes(2));
      expect(mocks.fetchPolicies).toHaveBeenNthCalledWith(1, { page: 1, limit: 100 });
      expect(mocks.fetchPolicies).toHaveBeenNthCalledWith(2, { page: 2, limit: 100 });

      fireEvent.click(screen.getByTestId('workflow-command-tab-policies'));
      const picker = screen.getByTestId('workflow-command-policies');
      await waitFor(() => expect(picker).not.toBeDisabled());
      fireEvent.click(picker);
      // A policy of the second page can be chosen
      expect(await screen.findByRole('option', { name: 'Policy 2-29', hidden: true })).toBeInTheDocument();

      // Opening the dialog again reads no page again
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
      await waitFor(() => expect(screen.queryByTestId('workflow-command-name')).not.toBeInTheDocument());
      fireEvent.click(within(card('Draft')).getByText('Submit'));
      await waitFor(() =>
        expect((screen.getByTestId('workflow-command-name') as HTMLInputElement).value).toBe('Submit'),
      );
      expect(mocks.fetchPolicies).toHaveBeenCalledTimes(2);
    });

    it('uses the policies it was given instead of loading any', async () => {
      renderDetail({ policies: [{ id: 'policy-reviewer', name: 'Given reviewer' }] });
      await loaded();
      fireEvent.click(within(card('Review')).getByText('Reject'));
      fireEvent.click(await screen.findByTestId('workflow-command-tab-policies'));
      expect(screen.getAllByText('Given reviewer').length).toBeGreaterThan(0);
      expect(mocks.fetchPolicies).not.toHaveBeenCalled();
    });
  });

  describe('saving', () => {
    it('an update sends only what changed, says so, and clears the unsaved badge', async () => {
      const { onSaved } = renderDetail();
      await loaded();

      fireEvent.change(nameInput(), { target: { value: 'Article review v2' } });
      fireEvent.click(saveButton());

      await waitFor(() => expect(mocks.updateDefinition).toHaveBeenCalledTimes(1));
      expect(mocks.updateDefinition).toHaveBeenCalledWith(mockWorkflow.id, { name: 'Article review v2' });
      await waitFor(() =>
        expect(show).toHaveBeenCalledWith(
          expect.objectContaining({ message: 'Workflow updated successfully', color: 'green' }),
        ),
      );
      expect(screen.queryByTestId('workflow-detail-unsaved-badge')).not.toBeInTheDocument();
      expect(onSaved).toHaveBeenCalledWith(
        expect.objectContaining({ id: mockWorkflow.id, name: 'Article review v2', workflow_json: reviewWorkflowJson }),
      );
      expect(mocks.createDefinition).not.toHaveBeenCalled();
    });

    it('an edited machine is sent as the whole document', async () => {
      renderDetail();
      await loaded();
      fireEvent.click(await screen.findByLabelText('Delete command Reject'));
      fireEvent.click(saveButton());

      await waitFor(() => expect(mocks.updateDefinition).toHaveBeenCalledTimes(1));
      const [, edits] = mocks.updateDefinition.mock.calls[0];
      expect(Object.keys(edits)).toEqual(['workflow_json']);
      expect(edits.workflow_json.states[1].commands.map((c: { name: string }) => c.name)).toEqual(['Approve']);
      // What was not touched is sent as it was stored, module access keys included
      expect(edits.workflow_json.states[0].commands[0].module_access_keys).toEqual(['content:submit']);
    });

    it('a cleared description is sent as null', async () => {
      renderDetail();
      await loaded();
      fireEvent.change(descriptionInput(), { target: { value: '' } });
      fireEvent.click(saveButton());
      await waitFor(() => expect(mocks.updateDefinition).toHaveBeenCalledWith(mockWorkflow.id, { description: null }));
    });

    it('a refused save shows the server\'s sentence and keeps the edit', async () => {
      mocks.updateDefinition.mockRejectedValue(
        new DaaSRequestError('Permission denied: Cannot update restricted fields', { kind: 'forbidden', status: 403 }),
      );
      const { onSaved } = renderDetail();
      await loaded();
      fireEvent.change(nameInput(), { target: { value: 'Renamed' } });
      fireEvent.click(saveButton());

      await waitFor(() =>
        expect(show).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'Permission denied: Cannot update restricted fields',
            color: 'red',
          }),
        ),
      );
      expect(nameInput().value).toBe('Renamed');
      expect(screen.getByTestId('workflow-detail-unsaved-badge')).toBeInTheDocument();
      expect(onSaved).not.toHaveBeenCalled();
    });

    it('a double click on Save sends one request', async () => {
      let finish: () => void = () => {};
      mocks.updateDefinition.mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          }),
      );
      renderDetail();
      await loaded();
      fireEvent.change(nameInput(), { target: { value: 'Renamed' } });
      fireEvent.click(saveButton());
      fireEvent.click(saveButton());
      expect(mocks.updateDefinition).toHaveBeenCalledTimes(1);
      finish();
      await waitFor(() => expect(saveButton()).not.toHaveAttribute('data-loading', 'true'));
    });
  });

  describe('a new definition', () => {
    it('starts empty, without loading anything', async () => {
      renderDetail({ id: 'new' });
      expect(screen.getByRole('heading', { name: 'New Workflow Definition' })).toBeInTheDocument();
      expect(screen.getByText('New Workflow')).toBeInTheDocument();
      expect(nameInput().value).toBe('');
      expect(screen.getByTestId('workflow-detail-stat-initial')).toHaveTextContent('Not set');
      expect(screen.getByText('No states defined yet')).toBeInTheDocument();
      expect(saveButton()).toHaveTextContent('Create Workflow');
      expect(mocks.getDefinition).not.toHaveBeenCalled();
    });

    it('refuses to save without a name, then without a state, each with its own message', async () => {
      renderDetail({ id: 'new' });
      fireEvent.click(saveButton());
      expect(show).toHaveBeenLastCalledWith(
        expect.objectContaining({ title: 'Validation Error', message: 'Workflow name is required' }),
      );

      fireEvent.change(nameInput(), { target: { value: 'Flow' } });
      fireEvent.click(saveButton());
      expect(show).toHaveBeenLastCalledWith(
        expect.objectContaining({ message: 'Please add at least one state to the workflow' }),
      );
      expect(mocks.createDefinition).not.toHaveBeenCalled();
    });

    it('creates the definition with its first state as the initial state, and hands the new id to onSaved', async () => {
      const { onSaved } = renderDetail({ id: 'new' });
      fireEvent.change(nameInput(), { target: { value: 'Flow' } });
      await addState('Draft', { first: true });
      expect(screen.getByTestId('workflow-detail-stat-initial')).toHaveTextContent('Draft');
      await addState('Done');
      expect(screen.getByTestId('workflow-detail-stat-states')).toHaveTextContent('2');

      fireEvent.click(saveButton());

      await waitFor(() => expect(mocks.createDefinition).toHaveBeenCalledTimes(1));
      expect(mocks.createDefinition).toHaveBeenCalledWith({
        name: 'Flow',
        description: null,
        workflow_json: {
          initial_state: 'Draft',
          states: [
            { name: 'Draft', commands: [], isEndState: false },
            { name: 'Done', commands: [], isEndState: false },
          ],
        },
      });
      await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: 'new-id-1', name: 'Flow' })));
      expect(show).toHaveBeenCalledWith(expect.objectContaining({ message: 'Workflow created successfully' }));
      expect(mocks.updateDefinition).not.toHaveBeenCalled();
    });

    it('is refused outright to a user who may not create', async () => {
      grant(['read', 'update']);
      renderDetail({ id: 'new' });
      expect(await screen.findByTestId('workflow-detail-access-denied')).toBeInTheDocument();
      expect(screen.queryByTestId('workflow-detail-name')).not.toBeInTheDocument();
    });
  });

  describe('read-only', () => {
    it('a user who may read but not update gets the definition with nothing to change', async () => {
      grant(['read']);
      const { onBack } = renderDetail();
      await loaded();

      expect(nameInput()).toHaveAttribute('readonly');
      expect(descriptionInput()).toHaveAttribute('readonly');
      expect(screen.queryByTestId('workflow-detail-save-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('workflow-detail-diagram-hint')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Actions for state Draft')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Delete command Reject')).not.toBeInTheDocument();
      expect(screen.queryByTestId('workflow-diagram-add-state')).not.toBeInTheDocument();
      expect(screen.getAllByTestId('workflow-diagram-state')).toHaveLength(3);

      // The way out is called Back, not Cancel: there is nothing to cancel
      expect(screen.getByTestId('workflow-detail-cancel-btn')).toHaveTextContent('Back');
      fireEvent.click(screen.getByTestId('workflow-detail-cancel-btn'));
      expect(onBack).toHaveBeenCalledTimes(1);
    });

    it('the readOnly prop does the same for a user who could update', async () => {
      renderDetail({ readOnly: true });
      await loaded();
      expect(nameInput()).toHaveAttribute('readonly');
      expect(screen.queryByTestId('workflow-detail-save-btn')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Actions for state Draft')).not.toBeInTheDocument();
    });

    it('stays editable while permissions load', async () => {
      mocks.usePermissions.mockReturnValue({ canPerform: () => false, isAdmin: false, loading: true });
      renderDetail();
      await loaded();
      expect(screen.getByTestId('workflow-detail-save-btn')).toBeInTheDocument();
    });
  });

  it('passes hideAttribution and diagramHeight on to the diagram', async () => {
    const { container } = renderDetail({ hideAttribution: true, diagramHeight: 420 });
    await loaded();
    expect(container.querySelector('.react-flow__attribution')).toBeNull();
    expect(screen.getByTestId('workflow-diagram')).toHaveStyle({ height: '420px' });
  });

  it('shows the attribution by default', async () => {
    const { container } = renderDetail();
    await loaded();
    expect(container.querySelector('.react-flow__attribution')).not.toBeNull();
  });
});
