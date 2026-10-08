/**
 * Workflow Types
 *
 * TypeScript type definitions for the DaaS workflow domain: the definition (a
 * state machine stored as one `workflow_json` document), its assignment to a
 * collection, the instance that tracks one item, and the instance's transition
 * history. Mirrors the reference admin UI in buildpad-daas
 * (`app/{workflows,workflow-assignments,workflow-instances}`) and the four
 * tables both backends serve (`daas_wf_definition`, `daas_wf_assignment`,
 * `daas_wf_instance`, `daas_wf_history`).
 *
 * Naming. Three older, narrower shapes already use the short names and are
 * left untouched:
 *
 *   - `WorkflowAssignment` (`@buildpad/hooks`, `useWorkflowAssignment`) — a row
 *     read through the Items API, without the joined definition;
 *   - `WorkflowState` / `WorkflowInstance` (`@buildpad/hooks`,
 *     `useWorkflowVersioning`) — the two fields versioning reads;
 *   - `WorkflowDefinition` / `WorkflowState` / `WorkflowCommand` /
 *     `WorkflowAction` / `WorkflowInstance` (`@buildpad/ui-interfaces`,
 *     `workflow-button`) — there `WorkflowDefinition` is the JSON document and
 *     an instance id is a number.
 *
 * So nothing here reuses a short name: a table row is a `…Record`, and a part
 * of the `workflow_json` document is a `WorkflowJson…`.
 */

// ============================================================================
// Collections
// ============================================================================

/** Collection that stores workflow definitions. */
export const WORKFLOW_DEFINITION_COLLECTION = 'daas_wf_definition';

/** Collection that stores the assignment of a workflow to a collection. */
export const WORKFLOW_ASSIGNMENT_COLLECTION = 'daas_wf_assignment';

/** Collection that stores one workflow instance per item (or item version). */
export const WORKFLOW_INSTANCE_COLLECTION = 'daas_wf_instance';

/** Collection that stores an instance's transitions. */
export const WORKFLOW_HISTORY_COLLECTION = 'daas_wf_history';

/**
 * The four workflow collections, as both backends name them in their
 * permission checks. Gate a component on these (`usePermissions().canPerform`)
 * and on nothing else: the API enforces exactly these names, so a gate on any
 * other name hides a page from the users the API would serve.
 */
export const WORKFLOW_COLLECTIONS = {
  definition: WORKFLOW_DEFINITION_COLLECTION,
  assignment: WORKFLOW_ASSIGNMENT_COLLECTION,
  instance: WORKFLOW_INSTANCE_COLLECTION,
  history: WORKFLOW_HISTORY_COLLECTION,
} as const;

/** Name of one of the four workflow collections. */
export type WorkflowCollection = (typeof WORKFLOW_COLLECTIONS)[keyof typeof WORKFLOW_COLLECTIONS];

// ============================================================================
// The workflow_json document
// ============================================================================

/**
 * Parameters handed to the event an action emits. The named keys are the ones
 * the built-in notification action reads; an action may carry any others.
 */
export interface WorkflowActionParameters {
  subject?: string;
  message?: string;
  is_using_template?: boolean;
  template_name?: string;
  body?: string;
  is_using_html?: boolean;
  recipient_users?: string[];
  recipient_policies?: string[];
  [key: string]: unknown;
}

/** Something a command does after its transition: one emitted event. */
export interface WorkflowJsonAction {
  /** Display name */
  name: string;

  /** Event emitted on the transition (e.g. `xtr.item.promote`); may be empty */
  event_name: string;

  /** Parameters passed with the event */
  parameters: WorkflowActionParameters;
}

/**
 * A transition out of a state.
 *
 * Who may run it is `policies` OR `module_access_keys`: a caller holding any
 * listed policy or any listed key passes. A command with neither list is open
 * to every authenticated user, so an editor must never drop a key it has no
 * field for (build edited commands with `buildWorkflowCommand`).
 */
export interface WorkflowJsonCommand {
  /** Command name, unique within its state */
  name: string;

  /** Name of the state the command moves the item to */
  next_state: string;

  /** Events emitted after the transition */
  actions: WorkflowJsonAction[];

  /** IDs of the `daas_policies` allowed to run the command */
  policies: string[];

  /** Module access keys allowed to run the command */
  module_access_keys?: string[];

  /** Diagram handle the edge leaves its source state from */
  sourceHandle?: string;

  /** Diagram handle the edge enters its target state at */
  targetHandle?: string;
}

/** Where a state sits on the diagram canvas. */
export interface WorkflowStatePosition {
  x: number;
  y: number;
}

/** One state of the machine. Its name is its identity. */
export interface WorkflowJsonState {
  /** State name, unique within the workflow */
  name: string;

  /** Transitions out of this state */
  commands: WorkflowJsonCommand[];

  /** Whether reaching this state terminates the instance */
  isEndState: boolean;

  /** Saved diagram position; absent until the state is first dragged */
  position?: WorkflowStatePosition;
}

/**
 * The state machine a definition stores in `workflow_json`. Both backends
 * store the document as sent, so keys an editor does not know survive a save
 * as long as the editor spreads the stored objects.
 */
export interface WorkflowJson {
  /** Name of the state a new instance starts in */
  initial_state: string;

  /** Every state of the machine */
  states: WorkflowJsonState[];
}

// ============================================================================
// Rows
// ============================================================================

/** A `daas_wf_definition` row. */
export interface WorkflowDefinitionRecord {
  id: string;

  /** Display name */
  name: string;

  description?: string | null;

  /** The state machine */
  workflow_json: WorkflowJson;

  date_created?: string | null;
  date_updated?: string | null;
  user_created?: string | null;
  user_updated?: string | null;
}

/**
 * The definition a row embeds in place of (or beside) its `workflow` key.
 * `workflow_json` is present on a single instance and absent in lists.
 */
export interface WorkflowDefinitionRef {
  id: string;

  /** Definition name; empty when the backend answered the bare id */
  name: string;

  workflow_json?: WorkflowJson;
}

/**
 * An assignment's filter: a DaaS filter object of field conditions. Only an
 * object narrows the items; see `isWorkflowFilterRule`.
 */
export type WorkflowFilterRule = Record<string, unknown>;

/** A `daas_wf_assignment` row: one workflow bound to one collection. */
export interface WorkflowAssignmentRecord {
  id: string;

  /** ID of the assigned definition */
  workflow: string;

  /** Collection whose items get an instance */
  collection: string;

  /**
   * Narrows which items get an instance; `null` means every item. Absent when
   * the caller's grant withholds the column — which is not "no rule", so a
   * form that did not receive it must not send one back.
   */
  filter_rule?: WorkflowFilterRule | null;

  date_created?: string | null;
  date_updated?: string | null;
  user_created?: string | null;
  user_updated?: string | null;

  /**
   * The assigned definition's id and name. `null` or absent when the caller's
   * grant withholds the definition; show `workflow` instead.
   */
  workflow_definition?: WorkflowDefinitionRef | null;
}

/** A `daas_wf_instance` row: where one item (or item version) is in its workflow. */
export interface WorkflowInstanceRecord {
  id: string;

  /**
   * The instance's definition, embedded in place of the `workflow` key. `null`
   * when the caller's grant withholds the definition.
   */
  workflow: WorkflowDefinitionRef | null;

  /** Name of the state the item is in */
  current_state: string;

  /** Collection of the tracked item */
  collection: string;

  /** Primary key of the tracked item, as text */
  item_id: string;

  /** Whether the instance has reached an end state */
  terminated: boolean;

  /** Version the instance governs; `null` when it governs the item itself */
  version_key: string | null;

  date_created?: string | null;
  date_updated?: string | null;
  user_created?: string | null;
  user_updated?: string | null;
}

/** A `daas_wf_history` row: one transition of an instance. */
export interface WorkflowHistoryRecord {
  id: string;

  /** ID of the instance that moved */
  instance_id: string;

  /** Name of the command that ran */
  command: string;

  from_state: string;
  to_state: string;

  /** ID of the user who ran the command */
  transitioned_by: string;

  transitioned_date: string;

  date_created?: string | null;
  date_updated?: string | null;
  user_created?: string | null;
  user_updated?: string | null;
}

// ============================================================================
// Inputs
// ============================================================================

/** Body of a definition create. */
export interface WorkflowDefinitionInput {
  name: string;
  description?: string | null;
  workflow_json: WorkflowJson;
}

/** Body of a definition update: only the keys to change. */
export type WorkflowDefinitionUpdate = Partial<WorkflowDefinitionInput>;

/** Body of an assignment create. */
export interface WorkflowAssignmentInput {
  /** ID of the definition to assign */
  workflow: string;

  collection: string;

  /** `null` (or absent) assigns the workflow to every item of the collection */
  filter_rule?: WorkflowFilterRule | null;
}

/**
 * Body of an assignment update: only the keys to change. `filter_rule: null`
 * clears the rule; leaving the key out keeps it.
 */
export type WorkflowAssignmentUpdate = Partial<WorkflowAssignmentInput>;

// ============================================================================
// Lists
// ============================================================================

/** Parameters of a workflow list request. */
export interface WorkflowListParams {
  /** Page number (1-indexed). Default: 1. */
  page?: number;

  /** Items per page. Default: 25. */
  limit?: number;

  /** Free-text search; the searched columns differ per resource. */
  search?: string;
}

/** One page of a workflow list. */
export interface WorkflowListResult<T> {
  /** Rows of this page */
  items: T[];

  /** Rows matching the request across all pages */
  total: number;

  /** Number of pages, at least 1 */
  totalPages: number;

  /** Page that was served (1-indexed) */
  page: number;

  /** Page size that was served; smaller than the request when the backend caps it */
  limit: number;
}
