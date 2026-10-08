/**
 * Cron helpers: the run log parser, the timezone label and options, the form
 * of a stored job, the two integer inputs, the bodies of a create and of a
 * save, and the checks that refuse a save.
 *
 * `wire()` is a save's body as a route receives it (JSON drops `undefined`),
 * so a key asserted there is a column the server writes and a missing key is
 * one it leaves alone.
 */
import { describe, it, expect } from 'vitest';
import type { CronJobRecord } from '@buildpad/types';
import {
  changedCronJobFields,
  CRON_FORM_DEFAULTS,
  CRON_JOB_FORM_FIELDS,
  CRON_NUMBER_INPUTS,
  CRON_TIMEZONE_OPTIONS,
  cronJobInputFromForm,
  cronJobToForm,
  cronTimezoneOptions,
  DEFAULT_CRON_CODE,
  DEFAULT_CRON_TIMEZONE,
  displayCronTimezone,
  findCronJobFormProblem,
  normalizeCronMemoryLimitMb,
  normalizeCronTimeoutMs,
  parseCronLogLine,
  withheldCronJobFields,
  type CronJobForm,
} from '../src/cron';

describe('parseCronLogLine', () => {
  it.each([
    ['INFO', 'Job started: nightly-report'],
    ['WARN', 'Slow answer from the mail server'],
    ['ERROR', 'Row 12 has no address'],
  ] as const)('takes a %s line apart', (level, message) => {
    expect(parseCronLogLine(`[2026-10-08T02:00:00.123Z] [${level}] ${message}`)).toEqual({
      timestamp: '2026-10-08T02:00:00.123Z',
      level,
      message,
    });
  });

  it('keeps a message that spans several lines whole', () => {
    // console.log(object) is written with JSON.stringify(value, null, 2)
    const line = '[2026-10-08T02:00:00.123Z] [INFO] Result: {\n  "rows": 3\n}';

    expect(parseCronLogLine(line)).toEqual({
      timestamp: '2026-10-08T02:00:00.123Z',
      level: 'INFO',
      message: 'Result: {\n  "rows": 3\n}',
    });
  });

  it('keeps brackets and an empty text in the message', () => {
    expect(parseCronLogLine('[t] [INFO] [debug] [x] done').message).toBe('[debug] [x] done');
    expect(parseCronLogLine('[t] [INFO] ')).toEqual({ timestamp: 't', level: 'INFO', message: '' });
  });

  it.each([
    ['plain text', 'Job started'],
    ['a level the backends do not write', '[2026-10-08T02:00:00.123Z] [DEBUG] hidden'],
    ['a lower-case level', '[2026-10-08T02:00:00.123Z] [info] hidden'],
    ['a line without a time', '[INFO] no time'],
    ['an empty entry', ''],
  ])('reads %s as a RAW line, unchanged', (_what, line) => {
    expect(parseCronLogLine(line)).toEqual({ timestamp: '', level: 'RAW', message: line });
  });

  it('reads an entry that is not a string as its text', () => {
    expect(parseCronLogLine(42)).toEqual({ timestamp: '', level: 'RAW', message: '42' });
    expect(parseCronLogLine(null)).toEqual({ timestamp: '', level: 'RAW', message: '' });
    expect(parseCronLogLine(undefined)).toEqual({ timestamp: '', level: 'RAW', message: '' });
  });
});

describe('displayCronTimezone', () => {
  it('shows UTC as UTC+0', () => {
    expect(displayCronTimezone('UTC')).toBe('UTC+0');
  });

  it('turns the sign of an Etc/GMT name the right way round', () => {
    expect(displayCronTimezone('Etc/GMT-7')).toBe('UTC+7');
    expect(displayCronTimezone('Etc/GMT+5')).toBe('UTC-5');
    expect(displayCronTimezone('Etc/GMT-13')).toBe('UTC+13');
    expect(displayCronTimezone('Etc/GMT+12')).toBe('UTC-12');
  });

  it('shows a zero offset as UTC+0, whichever sign it is written with', () => {
    expect(displayCronTimezone('Etc/GMT+0')).toBe('UTC+0');
    expect(displayCronTimezone('Etc/GMT-0')).toBe('UTC+0');
  });

  it('shows any other stored name as it is stored', () => {
    expect(displayCronTimezone('Asia/Jakarta')).toBe('Asia/Jakarta');
    expect(displayCronTimezone('Europe/Berlin')).toBe('Europe/Berlin');
    expect(displayCronTimezone('Etc/GMT')).toBe('Etc/GMT');
  });

  it('shows nothing for a missing value', () => {
    expect(displayCronTimezone(undefined)).toBe('');
    expect(displayCronTimezone(null)).toBe('');
    expect(displayCronTimezone('')).toBe('');
  });

  it('gives every default option the label the list shows for it', () => {
    for (const option of CRON_TIMEZONE_OPTIONS) {
      expect(displayCronTimezone(option.value), option.value).toBe(option.label);
    }
  });
});

describe('CRON_TIMEZONE_OPTIONS', () => {
  it('is the 26 whole-hour offsets from UTC-12 to UTC+13, in order', () => {
    expect(CRON_TIMEZONE_OPTIONS).toHaveLength(26);
    expect(CRON_TIMEZONE_OPTIONS.map((option) => option.label)).toEqual(
      Array.from({ length: 26 }, (_, i) => {
        const offset = i - 12;
        return `UTC${offset >= 0 ? '+' : ''}${offset}`;
      }),
    );
  });

  it('has no value twice, and holds the default timezone', () => {
    const values = CRON_TIMEZONE_OPTIONS.map((option) => option.value);
    expect(new Set(values).size).toBe(values.length);
    expect(values).toContain(DEFAULT_CRON_TIMEZONE);
    expect(DEFAULT_CRON_TIMEZONE).toBe('UTC');
  });
});

describe('cronTimezoneOptions', () => {
  it('is the default list for a stored value that is in it', () => {
    expect(cronTimezoneOptions('Etc/GMT-7')).toEqual(CRON_TIMEZONE_OPTIONS);
    expect(cronTimezoneOptions('UTC')).toEqual(CRON_TIMEZONE_OPTIONS);
  });

  it('is the default list when there is no stored value', () => {
    expect(cronTimezoneOptions()).toEqual(CRON_TIMEZONE_OPTIONS);
    expect(cronTimezoneOptions(null)).toEqual(CRON_TIMEZONE_OPTIONS);
    expect(cronTimezoneOptions('')).toEqual(CRON_TIMEZONE_OPTIONS);
    expect(cronTimezoneOptions('   ')).toEqual(CRON_TIMEZONE_OPTIONS);
  });

  // A job written through the API or MCP can hold any zone name. Without an
  // option of its own the select showed "UTC+0" for it.
  it('adds a stored value outside the list as its own option, first', () => {
    const options = cronTimezoneOptions('Asia/Jakarta');

    expect(options).toHaveLength(27);
    expect(options[0]).toEqual({ value: 'Asia/Jakarta', label: 'Asia/Jakarta' });
    expect(options.slice(1)).toEqual(CRON_TIMEZONE_OPTIONS);
  });

  it('labels an added offset the way the list labels its own', () => {
    expect(cronTimezoneOptions('Etc/GMT-14')[0]).toEqual({ value: 'Etc/GMT-14', label: 'UTC+14' });
  });

  it('works on a list the caller supplies', () => {
    const own = [
      { value: 'Asia/Jakarta', label: 'Jakarta' },
      { value: 'Asia/Singapore', label: 'Singapore' },
    ];

    expect(cronTimezoneOptions('Asia/Jakarta', own)).toEqual(own);
    expect(cronTimezoneOptions('UTC', own)).toEqual([{ value: 'UTC', label: 'UTC+0' }, ...own]);
  });

  it('returns a new list and leaves the one it was given alone', () => {
    const before = [...CRON_TIMEZONE_OPTIONS];
    const options = cronTimezoneOptions('Asia/Jakarta');

    options.pop();
    expect(CRON_TIMEZONE_OPTIONS).toEqual(before);
    expect(cronTimezoneOptions('UTC')).not.toBe(CRON_TIMEZONE_OPTIONS);
  });
});

describe('DEFAULT_CRON_CODE', () => {
  /** The snippet without its comment lines: what a backend runs. */
  const statements = DEFAULT_CRON_CODE.split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');

  it('uses nothing one of the backends does not give a job', () => {
    // The engine refuses services.supabase, and its sandbox has no timers.
    expect(statements).not.toMatch(/services/);
    expect(statements).not.toMatch(/setTimeout|setInterval|supabase|fetch|new Promise/);
    expect(DEFAULT_CRON_CODE).not.toMatch(/supabase/i);
  });

  it('runs as the strict-mode body of an async function, the way both backends compile it', async () => {
    const printed: unknown[][] = [];
    const refuse = new Proxy(
      {},
      {
        get(_target, key) {
          throw new Error(`services.${String(key)} is not available`);
        },
      },
    );
    const AsyncFunction = Object.getPrototypeOf(async () => undefined).constructor as new (
      ...args: string[]
    ) => (...args: unknown[]) => Promise<unknown>;
    const run = new AsyncFunction(
      'context',
      'services',
      'console',
      'JSON',
      'Date',
      'Math',
      `"use strict";\n${DEFAULT_CRON_CODE}`,
    );

    const result = await run(
      { jobId: 'j1', jobName: 'nightly-report', triggeredBy: 'manual', runId: 'r1', scheduledAt: '2026-10-08T02:00:00.000Z' },
      refuse,
      { log: (...args: unknown[]) => printed.push(args) },
      JSON,
      Date,
      Math,
    );

    expect(printed).toEqual([
      ['Job started:', 'nightly-report'],
      ['Triggered by:', 'manual'],
    ]);
    expect(result).toEqual({ ok: true });
  });
});

describe('CRON_FORM_DEFAULTS', () => {
  it('is what the reference form starts a new job with', () => {
    expect(CRON_FORM_DEFAULTS).toEqual({
      name: '',
      description: '',
      schedule: '0 9 * * 1-5',
      timezone: 'UTC',
      code: DEFAULT_CRON_CODE,
      status: 'inactive',
      timeout_ms: 10000,
      memory_limit_mb: 64,
    });
  });

  it('has a value for every form field, and passes the save checks once it has a name', () => {
    expect(Object.keys(CRON_FORM_DEFAULTS)).toEqual([...CRON_JOB_FORM_FIELDS]);
    expect(findCronJobFormProblem(CRON_FORM_DEFAULTS)?.code).toBe('nameRequired');
    expect(findCronJobFormProblem({ ...CRON_FORM_DEFAULTS, name: 'nightly-report' })).toBeNull();
  });

  it('sits inside the bounds of its own number inputs', () => {
    const { timeout_ms, memory_limit_mb } = CRON_NUMBER_INPUTS;
    expect(CRON_FORM_DEFAULTS.timeout_ms).toBeGreaterThanOrEqual(timeout_ms.min);
    expect(CRON_FORM_DEFAULTS.memory_limit_mb).toBeGreaterThanOrEqual(memory_limit_mb.min);
    expect(CRON_FORM_DEFAULTS.memory_limit_mb).toBeLessThanOrEqual(memory_limit_mb.max);
  });
});

describe('normalizeCronTimeoutMs / normalizeCronMemoryLimitMb', () => {
  it('keeps a positive whole number', () => {
    expect(normalizeCronTimeoutMs(5000)).toBe(5000);
    expect(normalizeCronTimeoutMs(1)).toBe(1);
    expect(normalizeCronMemoryLimitMb(128)).toBe(128);
  });

  // A decimal sent as typed is refused by the integer column
  it('drops the fraction of a decimal', () => {
    expect(normalizeCronTimeoutMs(1500.5)).toBe(1500);
    expect(normalizeCronTimeoutMs(1500.99)).toBe(1500);
    expect(normalizeCronMemoryLimitMb(64.5)).toBe(64);
  });

  it('reads a numeric string, which a number input holds while it is typed in', () => {
    expect(normalizeCronTimeoutMs('2500')).toBe(2500);
    expect(normalizeCronTimeoutMs(' 2500.7 ')).toBe(2500);
    expect(normalizeCronMemoryLimitMb('32')).toBe(32);
  });

  it.each([[''], ['   '], ['abc'], [null], [undefined], [Number.NaN], [Number.POSITIVE_INFINITY], [0], [-5], [0.4], [{}], [true]])(
    'falls back to the form default for %j',
    (value) => {
      expect(normalizeCronTimeoutMs(value)).toBe(CRON_FORM_DEFAULTS.timeout_ms);
      expect(normalizeCronMemoryLimitMb(value)).toBe(CRON_FORM_DEFAULTS.memory_limit_mb);
    },
  );

  it('falls back to the value it is told to', () => {
    expect(normalizeCronTimeoutMs('', 30000)).toBe(30000);
    expect(normalizeCronMemoryLimitMb(-1, 256)).toBe(256);
  });

  it('keeps a value outside the bounds of the form inputs, which the server stores', () => {
    expect(normalizeCronTimeoutMs(500)).toBe(500);
    expect(normalizeCronMemoryLimitMb(1024)).toBe(1024);
  });

  it('stops at the largest value the column holds', () => {
    expect(normalizeCronTimeoutMs(9_999_999_999)).toBe(2147483647);
  });
});

/** A job as both backends answer it to an administrator. */
const STORED: CronJobRecord = {
  id: 'j1',
  name: 'nightly-report',
  description: 'Sends the report',
  schedule: '0 2 * * *',
  timezone: 'Asia/Jakarta',
  code: "console.log('report');",
  status: 'active',
  timeout_ms: 45000,
  memory_limit_mb: 128,
  running: false,
  running_since: null,
  last_run_at: null,
  last_run_status: null,
  next_run_at: '2026-10-09T19:00:00.000Z',
  created_at: '2026-10-01T00:00:00.000Z',
  updated_at: '2026-10-01T00:00:00.000Z',
};

describe('cronJobToForm', () => {
  it('takes the eight form fields of a stored job, as stored', () => {
    expect(cronJobToForm(STORED)).toEqual({
      name: 'nightly-report',
      description: 'Sends the report',
      schedule: '0 2 * * *',
      timezone: 'Asia/Jakarta',
      code: "console.log('report');",
      status: 'active',
      timeout_ms: 45000,
      memory_limit_mb: 128,
    });
  });

  it('reads a job without a description as an empty one', () => {
    expect(cronJobToForm({ ...STORED, description: null }).description).toBe('');
  });

  // Both backends drop a column the caller's grant withholds
  it('does not put the default code in place of code it was not given', () => {
    const { code: _withheld, ...withoutCode } = STORED;

    expect(cronJobToForm(withoutCode).code).toBe('');
    expect(cronJobToForm(withoutCode).code).not.toBe(DEFAULT_CRON_CODE);
  });

  it('gives every other missing field a neutral value', () => {
    expect(cronJobToForm({ id: 'j1', name: 'nightly-report' })).toEqual({
      name: 'nightly-report',
      description: '',
      schedule: '',
      timezone: 'UTC',
      code: '',
      status: 'inactive',
      timeout_ms: 10000,
      memory_limit_mb: 64,
    });
  });

  it('keeps a stored value the form inputs would not offer', () => {
    const form = cronJobToForm({ ...STORED, timeout_ms: 500, memory_limit_mb: 1024, timezone: 'Europe/Berlin' });

    expect(form).toMatchObject({ timeout_ms: 500, memory_limit_mb: 1024, timezone: 'Europe/Berlin' });
  });
});

describe('withheldCronJobFields', () => {
  it('names no field for a job answered whole', () => {
    expect(withheldCronJobFields(STORED)).toEqual([]);
    expect(withheldCronJobFields({ ...STORED, description: null })).toEqual([]);
  });

  it('names the fields the answer did not carry, in form order', () => {
    const { code: _code, timeout_ms: _timeout, ...partial } = STORED;

    expect(withheldCronJobFields(partial)).toEqual(['code', 'timeout_ms']);
    expect(withheldCronJobFields({ id: 'j1', name: 'nightly-report' })).toEqual([
      'description',
      'schedule',
      'timezone',
      'code',
      'status',
      'timeout_ms',
      'memory_limit_mb',
    ]);
  });

  it('leaves a save of the other fields free of the withheld ones', () => {
    const { code: _code, ...withoutCode } = STORED;
    const loaded = cronJobToForm(withoutCode);

    expect(changedCronJobFields(loaded, { ...loaded, name: 'renamed' })).toEqual({ name: 'renamed' });
  });
});

/** The form as loaded: an inactive job with a description. */
const LOADED: CronJobForm = {
  name: 'nightly-report',
  description: 'Sends the report',
  schedule: '0 2 * * *',
  timezone: 'UTC',
  code: "console.log('report');",
  status: 'inactive',
  timeout_ms: 10000,
  memory_limit_mb: 64,
};

describe('cronJobInputFromForm', () => {
  it('sends the whole form of a new job', () => {
    expect(cronJobInputFromForm(LOADED)).toEqual(LOADED);
  });

  it('leaves a blank description out, so the job is stored without one', () => {
    const input = cronJobInputFromForm({ ...LOADED, description: '' });

    expect(input).not.toHaveProperty('description');
    expect(input).toEqual({
      name: 'nightly-report',
      schedule: '0 2 * * *',
      timezone: 'UTC',
      code: "console.log('report');",
      status: 'inactive',
      timeout_ms: 10000,
      memory_limit_mb: 64,
    });
  });
});

function wire(loaded: CronJobForm, current: CronJobForm): Record<string, unknown> {
  return JSON.parse(JSON.stringify(changedCronJobFields(loaded, current)));
}

describe('changedCronJobFields: an untouched field is not sent', () => {
  it('an edit to the description alone does not send the status the form was loaded with', () => {
    // The job was activated elsewhere after the form loaded it as inactive. Sending the form's
    // status with an unrelated edit set the job back to inactive.
    const body = wire(LOADED, { ...LOADED, description: 'Sends the report at night' });

    expect(body).toEqual({ description: 'Sends the report at night' });
    expect(body).not.toHaveProperty('status');
  });

  it('a form with no edits sends no field at all', () => {
    expect(wire(LOADED, { ...LOADED })).toEqual({});
  });

  it('a field edited and then set back to its loaded value is not sent', () => {
    const edited = { ...LOADED, name: 'renamed', timeout_ms: 5000 };
    const reverted = { ...edited, name: LOADED.name };

    expect(wire(LOADED, reverted)).toEqual({ timeout_ms: 5000 });
  });

  it('a status picked in the form is sent, as the change it is', () => {
    expect(wire(LOADED, { ...LOADED, status: 'active' })).toEqual({ status: 'active' });
  });

  it.each([
    ['name', 'weekly-report'],
    ['schedule', '0 3 * * 1'],
    ['timezone', 'Etc/GMT-7'],
    ['code', "console.log('v2');"],
    ['status', 'active'],
    ['timeout_ms', 5000],
    ['memory_limit_mb', 128],
  ] as const)('a changed %s is sent alone, with its new value', (field, value) => {
    expect(wire(LOADED, { ...LOADED, [field]: value })).toEqual({ [field]: value });
  });

  it('every changed field is sent when the whole form was edited', () => {
    const current: CronJobForm = {
      name: 'weekly-report',
      description: 'Weekly',
      schedule: '0 3 * * 1',
      timezone: 'Etc/GMT-7',
      code: "console.log('v2');",
      status: 'active',
      timeout_ms: 5000,
      memory_limit_mb: 128,
    };

    expect(wire(LOADED, current)).toEqual(current);
  });

  it('never names a key that is not a form field', () => {
    const current: CronJobForm = { ...LOADED, name: 'x', description: '', schedule: 'y', timezone: 'z', code: 'c', status: 'active', timeout_ms: 1, memory_limit_mb: 2 };

    expect(Object.keys(changedCronJobFields(LOADED, current))).toEqual([...CRON_JOB_FORM_FIELDS]);
  });

  // A job whose zone is outside the form's list keeps it through a save of another field
  it('does not send a timezone the user did not change, whatever it is', () => {
    const loaded = { ...LOADED, timezone: 'Asia/Jakarta' };

    expect(wire(loaded, { ...loaded, schedule: '0 3 * * *' })).toEqual({ schedule: '0 3 * * *' });
  });
});

describe('changedCronJobFields: an emptied description is sent', () => {
  it('as null, which survives JSON and clears the column', () => {
    // `description: formData.description || undefined` turned '' into undefined, JSON dropped the
    // key, the route skipped the field and the old text came back with "Cron job saved".
    const body = wire(LOADED, { ...LOADED, description: '' });

    expect(body).toEqual({ description: null });
    expect(Object.keys(body)).toEqual(['description']);
  });

  it('not at all when the job had no description to begin with', () => {
    const withoutDescription = { ...LOADED, description: '' };

    expect(wire(withoutDescription, { ...withoutDescription })).toEqual({});
    expect(wire(withoutDescription, { ...withoutDescription, name: 'renamed' })).toEqual({ name: 'renamed' });
  });

  it('a description typed into an empty field is sent as typed', () => {
    expect(wire({ ...LOADED, description: '' }, { ...LOADED, description: ' two words ' })).toEqual({ description: ' two words ' });
  });
});

describe('findCronJobFormProblem', () => {
  it('passes a complete form', () => {
    expect(findCronJobFormProblem(LOADED)).toBeNull();
  });

  it.each([
    ['name', 'nameRequired', 'Name is required'],
    ['schedule', 'scheduleRequired', 'Schedule expression is required'],
    ['code', 'codeRequired', 'Code is required'],
  ] as const)('refuses a missing %s with the sentence of the reference page', (field, code, error) => {
    expect(findCronJobFormProblem({ ...LOADED, [field]: '' })).toEqual({ field, code, error });
    expect(findCronJobFormProblem({ ...LOADED, [field]: '   ' })).toEqual({ field, code, error });
  });

  it('names the first failing field, in the order of the reference page', () => {
    expect(findCronJobFormProblem({ ...LOADED, name: '', schedule: '', code: '' })?.field).toBe('name');
    expect(findCronJobFormProblem({ ...LOADED, schedule: '', code: '' })?.field).toBe('schedule');
    expect(findCronJobFormProblem({ ...LOADED, code: '', timeout_ms: 0.5 })?.field).toBe('code');
  });

  it.each([[1500.5], [0], [-1000], [Number.NaN], ['5000' as unknown as number]])(
    'refuses %j as a timeout, which the integer column cannot hold',
    (timeout_ms) => {
      expect(findCronJobFormProblem({ ...LOADED, timeout_ms })).toMatchObject({
        field: 'timeout_ms',
        code: 'timeoutNotWholeNumber',
      });
    },
  );

  it.each([[64.5], [0], [-16]])('refuses %j as a memory limit', (memory_limit_mb) => {
    expect(findCronJobFormProblem({ ...LOADED, memory_limit_mb })).toMatchObject({
      field: 'memory_limit_mb',
      code: 'memoryLimitNotWholeNumber',
    });
  });

  it('passes what the normalisers return for a decimal', () => {
    expect(
      findCronJobFormProblem({
        ...LOADED,
        timeout_ms: normalizeCronTimeoutMs(1500.5),
        memory_limit_mb: normalizeCronMemoryLimitMb(64.5),
      }),
    ).toBeNull();
  });
});
