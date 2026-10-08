/**
 * WorkflowCommandModal unit tests: what it saves and keeps, what it refuses
 * and where it shows the refusal, and where its policy options come from.
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { describe, it, expect, vi } from 'vitest';
import type { WorkflowJson, WorkflowJsonCommand } from '@buildpad/types';
import { WorkflowCommandModal } from '../src/WorkflowCommandModal';
import type { WorkflowPolicyOption } from '../src/workflowPolicies';
import { mockPolicyOptions, reviewWorkflowJson } from '../src/_fixtures';
import { asStored } from './_stored';

const submit = reviewWorkflowJson.states[0].commands[0];

function renderModal(props: Partial<React.ComponentProps<typeof WorkflowCommandModal>> = {}) {
  const onSave = vi.fn();
  const onClose = vi.fn();
  const utils = render(
    <MantineProvider>
      <WorkflowCommandModal
        opened
        onClose={onClose}
        command={null}
        stateName="Draft"
        workflowJson={reviewWorkflowJson}
        onSave={onSave}
        policies={mockPolicyOptions}
        {...props}
      />
    </MantineProvider>,
  );
  return { ...utils, onSave, onClose };
}

const nameInput = () => screen.getByTestId('workflow-command-name') as HTMLInputElement;
const targetInput = () => screen.getByTestId('workflow-command-target') as HTMLInputElement;
const save = () => fireEvent.click(screen.getByTestId('workflow-command-save-btn'));
const openTab = (tab: 'general' | 'actions' | 'policies') =>
  fireEvent.click(screen.getByTestId(`workflow-command-tab-${tab}`));
const tabSelected = (tab: 'general' | 'actions' | 'policies') =>
  screen.getByTestId(`workflow-command-tab-${tab}`).getAttribute('aria-selected') === 'true';

/** The options of the dropdown an opened Select or MultiSelect input controls. */
function optionsOf(input: HTMLElement): HTMLElement[] {
  const listbox = document.getElementById(input.getAttribute('aria-controls') ?? '');
  if (!listbox) throw new Error('the dropdown is not open');
  return Array.from(listbox.querySelectorAll<HTMLElement>('[role="option"]'));
}

/** Picks an option of the Target State select. hidden: the dropdown stays display:none in jsdom. */
async function pickTarget(label: string) {
  fireEvent.click(targetInput());
  fireEvent.click(await screen.findByRole('option', { name: label, hidden: true }));
}

describe('WorkflowCommandModal', () => {
  describe('adding', () => {
    it('saves a new command with the target and the handles of the connection that was drawn', () => {
      const { onSave, onClose } = renderModal({
        targetState: 'Published',
        sourceHandle: 'top-1',
        targetHandle: 'top-3',
      });
      expect(targetInput().value).toBe('Published (End State)');

      fireEvent.change(nameInput(), { target: { value: ' Publish now ' } });
      save();

      expect(onSave).toHaveBeenCalledWith(
        {
          name: 'Publish now',
          next_state: 'Published',
          actions: [],
          policies: [],
          sourceHandle: 'top-1',
          targetHandle: 'top-3',
        },
        true,
      );
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("offers every other state as the target, never the command's own state", async () => {
      renderModal();
      fireEvent.click(targetInput());
      await waitFor(() =>
        expect(optionsOf(targetInput()).map((o) => o.textContent)).toEqual(['Review', 'Published (End State)']),
      );
    });

    it('says so when the workflow has no other state to lead to', () => {
      renderModal({
        workflowJson: { initial_state: 'Draft', states: [{ name: 'Draft', isEndState: false, commands: [] }] },
      });
      expect(screen.getByTestId('workflow-command-no-targets')).toHaveTextContent('No target states available');
      expect(targetInput()).toBeDisabled();
    });

    it('shows the route the command takes', async () => {
      renderModal();
      expect(screen.getByTestId('workflow-command-route')).toHaveTextContent('From: Draft → To: ...');
      await pickTarget('Review');
      expect(screen.getByTestId('workflow-command-route')).toHaveTextContent('From: Draft → To: Review');
    });
  });

  describe('Target State', () => {
    // WF-10: the field kept the text of a state that was no longer chosen
    it('clears its text when the chosen state is deselected', async () => {
      const { onSave } = renderModal();
      await pickTarget('Review');
      expect(targetInput().value).toBe('Review');

      // Choosing the selected option again deselects it
      await pickTarget('Review');
      expect(targetInput().value).toBe('');

      // ...and the save is refused for the field that is visibly empty
      fireEvent.change(nameInput(), { target: { value: 'Go' } });
      save();
      expect(screen.getByText('Target state is required')).toBeInTheDocument();
      expect(onSave).not.toHaveBeenCalled();
    });
  });

  describe('editing a stored command', () => {
    // WF-11: saving a module-key-gated command unchanged keeps its module_access_keys
    it('keeps module_access_keys, which the form has no field for', () => {
      const { onSave } = renderModal({ command: submit });
      save();
      const saved: WorkflowJsonCommand = onSave.mock.calls[0][0];
      expect(saved.module_access_keys).toEqual(['content:submit']);
      expect(onSave.mock.calls[0][1]).toBe(false);
    });

    it('keeps any other key it does not know', () => {
      const command = { ...submit, priority: 3, ui: { color: 'red' } } as WorkflowJsonCommand;
      const { onSave } = renderModal({ command });
      fireEvent.change(nameInput(), { target: { value: 'Send' } });
      save();
      expect(onSave.mock.calls[0][0]).toMatchObject({ name: 'Send', priority: 3, ui: { color: 'red' } });
    });

    // WF-17: re-saving a command unchanged must not flag unsaved changes.
    // jsonb returns name, actions, policies, next_state; the reference rebuilt
    // name, next_state, actions, policies.
    it('saves a stored command unchanged as the very same JSON', () => {
      const stored: WorkflowJson = asStored(reviewWorkflowJson);
      const command = stored.states[1].commands[0];
      expect(Object.keys(command).slice(0, 4)).toEqual(['name', 'actions', 'policies', 'next_state']);

      const { onSave } = renderModal({ command, stateName: 'Review', workflowJson: stored });
      save();

      expect(JSON.stringify(onSave.mock.calls[0][0])).toBe(JSON.stringify(command));
    });

    it('lets a command keep its own name, and refuses the name of a sibling', () => {
      const { onSave } = renderModal({ command: reviewWorkflowJson.states[1].commands[0], stateName: 'Review' });
      save();
      expect(onSave).toHaveBeenCalledTimes(1);

      fireEvent.change(nameInput(), { target: { value: 'reject' } });
      save();
      expect(screen.getByText('A command with this name already exists in this state')).toBeInTheDocument();
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    // WF-21: a command stored without actions/policies crashed the dialog
    it('opens a command stored without actions and policies arrays', () => {
      const bare = { name: 'Go', next_state: 'Review' } as unknown as WorkflowJsonCommand;
      const { onSave } = renderModal({ command: bare });

      expect(nameInput().value).toBe('Go');
      expect(screen.getByTestId('workflow-command-tab-actions')).toHaveTextContent('Actions (0)');
      expect(screen.getByTestId('workflow-command-tab-policies')).toHaveTextContent('Policies (0)');

      save();
      expect(onSave.mock.calls[0][0]).toMatchObject({ name: 'Go', next_state: 'Review', actions: [], policies: [] });
    });

    it('opens an action stored without parameters', () => {
      const command = {
        name: 'Go',
        next_state: 'Review',
        actions: [{ name: 'Ping', event_name: 'x.ping' }],
        policies: [],
      } as unknown as WorkflowJsonCommand;
      renderModal({ command });
      openTab('actions');
      fireEvent.click(screen.getByText('Ping'));
      expect((screen.getByTestId('workflow-command-action-parameters-0') as HTMLTextAreaElement).value).toBe('{}');
    });
  });

  describe('a refused save opens the tab that holds the failing field', () => {
    // WF-12: the error was only on the General tab, whichever tab Save was pressed on
    it('from the Actions tab, a missing name opens General and marks the field', () => {
      const { onSave } = renderModal({ targetState: 'Review' });
      openTab('actions');
      expect(tabSelected('actions')).toBe(true);

      save();

      expect(tabSelected('general')).toBe(true);
      expect(screen.getByText('Command name is required')).toBeInTheDocument();
      expect(onSave).not.toHaveBeenCalled();
    });

    it('from the Policies tab, a missing target opens General and marks only that field', () => {
      renderModal();
      fireEvent.change(nameInput(), { target: { value: 'Go' } });
      openTab('policies');
      save();

      expect(tabSelected('general')).toBe(true);
      expect(screen.getAllByText('Target state is required')).toHaveLength(1);
      expect(nameInput()).not.toHaveAttribute('aria-invalid', 'true');
    });

    it('a duplicate name is shown under the name, not under the target as well', () => {
      renderModal({ stateName: 'Review', targetState: 'Draft' });
      fireEvent.change(nameInput(), { target: { value: 'Approve' } });
      save();
      expect(screen.getAllByText('A command with this name already exists in this state')).toHaveLength(1);
      expect(nameInput()).toHaveAttribute('aria-invalid', 'true');
      expect(targetInput()).not.toHaveAttribute('aria-invalid', 'true');
    });

    // WF-13: invalid Parameters JSON is reported instead of silently discarded
    it('from the General tab, invalid Parameters JSON opens Actions and the failing action', async () => {
      const { onSave, onClose } = renderModal({ command: submit });
      openTab('actions');
      fireEvent.click(screen.getByText('Notify reviewers'));
      const parameters = () => screen.getByTestId('workflow-command-action-parameters-0') as HTMLTextAreaElement;
      fireEvent.change(parameters(), { target: { value: '{"subject": ' } });

      // Close the action and go back to General, then save from there
      fireEvent.click(screen.getByText('Notify reviewers'));
      openTab('general');
      save();

      expect(onSave).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
      expect(tabSelected('actions')).toBe(true);
      await waitFor(() => expect(screen.getByText(/^Invalid JSON: /)).toBeInTheDocument());
      // The text the user typed is still there to fix
      expect(parameters().value).toBe('{"subject": ');
      expect(parameters()).toHaveAttribute('aria-invalid', 'true');
    });

    it('marks invalid Parameters on blur, without a message yet', () => {
      renderModal({ command: submit });
      openTab('actions');
      fireEvent.click(screen.getByText('Notify reviewers'));
      const parameters = screen.getByTestId('workflow-command-action-parameters-0');
      fireEvent.change(parameters, { target: { value: 'not json' } });
      fireEvent.blur(parameters);
      expect(parameters).toHaveAttribute('aria-invalid', 'true');
      expect(screen.queryByText(/^Invalid JSON: /)).not.toBeInTheDocument();

      // Fixing the text clears the mark
      fireEvent.change(parameters, { target: { value: '{"a": 1}' } });
      expect(parameters).not.toHaveAttribute('aria-invalid', 'true');
    });
  });

  describe('actions', () => {
    it('adds an action and saves its name, event and parsed parameters', () => {
      const { onSave } = renderModal({ targetState: 'Review' });
      fireEvent.change(nameInput(), { target: { value: 'Go' } });
      openTab('actions');
      expect(screen.getByText(/No actions configured/)).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('workflow-command-add-action'));
      expect(screen.getByTestId('workflow-command-tab-actions')).toHaveTextContent('Actions (1)');
      fireEvent.click(screen.getByText('Action 1'));
      fireEvent.change(screen.getByTestId('workflow-command-action-name-0'), { target: { value: 'Promote' } });
      fireEvent.change(screen.getByTestId('workflow-command-action-event-0'), {
        target: { value: 'xtr.item.promote' },
      });
      const parameters = screen.getByTestId('workflow-command-action-parameters-0') as HTMLTextAreaElement;
      fireEvent.change(parameters, { target: { value: '{"force":true}' } });
      fireEvent.blur(parameters);
      // A valid text is formatted on blur
      expect(parameters.value).toBe('{\n  "force": true\n}');

      save();
      expect(onSave.mock.calls[0][0].actions).toEqual([
        { name: 'Promote', event_name: 'xtr.item.promote', parameters: { force: true } },
      ]);
    });

    it('reads an emptied Parameters field as no parameters', () => {
      const { onSave } = renderModal({ command: submit });
      openTab('actions');
      fireEvent.click(screen.getByText('Notify reviewers'));
      fireEvent.change(screen.getByTestId('workflow-command-action-parameters-0'), { target: { value: '' } });
      save();
      expect(onSave.mock.calls[0][0].actions[0].parameters).toEqual({});
    });

    it('removes an action', () => {
      const { onSave } = renderModal({ command: submit });
      openTab('actions');
      fireEvent.click(screen.getByText('Notify reviewers'));
      // hidden: the accordion panel has not finished opening in jsdom (no transitions)
      fireEvent.click(screen.getByRole('button', { name: 'Remove Action', hidden: true }));
      expect(screen.getByTestId('workflow-command-tab-actions')).toHaveTextContent('Actions (0)');
      save();
      expect(onSave.mock.calls[0][0].actions).toEqual([]);
    });

    it('explains version promotion, with the event name set apart', () => {
      renderModal();
      openTab('actions');
      expect(screen.getByText('xtr.item.promote').tagName).toBe('CODE');
    });
  });

  describe('policies', () => {
    it('offers the policies it was given and names the selected ones', async () => {
      renderModal({ command: reviewWorkflowJson.states[1].commands[0], stateName: 'Review' });
      openTab('policies');
      expect(screen.getByTestId('workflow-command-tab-policies')).toHaveTextContent('Policies (2)');
      expect(screen.getByText('Selected Policies:')).toBeInTheDocument();
      // Named in the picker's pills and in the summary below it
      expect(screen.getAllByText('Reviewer').length).toBeGreaterThanOrEqual(2);
      expect(screen.getAllByText('Publisher').length).toBeGreaterThanOrEqual(2);
    });

    // The reference fetched /api/policies itself, which answers 25 rows
    it('is not limited to a first page: every policy it is given can be chosen', async () => {
      const many: WorkflowPolicyOption[] = Array.from({ length: 60 }, (_, index) => ({
        id: `policy-${index + 1}`,
        name: `Policy ${index + 1}`,
      }));
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      const { onSave } = renderModal({ policies: many, targetState: 'Review' });
      fireEvent.change(nameInput(), { target: { value: 'Go' } });
      openTab('policies');

      const picker = screen.getByTestId('workflow-command-policies');
      fireEvent.click(picker);
      await waitFor(() => expect(optionsOf(picker)).toHaveLength(60));
      fireEvent.click(screen.getByRole('option', { name: 'Policy 60', hidden: true }));

      save();
      expect(onSave.mock.calls[0][0].policies).toEqual(['policy-60']);
      // ...and the dialog asked no backend for them
      expect(fetchSpy).not.toHaveBeenCalled();
      fetchSpy.mockRestore();
    });

    it('loads its options through loadPolicies when it has no list, each time it opens', async () => {
      const loadPolicies = vi.fn().mockResolvedValue(mockPolicyOptions);
      const { rerender, onSave } = renderModal({
        policies: undefined,
        loadPolicies,
        command: reviewWorkflowJson.states[1].commands[1],
        stateName: 'Review',
      });
      expect(loadPolicies).toHaveBeenCalledTimes(1);
      openTab('policies');
      await waitFor(() => expect(screen.getAllByText('Reviewer').length).toBeGreaterThan(0));

      // Re-rendering with a new function identity does not load again
      rerender(
        <MantineProvider>
          <WorkflowCommandModal
            opened
            onClose={() => {}}
            command={reviewWorkflowJson.states[1].commands[1]}
            stateName="Review"
            workflowJson={reviewWorkflowJson}
            onSave={onSave}
            loadPolicies={() => loadPolicies()}
          />
        </MantineProvider>,
      );
      expect(loadPolicies).toHaveBeenCalledTimes(1);
    });

    it('disables the picker while the policies load', async () => {
      let resolve: (list: WorkflowPolicyOption[]) => void = () => {};
      const loadPolicies = () =>
        new Promise<WorkflowPolicyOption[]>((r) => {
          resolve = r;
        });
      renderModal({ policies: undefined, loadPolicies });
      openTab('policies');
      expect(screen.getByTestId('workflow-command-policies')).toBeDisabled();
      expect(screen.getByPlaceholderText('Loading policies...')).toBeInTheDocument();

      resolve(mockPolicyOptions);
      await waitFor(() => expect(screen.getByTestId('workflow-command-policies')).not.toBeDisabled());
    });

    it('says when the policies could not be loaded, and keeps the stored ids on save', async () => {
      const loadPolicies = vi.fn().mockRejectedValue(new Error('Permission denied'));
      const { onSave } = renderModal({
        policies: undefined,
        loadPolicies,
        command: reviewWorkflowJson.states[1].commands[0],
        stateName: 'Review',
      });
      openTab('policies');
      await waitFor(() => expect(screen.getByText('Failed to load policies')).toBeInTheDocument());

      save();
      expect(onSave.mock.calls[0][0].policies).toEqual(['policy-reviewer', 'policy-publisher']);
    });

    it('warns that a command with no policy and no module access key is open to all users', () => {
      renderModal({ command: { name: 'Reopen', next_state: 'Review', actions: [], policies: [] } });
      openTab('policies');
      expect(screen.getByTestId('workflow-command-open-warning')).toHaveTextContent(
        'This command will be available to all users',
      );
      expect(screen.queryByTestId('workflow-command-keys-notice')).not.toBeInTheDocument();
    });

    it('does not warn once a policy is selected', () => {
      renderModal({ command: reviewWorkflowJson.states[1].commands[1], stateName: 'Review' });
      openTab('policies');
      expect(screen.queryByTestId('workflow-command-open-warning')).not.toBeInTheDocument();
    });

    // From the review of the Studio fix: a command gated only by module access
    // keys is not "available to all users"
    it('a command gated only by module access keys is told so, not that it is open', () => {
      const keyGated: WorkflowJsonCommand = {
        name: 'Export',
        next_state: 'Review',
        actions: [],
        policies: [],
        module_access_keys: ['reports:export', 'reports:admin'],
      };
      renderModal({ command: keyGated });
      openTab('policies');

      expect(screen.getByTestId('workflow-command-keys-notice')).toHaveTextContent(
        'This command can also be run by users who hold one of these module access keys: reports:export, reports:admin',
      );
      expect(screen.queryByTestId('workflow-command-open-warning')).not.toBeInTheDocument();
    });

    it('names the module access keys beside the policies of a command that has both', () => {
      renderModal({ command: submit });
      openTab('policies');
      expect(screen.getByTestId('workflow-command-keys-notice')).toHaveTextContent('content:submit');
      expect(screen.queryByTestId('workflow-command-open-warning')).not.toBeInTheDocument();
    });
  });

  it('Cancel closes without saving', () => {
    const { onSave, onClose } = renderModal({ command: submit });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('renders nothing while closed, and loads no policies', () => {
    const loadPolicies = vi.fn().mockResolvedValue([]);
    renderModal({ opened: false, policies: undefined, loadPolicies });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(loadPolicies).not.toHaveBeenCalled();
  });
});
