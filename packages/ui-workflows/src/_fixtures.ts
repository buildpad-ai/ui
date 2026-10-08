/**
 * Shared mock data for the Storybook stories and the unit tests.
 *
 * Internal to stories and tests only — intentionally NOT exported from
 * `index.ts` and not bundled by tsup (it builds `src/index.ts` alone).
 */
import type { WorkflowDefinitionRecord, WorkflowJson } from '@buildpad/types';
import type { WorkflowPolicyOption } from './workflowPolicies';

export const mockPolicyOptions: WorkflowPolicyOption[] = [
  { id: 'policy-editor', name: 'Editor' },
  { id: 'policy-reviewer', name: 'Reviewer' },
  { id: 'policy-publisher', name: 'Publisher' },
];

/**
 * Draft → Review → Published, with a way back from Review. The Submit command
 * carries everything a command can: an action with parameters, a policy, a
 * module access key and the handles it was drawn between.
 */
export const reviewWorkflowJson: WorkflowJson = {
  initial_state: 'Draft',
  states: [
    {
      name: 'Draft',
      isEndState: false,
      position: { x: 60, y: 120 },
      commands: [
        {
          name: 'Submit',
          next_state: 'Review',
          actions: [
            {
              name: 'Notify reviewers',
              event_name: 'xtr.send.notification',
              parameters: { subject: 'Review requested', message: 'An item is waiting for review' },
            },
          ],
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
      position: { x: 420, y: 120 },
      commands: [
        {
          name: 'Approve',
          next_state: 'Published',
          actions: [{ name: 'Promote', event_name: 'xtr.item.promote', parameters: {} }],
          policies: ['policy-reviewer', 'policy-publisher'],
          sourceHandle: 'right-1',
          targetHandle: 'left-1',
        },
        {
          name: 'Reject',
          next_state: 'Draft',
          actions: [],
          policies: ['policy-reviewer'],
          sourceHandle: 'bottom-1',
          targetHandle: 'bottom-3',
        },
      ],
    },
    {
      name: 'Published',
      isEndState: true,
      position: { x: 780, y: 120 },
      commands: [],
    },
  ],
};

/** No state has a stored position, so the diagram lays them out on its grid. */
export const unpositionedWorkflowJson: WorkflowJson = {
  initial_state: 'Open',
  states: [
    {
      name: 'Open',
      isEndState: false,
      commands: [{ name: 'Start', next_state: 'In progress', actions: [], policies: [] }],
    },
    {
      name: 'In progress',
      isEndState: false,
      commands: [
        { name: 'Finish', next_state: 'Done', actions: [], policies: [] },
        { name: 'Cancel', next_state: 'Cancelled', actions: [], policies: [] },
      ],
    },
    { name: 'Done', isEndState: true, commands: [] },
    { name: 'Cancelled', isEndState: true, commands: [] },
  ],
};

/** State and command names that contain dashes — the names an id split on '-' cannot survive. */
export const dashedWorkflowJson: WorkflowJson = {
  initial_state: 'draft-a',
  states: [
    {
      name: 'draft-a',
      isEndState: false,
      position: { x: 60, y: 100 },
      commands: [{ name: 'Go-review', next_state: 'review-b', actions: [], policies: [] }],
    },
    { name: 'review-b', isEndState: false, position: { x: 420, y: 100 }, commands: [] },
    { name: 'done-c', isEndState: true, position: { x: 420, y: 320 }, commands: [] },
  ],
};

export const emptyWorkflowJson: WorkflowJson = { initial_state: '', states: [] };

export const mockWorkflows: WorkflowDefinitionRecord[] = [
  {
    id: '0b0e3c1a-6c2f-4a51-9d0e-2f6a4f1f0a01',
    name: 'Article review',
    description: 'Editors submit, reviewers approve or send back, publishers release.',
    workflow_json: reviewWorkflowJson,
    date_created: new Date('2026-03-02T09:00:00Z').toISOString(),
    date_updated: new Date('2026-05-11T09:00:00Z').toISOString(),
  },
  {
    id: '0b0e3c1a-6c2f-4a51-9d0e-2f6a4f1f0a02',
    name: 'Support ticket',
    description: null,
    workflow_json: unpositionedWorkflowJson,
    date_created: new Date('2026-03-09T09:00:00Z').toISOString(),
    date_updated: null,
  },
  {
    id: '0b0e3c1a-6c2f-4a51-9d0e-2f6a4f1f0a03',
    name: 'Dashed names',
    description: 'States and commands whose names contain dashes.',
    workflow_json: dashedWorkflowJson,
    date_created: new Date('2026-04-01T09:00:00Z').toISOString(),
    date_updated: null,
  },
];

export const mockWorkflow = mockWorkflows[0];

/** `count` definitions named "Workflow 01", "Workflow 02", … for a list with more than one page. */
export function manyMockWorkflows(count: number): WorkflowDefinitionRecord[] {
  return Array.from({ length: count }, (_, index) => {
    const number = String(index + 1).padStart(2, '0');
    return {
      id: `0b0e3c1a-6c2f-4a51-9d0e-2f6a4f1f1${number.padStart(3, '0')}`,
      name: `Workflow ${number}`,
      description: index % 3 === 0 ? null : `Generated definition ${number}`,
      workflow_json: index % 2 === 0 ? reviewWorkflowJson : unpositionedWorkflowJson,
    };
  });
}
