/**
 * Workflow Button Types
 * 
 * Type definitions for the workflow button interface component.
 * Based on the DaaS/Visor workflow system.
 */

/**
 * Command option available from the current workflow state
 */
export interface CommandOption {
  /** Display text for the command */
  text: string;
  /** Value identifier for the command */
  value: string | number;
  /** Command name (action to perform) */
  command: string;
  /** Next state after executing this command */
  nextState: string;
  /** Optional icon for the command */
  icon?: string | null;
  /** Optional color for the command */
  color?: string | null;
}

/**
 * Workflow command definition from workflow JSON
 */
export interface WorkflowCommand {
  /** Command name (unique identifier) */
  name: string;
  /** State to transition to after command execution */
  next_state?: string;
  /** Policy UUIDs required to execute this command */
  policies: string[];
  /** Actions to execute after transition */
  actions?: WorkflowAction[];
}

/**
 * Workflow action executed on transition
 */
export interface WorkflowAction {
  /** Action name */
  name: string;
  /** Event name to emit */
  event_name: string;
  /** Action parameters */
  parameters?: Record<string, unknown>;
}

/**
 * Workflow state definition from workflow JSON
 */
export interface WorkflowState {
  /** State name (unique identifier) */
  name: string;
  /** State type (e.g., 'initial', 'normal', 'end') */
  type?: string;
  /** Commands available from this state */
  commands: WorkflowCommand[];
  /** Whether this is an end/terminal state */
  isEndState?: boolean;
}

/**
 * Workflow definition JSON structure
 */
export interface WorkflowDefinition {
  /** Initial state when workflow starts */
  initial_state: string;
  /** All states in the workflow */
  states: WorkflowState[];
  /** State name to compare against for revision comparison */
  compare_rollback_state?: string;
}

/**
 * Workflow instance representing the current state of an item's workflow
 */
export interface WorkflowInstance {
  /** Workflow instance ID */
  id: number;
  /** Item ID this workflow is attached to */
  item_id: string | number;
  /** Current state name */
  current_state: string;
  /** Version key (for content versioning) */
  version_key?: string | null;
  /** Translation ID (for translations) */
  translation_id?: string | null;
  /** Whether the workflow has reached a terminal state */
  terminated?: boolean;
  /** Whether the item is unpublished */
  unpublished?: boolean;
  /** Workflow definition reference */
  workflow: {
    id: number;
    name: string;
    workflow_json: string;
  };
}

/**
 * Props for the WorkflowButton interface component
 */
export interface WorkflowButtonProps {
  /** Current workflow state value */
  value?: string | number | null;
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Placeholder text when no workflow exists */
  placeholder?: string;
  /** Allow selecting "none" option */
  allowNone?: boolean;
  /** Additional command choices */
  choices?: CommandOption[];
  /** Icon to display */
  icon?: string;
  /** Always show the button (even without workflow) */
  alwaysVisible?: boolean;
  /** Item ID */
  itemId?: string | number;
  /** Collection name */
  collection?: string;
  /** Version key for versioned content */
  versionKey?: string;
  /** Translation ID for translated content */
  translationId?: string;
  /** Field name storing workflow state */
  workflowField?: string;
  /** Callback when value changes */
  onChange?: (value: string) => void;
  /** Callback after successful transition */
  onTransition?: () => void;
}

/**
 * Props for the useWorkflow hook
 */
export interface UseWorkflowOptions {
  /** Item ID */
  itemId?: string | number | null;
  /** Collection name */
  collection?: string;
  /** Version key for versioned content */
  versionKey?: string | null;
  /** Translation ID for translated content */
  translationId?: string | null;
  /** API client for making requests */
  apiClient?: {
    get: (url: string, config?: { params?: Record<string, unknown> }) => Promise<{ data: { data: unknown } }>;
    post: (url: string, data?: unknown) => Promise<{ data: { data: unknown } }>;
  };
}

/**
 * Return value of the useWorkflow hook
 */
export interface UseWorkflowReturn {
  /** Current workflow instance */
  workflowInstance: WorkflowInstance | null;
  /** Workflow instance ID */
  workflowInstanceId: number | null;
  /** Available commands from current state */
  commands: CommandOption[];
  /** Error message if any */
  errorMessage: string;
  /** Loading state */
  loading: boolean;
  /** Counter that increments after each successful transition */
  transitionCount: number;
  /** Fetch/refresh the workflow instance */
  fetchWorkflowInstance: (versionKey?: string, translationId?: string) => Promise<void>;
  /** Fetch current user's policies */
  fetchUserPolicies: () => Promise<{ policy: string }[]>;
  /** Clear error message */
  clearError: () => void;
  /** Notify that a transition completed */
  notifyTransitionComplete: () => void;
  /** Execute a workflow transition */
  executeTransition: (commandName: string | number, workflowField?: string) => Promise<void>;
}
