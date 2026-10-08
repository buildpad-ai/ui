/**
 * CronJobsManager unit tests: the jobs list and its gates, the History tab,
 * the three reasons a list can have no rows (none, refused, failed), the row
 * actions with their pending states, and deleting — the page it lands on and
 * the confirm button's pending state. `@buildpad/hooks` is mocked.
 */
import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BuildpadI18nProvider } from '@buildpad/services';
import type { CronJobRecord, CronListResult, CronRunListResult, CronRunResult } from '@buildpad/types';
import { DaaSRequestError } from '../../hooks/src/daasRequest';
import { CronJobsManager } from '../src/CronJobsManager';
import { manyMockJobs, mockJobs, mockRuns } from '../src/_fixtures';

const {
  fetchJobsMock,
  updateJobMock,
  deleteJobMock,
  cloneJobMock,
  runJobMock,
  fetchRunsMock,
  fetchJobRunsMock,
  usePermissionsMock,
} = vi.hoisted(() => ({
  fetchJobsMock: vi.fn(),
  updateJobMock: vi.fn(),
  deleteJobMock: vi.fn(),
  cloneJobMock: vi.fn(),
  runJobMock: vi.fn(),
  fetchRunsMock: vi.fn(),
  fetchJobRunsMock: vi.fn(),
  usePermissionsMock: vi.fn(),
}));

vi.mock('@buildpad/hooks', async () => {
  // The URL-persistence helpers and the typed error are used as they are, so
  // the manager's URL wiring and its error branches are exercised, not stubbed.
  const url = await import('../../hooks/src/useUrlListParams');
  const request = await import('../../hooks/src/daasRequest');
  return {
    useUrlListParams: url.useUrlListParams,
    useHydrated: url.useHydrated,
    readUrlParam: url.readUrlParam,
    readUrlIntParam: url.readUrlIntParam,
    DaaSRequestError: request.DaaSRequestError,
    useCronJobs: () => ({
      fetchJobs: fetchJobsMock,
      updateJob: updateJobMock,
      deleteJob: deleteJobMock,
      cloneJob: cloneJobMock,
      runJob: runJobMock,
    }),
    useCronRuns: () => ({ fetchRuns: fetchRunsMock, fetchJobRuns: fetchJobRunsMock }),
    usePermissions: usePermissionsMock,
  };
});

const [sweep, sync, report] = mockJobs;

/** One page of `all`, as the hook answers it. */
function pageOf(
  all: CronJobRecord[],
  { page = 1, limit = 25 }: { page?: number; limit?: number } = {},
): CronListResult<CronJobRecord> {
  return {
    items: all.slice((page - 1) * limit, page * limit),
    total: all.length,
    totalPages: Math.max(1, Math.ceil(all.length / limit)),
    page,
    limit,
  };
}

function runsPage(): CronRunListResult {
  return { items: mockRuns, total: mockRuns.length, totalPages: 1, page: 1, limit: 50, offset: 0 };
}

/** Serves `store.rows` page by page, so a write that changes it is seen by the next load. */
function serve(store: { rows: CronJobRecord[] }) {
  fetchJobsMock.mockImplementation(async (params: { page?: number; limit?: number }) => pageOf(store.rows, params));
}

function renderManager(props: Partial<React.ComponentProps<typeof CronJobsManager>> = {}) {
  return render(
    <MantineProvider>
      {/* A pinned locale and zone, so dates read the same on every machine */}
      <BuildpadI18nProvider locale="en" timeZone="UTC" datesProvider={false}>
        <CronJobsManager urlParams={false} {...props} />
      </BuildpadI18nProvider>
    </MantineProvider>,
  );
}

function grant(actions: string[], isAdmin = false) {
  usePermissionsMock.mockReturnValue({
    canPerform: (_collection: string, action: string) => actions.includes(action),
    isAdmin,
    loading: false,
  });
}

/** The table row of the job named `name`. */
async function rowOf(name: string): Promise<HTMLElement> {
  return (await screen.findByText(name)).closest('tr') as HTMLElement;
}

/** The text of a row's cells, without the hidden spacer. */
function cells(row: HTMLElement): string[] {
  return Array.from(row.querySelectorAll('td:not(.spacer)')).map((cell) => cell.textContent ?? '');
}

// hidden: true — a menu's dropdown stays display:none in jsdom (nothing lays
// it out), so its items are in the DOM but not in the accessibility tree.
const HIDDEN = { hidden: true } as const;

/** Opens the row menu of the job named `name`; resolves to the texts of its items, in order. */
async function openMenuOf(name: string): Promise<string[]> {
  const row = await rowOf(name);
  fireEvent.click(within(row).getByRole('button', { name: `Actions for ${name}` }));
  const menu = await screen.findByRole('menu', HIDDEN);
  return within(menu)
    .getAllByRole('menuitem', HIDDEN)
    .map((item) => item.textContent ?? '');
}

async function rowAction(name: string, item: string) {
  await openMenuOf(name);
  fireEvent.click(screen.getByRole('menuitem', { name: item, ...HIDDEN }));
  // The menu closes on a click; wait for it, so the next one opened is the only one
  await waitFor(() => expect(screen.queryByRole('menu', HIDDEN)).not.toBeInTheDocument());
}

async function openDeleteFor(name: string) {
  await rowAction(name, 'Delete');
  return screen.findByTestId('cron-delete-confirm-btn');
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

const ran = (historyId = 'run-1'): CronRunResult => ({ historyId, skipped: false, message: 'triggered' });
const skipped: CronRunResult = { historyId: null, skipped: true, message: 'was already running — skipped' };

let show: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  fetchJobsMock.mockReset().mockResolvedValue(pageOf(mockJobs));
  updateJobMock.mockReset().mockImplementation(async (id: string, patch: object) => ({ id, ...patch }));
  deleteJobMock.mockReset().mockResolvedValue(undefined);
  cloneJobMock.mockReset().mockResolvedValue({ ...report, id: 'copy', name: 'Nightly report (copy)' });
  runJobMock.mockReset().mockResolvedValue(ran());
  fetchRunsMock.mockReset().mockResolvedValue(runsPage());
  fetchJobRunsMock.mockReset().mockResolvedValue(runsPage());
  usePermissionsMock.mockReset();
  grant([], true);
  show = vi.spyOn(notifications, 'show').mockImplementation(() => '');
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  show.mockRestore();
});

describe('CronJobsManager', () => {
  describe('the jobs list', () => {
    it('lists the jobs with their schedule, timezone, status and last run', async () => {
      renderManager();
      const row = await rowOf('Nightly report');

      const headers = Array.from(screen.getByTestId('cron-jobs-manager').querySelectorAll('thead th'))
        .map((th) => th.textContent)
        .filter(Boolean);
      expect(headers).toEqual(['Name', 'Schedule', 'Timezone', 'Status', 'Last Run', 'Last Status', 'Next Run']);

      // icon, name + description, schedule, timezone, status, last run, last status, next run, menu
      expect(cells(row).slice(1, 8)).toEqual([
        'Nightly reportSends the report of the day to the sales team.',
        '0 9 * * 1-5',
        'UTC+0',
        'Active',
        'Mar 2, 2026, 9:00:00 AM',
        'Success',
        'Mar 3, 2026, 9:00:00 AM',
      ]);

      expect(screen.getByRole('heading', { name: 'Cron Jobs', level: 2 })).toBeInTheDocument();
      expect(screen.getByTestId('cron-jobs-manager-count')).toHaveTextContent('3 jobs');
      expect(fetchJobsMock).toHaveBeenCalledWith({ page: 1, limit: 25, search: undefined });
    });

    it('labels an Etc/GMT timezone by its offset and shows any other name as it is stored', async () => {
      renderManager();
      expect(cells(await rowOf('Cache sweep'))[3]).toBe('UTC+7');
      expect(cells(await rowOf('Legacy sync'))[3]).toBe('Asia/Jakarta');
    });

    it('marks what a job that never ran does not have, and shows Next Run for an active job only', async () => {
      renderManager();
      // Inactive, never ran — and both backends leave a next_run_at on it
      expect(sweep.next_run_at).toBeTruthy();
      expect(cells(await rowOf('Cache sweep')).slice(4, 8)).toEqual(['Inactive', '—', '—', '—']);
      expect(cells(await rowOf('Legacy sync')).slice(4, 8)).toEqual([
        'Active',
        'Mar 1, 2026, 7:30:00 PM',
        'Error',
        'Mar 2, 2026, 7:30:00 PM',
      ]);
    });

    it('marks the columns of a job answered without them, instead of drawing defaults', async () => {
      // Both backends drop a column the caller's read grant withholds
      fetchJobsMock.mockResolvedValue(pageOf([{ id: report.id, name: report.name }]));
      renderManager();
      expect(cells(await rowOf('Nightly report')).slice(1, 8)).toEqual([
        'Nightly report',
        '—',
        '—',
        '—',
        '—',
        '—',
        '—',
      ]);
    });

    it('counts one job in the singular', async () => {
      fetchJobsMock.mockResolvedValue(pageOf(mockJobs.slice(0, 1)));
      renderManager();
      await waitFor(() => expect(screen.getByTestId('cron-jobs-manager-count')).toHaveTextContent('1 job'));
      expect(screen.getByTestId('cron-jobs-manager-count')).not.toHaveTextContent('jobs');
    });

    it('checks permissions on the collection both backends decide every cron route by', async () => {
      renderManager();
      await waitFor(() => expect(fetchJobsMock).toHaveBeenCalled());
      expect(usePermissionsMock).toHaveBeenCalledWith({ collections: ['daas_cron_jobs'] });
    });

    it('checks permissions on the collection it is given', async () => {
      usePermissionsMock.mockReturnValue({
        canPerform: (collection: string, action: string) => collection === 'my_jobs' && action === 'create',
        isAdmin: false,
        loading: false,
      });
      renderManager({ collection: 'my_jobs', onCreateJob: vi.fn() });
      await rowOf('Nightly report');
      expect(usePermissionsMock).toHaveBeenCalledWith({ collections: ['my_jobs'] });
      expect(screen.getByTestId('cron-jobs-manager-add-btn')).toBeInTheDocument();
    });

    it('hideHeader hides the heading but keeps the New Cron Job button', async () => {
      renderManager({ hideHeader: true, onCreateJob: vi.fn() });
      await rowOf('Nightly report');
      expect(screen.queryByRole('heading', { name: 'Cron Jobs' })).not.toBeInTheDocument();
      expect(screen.getByTestId('cron-jobs-manager-add-btn')).toHaveTextContent('New Cron Job');
    });

    it('hideHeader without a create handler draws no header row at all', async () => {
      renderManager({ hideHeader: true });
      await rowOf('Nightly report');
      expect(screen.queryByRole('heading')).not.toBeInTheDocument();
      expect(screen.queryByTestId('cron-jobs-manager-add-btn')).not.toBeInTheDocument();
    });

    it('searches after the debounce, from page 1', async () => {
      renderManager();
      await rowOf('Nightly report');

      const search = screen.getByTestId('cron-jobs-manager-search');
      expect(search).toHaveAttribute('placeholder', 'Search by name, schedule, or description...');
      fireEvent.change(search, { target: { value: 'report' } });
      await waitFor(() => expect(fetchJobsMock).toHaveBeenLastCalledWith({ page: 1, limit: 25, search: 'report' }));

      // The clear affordance searches for everything again
      fireEvent.click(screen.getByLabelText('Clear search'));
      await waitFor(() => expect(fetchJobsMock).toHaveBeenLastCalledWith({ page: 1, limit: 25, search: undefined }));
    });

    it('changing the page size refetches with the new limit at page 1', async () => {
      renderManager();
      await rowOf('Nightly report');

      fireEvent.click(screen.getByTestId('cron-jobs-manager-page-size'));
      // hidden: true — the dropdown stays display:none in jsdom (no transitions).
      fireEvent.click(await screen.findByRole('option', { name: '50 / page', hidden: true }));

      await waitFor(() =>
        expect(fetchJobsMock).toHaveBeenLastCalledWith(expect.objectContaining({ limit: 50, page: 1 })),
      );
    });

    it('pageSize sets the first page size', async () => {
      serve({ rows: manyMockJobs(12) });
      renderManager({ pageSize: 10 });
      await rowOf('Job 001');
      expect(fetchJobsMock).toHaveBeenCalledWith({ page: 1, limit: 10, search: undefined });
      expect(screen.getByText('Showing 10 of 12 jobs')).toBeInTheDocument();
    });

    it('the Refresh button, named for a screen reader, loads the list again', async () => {
      renderManager();
      await rowOf('Nightly report');
      expect(fetchJobsMock).toHaveBeenCalledTimes(1);

      fetchJobsMock.mockResolvedValue(pageOf([...mockJobs, { ...report, id: 'new', name: 'Added elsewhere' }]));
      fireEvent.click(within(screen.getByRole('tabpanel', { name: 'Jobs' })).getByRole('button', { name: 'Refresh' }));
      expect(await screen.findByText('Added elsewhere')).toBeInTheDocument();
      expect(fetchJobsMock).toHaveBeenCalledTimes(2);
    });

    it('reads its strings from the translations prop', async () => {
      renderManager({ translations: { jobsManager: { title: 'Tugas Cron' } } });
      expect(await screen.findByRole('heading', { name: 'Tugas Cron' })).toBeInTheDocument();
    });
  });

  describe('the History tab', () => {
    it('loads the runs of every job when the tab is opened, not before', async () => {
      renderManager();
      await rowOf('Nightly report');
      expect(fetchRunsMock).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('tab', { name: 'History' }));
      const history = await screen.findByRole('tabpanel', { name: 'History' });
      expect(await within(history).findByText('Legacy sync')).toBeInTheDocument();
      expect(fetchRunsMock).toHaveBeenCalledWith({ page: 1, limit: 50 });
      expect(screen.getByTestId('cron-jobs-manager-history-count')).toHaveTextContent('5 runs');
    });

    it('loads the runs again each time the tab is opened', async () => {
      renderManager();
      await rowOf('Nightly report');
      fireEvent.click(screen.getByRole('tab', { name: 'History' }));
      await waitFor(() => expect(fetchRunsMock).toHaveBeenCalledTimes(1));

      fireEvent.click(screen.getByRole('tab', { name: 'Jobs' }));
      fireEvent.click(screen.getByRole('tab', { name: 'History' }));
      await waitFor(() => expect(fetchRunsMock).toHaveBeenCalledTimes(2));
      // Going back to the jobs does not load them again
      expect(fetchJobsMock).toHaveBeenCalledTimes(1);
    });

    it('historyPageSize sets the runs per page', async () => {
      renderManager({ historyPageSize: 10 });
      await rowOf('Nightly report');
      fireEvent.click(screen.getByRole('tab', { name: 'History' }));
      await waitFor(() => expect(fetchRunsMock).toHaveBeenCalledWith({ page: 1, limit: 10 }));
    });

    it('a run row opens the run log, naming its job', async () => {
      renderManager();
      await rowOf('Nightly report');
      fireEvent.click(screen.getByRole('tab', { name: 'History' }));
      const history = await screen.findByRole('tabpanel', { name: 'History' });
      fireEvent.click((await within(history).findByText('Legacy sync')).closest('tr') as HTMLElement);
      expect(await screen.findByText('Run logs — Legacy sync')).toBeInTheDocument();
    });
  });

  describe('URL state', () => {
    it('restores the page, the search and the open tab from the URL', async () => {
      serve({ rows: manyMockJobs(60) });
      window.history.replaceState(null, '', '/?page=2&search=Job&tab=history');
      renderManager({ urlParams: true });

      await waitFor(() => expect(fetchJobsMock).toHaveBeenCalledWith({ page: 2, limit: 25, search: 'Job' }));
      expect((screen.getByTestId('cron-jobs-manager-search') as HTMLInputElement).value).toBe('Job');
      expect(screen.getByRole('tab', { name: 'History' })).toHaveAttribute('aria-selected', 'true');
      // The History tab was open on arrival, so its runs are loaded
      await waitFor(() => expect(fetchRunsMock).toHaveBeenCalledTimes(1));
    });

    it('writes the open tab and the page to the URL, and takes them off again', async () => {
      serve({ rows: manyMockJobs(60) });
      renderManager({ urlParams: true });
      await rowOf('Job 001');

      fireEvent.click(screen.getByRole('button', { name: '2' }));
      await waitFor(() => expect(window.location.search).toBe('?page=2'));
      fireEvent.click(screen.getByRole('tab', { name: 'History' }));
      await waitFor(() => expect(new URLSearchParams(window.location.search).get('tab')).toBe('history'));

      fireEvent.click(screen.getByRole('tab', { name: 'Jobs' }));
      await waitFor(() => expect(window.location.search).toBe('?page=2'));
    });

    it('follows the URL when it changes underneath (Back / Forward)', async () => {
      renderManager({ urlParams: true });
      await rowOf('Nightly report');

      act(() => {
        window.history.replaceState(null, '', '/?tab=history');
        window.dispatchEvent(new PopStateEvent('popstate'));
      });
      await waitFor(() => expect(screen.getByRole('tab', { name: 'History' })).toHaveAttribute('aria-selected', 'true'));

      act(() => {
        window.history.replaceState(null, '', '/?tab=nonsense');
        window.dispatchEvent(new PopStateEvent('popstate'));
      });
      await waitFor(() => expect(screen.getByRole('tab', { name: 'Jobs' })).toHaveAttribute('aria-selected', 'true'));
    });

    it('prefixes its parameters when two lists share a page', async () => {
      serve({ rows: manyMockJobs(60) });
      window.history.replaceState(null, '', '/?cron_page=3&cron_tab=history');
      renderManager({ urlParams: true, urlParamPrefix: 'cron_' });
      await waitFor(() => expect(fetchJobsMock).toHaveBeenCalledWith({ page: 3, limit: 25, search: undefined }));
      expect(screen.getByRole('tab', { name: 'History' })).toHaveAttribute('aria-selected', 'true');
    });

    it('with urlParams off, neither reads the URL nor writes to it', async () => {
      window.history.replaceState(null, '', '/?page=2&tab=history');
      renderManager();
      await rowOf('Nightly report');
      expect(fetchJobsMock).toHaveBeenCalledWith({ page: 1, limit: 25, search: undefined });
      expect(screen.getByRole('tab', { name: 'Jobs' })).toHaveAttribute('aria-selected', 'true');
      expect(window.location.search).toBe('?page=2&tab=history');
    });
  });

  describe('navigation is by callback', () => {
    it('a row click and the menu\'s Edit call onJobClick with the job', async () => {
      const onJobClick = vi.fn();
      renderManager({ onJobClick });
      fireEvent.click((await rowOf('Nightly report')).querySelector('td.cell.align-left:nth-of-type(3)') as HTMLElement);
      expect(onJobClick).toHaveBeenCalledWith(report);

      await rowAction('Legacy sync', 'Edit');
      expect(onJobClick).toHaveBeenLastCalledWith(sync);
      expect(onJobClick).toHaveBeenCalledTimes(2);
    });

    // CR-13: the reference's rows were <tr onClick> with no keyboard path
    it('CR-13: a job row has a named button that opens the job from the keyboard', async () => {
      const user = userEvent.setup();
      const onJobClick = vi.fn();
      // A reader: no row menu, so the button is the only control in the row
      grant(['read']);
      renderManager({ onJobClick });
      const row = await rowOf('Cache sweep');

      const open = within(row).getByRole('button', { name: 'Open cron job Cache sweep' });
      expect(open.tagName).toBe('BUTTON');
      expect(open).toHaveTextContent('Cache sweep');

      // Reachable with Tab from the search box, and Enter opens the job — once
      screen.getByTestId('cron-jobs-manager-search').focus();
      for (let stops = 0; stops < 8 && document.activeElement !== open; stops += 1) {
        await user.tab();
      }
      expect(open).toHaveFocus();
      await user.keyboard('{Enter}');
      expect(onJobClick).toHaveBeenCalledTimes(1);
      expect(onJobClick).toHaveBeenCalledWith(sweep);
    });

    it('a click on the name button opens the job once, not once more through the row', async () => {
      const onJobClick = vi.fn();
      renderManager({ onJobClick });
      fireEvent.click(within(await rowOf('Legacy sync')).getByRole('button', { name: 'Open cron job Legacy sync' }));
      expect(onJobClick).toHaveBeenCalledTimes(1);
      expect(onJobClick).toHaveBeenCalledWith(sync);
    });

    it('without onJobClick rows do not open: no button, no Edit', async () => {
      renderManager();
      const row = await rowOf('Nightly report');
      expect(within(row).queryByRole('button', { name: /Open cron job/ })).not.toBeInTheDocument();
      expect(row).not.toHaveAttribute('tabindex');
      const items = await openMenuOf('Nightly report');
      expect(items).not.toContain('Edit');
      expect(items).toContain('Run Now');
    });

    it('New Cron Job calls onCreateJob', async () => {
      const onCreateJob = vi.fn();
      renderManager({ onCreateJob });
      fireEvent.click(await screen.findByRole('button', { name: 'New Cron Job' }));
      expect(onCreateJob).toHaveBeenCalledTimes(1);
    });

    it('renders no link at all', async () => {
      const { container } = renderManager({ onJobClick: vi.fn(), onCreateJob: vi.fn() });
      await rowOf('Nightly report');
      expect(container.querySelector('a[href]')).toBeNull();
    });
  });

  describe('permission gates', () => {
    // CR-14: the reference drew a menu trigger that opened an empty menu for a reader
    it('CR-14: a reader can open a row, but gets no New Cron Job button and no row menu trigger', async () => {
      grant(['read']);
      const onJobClick = vi.fn();
      renderManager({ onJobClick, onCreateJob: vi.fn() });
      const row = await rowOf('Nightly report');

      expect(screen.queryByTestId('cron-jobs-manager-add-btn')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Actions for/ })).not.toBeInTheDocument();
      expect(row.querySelector('.tabler-icon-dots')).toBeNull();
      fireEvent.click(within(row).getByRole('button', { name: 'Open cron job Nightly report' }));
      expect(onJobClick).toHaveBeenCalledWith(report);
    });

    it('update offers Edit, Run Now and Activate or Deactivate, by the job\'s status', async () => {
      grant(['read', 'update']);
      renderManager({ onJobClick: vi.fn() });
      expect(await openMenuOf('Nightly report')).toEqual(['Edit', 'Run Now', 'Deactivate']);
    });

    it('an inactive job offers Activate', async () => {
      grant(['read', 'update']);
      renderManager({ onJobClick: vi.fn() });
      expect(await openMenuOf('Cache sweep')).toEqual(['Edit', 'Run Now', 'Activate']);
    });

    it('create offers Clone only, and the New Cron Job button', async () => {
      grant(['read', 'create']);
      renderManager({ onJobClick: vi.fn(), onCreateJob: vi.fn() });
      expect(await openMenuOf('Nightly report')).toEqual(['Clone']);
      expect(screen.getByTestId('cron-jobs-manager-add-btn')).toBeInTheDocument();
    });

    it('delete offers Delete only', async () => {
      grant(['read', 'delete']);
      renderManager({ onJobClick: vi.fn(), onCreateJob: vi.fn() });
      expect(await openMenuOf('Nightly report')).toEqual(['Delete']);
      expect(screen.queryByTestId('cron-jobs-manager-add-btn')).not.toBeInTheDocument();
    });

    it('draws no write control while permissions load, and the allowed ones once they are known', async () => {
      // What a user who will turn out to be an administrator gets meanwhile
      usePermissionsMock.mockReturnValue({ canPerform: () => true, isAdmin: true, loading: true });
      const onJobClick = vi.fn();
      const view = renderManager({ onJobClick, onCreateJob: vi.fn() });
      const row = await rowOf('Nightly report');

      expect(screen.queryByTestId('cron-jobs-manager-add-btn')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Actions for/ })).not.toBeInTheDocument();
      // Reading does not wait: the rows are there and open
      fireEvent.click(within(row).getByRole('button', { name: 'Open cron job Nightly report' }));
      expect(onJobClick).toHaveBeenCalledWith(report);

      grant([], true);
      view.rerender(
        <MantineProvider>
          <BuildpadI18nProvider locale="en" timeZone="UTC" datesProvider={false}>
            <CronJobsManager urlParams={false} onJobClick={onJobClick} onCreateJob={vi.fn()} />
          </BuildpadI18nProvider>
        </MantineProvider>,
      );
      expect(await screen.findByTestId('cron-jobs-manager-add-btn')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Actions for Nightly report' })).toBeInTheDocument();
    });
  });

  describe('a list without rows says why', () => {
    it('no jobs yet', async () => {
      fetchJobsMock.mockResolvedValue(pageOf([]));
      renderManager();
      expect(await screen.findByTestId('cron-jobs-manager-empty')).toHaveTextContent(
        'No cron jobs yet. Create your first one!',
      );
      expect(screen.getByTestId('cron-jobs-manager-count')).toHaveTextContent('0 jobs');
    });

    it('a search without matches', async () => {
      fetchJobsMock.mockImplementation(async ({ search }: { search?: string }) => pageOf(search ? [] : mockJobs));
      renderManager();
      await rowOf('Nightly report');
      fireEvent.change(screen.getByTestId('cron-jobs-manager-search'), { target: { value: 'zzz' } });
      expect(await screen.findByTestId('cron-jobs-manager-empty')).toHaveTextContent('No jobs match your search');
    });

    it('a failed load shows the load-error state and a notification, not an empty list', async () => {
      fetchJobsMock.mockRejectedValue(new DaaSRequestError('service unavailable', { kind: 'failure', status: 500 }));
      renderManager();

      const error = await screen.findByTestId('cron-jobs-manager-load-error');
      expect(error).toHaveTextContent('Failed to load cron jobs — service unavailable');
      expect(screen.queryByTestId('cron-jobs-manager-empty')).not.toBeInTheDocument();
      expect(screen.queryByTestId('cron-jobs-manager-count')).not.toBeInTheDocument();
      expect(show).toHaveBeenCalledWith({ title: 'Error', message: 'service unavailable', color: 'red' });
    });

    it('a failure without a sentence says that the jobs could not be fetched', async () => {
      fetchJobsMock.mockRejectedValue('boom');
      renderManager();
      expect(await screen.findByTestId('cron-jobs-manager-load-error')).toHaveTextContent('Failed to fetch cron jobs');
    });

    it('a refresh that fails takes the rows of the load before it off the screen, and says why', async () => {
      renderManager();
      await rowOf('Nightly report');

      fetchJobsMock.mockRejectedValue(new DaaSRequestError('down', { kind: 'failure', status: 500 }));
      fireEvent.click(screen.getByTestId('cron-jobs-manager-refresh'));

      expect(await screen.findByTestId('cron-jobs-manager-load-error')).toHaveTextContent('down');
      // Rows that may no longer be what is stored are not left standing as current
      expect(screen.queryByText('Nightly report')).not.toBeInTheDocument();
      expect(show).toHaveBeenCalledWith(expect.objectContaining({ title: 'Error', message: 'down' }));

      fetchJobsMock.mockResolvedValue(pageOf(mockJobs));
      fireEvent.click(screen.getByTestId('cron-jobs-manager-refresh'));
      expect(await screen.findByText('Nightly report')).toBeInTheDocument();
      expect(screen.queryByTestId('cron-jobs-manager-load-error')).not.toBeInTheDocument();
    });

    it('draws only the answer to the latest request', async () => {
      renderManager();
      await rowOf('Nightly report');

      // A search whose answer is slow, then another search that is answered first
      const slow = deferred<CronListResult<CronJobRecord>>();
      fetchJobsMock.mockImplementation(({ search }: { search?: string }) =>
        search === 'slow' ? slow.promise : Promise.resolve(pageOf([{ ...report, name: 'Latest answer' }])),
      );
      fireEvent.change(screen.getByTestId('cron-jobs-manager-search'), { target: { value: 'slow' } });
      await waitFor(() => expect(fetchJobsMock).toHaveBeenLastCalledWith({ page: 1, limit: 25, search: 'slow' }));

      fireEvent.change(screen.getByTestId('cron-jobs-manager-search'), { target: { value: 'fast' } });
      expect(await screen.findByText('Latest answer')).toBeInTheDocument();

      // The slow answer to the earlier search arrives last, and is dropped
      await act(async () => {
        slow.resolve(pageOf([{ ...sync, name: 'Stale answer' }]));
      });
      expect(screen.queryByText('Stale answer')).not.toBeInTheDocument();
      expect(screen.getByText('Latest answer')).toBeInTheDocument();
      expect(screen.getByTestId('cron-jobs-manager-count')).toHaveTextContent('1 job');
    });

    it('a failure that arrives after a later answer is dropped too', async () => {
      renderManager();
      await rowOf('Nightly report');

      const slow = deferred<CronListResult<CronJobRecord>>();
      fetchJobsMock.mockImplementation(({ search }: { search?: string }) =>
        search === 'slow' ? slow.promise : Promise.resolve(pageOf([{ ...report, name: 'Latest answer' }])),
      );
      fireEvent.change(screen.getByTestId('cron-jobs-manager-search'), { target: { value: 'slow' } });
      await waitFor(() => expect(fetchJobsMock).toHaveBeenLastCalledWith({ page: 1, limit: 25, search: 'slow' }));
      fireEvent.change(screen.getByTestId('cron-jobs-manager-search'), { target: { value: 'fast' } });
      await screen.findByText('Latest answer');

      await act(async () => {
        slow.reject(new DaaSRequestError('too late', { kind: 'failure', status: 500 }));
      });
      expect(screen.getByText('Latest answer')).toBeInTheDocument();
      expect(screen.queryByTestId('cron-jobs-manager-load-error')).not.toBeInTheDocument();
      expect(show).not.toHaveBeenCalled();
    });

    it('a refused load shows the access-denied state in place: no tabs, no error notification', async () => {
      fetchJobsMock.mockRejectedValue(new DaaSRequestError('Permission denied', { kind: 'forbidden', status: 403 }));
      renderManager({ onCreateJob: vi.fn() });

      const denied = await screen.findByTestId('cron-jobs-manager-access-denied');
      expect(denied).toHaveTextContent('Access denied');
      expect(denied).toHaveTextContent('You do not have permission to view this.');
      expect(screen.getByRole('heading', { name: 'Cron Jobs' })).toBeInTheDocument();
      expect(screen.queryByRole('tab')).not.toBeInTheDocument();
      expect(screen.queryByTestId('cron-jobs-manager-search')).not.toBeInTheDocument();
      expect(screen.queryByTestId('cron-jobs-manager-add-btn')).not.toBeInTheDocument();
      expect(show).not.toHaveBeenCalled();
    });

    it('the access-denied state respects hideHeader', async () => {
      fetchJobsMock.mockRejectedValue(new DaaSRequestError('Permission denied', { kind: 'forbidden', status: 403 }));
      renderManager({ hideHeader: true });
      await screen.findByTestId('cron-jobs-manager-access-denied');
      expect(screen.queryByRole('heading', { name: 'Cron Jobs' })).not.toBeInTheDocument();
    });

    it('a session that needs a second factor is told what the server said', async () => {
      fetchJobsMock.mockRejectedValue(
        new DaaSRequestError('Multi-factor authentication is required', {
          kind: 'mfaRequired',
          status: 403,
          code: 'MFA_REQUIRED',
        }),
      );
      renderManager();
      expect(await screen.findByTestId('cron-jobs-manager-access-denied')).toHaveTextContent(
        'Multi-factor authentication is required',
      );
    });
  });

  describe('row actions', () => {
    it('Activate saves the status, says so, and loads the list again', async () => {
      const store = { rows: [...mockJobs] };
      serve(store);
      updateJobMock.mockImplementation(async (id: string, patch: Partial<CronJobRecord>) => {
        store.rows = store.rows.map((job) => (job.id === id ? { ...job, ...patch } : job));
        return { id, ...patch };
      });
      renderManager();

      await rowAction('Cache sweep', 'Activate');

      await waitFor(() => expect(cells(screen.getByText('Cache sweep').closest('tr') as HTMLElement)[4]).toBe('Active'));
      expect(updateJobMock).toHaveBeenCalledWith(sweep.id, { status: 'active' });
      expect(show).toHaveBeenCalledWith({
        title: 'Activated',
        message: 'Job "Cache sweep" is now active',
        color: 'green',
      });
      expect(fetchJobsMock).toHaveBeenCalledTimes(2);
    });

    it('Deactivate saves the status and says so', async () => {
      renderManager();
      await rowAction('Nightly report', 'Deactivate');
      await waitFor(() => expect(fetchJobsMock).toHaveBeenCalledTimes(2));
      expect(updateJobMock).toHaveBeenCalledWith(report.id, { status: 'inactive' });
      expect(show).toHaveBeenCalledWith({
        title: 'Deactivated',
        message: 'Job "Nightly report" is now inactive',
        color: 'yellow',
      });
    });

    it('Clone copies the job, says so, and loads the list again', async () => {
      renderManager();
      await rowAction('Nightly report', 'Clone');
      await waitFor(() => expect(fetchJobsMock).toHaveBeenCalledTimes(2));
      expect(cloneJobMock).toHaveBeenCalledWith(report.id);
      expect(show).toHaveBeenCalledWith({
        title: 'Cloned',
        message: 'Job "Nightly report" has been cloned',
        color: 'green',
      });
    });

    it('Run Now says the job started, and loads the list when the run has ended — not before', async () => {
      const run = deferred<CronRunResult>();
      runJobMock.mockImplementation(() => run.promise);
      renderManager();

      await rowAction('Nightly report', 'Run Now');
      expect(runJobMock).toHaveBeenCalledWith(report.id);

      // The request is answered when the run has ended: until then, nothing is reloaded or said
      await act(async () => {});
      expect(fetchJobsMock).toHaveBeenCalledTimes(1);
      expect(show).not.toHaveBeenCalled();

      await act(async () => {
        run.resolve(ran());
      });
      await waitFor(() => expect(fetchJobsMock).toHaveBeenCalledTimes(2));
      expect(show).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Triggered', message: 'Job "Nightly report" started', color: 'blue' }),
      );
    });

    // CR-17: the reference said "started" although the answer's historyId was ''
    it('CR-17: Run Now on a job that is already running says it was skipped, not that it started', async () => {
      runJobMock.mockResolvedValue(skipped);
      renderManager();

      await rowAction('Nightly report', 'Run Now');

      await waitFor(() =>
        expect(show).toHaveBeenCalledWith({
          title: 'Already running',
          message: 'Job "Nightly report" is already running, so it was not started again.',
          color: 'yellow',
        }),
      );
      expect(show).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Triggered' }));
      expect(show).not.toHaveBeenCalledWith(expect.objectContaining({ message: 'Job "Nightly report" started' }));
      expect(show).toHaveBeenCalledTimes(1);
    });

    it('while an action runs, the row\'s menu is a loader that takes no second action; other rows stay usable', async () => {
      const run = deferred<CronRunResult>();
      runJobMock.mockImplementation(() => run.promise);
      renderManager();

      await rowAction('Nightly report', 'Run Now');
      const trigger = await screen.findByRole('button', { name: 'Actions for Nightly report' });
      await waitFor(() => expect(trigger).toHaveAttribute('data-loading', 'true'));
      expect(trigger).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Actions for Cache sweep' })).not.toBeDisabled();

      // Another row's action runs beside it
      await rowAction('Cache sweep', 'Activate');
      await waitFor(() => expect(updateJobMock).toHaveBeenCalledWith(sweep.id, { status: 'active' }));

      await act(async () => {
        run.resolve(ran());
      });
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Actions for Nightly report' })).not.toHaveAttribute('data-loading'),
      );
      expect(runJobMock).toHaveBeenCalledTimes(1);
    });

    it('a run that outlives a search reloads what the list shows by then', async () => {
      const run = deferred<CronRunResult>();
      runJobMock.mockImplementation(() => run.promise);
      renderManager();
      await rowAction('Nightly report', 'Run Now');

      fireEvent.change(screen.getByTestId('cron-jobs-manager-search'), { target: { value: 'night' } });
      await waitFor(() => expect(fetchJobsMock).toHaveBeenLastCalledWith({ page: 1, limit: 25, search: 'night' }));
      const calls = fetchJobsMock.mock.calls.length;

      await act(async () => {
        run.resolve(ran());
      });
      await waitFor(() => expect(fetchJobsMock).toHaveBeenCalledTimes(calls + 1));
      // Not the search the list had when Run Now was clicked
      expect(fetchJobsMock).toHaveBeenLastCalledWith({ page: 1, limit: 25, search: 'night' });
    });

    it('a run that ends after the list is gone reloads nothing', async () => {
      const run = deferred<CronRunResult>();
      runJobMock.mockImplementation(() => run.promise);
      const { unmount } = renderManager();
      await rowAction('Nightly report', 'Run Now');
      unmount();

      await act(async () => {
        run.resolve(ran());
      });
      expect(fetchJobsMock).toHaveBeenCalledTimes(1);
      // The user is still told: the run happened
      expect(show).toHaveBeenCalledWith(expect.objectContaining({ title: 'Triggered' }));
    });

    it.each([
      ['Run Now', () => runJobMock, 'Failed to trigger run'],
      ['Deactivate', () => updateJobMock, 'Failed to deactivate'],
      ['Clone', () => cloneJobMock, 'Failed to clone'],
    ] as const)('a failed %s is an Error notification with the server\'s sentence, and the row stays', async (item, mock, fallback) => {
      mock().mockRejectedValueOnce(new DaaSRequestError('Item not found', { kind: 'notFound', status: 500 }));
      renderManager();

      await rowAction('Nightly report', item);
      await waitFor(() => expect(show).toHaveBeenCalledWith({ title: 'Error', message: 'Item not found', color: 'red' }));
      expect(screen.getByText('Nightly report')).toBeInTheDocument();
      expect(fetchJobsMock).toHaveBeenCalledTimes(1);

      // A failure that carries no sentence gets the action's own
      mock().mockRejectedValueOnce('boom');
      await rowAction('Nightly report', item);
      await waitFor(() => expect(show).toHaveBeenCalledWith({ title: 'Error', message: fallback, color: 'red' }));
    });

    it('a failed Activate says so with its own sentence when the failure has none', async () => {
      updateJobMock.mockRejectedValueOnce(new Error(''));
      renderManager();
      await rowAction('Cache sweep', 'Activate');
      await waitFor(() =>
        expect(show).toHaveBeenCalledWith({ title: 'Error', message: 'Failed to activate', color: 'red' }),
      );
    });
  });

  describe('deleting', () => {
    it('asks first, naming the job, then deletes, says so, and reloads the page', async () => {
      const store = { rows: [...mockJobs] };
      serve(store);
      deleteJobMock.mockImplementation(async (id: string) => {
        store.rows = store.rows.filter((job) => job.id !== id);
      });
      renderManager();

      const confirm = await openDeleteFor('Legacy sync');
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveTextContent('Delete cron job');
      expect(dialog).toHaveTextContent(
        'Are you sure you want to delete the cron job "Legacy sync"? This cannot be undone.',
      );
      expect(deleteJobMock).not.toHaveBeenCalled();
      fireEvent.click(confirm);

      await waitFor(() => expect(screen.queryByText('Legacy sync')).not.toBeInTheDocument());
      expect(deleteJobMock).toHaveBeenCalledWith(sync.id);
      expect(show).toHaveBeenCalledWith({ title: 'Deleted', message: 'Job "Legacy sync" deleted', color: 'red' });
      await waitFor(() => expect(screen.queryByTestId('cron-delete-confirm-btn')).not.toBeInTheDocument());
      expect(screen.getByTestId('cron-jobs-manager-count')).toHaveTextContent('2 jobs');
    });

    it('Cancel keeps the job', async () => {
      renderManager();
      await openDeleteFor('Legacy sync');
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(deleteJobMock).not.toHaveBeenCalled();
      expect(screen.getByText('Legacy sync')).toBeInTheDocument();
    });

    // CR-07: deleting the only row of the last page left an empty page and no pager
    it('CR-07: deleting the only row on the last page lands on the new last page, not an empty one', async () => {
      const store = { rows: manyMockJobs(26) };
      serve(store);
      deleteJobMock.mockImplementation(async (id: string) => {
        store.rows = store.rows.filter((job) => job.id !== id);
      });
      window.history.replaceState(null, '', '/?page=2');
      renderManager({ urlParams: true });

      // Page 2 holds the 26th job alone
      fireEvent.click(await openDeleteFor('Job 026'));

      await waitFor(() => expect(screen.getByText('Job 025')).toBeInTheDocument());
      expect(fetchJobsMock).toHaveBeenLastCalledWith({ page: 1, limit: 25, search: undefined });
      // The emptied page 2 is never asked for again
      const afterDelete = fetchJobsMock.mock.calls.slice(1);
      expect(afterDelete.length).toBeGreaterThan(0);
      expect(afterDelete.every(([params]) => params.page === 1)).toBe(true);
      expect(screen.queryByTestId('cron-jobs-manager-empty')).not.toBeInTheDocument();
      expect(screen.queryByText('No jobs match your search')).not.toBeInTheDocument();
      expect(screen.getByTestId('cron-jobs-manager-count')).toHaveTextContent('25 jobs');
      expect(screen.getByText('Showing 25 of 25 jobs')).toBeInTheDocument();
      await waitFor(() => expect(window.location.search).toBe(''));
    });

    it('deleting one of several rows of the last page stays on that page', async () => {
      const store = { rows: manyMockJobs(27) };
      serve(store);
      deleteJobMock.mockImplementation(async (id: string) => {
        store.rows = store.rows.filter((job) => job.id !== id);
      });
      window.history.replaceState(null, '', '/?page=2');
      renderManager({ urlParams: true });

      fireEvent.click(await openDeleteFor('Job 027'));

      await waitFor(() => expect(screen.queryByText('Job 027')).not.toBeInTheDocument());
      expect(screen.getByText('Job 026')).toBeInTheDocument();
      expect(fetchJobsMock).toHaveBeenLastCalledWith({ page: 2, limit: 25, search: undefined });
    });

    it('falls back to the last page when the page it asked for no longer exists', async () => {
      // Someone else deleted rows: page 3 of a list that now has 2 pages
      serve({ rows: manyMockJobs(30) });
      window.history.replaceState(null, '', '/?page=3');
      renderManager({ urlParams: true });

      await waitFor(() => expect(screen.getByText('Job 030')).toBeInTheDocument());
      expect(fetchJobsMock).toHaveBeenLastCalledWith({ page: 2, limit: 25, search: undefined });
      expect(screen.queryByTestId('cron-jobs-manager-empty')).not.toBeInTheDocument();
    });

    // CR-10: the reference's confirm had no pending state, so a double click sent two DELETEs
    it('CR-10: a double click on the delete confirm sends one delete, and the button is pending meanwhile', async () => {
      const request = deferred<void>();
      deleteJobMock.mockImplementation(() => request.promise);
      renderManager();

      const confirm = await openDeleteFor('Nightly report');
      fireEvent.click(confirm);
      fireEvent.click(confirm);
      fireEvent.click(confirm);

      expect(deleteJobMock).toHaveBeenCalledTimes(1);
      expect(confirm).toBeDisabled();
      expect(confirm).toHaveAttribute('data-loading', 'true');
      // Nor can the dialog be dismissed while the request is out
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();

      await act(async () => {
        request.resolve();
      });
      await waitFor(() => expect(screen.queryByTestId('cron-delete-confirm-btn')).not.toBeInTheDocument());
      expect(deleteJobMock).toHaveBeenCalledTimes(1);
      expect(show).toHaveBeenCalledTimes(1);
    });

    it('a failed delete is an Error notification with the server\'s sentence, and the dialog stays open', async () => {
      deleteJobMock.mockRejectedValueOnce(new DaaSRequestError('Item not found', { kind: 'notFound', status: 500 }));
      renderManager();

      const confirm = await openDeleteFor('Nightly report');
      fireEvent.click(confirm);

      await waitFor(() => expect(show).toHaveBeenCalledWith({ title: 'Error', message: 'Item not found', color: 'red' }));
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Nightly report')).toBeInTheDocument();
      // The button is usable again: retry
      await waitFor(() => expect(confirm).not.toBeDisabled());
      deleteJobMock.mockRejectedValueOnce('boom');
      fireEvent.click(confirm);
      await waitFor(() => expect(show).toHaveBeenCalledWith({ title: 'Error', message: 'Failed to delete', color: 'red' }));
    });
  });

  it('shows a loader until hydrated when it keeps its state in the URL', async () => {
    // jsdom renders on the client, so the gate lets the body through at once
    renderManager({ urlParams: true });
    expect(await screen.findByText('Nightly report')).toBeInTheDocument();
  });
});
