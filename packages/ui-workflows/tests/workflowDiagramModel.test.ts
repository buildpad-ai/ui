/**
 * The state diagram as data. React Flow's pointer gestures (drag a node, draw
 * a connection, move an edge's end) cannot be driven in jsdom, so what each
 * gesture does to the document is pinned here, on the functions the canvas
 * hands the gesture to; WorkflowDiagram.test.tsx pins what jsdom can reach.
 */
import { describe, it, expect } from 'vitest';
import type { WorkflowJson } from '@buildpad/types';
import {
  buildWorkflowEdges,
  commandRefOfEdge,
  deleteFromWorkflowCanvas,
  dropWorkflowStates,
  findWorkflowCommand,
  layoutWorkflowStates,
  reconnectWorkflowEdge,
  requestWorkflowCommand,
  workflowEdgeId,
  workflowGridPosition,
} from '../src/workflowDiagramModel';
import { dashedWorkflowJson, reviewWorkflowJson, unpositionedWorkflowJson } from '../src/_fixtures';

describe('layoutWorkflowStates', () => {
  it('puts a state without a stored position on a three-column grid', () => {
    expect(workflowGridPosition(0)).toEqual({ x: 100, y: 100 });
    expect(workflowGridPosition(2)).toEqual({ x: 700, y: 100 });
    expect(workflowGridPosition(3)).toEqual({ x: 100, y: 300 });
    expect(layoutWorkflowStates(unpositionedWorkflowJson)).toEqual({
      Open: { x: 100, y: 100 },
      'In progress': { x: 400, y: 100 },
      Done: { x: 700, y: 100 },
      Cancelled: { x: 100, y: 300 },
    });
  });

  it('draws a stored position before anything else', () => {
    const layout = layoutWorkflowStates(reviewWorkflowJson, { Draft: { x: 1, y: 2 } });
    expect(layout.Draft).toEqual({ x: 60, y: 120 });
  });

  it('keeps where the canvas has a state that was never dragged', () => {
    const layout = layoutWorkflowStates(unpositionedWorkflowJson, { Done: { x: 12, y: 34 } });
    expect(layout.Done).toEqual({ x: 12, y: 34 });
    expect(layout.Open).toEqual({ x: 100, y: 100 });
  });
});

describe('buildWorkflowEdges', () => {
  it('draws one edge per command, labelled with the command and joined at its stored handles', () => {
    const edges = buildWorkflowEdges(reviewWorkflowJson);
    expect(edges.map((e) => [e.source, e.label, e.target])).toEqual([
      ['Draft', 'Submit', 'Review'],
      ['Review', 'Approve', 'Published'],
      ['Review', 'Reject', 'Draft'],
    ]);
    expect(edges[0]).toMatchObject({ sourceHandle: 'right-1', targetHandle: 'left-1' });
  });

  // WF-14: the reference recovered the state and the command by splitting the
  // edge id 'state-command-target' on '-'.
  it('carries the state and the command of every edge in its data', () => {
    const [edge] = buildWorkflowEdges(dashedWorkflowJson);
    expect(edge.data).toEqual({ state: 'draft-a', command: 'Go-review' });
    expect(commandRefOfEdge(edge)).toEqual({ state: 'draft-a', command: 'Go-review' });
  });

  it('gives two commands different ids where a dash-joined id would give one', () => {
    // 'a-b' + 'c' and 'a' + 'b-c' both read 'a-b-c-<target>' when joined on '-'
    expect(workflowEdgeId('a-b', 'c')).not.toBe(workflowEdgeId('a', 'b-c'));
    const flow: WorkflowJson = {
      initial_state: 'a',
      states: [
        { name: 'a', isEndState: false, commands: [{ name: 'b-c', next_state: 'x', actions: [], policies: [] }] },
        { name: 'a-b', isEndState: false, commands: [{ name: 'c', next_state: 'x', actions: [], policies: [] }] },
        { name: 'x', isEndState: true, commands: [] },
      ],
    };
    const ids = buildWorkflowEdges(flow).map((e) => e.id);
    expect(new Set(ids).size).toBe(2);
  });

  it('leaves a command whose target is no state off the canvas', () => {
    const flow: WorkflowJson = {
      initial_state: 'a',
      states: [
        { name: 'a', isEndState: false, commands: [{ name: 'go', next_state: 'gone', actions: [], policies: [] }] },
      ],
    };
    expect(buildWorkflowEdges(flow)).toEqual([]);
  });

  it('reads no command from an edge that carries none', () => {
    expect(commandRefOfEdge({})).toBeNull();
    expect(commandRefOfEdge({ data: { state: 'a' } })).toBeNull();
  });
});

describe('findWorkflowCommand', () => {
  it('finds the stored command an edge draws', () => {
    const found = findWorkflowCommand(reviewWorkflowJson, { state: 'Review', command: 'Reject' });
    expect(found?.command.next_state).toBe('Draft');
    expect(found?.state.name).toBe('Review');
  });

  it('answers null for a command that is gone', () => {
    expect(findWorkflowCommand(reviewWorkflowJson, { state: 'Review', command: 'Gone' })).toBeNull();
    expect(findWorkflowCommand(reviewWorkflowJson, null)).toBeNull();
  });
});

describe('reconnectWorkflowEdge (the canvas onReconnect)', () => {
  // WF-14: reconnecting an edge between dash-named states updates next_state
  it('moves the target of a command between states whose names contain dashes', () => {
    const [edge] = buildWorkflowEdges(dashedWorkflowJson);
    const result = reconnectWorkflowEdge(dashedWorkflowJson, edge, {
      source: 'draft-a',
      target: 'done-c',
      sourceHandle: 'bottom-2',
      targetHandle: 'left-1',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.workflowJson.states[0].commands[0]).toMatchObject({
      name: 'Go-review',
      next_state: 'done-c',
      sourceHandle: 'bottom-2',
      targetHandle: 'left-1',
    });
  });

  it('is found by its data even when the edge id says something else', () => {
    const [edge] = buildWorkflowEdges(dashedWorkflowJson);
    const result = reconnectWorkflowEdge(
      dashedWorkflowJson,
      { ...edge, id: 'draft-a-Go-review-review-b' },
      { source: 'draft-a', target: 'done-c' },
    );
    expect(result.ok && result.workflowJson.states[0].commands[0].next_state).toBe('done-c');
  });

  // WF-20: an end state must not get an outgoing command
  it('refuses to move a command onto an end state', () => {
    const [submit] = buildWorkflowEdges(reviewWorkflowJson);
    expect(
      reconnectWorkflowEdge(reviewWorkflowJson, submit, { source: 'Published', target: 'Review' }),
    ).toEqual({
      ok: false,
      problem: { code: 'endStateSource', error: 'End states cannot have outgoing commands' },
    });
  });

  it('refuses an edge that carries no command', () => {
    expect(reconnectWorkflowEdge(reviewWorkflowJson, {}, { source: 'Draft', target: 'Review' })).toMatchObject({
      ok: false,
      problem: { code: 'unknownCommand' },
    });
  });
});

describe('requestWorkflowCommand (the canvas onConnect)', () => {
  it('asks for a command between two states, with the handles it was drawn between', () => {
    expect(
      requestWorkflowCommand(reviewWorkflowJson, {
        source: 'Draft',
        target: 'Published',
        sourceHandle: 'top-1',
        targetHandle: 'top-3',
      }),
    ).toEqual({ ok: true, from: 'Draft', to: 'Published', sourceHandle: 'top-1', targetHandle: 'top-3' });
  });

  it('leaves out handles the connection does not name', () => {
    expect(
      requestWorkflowCommand(reviewWorkflowJson, { source: 'Draft', target: 'Published', sourceHandle: null }),
    ).toEqual({ ok: true, from: 'Draft', to: 'Published', sourceHandle: undefined, targetHandle: undefined });
  });

  // WF-20: an end state cannot start an outgoing command
  it('refuses a connection drawn out of an end state', () => {
    expect(requestWorkflowCommand(reviewWorkflowJson, { source: 'Published', target: 'Draft' })).toEqual({
      ok: false,
      problem: { code: 'endStateSource', error: 'End states cannot have outgoing commands' },
    });
  });

  it('refuses a connection from a state to itself', () => {
    expect(requestWorkflowCommand(reviewWorkflowJson, { source: 'Draft', target: 'Draft' })).toMatchObject({
      ok: false,
      problem: { code: 'selfTransition' },
    });
  });
});

describe('deleteFromWorkflowCanvas (the canvas Backspace/Delete)', () => {
  // WF-16: the reference removed the node from the canvas and left the document alone
  it('deletes a selected state from the document, with the commands that led to it', () => {
    const next = deleteFromWorkflowCanvas(reviewWorkflowJson, { nodes: [{ id: 'Published' }], edges: [] });
    expect(next.states.map((s) => s.name)).toEqual(['Draft', 'Review']);
    expect(next.states[1].commands.map((c) => c.name)).toEqual(['Reject']);
  });

  it('deletes a selected edge as its command', () => {
    const edges = buildWorkflowEdges(reviewWorkflowJson);
    const next = deleteFromWorkflowCanvas(reviewWorkflowJson, { nodes: [], edges: [edges[2]] });
    expect(next.states[1].commands.map((c) => c.name)).toEqual(['Approve']);
    expect(next.states).toHaveLength(3);
  });

  it('copes with the edges React Flow lists beside a deleted state', () => {
    // Deleting a node hands over its connected edges as well
    const edges = buildWorkflowEdges(reviewWorkflowJson);
    const next = deleteFromWorkflowCanvas(reviewWorkflowJson, { nodes: [{ id: 'Draft' }], edges: [edges[0], edges[2]] });
    expect(next.states.map((s) => s.name)).toEqual(['Review', 'Published']);
    expect(next.initial_state).toBe('Review');
    expect(next.states[0].commands.map((c) => c.name)).toEqual(['Approve']);
  });

  it('refuses to delete the last state: a selection of every state leaves one', () => {
    const next = deleteFromWorkflowCanvas(reviewWorkflowJson, {
      nodes: [{ id: 'Draft' }, { id: 'Review' }, { id: 'Published' }],
      edges: [],
    });
    expect(next.states.map((s) => s.name)).toEqual(['Published']);
    expect(next.initial_state).toBe('Published');

    const single: WorkflowJson = {
      initial_state: 'Draft',
      states: [{ name: 'Draft', isEndState: false, commands: [] }],
    };
    expect(deleteFromWorkflowCanvas(single, { nodes: [{ id: 'Draft' }], edges: [] })).toBe(single);
  });

  it('returns the same document when nothing could be deleted', () => {
    expect(deleteFromWorkflowCanvas(reviewWorkflowJson, { nodes: [], edges: [] })).toBe(reviewWorkflowJson);
    expect(deleteFromWorkflowCanvas(reviewWorkflowJson, { nodes: [{ id: 'Nowhere' }], edges: [{}] })).toBe(
      reviewWorkflowJson,
    );
  });
});

describe('dropWorkflowStates (the canvas onNodeDragStop)', () => {
  it('stores the position of every state that was dragged', () => {
    const next = dropWorkflowStates(unpositionedWorkflowJson, [
      { id: 'Open', position: { x: 10, y: 20 } },
      { id: 'Done', position: { x: 30, y: 40 } },
    ]);
    expect(next.states[0].position).toEqual({ x: 10, y: 20 });
    expect(next.states[2].position).toEqual({ x: 30, y: 40 });
    expect(next.states[1].position).toBeUndefined();
  });

  it('returns the same document when no state moved', () => {
    expect(dropWorkflowStates(reviewWorkflowJson, [{ id: 'Draft', position: { x: 60, y: 120 } }])).toBe(
      reviewWorkflowJson,
    );
  });
});
