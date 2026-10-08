/**
 * WorkflowStateModal unit tests: what it saves, what it refuses, and that
 * saving a stored state unchanged changes nothing.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { describe, it, expect, vi } from 'vitest';
import type { WorkflowJson, WorkflowJsonState } from '@buildpad/types';
import { WorkflowStateModal } from '../src/WorkflowStateModal';
import { emptyWorkflowJson, reviewWorkflowJson } from '../src/_fixtures';
import { asStored } from './_stored';

function renderModal(props: Partial<React.ComponentProps<typeof WorkflowStateModal>> = {}) {
  const onSave = vi.fn();
  const onClose = vi.fn();
  render(
    <MantineProvider>
      <WorkflowStateModal
        opened
        onClose={onClose}
        state={null}
        workflowJson={reviewWorkflowJson}
        onSave={onSave}
        {...props}
      />
    </MantineProvider>,
  );
  return { onSave, onClose };
}

const nameInput = () => screen.getByTestId('workflow-state-name') as HTMLInputElement;
const endSwitch = () => screen.getByTestId('workflow-state-end-switch') as HTMLInputElement;
const initialSwitch = () => screen.getByTestId('workflow-state-initial-switch') as HTMLInputElement;
const save = () => fireEvent.click(screen.getByTestId('workflow-state-save-btn'));

describe('WorkflowStateModal', () => {
  it('adds a state: trimmed name, no commands, not initial in a workflow that has states', () => {
    const { onSave, onClose } = renderModal();
    expect(screen.getByText('Add State', { selector: 'h2, h2 *' })).toBeInTheDocument();
    expect(initialSwitch().checked).toBe(false);

    fireEvent.change(nameInput(), { target: { value: '  Archived ' } });
    save();

    expect(onSave).toHaveBeenCalledWith({ name: 'Archived', commands: [], isEndState: false }, true, false);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('turns Initial State on for the first state of a workflow', () => {
    const { onSave } = renderModal({ workflowJson: emptyWorkflowJson });
    expect(initialSwitch().checked).toBe(true);
    fireEvent.change(nameInput(), { target: { value: 'Draft' } });
    save();
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ name: 'Draft' }), true, true);
  });

  it('opens a stored state with its name, its end-state flag and whether it is the initial state', () => {
    renderModal({ state: reviewWorkflowJson.states[0] });
    expect(screen.getByText('Edit State')).toBeInTheDocument();
    expect(nameInput().value).toBe('Draft');
    expect(endSwitch().checked).toBe(false);
    expect(initialSwitch().checked).toBe(true);
    expect(screen.getByTestId('workflow-state-save-btn')).toHaveTextContent('Save Changes');
  });

  it('requires a name and shows the error under the field', () => {
    const { onSave, onClose } = renderModal();
    save();
    expect(screen.getByText('State name is required')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();

    // Typing clears it
    fireEvent.change(nameInput(), { target: { value: 'x' } });
    expect(screen.queryByText('State name is required')).not.toBeInTheDocument();
  });

  it('refuses the name of another state, in any case', () => {
    const { onSave } = renderModal();
    fireEvent.change(nameInput(), { target: { value: 'review' } });
    save();
    expect(screen.getByText('A state with this name already exists')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('lets a state keep its own name', () => {
    const { onSave } = renderModal({ state: reviewWorkflowJson.states[1] });
    save();
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  // WF-18: re-saving a positioned state unchanged must not flag unsaved changes.
  // The reference rebuilt the state as name, commands, isEndState, position.
  it('saves a stored, positioned state unchanged as the very same JSON', () => {
    const stored: WorkflowJson = asStored(reviewWorkflowJson);
    const state = stored.states[0];
    // The stored order is not the order the dialog lists its fields in
    expect(Object.keys(state)).toEqual(['name', 'commands', 'position', 'isEndState']);

    const { onSave } = renderModal({ state, workflowJson: stored });
    save();

    const saved: WorkflowJsonState = onSave.mock.calls[0][0];
    expect(JSON.stringify(saved)).toBe(JSON.stringify(state));
    expect(onSave.mock.calls[0].slice(1)).toEqual([false, true]);
  });

  it('keeps the commands and the position of a state that is renamed', () => {
    const { onSave } = renderModal({ state: reviewWorkflowJson.states[1] });
    fireEvent.change(nameInput(), { target: { value: 'In review' } });
    save();
    const saved: WorkflowJsonState = onSave.mock.calls[0][0];
    expect(saved.name).toBe('In review');
    expect(saved.commands).toBe(reviewWorkflowJson.states[1].commands);
    expect(saved.position).toEqual({ x: 420, y: 120 });
  });

  describe('End State', () => {
    // WF-20: turning End State on for a state that already has commands is refused
    it('cannot be turned on for a state that has commands', () => {
      const { onSave, onClose } = renderModal({ state: reviewWorkflowJson.states[1] });
      fireEvent.click(endSwitch());
      expect(endSwitch().checked).toBe(true);
      save();

      expect(
        screen.getByText('This state has outgoing commands. Delete them before making it an end state.'),
      ).toBeInTheDocument();
      expect(onSave).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();

      // Turning it back off clears the refusal and the state saves
      fireEvent.click(endSwitch());
      expect(
        screen.queryByText('This state has outgoing commands. Delete them before making it an end state.'),
      ).not.toBeInTheDocument();
      save();
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ isEndState: false }), false, false);
    });

    it('can be turned on for a state without commands', () => {
      const state: WorkflowJsonState = { name: 'Parked', isEndState: false, commands: [] };
      const { onSave } = renderModal({
        state,
        workflowJson: { ...reviewWorkflowJson, states: [...reviewWorkflowJson.states, state] },
      });
      fireEvent.click(endSwitch());
      save();
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ name: 'Parked', isEndState: true }), false, false);
    });

    it('can be turned on for a new state', () => {
      const { onSave } = renderModal();
      fireEvent.change(nameInput(), { target: { value: 'Archived' } });
      fireEvent.click(endSwitch());
      save();
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ isEndState: true }), true, false);
    });

    it('still saves a state stored as an end state with commands, so it can be renamed', () => {
      const legacy: WorkflowJsonState = {
        name: 'Published',
        isEndState: true,
        commands: [{ name: 'Reopen', next_state: 'Draft', actions: [], policies: [] }],
      };
      const { onSave } = renderModal({
        state: legacy,
        workflowJson: { ...reviewWorkflowJson, states: [...reviewWorkflowJson.states.slice(0, 2), legacy] },
      });
      fireEvent.change(nameInput(), { target: { value: 'Live' } });
      save();
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ name: 'Live', isEndState: true }), false, false);
    });
  });

  it('Cancel closes without saving', () => {
    const { onSave, onClose } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('renders nothing while closed', () => {
    renderModal({ opened: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('reads its strings from the translations prop', () => {
    renderModal({ translations: { stateModal: { fields: { name: 'Nama Status' } } } });
    expect(screen.getByText('Nama Status')).toBeInTheDocument();
  });
});
