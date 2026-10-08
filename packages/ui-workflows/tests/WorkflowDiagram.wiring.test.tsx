/**
 * What WorkflowDiagram registers with React Flow, and what each registered
 * handler does when React Flow calls it.
 *
 * jsdom cannot perform a drag, a connection or a reconnection, so `ReactFlow`
 * is replaced here by a stub that keeps the props it was given. Each test
 * calls the handler React Flow would call, with the arguments React Flow
 * would pass, and checks what reaches `onChange` / `onAddCommand`. That pins
 * the wiring of the component; that a real pointer gesture reaches the
 * handler is React Flow's side, which a browser tier has to cover.
 */
import React from 'react';
import { act, render } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Edge, ReactFlowProps } from '@xyflow/react';
import type { WorkflowJson } from '@buildpad/types';
import { WorkflowDiagram } from '../src/WorkflowDiagram';
import { dashedWorkflowJson, reviewWorkflowJson } from '../src/_fixtures';

const captured = vi.hoisted(() => ({ props: null as unknown }));

vi.mock('@xyflow/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xyflow/react')>();
  return {
    ...actual,
    ReactFlow: (props: Record<string, unknown>) => {
      captured.props = props;
      return null;
    },
  };
});

function flowProps(): ReactFlowProps {
  return captured.props as ReactFlowProps;
}

function renderDiagram(props: Partial<React.ComponentProps<typeof WorkflowDiagram>> = {}) {
  const handlers = {
    onChange: vi.fn(),
    onEditState: vi.fn(),
    onEditCommand: vi.fn(),
    onAddState: vi.fn(),
    onAddCommand: vi.fn(),
  };
  render(
    <MantineProvider>
      <WorkflowDiagram workflowJson={reviewWorkflowJson} {...handlers} {...props} />
    </MantineProvider>,
  );
  return handlers;
}

function edgeOf(state: string, command: string): Edge {
  const edge = (flowProps().edges ?? []).find((e) => e.data?.state === state && e.data?.command === command);
  if (!edge) throw new Error(`no edge for ${state}/${command}`);
  return edge;
}

const connection = (source: string, target: string, sourceHandle: string | null = null, targetHandle: string | null = null) => ({
  source,
  target,
  sourceHandle,
  targetHandle,
});

let show: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  captured.props = null;
  show = vi.spyOn(notifications, 'show').mockImplementation(() => '');
});

describe('WorkflowDiagram wiring', () => {
  describe('edges', () => {
    // WF-14: carry {state, command} in edge data
    it('hands React Flow one edge per command, each carrying its state and command', () => {
      renderDiagram({ workflowJson: dashedWorkflowJson });
      expect((flowProps().edges ?? []).map((e) => [e.source, e.target, e.label, e.data])).toEqual([
        ['draft-a', 'review-b', 'Go-review', { state: 'draft-a', command: 'Go-review' }],
      ]);
    });

    it('makes edges reconnectable only while the diagram can be edited', () => {
      renderDiagram();
      expect(flowProps().edgesReconnectable).toBe(true);
      expect((flowProps().edges ?? []).every((e) => e.reconnectable === true)).toBe(true);
    });
  });

  describe('onReconnect', () => {
    // WF-14: reconnecting an edge between dash-named states updates next_state
    it('moves the target of a command between dash-named states', () => {
      const { onChange } = renderDiagram({ workflowJson: dashedWorkflowJson });
      act(() => {
        flowProps().onReconnect?.(
          edgeOf('draft-a', 'Go-review'),
          connection('draft-a', 'done-c', 'bottom-1', 'left-2'),
        );
      });
      expect(onChange).toHaveBeenCalledTimes(1);
      const next: WorkflowJson = onChange.mock.calls[0][0];
      expect(next.states[0].commands[0]).toMatchObject({
        name: 'Go-review',
        next_state: 'done-c',
        sourceHandle: 'bottom-1',
        targetHandle: 'left-2',
      });
    });

    it('moves a command to the state its source end was dropped on, keeping its module access keys', () => {
      const { onChange } = renderDiagram();
      act(() => {
        flowProps().onReconnect?.(edgeOf('Draft', 'Submit'), connection('Review', 'Published'));
      });
      const next: WorkflowJson = onChange.mock.calls[0][0];
      expect(next.states[0].commands).toEqual([]);
      expect(next.states[1].commands.map((c) => c.name)).toEqual(['Approve', 'Reject', 'Submit']);
      expect(next.states[1].commands[2].module_access_keys).toEqual(['content:submit']);
    });

    // WF-20: an end state must not get an outgoing command
    it('refuses to move a command onto an end state, and says why', () => {
      const { onChange } = renderDiagram();
      act(() => {
        flowProps().onReconnect?.(edgeOf('Draft', 'Submit'), connection('Published', 'Review'));
      });
      expect(onChange).not.toHaveBeenCalled();
      expect(show).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'End states cannot have outgoing commands', color: 'red' }),
      );
    });
  });

  describe('onConnect', () => {
    it('opens Add Command for a connection between two states, with its handles', () => {
      const { onAddCommand } = renderDiagram();
      act(() => {
        flowProps().onConnect?.(connection('Draft', 'Published', 'top-1', 'top-3'));
      });
      expect(onAddCommand).toHaveBeenCalledWith('Draft', 'Published', 'top-1', 'top-3');
    });

    // WF-20: refuse in onConnect
    it('refuses a connection drawn out of an end state, with the dictionary sentence', () => {
      const { onAddCommand } = renderDiagram();
      act(() => {
        flowProps().onConnect?.(connection('Published', 'Draft'));
      });
      expect(onAddCommand).not.toHaveBeenCalled();
      expect(show).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Validation Error',
          message: 'End states cannot have outgoing commands',
        }),
      );
    });

    it('ignores a connection from a state to itself', () => {
      const { onAddCommand } = renderDiagram();
      act(() => {
        flowProps().onConnect?.(connection('Draft', 'Draft'));
      });
      expect(onAddCommand).not.toHaveBeenCalled();
      expect(show).not.toHaveBeenCalled();
    });
  });

  describe('onBeforeDelete', () => {
    // WF-16: every canvas deletion either updates the document or is refused
    it('deletes from the document and never lets the canvas delete on its own', async () => {
      const { onChange } = renderDiagram();
      const allowed = await flowProps().onBeforeDelete?.({
        nodes: [{ id: 'Published', position: { x: 0, y: 0 }, data: {} }],
        edges: [],
      });
      expect(allowed).toBe(false);
      const next: WorkflowJson = onChange.mock.calls[0][0];
      expect(next.states.map((s) => s.name)).toEqual(['Draft', 'Review']);
    });

    it('deletes a selected edge as its command', async () => {
      const { onChange } = renderDiagram();
      const allowed = await flowProps().onBeforeDelete?.({ nodes: [], edges: [edgeOf('Review', 'Reject')] });
      expect(allowed).toBe(false);
      const next: WorkflowJson = onChange.mock.calls[0][0];
      expect(next.states[1].commands.map((c) => c.name)).toEqual(['Approve']);
    });

    it('refuses the last state without touching the document', async () => {
      const single: WorkflowJson = {
        initial_state: 'Draft',
        states: [{ name: 'Draft', isEndState: false, commands: [] }],
      };
      const { onChange } = renderDiagram({ workflowJson: single });
      const allowed = await flowProps().onBeforeDelete?.({
        nodes: [{ id: 'Draft', position: { x: 0, y: 0 }, data: {} }],
        edges: [],
      });
      expect(allowed).toBe(false);
      expect(onChange).not.toHaveBeenCalled();
    });

    it('listens for Backspace and Delete while editable, and for no key when read-only', () => {
      renderDiagram();
      expect(flowProps().deleteKeyCode).toEqual(['Backspace', 'Delete']);
      renderDiagram({ readOnly: true });
      expect(flowProps().deleteKeyCode).toBeNull();
    });
  });

  describe('onNodeDragStop', () => {
    it('stores where a state was dropped', () => {
      const { onChange } = renderDiagram();
      const dropped = { id: 'Review', position: { x: 500, y: 40 }, data: {} };
      act(() => {
        flowProps().onNodeDragStop?.({} as React.MouseEvent, dropped, [dropped]);
      });
      const next: WorkflowJson = onChange.mock.calls[0][0];
      expect(next.states[1].position).toEqual({ x: 500, y: 40 });
    });

    it('does not report a change for a drop that moved nothing', () => {
      const { onChange } = renderDiagram();
      const dropped = { id: 'Review', position: { x: 420, y: 120 }, data: {} };
      act(() => {
        flowProps().onNodeDragStop?.({} as React.MouseEvent, dropped, [dropped]);
      });
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('onEdgeClick', () => {
    // WF-19: "Click a command to edit it" — an arrow is a command too
    it('edits the command an arrow draws', () => {
      const { onEditCommand } = renderDiagram();
      act(() => {
        flowProps().onEdgeClick?.({} as React.MouseEvent, edgeOf('Review', 'Reject'));
      });
      expect(onEditCommand).toHaveBeenCalledWith('Review', reviewWorkflowJson.states[1].commands[1]);
    });

    it('registers no click handler for a state: a click selects, the menu edits', () => {
      renderDiagram();
      expect(flowProps().onNodeClick).toBeUndefined();
      expect(flowProps().onNodeDoubleClick).toBeUndefined();
    });
  });

  describe('readOnly', () => {
    it('registers no gesture that changes the machine', () => {
      renderDiagram({ readOnly: true });
      const props = flowProps();
      expect(props.onConnect).toBeUndefined();
      expect(props.onReconnect).toBeUndefined();
      expect(props.onNodeDragStop).toBeUndefined();
      expect(props.onEdgeClick).toBeUndefined();
      expect(props.nodesDraggable).toBe(false);
      expect(props.nodesConnectable).toBe(false);
      expect(props.edgesReconnectable).toBe(false);
      expect((props.edges ?? []).every((e) => e.reconnectable === false)).toBe(true);
    });
  });

  describe('attribution', () => {
    it('is shown by default and hidden on request', () => {
      renderDiagram();
      expect(flowProps().proOptions).toEqual({ hideAttribution: false });
      renderDiagram({ hideAttribution: true });
      expect(flowProps().proOptions).toEqual({ hideAttribution: true });
    });
  });
});
