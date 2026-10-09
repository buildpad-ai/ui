/**
 * WorkflowDetail unit tests: loading (and the three ways a load can end
 * without a definition), editing through the diagram and its dialogs, the
 * unsaved-changes badge, saving, and the read-only editor. `@buildpad/hooks`
 * is mocked; the diagram is the real one.
 */
import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

/** The host gives the editor that is on screen other props (another `id`, above all). */
function reopen(
  rerender: (ui: React.ReactElement) => void,
  props: React.ComponentProps<typeof WorkflowDetail>,
) {
  rerender(
    <MantineProvider>
      <WorkflowDetail {...props} />
    </MantineProvider>,
  );
}

/** A request the test answers when it chooses to. */
function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
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
const loaded = async () => {
  await waitFor(() => expect(nameInput().value).toBe('Article review'));
  // The diagram draws its cards a render after the form has its values; a test
  // that reads a card straight after `loaded()` must not get ahead of it
  await waitFor(() => expect(screen.queryAllByTestId('workflow-diagram-state').length).toBeGreaterThan(0));
};

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

    // Drawing a connection needs a pointer; this is the editor's keyboard path
    it("adds a command from a state's menu: the dialog asks for the target", async () => {
      renderDetail();
      await loaded();

      fireEvent.click(screen.getByLabelText('Actions for state Draft'));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Add Command' }));

      const target = (await screen.findByTestId('workflow-command-target')) as HTMLInputElement;
      expect(target.value).toBe('');
      fireEvent.change(screen.getByTestId('workflow-command-name'), { target: { value: 'Publish now' } });
      fireEvent.click(target);
      fireEvent.click(await screen.findByRole('option', { name: 'Published (End State)', hidden: true }));
      fireEvent.click(screen.getByTestId('workflow-command-save-btn'));

      await waitFor(() => expect(within(card('Draft')).getByText('Publish now')).toBeInTheDocument());
      expect(within(card('Draft')).getByText('→ Published')).toBeInTheDocument();
      expect(screen.getByTestId('workflow-detail-stat-commands')).toHaveTextContent('4');
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

    // The gate of a command is `policies` OR `module_access_keys`, and the
    // dialogs have no field for the keys. A command gated by keys alone that
    // loses them anywhere between the dialogs and the request is saved open
    // to every signed-in user.
    it('a command gated only by module access keys keeps its gate through every edit that reaches the save', async () => {
      const keyGated: WorkflowJson = {
        ...reviewWorkflowJson,
        states: reviewWorkflowJson.states.map((state) =>
          state.name === 'Draft'
            ? { ...state, commands: [{ ...state.commands[0], policies: [], module_access_keys: ['content:submit'] }] }
            : state,
        ),
      };
      mocks.getDefinition.mockResolvedValue({ ...mockWorkflow, workflow_json: asStored(keyGated) });
      renderDetail();
      await loaded();

      // 1. The command itself, in its dialog: renamed
      fireEvent.click(within(card('Draft')).getByText('Submit'));
      fireEvent.change(await screen.findByTestId('workflow-command-name'), { target: { value: 'Send' } });
      fireEvent.click(screen.getByTestId('workflow-command-save-btn'));
      await waitFor(() => expect(within(card('Draft')).getByText('Send')).toBeInTheDocument());

      // One dialog has to be gone before the next opens: its title is "Edit State" too
      const renameState = async (from: string, to: string) => {
        fireEvent.click(screen.getByLabelText(`Actions for state ${from}`));
        fireEvent.click(await screen.findByRole('menuitem', { name: 'Edit State' }));
        fireEvent.change(await screen.findByTestId('workflow-state-name'), { target: { value: to } });
        fireEvent.click(screen.getByTestId('workflow-state-save-btn'));
        await waitFor(() => expect(card(to)).toBeInTheDocument());
        await waitFor(() => expect(screen.queryByTestId('workflow-state-save-btn')).not.toBeInTheDocument());
      };

      // 2. The state that owns it: renamed
      await renameState('Draft', 'New');

      // 3. The state it leads to: renamed, so its next_state is rewritten
      await renameState('Review', 'Check');
      await waitFor(() => expect(within(card('New')).getByText('→ Check')).toBeInTheDocument());

      fireEvent.click(saveButton());
      await waitFor(() => expect(mocks.updateDefinition).toHaveBeenCalledTimes(1));
      const [, edits] = mocks.updateDefinition.mock.calls[0];
      const sent = edits.workflow_json.states.find((state: { name: string }) => state.name === 'New').commands;
      expect(sent).toHaveLength(1);
      expect(sent[0]).toMatchObject({
        name: 'Send',
        next_state: 'Check',
        policies: [],
        module_access_keys: ['content:submit'],
      });
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

    it('keeps what was typed while the save was in flight, as an edit that is not saved yet', async () => {
      const request = deferred<void>();
      mocks.updateDefinition.mockImplementation(() => request.promise);
      renderDetail();
      await loaded();

      fireEvent.change(nameInput(), { target: { value: 'Sent with the save' } });
      fireEvent.click(saveButton());
      expect(mocks.updateDefinition).toHaveBeenCalledWith(mockWorkflow.id, { name: 'Sent with the save' });
      // The request is slow, and the inputs stay open
      fireEvent.change(descriptionInput(), { target: { value: 'typed after the click' } });

      await act(async () => {
        request.resolve();
      });
      await waitFor(() => expect(saveButton()).not.toHaveAttribute('data-loading', 'true'));
      expect(nameInput().value).toBe('Sent with the save');
      expect(descriptionInput().value).toBe('typed after the click');
      expect(screen.getByTestId('workflow-detail-unsaved-badge')).toBeInTheDocument();

      // The next Save sends that edit, and only that
      mocks.updateDefinition.mockResolvedValue(undefined);
      fireEvent.click(saveButton());
      await waitFor(() =>
        expect(mocks.updateDefinition).toHaveBeenLastCalledWith(mockWorkflow.id, {
          description: 'typed after the click',
        }),
      );
    });

    it('a save answered after another definition was opened is not drawn over that definition', async () => {
      const request = deferred<void>();
      mocks.updateDefinition.mockImplementation(() => request.promise);
      const { rerender, onSaved } = renderDetail();
      await loaded();

      fireEvent.change(nameInput(), { target: { value: 'Saved late' } });
      fireEvent.click(saveButton());
      // The host opens another definition in the same editor before the answer is in
      mocks.getDefinition.mockResolvedValue({ ...mockWorkflow, id: 'other', name: 'Other flow' });
      reopen(rerender, { id: 'other', onSaved });
      await waitFor(() => expect(nameInput().value).toBe('Other flow'));

      await act(async () => {
        request.resolve();
      });
      await waitFor(() =>
        expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: mockWorkflow.id, name: 'Saved late' })),
      );
      // Still the definition that is open, untouched and with nothing to save
      expect(nameInput().value).toBe('Other flow');
      expect(screen.getByRole('heading', { name: 'Other flow' })).toBeInTheDocument();
      expect(screen.queryByTestId('workflow-detail-unsaved-badge')).not.toBeInTheDocument();
      await waitFor(() => expect(saveButton()).not.toHaveAttribute('data-loading', 'true'));
      expect(saveButton()).toBeDisabled();
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

    // A host that does not navigate in onSaved (or is slow to) left an enabled
    // Create button on a form that had already been stored
    it('edits the definition it created when the host does not navigate: a second Save updates it, and nothing is created twice', async () => {
      const { onSaved } = renderDetail({ id: 'new' });
      fireEvent.change(nameInput(), { target: { value: 'Flow' } });
      await addState('Draft', { first: true });
      fireEvent.click(saveButton());

      // The editor is the stored definition's now: its title, and a Save that waits for an edit
      expect(await screen.findByRole('heading', { name: 'Flow' })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'New Workflow Definition' })).not.toBeInTheDocument();
      expect(screen.queryByText('New Workflow')).not.toBeInTheDocument();
      expect(saveButton()).toHaveTextContent('Save Changes');
      expect(saveButton()).toBeDisabled();
      expect(screen.queryByTestId('workflow-detail-unsaved-badge')).not.toBeInTheDocument();
      expect(onSaved).toHaveBeenCalledTimes(1);
      // Shown from what was sent, without a load for it
      expect(mocks.getDefinition).not.toHaveBeenCalled();

      // The second click of a double click that arrives after the answer
      fireEvent.click(saveButton());
      expect(mocks.createDefinition).toHaveBeenCalledTimes(1);
      expect(mocks.updateDefinition).not.toHaveBeenCalled();

      fireEvent.change(nameInput(), { target: { value: 'Flow v2' } });
      fireEvent.click(saveButton());
      await waitFor(() => expect(mocks.updateDefinition).toHaveBeenCalledWith('new-id-1', { name: 'Flow v2' }));
      expect(mocks.createDefinition).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(onSaved).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'new-id-1', name: 'Flow v2' })));
      expect(show).toHaveBeenLastCalledWith(expect.objectContaining({ message: 'Workflow updated successfully' }));
    });

    it('loads the created definition once when the host then navigates to it', async () => {
      const { rerender } = renderDetail({ id: 'new' });
      fireEvent.change(nameInput(), { target: { value: 'Flow' } });
      await addState('Draft', { first: true });
      fireEvent.click(saveButton());
      await screen.findByRole('heading', { name: 'Flow' });

      // As a host may do in onSaved: open the new definition's own route
      mocks.getDefinition.mockResolvedValue({ ...mockWorkflow, id: 'new-id-1', name: 'Flow' });
      reopen(rerender, { id: 'new-id-1' });
      await waitFor(() => expect(mocks.getDefinition).toHaveBeenCalledWith('new-id-1'));
      await waitFor(() => expect(screen.getAllByTestId('workflow-diagram-state')).toHaveLength(3));
      expect(mocks.getDefinition).toHaveBeenCalledTimes(1);
      expect(saveButton()).toBeDisabled();
    });

    it('a new definition opened after one was created here starts empty again', async () => {
      const { rerender } = renderDetail({ id: 'new' });
      fireEvent.change(nameInput(), { target: { value: 'Flow' } });
      await addState('Draft', { first: true });
      fireEvent.click(saveButton());
      await screen.findByRole('heading', { name: 'Flow' });

      reopen(rerender, { id: mockWorkflow.id });
      await loaded();
      reopen(rerender, { id: 'new' });
      expect(await screen.findByRole('heading', { name: 'New Workflow Definition' })).toBeInTheDocument();
      expect(nameInput().value).toBe('');
      expect(saveButton()).toHaveTextContent('Create Workflow');
      expect(saveButton()).not.toBeDisabled();

      // And it creates: the definition created before is not the one saved to
      fireEvent.change(nameInput(), { target: { value: 'Second flow' } });
      await addState('Open', { first: true });
      mocks.createDefinition.mockResolvedValue('new-id-2');
      fireEvent.click(saveButton());
      await waitFor(() => expect(mocks.createDefinition).toHaveBeenCalledTimes(2));
      expect(mocks.updateDefinition).not.toHaveBeenCalled();
    });

    it('a create answered after another definition was opened does not take that editor over', async () => {
      const request = deferred<string>();
      mocks.createDefinition.mockImplementation(() => request.promise);
      const { rerender, onSaved } = renderDetail({ id: 'new' });
      fireEvent.change(nameInput(), { target: { value: 'Flow' } });
      await addState('Draft', { first: true });
      fireEvent.click(saveButton());

      reopen(rerender, { id: mockWorkflow.id, onSaved });
      await loaded();
      await act(async () => {
        request.resolve('new-id-1');
      });
      await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: 'new-id-1', name: 'Flow' })));
      expect(nameInput().value).toBe('Article review');
      expect(screen.queryByTestId('workflow-detail-unsaved-badge')).not.toBeInTheDocument();

      // A save here goes to the definition that is open, not to the one that was created
      fireEvent.change(nameInput(), { target: { value: 'Article review v2' } });
      await waitFor(() => expect(saveButton()).not.toBeDisabled());
      fireEvent.click(saveButton());
      await waitFor(() =>
        expect(mocks.updateDefinition).toHaveBeenCalledWith(mockWorkflow.id, { name: 'Article review v2' }),
      );
    });

    it('a user who may create but not update gets the definition it created read-only', async () => {
      grant(['read', 'create']);
      renderDetail({ id: 'new' });
      fireEvent.change(nameInput(), { target: { value: 'Flow' } });
      await addState('Draft', { first: true });
      fireEvent.click(saveButton());

      await screen.findByRole('heading', { name: 'Flow' });
      await waitFor(() => expect(screen.queryByTestId('workflow-detail-save-btn')).not.toBeInTheDocument());
      expect(nameInput()).toHaveAttribute('readonly');
      expect(screen.getByTestId('workflow-detail-cancel-btn')).toHaveTextContent('Back');
      expect(mocks.createDefinition).toHaveBeenCalledTimes(1);
    });

    it('is refused outright to a user who may not create', async () => {
      grant(['read', 'update']);
      renderDetail({ id: 'new' });
      expect(await screen.findByTestId('workflow-detail-access-denied')).toBeInTheDocument();
      expect(screen.queryByTestId('workflow-detail-name')).not.toBeInTheDocument();
    });
  });

  // Both backends drop a column the caller's read grant withholds. A document
  // that was not answered is not an empty machine: drawn as one, "Add your
  // first state" and Save would replace the stored states, commands and gates.
  describe('a definition answered without its document', () => {
    const withheld = { id: mockWorkflow.id, name: mockWorkflow.name, description: mockWorkflow.description };
    const formLoaded = () => waitFor(() => expect(nameInput().value).toBe('Article review'));

    it('says the states and commands are withheld instead of drawing an empty machine', async () => {
      mocks.getDefinition.mockResolvedValue(withheld);
      renderDetail();
      await formLoaded();

      expect(screen.getByTestId('workflow-detail-document-withheld')).toHaveTextContent(
        'Your access to this definition does not include its states and commands',
      );
      expect(screen.queryByTestId('workflow-diagram')).not.toBeInTheDocument();
      expect(screen.queryByTestId('workflow-diagram-empty')).not.toBeInTheDocument();
      expect(screen.queryByTestId('workflow-diagram-add-first-state')).not.toBeInTheDocument();
      expect(screen.queryByTestId('workflow-detail-diagram-hint')).not.toBeInTheDocument();
      // No "0 states" either: the count is not known
      expect(screen.queryByTestId('workflow-detail-stat-states')).not.toBeInTheDocument();
      expect(screen.queryByTestId('workflow-detail-states-overview')).not.toBeInTheDocument();
    });

    it('still saves the name and the description, and never sends a document', async () => {
      mocks.getDefinition.mockResolvedValue(withheld);
      const { onSaved } = renderDetail();
      await formLoaded();
      expect(saveButton()).toBeDisabled();

      fireEvent.change(nameInput(), { target: { value: 'Article review v2' } });
      fireEvent.click(saveButton());

      await waitFor(() => expect(mocks.updateDefinition).toHaveBeenCalledTimes(1));
      expect(mocks.updateDefinition).toHaveBeenCalledWith(mockWorkflow.id, { name: 'Article review v2' });
      await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
      // The saved record is not handed an empty machine it never had
      expect(onSaved.mock.calls[0][0]).toEqual({ ...withheld, name: 'Article review v2' });
      expect(screen.getByTestId('workflow-detail-document-withheld')).toBeInTheDocument();
    });

    it('still requires a name', async () => {
      mocks.getDefinition.mockResolvedValue(withheld);
      renderDetail();
      await formLoaded();

      fireEvent.change(nameInput(), { target: { value: '  ' } });
      fireEvent.click(saveButton());

      expect(show).toHaveBeenCalledWith(expect.objectContaining({ message: 'Workflow name is required' }));
      expect(mocks.updateDefinition).not.toHaveBeenCalled();
    });

    it('a stored document that is empty is still an empty machine to add to', async () => {
      mocks.getDefinition.mockResolvedValue({ ...withheld, workflow_json: { initial_state: '', states: [] } });
      renderDetail();
      await formLoaded();

      expect(screen.queryByTestId('workflow-detail-document-withheld')).not.toBeInTheDocument();
      expect(screen.getByTestId('workflow-diagram-add-first-state')).toBeInTheDocument();
      expect(screen.getByTestId('workflow-detail-stat-states')).toHaveTextContent('0');
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
