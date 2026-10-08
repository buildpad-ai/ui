/**
 * The state diagram as data: how a `workflow_json` document becomes React Flow
 * nodes and edges, and how a gesture on the canvas becomes the next document.
 *
 * `WorkflowDiagram` draws what these functions return and hands every gesture
 * to one of them. They are kept out of the component because React Flow's
 * pointer gestures (drag, connect, reconnect, keyboard delete) cannot be
 * driven in jsdom: what a gesture does to the document is tested here, and the
 * component only has to pass the gesture on.
 *
 * Nothing here touches React or the DOM. The document operations themselves
 * (`removeWorkflowState`, `reconnectWorkflowCommand`, …) live in
 * `@buildpad/utils`.
 */
import type { WorkflowJson, WorkflowJsonCommand, WorkflowJsonState, WorkflowStatePosition } from '@buildpad/types';
import {
  findWorkflowConnectionProblem,
  moveWorkflowState,
  reconnectWorkflowCommand,
  removeWorkflowCommand,
  removeWorkflowState,
  type WorkflowCommandRef,
  type WorkflowConnection,
  type WorkflowConnectionProblem,
} from '@buildpad/utils';

/** React Flow node type of a state card. */
export const WORKFLOW_STATE_NODE = 'workflowState';

/** Width of a state card, in canvas pixels. */
export const WORKFLOW_NODE_WIDTH = 240;

/**
 * Ids of the ten connection points of a state card, by side. A command stores
 * the two it was drawn between (`sourceHandle`, `targetHandle`), so the ids are
 * part of the stored document: do not rename them.
 */
export const WORKFLOW_HANDLES = {
  top: ['top-1', 'top-2', 'top-3'],
  bottom: ['bottom-1', 'bottom-2', 'bottom-3'],
  left: ['left-1', 'left-2'],
  right: ['right-1', 'right-2'],
} as const;

/**
 * Where the state at `index` sits while it has no stored position: a grid of
 * three columns. The position is not written to the document until the state
 * is dragged, so opening a definition never reads as an edit.
 */
export function workflowGridPosition(index: number): WorkflowStatePosition {
  return {
    x: 100 + (index % 3) * 300,
    y: 100 + Math.floor(index / 3) * 200,
  };
}

/**
 * Where each state is drawn, by state name: its stored position, else where
 * the canvas has it now (`current`, for a state that was laid out but never
 * dragged), else its grid slot.
 */
export function layoutWorkflowStates(
  workflowJson: WorkflowJson,
  current: Record<string, WorkflowStatePosition | undefined> = {},
): Record<string, WorkflowStatePosition> {
  const layout: Record<string, WorkflowStatePosition> = {};
  workflowJson.states.forEach((state, index) => {
    layout[state.name] = state.position ?? current[state.name] ?? workflowGridPosition(index);
  });
  return layout;
}

/** What an edge of the diagram carries: the command it draws. */
export interface WorkflowEdgeData extends Record<string, unknown> {
  /** Name of the state that owns the command */
  state: string;
  /** Name of the command */
  command: string;
}

/** One edge of the diagram, before styling: a command from its state to its target. */
export interface WorkflowEdgeModel {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label: string;
  data: WorkflowEdgeData;
}

/**
 * Id of the edge that draws a command. Unique because state names are unique
 * in a workflow and command names are unique in a state. It is an opaque key:
 * nothing reads the state or the command back out of it (a name may contain
 * any character, the separator included) — an edge carries both in its `data`.
 */
export function workflowEdgeId(stateName: string, commandName: string): string {
  return JSON.stringify([stateName, commandName]);
}

/**
 * One edge per command whose target is a state of the workflow. A command that
 * leads to a state that does not exist (a document written through the API) is
 * left off the canvas — React Flow cannot draw an edge to nothing — and stays
 * listed on its state's card, where it can be edited or deleted.
 */
export function buildWorkflowEdges(workflowJson: WorkflowJson): WorkflowEdgeModel[] {
  const names = new Set(workflowJson.states.map((s) => s.name));
  const edges: WorkflowEdgeModel[] = [];
  workflowJson.states.forEach((state) => {
    (state.commands ?? []).forEach((command) => {
      if (!names.has(command.next_state)) return;
      edges.push({
        id: workflowEdgeId(state.name, command.name),
        source: state.name,
        target: command.next_state,
        sourceHandle: command.sourceHandle,
        targetHandle: command.targetHandle,
        label: command.name,
        data: { state: state.name, command: command.name },
      });
    });
  });
  return edges;
}

/** The command an edge draws, read from its `data`; null for an edge that carries none. */
export function commandRefOfEdge(edge: { data?: Record<string, unknown> | null }): WorkflowCommandRef | null {
  const state = edge.data?.state;
  const command = edge.data?.command;
  return typeof state === 'string' && typeof command === 'string' ? { state, command } : null;
}

/** The stored command an edge draws, with the state that owns it; null when it is gone. */
export function findWorkflowCommand(
  workflowJson: WorkflowJson,
  ref: WorkflowCommandRef | null,
): { state: WorkflowJsonState; command: WorkflowJsonCommand } | null {
  if (!ref) return null;
  const state = workflowJson.states.find((s) => s.name === ref.state);
  const command = state?.commands?.find((c) => c.name === ref.command);
  return state && command ? { state, command } : null;
}

/** What a connection drawn between two states asks for. */
export type WorkflowConnectRequest =
  | {
      ok: true;
      /** State the new command leaves */
      from: string;
      /** State the new command leads to */
      to: string;
      sourceHandle?: string;
      targetHandle?: string;
    }
  | { ok: false; problem: WorkflowConnectionProblem };

/**
 * A connection the user drew, as the request to add a command — or the reason
 * there is none to add: an end state cannot start a command, a state cannot
 * lead to itself, and both ends have to be states.
 */
export function requestWorkflowCommand(
  workflowJson: WorkflowJson,
  connection: WorkflowConnection,
): WorkflowConnectRequest {
  const problem = findWorkflowConnectionProblem(workflowJson, connection.source, connection.target);
  if (problem) return { ok: false, problem };
  return {
    ok: true,
    from: connection.source as string,
    to: connection.target as string,
    sourceHandle: connection.sourceHandle || undefined,
    targetHandle: connection.targetHandle || undefined,
  };
}

/**
 * The document after the edge `edge` is dropped on `connection`; see
 * `reconnectWorkflowCommand`. The command is read from the edge's `data`.
 */
export function reconnectWorkflowEdge(
  workflowJson: WorkflowJson,
  edge: { data?: Record<string, unknown> | null },
  connection: WorkflowConnection,
): ReturnType<typeof reconnectWorkflowCommand> {
  const ref = commandRefOfEdge(edge);
  if (!ref) {
    return { ok: false, problem: { code: 'unknownCommand', error: 'The command no longer exists' } };
  }
  return reconnectWorkflowCommand(workflowJson, ref, connection);
}

/**
 * The document after the canvas is asked to delete `nodes` and `edges` (the
 * Backspace or Delete key on a selection).
 *
 * The canvas never deletes on its own: this is the deletion, and the canvas
 * redraws from its result. States go first (each takes the commands that led
 * to it), then the commands of the remaining edges. Deleting the last state is
 * refused, so a selection of every state leaves one. The same document is
 * returned when nothing could be deleted.
 */
export function deleteFromWorkflowCanvas(
  workflowJson: WorkflowJson,
  selection: {
    nodes: ReadonlyArray<{ id: string }>;
    edges: ReadonlyArray<{ data?: Record<string, unknown> | null }>;
  },
): WorkflowJson {
  let next = workflowJson;
  selection.nodes.forEach((node) => {
    next = removeWorkflowState(next, node.id);
  });
  selection.edges.forEach((edge) => {
    const ref = commandRefOfEdge(edge);
    if (ref) next = removeWorkflowCommand(next, ref.state, ref.command);
  });
  return next;
}

/**
 * The document after `nodes` were dropped where they are now. The same
 * document is returned when none of them moved.
 */
export function dropWorkflowStates(
  workflowJson: WorkflowJson,
  nodes: ReadonlyArray<{ id: string; position: WorkflowStatePosition }>,
): WorkflowJson {
  let next = workflowJson;
  nodes.forEach((node) => {
    next = moveWorkflowState(next, node.id, node.position);
  });
  return next;
}
