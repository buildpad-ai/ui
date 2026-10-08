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
 * Ported from buildpad-daas `lib/workflows/definition-editor.ts`,
 * `lib/utils/workflow-filter-rule.ts` and the save handlers of
 * `app/[lang]/workflows/[id]/page.tsx`. Nothing here touches the DOM, React or
 * the network.
 */
import type {
  WorkflowActionParameters,
  WorkflowFilterRule,
  WorkflowJson,
  WorkflowJsonAction,
  WorkflowJsonCommand,
  WorkflowJsonState,
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
}

/** Why a state cannot be saved. */
export interface WorkflowStateProblem {
  code: 'nameRequired' | 'duplicateName';
  error: string;
}

/** What refuses a state save, or null when it can be saved. */
export function findWorkflowStateProblem(form: WorkflowStateCheck): WorkflowStateProblem | null {
  const name = form.name.trim();
  if (!name) {
    return { code: 'nameRequired', error: 'State name is required' };
  }

  // Check for duplicate names (the state's own stored name is not a sibling)
  if (form.siblingNames.some((sibling) => sibling.toLowerCase() === name.toLowerCase())) {
    return { code: 'duplicateName', error: 'A state with this name already exists' };
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
