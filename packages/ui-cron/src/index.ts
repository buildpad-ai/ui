/**
 * @buildpad/ui-cron
 *
 * Cron jobs administration UI for Buildpad projects: the jobs list with its
 * row actions and the run history of every job, the job editor (code beside
 * settings, Run Now, Activate / Deactivate) with the job's own history, and
 * the run log — built with Mantine v8 and the @buildpad/hooks data layer
 * (`useCronJobs`, `useCronRuns`).
 *
 * Navigation is prop-injected (`onJobClick`, `onCreateJob`, `onBack`,
 * `onCreated`, `onSaved`) so the components work in any React app.
 *
 * The list chrome (`CronSearchInput`, `CronListFooter`, `CronListEmptyState`,
 * `CronRowActionsMenu`, `CronDeleteConfirmModal`, `CronPageState`,
 * `CronRichText`, `useCronList`) and the built-in code editor
 * (`CronCodeEditor`) are private to the package: shared by its surfaces and
 * not exported.
 */

// List surface
export { CronJobsManager } from './CronJobsManager';
export type { CronJobsManagerProps } from './CronJobsManager';

// Editor surface
export { CronJobDetail } from './CronJobDetail';
export type { CronJobDetailProps } from './CronJobDetail';

// The contract of the editor's `renderCodeEditor` slot
export type { CronCodeEditorProps } from './CronCodeEditor';

// Run history, usable on its own (the runs of one job on another page)
export { CronRunsTable } from './CronRunsTable';
export type { CronRunsTableProps } from './CronRunsTable';

export { CronRunLogModal } from './CronRunLogModal';
export type { CronRunLogModalProps } from './CronRunLogModal';

// Badges
export { CronJobStatusBadge } from './CronJobStatusBadge';
export type { CronJobStatusBadgeProps } from './CronJobStatusBadge';

export { CronRunStatusBadge } from './CronRunStatusBadge';
export type { CronRunStatusBadgeProps } from './CronRunStatusBadge';

export { CronTriggerBadge } from './CronTriggerBadge';
export type { CronTriggerBadgeProps } from './CronTriggerBadge';
