/**
 * WorkflowDiagram against the real React Flow, as far as jsdom can take it:
 * the cards, their handles, their menus, the canvas lock and the delete key.
 * jsdom lays nothing out, so edges are not drawn and pointer gestures (drag,
 * connect, reconnect) cannot be performed here — WorkflowDiagram.wiring.test.tsx
 * calls the handlers the canvas registers, and workflowDiagramModel.test.ts
 * pins what each does to the document.
 */
import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { describe, it, expect, vi } from 'vitest';
import type { WorkflowJson } from '@buildpad/types';
import { WorkflowDiagram } from '../src/WorkflowDiagram';
import { emptyWorkflowJson, reviewWorkflowJson } from '../src/_fixtures';

function renderDiagram(props: Partial<React.ComponentProps<typeof WorkflowDiagram>> = {}) {
  const handlers = {
    onChange: vi.fn(),
    onEditState: vi.fn(),
    onEditCommand: vi.fn(),
    onAddState: vi.fn(),
    onAddCommand: vi.fn(),
  };
  const utils = render(
    <MantineProvider>
      <button type="button" data-testid="outside">
        outside
      </button>
      <WorkflowDiagram workflowJson={reviewWorkflowJson} {...handlers} {...props} />
    </MantineProvider>,
  );
  return { ...utils, ...handlers };
}

/** The card of the state named `name`. */
function card(name: string): HTMLElement {
  const found = screen.getAllByTestId('workflow-diagram-state').find((el) => el.dataset.state === name);
  if (!found) throw new Error(`no card for state ${name}`);
  return found;
}

/** React Flow's wrapper of the state named `name` (what a click selects and the keyboard acts on). */
function node(container: HTMLElement, name: string): HTMLElement {
  const found = container.querySelector<HTMLElement>(`.react-flow__node[data-id="${name}"]`);
  if (!found) throw new Error(`no node for state ${name}`);
  return found;
}

function handlesOf(container: HTMLElement, name: string): HTMLElement[] {
  return Array.from(node(container, name).querySelectorAll<HTMLElement>('.react-flow__handle'));
}

/** Presses and releases a key on `target`, giving React Flow's key handler time to act. */
async function press(target: HTMLElement, key: string) {
  await act(async () => {
    fireEvent.keyDown(target, { key, code: key });
    await new Promise((resolve) => {
      setTimeout(resolve, 20);
    });
    fireEvent.keyUp(target, { key, code: key });
    await new Promise((resolve) => {
      setTimeout(resolve, 20);
    });
  });
}

describe('WorkflowDiagram', () => {
  it('draws a card per state with its commands and its markers', () => {
    renderDiagram();
    expect(screen.getAllByTestId('workflow-diagram-state').map((el) => el.dataset.state)).toEqual([
      'Draft',
      'Review',
      'Published',
    ]);
    expect(within(card('Draft')).getByLabelText('Initial State')).toBeInTheDocument();
    expect(within(card('Published')).getByLabelText('End State')).toBeInTheDocument();
    expect(within(card('Published')).getByText('End state (no outgoing commands)')).toBeInTheDocument();
    expect(within(card('Review')).getByText('Approve')).toBeInTheDocument();
    expect(within(card('Review')).getByText('→ Published')).toBeInTheDocument();
  });

  it('tolerates a state stored without a commands array', () => {
    const flow = {
      initial_state: 'Lonely',
      states: [{ name: 'Lonely', isEndState: false }],
    } as unknown as WorkflowJson;
    renderDiagram({ workflowJson: flow });
    expect(within(card('Lonely')).getByText('Drag from a blue dot to another state')).toBeInTheDocument();
  });

  it('follows the color scheme: no card is painted a fixed white', () => {
    renderDiagram();
    const style = card('Draft').getAttribute('style') ?? '';
    expect(style).toContain('var(--mantine-color-body)');
    expect(style).not.toMatch(/white|#fff/i);
  });

  it('redraws from the document it is given', () => {
    const { rerender } = renderDiagram();
    rerender(
      <MantineProvider>
        <WorkflowDiagram
          workflowJson={{ ...reviewWorkflowJson, states: reviewWorkflowJson.states.slice(0, 2) }}
        />
      </MantineProvider>,
    );
    expect(screen.getAllByTestId('workflow-diagram-state').map((el) => el.dataset.state)).toEqual([
      'Draft',
      'Review',
    ]);
  });

  describe('the hint: drag states to reposition • edit a state from its menu • click a command to edit it', () => {
    // WF-19: the reference promised "Click to edit" for a state, and a click only selected it
    it('a click on a state selects it and edits nothing', () => {
      const { container, onEditState, onEditCommand } = renderDiagram();
      fireEvent.click(node(container, 'Review'));
      expect(node(container, 'Review')).toHaveClass('selected');
      expect(onEditState).not.toHaveBeenCalled();
      expect(onEditCommand).not.toHaveBeenCalled();
    });

    it('a state is edited from its menu', async () => {
      const { onEditState } = renderDiagram();
      fireEvent.click(screen.getByLabelText('Actions for state Review'));
      fireEvent.click(await screen.findByText('Edit State'));
      expect(onEditState).toHaveBeenCalledTimes(1);
      expect(onEditState).toHaveBeenCalledWith(reviewWorkflowJson.states[1]);
    });

    // A connection can only be dragged with a pointer; the menu is the way
    // to add a command from the keyboard
    it("a command is added from its state's menu, with no target yet", async () => {
      const { onAddCommand } = renderDiagram();
      fireEvent.click(screen.getByLabelText('Actions for state Review'));
      const item = (await screen.findByText('Add Command')).closest('button');
      expect(item).toHaveAttribute('role', 'menuitem');
      fireEvent.click(item as HTMLElement);
      expect(onAddCommand).toHaveBeenCalledTimes(1);
      expect(onAddCommand).toHaveBeenCalledWith('Review');
    });

    // By text, not by role: while the dropdown is being placed a role query
    // sees no menu item at all, and "not there" would pass for the wrong reason
    it("an end state's menu offers no Add Command: it has no outgoing commands", async () => {
      renderDiagram();
      fireEvent.click(screen.getByLabelText('Actions for state Published'));
      expect(await screen.findByText('Edit State')).toBeInTheDocument();
      expect(screen.getByText('Delete State')).toBeInTheDocument();
      expect(screen.queryByText('Add Command')).not.toBeInTheDocument();
    });

    it('a click on a command edits it', () => {
      const { onEditCommand } = renderDiagram();
      // By text, not by role: jsdom measures nothing, so React Flow keeps its
      // nodes `visibility: hidden` and a role query computes no name for them
      const row = within(card('Review')).getByText('Reject').closest('button');
      expect(row).not.toBeNull();
      fireEvent.click(row as HTMLElement);
      expect(onEditCommand).toHaveBeenCalledWith('Review', reviewWorkflowJson.states[1].commands[1]);
    });

    it('a state is dragged by its grip only', () => {
      const { container } = renderDiagram();
      expect(node(container, 'Draft').querySelector('.bp-workflow-drag-handle')).not.toBeNull();
    });
  });

  describe('deleting', () => {
    it('Delete State in the menu hands the document without the state to onChange', async () => {
      const { onChange } = renderDiagram();
      fireEvent.click(screen.getByLabelText('Actions for state Published'));
      fireEvent.click(await screen.findByText('Delete State'));
      expect(onChange).toHaveBeenCalledTimes(1);
      const next: WorkflowJson = onChange.mock.calls[0][0];
      expect(next.states.map((s) => s.name)).toEqual(['Draft', 'Review']);
      // The command that led to it is gone too
      expect(next.states[1].commands.map((c) => c.name)).toEqual(['Reject']);
    });

    it('the only state cannot be deleted', async () => {
      const single: WorkflowJson = {
        initial_state: 'Draft',
        states: [{ name: 'Draft', isEndState: false, commands: [] }],
      };
      const { onChange } = renderDiagram({ workflowJson: single });
      fireEvent.click(screen.getByLabelText('Actions for state Draft'));
      const item = (await screen.findByText('Delete State')).closest('button');
      expect(item).toBeDisabled();
      expect(onChange).not.toHaveBeenCalled();
    });

    it("a command's trash icon hands the document without the command to onChange", () => {
      const { onChange, onEditCommand } = renderDiagram();
      fireEvent.click(screen.getByLabelText('Delete command Reject'));
      const next: WorkflowJson = onChange.mock.calls[0][0];
      expect(next.states[1].commands.map((c) => c.name)).toEqual(['Approve']);
      expect(onEditCommand).not.toHaveBeenCalled();
    });

    // WF-16: Backspace removed the node from the canvas and left workflow_json alone
    it('Backspace on a selected state deletes it from the document, not just from the canvas', async () => {
      const { container, onChange } = renderDiagram();
      const published = node(container, 'Published');
      fireEvent.click(published);
      published.focus();
      await press(published, 'Backspace');

      await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
      const next: WorkflowJson = onChange.mock.calls[0][0];
      expect(next.states.map((s) => s.name)).toEqual(['Draft', 'Review']);
      // The canvas is controlled: until the new document comes back, the card stays
      expect(card('Published')).toBeInTheDocument();
    });

    it('the Delete key does the same', async () => {
      const { container, onChange } = renderDiagram();
      const published = node(container, 'Published');
      fireEvent.click(published);
      published.focus();
      await press(published, 'Delete');
      await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    });

    it('Backspace on the only state is refused: the document and the canvas keep it', async () => {
      const single: WorkflowJson = {
        initial_state: 'Draft',
        states: [{ name: 'Draft', isEndState: false, commands: [] }],
      };
      const { container, onChange } = renderDiagram({ workflowJson: single });
      const draft = node(container, 'Draft');
      fireEvent.click(draft);
      draft.focus();
      await press(draft, 'Backspace');
      expect(onChange).not.toHaveBeenCalled();
      expect(card('Draft')).toBeInTheDocument();
    });

    it('a key pressed on a control outside the diagram deletes nothing', async () => {
      const { container, onChange } = renderDiagram();
      fireEvent.click(node(container, 'Published'));
      const outside = screen.getByTestId('outside');
      outside.focus();
      await press(outside, 'Backspace');
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('connecting', () => {
    it('every handle of an ordinary state can start and end a connection', () => {
      const { container } = renderDiagram();
      const handles = handlesOf(container, 'Draft');
      expect(handles).toHaveLength(10);
      handles.forEach((handle) => {
        expect(handle).toHaveClass('connectable', 'connectablestart', 'connectableend');
      });
    });

    // WF-20: an end state cannot start an outgoing command
    it('no handle of an end state can start a connection; all can end one', () => {
      const { container } = renderDiagram();
      const handles = handlesOf(container, 'Published');
      expect(handles).toHaveLength(10);
      handles.forEach((handle) => {
        expect(handle).not.toHaveClass('connectablestart');
        expect(handle).toHaveClass('connectableend');
      });
    });

    // WF-15: 'Toggle Interactivity' left the node handles connectable
    it('locking the canvas makes every handle of every state unconnectable', () => {
      const { container } = renderDiagram();
      fireEvent.click(screen.getByRole('button', { name: /toggle interactivity/i }));

      const handles = Array.from(container.querySelectorAll<HTMLElement>('.react-flow__handle'));
      expect(handles).toHaveLength(30);
      handles.forEach((handle) => {
        expect(handle).not.toHaveClass('connectable');
        expect(handle).not.toHaveClass('connectablestart');
        expect(handle).not.toHaveClass('connectableend');
      });

      // ...and unlocking brings them back
      fireEvent.click(screen.getByRole('button', { name: /toggle interactivity/i }));
      handlesOf(container, 'Draft').forEach((handle) => {
        expect(handle).toHaveClass('connectable', 'connectablestart', 'connectableend');
      });
    });
  });

  describe('readOnly', () => {
    it('offers nothing that changes the machine', async () => {
      const { container, onChange, onEditCommand } = renderDiagram({ readOnly: true });

      expect(screen.queryByLabelText('Actions for state Review')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Delete command Reject')).not.toBeInTheDocument();
      expect(screen.queryByTestId('workflow-diagram-add-state')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /toggle interactivity/i })).not.toBeInTheDocument();
      expect(container.querySelector('.bp-workflow-drag-handle')).toBeNull();
      container.querySelectorAll('.react-flow__handle').forEach((handle) => {
        expect(handle).not.toHaveClass('connectable');
        expect(handle).not.toHaveClass('connectablestart');
      });

      // A command is listed, but a click on it edits nothing
      fireEvent.click(within(card('Review')).getByText('Reject'));
      expect(onEditCommand).not.toHaveBeenCalled();

      // The delete key is off
      const published = node(container, 'Published');
      fireEvent.click(published);
      published.focus();
      await press(published, 'Backspace');
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('adding a state', () => {
    it('the + button asks for a state', () => {
      const { onAddState } = renderDiagram();
      fireEvent.click(screen.getByTestId('workflow-diagram-add-state'));
      expect(onAddState).toHaveBeenCalledTimes(1);
    });

    it('an empty canvas says so and offers the first state', () => {
      const { onAddState } = renderDiagram({ workflowJson: emptyWorkflowJson });
      expect(screen.getByText('No states defined yet')).toBeInTheDocument();
      expect(screen.getByText('Add your first state')).toBeInTheDocument();
      fireEvent.click(screen.getByTestId('workflow-diagram-add-first-state'));
      expect(onAddState).toHaveBeenCalledTimes(1);
    });

    it('an empty read-only canvas offers nothing', () => {
      renderDiagram({ workflowJson: emptyWorkflowJson, readOnly: true });
      expect(screen.getByText('No states defined yet')).toBeInTheDocument();
      expect(screen.queryByTestId('workflow-diagram-add-first-state')).not.toBeInTheDocument();
    });
  });

  describe('attribution', () => {
    it("shows React Flow's attribution unless the consumer hides it", () => {
      const { container } = renderDiagram();
      expect(container.querySelector('.react-flow__attribution')).toHaveTextContent('React Flow');
    });

    it('hideAttribution removes it', () => {
      const { container } = renderDiagram({ hideAttribution: true });
      expect(container.querySelector('.react-flow__attribution')).toBeNull();
    });
  });

  it('takes its height from the height prop (600 by default)', () => {
    const { unmount } = renderDiagram();
    expect(screen.getByTestId('workflow-diagram')).toHaveStyle({ height: '600px' });
    unmount();
    renderDiagram({ height: 320 });
    expect(screen.getByTestId('workflow-diagram')).toHaveStyle({ height: '320px' });
  });

  it('reads its strings from the translations prop', () => {
    renderDiagram({ translations: { diagram: { endStateNote: 'Terminal' } } });
    expect(within(card('Published')).getByText('Terminal')).toBeInTheDocument();
  });
});
