/**
 * `cron` namespace tests. Key and placeholder parity with the Indonesian
 * catalog is covered for every namespace in i18n.test.ts; these pin what is
 * particular to this one: the wording taken from the reference admin UI, the
 * strings that deliberately differ from it, the string that carries inline
 * tags, the samples, and the counts.
 */
import { describe, it, expect } from 'vitest';
import { defaultTranslations, formatCount, hasPlaceholders, id, interpolate } from '../src/i18n';
import { cronDefaults, cronId } from '../src/i18n/namespaces/cron';
import { CRON_FORM_DEFAULTS, findCronJobFormProblem, type CronJobForm } from '../src/cron';

/** Every string of a catalog, by dotted path. Plural forms count as strings. */
function strings(value: unknown, path = ''): Array<[string, string]> {
  if (typeof value === 'string') return [[path, value]];
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, child]) => strings(child, path ? `${path}.${key}` : key));
  }
  return [];
}

/** The inline tags of a rich-text string, in order: ['<code>', '</code>']. */
function tags(text: string): string[] {
  return text.match(/<\/?[a-z]+>/g) ?? [];
}

describe('cron namespace', () => {
  it('is part of the defaults and of the Indonesian catalog', () => {
    expect(defaultTranslations.cron).toBe(cronDefaults);
    expect(id.cron).toBe(cronId);
  });

  it('has no empty string in either catalog', () => {
    for (const catalog of [cronDefaults, cronId]) {
      expect(strings(catalog).filter(([, text]) => !text.trim())).toEqual([]);
    }
  });

  it('keeps the wording of the reference pages', () => {
    const t = cronDefaults;
    expect(t.jobsManager.title).toBe('Cron Jobs');
    expect(t.jobsManager.newJob).toBe('New Cron Job');
    expect(t.jobsManager.searchPlaceholder).toBe('Search by name, schedule, or description...');
    expect(t.jobsManager.emptyState.search).toBe('No jobs match your search');
    expect(t.jobsManager.emptyState.pristine).toBe('No cron jobs yet. Create your first one!');
    expect(t.jobsManager.deleteModal.title).toBe('Delete cron job');
    expect(t.runsTable.emptyState.allJobs).toBe('No execution history yet.');
    expect(t.runsTable.emptyState.job).toBe('No run history yet. Use “Run Now” to test the job.');
    expect(t.runsTable.columns.durationMs).toBe('Duration (ms)');
    expect(t.logModal.empty).toBe('No console output for this run.');
    expect(t.jobDetail.titleEdit).toBe('Edit Cron Job');
    expect(t.jobDetail.fields.scheduleDescription).toBe('Cron expression — e.g. "0 9 * * 1-5" = weekdays at 9am');
    expect(t.jobDetail.fields.timeoutDescription).toBe('Max execution time before the job is killed');
    expect(t.jobDetail.notifications.created).toBe('Cron job created');
    expect(t.jobDetail.notifications.saved).toBe('Cron job saved');
    expect(t.jobDetail.notifications.triggered).toBe('Job started. Check the History tab for results.');
    expect(t.jobDetail.notFound.title).toBe('Cron job not found');
    expect(t.notificationTitles).toMatchObject({
      activated: 'Activated',
      deactivated: 'Deactivated',
      cloned: 'Cloned',
      deleted: 'Deleted',
      triggered: 'Triggered',
      notFound: 'Not found',
    });
  });

  it('refuses a save with the sentences findCronJobFormProblem gives', () => {
    const form: CronJobForm = { ...CRON_FORM_DEFAULTS, name: 'nightly-report' };
    const broken: Array<Partial<CronJobForm>> = [
      { name: '' },
      { schedule: '' },
      { code: '' },
      { timeout_ms: 1500.5 },
      { memory_limit_mb: 0 },
    ];

    const codes = broken.map((change) => {
      const problem = findCronJobFormProblem({ ...form, ...change });
      expect(problem).not.toBeNull();
      // Every code is a key of the validation group, and the English text is the same sentence
      expect(cronDefaults.jobDetail.validation[problem!.code]).toBe(problem!.error);
      expect(cronId.jobDetail.validation[problem!.code]).toBeTruthy();
      return problem!.code;
    });

    expect(codes.sort()).toEqual(Object.keys(cronDefaults.jobDetail.validation).sort());
  });

  it('names nothing in its help that one of the backends does not give a job', () => {
    // The reference text advertised services.supabase, which the Go engine refuses.
    for (const catalog of [cronDefaults, cronId]) {
      expect(catalog.jobDetail.codeHelp.body).not.toMatch(/supabase/i);
      expect(catalog.jobDetail.codeHelp.body).toContain('<code>context</code>');
      expect(catalog.jobDetail.codeHelp.body).toContain('<code>services</code>');
    }
  });

  it('does not carry the stale note about expanding a history row', () => {
    for (const catalog of [cronDefaults, cronId]) {
      expect(strings(catalog).filter(([, text]) => /future enhancement|expand a row/i.test(text))).toEqual([]);
    }
  });

  it('words a job status and a run status once, for the list and the editor', () => {
    expect(cronDefaults.jobStatus).toEqual({ active: 'Active', inactive: 'Inactive' });
    expect(cronDefaults.runStatus).toEqual({
      running: 'Running',
      success: 'Success',
      error: 'Error',
      timeout: 'Timeout',
    });
    expect(Object.keys(cronDefaults.trigger)).toEqual(['schedule', 'manual', 'extension']);
  });

  it('tells the user when Run Now started nothing', () => {
    const t = cronDefaults;
    expect(t.notificationTitles.runSkipped).toBe('Already running');
    expect(interpolate(t.jobsManager.notifications.runSkipped, { name: 'nightly-report' })).toBe(
      'Job "nightly-report" is already running, so it was not started again.',
    );
    expect(t.jobDetail.notifications.runSkipped).toBe('This job is already running, so it was not started again.');
    // Not the sentence of a run that happened
    expect(t.jobDetail.notifications.runSkipped).not.toBe(t.jobDetail.notifications.triggered);
    expect(t.notificationTitles.runSkipped).not.toBe(t.notificationTitles.triggered);
  });

  it('counts in both languages', () => {
    const { count } = cronDefaults;
    expect(formatCount('en', 1, count.jobs)).toBe('1 job');
    expect(formatCount('en', 0, count.jobs)).toBe('0 jobs');
    expect(formatCount('en', 26, count.jobs)).toBe('26 jobs');
    expect(formatCount('en', 1, count.runs)).toBe('1 run');
    expect(formatCount('en', 2, count.runs)).toBe('2 runs');
    expect(formatCount('en', 1, count.lines)).toBe('1 line');
    expect(formatCount('en', 0, count.lines)).toBe('0 lines');
    expect(formatCount('en', 1, count.logLines)).toBe('1 log line');
    expect(formatCount('en', 12, count.logLines)).toBe('12 log lines');
    expect(formatCount('id', 1, cronId.count.jobs)).toBe('1 tugas');
    expect(formatCount('id', 3, cronId.count.logLines)).toBe('3 baris log');
  });

  it('fills the placeholders of its templates', () => {
    const t = cronDefaults;
    expect(interpolate(t.listFooter.showing, { shown: 25, totalCount: 26, itemsLabel: t.jobsManager.itemsLabel })).toBe(
      'Showing 25 of 26 jobs',
    );
    expect(interpolate(t.listFooter.showing, { shown: 50, totalCount: 120, itemsLabel: t.runsTable.itemsLabel })).toBe(
      'Showing 50 of 120 runs',
    );
    expect(interpolate(t.durationMs, { duration: '1,240' })).toBe('1,240 ms');
    expect(interpolate(t.logModal.titleWithJob, { job: 'nightly-report' })).toBe('Run logs — nightly-report');
    expect(interpolate(t.rowActions.jobAriaLabel, { name: 'nightly-report' })).toBe('Actions for nightly-report');
    expect(interpolate(t.jobsManager.openAriaLabel, { name: 'nightly-report' })).toBe('Open cron job nightly-report');
    expect(interpolate(t.jobsManager.deleteModal.description, { name: 'nightly-report' })).toBe(
      'Are you sure you want to delete the cron job "nightly-report"? This cannot be undone.',
    );
    expect(interpolate(t.jobsManager.notifications.deleted, { name: 'nightly-report' })).toBe('Job "nightly-report" deleted');
    expect(interpolate(t.jobsManager.notifications.activated, { name: 'nightly-report' })).toBe(
      'Job "nightly-report" is now active',
    );
    expect(interpolate(t.jobsManager.notifications.deactivated, { name: 'nightly-report' })).toBe(
      'Job "nightly-report" is now inactive',
    );
    expect(interpolate(t.jobsManager.notifications.cloned, { name: 'nightly-report' })).toBe(
      'Job "nightly-report" has been cloned',
    );
    expect(interpolate(t.jobsManager.notifications.triggered, { name: 'nightly-report' })).toBe(
      'Job "nightly-report" started',
    );
    expect(interpolate(t.jobsManager.emptyState.loadError, { error: 'Admin access required' })).toBe(
      'Failed to load cron jobs — Admin access required',
    );
    expect(interpolate(t.runsTable.emptyState.loadError, { error: 'Cron job not found' })).toBe(
      'Failed to load run history — Cron job not found',
    );
    expect(interpolate(t.jobDetail.loadError, { error: 'MFA required' })).toBe('Failed to load cron job — MFA required');
  });

  it('carries the same inline tags in both catalogs', () => {
    const rich = strings(cronDefaults).filter(([, text]) => tags(text).length > 0);
    expect(rich.map(([path]) => path)).toEqual(['jobDetail.codeHelp.body']);

    const translated = new Map(strings(cronId));
    for (const [path, text] of rich) {
      expect(tags(translated.get(path) ?? ''), path).toEqual(tags(text));
    }
  });

  it('keeps its samples the same in both languages and free of placeholders', () => {
    for (const catalog of [cronDefaults, cronId]) {
      const { fields, code } = catalog.jobDetail;
      // The placeholder is the schedule a new job starts with
      expect(fields.schedulePlaceholder).toBe(CRON_FORM_DEFAULTS.schedule);
      expect(fields.scheduleDescription).toContain(`"${CRON_FORM_DEFAULTS.schedule}"`);
      expect(hasPlaceholders(fields.scheduleDescription)).toBe(false);
      expect(code.placeholder.startsWith('// ')).toBe(true);
      expect(hasPlaceholders(code.placeholder)).toBe(false);
    }
  });
});
