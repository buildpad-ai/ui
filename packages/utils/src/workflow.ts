/**
 * Pure helpers for the workflow definition editor and the assignment form.
 *
 * A dialog hands the editor an edited copy of a stored command or state. The
 * copy is built here so that it keeps what the form does not edit: keys the
 * editor has no field for (a command's `module_access_keys` gate, which the
 * transition route enforces) and the stored key order, which an
 * unsaved-changes check that compares `JSON.stringify` output depends on.
 *
 * The checks that refuse a save live here too. Each names its failing field
 * with a `code` a component translates, beside the English sentence the
 * reference admin UI (buildpad-daas) shows. An action's Parameters field is
 * free text: text that is not JSON must stop the save instead of leaving the
 * last parameters that did parse in its place.
 *
 * So do the gestures of the state diagram (delete a state or a command, drop a
 * state, move a command's edge): the canvas is a view of the document, and a
 * gesture is a function from one document to the next.
 *
 * Ported from buildpad-daas `lib/workflows/definition-editor.ts`,
 * `lib/utils/workflow-filter-rule.ts`, the save handlers of
 * `app/[lang]/workflows/[id]/page.tsx` and the handlers of
 * `components/WorkflowDiagram.tsx`. Nothing here touches the DOM, React or the
 * network.
 */
import type {
  WorkflowActionParameters,
  WorkflowFilterRule,
  WorkflowJson,
  WorkflowJsonAction,
  WorkflowJsonCommand,
  WorkflowJsonState,
  WorkflowStatePosition,
} from '@buildpad/types';

// ============================================================================
// Reading a stored document
// ============================================================================

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * A stored `workflow_json` in the shape the editor can walk: `states` is an
 * array, every state has a `commands` array and every command has `actions`
 * and `policies` arrays.
 *
 * Both backends validate only `initial_state` and `states` on a write, so a
 * document written through the API can lack the inner arrays, and a dialog
 * that maps over them crashes. Everything else is kept as stored: unknown
 * keys, key order, and a state or command that is otherwise incomplete. A
 * value that is not a document at all (null, a non-JSON string) reads as an
 * empty machine. The input is never mutated.
 */
export function normalizeWorkflowJson(value: unknown): WorkflowJson {
  let raw = value;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = null;
    }
  }
  if (!isPlainObject(raw)) {
    return { initial_state: '', states: [] };
  }

  const states = Array.isArray(raw.states) ? raw.states : [];

  return {
    ...raw,
    initial_state: typeof raw.initial_state === 'string' ? raw.initial_state : '',
    states: states.filter(isPlainObject).map((state) => {
      const commands = Array.isArray(state.commands) ? state.commands : [];
      return {
        ...state,
        commands: commands.filter(isPlainObject).map((command) => ({
          ...command,
          actions: Array.isArray(command.actions) ? command.actions : [],
          policies: Array.isArray(command.policies) ? command.policies : [],
        })),
      };
    }),
  } as WorkflowJson;
}

// ============================================================================
// Add/Edit Command dialog
// ============================================================================

/** The fields of the Add/Edit Command dialog. */
export interface WorkflowCommandForm {
  name: string;
  nextState: string;
  actions: WorkflowJsonAction[];
  policies: string[];
  /** Handle ids of the connection a new command was drawn with. */
  sourceHandle?: string;
  targetHandle?: string;
}

/**
 * The command the Add/Edit Command dialog saves.
 *
 * `original` is the stored command being edited, or null for a new one. It is
 * spread first: a key without a form field survives the save, and every
 * edited key keeps its stored position. Actions without a name are dropped.
 */
export function buildWorkflowCommand(
  original: WorkflowJsonCommand | null,
  form: WorkflowCommandForm,
): WorkflowJsonCommand {
  return {
    ...original,
    name: form.name.trim(),
    next_state: form.nextState,
    actions: form.actions.filter((a) => a.name.trim()), // Only remove actions with no name
    policies: form.policies,
    sourceHandle: original?.sourceHandle || form.sourceHandle,
    targetHandle: original?.targetHandle || form.targetHandle,
  };
}

/** What an action's Parameters text holds: the parameters, or why it has none. */
export type ParsedWorkflowActionParameters =
  | { valid: true; parameters: WorkflowActionParameters }
  | {
      valid: false;
      /** The sentence the field shows */
      error: string;
      /** The parser's own message, for a translated sentence */
      reason: string;
    };

/** The English sentence for a Parameters text that does not parse. */
function describeInvalidJson(reason: string): string {
  return `Invalid JSON: ${reason}`;
}

/**
 * Reads the text of an action's Parameters field. An empty field means no
 * parameters ({}); anything else has to parse as JSON. `describe` turns the
 * parser's message into the sentence to show (English by default).
 */
export function parseWorkflowActionParameters(
  text: string | undefined,
  describe: (reason: string) => string = describeInvalidJson,
): ParsedWorkflowActionParameters {
  if (!text?.trim()) {
    return { valid: true, parameters: {} };
  }
  try {
    return { valid: true, parameters: JSON.parse(text) };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { valid: false, error: describe(reason), reason };
  }
}

/**
 * The error of every Parameters text that does not parse, by action index.
 * Empty when all of them do.
 */
export function findWorkflowParameterErrors(
  texts: Record<number, string>,
  describe?: (reason: string) => string,
): Record<number, string> {
  const errors: Record<number, string> = {};
  Object.entries(texts).forEach(([key, text]) => {
    const parsed = parseWorkflowActionParameters(text, describe);
    if (!parsed.valid) {
      errors[Number.parseInt(key, 10)] = parsed.error;
    }
  });
  return errors;
}

/**
 * A by-index record after the item at `index` is removed from the list it
 * describes: that entry goes and the entries above it move down one.
 */
export function removeIndexed<T>(values: Record<number, T>, index: number): Record<number, T> {
  const remaining: Record<number, T> = {};
  Object.entries(values).forEach(([key, value]) => {
    const numKey = Number.parseInt(key, 10);
    if (numKey < index) {
      remaining[numKey] = value;
    } else if (numKey > index) {
      remaining[numKey - 1] = value;
    }
  });
  return remaining;
}

/** What Save checks in the Add/Edit Command dialog. */
export interface WorkflowCommandCheck {
  name: string;
  nextState: string;
  /** Names of the other commands of the same state. */
  siblingNames: string[];
  /** Each action's Parameters text, by action index. */
  parameterTexts: Record<number, string>;
}

/** Why a command cannot be saved, with the dialog tab that holds the failing field. */
export type WorkflowCommandProblem =
  | {
      tab: 'general';
      /** The form field the error belongs under */
      field: 'name' | 'nextState';
      code: 'nameRequired' | 'targetStateRequired' | 'duplicateName';
      error: string;
    }
  | {
      tab: 'actions';
      code: 'invalidParameters';
      parameterErrors: Record<number, string>;
      /** Index of the first failing action */
      action: number;
    };

/**
 * The first thing that refuses a command save, or null when it can be saved.
 *
 * Every problem names the tab its field is on. The dialog opens that tab: an
 * error left on a tab the user is not looking at reads as a Save button that
 * does nothing. A Parameters problem also names the first failing action,
 * whose accordion item may be closed. `describe` is passed on to
 * `findWorkflowParameterErrors`.
 */
export function findWorkflowCommandProblem(
  form: WorkflowCommandCheck,
  describe?: (reason: string) => string,
): WorkflowCommandProblem | null {
  const name = form.name.trim();
  if (!name) {
    return { tab: 'general', field: 'name', code: 'nameRequired', error: 'Command name is required' };
  }

  if (!form.nextState) {
    return {
      tab: 'general',
      field: 'nextState',
      code: 'targetStateRequired',
      error: 'Target state is required',
    };
  }

  // Check for duplicate command names in the same state
  if (form.siblingNames.some((sibling) => sibling.toLowerCase() === name.toLowerCase())) {
    return {
      tab: 'general',
      field: 'name',
      code: 'duplicateName',
      error: 'A command with this name already exists in this state',
    };
  }

  const parameterErrors = findWorkflowParameterErrors(form.parameterTexts, describe);
  const [firstInvalid] = Object.keys(parameterErrors);
  if (firstInvalid !== undefined) {
    return {
      tab: 'actions',
      code: 'invalidParameters',
      parameterErrors,
      action: Number.parseInt(firstInvalid, 10),
    };
  }

  return null;
}

// ============================================================================
// Add/Edit State dialog
// ============================================================================

/** The fields of the Add/Edit State dialog that are stored on the state. */
export interface WorkflowStateForm {
  name: string;
  isEndState: boolean;
}

/**
 * The state the Add/Edit State dialog saves.
 *
 * `original` is the stored state being edited, or null for a new one. It is
 * spread first, so its commands, its position and its stored key order carry
 * over. A new state starts without commands.
 */
export function buildWorkflowState(
  original: WorkflowJsonState | null,
  form: WorkflowStateForm,
): WorkflowJsonState {
  return {
    ...original,
    name: form.name.trim(),
    commands: original?.commands || [],
    isEndState: form.isEndState,
  };
}

/** What Save checks in the Add/Edit State dialog. */
export interface WorkflowStateCheck {
  name: string;
  /** Names of the other states of the workflow. */
  siblingNames: string[];
  /** Whether the dialog's End State switch is on. Absent: the end-state rule is not checked. */
  isEndState?: boolean;
  /** Whether the stored state is an end state already; false or absent for a new state. */
  wasEndState?: boolean;
  /** Number of commands the stored state has; 0 or absent for a new state. */
  commandCount?: number;
}

/** Why a state cannot be saved. */
export interface WorkflowStateProblem {
  code: 'nameRequired' | 'duplicateName' | 'endStateHasCommands';
  error: string;
}

/**
 * What refuses a state save, or null when it can be saved.
 *
 * An end state has no outgoing commands, so a state that has commands cannot
 * be turned into one: its commands would stay in the document, and the
 * transition route would go on running them. A state that is stored as an end
 * state with commands (a document written through the API) can still be saved
 * as it is — refusing that would leave the user no way to rename it.
 */
export function findWorkflowStateProblem(form: WorkflowStateCheck): WorkflowStateProblem | null {
  const name = form.name.trim();
  if (!name) {
    return { code: 'nameRequired', error: 'State name is required' };
  }

  // Check for duplicate names (the state's own stored name is not a sibling)
  if (form.siblingNames.some((sibling) => sibling.toLowerCase() === name.toLowerCase())) {
    return { code: 'duplicateName', error: 'A state with this name already exists' };
  }

  if (form.isEndState && !form.wasEndState && (form.commandCount ?? 0) > 0) {
    return {
      code: 'endStateHasCommands',
      error: 'This state has outgoing commands. Delete them before making it an end state.',
    };
  }

  return null;
}

// ============================================================================
// Applying a dialog's result to the document
// ============================================================================

/** How a saved state enters the document. */
export interface WorkflowStateSave {
  /** Stored name of the state that was edited; null or absent for a new state. */
  originalName?: string | null;
  /** Whether the dialog's Initial State switch is on. */
  isInitial: boolean;
}

/**
 * The document after the Add/Edit State dialog saves `state`.
 *
 * A new state is appended, and becomes the initial state when it is the first
 * one or is marked initial. An edited state replaces the one stored under
 * `originalName`; when it was renamed, every command that led to the old name
 * and the initial state follow it. Marking a state initial moves the initial
 * state to it; unmarking the current initial state leaves it in place, because
 * a workflow cannot be saved without one.
 */
export function applyWorkflowStateSave(
  workflowJson: WorkflowJson,
  state: WorkflowJsonState,
  { originalName, isInitial }: WorkflowStateSave,
): WorkflowJson {
  let updatedStates: WorkflowJsonState[];
  let newInitialState = workflowJson.initial_state;

  if (originalName === null || originalName === undefined) {
    updatedStates = [...workflowJson.states, state];
    // Set as initial if it's the first state or if marked as initial
    if (updatedStates.length === 1 || isInitial) {
      newInitialState = state.name;
    }
  } else {
    // Update existing state
    updatedStates = workflowJson.states.map((s) => (s.name === originalName ? state : s));

    // Update commands that reference the old state name
    if (originalName && originalName !== state.name) {
      updatedStates = updatedStates.map((s) => ({
        ...s,
        commands: s.commands.map((c) =>
          c.next_state === originalName ? { ...c, next_state: state.name } : c,
        ),
      }));

      // Update initial state if renamed
      if (newInitialState === originalName) {
        newInitialState = state.name;
      }
    }

    // Update initial state if marked as initial
    if (isInitial) {
      newInitialState = state.name;
    }
  }

  return {
    ...workflowJson,
    initial_state: newInitialState,
    states: updatedStates,
  };
}

/**
 * The document after the Add/Edit Command dialog saves `command` on the state
 * named `stateName`. A new command (`originalName` null or absent) is appended
 * to that state's commands; an edited one replaces the command stored under
 * `originalName`.
 */
export function applyWorkflowCommandSave(
  workflowJson: WorkflowJson,
  stateName: string,
  command: WorkflowJsonCommand,
  originalName?: string | null,
): WorkflowJson {
  const updatedStates = workflowJson.states.map((state) => {
    if (state.name !== stateName) return state;

    const updatedCommands =
      originalName === null || originalName === undefined
        ? [...state.commands, command]
        : state.commands.map((c) => (c.name === originalName ? command : c));

    return { ...state, commands: updatedCommands };
  });

  return {
    ...workflowJson,
    states: updatedStates,
  };
}

/** Why a definition cannot be saved. */
export interface WorkflowDefinitionProblem {
  code: 'nameRequired' | 'noStates' | 'noInitialState';
  error: string;
}

/** The first thing that refuses a definition save, or null when it can be saved. */
export function findWorkflowDefinitionProblem(draft: {
  name: string;
  workflow_json: WorkflowJson;
}): WorkflowDefinitionProblem | null {
  if (!draft.name.trim()) {
    return { code: 'nameRequired', error: 'Workflow name is required' };
  }

  if (draft.workflow_json.states.length === 0) {
    return { code: 'noStates', error: 'Please add at least one state to the workflow' };
  }

  if (!draft.workflow_json.initial_state) {
    return { code: 'noInitialState', error: 'Please set an initial state' };
  }

  return null;
}

// ============================================================================
// Diagram gestures
// ============================================================================
//
// The state diagram is a view of the document. Every gesture on it that changes
// the machine (a drag, a deletion, a connection moved to another state) is one
// of these functions: the canvas hands the result to its `onChange` and draws
// the document it gets back, so the canvas and the document cannot disagree.
//
// A function that refuses a gesture returns the document it was given, the
// same object, so a caller can tell a refusal by identity and skip the change.

/**
 * The document after the state named `stateName` is deleted: the state goes,
 * every command that led to it goes with it, and the initial state moves to
 * the first remaining state when it was the one deleted.
 *
 * Refused (the same document is returned) for a name that is no state, and
 * for the only state: a workflow cannot be saved without one.
 */
export function removeWorkflowState(workflowJson: WorkflowJson, stateName: string): WorkflowJson {
  if (workflowJson.states.length <= 1) return workflowJson;
  if (!workflowJson.states.some((s) => s.name === stateName)) return workflowJson;

  const states = workflowJson.states
    .filter((s) => s.name !== stateName)
    .map((s) =>
      s.commands.some((c) => c.next_state === stateName)
        ? { ...s, commands: s.commands.filter((c) => c.next_state !== stateName) }
        : s,
    );

  return {
    ...workflowJson,
    initial_state:
      workflowJson.initial_state === stateName ? states[0]?.name || '' : workflowJson.initial_state,
    states,
  };
}

/**
 * The document after the command `commandName` of the state `stateName` is
 * deleted. Refused (the same document is returned) when there is no such
 * command.
 */
export function removeWorkflowCommand(
  workflowJson: WorkflowJson,
  stateName: string,
  commandName: string,
): WorkflowJson {
  const owner = workflowJson.states.find((s) => s.name === stateName);
  if (!owner || !owner.commands.some((c) => c.name === commandName)) return workflowJson;

  return {
    ...workflowJson,
    states: workflowJson.states.map((s) =>
      s === owner ? { ...s, commands: s.commands.filter((c) => c.name !== commandName) } : s,
    ),
  };
}

/**
 * The document after the state named `stateName` is dropped at `position`.
 * The same document is returned when there is no such state or it already
 * sits there, so a click that moved nothing does not read as an edit.
 */
export function moveWorkflowState(
  workflowJson: WorkflowJson,
  stateName: string,
  position: WorkflowStatePosition,
): WorkflowJson {
  const state = workflowJson.states.find((s) => s.name === stateName);
  if (!state) return workflowJson;
  if (state.position && state.position.x === position.x && state.position.y === position.y) {
    return workflowJson;
  }

  return {
    ...workflowJson,
    states: workflowJson.states.map((s) =>
      s === state ? { ...s, position: { x: position.x, y: position.y } } : s,
    ),
  };
}

/** Why two states cannot be joined by a command. */
export interface WorkflowConnectionProblem {
  code: 'unknownState' | 'selfTransition' | 'endStateSource' | 'unknownCommand';
  error: string;
}

/**
 * What refuses a command from the state `source` to the state `target`, or
 * null when it can be drawn.
 *
 * An end state terminates the instance, so it cannot start a command; a
 * command cannot lead back to its own state (the Target State field does not
 * offer it either); and both ends have to be states of the workflow.
 */
export function findWorkflowConnectionProblem(
  workflowJson: WorkflowJson,
  source: string | null | undefined,
  target: string | null | undefined,
): WorkflowConnectionProblem | null {
  const from = workflowJson.states.find((s) => s.name === source);
  const to = workflowJson.states.find((s) => s.name === target);
  if (!from || !to) {
    return { code: 'unknownState', error: 'A command has to join two states of the workflow' };
  }
  if (from === to) {
    return { code: 'selfTransition', error: 'A command cannot lead back to its own state' };
  }
  if (from.isEndState) {
    return { code: 'endStateSource', error: 'End states cannot have outgoing commands' };
  }
  return null;
}

/** One command of the document: the state that owns it and its name. */
export interface WorkflowCommandRef {
  state: string;
  command: string;
}

/** Where a command's edge was dropped on the diagram. */
export interface WorkflowConnection {
  /** Name of the state the edge leaves */
  source: string | null | undefined;
  /** Name of the state the edge enters */
  target: string | null | undefined;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

/** What moving a command's edge did to the document. */
export type WorkflowReconnectResult =
  | {
      ok: true;
      workflowJson: WorkflowJson;
      /** Where the command is now; its name changes when the new state had one of that name */
      command: WorkflowCommandRef;
    }
  | { ok: false; problem: WorkflowConnectionProblem };

/**
 * The document after the edge of the command `ref` is dropped on `connection`.
 *
 * The command is named by the state that owns it and its own name — never by
 * an id that has to be taken apart again, which goes wrong as soon as a name
 * contains the separator. An end dropped on another target changes
 * `next_state`; an end dropped on another source moves the command to that
 * state, where it gets a `_1`, `_2`, … suffix when the name is taken. The
 * handles of the connection are stored either way, and every other key of the
 * command (its actions, its policies, its `module_access_keys`) is kept.
 *
 * Refused for a command that does not exist, an end dropped on nothing or on
 * the command's own state, and a source moved onto an end state.
 */
export function reconnectWorkflowCommand(
  workflowJson: WorkflowJson,
  ref: WorkflowCommandRef,
  connection: WorkflowConnection,
): WorkflowReconnectResult {
  const owner = workflowJson.states.find((s) => s.name === ref.state);
  const stored = owner?.commands.find((c) => c.name === ref.command);
  if (!owner || !stored) {
    return { ok: false, problem: { code: 'unknownCommand', error: 'The command no longer exists' } };
  }

  const problem = findWorkflowConnectionProblem(workflowJson, connection.source, connection.target);
  // A command that already leaves an end state (a document written through
  // the API) may still be pointed at another target: that adds no command.
  if (problem && !(problem.code === 'endStateSource' && connection.source === owner.name)) {
    return { ok: false, problem };
  }

  const source = connection.source as string;
  const moved: WorkflowJsonCommand = {
    ...stored,
    next_state: connection.target as string,
    sourceHandle: connection.sourceHandle || undefined,
    targetHandle: connection.targetHandle || undefined,
  };

  if (source === owner.name) {
    return {
      ok: true,
      command: { state: owner.name, command: stored.name },
      workflowJson: {
        ...workflowJson,
        states: workflowJson.states.map((s) =>
          s === owner ? { ...s, commands: s.commands.map((c) => (c === stored ? moved : c)) } : s,
        ),
      },
    };
  }

  // The command moves to another state; keep its name unique there
  const destination = workflowJson.states.find((s) => s.name === source) as WorkflowJsonState;
  const taken = new Set(destination.commands.map((c) => c.name.toLowerCase()));
  let name = stored.name;
  for (let counter = 1; taken.has(name.toLowerCase()); counter += 1) {
    name = `${stored.name}_${counter}`;
  }

  return {
    ok: true,
    command: { state: destination.name, command: name },
    workflowJson: {
      ...workflowJson,
      states: workflowJson.states.map((s) => {
        if (s === owner) return { ...s, commands: s.commands.filter((c) => c !== stored) };
        if (s === destination) return { ...s, commands: [...s.commands, { ...moved, name }] };
        return s;
      }),
    },
  };
}

// ============================================================================
// Assignment filter rule
// ============================================================================

/**
 * Whether `value` may be stored as a filter rule: an object of conditions, or
 * null/absent for "no filter".
 *
 * `daas_wf_assignment.filter_rule` narrows which items of the assigned
 * collection get a workflow instance. It is ANDed into an item filter, where
 * only an object of field conditions adds a condition. An array, number,
 * string or boolean adds none, so every item would match while the assignment
 * still reads as filtered.
 */
export function isWorkflowFilterRule(value: unknown): value is WorkflowFilterRule | null | undefined {
  if (value === null || value === undefined) return true;
  return typeof value === 'object' && !Array.isArray(value);
}

/** What the Filter Rule text holds: the rule, or why it cannot be stored. */
export type ParsedWorkflowFilterRule =
  | { valid: true; rule: WorkflowFilterRule | null }
  | { valid: false; code: 'invalidJson' | 'notObject'; error: string };

/**
 * Reads the text of the assignment form's Filter Rule field. An empty field
 * (or the JSON `null`) means no filter; anything else has to parse as JSON and
 * be an object of conditions.
 */
export function parseWorkflowFilterRule(text: string | undefined): ParsedWorkflowFilterRule {
  if (!text?.trim()) {
    return { valid: true, rule: null };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { valid: false, code: 'invalidJson', error: 'Filter Rule must be valid JSON' };
  }

  if (!isWorkflowFilterRule(parsed)) {
    return { valid: false, code: 'notObject', error: 'Filter Rule must be a JSON object' };
  }

  return { valid: true, rule: parsed ?? null };
}
