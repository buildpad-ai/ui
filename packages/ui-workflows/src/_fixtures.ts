/**
 * Shared mock data for the Storybook stories and the unit tests.
 *
 * Internal to stories and tests only — intentionally NOT exported from
 * `index.ts` and not bundled by tsup (it builds `src/index.ts` alone).
 */
import type {
  WorkflowAssignmentRecord,
  WorkflowDefinitionRecord,
  WorkflowHistoryRecord,
  WorkflowInstanceRecord,
  WorkflowJson,
} from '@buildpad/types';
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

// ---------------------------------------------------------------------------
// Assignments
// ---------------------------------------------------------------------------

/** The collections the assignment form's Collection picker offers. */
export const mockCollectionNames = ['articles', 'pages', 'tickets'];

/**
 * One assignment with a filter rule, one without, and one whose definition the
 * caller's grant withholds (the list shows the workflow's id for it).
 */
export const mockAssignments: WorkflowAssignmentRecord[] = [
  {
    id: '1c1f4d2b-7d30-4b62-8e1f-3a7b5a2a0b01',
    workflow: mockWorkflows[0].id,
    collection: 'articles',
    filter_rule: { status: { _eq: 'draft' } },
    date_created: new Date('2026-04-02T09:00:00Z').toISOString(),
    workflow_definition: { id: mockWorkflows[0].id, name: mockWorkflows[0].name },
  },
  {
    id: '1c1f4d2b-7d30-4b62-8e1f-3a7b5a2a0b02',
    workflow: mockWorkflows[1].id,
    collection: 'tickets',
    filter_rule: null,
    date_created: new Date('2026-04-09T09:00:00Z').toISOString(),
    workflow_definition: { id: mockWorkflows[1].id, name: mockWorkflows[1].name },
  },
  {
    id: '1c1f4d2b-7d30-4b62-8e1f-3a7b5a2a0b03',
    workflow: mockWorkflows[2].id,
    collection: 'pages',
    filter_rule: null,
    date_created: null,
    workflow_definition: null,
  },
];

export const mockAssignment = mockAssignments[0];

/** `count` assignments for the collections "collection_01", "collection_02", … */
export function manyMockAssignments(count: number): WorkflowAssignmentRecord[] {
  return Array.from({ length: count }, (_, index) => {
    const number = String(index + 1).padStart(2, '0');
    const workflow = mockWorkflows[index % mockWorkflows.length];
    return {
      id: `1c1f4d2b-7d30-4b62-8e1f-3a7b5a2a1${number.padStart(3, '0')}`,
      workflow: workflow.id,
      collection: `collection_${number}`,
      filter_rule: index % 2 === 0 ? null : { status: { _eq: 'draft' } },
      date_created: new Date('2026-04-02T09:00:00Z').toISOString(),
      workflow_definition: { id: workflow.id, name: workflow.name },
    };
  });
}

// ---------------------------------------------------------------------------
// Instances
// ---------------------------------------------------------------------------

/**
 * An active instance in Review, a terminated one that governs a version, and
 * one whose definition the caller's grant withholds. In a list the embedded
 * definition has no `workflow_json`; see `mockInstance` for a single one.
 */
export const mockInstances: WorkflowInstanceRecord[] = [
  {
    id: '2d2a5e3c-8e41-4c73-9f2a-4b8c6b3b0c01',
    workflow: { id: mockWorkflows[0].id, name: mockWorkflows[0].name },
    current_state: 'Review',
    collection: 'articles',
    item_id: '42',
    terminated: false,
    version_key: null,
    date_created: new Date('2026-05-04T09:00:00Z').toISOString(),
    date_updated: new Date('2026-05-06T10:30:00Z').toISOString(),
  },
  {
    id: '2d2a5e3c-8e41-4c73-9f2a-4b8c6b3b0c02',
    workflow: { id: mockWorkflows[0].id, name: mockWorkflows[0].name },
    current_state: 'Published',
    collection: 'articles',
    item_id: '7',
    terminated: true,
    version_key: 'spring-edit',
    date_created: new Date('2026-05-01T09:00:00Z').toISOString(),
    date_updated: new Date('2026-05-03T09:00:00Z').toISOString(),
  },
  {
    id: '2d2a5e3c-8e41-4c73-9f2a-4b8c6b3b0c03',
    workflow: null,
    current_state: 'Open',
    collection: 'tickets',
    item_id: '9f1c',
    terminated: false,
    version_key: null,
    date_created: null,
    date_updated: null,
  },
];

/** The first instance as a GET by id answers it: with its definition's document. */
export const mockInstance: WorkflowInstanceRecord = {
  ...mockInstances[0],
  workflow: { id: mockWorkflows[0].id, name: mockWorkflows[0].name, workflow_json: reviewWorkflowJson },
};

/** The transitions of `mockInstance`, newest first. */
export const mockHistory: WorkflowHistoryRecord[] = [
  {
    id: '3e3b6f4d-9f52-4d84-8a3b-5c9d7c4c0d02',
    instance_id: mockInstances[0].id,
    command: 'Submit',
    from_state: 'Draft',
    to_state: 'Review',
    transitioned_by: '4f4c7a5e-a063-4e95-9b4c-6dae8d5d0e01',
    transitioned_date: new Date('2026-05-06T10:30:00Z').toISOString(),
  },
  {
    id: '3e3b6f4d-9f52-4d84-8a3b-5c9d7c4c0d01',
    instance_id: mockInstances[0].id,
    command: 'Reject',
    from_state: 'Review',
    to_state: 'Draft',
    transitioned_by: '4f4c7a5e-a063-4e95-9b4c-6dae8d5d0e02',
    transitioned_date: new Date('2026-05-05T08:15:00Z').toISOString(),
  },
];

/** `count` instances for the items "1", "2", … of `articles`. */
export function manyMockInstances(count: number): WorkflowInstanceRecord[] {
  return Array.from({ length: count }, (_, index) => {
    const number = String(index + 1).padStart(3, '0');
    return {
      id: `2d2a5e3c-8e41-4c73-9f2a-4b8c6b3b1${number}`,
      workflow: { id: mockWorkflows[0].id, name: mockWorkflows[0].name },
      current_state: index % 2 === 0 ? 'Draft' : 'Review',
      collection: 'articles',
      item_id: String(index + 1),
      terminated: false,
      version_key: null,
      date_created: new Date('2026-05-04T09:00:00Z').toISOString(),
    };
  });
}
