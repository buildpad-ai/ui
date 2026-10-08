/**
 * Workflow editor logic tests.
 *
 * The first half is the buildpad-daas suite for `lib/workflows/definition-editor.ts`
 * and `lib/utils/workflow-filter-rule.ts`, ported with the functions. The rest
 * covers what this package adds: reading a stored document, the state checks,
 * applying a dialog's result, the Filter Rule text, and the gestures of the
 * state diagram as functions from one document to the next.
 */
import { describe, it, expect } from 'vitest';
import type { WorkflowJson, WorkflowJsonCommand, WorkflowJsonState } from '@buildpad/types';
import {
  applyWorkflowCommandSave,
  applyWorkflowStateSave,
  buildWorkflowCommand,
  buildWorkflowState,
  findWorkflowCommandProblem,
  findWorkflowConnectionProblem,
  findWorkflowDefinitionProblem,
  findWorkflowParameterErrors,
  findWorkflowStateProblem,
  isWorkflowFilterRule,
  moveWorkflowState,
  normalizeWorkflowJson,
  parseWorkflowActionParameters,
  parseWorkflowFilterRule,
  reconnectWorkflowCommand,
  removeIndexed,
  removeWorkflowCommand,
  removeWorkflowState,
  type WorkflowCommandCheck,
  type WorkflowCommandForm,
  type WorkflowStateForm,
} from '../src/workflow';

/**
 * Reorders object keys the way a jsonb column returns them (shorter keys
 * first, then by byte order), which is how a saved definition reaches the
 * editor. It is not the order the dialogs list their fields in.
 */
function asStored<T>(value: T): T {
  if (Array.isArray(value)) return value.map(asStored) as T;
  if (value === null || typeof value !== 'object') return value;
  const entries = Object.entries(value)
    .sort(([a], [b]) => a.length - b.length || (a < b ? -1 : 1))
    .map(([key, child]) => [key, asStored(child)]);
  return Object.fromEntries(entries) as T;
}

/** The Edit Command form as it stands right after opening on `command`. */
function commandFormOf(command: WorkflowJsonCommand): WorkflowCommandForm {
  return {
    name: command.name,
    nextState: command.next_state,
    actions: command.actions,
    policies: command.policies,
    sourceHandle: command.sourceHandle,
    targetHandle: command.targetHandle,
  };
}

/** The Edit State form as it stands right after opening on `state`. */
function stateFormOf(state: WorkflowJsonState): WorkflowStateForm {
  return { name: state.name, isEndState: state.isEndState };
}

describe('buildWorkflowCommand', () => {
  const gated = asStored({
    name: 'Submit',
    next_state: 'Review',
    actions: [{ name: 'Notify', event_name: 'e2e.noop', parameters: { subject: 'Hi' } }],
    policies: [],
    module_access_keys: ['workflow:approve'],
  }) as WorkflowJsonCommand;

  it('keeps module_access_keys when a key-gated command is saved unchanged', () => {
    const saved = buildWorkflowCommand(gated, commandFormOf(gated));
    expect(saved).toMatchObject({ module_access_keys: ['workflow:approve'] });
  });

  it('keeps stored keys the form has no field for when the command is edited', () => {
    const saved = buildWorkflowCommand(gated, {
      ...commandFormOf(gated),
      name: 'Send',
      nextState: 'Published',
      policies: ['p1'],
    });
    expect(saved).toMatchObject({
      name: 'Send',
      next_state: 'Published',
      policies: ['p1'],
      module_access_keys: ['workflow:approve'],
    });
  });

  it('serialises an unchanged command exactly as it was stored', () => {
    // An unsaved-changes check that compares JSON.stringify output counts key order.
    expect(Object.keys(gated)).toEqual(['name', 'actions', 'policies', 'next_state', 'module_access_keys']);
    expect(JSON.stringify(buildWorkflowCommand(gated, commandFormOf(gated)))).toBe(JSON.stringify(gated));

    const plain = asStored({
      name: 'Approve',
      next_state: 'Published',
      actions: [],
      policies: ['p1'],
    }) as WorkflowJsonCommand;
    expect(JSON.stringify(buildWorkflowCommand(plain, commandFormOf(plain)))).toBe(JSON.stringify(plain));

    const drawn = asStored({ ...plain, sourceHandle: 'right-1', targetHandle: 'left-1' }) as WorkflowJsonCommand;
    expect(JSON.stringify(buildWorkflowCommand(drawn, commandFormOf(drawn)))).toBe(JSON.stringify(drawn));
  });

  it('keeps the stored position of a key the form changes', () => {
    const saved = buildWorkflowCommand(gated, { ...commandFormOf(gated), nextState: 'Published' });
    expect(JSON.stringify(saved)).toBe(JSON.stringify({ ...gated, next_state: 'Published' }));
  });

  it('trims the name and drops actions without a name', () => {
    const saved = buildWorkflowCommand(null, {
      name: '  Submit ',
      nextState: 'Review',
      actions: [
        { name: 'Notify', event_name: '', parameters: {} },
        { name: '   ', event_name: 'e2e.noop', parameters: {} },
      ],
      policies: [],
    });
    expect(saved.name).toBe('Submit');
    expect(saved.actions).toEqual([{ name: 'Notify', event_name: '', parameters: {} }]);
  });

  it('gives a new command the handles of the connection it was drawn with', () => {
    const saved = buildWorkflowCommand(null, {
      name: 'Go',
      nextState: 'B',
      actions: [],
      policies: [],
      sourceHandle: 'right-1',
      targetHandle: 'left-2',
    });
    expect(saved).toEqual({
      name: 'Go',
      next_state: 'B',
      actions: [],
      policies: [],
      sourceHandle: 'right-1',
      targetHandle: 'left-2',
    });
  });

  it("keeps an edited command's own handles", () => {
    const drawn = {
      name: 'Go',
      next_state: 'B',
      actions: [],
      policies: [],
      sourceHandle: 'top-1',
      targetHandle: 'bottom-1',
    };
    const saved = buildWorkflowCommand(drawn, {
      ...commandFormOf(drawn),
      sourceHandle: 'right-1',
      targetHandle: 'left-2',
    });
    expect(saved).toMatchObject({ sourceHandle: 'top-1', targetHandle: 'bottom-1' });
  });
});

describe('buildWorkflowState', () => {
  const positioned = asStored({
    name: 'Draft',
    isEndState: false,
    commands: [{ name: 'Submit', next_state: 'Review', actions: [], policies: [] }],
    position: { x: 100, y: 100 },
  }) as WorkflowJsonState;

  it('serialises an unchanged positioned state exactly as it was stored', () => {
    // jsonb returns position before isEndState; the dialog's own order is the reverse.
    expect(Object.keys(positioned)).toEqual(['name', 'commands', 'position', 'isEndState']);
    expect(JSON.stringify(buildWorkflowState(positioned, stateFormOf(positioned)))).toBe(
      JSON.stringify(positioned),
    );
  });

  it('serialises an unchanged state without a position exactly as it was stored', () => {
    const plain = asStored({ name: 'Review', isEndState: false, commands: [] }) as WorkflowJsonState;
    expect(JSON.stringify(buildWorkflowState(plain, stateFormOf(plain)))).toBe(JSON.stringify(plain));
  });

  it('keeps the commands, the position and unknown keys of a renamed state', () => {
    const stored = { ...positioned, note: 'kept' } as WorkflowJsonState;
    const saved = buildWorkflowState(stored, { name: ' Start ', isEndState: true });
    expect(saved).toEqual({ ...stored, name: 'Start', isEndState: true });
    expect(saved.commands).toBe(stored.commands);
  });

  it('starts a new state without commands or a position', () => {
    expect(buildWorkflowState(null, { name: ' Published ', isEndState: true })).toEqual({
      name: 'Published',
      commands: [],
      isEndState: true,
    });
  });
});

describe('parseWorkflowActionParameters', () => {
  it('reads an empty or blank field as no parameters', () => {
    expect(parseWorkflowActionParameters('')).toEqual({ valid: true, parameters: {} });
    expect(parseWorkflowActionParameters('  \n ')).toEqual({ valid: true, parameters: {} });
    expect(parseWorkflowActionParameters(undefined)).toEqual({ valid: true, parameters: {} });
  });

  it('parses JSON text', () => {
    expect(parseWorkflowActionParameters('{"subject":"Hi","recipient_users":["u1"]}')).toEqual({
      valid: true,
      parameters: { subject: 'Hi', recipient_users: ['u1'] },
    });
  });

  it('reports text that is not JSON and returns no parameters for it', () => {
    const parsed = parseWorkflowActionParameters('{"a":2');
    expect(parsed.valid).toBe(false);
    expect(parsed).not.toHaveProperty('parameters');
    // The wording the field shows by default.
    expect(parsed).toHaveProperty('error', expect.stringMatching(/^Invalid JSON: \S/));
  });

  it('hands the parser message to a caller that words the error itself', () => {
    const parsed = parseWorkflowActionParameters('{"a":2', (reason) => `JSON tidak valid: ${reason}`);
    if (parsed.valid) throw new Error('expected an invalid result');
    expect(parsed.code).toBe('invalidJson');
    expect(parsed.reason).toMatch(/\S/);
    expect(parsed.error).toBe(`JSON tidak valid: ${parsed.reason}`);
  });

  // The parameters are spread into the emitted event, and the Go engine reads
  // the stored document with `parameters` typed as an object: any other JSON
  // there makes it refuse the whole definition ("Invalid workflow JSON
  // structure: missing initial_state or states array").
  it.each([['[]'], ['[1, 2]'], ['123'], ['"text"'], ['true'], ['null']])(
    'refuses %s: valid JSON that is not an object',
    (text) => {
      const parsed = parseWorkflowActionParameters(text);
      expect(parsed).toEqual({
        valid: false,
        code: 'notObject',
        error: 'Parameters must be a JSON object',
        reason: 'Parameters must be a JSON object',
      });
    },
  );

  it('tells a caller that words the error which of the two problems it is', () => {
    const words = (reason: string, code: string) => `${code}|${reason}`;
    expect(parseWorkflowActionParameters('[]', words)).toMatchObject({ error: 'notObject|Parameters must be a JSON object' });
    expect(parseWorkflowActionParameters('{', words)).toMatchObject({ error: expect.stringMatching(/^invalidJson\|\S/) });
  });
});

describe('findWorkflowParameterErrors', () => {
  it('finds nothing while every Parameters text parses or is empty', () => {
    expect(findWorkflowParameterErrors({})).toEqual({});
    expect(findWorkflowParameterErrors({ 0: '{\n  "a": 1\n}', 1: '', 2: '{}' })).toEqual({});
  });

  it('reports valid parameters that were replaced by text that no longer parses', () => {
    // The lost edit: {"a":1} was typed and formatted, then changed to {"a":2 without the brace.
    const errors = findWorkflowParameterErrors({ 0: '{"a":2' });
    expect(errors[0]).toMatch(/invalid json/i);
  });

  it('reports parameters that are JSON but no object', () => {
    expect(findWorkflowParameterErrors({ 0: '{"a":1}', 1: '[]', 2: '5' })).toEqual({
      1: 'Parameters must be a JSON object',
      2: 'Parameters must be a JSON object',
    });
  });

  it('lists every failing action by its index, lowest first', () => {
    const errors = findWorkflowParameterErrors({ 3: 'nope', 0: '{"a":1}', 1: '{"a":2', 2: '' });
    expect(Object.keys(errors)).toEqual(['1', '3']);
  });

  it('words each error with the caller’s sentence', () => {
    expect(findWorkflowParameterErrors({ 0: 'nope' }, () => 'Bukan JSON')).toEqual({ 0: 'Bukan JSON' });
  });
});

describe('removeIndexed', () => {
  it('drops the entry at the index and moves the later entries down one', () => {
    expect(removeIndexed({ 0: 'a', 1: 'b', 2: 'c' }, 1)).toEqual({ 0: 'a', 1: 'c' });
    expect(removeIndexed({ 0: 'a', 1: 'b', 2: 'c' }, 2)).toEqual({ 0: 'a', 1: 'b' });
  });

  it('keeps an error on its own action when an earlier action is removed', () => {
    expect(removeIndexed({ 2: 'Invalid JSON' }, 0)).toEqual({ 1: 'Invalid JSON' });
    expect(removeIndexed({ 2: 'Invalid JSON' }, 2)).toEqual({});
  });
});

describe('findWorkflowCommandProblem', () => {
  /** A form that can be saved; each case breaks one thing. */
  function check(overrides: Partial<WorkflowCommandCheck> = {}): WorkflowCommandCheck {
    return { name: 'Skip', nextState: 'Published', siblingNames: ['Submit'], parameterTexts: {}, ...overrides };
  }

  it('finds nothing wrong with a complete form', () => {
    expect(findWorkflowCommandProblem(check())).toBeNull();
    expect(findWorkflowCommandProblem(check({ parameterTexts: { 0: '{"a":1}', 1: '' } }))).toBeNull();
  });

  it('puts a missing name on the General tab, under the name field', () => {
    const problem = { tab: 'general', field: 'name', code: 'nameRequired', error: 'Command name is required' };
    expect(findWorkflowCommandProblem(check({ name: '' }))).toEqual(problem);
    expect(findWorkflowCommandProblem(check({ name: '   ' }))).toEqual(problem);
  });

  it('puts a missing target state on the General tab, under the target field', () => {
    expect(findWorkflowCommandProblem(check({ nextState: '' }))).toEqual({
      tab: 'general',
      field: 'nextState',
      code: 'targetStateRequired',
      error: 'Target state is required',
    });
  });

  it('puts a name another command of the state has, in any case, on the General tab', () => {
    const problem = {
      tab: 'general',
      field: 'name',
      code: 'duplicateName',
      error: 'A command with this name already exists in this state',
    };
    expect(findWorkflowCommandProblem(check({ name: 'submit' }))).toEqual(problem);
    expect(findWorkflowCommandProblem(check({ name: ' SUBMIT ' }))).toEqual(problem);
  });

  it('puts invalid Parameters JSON on the Actions tab, at the first failing action', () => {
    const problem = findWorkflowCommandProblem(
      check({ parameterTexts: { 0: '{"a":1}', 1: '{"a":2', 2: 'nope' } }),
    );
    expect(problem).toMatchObject({ tab: 'actions', code: 'invalidParameters', action: 1 });
    expect(problem).toHaveProperty('parameterErrors', {
      1: expect.stringMatching(/invalid json/i),
      2: expect.stringMatching(/invalid json/i),
    });
  });

  it('words a Parameters problem with the caller’s sentence', () => {
    const problem = findWorkflowCommandProblem(check({ parameterTexts: { 0: 'nope' } }), () => 'Bukan JSON');
    expect(problem).toHaveProperty('parameterErrors', { 0: 'Bukan JSON' });
  });

  it('reports a General problem before a Parameters one', () => {
    expect(findWorkflowCommandProblem(check({ name: '', parameterTexts: { 0: '{' } }))).toMatchObject({
      tab: 'general',
      code: 'nameRequired',
    });
  });
});

describe('isWorkflowFilterRule', () => {
  it.each([[{ status: { _eq: 'draft' } }], [{ _and: [{ a: { _eq: 1 } }] }], [{}], [null], [undefined]])(
    'accepts %j',
    (value) => {
      expect(isWorkflowFilterRule(value)).toBe(true);
    },
  );

  it.each([[[]], [[{ status: { _eq: 'draft' } }]], [123], [0], ['{"a":1}'], [''], [true], [false]])(
    'refuses %j',
    (value) => {
      expect(isWorkflowFilterRule(value)).toBe(false);
    },
  );
});

describe('parseWorkflowFilterRule', () => {
  it('reads an empty or blank field, and the JSON null, as no filter', () => {
    expect(parseWorkflowFilterRule('')).toEqual({ valid: true, rule: null });
    expect(parseWorkflowFilterRule(' \n ')).toEqual({ valid: true, rule: null });
    expect(parseWorkflowFilterRule(undefined)).toEqual({ valid: true, rule: null });
    expect(parseWorkflowFilterRule('null')).toEqual({ valid: true, rule: null });
  });

  it('parses an object of conditions', () => {
    expect(parseWorkflowFilterRule('{"status": {"_eq": "draft"}}')).toEqual({
      valid: true,
      rule: { status: { _eq: 'draft' } },
    });
    expect(parseWorkflowFilterRule('{}')).toEqual({ valid: true, rule: {} });
  });

  it('refuses text that is not JSON', () => {
    expect(parseWorkflowFilterRule('{"status":')).toEqual({
      valid: false,
      code: 'invalidJson',
      error: 'Filter Rule must be valid JSON',
    });
  });

  it.each([['[]'], ['[{"status":{"_eq":"draft"}}]'], ['123'], ['"draft"'], ['true']])(
    'refuses %s: valid JSON that narrows nothing',
    (text) => {
      expect(parseWorkflowFilterRule(text)).toEqual({
        valid: false,
        code: 'notObject',
        error: 'Filter Rule must be a JSON object',
      });
    },
  );
});

describe('normalizeWorkflowJson', () => {
  it('gives a command stored without actions or policies both arrays', () => {
    const stored = {
      initial_state: 'Draft',
      states: [
        { name: 'Draft', isEndState: false, commands: [{ name: 'Submit', next_state: 'Review' }] },
        { name: 'Review', isEndState: true, commands: [] },
      ],
    };
    const normal = normalizeWorkflowJson(stored);
    expect(normal.states[0].commands[0]).toEqual({
      name: 'Submit',
      next_state: 'Review',
      actions: [],
      policies: [],
    });
    // What a dialog does with a stored command no longer throws.
    expect(normal.states[0].commands[0].actions.map((a) => a.name)).toEqual([]);
    expect(normal.states[0].commands[0].policies.length).toBe(0);
  });

  it('gives a state stored without commands an empty list', () => {
    const normal = normalizeWorkflowJson({ initial_state: 'Draft', states: [{ name: 'Draft', isEndState: false }] });
    expect(normal.states[0].commands).toEqual([]);
  });

  it('replaces inner values that are not arrays', () => {
    const normal = normalizeWorkflowJson({
      initial_state: 'A',
      states: [{ name: 'A', commands: [{ name: 'Go', next_state: 'B', actions: null, policies: 'p1' }] }],
    });
    expect(normal.states[0].commands[0].actions).toEqual([]);
    expect(normal.states[0].commands[0].policies).toEqual([]);
    expect(normalizeWorkflowJson({ initial_state: 'A', states: [{ name: 'A', commands: {} }] }).states[0].commands).toEqual([]);
  });

  it('leaves a complete document as it was stored, key order included', () => {
    const stored = asStored({
      initial_state: 'Draft',
      compare_rollback_state: 'Published',
      states: [
        {
          name: 'Draft',
          isEndState: false,
          position: { x: 100, y: 100 },
          commands: [
            {
              name: 'Submit',
              next_state: 'Review',
              actions: [{ name: 'Notify', event_name: 'e2e.noop', parameters: { subject: 'Hi' } }],
              policies: ['p1'],
              module_access_keys: ['workflow:approve'],
              sourceHandle: 'right-1',
              targetHandle: 'left-1',
            },
          ],
        },
        { name: 'Review', isEndState: true, commands: [] },
      ],
    });
    const normal = normalizeWorkflowJson(stored);
    expect(JSON.stringify(normal)).toBe(JSON.stringify(stored));
    expect(normal).not.toBe(stored);
  });

  it('does not mutate what it is given and settles in one pass', () => {
    const stored = { initial_state: 'A', states: [{ name: 'A', commands: [{ name: 'Go', next_state: 'B' }] }] };
    const before = JSON.stringify(stored);
    const once = normalizeWorkflowJson(stored);
    expect(JSON.stringify(stored)).toBe(before);
    expect(normalizeWorkflowJson(once)).toEqual(once);
  });

  it('drops states and commands that are not objects', () => {
    const normal = normalizeWorkflowJson({
      initial_state: 'A',
      states: [null, 'B', { name: 'A', commands: [null, 3, { name: 'Go', next_state: 'B' }] }],
    });
    expect(normal.states.map((s) => s.name)).toEqual(['A']);
    expect(normal.states[0].commands.map((c) => c.name)).toEqual(['Go']);
  });

  it('reads a document held as JSON text', () => {
    const normal = normalizeWorkflowJson('{"initial_state":"A","states":[{"name":"A"}]}');
    expect(normal).toEqual({ initial_state: 'A', states: [{ name: 'A', commands: [] }] });
  });

  it.each([[null], [undefined], [''], ['not json'], [42], [[]], [true]])(
    'reads %j as an empty machine',
    (value) => {
      expect(normalizeWorkflowJson(value)).toEqual({ initial_state: '', states: [] });
    },
  );

  it('reads a missing or non-text initial state as unset, and missing states as none', () => {
    expect(normalizeWorkflowJson({})).toEqual({ initial_state: '', states: [] });
    expect(normalizeWorkflowJson({ initial_state: 7, states: 'x' })).toEqual({ initial_state: '', states: [] });
  });
});

describe('findWorkflowStateProblem', () => {
  it('finds nothing wrong with a new name', () => {
    expect(findWorkflowStateProblem({ name: 'Review', siblingNames: ['Draft'] })).toBeNull();
  });

  it('requires a name', () => {
    const problem = { code: 'nameRequired', error: 'State name is required' };
    expect(findWorkflowStateProblem({ name: '', siblingNames: [] })).toEqual(problem);
    expect(findWorkflowStateProblem({ name: '  ', siblingNames: [] })).toEqual(problem);
  });

  it('refuses the name of another state, in any case and with spaces around it', () => {
    const problem = { code: 'duplicateName', error: 'A state with this name already exists' };
    expect(findWorkflowStateProblem({ name: 'draft', siblingNames: ['Draft'] })).toEqual(problem);
    expect(findWorkflowStateProblem({ name: ' DRAFT ', siblingNames: ['Draft', 'Review'] })).toEqual(problem);
  });
});

describe('findWorkflowStateProblem: the end-state rule', () => {
  const refusal = {
    code: 'endStateHasCommands',
    error: 'This state has outgoing commands. Delete them before making it an end state.',
  };

  it('refuses turning End State on for a state that has commands', () => {
    expect(
      findWorkflowStateProblem({
        name: 'Review',
        siblingNames: ['Draft'],
        isEndState: true,
        wasEndState: false,
        commandCount: 2,
      }),
    ).toEqual(refusal);
  });

  it('lets a state without commands become an end state', () => {
    expect(
      findWorkflowStateProblem({ name: 'Done', siblingNames: [], isEndState: true, wasEndState: false, commandCount: 0 }),
    ).toBeNull();
    // A new state has no commands to count
    expect(findWorkflowStateProblem({ name: 'Done', siblingNames: [], isEndState: true })).toBeNull();
  });

  it('lets a state that has commands be saved while End State stays off', () => {
    expect(
      findWorkflowStateProblem({ name: 'Review', siblingNames: [], isEndState: false, commandCount: 2 }),
    ).toBeNull();
  });

  it('still saves a state stored as an end state with commands, so it can be renamed', () => {
    expect(
      findWorkflowStateProblem({
        name: 'Archived',
        siblingNames: [],
        isEndState: true,
        wasEndState: true,
        commandCount: 1,
      }),
    ).toBeNull();
  });

  it('reports the name first', () => {
    expect(
      findWorkflowStateProblem({ name: '', siblingNames: [], isEndState: true, commandCount: 2 })?.code,
    ).toBe('nameRequired');
  });
});

describe('findWorkflowDefinitionProblem', () => {
  const machine: WorkflowJson = {
    initial_state: 'Draft',
    states: [{ name: 'Draft', isEndState: false, commands: [] }],
  };

  it('finds nothing wrong with a named workflow that has an initial state', () => {
    expect(findWorkflowDefinitionProblem({ name: 'Review flow', workflow_json: machine })).toBeNull();
  });

  it('requires a name first', () => {
    expect(
      findWorkflowDefinitionProblem({ name: '  ', workflow_json: { initial_state: '', states: [] } }),
    ).toEqual({ code: 'nameRequired', error: 'Workflow name is required' });
  });

  it('requires at least one state', () => {
    expect(
      findWorkflowDefinitionProblem({ name: 'Flow', workflow_json: { initial_state: '', states: [] } }),
    ).toEqual({ code: 'noStates', error: 'Please add at least one state to the workflow' });
  });

  it('requires an initial state', () => {
    expect(
      findWorkflowDefinitionProblem({ name: 'Flow', workflow_json: { ...machine, initial_state: '' } }),
    ).toEqual({ code: 'noInitialState', error: 'Please set an initial state' });
  });
});

describe('applyWorkflowStateSave', () => {
  const draft: WorkflowJsonState = {
    name: 'Draft',
    isEndState: false,
    commands: [{ name: 'Submit', next_state: 'Review', actions: [], policies: [] }],
  };
  const review: WorkflowJsonState = {
    name: 'Review',
    isEndState: false,
    commands: [
      { name: 'Reject', next_state: 'Draft', actions: [], policies: [] },
      { name: 'Approve', next_state: 'Published', actions: [], policies: [] },
    ],
  };
  const published: WorkflowJsonState = { name: 'Published', isEndState: true, commands: [] };
  const machine: WorkflowJson = { initial_state: 'Draft', states: [draft, review, published] };

  it('makes the first state the initial one, whatever the switch says', () => {
    const saved = applyWorkflowStateSave({ initial_state: '', states: [] }, draft, { isInitial: false });
    expect(saved).toEqual({ initial_state: 'Draft', states: [draft] });
  });

  it('appends a new state and leaves the initial state alone', () => {
    const archived: WorkflowJsonState = { name: 'Archived', isEndState: true, commands: [] };
    const saved = applyWorkflowStateSave(machine, archived, { originalName: null, isInitial: false });
    expect(saved.states.map((s) => s.name)).toEqual(['Draft', 'Review', 'Published', 'Archived']);
    expect(saved.initial_state).toBe('Draft');
  });

  it('moves the initial state to a new state marked initial', () => {
    const intake: WorkflowJsonState = { name: 'Intake', isEndState: false, commands: [] };
    expect(applyWorkflowStateSave(machine, intake, { isInitial: true }).initial_state).toBe('Intake');
  });

  it('replaces an edited state in place', () => {
    const edited = { ...published, isEndState: false };
    const saved = applyWorkflowStateSave(machine, edited, { originalName: 'Published', isInitial: false });
    expect(saved.states).toEqual([draft, review, edited]);
    expect(saved.states[0]).toBe(draft);
    expect(saved.initial_state).toBe('Draft');
  });

  it('follows a rename in every command that led to the old name, and in the initial state', () => {
    const renamed = { ...draft, name: 'New' };
    const saved = applyWorkflowStateSave(machine, renamed, { originalName: 'Draft', isInitial: false });
    expect(saved.initial_state).toBe('New');
    expect(saved.states.map((s) => s.name)).toEqual(['New', 'Review', 'Published']);
    expect(saved.states[1].commands.map((c) => c.next_state)).toEqual(['New', 'Published']);
  });

  it('keeps the unknown keys and key order of the commands a rename rewrites', () => {
    const gated = asStored({
      name: 'Reject',
      next_state: 'Draft',
      actions: [],
      policies: [],
      module_access_keys: ['workflow:approve'],
    }) as WorkflowJsonCommand;
    const withGate: WorkflowJson = { ...machine, states: [draft, { ...review, commands: [gated] }, published] };
    const saved = applyWorkflowStateSave(withGate, { ...draft, name: 'New' }, { originalName: 'Draft', isInitial: false });
    expect(JSON.stringify(saved.states[1].commands[0])).toBe(JSON.stringify({ ...gated, next_state: 'New' }));
  });

  it('moves the initial state to an edited state marked initial', () => {
    const saved = applyWorkflowStateSave(machine, review, { originalName: 'Review', isInitial: true });
    expect(saved.initial_state).toBe('Review');
  });

  it('leaves the current initial state in place when its switch is turned off', () => {
    const saved = applyWorkflowStateSave(machine, draft, { originalName: 'Draft', isInitial: false });
    expect(saved.initial_state).toBe('Draft');
  });

  it('keeps the document’s other keys and does not mutate it', () => {
    const stored = { ...machine, compare_rollback_state: 'Published' } as WorkflowJson;
    const before = JSON.stringify(stored);
    const saved = applyWorkflowStateSave(stored, { ...draft, name: 'New' }, { originalName: 'Draft', isInitial: false });
    expect(saved).toMatchObject({ compare_rollback_state: 'Published' });
    expect(JSON.stringify(stored)).toBe(before);
  });
});

describe('applyWorkflowCommandSave', () => {
  const submit: WorkflowJsonCommand = { name: 'Submit', next_state: 'Review', actions: [], policies: [] };
  const machine: WorkflowJson = {
    initial_state: 'Draft',
    states: [
      { name: 'Draft', isEndState: false, commands: [submit] },
      { name: 'Review', isEndState: false, commands: [] },
    ],
  };

  it('appends a new command to the named state only', () => {
    const skip: WorkflowJsonCommand = { name: 'Skip', next_state: 'Review', actions: [], policies: [] };
    const saved = applyWorkflowCommandSave(machine, 'Draft', skip);
    expect(saved.states[0].commands).toEqual([submit, skip]);
    expect(saved.states[1]).toBe(machine.states[1]);
  });

  it('replaces an edited command under its stored name, renamed or not', () => {
    const renamed = { ...submit, name: 'Send', policies: ['p1'] };
    const saved = applyWorkflowCommandSave(machine, 'Draft', renamed, 'Submit');
    expect(saved.states[0].commands).toEqual([renamed]);
  });

  it('changes nothing for a state that does not exist, and does not mutate the document', () => {
    const before = JSON.stringify(machine);
    const saved = applyWorkflowCommandSave(machine, 'Missing', submit, null);
    expect(saved).toEqual(machine);
    expect(JSON.stringify(machine)).toBe(before);
  });
});

// ============================================================================
// Diagram gestures
// ============================================================================

/** Draft → Review → Published (end), with a way back from Review. */
function reviewFlow(): WorkflowJson {
  return {
    initial_state: 'Draft',
    states: [
      {
        name: 'Draft',
        isEndState: false,
        position: { x: 100, y: 100 },
        commands: [
          {
            name: 'Submit',
            next_state: 'Review',
            actions: [{ name: 'Notify', event_name: 'xtr.send.notification', parameters: { subject: 'Hi' } }],
            policies: ['policy-editor'],
            module_access_keys: ['content:submit'],
            sourceHandle: 'right-1',
            targetHandle: 'left-1',
          },
        ],
      },
      {
        name: 'Review',
        isEndState: false,
        commands: [
          { name: 'Approve', next_state: 'Published', actions: [], policies: [] },
          { name: 'Reject', next_state: 'Draft', actions: [], policies: [] },
        ],
      },
      { name: 'Published', isEndState: true, commands: [] },
    ],
  };
}

describe('removeWorkflowState', () => {
  it('removes the state and every command that led to it', () => {
    const next = removeWorkflowState(reviewFlow(), 'Published');
    expect(next.states.map((s) => s.name)).toEqual(['Draft', 'Review']);
    expect(next.states[1].commands.map((c) => c.name)).toEqual(['Reject']);
    expect(next.initial_state).toBe('Draft');
  });

  it('moves the initial state to the first remaining state when it is the one removed', () => {
    const next = removeWorkflowState(reviewFlow(), 'Draft');
    expect(next.initial_state).toBe('Review');
    expect(next.states[0].commands.map((c) => c.name)).toEqual(['Approve']);
  });

  it('refuses to remove the only state', () => {
    const single: WorkflowJson = {
      initial_state: 'Draft',
      states: [{ name: 'Draft', isEndState: false, commands: [] }],
    };
    expect(removeWorkflowState(single, 'Draft')).toBe(single);
  });

  it('returns the same document for a name that is no state', () => {
    const flow = reviewFlow();
    expect(removeWorkflowState(flow, 'Nowhere')).toBe(flow);
  });

  it('keeps unknown document keys and does not mutate its input', () => {
    const flow = { ...reviewFlow(), version: 3 } as WorkflowJson;
    const before = JSON.stringify(flow);
    expect(removeWorkflowState(flow, 'Published')).toMatchObject({ version: 3 });
    expect(JSON.stringify(flow)).toBe(before);
  });
});

describe('removeWorkflowCommand', () => {
  it('removes one command of one state', () => {
    const next = removeWorkflowCommand(reviewFlow(), 'Review', 'Reject');
    expect(next.states[1].commands.map((c) => c.name)).toEqual(['Approve']);
    expect(next.states[0].commands).toHaveLength(1);
  });

  it('returns the same document when there is no such command', () => {
    const flow = reviewFlow();
    expect(removeWorkflowCommand(flow, 'Review', 'Submit')).toBe(flow);
    expect(removeWorkflowCommand(flow, 'Nowhere', 'Submit')).toBe(flow);
  });
});

describe('moveWorkflowState', () => {
  it('stores the position a state was dropped at', () => {
    const next = moveWorkflowState(reviewFlow(), 'Review', { x: 420, y: 80 });
    expect(next.states[1].position).toEqual({ x: 420, y: 80 });
  });

  it('keeps the stored key order of a positioned state', () => {
    const flow = asStored(reviewFlow());
    const next = moveWorkflowState(flow, 'Draft', { x: 5, y: 6 });
    expect(Object.keys(next.states[0])).toEqual(Object.keys(flow.states[0]));
  });

  it('returns the same document for a drop that moved nothing', () => {
    const flow = reviewFlow();
    expect(moveWorkflowState(flow, 'Draft', { x: 100, y: 100 })).toBe(flow);
    expect(moveWorkflowState(flow, 'Nowhere', { x: 1, y: 1 })).toBe(flow);
  });
});

describe('findWorkflowConnectionProblem', () => {
  it('lets a state lead to another state', () => {
    expect(findWorkflowConnectionProblem(reviewFlow(), 'Draft', 'Published')).toBeNull();
  });

  it('refuses a command out of an end state', () => {
    expect(findWorkflowConnectionProblem(reviewFlow(), 'Published', 'Draft')).toEqual({
      code: 'endStateSource',
      error: 'End states cannot have outgoing commands',
    });
  });

  it('refuses a command back to its own state', () => {
    expect(findWorkflowConnectionProblem(reviewFlow(), 'Draft', 'Draft')?.code).toBe('selfTransition');
  });

  it('refuses an end that is no state', () => {
    expect(findWorkflowConnectionProblem(reviewFlow(), 'Draft', null)?.code).toBe('unknownState');
    expect(findWorkflowConnectionProblem(reviewFlow(), undefined, 'Draft')?.code).toBe('unknownState');
    expect(findWorkflowConnectionProblem(reviewFlow(), 'Draft', 'Nowhere')?.code).toBe('unknownState');
  });
});

describe('reconnectWorkflowCommand', () => {
  it('points the command at another target and stores the new handles', () => {
    const result = reconnectWorkflowCommand(
      reviewFlow(),
      { state: 'Draft', command: 'Submit' },
      { source: 'Draft', target: 'Published', sourceHandle: 'bottom-2', targetHandle: 'top-2' },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.command).toEqual({ state: 'Draft', command: 'Submit' });
    expect(result.workflowJson.states[0].commands[0]).toMatchObject({
      name: 'Submit',
      next_state: 'Published',
      sourceHandle: 'bottom-2',
      targetHandle: 'top-2',
    });
  });

  it('keeps the keys of the command it has no part in: actions, policies, module_access_keys', () => {
    const result = reconnectWorkflowCommand(
      reviewFlow(),
      { state: 'Draft', command: 'Submit' },
      { source: 'Draft', target: 'Published' },
    );
    if (!result.ok) throw new Error('refused');
    const command = result.workflowJson.states[0].commands[0];
    expect(command.module_access_keys).toEqual(['content:submit']);
    expect(command.policies).toEqual(['policy-editor']);
    expect(command.actions).toHaveLength(1);
  });

  it('finds the command of states and commands whose names contain dashes', () => {
    // An edge id of the form state-command-target cannot be taken apart again
    // for these names: 'draft-a-Go-review-b' has no single reading.
    const flow: WorkflowJson = {
      initial_state: 'draft-a',
      states: [
        {
          name: 'draft-a',
          isEndState: false,
          commands: [{ name: 'Go-review', next_state: 'review-b', actions: [], policies: [] }],
        },
        { name: 'review-b', isEndState: false, commands: [] },
        { name: 'done-c', isEndState: true, commands: [] },
      ],
    };
    const result = reconnectWorkflowCommand(
      flow,
      { state: 'draft-a', command: 'Go-review' },
      { source: 'draft-a', target: 'done-c' },
    );
    if (!result.ok) throw new Error('refused');
    expect(result.workflowJson.states[0].commands[0].next_state).toBe('done-c');
  });

  it('moves the command to the state its source end was dropped on', () => {
    const result = reconnectWorkflowCommand(
      reviewFlow(),
      { state: 'Draft', command: 'Submit' },
      { source: 'Review', target: 'Published', sourceHandle: 'top-1', targetHandle: 'top-3' },
    );
    if (!result.ok) throw new Error('refused');
    expect(result.command).toEqual({ state: 'Review', command: 'Submit' });
    expect(result.workflowJson.states[0].commands).toEqual([]);
    expect(result.workflowJson.states[1].commands.map((c) => c.name)).toEqual(['Approve', 'Reject', 'Submit']);
    expect(result.workflowJson.states[1].commands[2]).toMatchObject({
      next_state: 'Published',
      module_access_keys: ['content:submit'],
      sourceHandle: 'top-1',
    });
  });

  it('renames a moved command whose name is taken in its new state', () => {
    const flow = reviewFlow();
    flow.states[0].commands.push({ name: 'approve', next_state: 'Review', actions: [], policies: [] });
    const result = reconnectWorkflowCommand(
      flow,
      { state: 'Draft', command: 'approve' },
      { source: 'Review', target: 'Draft' },
    );
    if (!result.ok) throw new Error('refused');
    expect(result.command).toEqual({ state: 'Review', command: 'approve_1' });
    expect(result.workflowJson.states[1].commands.map((c) => c.name)).toEqual(['Approve', 'Reject', 'approve_1']);
  });

  it('refuses to move a command onto an end state', () => {
    const flow = reviewFlow();
    const result = reconnectWorkflowCommand(
      flow,
      { state: 'Draft', command: 'Submit' },
      { source: 'Published', target: 'Review' },
    );
    expect(result).toEqual({
      ok: false,
      problem: { code: 'endStateSource', error: 'End states cannot have outgoing commands' },
    });
  });

  it('lets a command that already leaves an end state take another target', () => {
    const flow = reviewFlow();
    flow.states[2].commands.push({ name: 'Reopen', next_state: 'Draft', actions: [], policies: [] });
    const result = reconnectWorkflowCommand(
      flow,
      { state: 'Published', command: 'Reopen' },
      { source: 'Published', target: 'Review' },
    );
    if (!result.ok) throw new Error('refused');
    expect(result.workflowJson.states[2].commands[0].next_state).toBe('Review');
  });

  it('refuses an end dropped on nothing, on its own state, or for a command that is gone', () => {
    const flow = reviewFlow();
    const ref = { state: 'Draft', command: 'Submit' };
    expect(reconnectWorkflowCommand(flow, ref, { source: 'Draft', target: null })).toMatchObject({
      ok: false,
      problem: { code: 'unknownState' },
    });
    expect(reconnectWorkflowCommand(flow, ref, { source: 'Draft', target: 'Draft' })).toMatchObject({
      ok: false,
      problem: { code: 'selfTransition' },
    });
    expect(
      reconnectWorkflowCommand(flow, { state: 'Draft', command: 'Gone' }, { source: 'Draft', target: 'Review' }),
    ).toMatchObject({ ok: false, problem: { code: 'unknownCommand' } });
  });

  it('does not mutate its input', () => {
    const flow = reviewFlow();
    const before = JSON.stringify(flow);
    reconnectWorkflowCommand(flow, { state: 'Draft', command: 'Submit' }, { source: 'Review', target: 'Published' });
    expect(JSON.stringify(flow)).toBe(before);
  });
});
