/**
 * CronJobDetail unit tests: loading a job into the form, creating and saving
 * (only what changed), the header actions with their pending states, the
 * read-only editor, the History tab, the code editor slot, and the three
 * reasons there can be no job to edit. `@buildpad/hooks` is mocked.
 */
import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BuildpadI18nProvider } from '@buildpad/services';
import type { CronJobRecord, CronRunListResult, CronRunResult } from '@buildpad/types';
import { DEFAULT_CRON_CODE } from '@buildpad/utils';
import { DaaSRequestError } from '../../hooks/src/daasRequest';
import { CronJobDetail } from '../src/CronJobDetail';
import type { CronCodeEditorProps } from '../src/CronCodeEditor';
import { mockJobs, mockRuns } from '../src/_fixtures';

const { getJobMock, createJobMock, updateJobMock, runJobMock, fetchRunsMock, fetchJobRunsMock, usePermissionsMock } =
  vi.hoisted(() => ({
    getJobMock: vi.fn(),
    createJobMock: vi.fn(),
    updateJobMock: vi.fn(),
    runJobMock: vi.fn(),
    fetchRunsMock: vi.fn(),
    fetchJobRunsMock: vi.fn(),
    usePermissionsMock: vi.fn(),
  }));

vi.mock('@buildpad/hooks', async () => {
  // The URL helpers and the typed error are used as they are, so the editor's
  // error branches are exercised, not stubbed.
  const url = await import('../../hooks/src/useUrlListParams');
  const request = await import('../../hooks/src/daasRequest');
  return {
    useUrlListParams: url.useUrlListParams,
    readUrlParam: url.readUrlParam,
    readUrlIntParam: url.readUrlIntParam,
    DaaSRequestError: request.DaaSRequestError,
    useCronJobs: () => ({
      getJob: getJobMock,
      createJob: createJobMock,
      updateJob: updateJobMock,
      runJob: runJobMock,
    }),
    useCronRuns: () => ({ fetchRuns: fetchRunsMock, fetchJobRuns: fetchJobRunsMock }),
    usePermissions: usePermissionsMock,
  };
});

const [sweep, sync, report] = mockJobs;

function renderDetail(props: Partial<React.ComponentProps<typeof CronJobDetail>> = {}) {
  const tree = (current: Partial<React.ComponentProps<typeof CronJobDetail>>) => (
    <MantineProvider>
      {/* A pinned locale and zone, so dates read the same on every machine */}
      <BuildpadI18nProvider locale="en" timeZone="UTC" datesProvider={false}>
        <CronJobDetail id={report.id} {...current} />
      </BuildpadI18nProvider>
    </MantineProvider>
  );
  const view = render(tree(props));
  return { ...view, update: (next: Partial<React.ComponentProps<typeof CronJobDetail>>) => view.rerender(tree(next)) };
}

function grant(actions: string[], isAdmin = false) {
  usePermissionsMock.mockReturnValue({
    canPerform: (_collection: string, action: string) => actions.includes(action),
    isAdmin,
    loading: false,
  });
}

/** The form's fields, found the way a user finds them: by their labels. */
const field = {
  name: () => screen.getByRole('textbox', { name: 'Name' }) as HTMLInputElement,
  description: () => screen.getByRole('textbox', { name: 'Description' }) as HTMLTextAreaElement,
  schedule: () => screen.getByRole('textbox', { name: 'Schedule' }) as HTMLInputElement,
  timezone: () => screen.getByRole('textbox', { name: 'Timezone' }) as HTMLInputElement,
  timeout: () => screen.getByRole('textbox', { name: 'Timeout (ms)' }) as HTMLInputElement,
  memory: () => screen.getByRole('textbox', { name: 'Memory Limit (MB)' }) as HTMLInputElement,
  status: () => screen.getByRole('textbox', { name: 'Status' }) as HTMLInputElement,
  code: () => screen.getByRole('textbox', { name: 'Job Code' }) as HTMLTextAreaElement,
};

const button = (name: string) => screen.getByRole('button', { name });
const queryButton = (name: string) => screen.queryByRole('button', { name });
const unsavedBadge = () => screen.queryByTestId('cron-job-detail-unsaved-badge');

/** Waits until the stored job is in the form. */
async function loaded(name = report.name) {
  await waitFor(() => expect(field.name()).toHaveValue(name));
}

/** Picks `option` in the Select labelled `label`. */
async function pick(label: 'Timezone' | 'Status', option: string) {
  fireEvent.click(screen.getByRole('textbox', { name: label }));
  // hidden: true — the dropdown stays display:none in jsdom (no transitions).
  fireEvent.click(await screen.findByRole('option', { name: option, hidden: true }));
}

/** A promise the test settles by hand, for a request that is "in flight". */
function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  let reject: (reason: unknown) => void = () => {};
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function runsOf(jobId: string): CronRunListResult {
  const items = mockRuns.filter((run) => run.job_id === jobId);
  return { items, total: items.length, totalPages: 1, page: 1, limit: 50, offset: 0 };
}

const ran: CronRunResult = { historyId: 'run-1', skipped: false, message: 'triggered' };
const skipped: CronRunResult = { historyId: null, skipped: true, message: 'was already running — skipped' };

let show: ReturnType<typeof vi.spyOn>;
/** The stored jobs: a save changes them, so the next answer carries what was saved. */
let stored: Record<string, CronJobRecord>;

beforeEach(() => {
  stored = Object.fromEntries(mockJobs.map((job) => [job.id, { ...job }]));
  getJobMock.mockReset().mockImplementation(async (id: string) => {
    if (!stored[id]) throw new DaaSRequestError('Cron job not found', { kind: 'notFound', status: 404 });
    return stored[id];
  });
  updateJobMock.mockReset().mockImplementation(async (id: string, patch: Partial<CronJobRecord>) => {
    stored[id] = { ...stored[id], ...patch };
    return stored[id];
  });
  createJobMock.mockReset().mockImplementation(async (input: Partial<CronJobRecord>) => ({
    description: null,
    ...input,
    id: 'new-job-id',
  }));
  runJobMock.mockReset().mockResolvedValue(ran);
  fetchRunsMock.mockReset();
  fetchJobRunsMock.mockReset().mockImplementation(async (jobId: string) => runsOf(jobId));
  usePermissionsMock.mockReset();
  grant([], true);
  show = vi.spyOn(notifications, 'show').mockImplementation(() => '');
});

afterEach(() => {
  show.mockRestore();
});

describe('CronJobDetail', () => {
  describe('an existing job', () => {
    it('loads the job into the form', async () => {
      renderDetail();
      await loaded();

      expect(getJobMock).toHaveBeenCalledWith(report.id);
      expect(getJobMock).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('heading', { name: 'Edit Cron Job', level: 2 })).toBeInTheDocument();
      expect(screen.getByTestId('cron-job-detail-breadcrumb-current')).toHaveTextContent('Nightly report');
      expect(field.description()).toHaveValue('Sends the report of the day to the sales team.');
      expect(field.schedule()).toHaveValue('0 9 * * 1-5');
      expect(field.timezone()).toHaveValue('UTC+0');
      expect(field.timeout()).toHaveValue('10000');
      expect(field.memory()).toHaveValue('64');
      expect(field.status()).toHaveValue('Active');
      expect(field.code()).toHaveValue(report.code);
      expect(screen.getByRole('heading', { name: 'Job Settings', level: 4 })).toBeInTheDocument();
    });

    it('shows the job\'s status beside the title, worded as the jobs list words it', async () => {
      renderDetail();
      await loaded();
      // "Active", not the stored "active" the reference showed here
      expect(screen.getByTestId('cron-job-detail-status-badge').textContent).toBe('Active');
    });

    it('offers the header actions of an active job, and nothing to save yet', async () => {
      const user = userEvent.setup();
      renderDetail();
      await loaded();
      expect(button('Run Now')).toBeEnabled();
      await user.hover(button('Run Now'));
      expect(await screen.findByRole('tooltip', { hidden: true })).toHaveTextContent('Run job immediately');
      expect(button('Deactivate')).toBeEnabled();
      expect(queryButton('Activate')).not.toBeInTheDocument();
      // Nothing changed, so there is nothing to save
      expect(button('Save')).toBeDisabled();
      expect(unsavedBadge()).not.toBeInTheDocument();
      expect(screen.queryByTestId('cron-job-detail-read-only-notice')).not.toBeInTheDocument();
    });

    it('offers Activate for an inactive job', async () => {
      renderDetail({ id: sweep.id });
      await loaded('Cache sweep');
      expect(button('Activate')).toBeEnabled();
      expect(queryButton('Deactivate')).not.toBeInTheDocument();
      expect(screen.getByTestId('cron-job-detail-status-badge').textContent).toBe('Inactive');
      // A job without a description holds NULL: an empty field
      expect(field.description()).toHaveValue('');
      expect(field.timezone()).toHaveValue('UTC+7');
    });

    it('says "Loading..." in the breadcrumb until the job is there', async () => {
      const request = deferred<CronJobRecord>();
      getJobMock.mockImplementation(() => request.promise);
      renderDetail();
      expect(screen.getByTestId('cron-job-detail-breadcrumb-current')).toHaveTextContent('Loading...');
      expect(button('Save')).toBeDisabled();

      await act(async () => {
        request.resolve(report);
      });
      await loaded();
      expect(screen.getByTestId('cron-job-detail-breadcrumb-current')).toHaveTextContent('Nightly report');
    });

    it('names the code editor "Job Code" and explains what the code can use', async () => {
      renderDetail();
      await loaded();
      expect(field.code().tagName).toBe('TEXTAREA');
      expect(field.code()).toHaveAttribute('placeholder', '// Your cron code here...');
      expect(field.code()).toHaveAccessibleDescription('JavaScript — async/await supported');

      const help = screen.getByTestId('cron-job-detail-code-help');
      expect(help).toHaveTextContent('Cron Code');
      expect(help).toHaveTextContent(
        'Your async JavaScript runs in a sandbox with access to context (job metadata), services, and console. Throw to mark the run as failed.',
      );
      // The <code> markers of the dictionary string are drawn as code, not as text
      expect(Array.from(help.querySelectorAll('code')).map((code) => code.textContent)).toEqual([
        'context',
        'services',
        'console',
      ]);
    });

    it('loads the other job when the id changes', async () => {
      const { update } = renderDetail();
      await loaded();
      update({ id: sync.id });
      await loaded('Legacy sync');
      expect(getJobMock).toHaveBeenLastCalledWith(sync.id);
      expect(field.timezone()).toHaveValue('Asia/Jakarta');
    });

    it('draws only the answer to the latest load', async () => {
      const slow = deferred<CronJobRecord>();
      getJobMock.mockImplementation((id: string) => (id === report.id ? slow.promise : Promise.resolve(stored[id])));
      const { update } = renderDetail();
      update({ id: sync.id });
      await loaded('Legacy sync');

      await act(async () => {
        slow.resolve(report);
      });
      expect(field.name()).toHaveValue('Legacy sync');
    });

    it('checks permissions on the collection both backends decide every cron route by', async () => {
      renderDetail();
      await loaded();
      expect(usePermissionsMock).toHaveBeenCalledWith({ collections: ['daas_cron_jobs'] });
    });

    it('reads its strings from the translations prop', async () => {
      renderDetail({ translations: { jobDetail: { titleEdit: 'Ubah Tugas Cron', fields: { name: 'Nama' } } } });
      expect(await screen.findByRole('heading', { name: 'Ubah Tugas Cron' })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: 'Nama' })).toBeInTheDocument();
    });
  });

  describe('saving', () => {
    it('an edit shows the Unsaved Changes badge and enables Save; taking it back clears both', async () => {
      renderDetail();
      await loaded();

      fireEvent.change(field.description(), { target: { value: 'changed' } });
      expect(unsavedBadge()).toHaveTextContent('Unsaved Changes');
      expect(button('Save')).toBeEnabled();

      fireEvent.change(field.description(), { target: { value: report.description } });
      expect(unsavedBadge()).not.toBeInTheDocument();
      expect(button('Save')).toBeDisabled();
    });

    it('sends only the fields that changed, says so, and refills the form from the stored job', async () => {
      const onSaved = vi.fn();
      renderDetail({ onSaved });
      await loaded();
      // The job is deactivated elsewhere while the form is open
      stored[report.id] = { ...stored[report.id], status: 'inactive' };

      fireEvent.change(field.description(), { target: { value: 'stale-save' } });
      fireEvent.click(button('Save'));

      await waitFor(() => expect(updateJobMock).toHaveBeenCalledTimes(1));
      // Not the status the form was loaded with: the save would revert the change made elsewhere
      expect(updateJobMock).toHaveBeenCalledWith(report.id, { description: 'stale-save' });
      await waitFor(() =>
        expect(show).toHaveBeenCalledWith(
          expect.objectContaining({ title: 'Success', message: 'Cron job saved', color: 'green' }),
        ),
      );
      // The form now shows the job as it is stored, status included
      await waitFor(() => expect(field.status()).toHaveValue('Inactive'));
      expect(screen.getByTestId('cron-job-detail-status-badge').textContent).toBe('Inactive');
      expect(button('Activate')).toBeInTheDocument();
      expect(unsavedBadge()).not.toBeInTheDocument();
      expect(button('Save')).toBeDisabled();
      expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: report.id, description: 'stale-save' }));
    });

    it('refills the form from the stored job whether or not the host listens for onSaved', async () => {
      renderDetail();
      await loaded();
      fireEvent.change(field.name(), { target: { value: 'Renamed' } });
      fireEvent.click(button('Save'));
      await waitFor(() => expect(button('Save')).toBeDisabled());
      expect(unsavedBadge()).not.toBeInTheDocument();
      expect(screen.getByTestId('cron-job-detail-breadcrumb-current')).toHaveTextContent('Renamed');
    });

    it('saves every field that was edited, the code among them', async () => {
      renderDetail();
      await loaded();

      fireEvent.change(field.name(), { target: { value: 'Morning report' } });
      fireEvent.change(field.schedule(), { target: { value: '0 7 * * *' } });
      fireEvent.change(field.code(), { target: { value: 'return 1;' } });
      await pick('Timezone', 'UTC+7');
      await pick('Status', 'Inactive');
      fireEvent.change(field.timeout(), { target: { value: '5000' } });
      fireEvent.change(field.memory(), { target: { value: '128' } });
      fireEvent.click(button('Save'));

      await waitFor(() => expect(updateJobMock).toHaveBeenCalledTimes(1));
      expect(updateJobMock).toHaveBeenCalledWith(report.id, {
        name: 'Morning report',
        schedule: '0 7 * * *',
        timezone: 'Etc/GMT-7',
        code: 'return 1;',
        status: 'inactive',
        timeout_ms: 5000,
        memory_limit_mb: 128,
      });
      await waitFor(() => expect(screen.getByTestId('cron-job-detail-breadcrumb-current')).toHaveTextContent('Morning report'));
    });

    it('an emptied description is saved as none', async () => {
      renderDetail();
      await loaded();
      fireEvent.change(field.description(), { target: { value: '' } });
      fireEvent.click(button('Save'));
      await waitFor(() => expect(updateJobMock).toHaveBeenCalledWith(report.id, { description: null }));
      await waitFor(() => expect(button('Save')).toBeDisabled());
      expect(field.description()).toHaveValue('');
    });

    it('a double click on Save sends one request, and the button is pending meanwhile', async () => {
      const request = deferred<CronJobRecord>();
      updateJobMock.mockImplementation(() => request.promise);
      renderDetail();
      await loaded();

      fireEvent.change(field.description(), { target: { value: 'loading' } });
      const save = button('Save');
      fireEvent.click(save);
      fireEvent.click(save);

      expect(updateJobMock).toHaveBeenCalledTimes(1);
      expect(save).toHaveAttribute('data-loading', 'true');
      expect(save).toBeDisabled();

      await act(async () => {
        request.resolve({ ...report, description: 'loading' });
      });
      await waitFor(() => expect(save).not.toHaveAttribute('data-loading'));
      expect(updateJobMock).toHaveBeenCalledTimes(1);
    });

    it('keeps what was typed while the save was in flight, as an edit that is not saved yet', async () => {
      const request = deferred<CronJobRecord>();
      updateJobMock.mockImplementation(() => request.promise);
      renderDetail();
      await loaded();

      fireEvent.change(field.description(), { target: { value: 'Sent with the save' } });
      fireEvent.click(button('Save'));
      expect(updateJobMock).toHaveBeenCalledWith(report.id, { description: 'Sent with the save' });
      // The request is slow, and the inputs stay open
      fireEvent.change(field.code(), { target: { value: '// typed after the click' } });

      await act(async () => {
        request.resolve({ ...report, description: 'Sent with the save' });
      });
      await waitFor(() => expect(button('Save')).not.toHaveAttribute('data-loading'));
      expect(field.description()).toHaveValue('Sent with the save');
      expect(field.code()).toHaveValue('// typed after the click');
      expect(unsavedBadge()).toBeInTheDocument();

      // The next Save sends that edit, and only that
      updateJobMock.mockImplementation(async (_id: string, patch: Partial<CronJobRecord>) => ({
        ...report,
        description: 'Sent with the save',
        ...patch,
      }));
      fireEvent.click(button('Save'));
      await waitFor(() =>
        expect(updateJobMock).toHaveBeenLastCalledWith(report.id, { code: '// typed after the click' }),
      );
    });

    it('a save answered after another job was opened is not drawn over that job', async () => {
      const request = deferred<CronJobRecord>();
      updateJobMock.mockImplementation(() => request.promise);
      const onSaved = vi.fn();
      const { update } = renderDetail({ onSaved });
      await loaded();

      fireEvent.change(field.description(), { target: { value: 'Saved late' } });
      fireEvent.click(button('Save'));
      // The host opens another job in the same editor before the answer is in
      update({ id: sweep.id, onSaved });
      await loaded('Cache sweep');

      await act(async () => {
        request.resolve({ ...report, description: 'Saved late' });
      });
      await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: report.id })));
      // Still the job that is open, untouched and with nothing to save
      expect(field.name()).toHaveValue('Cache sweep');
      expect(field.description()).toHaveValue(sweep.description ?? '');
      expect(screen.getByTestId('cron-job-detail-breadcrumb-current')).toHaveTextContent('Cache sweep');
      expect(unsavedBadge()).not.toBeInTheDocument();
    });

    it('a create answered after another job was opened does not take that editor over', async () => {
      const request = deferred<CronJobRecord>();
      createJobMock.mockImplementation(() => request.promise);
      const onCreated = vi.fn();
      const { update } = renderDetail({ id: 'new', onCreated });
      fireEvent.change(field.name(), { target: { value: 'Hourly ping' } });
      fireEvent.click(button('Create'));

      update({ id: sweep.id, onCreated });
      await loaded('Cache sweep');
      await act(async () => {
        request.resolve({ id: 'new-job-id', name: 'Hourly ping' });
      });
      await waitFor(() => expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: 'new-job-id' })));
      expect(field.name()).toHaveValue('Cache sweep');

      // A save here goes to the job that is open, not to the one that was created
      fireEvent.change(field.name(), { target: { value: 'Cache sweep v2' } });
      updateJobMock.mockImplementation(async (id: string, patch: Partial<CronJobRecord>) => ({ ...sweep, ...patch, id }));
      await waitFor(() => expect(button('Save')).toBeEnabled());
      fireEvent.click(button('Save'));
      await waitFor(() => expect(updateJobMock).toHaveBeenCalledWith(sweep.id, { name: 'Cache sweep v2' }));
    });

    it('a failed save is an Error notification with the server\'s sentence, and the edits stay', async () => {
      updateJobMock.mockRejectedValueOnce(
        new DaaSRequestError('Cron job code is invalid: Unexpected token', { kind: 'invalid', status: 400 }),
      );
      const onSaved = vi.fn();
      renderDetail({ onSaved });
      await loaded();

      fireEvent.change(field.code(), { target: { value: 'not (' } });
      fireEvent.click(button('Save'));

      await waitFor(() =>
        expect(show).toHaveBeenCalledWith(
          expect.objectContaining({ title: 'Error', message: 'Cron job code is invalid: Unexpected token', color: 'red' }),
        ),
      );
      expect(field.code()).toHaveValue('not (');
      expect(unsavedBadge()).toBeInTheDocument();
      expect(onSaved).not.toHaveBeenCalled();
      await waitFor(() => expect(button('Save')).toBeEnabled());

      // A failure that carries no sentence gets the editor's own
      updateJobMock.mockRejectedValueOnce('boom');
      fireEvent.click(button('Save'));
      await waitFor(() => expect(show).toHaveBeenCalledWith(expect.objectContaining({ message: 'Failed to save' })));
    });

    it.each([
      ['Name', 'name', 'Name is required'],
      ['Schedule', 'schedule', 'Schedule expression is required'],
      ['Job Code', 'code', 'Code is required'],
    ] as const)('a blank %s refuses the save with a validation notification, and sends nothing', async (_label, key, message) => {
      renderDetail();
      await loaded();
      fireEvent.change(field[key](), { target: { value: '   ' } });
      fireEvent.click(button('Save'));

      expect(show).toHaveBeenCalledWith({ title: 'Validation Error', message, color: 'red' });
      expect(updateJobMock).not.toHaveBeenCalled();
    });
  });

  describe('timezone', () => {
    // CR-02: the reference's Select had no option for such a value and showed "UTC+0"
    it('CR-02: a stored timezone outside the list is shown as stored and survives Save', async () => {
      renderDetail({ id: sync.id });
      await loaded('Legacy sync');

      // Shown: the job's own timezone, not the default's label
      expect(sync.timezone).toBe('Asia/Jakarta');
      expect(field.timezone()).toHaveValue('Asia/Jakarta');

      // Kept: a save of another field does not send, or change, the timezone
      fireEvent.change(field.description(), { target: { value: 'x' } });
      fireEvent.click(button('Save'));
      await waitFor(() => expect(updateJobMock).toHaveBeenCalledWith(sync.id, { description: 'x' }));
      await waitFor(() => expect(button('Save')).toBeDisabled());
      expect(stored[sync.id].timezone).toBe('Asia/Jakarta');
      expect(field.timezone()).toHaveValue('Asia/Jakarta');
    });

    it('offers the stored timezone as an option of its own, so there is a way back to it', async () => {
      renderDetail({ id: sync.id });
      await loaded('Legacy sync');

      await pick('Timezone', 'UTC+7');
      expect(field.timezone()).toHaveValue('UTC+7');
      expect(unsavedBadge()).toBeInTheDocument();

      await pick('Timezone', 'Asia/Jakarta');
      expect(field.timezone()).toHaveValue('Asia/Jakarta');
      expect(unsavedBadge()).not.toBeInTheDocument();
    });

    it('offers the 26 UTC offsets by default, and the options it is given instead', async () => {
      const { unmount } = renderDetail();
      await loaded();
      fireEvent.click(field.timezone());
      // hidden: true — the dropdown stays display:none in jsdom (no transitions).
      const listbox = await screen.findByRole('listbox', { name: 'Timezone', hidden: true });
      const options = within(listbox).getAllByRole('option', { hidden: true });
      expect(options).toHaveLength(26);
      expect(options[0]).toHaveTextContent('UTC-12');
      expect(options[25]).toHaveTextContent('UTC+13');
      unmount();

      renderDetail({
        timezoneOptions: [
          { value: 'UTC', label: 'Coordinated Universal Time' },
          { value: 'Asia/Jakarta', label: 'Jakarta' },
        ],
      });
      await loaded();
      expect(field.timezone()).toHaveValue('Coordinated Universal Time');
      await pick('Timezone', 'Jakarta');
      fireEvent.click(button('Save'));
      await waitFor(() => expect(updateJobMock).toHaveBeenCalledWith(report.id, { timezone: 'Asia/Jakarta' }));
    });

    // CR-05: Mantine's Select deselects on a re-pick; the reference then fell back to UTC / inactive
    it('CR-05: re-picking the selected Status or Timezone option keeps it', async () => {
      // A job whose values are not the ones a deselect fell back to (inactive, UTC)
      stored[sweep.id] = { ...stored[sweep.id], status: 'active' };
      renderDetail({ id: sweep.id });
      await loaded('Cache sweep');
      expect(field.status()).toHaveValue('Active');
      expect(field.timezone()).toHaveValue('UTC+7');

      await pick('Status', 'Active');
      expect(field.status()).toHaveValue('Active');

      await pick('Timezone', 'UTC+7');
      expect(field.timezone()).toHaveValue('UTC+7');

      // Nothing changed, so nothing to save — and a save would send neither field
      expect(unsavedBadge()).not.toBeInTheDocument();
      expect(button('Save')).toBeDisabled();
      expect(updateJobMock).not.toHaveBeenCalled();
    });
  });

  describe('timeout and memory limit', () => {
    // CR-03: the reference's inputs took a decimal, which the integer columns refuse
    it('CR-03: Timeout and Memory accept whole numbers only — a decimal cannot be typed, or saved', async () => {
      const user = userEvent.setup();
      renderDetail();
      await loaded();

      await user.clear(field.timeout());
      await user.type(field.timeout(), '1500.5');
      await user.clear(field.memory());
      await user.type(field.memory(), '96.5');
      // The separator is not taken: no decimal is on screen, and none is in the form
      expect(field.timeout().value).not.toContain('.');
      expect(field.memory().value).not.toContain('.');
      expect(field.timeout()).toHaveValue('15005');
      expect(field.memory()).toHaveValue('965');

      await user.click(button('Save'));
      await waitFor(() => expect(updateJobMock).toHaveBeenCalledTimes(1));
      const patch = updateJobMock.mock.calls[0][1] as { timeout_ms: number; memory_limit_mb: number };
      expect(Number.isInteger(patch.timeout_ms)).toBe(true);
      expect(Number.isInteger(patch.memory_limit_mb)).toBe(true);
      // Memory is held to the input's cap when the field is left
      expect(patch).toEqual({ timeout_ms: 15005, memory_limit_mb: 512 });
    });

    it('takes no minus sign either', async () => {
      const user = userEvent.setup();
      renderDetail();
      await loaded();
      await user.clear(field.timeout());
      await user.type(field.timeout(), '-2000');
      expect(field.timeout()).toHaveValue('2000');
    });

    it('an emptied Timeout falls back to its default when the field is left, not while it is typed in', async () => {
      const user = userEvent.setup();
      stored[report.id] = { ...stored[report.id], timeout_ms: 20000 };
      renderDetail();
      await loaded();
      expect(field.timeout()).toHaveValue('20000');

      await user.clear(field.timeout());
      // Still empty under the cursor: the default is not pushed back in mid-edit
      expect(field.timeout()).toHaveValue('');
      await user.tab();
      expect(field.timeout()).toHaveValue('10000');

      await user.click(button('Save'));
      await waitFor(() => expect(updateJobMock).toHaveBeenCalledWith(report.id, { timeout_ms: 10000 }));
    });

    it('an emptied Memory Limit falls back to its default too', async () => {
      const user = userEvent.setup();
      stored[report.id] = { ...stored[report.id], memory_limit_mb: 128 };
      renderDetail();
      await loaded();
      await user.clear(field.memory());
      await user.tab();
      expect(field.memory()).toHaveValue('64');
    });

    it('holds a typed value inside the inputs\' bounds when the field is left', async () => {
      const user = userEvent.setup();
      renderDetail();
      await loaded();

      await user.clear(field.timeout());
      await user.type(field.timeout(), '500');
      await user.tab();
      expect(field.timeout()).toHaveValue('1000');

      await user.clear(field.memory());
      await user.type(field.memory(), '8');
      await user.tab();
      expect(field.memory()).toHaveValue('16');
    });

    it('shows a stored value outside the inputs\' bounds as stored, and leaves it alone on blur', async () => {
      const user = userEvent.setup();
      // Written through the API: both backends store any positive integer
      stored[report.id] = { ...stored[report.id], timeout_ms: 250, memory_limit_mb: 1024 };
      renderDetail();
      await loaded();
      expect(field.timeout()).toHaveValue('250');
      expect(field.memory()).toHaveValue('1024');

      await user.click(field.timeout());
      await user.click(field.memory());
      await user.tab();
      expect(field.timeout()).toHaveValue('250');
      expect(field.memory()).toHaveValue('1024');
      expect(unsavedBadge()).not.toBeInTheDocument();
    });
  });

  describe('a new job', () => {
    it('starts with the form\'s defaults and the default code, and loads nothing', async () => {
      renderDetail({ id: 'new' });

      expect(screen.getByRole('heading', { name: 'New Cron Job', level: 2 })).toBeInTheDocument();
      expect(screen.getByTestId('cron-job-detail-breadcrumb-current')).toHaveTextContent('New Cron Job');
      expect(field.name()).toHaveValue('');
      expect(field.name()).toHaveAttribute('placeholder', 'My Cron Job');
      expect(field.schedule()).toHaveValue('0 9 * * 1-5');
      expect(field.timezone()).toHaveValue('UTC+0');
      expect(field.timeout()).toHaveValue('10000');
      expect(field.memory()).toHaveValue('64');
      expect(field.code()).toHaveValue(DEFAULT_CRON_CODE);
      expect(getJobMock).not.toHaveBeenCalled();

      // A job that is not stored yet has no status to set, nothing to run and no history
      expect(screen.queryByRole('textbox', { name: 'Status' })).not.toBeInTheDocument();
      expect(screen.queryByTestId('cron-job-detail-status-badge')).not.toBeInTheDocument();
      expect(queryButton('Run Now')).not.toBeInTheDocument();
      expect(queryButton('Activate')).not.toBeInTheDocument();
      expect(screen.queryByRole('tab', { name: 'History' })).not.toBeInTheDocument();
      expect(button('Create')).toBeEnabled();
      expect(unsavedBadge()).not.toBeInTheDocument();
    });

    it('starts with the code it is given', () => {
      renderDetail({ id: 'new', defaultCode: "console.log('mine');" });
      expect(field.code()).toHaveValue("console.log('mine');");
    });

    it('creates the job, says so, and hands the stored job to onCreated — it goes nowhere itself', async () => {
      const onCreated = vi.fn();
      const onSaved = vi.fn();
      renderDetail({ id: 'new', onCreated, onSaved });

      fireEvent.change(field.name(), { target: { value: 'Hourly ping' } });
      expect(unsavedBadge()).toBeInTheDocument();
      fireEvent.click(button('Create'));

      await waitFor(() => expect(createJobMock).toHaveBeenCalledTimes(1));
      // A blank description is left out: the job is stored without one
      expect(createJobMock).toHaveBeenCalledWith({
        name: 'Hourly ping',
        schedule: '0 9 * * 1-5',
        timezone: 'UTC',
        code: DEFAULT_CRON_CODE,
        status: 'inactive',
        timeout_ms: 10000,
        memory_limit_mb: 64,
      });
      await waitFor(() => expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: 'new-job-id', name: 'Hourly ping' })));
      expect(show).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Success', message: 'Cron job created', color: 'green' }),
      );
      expect(onSaved).not.toHaveBeenCalled();
      expect(unsavedBadge()).not.toBeInTheDocument();
    });

    it('sends a description that was written', async () => {
      renderDetail({ id: 'new' });
      fireEvent.change(field.name(), { target: { value: 'Hourly ping' } });
      fireEvent.change(field.description(), { target: { value: 'Pings the API' } });
      fireEvent.click(button('Create'));
      await waitFor(() =>
        expect(createJobMock).toHaveBeenCalledWith(expect.objectContaining({ description: 'Pings the API' })),
      );
    });

    it('a blank name refuses the create with a validation notification', () => {
      renderDetail({ id: 'new' });
      fireEvent.click(button('Create'));
      expect(show).toHaveBeenCalledWith({ title: 'Validation Error', message: 'Name is required', color: 'red' });
      expect(createJobMock).not.toHaveBeenCalled();
    });

    it('a double click on Create sends one request', async () => {
      const request = deferred<CronJobRecord>();
      createJobMock.mockImplementation(() => request.promise);
      renderDetail({ id: 'new' });
      fireEvent.change(field.name(), { target: { value: 'Hourly ping' } });

      const create = button('Create');
      fireEvent.click(create);
      fireEvent.click(create);
      expect(createJobMock).toHaveBeenCalledTimes(1);
      expect(create).toHaveAttribute('data-loading', 'true');

      await act(async () => {
        request.resolve({ id: 'new-job-id', name: 'Hourly ping' });
      });
      await waitFor(() => expect(create).not.toHaveAttribute('data-loading'));
    });

    it('edits the job it created when the host does not navigate: a second Save updates it, and nothing is created twice', async () => {
      updateJobMock.mockImplementation(async (id: string, patch: Partial<CronJobRecord>) => ({
        id,
        name: 'Hourly ping',
        description: null,
        schedule: '0 9 * * 1-5',
        timezone: 'UTC',
        code: DEFAULT_CRON_CODE,
        status: 'inactive',
        timeout_ms: 10000,
        memory_limit_mb: 64,
        ...patch,
      }));
      // No onCreated: the id stays "new"
      renderDetail({ id: 'new' });
      fireEvent.change(field.name(), { target: { value: 'Hourly ping' } });
      fireEvent.click(button('Create'));

      // The editor is the stored job's now: its title, its status, its actions
      expect(await screen.findByRole('heading', { name: 'Edit Cron Job' })).toBeInTheDocument();
      expect(screen.getByTestId('cron-job-detail-breadcrumb-current')).toHaveTextContent('Hourly ping');
      expect(screen.getByTestId('cron-job-detail-status-badge')).toHaveTextContent('Inactive');
      expect(queryButton('Create')).not.toBeInTheDocument();
      expect(button('Save')).toBeDisabled();
      expect(button('Run Now')).toBeEnabled();
      expect(screen.getByRole('tab', { name: 'History' })).toBeInTheDocument();
      // Shown from the create's own answer, without a load for it
      expect(getJobMock).not.toHaveBeenCalled();

      fireEvent.change(field.name(), { target: { value: 'Hourly ping v2' } });
      fireEvent.click(button('Save'));
      await waitFor(() => expect(updateJobMock).toHaveBeenCalledWith('new-job-id', { name: 'Hourly ping v2' }));
      expect(createJobMock).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(field.name()).toHaveValue('Hourly ping v2'));
    });

    it('does not load the created job a second time when the host then navigates to it', async () => {
      stored['new-job-id'] = { ...sweep, id: 'new-job-id', name: 'Hourly ping' };
      const { update } = renderDetail({ id: 'new' });
      fireEvent.change(field.name(), { target: { value: 'Hourly ping' } });
      fireEvent.click(button('Create'));
      await screen.findByRole('heading', { name: 'Edit Cron Job' });

      // As the reference admin UI does: onCreated navigates to the new job
      update({ id: 'new-job-id' });
      await waitFor(() => expect(getJobMock).toHaveBeenCalledWith('new-job-id'));
      await loaded('Hourly ping');
      expect(getJobMock).toHaveBeenCalledTimes(1);
    });

    it('a new job opened after one was created here starts empty again', async () => {
      const { update } = renderDetail({ id: 'new' });
      fireEvent.change(field.name(), { target: { value: 'Hourly ping' } });
      fireEvent.click(button('Create'));
      await screen.findByRole('heading', { name: 'Edit Cron Job' });

      update({ id: sweep.id });
      await loaded('Cache sweep');
      update({ id: 'new' });
      expect(await screen.findByRole('heading', { name: 'New Cron Job' })).toBeInTheDocument();
      expect(field.name()).toHaveValue('');
      expect(button('Create')).toBeEnabled();
    });

    it('opens the created job when the host hands its id back', async () => {
      const { update } = renderDetail({ id: 'new' });
      fireEvent.change(field.name(), { target: { value: 'Hourly ping' } });
      // As the reference admin UI does: onCreated navigates to the new job
      update({ id: sweep.id });
      await loaded('Cache sweep');
      expect(screen.getByRole('heading', { name: 'Edit Cron Job' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'History' })).toBeInTheDocument();
    });

    it('a failed create is an Error notification, and the form stays', async () => {
      createJobMock.mockRejectedValueOnce(
        new DaaSRequestError('schedule is not a valid cron expression', { kind: 'invalid', status: 400 }),
      );
      const onCreated = vi.fn();
      renderDetail({ id: 'new', onCreated });
      fireEvent.change(field.name(), { target: { value: 'Hourly ping' } });
      fireEvent.click(button('Create'));

      await waitFor(() =>
        expect(show).toHaveBeenCalledWith(
          expect.objectContaining({ title: 'Error', message: 'schedule is not a valid cron expression' }),
        ),
      );
      expect(onCreated).not.toHaveBeenCalled();
      expect(field.name()).toHaveValue('Hourly ping');
    });

    it('"+" is a new job too', () => {
      renderDetail({ id: '+' });
      expect(screen.getByRole('heading', { name: 'New Cron Job' })).toBeInTheDocument();
      expect(getJobMock).not.toHaveBeenCalled();
    });
  });

  describe('Activate and Deactivate', () => {
    it('Activate saves the status alone, says so, and the header follows', async () => {
      renderDetail({ id: sweep.id });
      await loaded('Cache sweep');

      fireEvent.click(button('Activate'));

      await waitFor(() => expect(updateJobMock).toHaveBeenCalledWith(sweep.id, { status: 'active' }));
      await waitFor(() => expect(button('Deactivate')).toBeInTheDocument());
      expect(queryButton('Activate')).not.toBeInTheDocument();
      expect(show).toHaveBeenCalledWith({ title: 'Activated', message: 'Cron job is now active', color: 'green' });
      expect(screen.getByTestId('cron-job-detail-status-badge').textContent).toBe('Active');
      expect(field.status()).toHaveValue('Active');
      expect(unsavedBadge()).not.toBeInTheDocument();
    });

    it('Deactivate saves the status alone and says so', async () => {
      renderDetail();
      await loaded();
      fireEvent.click(button('Deactivate'));

      await waitFor(() => expect(updateJobMock).toHaveBeenCalledWith(report.id, { status: 'inactive' }));
      await waitFor(() => expect(button('Activate')).toBeInTheDocument());
      expect(show).toHaveBeenCalledWith({ title: 'Deactivated', message: 'Cron job is now inactive', color: 'yellow' });
      expect(field.status()).toHaveValue('Inactive');
    });

    it('Deactivate stays enabled with unsaved edits and keeps them, as in the reference', async () => {
      renderDetail();
      await loaded();
      fireEvent.change(field.description(), { target: { value: 'pending edit' } });
      fireEvent.change(field.code(), { target: { value: 'if (' } });
      expect(button('Run Now')).toBeDisabled();
      // The way to stop a job, whatever state the edit is in
      expect(button('Deactivate')).toBeEnabled();

      fireEvent.click(button('Deactivate'));
      await waitFor(() => expect(updateJobMock).toHaveBeenCalledWith(report.id, { status: 'inactive' }));
      expect(await screen.findByTestId('cron-job-detail-status-badge')).toHaveTextContent('Inactive');
      expect(field.status()).toHaveValue('Inactive');
      // The edits are still there, still unsaved, and Activate waits for them
      expect(field.description()).toHaveValue('pending edit');
      expect(field.code()).toHaveValue('if (');
      expect(unsavedBadge()).toBeInTheDocument();
      expect(button('Activate')).toBeDisabled();

      // Save sends the edits, and not the status the switch already stored
      fireEvent.click(button('Save'));
      await waitFor(() =>
        expect(updateJobMock).toHaveBeenLastCalledWith(report.id, { description: 'pending edit', code: 'if (' }),
      );
    });

    it('Run Now and Activate wait for unsaved edits to be saved', async () => {
      const user = userEvent.setup();
      const { unmount } = renderDetail();
      await loaded();
      fireEvent.change(field.description(), { target: { value: 'pending edit' } });
      expect(button('Run Now')).toBeDisabled();
      fireEvent.click(button('Run Now'));
      expect(runJobMock).not.toHaveBeenCalled();

      // The tooltip is the hint of why
      await user.hover(button('Run Now'));
      expect(await screen.findByRole('tooltip', { hidden: true })).toHaveTextContent('Save changes first');
      unmount();

      renderDetail({ id: sweep.id });
      await loaded('Cache sweep');
      fireEvent.change(field.description(), { target: { value: 'pending edit' } });
      expect(button('Activate')).toBeDisabled();
      fireEvent.change(field.description(), { target: { value: '' } });
      expect(button('Activate')).toBeEnabled();
      expect(button('Run Now')).toBeEnabled();
    });

    it('a double click sends one request, and the button is pending meanwhile', async () => {
      const request = deferred<CronJobRecord>();
      updateJobMock.mockImplementation(() => request.promise);
      renderDetail();
      await loaded();

      const deactivate = button('Deactivate');
      fireEvent.click(deactivate);
      fireEvent.click(deactivate);
      expect(updateJobMock).toHaveBeenCalledTimes(1);
      expect(deactivate).toHaveAttribute('data-loading', 'true');

      await act(async () => {
        request.resolve({ ...report, status: 'inactive' });
      });
      await waitFor(() => expect(button('Activate')).toBeInTheDocument());
    });

    it.each([
      ['Deactivate', report.id, report.name, 'Failed to deactivate'],
      ['Activate', sweep.id, sweep.name, 'Failed to activate'],
    ] as const)('a failed %s is an Error notification, and the status stays', async (action, id, name, fallback) => {
      updateJobMock.mockRejectedValueOnce(new DaaSRequestError('Item not found', { kind: 'notFound', status: 500 }));
      renderDetail({ id });
      await loaded(name);
      fireEvent.click(button(action));
      await waitFor(() => expect(show).toHaveBeenCalledWith({ title: 'Error', message: 'Item not found', color: 'red' }));
      await waitFor(() => expect(button(action)).toBeEnabled());

      updateJobMock.mockRejectedValueOnce('boom');
      fireEvent.click(button(action));
      await waitFor(() => expect(show).toHaveBeenCalledWith({ title: 'Error', message: fallback, color: 'red' }));
      expect(button(action)).toBeInTheDocument();
    });
  });

  describe('Run Now', () => {
    it('is pending for the whole run, then says the job started and opens the History tab with the new run loaded', async () => {
      const run = deferred<CronRunResult>();
      runJobMock.mockImplementation(() => run.promise);
      renderDetail();
      await loaded();

      const runNow = button('Run Now');
      fireEvent.click(runNow);
      fireEvent.click(runNow);
      expect(runJobMock).toHaveBeenCalledTimes(1);
      expect(runJobMock).toHaveBeenCalledWith(report.id);
      expect(runNow).toHaveAttribute('data-loading', 'true');

      // The request is answered when the run has ended: until then nothing is said or loaded
      await act(async () => {});
      expect(show).not.toHaveBeenCalled();
      expect(fetchJobRunsMock).not.toHaveBeenCalled();
      expect(screen.getByRole('tab', { name: 'Settings' })).toHaveAttribute('aria-selected', 'true');

      await act(async () => {
        run.resolve(ran);
      });
      expect(show).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Triggered',
          message: 'Job started. Check the History tab for results.',
          color: 'blue',
        }),
      );
      await waitFor(() => expect(screen.getByRole('tab', { name: 'History' })).toHaveAttribute('aria-selected', 'true'));
      await waitFor(() => expect(fetchJobRunsMock).toHaveBeenCalledWith(report.id, { page: 1, limit: 50 }));
      expect(fetchJobRunsMock).toHaveBeenCalledTimes(1);
      expect(runNow).not.toHaveAttribute('data-loading');
    });

    it('loads the history again when it was already open', async () => {
      renderDetail();
      await loaded();
      fireEvent.click(screen.getByRole('tab', { name: 'History' }));
      await waitFor(() => expect(fetchJobRunsMock).toHaveBeenCalledTimes(1));

      fireEvent.click(screen.getByRole('tab', { name: 'Settings' }));
      fireEvent.click(button('Run Now'));
      await waitFor(() => expect(fetchJobRunsMock).toHaveBeenCalledTimes(2));
      expect(screen.getByRole('tab', { name: 'History' })).toHaveAttribute('aria-selected', 'true');
    });

    // CR-17: the reference said "Job started" although the answer's historyId was ''
    it('CR-17: Run Now on a job that is already running says it was skipped, not that it started', async () => {
      runJobMock.mockResolvedValue(skipped);
      renderDetail();
      await loaded();

      fireEvent.click(button('Run Now'));

      await waitFor(() =>
        expect(show).toHaveBeenCalledWith({
          title: 'Already running',
          message: 'This job is already running, so it was not started again.',
          color: 'yellow',
        }),
      );
      expect(show).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Triggered' }));
      expect(show).not.toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Job started. Check the History tab for results.' }),
      );
      expect(show).toHaveBeenCalledTimes(1);
      // The run that is still going is in the history
      await waitFor(() => expect(screen.getByRole('tab', { name: 'History' })).toHaveAttribute('aria-selected', 'true'));
    });

    it('a failed Run Now is an Error notification, and the editor stays on Settings', async () => {
      runJobMock.mockRejectedValueOnce(
        new DaaSRequestError('Cron job 123 not found', { kind: 'notFound', status: 500 }),
      );
      renderDetail();
      await loaded();
      fireEvent.click(button('Run Now'));

      await waitFor(() =>
        expect(show).toHaveBeenCalledWith({ title: 'Error', message: 'Cron job 123 not found', color: 'red' }),
      );
      expect(screen.getByRole('tab', { name: 'Settings' })).toHaveAttribute('aria-selected', 'true');
      await waitFor(() => expect(button('Run Now')).toBeEnabled());

      runJobMock.mockRejectedValueOnce('boom');
      fireEvent.click(button('Run Now'));
      await waitFor(() =>
        expect(show).toHaveBeenCalledWith({ title: 'Error', message: 'Failed to trigger run', color: 'red' }),
      );
    });
  });

  describe('the History tab', () => {
    it('loads the job\'s runs when the tab is opened, not before, without a Job column', async () => {
      renderDetail();
      await loaded();
      expect(fetchJobRunsMock).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('tab', { name: 'History' }));
      const history = await screen.findByRole('tabpanel', { name: 'History' });
      await waitFor(() => expect(history.querySelectorAll('tbody tr.table-row')).toHaveLength(3));
      expect(fetchJobRunsMock).toHaveBeenCalledWith(report.id, { page: 1, limit: 50 });
      expect(fetchRunsMock).not.toHaveBeenCalled();
      const headers = Array.from(history.querySelectorAll('thead th'))
        .map((th) => th.textContent)
        .filter(Boolean);
      expect(headers).toEqual(['Triggered', 'Duration (ms)', 'Status', 'By', 'Logs']);
    });

    // CR-19: the reference's note under this table promised an expandable row "(future enhancement)"
    it('CR-19: shows no "future enhancement" note under the per-job history', async () => {
      renderDetail();
      await loaded();
      fireEvent.click(screen.getByRole('tab', { name: 'History' }));
      const history = await screen.findByRole('tabpanel', { name: 'History' });
      await waitFor(() => expect(history.querySelectorAll('tbody tr.table-row')).toHaveLength(3));

      // The runs have console lines — the condition the reference drew its note under
      expect(history).toHaveTextContent('2 lines');
      expect(history.textContent).not.toMatch(/future enhancement/i);
      expect(history.textContent).not.toMatch(/Expand a row/i);
    });

    it('a run row opens its log, which does not repeat the job\'s name', async () => {
      renderDetail();
      await loaded();
      fireEvent.click(screen.getByRole('tab', { name: 'History' }));
      const history = await screen.findByRole('tabpanel', { name: 'History' });
      await waitFor(() => expect(history.querySelectorAll('tbody tr.table-row')).toHaveLength(3));
      fireEvent.click(history.querySelector('tbody tr.table-row') as HTMLElement);

      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByText('Run logs')).toBeInTheDocument();
      expect(within(dialog).getByText('2 log lines')).toBeInTheDocument();
    });

    it('historyPageSize sets the runs per page', async () => {
      renderDetail({ historyPageSize: 10 });
      await loaded();
      fireEvent.click(screen.getByRole('tab', { name: 'History' }));
      await waitFor(() => expect(fetchJobRunsMock).toHaveBeenCalledWith(report.id, { page: 1, limit: 10 }));
    });
  });

  describe('a user who may not save', () => {
    // CR-14: the reference left every field editable and showed "Unsaved Changes" to a user with no Save button
    it('CR-14: a reader cannot edit the form fields or the code, and sees no write actions', async () => {
      const user = userEvent.setup();
      grant(['read']);
      renderDetail();
      await loaded();

      for (const input of [
        field.name(),
        field.description(),
        field.schedule(),
        field.timezone(),
        field.timeout(),
        field.memory(),
        field.status(),
        field.code(),
      ]) {
        expect(input).toHaveAttribute('readonly');
      }

      // Typing changes nothing, in a field or in the code
      await user.type(field.name(), ' edited');
      await user.type(field.code(), '// edited');
      await user.type(field.timeout(), '9');
      expect(field.name()).toHaveValue(report.name);
      expect(field.code()).toHaveValue(report.code);
      expect(field.timeout()).toHaveValue('10000');
      expect(unsavedBadge()).not.toBeInTheDocument();

      for (const name of ['Save', 'Create', 'Run Now', 'Activate', 'Deactivate']) {
        expect(queryButton(name)).not.toBeInTheDocument();
      }
      expect(screen.getByTestId('cron-job-detail-read-only-notice')).toHaveTextContent(
        'You can view this job, but you do not have permission to change it.',
      );
      expect(updateJobMock).not.toHaveBeenCalled();
    });

    it('a reader still reads the job\'s history', async () => {
      grant(['read']);
      renderDetail();
      await loaded();
      fireEvent.click(screen.getByRole('tab', { name: 'History' }));
      await waitFor(() => expect(fetchJobRunsMock).toHaveBeenCalledWith(report.id, { page: 1, limit: 50 }));
    });

    it('readOnly gives an administrator the same view', async () => {
      renderDetail({ readOnly: true });
      await loaded();
      expect(field.name()).toHaveAttribute('readonly');
      expect(field.code()).toHaveAttribute('readonly');
      expect(queryButton('Save')).not.toBeInTheDocument();
      expect(queryButton('Run Now')).not.toBeInTheDocument();
      expect(queryButton('Deactivate')).not.toBeInTheDocument();
    });

    it('create without update: a stored job is read-only, a new one is not', async () => {
      grant(['read', 'create']);
      const { unmount } = renderDetail();
      await loaded();
      expect(field.name()).toHaveAttribute('readonly');
      expect(queryButton('Save')).not.toBeInTheDocument();
      unmount();

      renderDetail({ id: 'new' });
      expect(field.name()).not.toHaveAttribute('readonly');
      expect(button('Create')).toBeInTheDocument();
    });

    it('update without create: a new job is refused in place', () => {
      grant(['read', 'update']);
      const onBack = vi.fn();
      renderDetail({ id: 'new', onBack });
      const denied = screen.getByTestId('cron-job-detail-access-denied');
      expect(denied).toHaveTextContent('Access denied');
      expect(screen.queryByRole('textbox', { name: 'Name' })).not.toBeInTheDocument();
      fireEvent.click(within(denied).getByRole('button', { name: 'Back' }));
      expect(onBack).toHaveBeenCalledTimes(1);
    });

    it('offers nothing that writes while permissions load, and calls nobody a reader before they are known', async () => {
      // What a user who will turn out to be an administrator gets meanwhile
      usePermissionsMock.mockReturnValue({ canPerform: () => true, isAdmin: true, loading: true });
      const { update } = renderDetail();
      await loaded();

      for (const name of ['Save', 'Run Now', 'Activate', 'Deactivate']) {
        expect(queryButton(name)).not.toBeInTheDocument();
      }
      expect(field.name()).toHaveAttribute('readonly');
      expect(field.code()).toHaveAttribute('readonly');
      expect(screen.queryByTestId('cron-job-detail-read-only-notice')).not.toBeInTheDocument();
      expect(document.querySelector('.mantine-LoadingOverlay-root')).toBeInTheDocument();

      grant([], true);
      update({});
      expect(await screen.findByRole('button', { name: 'Save' })).toBeInTheDocument();
      expect(button('Run Now')).toBeInTheDocument();
      expect(field.name()).not.toHaveAttribute('readonly');
      await waitFor(() => expect(document.querySelector('.mantine-LoadingOverlay-root')).not.toBeInTheDocument());
      // The job was loaded once: the permissions arriving do not fetch it again
      expect(getJobMock).toHaveBeenCalledTimes(1);
    });

    it('a later refresh of the permissions does not close the form under the user', async () => {
      const { update } = renderDetail();
      await loaded();
      fireEvent.change(field.description(), { target: { value: 'still typing' } });

      // The hook loads again (a renewed token, another scope) and answers from what it knew meanwhile
      usePermissionsMock.mockReturnValue({ canPerform: () => true, isAdmin: true, loading: true });
      update({});
      expect(field.description()).not.toHaveAttribute('readonly');
      expect(field.description()).toHaveValue('still typing');
      expect(button('Save')).toBeEnabled();
      expect(button('Deactivate')).toBeInTheDocument();
      expect(document.querySelector('.mantine-LoadingOverlay-root')).not.toBeInTheDocument();
    });

    it('a new job is neither opened nor refused while permissions load', async () => {
      usePermissionsMock.mockReturnValue({ canPerform: () => false, isAdmin: false, loading: true });
      const { update } = renderDetail({ id: 'new' });

      // Not refused yet: this user may turn out to be allowed
      expect(screen.queryByTestId('cron-job-detail-access-denied')).not.toBeInTheDocument();
      // Not opened yet either: no Create, and the form takes no edit
      expect(queryButton('Create')).not.toBeInTheDocument();
      expect(field.name()).toHaveAttribute('readonly');
      expect(document.querySelector('.mantine-LoadingOverlay-root')).toBeInTheDocument();

      // A user who may not create is refused, without ever having had the form
      grant(['read', 'update']);
      update({ id: 'new' });
      expect(await screen.findByTestId('cron-job-detail-access-denied')).toBeInTheDocument();
      expect(createJobMock).not.toHaveBeenCalled();
    });

    it('a new job opens for a user who may create once permissions are known', async () => {
      usePermissionsMock.mockReturnValue({ canPerform: () => false, isAdmin: false, loading: true });
      const { update } = renderDetail({ id: 'new' });
      expect(queryButton('Create')).not.toBeInTheDocument();

      grant(['read', 'create']);
      update({ id: 'new' });
      expect(await screen.findByRole('button', { name: 'Create' })).toBeEnabled();
      expect(field.name()).not.toHaveAttribute('readonly');
      // Still the new job's defaults: the wait reset nothing
      expect(field.schedule()).toHaveValue('0 9 * * 1-5');
      expect(field.code()).toHaveValue(DEFAULT_CRON_CODE);
    });
  });

  describe('a job answered without some of its columns', () => {
    it('says the code is withheld in place of an editor, and never sends it', async () => {
      // Both backends drop a column the caller's grant withholds
      const { code: _withheld, ...withoutCode } = report;
      stored[report.id] = withoutCode;
      renderDetail();
      await loaded();

      expect(screen.getByTestId('cron-job-detail-code-withheld')).toHaveTextContent(
        'Your access to this job does not include its code, so it is not shown and cannot be changed here.',
      );
      expect(screen.queryByRole('textbox', { name: 'Job Code' })).not.toBeInTheDocument();
      expect(unsavedBadge()).not.toBeInTheDocument();

      // The job can still be renamed: the missing code is not a blank code
      fireEvent.change(field.name(), { target: { value: 'Renamed' } });
      fireEvent.click(button('Save'));
      await waitFor(() => expect(updateJobMock).toHaveBeenCalledWith(report.id, { name: 'Renamed' }));
      expect(show).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Validation Error' }));
    });

    it('shows the other withheld fields read-only, and offers no status action it cannot decide', async () => {
      stored[report.id] = { id: report.id, name: report.name, code: report.code };
      renderDetail();
      await loaded();

      for (const input of [field.schedule(), field.timezone(), field.timeout(), field.memory(), field.status()]) {
        expect(input).toHaveAttribute('readonly');
      }
      expect(field.name()).not.toHaveAttribute('readonly');
      expect(field.code()).not.toHaveAttribute('readonly');
      // The status is not known: neither Activate nor Deactivate, and a marker for a badge
      expect(queryButton('Activate')).not.toBeInTheDocument();
      expect(queryButton('Deactivate')).not.toBeInTheDocument();
      expect(screen.getByTestId('cron-job-detail-status-badge')).toHaveTextContent('—');
    });
  });

  describe('the code editor slot', () => {
    it('renderCodeEditor draws the host\'s editor with everything it needs', async () => {
      const seen: CronCodeEditorProps[] = [];
      renderDetail({
        codeEditorMinHeight: 300,
        renderCodeEditor: (props) => {
          seen.push(props);
          return (
            <textarea
              data-testid="host-editor"
              id={props.id}
              aria-labelledby={props['aria-labelledby']}
              value={props.value}
              readOnly={props.readOnly}
              onChange={(event) => props.onChange(event.currentTarget.value)}
            />
          );
        },
      });
      await loaded();

      const editor = screen.getByTestId('host-editor');
      expect(editor).toHaveValue(report.code);
      // The label names the host's editor too
      expect(screen.getByRole('textbox', { name: 'Job Code' })).toBe(editor);
      expect(screen.queryByTestId('cron-job-detail-code-editor')).not.toBeInTheDocument();
      expect(seen.at(-1)).toMatchObject({
        readOnly: false,
        minHeight: 300,
        placeholder: '// Your cron code here...',
      });

      fireEvent.change(editor, { target: { value: 'return 2;' } });
      fireEvent.click(button('Save'));
      await waitFor(() => expect(updateJobMock).toHaveBeenCalledWith(report.id, { code: 'return 2;' }));
    });

    it('tells the host\'s editor when the code is read-only', async () => {
      grant(['read']);
      const seen: CronCodeEditorProps[] = [];
      renderDetail({
        renderCodeEditor: (props) => {
          seen.push(props);
          return null;
        },
      });
      await waitFor(() => expect(field.name()).toHaveValue(report.name));
      expect(seen.at(-1)?.readOnly).toBe(true);
    });

    it('codeHelp replaces what the notice above the editor says', async () => {
      renderDetail({ codeHelp: <span>On this backend a job can call services.fetch.</span> });
      await loaded();
      const help = screen.getByTestId('cron-job-detail-code-help');
      expect(help).toHaveTextContent('Cron Code');
      expect(help).toHaveTextContent('On this backend a job can call services.fetch.');
      expect(help).not.toHaveTextContent('runs in a sandbox');
    });
  });

  describe('nothing to edit', () => {
    it('a job that does not exist draws the not-found state, in place', async () => {
      const onBack = vi.fn();
      renderDetail({ id: 'missing', onBack });

      const state = await screen.findByTestId('cron-job-detail-not-found');
      expect(state).toHaveTextContent('Cron job not found');
      expect(state).toHaveTextContent('It may have been deleted, or you may not have access to it.');
      expect(screen.queryByRole('textbox', { name: 'Name' })).not.toBeInTheDocument();
      // Missing is not an outage: no error notification
      expect(show).not.toHaveBeenCalled();
      fireEvent.click(within(state).getByRole('button', { name: 'Back' }));
      expect(onBack).toHaveBeenCalledTimes(1);
    });

    it('a refused load draws the access-denied state', async () => {
      getJobMock.mockRejectedValue(new DaaSRequestError('Permission denied', { kind: 'forbidden', status: 403 }));
      renderDetail();
      const state = await screen.findByTestId('cron-job-detail-access-denied');
      expect(state).toHaveTextContent('Access denied');
      expect(state).toHaveTextContent('You do not have permission to view this.');
      expect(show).not.toHaveBeenCalled();
      // Without onBack there is no way out to offer
      expect(within(state).queryByRole('button')).not.toBeInTheDocument();
    });

    it('a session that needs a second factor is told what the server said', async () => {
      getJobMock.mockRejectedValue(
        new DaaSRequestError('Multi-factor authentication is required', {
          kind: 'mfaRequired',
          status: 403,
          code: 'MFA_REQUIRED',
        }),
      );
      renderDetail();
      expect(await screen.findByTestId('cron-job-detail-access-denied')).toHaveTextContent(
        'Multi-factor authentication is required',
      );
    });

    it('a failed load draws the load-error state with Retry, and a notification', async () => {
      getJobMock.mockRejectedValueOnce(new DaaSRequestError('service unavailable', { kind: 'failure', status: 500 }));
      renderDetail({ onBack: vi.fn() });

      const state = await screen.findByTestId('cron-job-detail-load-error');
      expect(state).toHaveTextContent('Failed to load cron job — service unavailable');
      expect(show).toHaveBeenCalledWith({ title: 'Error', message: 'service unavailable', color: 'red' });

      fireEvent.click(within(state).getByRole('button', { name: 'Retry' }));
      await loaded();
      expect(screen.queryByTestId('cron-job-detail-load-error')).not.toBeInTheDocument();
    });

    it('a failure that is not a typed error is still a load error', async () => {
      getJobMock.mockRejectedValueOnce('boom');
      renderDetail();
      expect(await screen.findByTestId('cron-job-detail-load-error')).toHaveTextContent('Failed to fetch cron job');
    });
  });

  describe('navigation is by callback', () => {
    it('the breadcrumb back to the list calls onBack, and is a button, not a link', async () => {
      const onBack = vi.fn();
      const { container } = renderDetail({ onBack });
      await loaded();
      const crumb = screen.getByTestId('cron-job-detail-breadcrumb-root');
      expect(crumb.tagName).toBe('BUTTON');
      expect(crumb).toHaveTextContent('Cron Jobs');
      fireEvent.click(crumb);
      expect(onBack).toHaveBeenCalledTimes(1);
      expect(container.querySelector('a[href]')).toBeNull();
    });

    it('without onBack the breadcrumb is text', async () => {
      renderDetail();
      await loaded();
      expect(screen.queryByTestId('cron-job-detail-breadcrumb-root')).not.toBeInTheDocument();
      expect(screen.getByText('Cron Jobs')).toBeInTheDocument();
    });
  });
});
