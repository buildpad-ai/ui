---
"@buildpad/types": minor
"@buildpad/hooks": minor
"@buildpad/utils": minor
"@buildpad/cli": minor
---

Data layer for a Cron Jobs admin module: types, data hooks, form logic and translations. No components yet.

- **Types** (`@buildpad/types`, `cron.ts`): `CronJobRecord` (a `daas_cron_jobs` row), `CronRunRecord` (a `daas_cron_history` row), `CronJobStatus`, `CronRunStatus` and `CronTriggeredBy` with their value lists, the create and update bodies (`CronJobInput`, `CronJobPatch`), `CronRunResult`, and the list shapes (`CronListResult<T>`, `CronRunListResult`). The two collection names are constants (`CRON_COLLECTIONS`); gate on `CRON_JOBS_COLLECTION` (`daas_cron_jobs`), the one name both backends check for every cron route, the history routes included.
- On a `CronJobRecord` only `id` and `name` are certain: both backends drop a column the caller's grant withholds, `code` above all.
- **Hooks** (`@buildpad/hooks`): `useCronJobs` (list with search and status, get, create, update, delete, clone, run) and `useCronRuns` (the runs of every job, or of one, paged by `page` or `offset`). They work against both backends through `apiRequest`, with no proxy routes: list counts are read from `count`/`totalPages` and from `meta.filter_count`/`meta.total_pages`, run counts from `meta.total`/`limit`/`offset`, `data: null` is an empty page, and the paging parameters are always sent.
- Every method rejects with a `DaaSRequestError`. An id that is not a valid one is `notFound` on both backends (one answers 404, the other 400 `INVALID_ID`). The refusals the Next.js routes answer as a 500 are read as what they mean: a save, a delete or a run on a job that is gone is `notFound`, a save the caller's row rule refuses is `forbidden`, and code that does not compile is `invalid`.
- `runJob` resolves when the run has ended, to `{ historyId, skipped, message }`. `skipped` is `true` when the job was already running and nothing ran; a run whose code failed still resolves, and its outcome is the history row's status.
- `updateJob` sends a cleared description as `null`, which both backends store as no description, and `createJob` leaves a blank one out. `cloneJob` does not send a blank name.
- **Form logic** (`@buildpad/utils`, `cron.ts`): `changedCronJobFields` builds a save from the fields the user changed, so a status changed elsewhere is not overwritten and an emptied description is sent; `cronTimezoneOptions` adds a stored timezone outside the 26 UTC offsets (`CRON_TIMEZONE_OPTIONS`) as its own option and `displayCronTimezone` labels it; `cronJobToForm` and `withheldCronJobFields` read a job answered without some of its columns; `normalizeCronTimeoutMs` and `normalizeCronMemoryLimitMb` keep a decimal out of the two integer columns; `findCronJobFormProblem` returns what refuses a save, with a code to translate; `cronJobInputFromForm` builds a create; `parseCronLogLine` takes a `[time] [LEVEL] message` log entry apart, also when the message spans several lines. `DEFAULT_CRON_CODE` and `CRON_FORM_DEFAULTS` are what a new job starts with; the default code logs the run's context and returns, which runs on both backends.
- **Translations** (`@buildpad/utils`): a `cron` namespace with English defaults and the Indonesian catalog.

`buildpad add hooks`, `add types` and `add utils` (and `upgrade`) install the new files.
