/**
 * @buildpad/ui-workflows
 *
 * Workflow administration UI for Buildpad projects: the definitions list and
 * the definition editor with its state diagram, the assignments list and
 * form, and the read-only instances list and detail, built with Mantine v8,
 * @xyflow/react and the @buildpad/hooks data layer.
 *
 * Navigation is prop-injected (`onWorkflowClick`, `onCreateWorkflow`,
 * `onAssignmentClick`, `onCreateAssignment`, `onInstanceClick`, `onBack`,
 * `onSaved`) so the components work in any React app.
 *
 * The list chrome (`WorkflowSearchInput`, `WorkflowListFooter`,
 * `WorkflowListEmptyState`, `WorkflowRowActionsMenu`,
 * `WorkflowDeleteConfirmModal`, `WorkflowPageState`, `WorkflowRichText`,
 * `useWorkflowList`) is private to the package: it is shared by its surfaces
 * and not exported.
 */

// Definitions surfaces
export { WorkflowsManager } from './WorkflowsManager';
export type { WorkflowsManagerProps } from './WorkflowsManager';

export { WorkflowDetail } from './WorkflowDetail';
export type { WorkflowDetailProps } from './WorkflowDetail';

// The editor's parts, usable on their own (a read-only diagram on another page)
export { WorkflowDiagram } from './WorkflowDiagram';
export type { WorkflowDiagramProps } from './WorkflowDiagram';

export { WorkflowStateModal } from './WorkflowStateModal';
export type { WorkflowStateModalProps } from './WorkflowStateModal';

export { WorkflowCommandModal } from './WorkflowCommandModal';
export type { WorkflowCommandModalProps } from './WorkflowCommandModal';

// Assignments surfaces
export { WorkflowAssignmentsManager } from './WorkflowAssignmentsManager';
export type { WorkflowAssignmentsManagerProps } from './WorkflowAssignmentsManager';

export { WorkflowAssignmentDetail } from './WorkflowAssignmentDetail';
export type { WorkflowAssignmentDetailProps } from './WorkflowAssignmentDetail';

// Instances surfaces (read-only)
export { WorkflowInstancesManager } from './WorkflowInstancesManager';
export type { WorkflowInstancesManagerProps } from './WorkflowInstancesManager';

export { WorkflowInstanceDetail } from './WorkflowInstanceDetail';
export type { WorkflowInstanceDetailProps } from './WorkflowInstanceDetail';

// Policy options of the Command dialog
export { loadAllWorkflowPolicyOptions } from './workflowPolicies';
export type { WorkflowPolicyOption, WorkflowPolicyPage } from './workflowPolicies';

// Picker options of the assignment form
export { loadWorkflowCollectionNames } from './workflowAssignmentOptions';
export type { WorkflowDefinitionOption } from './workflowAssignmentOptions';
