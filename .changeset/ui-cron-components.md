---
"@buildpad/ui-cron": minor
---

New package `@buildpad/ui-cron`: the components of a Cron Jobs admin module, on the cron data layer (`useCronJobs`, `useCronRuns`, the `cron` namespace). The registry component and the installed pages are not part of this change.

- **Jobs list** (`CronJobsManager`): a Jobs tab with search, refresh, the table (name and description, schedule, timezone, status, last run and its outcome, next run for an active job), a row menu (Edit, Run Now, Activate or Deactivate, Clone, Delete) and paging with a page-size selector; a History tab with the runs of every job. The search, the page and the open tab are kept in the URL (`urlParams`, `urlParamPrefix`).
- **Job editor** (`CronJobDetail`, `id` = `new` or a job id): the code beside the settings (name, description, schedule, timezone, timeout, memory limit, and status for a stored job), Run Now, Activate or Deactivate and Save in the header, and the job's own run history on a second tab. Save sends only the fields that changed and is disabled until something has.
- **Run history** (`CronRunsTable`): one table for the runs of every job and for the runs of one (`jobId`), with its own load, Refresh and pager; a row opens the run log (`CronRunLogModal`: outcome, trigger, time, duration, error, and the console output line by line). `refreshKey` reloads it from outside.
- **Badges**: `CronJobStatusBadge`, `CronRunStatusBadge`, `CronTriggerBadge`.
- Navigation is by callback props (`onJobClick`, `onCreateJob`, `onBack`, `onCreated`, `onSaved`). The editor keeps `id="new"` after a create, so the page must navigate in `onCreated`.
- Permissions are checked on `daas_cron_jobs`, the one collection both backends decide every cron route by (`collection` prop). A user who may not save gets a read-only editor, code included, and no action buttons; a row menu without any allowed action is not drawn. Not-found, access-denied (with the server's sentence when a second factor is required) and load-error states are drawn in place, never as an empty list or an empty form, and nothing redirects.
- Run Now reads its answer: a job that was already running was not started again, and the notification says so. The request is answered when the run has ended, so the list and the history reload then, not on a timer.
- A stored timezone outside the options is shown and kept as stored; re-picking the selected Timezone or Status keeps it; Timeout and Memory Limit take whole numbers only; deleting the only row of the last page loads the page before it; the delete confirm, Run Now, Activate, Deactivate and Clone are pending while they run and take no second click; a job opens from the keyboard through a named button on its row.
- **Code editor**: the built-in one is `InputCode` of `@buildpad/ui-interfaces` (a monospace textarea with line numbers, no highlighting), named by the "Job Code" label. `renderCodeEditor` puts a host's own editor in its place (`CronCodeEditorProps` is the slot's contract); `defaultCode`, `codeHelp` and `timezoneOptions` replace the new-job snippet, the notice above the editor and the timezone list. No new npm dependency.
- Strings come from the `cron` namespace (English and Indonesian); every component takes a `translations` override. The namespace gains `jobDetail.unsavedChanges` ("Unsaved Changes", as the reference admin UI words the badge).

Storybook: `pnpm storybook:cron` (port 6014), built with the others by `pnpm build:storybook`.
