/**
 * Pure helpers for the cron jobs list, the job editor and the run log.
 *
 * The job editor is a form over a stored row, and three things about that row
 * are easy to get wrong in a component:
 *
 *   - Save must send the fields the user changed and nothing else. The form is
 *     a snapshot of the job taken when it was loaded; sending the snapshot
 *     back writes every untouched field as it was at load, and a job
 *     activated elsewhere since is set back to inactive by a Save that only
 *     edited the description (`changedCronJobFields`).
 *   - A stored timezone is free text on the server, while the form offers a
 *     fixed list of UTC offsets. A value outside the list has to be shown, and
 *     kept, as it is stored (`cronTimezoneOptions`).
 *   - Both backends drop a column the caller's grant withholds. A form built
 *     from such a row must not present a default as the stored value
 *     (`cronJobToForm`, `withheldCronJobFields`).
 *
 * The checks that refuse a save name their field with a `code` a component
 * translates, beside the English sentence the reference admin UI
 * (buildpad-daas) shows.
 *
 * Ported from buildpad-daas `lib/utils/cron-job-changes.ts` and the helpers
 * the two pages of `app/[lang]/cron` each defined a copy of (the log-line
 * parser, the timezone label, the timezone options, the form defaults, the
 * default code). Nothing here touches the DOM, React or the network.
 */
import type { CronJobInput, CronJobPatch, CronJobRecord, CronJobStatus } from '@buildpad/types';

// ============================================================================
// Run log
// ============================================================================

/**
 * How a log line was written: `console.log` / `info` / `debug` are `INFO`,
 * `console.warn` is `WARN`, `console.error` is `ERROR`. `RAW` is a line that
 * is not in the `[time] [LEVEL] message` form at all.
 */
export type CronLogLevel = 'INFO' | 'WARN' | 'ERROR' | 'RAW';

/** One entry of a run's `logs`, taken apart. */
export interface CronLogLine {
  /** The ISO time the line was written; `''` for a `RAW` line */
  timestamp: string;
  level: CronLogLevel;
  /** What the code printed; the whole entry for a `RAW` line */
  message: string;
}

// Both backends write an entry as `[<ISO time>] [<LEVEL>] <message>`. The
// message is matched across line breaks: an object is printed with
// `JSON.stringify(value, null, 2)`, so one entry can span several lines.
const LOG_LINE = /^\[([^\]]+)\] \[(INFO|WARN|ERROR)\] ([\s\S]*)$/;

/**
 * One entry of a run's `logs` as its time, its level and its message.
 *
 * An entry in any other form (an older row, a line written by something else)
 * is a `RAW` line carrying the entry unchanged, so nothing a run printed is
 * ever dropped. A value that is not a string reads as its text.
 */
export function parseCronLogLine(line: unknown): CronLogLine {
  let text = '';
  if (typeof line === 'string') text = line;
  else if (line !== null && line !== undefined) text = String(line);
  const match = LOG_LINE.exec(text);
  if (!match) return { timestamp: '', level: 'RAW', message: text };
  return { timestamp: match[1], level: match[2] as CronLogLevel, message: match[3] };
}

// ============================================================================
// Timezones
// ============================================================================

/** An option of the Timezone select. */
export interface CronTimezoneOption {
  /** The value stored on the job */
  value: string;
  /** What the select shows */
  label: string;
}

/** The timezone a job gets when none is chosen; also the server's default. */
export const DEFAULT_CRON_TIMEZONE = 'UTC';

/**
 * The default options of the Timezone select: the 26 whole-hour UTC offsets,
 * UTC-12 to UTC+13, in order.
 *
 * The values are IANA `Etc/GMT±N` names, whose sign is the reverse of the
 * offset's (`Etc/GMT-7` is UTC+7). They have no daylight saving time, which
 * is why a schedule in one of them fires at the same UTC instant all year.
 */
export const CRON_TIMEZONE_OPTIONS: readonly CronTimezoneOption[] = [
  { value: 'Etc/GMT+12', label: 'UTC-12' },
  { value: 'Etc/GMT+11', label: 'UTC-11' },
  { value: 'Etc/GMT+10', label: 'UTC-10' },
  { value: 'Etc/GMT+9', label: 'UTC-9' },
  { value: 'Etc/GMT+8', label: 'UTC-8' },
  { value: 'Etc/GMT+7', label: 'UTC-7' },
  { value: 'Etc/GMT+6', label: 'UTC-6' },
  { value: 'Etc/GMT+5', label: 'UTC-5' },
  { value: 'Etc/GMT+4', label: 'UTC-4' },
  { value: 'Etc/GMT+3', label: 'UTC-3' },
  { value: 'Etc/GMT+2', label: 'UTC-2' },
  { value: 'Etc/GMT+1', label: 'UTC-1' },
  { value: 'UTC', label: 'UTC+0' },
  { value: 'Etc/GMT-1', label: 'UTC+1' },
  { value: 'Etc/GMT-2', label: 'UTC+2' },
  { value: 'Etc/GMT-3', label: 'UTC+3' },
  { value: 'Etc/GMT-4', label: 'UTC+4' },
  { value: 'Etc/GMT-5', label: 'UTC+5' },
  { value: 'Etc/GMT-6', label: 'UTC+6' },
  { value: 'Etc/GMT-7', label: 'UTC+7' },
  { value: 'Etc/GMT-8', label: 'UTC+8' },
  { value: 'Etc/GMT-9', label: 'UTC+9' },
  { value: 'Etc/GMT-10', label: 'UTC+10' },
  { value: 'Etc/GMT-11', label: 'UTC+11' },
  { value: 'Etc/GMT-12', label: 'UTC+12' },
  { value: 'Etc/GMT-13', label: 'UTC+13' },
];

/**
 * A stored timezone as the user reads it: `UTC` is `UTC+0`, an `Etc/GMT±N`
 * name is its offset with the sign the right way round (`Etc/GMT-7` is
 * `UTC+7`), and any other name (`Asia/Jakarta`) is shown as it is stored.
 * A missing value is `''`.
 */
export function displayCronTimezone(timezone: string | null | undefined): string {
  if (!timezone) return '';
  if (timezone === 'UTC') return 'UTC+0';
  const match = /^Etc\/GMT([+-]\d+)$/.exec(timezone);
  if (!match) return timezone;
  // POSIX sign is inverted: Etc/GMT-7 = UTC+7. `|| 0` keeps Etc/GMT+0 from reading "-0".
  const offset = -Number.parseInt(match[1], 10) || 0;
  return `UTC${offset >= 0 ? '+' : ''}${offset}`;
}

/**
 * The options of the Timezone select for a job whose stored timezone is
 * `stored`: `options`, with the stored value as one more option, first, when
 * it is not among them.
 *
 * Without that option a select has nothing to show for the stored value: it
 * draws another option's label (or none) while the form still holds the
 * stored name, and a user who picks from the list has no way back to it. With
 * it, the job's own timezone is on screen and stays selected until the user
 * chooses another. A missing or blank `stored` adds nothing.
 */
export function cronTimezoneOptions(
  stored?: string | null,
  options: readonly CronTimezoneOption[] = CRON_TIMEZONE_OPTIONS,
): CronTimezoneOption[] {
  const listed = [...options];
  if (!stored || !stored.trim() || listed.some((option) => option.value === stored)) return listed;
  return [{ value: stored, label: displayCronTimezone(stored) }, ...listed];
}

// ============================================================================
// The job form
// ============================================================================

/**
 * The code a new job starts with.
 *
 * It runs unchanged on both backends, so it uses only what both give a job:
 * the `context` object, `console`, and a `return`. It names nothing of
 * `services` (the Go engine refuses `services.supabase`), waits for nothing
 * (the engine's sandbox has no `setTimeout` and no event loop: a promise that
 * nothing settles ends the run at once, as an error), and both backends
 * compile it as the body of an async function, where a top-level `return` is
 * allowed.
 */
export const DEFAULT_CRON_CODE = `// Available: context, services, console, JSON, Date, Math
//
// context: { jobId, jobName, triggeredBy, runId, scheduledAt }
// services: what the server lets a job use. It differs per backend,
//   so check your backend's documentation before you call it.
//
// The code runs as the body of an async function: use await, return
// when the job is done, and throw to mark the run as failed.

console.log('Job started:', context.jobName);
console.log('Triggered by:', context.triggeredBy);

return { ok: true };
`;

/** The job editor's fields, as its inputs hold them. */
export interface CronJobForm {
  name: string;
  /** `''` when the job has no description (the column is NULL) */
  description: string;
  schedule: string;
  timezone: string;
  code: string;
  status: CronJobStatus;
  timeout_ms: number;
  memory_limit_mb: number;
}

/** Name of one field of the job editor. */
export type CronJobFormField = keyof CronJobForm;

/** The job editor's fields, in the order they are compared and sent. */
export const CRON_JOB_FORM_FIELDS: readonly CronJobFormField[] = [
  'name',
  'description',
  'schedule',
  'timezone',
  'code',
  'status',
  'timeout_ms',
  'memory_limit_mb',
];

/**
 * What the form of a new job starts with — the reference admin UI's values.
 *
 * One differs from what the server stores when the key is left out of a
 * create: `timeout_ms` is 10000 here and 30000 there. The form always sends
 * its own value, so a job created through it gets 10 seconds; one created
 * through the API without the key gets 30. The others agree with the server
 * (`timezone` `UTC`, `status` `inactive`, `memory_limit_mb` 64). `schedule`
 * (weekdays at 09:00) and `code` have no server default: both are required.
 */
export const CRON_FORM_DEFAULTS: Readonly<CronJobForm> = {
  name: '',
  description: '',
  schedule: '0 9 * * 1-5',
  timezone: DEFAULT_CRON_TIMEZONE,
  code: DEFAULT_CRON_CODE,
  status: 'inactive',
  timeout_ms: 10000,
  memory_limit_mb: 64,
};

/**
 * The bounds the reference admin UI gives the Timeout and Memory Limit number
 * inputs. They are the form's, not the server's: both backends store any
 * positive integer, so a job written through the API can hold a value outside
 * them, and it must be shown as stored.
 */
export const CRON_NUMBER_INPUTS = {
  timeout_ms: { min: 1000, step: 1000 },
  memory_limit_mb: { min: 16, max: 512, step: 16 },
} as const;

/** The largest value the `timeout_ms` and `memory_limit_mb` columns hold (a 32-bit integer). */
const MAX_INT32 = 2147483647;

/** A number input's value as a whole number from 1 up, or `fallback`. */
function normalizeCronInteger(value: unknown, fallback: number): number {
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof number !== 'number' || !Number.isFinite(number)) return fallback;
  const whole = Math.trunc(number);
  if (whole < 1) return fallback;
  return Math.min(whole, MAX_INT32);
}

/**
 * The Timeout input's value as a `timeout_ms` the server stores: a positive
 * whole number of milliseconds.
 *
 * A fraction is dropped (1500.5 is 1500): the column is an integer, and a
 * decimal sent as typed is refused by the engine and reaches the user as a
 * database error on the other backend. Anything that is not a number (an
 * emptied input holds `''`), and zero or less, is `fallback` — by default the
 * form's own default. A numeric string is read as its number.
 */
export function normalizeCronTimeoutMs(
  value: unknown,
  fallback: number = CRON_FORM_DEFAULTS.timeout_ms,
): number {
  return normalizeCronInteger(value, fallback);
}

/**
 * The Memory Limit input's value as a `memory_limit_mb` the server stores: a
 * positive whole number of megabytes, by the rules of
 * `normalizeCronTimeoutMs`. `fallback` defaults to the form's own default.
 */
export function normalizeCronMemoryLimitMb(
  value: unknown,
  fallback: number = CRON_FORM_DEFAULTS.memory_limit_mb,
): number {
  return normalizeCronInteger(value, fallback);
}

/**
 * The form of a stored job.
 *
 * A field the row does not carry — both backends drop a column the caller's
 * grant withholds — gets a neutral value: `''` for a text, the form default
 * for the timezone, the status and the two limits. `code` is never given the
 * default snippet: an editor showing it would present code the job does not
 * have. Use `withheldCronJobFields` to make those inputs read-only; as long
 * as the user cannot edit them, `changedCronJobFields` leaves them out of a
 * save, because the form still holds what it was filled with.
 *
 * A `null` description (the column's empty state) is `''`.
 */
export function cronJobToForm(job: Partial<CronJobRecord>): CronJobForm {
  return {
    name: job.name ?? '',
    description: job.description ?? '',
    schedule: job.schedule ?? '',
    timezone: job.timezone ?? CRON_FORM_DEFAULTS.timezone,
    code: job.code ?? '',
    status: job.status ?? CRON_FORM_DEFAULTS.status,
    timeout_ms: job.timeout_ms ?? CRON_FORM_DEFAULTS.timeout_ms,
    memory_limit_mb: job.memory_limit_mb ?? CRON_FORM_DEFAULTS.memory_limit_mb,
  };
}

/**
 * The form fields a stored job was answered without: the columns the
 * caller's grant withholds. Their inputs have no stored value to show and
 * must not be editable. `description` is withheld only when its key is
 * absent; `null` is a job without a description.
 */
export function withheldCronJobFields(job: Partial<CronJobRecord>): CronJobFormField[] {
  return CRON_JOB_FORM_FIELDS.filter((field) => job[field] === undefined);
}

/**
 * The body of a create, from the form of a new job. A blank description is
 * left out, so the job is stored without one.
 */
export function cronJobInputFromForm(form: CronJobForm): CronJobInput {
  const input: CronJobInput = {
    name: form.name,
    schedule: form.schedule,
    timezone: form.timezone,
    code: form.code,
    status: form.status,
    timeout_ms: form.timeout_ms,
    memory_limit_mb: form.memory_limit_mb,
  };
  if (form.description !== '') input.description = form.description;
  return input;
}

/**
 * The body of a Save on a stored job: each field of `current` that differs
 * from `loaded`, the values the form was last filled with from the server.
 *
 * A field the user did not touch is not sent, so it cannot overwrite a change
 * made elsewhere since the form was loaded (the list's Activate, another tab,
 * the header buttons of a second window). A changed field is always sent,
 * also when the user emptied it: a key left out of the body is a column the
 * server does not touch, so the old value would stay. An emptied description
 * is `null` — the job goes back to having none.
 *
 * No difference gives `{}`; there is nothing to save.
 */
export function changedCronJobFields(loaded: CronJobForm, current: CronJobForm): CronJobPatch {
  const changes: CronJobPatch = {};

  if (current.name !== loaded.name) changes.name = current.name;
  // description is the one nullable column, and a job created without one holds
  // NULL: an emptied description goes back to that.
  if (current.description !== loaded.description) {
    changes.description = current.description === '' ? null : current.description;
  }
  if (current.schedule !== loaded.schedule) changes.schedule = current.schedule;
  if (current.timezone !== loaded.timezone) changes.timezone = current.timezone;
  if (current.code !== loaded.code) changes.code = current.code;
  if (current.status !== loaded.status) changes.status = current.status;
  if (current.timeout_ms !== loaded.timeout_ms) changes.timeout_ms = current.timeout_ms;
  if (current.memory_limit_mb !== loaded.memory_limit_mb) {
    changes.memory_limit_mb = current.memory_limit_mb;
  }

  return changes;
}

/** Why a job cannot be saved: the failing field, a code to translate, and the English sentence. */
export interface CronJobFormProblem {
  /** The form field the error belongs under */
  field: 'name' | 'schedule' | 'code' | 'timeout_ms' | 'memory_limit_mb';
  code:
    | 'nameRequired'
    | 'scheduleRequired'
    | 'codeRequired'
    | 'timeoutNotWholeNumber'
    | 'memoryLimitNotWholeNumber';
  error: string;
}

function isPositiveInteger(value: unknown): boolean {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

/**
 * The first thing that refuses a job save, or null when it can be sent.
 *
 * The name, the schedule and the code are required (text of only spaces is
 * none). The two limits must be positive whole numbers: both columns are
 * integers. Whether the schedule is a valid expression and the code compiles
 * is the server's to say — both backends refuse either with a sentence of
 * their own, and that is the error to show.
 */
export function findCronJobFormProblem(
  form: Pick<CronJobForm, 'name' | 'schedule' | 'code' | 'timeout_ms' | 'memory_limit_mb'>,
): CronJobFormProblem | null {
  if (!form.name.trim()) {
    return { field: 'name', code: 'nameRequired', error: 'Name is required' };
  }
  if (!form.schedule.trim()) {
    return { field: 'schedule', code: 'scheduleRequired', error: 'Schedule expression is required' };
  }
  if (!form.code.trim()) {
    return { field: 'code', code: 'codeRequired', error: 'Code is required' };
  }
  if (!isPositiveInteger(form.timeout_ms)) {
    return {
      field: 'timeout_ms',
      code: 'timeoutNotWholeNumber',
      error: 'Timeout must be a whole number of milliseconds, 1 or more',
    };
  }
  if (!isPositiveInteger(form.memory_limit_mb)) {
    return {
      field: 'memory_limit_mb',
      code: 'memoryLimitNotWholeNumber',
      error: 'Memory limit must be a whole number of megabytes, 1 or more',
    };
  }
  return null;
}
