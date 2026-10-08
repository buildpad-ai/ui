/**
 * @buildpad/ui-workflows
 *
 * Workflow administration UI for Buildpad projects: the definitions list and
 * the definition editor with its state diagram, built with Mantine v8,
 * @xyflow/react and the @buildpad/hooks data layer.
 *
 * Navigation is prop-injected (`onWorkflowClick`, `onCreateWorkflow`,
 * `onBack`, `onSaved`) so the components work in any React app.
 *
 * The list chrome (`WorkflowSearchInput`, `WorkflowListFooter`,
 * `WorkflowListEmptyState`, `WorkflowRowActionsMenu`,
 * `WorkflowDeleteConfirmModal`, `WorkflowPageState`, `WorkflowRichText`) is
 * private to the package: it is shared by its surfaces and not exported.
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

// Policy options of the Command dialog
export { loadAllWorkflowPolicyOptions } from './workflowPolicies';
export type { WorkflowPolicyOption, WorkflowPolicyPage } from './workflowPolicies';
