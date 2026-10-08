/**
 * CronRunsTable unit tests: the history of every job and of one, the three
 * reasons a history can have no rows (none, refused, failed), the pager, the
 * refresh, and opening a run's log. `@buildpad/hooks` is mocked.
 */
import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BuildpadI18nProvider } from '@buildpad/services';
import type { CronRunListResult, CronRunRecord } from '@buildpad/types';
import { DaaSRequestError } from '../../hooks/src/daasRequest';
import { CronRunsTable } from '../src/CronRunsTable';
import { JOB_REPORT_ID, manyMockRuns, mockRuns } from '../src/_fixtures';

const { fetchRunsMock, fetchJobRunsMock } = vi.hoisted(() => ({
  fetchRunsMock: vi.fn(),
  fetchJobRunsMock: vi.fn(),
}));

vi.mock('@buildpad/hooks', async () => {
  // The URL helpers and the typed error are used as they are, so the table's
  // error branches are exercised, not stubbed.
  const url = await import('../../hooks/src/useUrlListParams');
  const request = await import('../../hooks/src/daasRequest');
  return {
    useUrlListParams: url.useUrlListParams,
    readUrlParam: url.readUrlParam,
    readUrlIntParam: url.readUrlIntParam,
    DaaSRequestError: request.DaaSRequestError,
    useCronRuns: () => ({ fetchRuns: fetchRunsMock, fetchJobRuns: fetchJobRunsMock }),
  };
});

/** One page of `all`, as the hook answers it. */
function pageOf(
  all: CronRunRecord[],
  { page = 1, limit = 50 }: { page?: number; limit?: number } = {},
): CronRunListResult {
  return {
    items: all.slice((page - 1) * limit, page * limit),
    total: all.length,
    totalPages: Math.max(1, Math.ceil(all.length / limit)),
    page,
    limit,
    offset: (page - 1) * limit,
  };
}

function renderTable(props: Partial<React.ComponentProps<typeof CronRunsTable>> = {}) {
  const tree = (current: Partial<React.ComponentProps<typeof CronRunsTable>>) => (
    <MantineProvider>
      {/* A pinned locale and zone, so dates read the same on every machine */}
      <BuildpadI18nProvider locale="en" timeZone="UTC" datesProvider={false}>
        <CronRunsTable {...current} />
      </BuildpadI18nProvider>
    </MantineProvider>
  );
  const view = render(tree(props));
  return { ...view, update: (next: Partial<React.ComponentProps<typeof CronRunsTable>>) => view.rerender(tree(next)) };
}

/** The text of a row's cells, without the hidden spacer and the View logs cell. */
function cells(row: HTMLElement): string[] {
  return Array.from(row.querySelectorAll('td:not(.spacer):not(.append)')).map((cell) => cell.textContent ?? '');
}

/** The table's card: toolbar, table and footer. */
const card = () => screen.getByTestId('cron-runs-table');

function rows(): HTMLElement[] {
  return Array.from(card().querySelectorAll<HTMLElement>('tbody tr.table-row'));
}

/** The column headers that have a text (the icon column and the View logs column have none). */
function columnHeaders(): string[] {
  return Array.from(card().querySelectorAll('thead th'))
    .map((th) => th.textContent ?? '')
    .filter(Boolean);
}

let show: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  fetchRunsMock.mockReset().mockResolvedValue(pageOf(mockRuns));
  fetchJobRunsMock.mockReset().mockImplementation(async (jobId: string) =>
    pageOf(mockRuns.filter((run) => run.job_id === jobId)),
  );
  show = vi.spyOn(notifications, 'show').mockImplementation(() => '');
});

afterEach(() => {
  show.mockRestore();
});

describe('CronRunsTable', () => {
  describe('the history of every job', () => {
    it('lists the runs with their job, time, duration, outcome, trigger and output', async () => {
      renderTable();
      await screen.findByText('Legacy sync');

      expect(columnHeaders()).toEqual(['Job', 'Triggered', 'Duration (ms)', 'Status', 'By', 'Logs']);

      const [success, failed, timedOut, , running] = rows();
      // icon, job, triggered, duration, status, by, logs
      expect(cells(success).slice(1)).toEqual([
        'Nightly report',
        'Mar 2, 2026, 9:00:00 AM',
        '1,234',
        'Success',
        'manual',
        '2 lines',
      ]);
      // A run that failed shows its error where the line count would be
      expect(cells(failed).slice(1)).toEqual([
        'Legacy sync',
        'Mar 1, 2026, 7:30:00 PM',
        '86',
        'Error',
        'schedule',
        'The legacy system did not answer',
      ]);
      expect(cells(timedOut).slice(3)).toEqual(['10,000', 'Timeout', 'schedule', 'Cron job timed out after 10000ms']);
      // A run that is still going has no duration yet
      expect(cells(running).slice(3)).toEqual(['—', 'Running', 'manual', '0 lines']);

      expect(screen.getByTestId('cron-runs-table-count')).toHaveTextContent('5 runs');
      expect(fetchRunsMock).toHaveBeenCalledWith({ page: 1, limit: 50 });
      expect(fetchJobRunsMock).not.toHaveBeenCalled();
    });

    it('counts one run and one line in the singular', async () => {
      fetchRunsMock.mockResolvedValue(pageOf([{ ...mockRuns[0], logs: ['[2026-03-02T09:00:00.120Z] [INFO] one'] }]));
      renderTable();
      await waitFor(() => expect(screen.getByTestId('cron-runs-table-count')).toHaveTextContent('1 run'));
      expect(screen.getByTestId('cron-runs-table-count')).not.toHaveTextContent('runs');
      expect(cells(rows()[0]).at(-1)).toBe('1 line');
    });

    it('says so when no job has run yet', async () => {
      fetchRunsMock.mockResolvedValue(pageOf([]));
      renderTable();
      expect(await screen.findByTestId('cron-runs-table-empty')).toHaveTextContent('No execution history yet.');
      expect(screen.getByTestId('cron-runs-table-count')).toHaveTextContent('0 runs');
    });
  });

  describe('the history of one job', () => {
    it('asks for that job\'s runs, and has no Job column', async () => {
      renderTable({ jobId: JOB_REPORT_ID });
      await waitFor(() => expect(rows()).toHaveLength(3));

      expect(fetchJobRunsMock).toHaveBeenCalledWith(JOB_REPORT_ID, { page: 1, limit: 50 });
      expect(fetchRunsMock).not.toHaveBeenCalled();
      expect(columnHeaders()).toEqual(['Triggered', 'Duration (ms)', 'Status', 'By', 'Logs']);
      expect(cells(rows()[0])).toEqual(['Mar 2, 2026, 9:00:00 AM', '1,234', 'Success', 'manual', '2 lines']);
    });

    it('says how to get a first run when the job has none', async () => {
      fetchJobRunsMock.mockResolvedValue(pageOf([]));
      renderTable({ jobId: JOB_REPORT_ID });
      expect(await screen.findByTestId('cron-runs-table-empty')).toHaveTextContent(
        'No run history yet. Use “Run Now” to test the job.',
      );
    });

    // CR-19: the reference promised an expandable row "(future enhancement)" under a table whose rows already open the log
    it('CR-19: shows no "future enhancement" note under a history whose runs have logs', async () => {
      const { container } = renderTable({ jobId: JOB_REPORT_ID });
      await waitFor(() => expect(rows()).toHaveLength(3));
      // The condition the reference drew its note under: a run with console lines
      expect(mockRuns.some((run) => run.job_id === JOB_REPORT_ID && run.logs.length > 0)).toBe(true);
      expect(container.textContent).not.toMatch(/future enhancement/i);
      expect(container.textContent).not.toMatch(/Expand a row/i);
      expect(screen.queryByText(/console logs are stored per run/i)).not.toBeInTheDocument();
    });

    it('showJobColumn brings the Job column back', async () => {
      renderTable({ jobId: JOB_REPORT_ID, showJobColumn: true });
      await waitFor(() => expect(rows()).toHaveLength(3));
      expect(cells(rows()[0])[1]).toBe('Nightly report');
    });

    it('loads the runs of another job when the job changes', async () => {
      const { update } = renderTable({ jobId: JOB_REPORT_ID });
      await waitFor(() => expect(rows()).toHaveLength(3));
      update({ jobId: 'another-job' });
      await waitFor(() => expect(fetchJobRunsMock).toHaveBeenLastCalledWith('another-job', { page: 1, limit: 50 }));
    });
  });

  describe('the run log', () => {
    it('a row click opens the log of that run, naming its job', async () => {
      renderTable();
      await screen.findByText('Legacy sync');
      fireEvent.click(rows()[1]);

      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByText('Run logs — Legacy sync')).toBeInTheDocument();
      expect(screen.getByTestId('cron-run-log-error')).toHaveTextContent('The legacy system did not answer');

      fireEvent.click(dialog.querySelector('.mantine-Modal-close') as HTMLElement);
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('each row has a named View logs button, which opens the log once', async () => {
      renderTable();
      await screen.findByText('Legacy sync');
      const button = screen.getByRole('button', {
        name: 'View the logs of the run triggered Mar 2, 2026, 9:00:00 AM',
      });
      expect(rows()[0]).toContainElement(button);
      fireEvent.click(button);

      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByText('Run logs — Nightly report')).toBeInTheDocument();
      expect(screen.getAllByRole('dialog')).toHaveLength(1);
    });

    it('a row opens from the keyboard', async () => {
      renderTable();
      await screen.findByText('Legacy sync');
      const row = rows()[0];
      expect(row).toHaveAttribute('tabindex', '0');
      fireEvent.keyDown(row, { key: 'Enter' });
      expect(await screen.findByRole('dialog')).toBeInTheDocument();
    });

    it('the log of one job\'s run does not repeat the job\'s name', async () => {
      renderTable({ jobId: JOB_REPORT_ID });
      await waitFor(() => expect(rows()).toHaveLength(3));
      fireEvent.click(rows()[0]);
      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByText('Run logs')).toBeInTheDocument();
      expect(within(dialog).queryByText(/Nightly report/)).not.toBeInTheDocument();
    });
  });

  describe('paging', () => {
    it('pages the runs, 50 to a page by default', async () => {
      const all = manyMockRuns(120);
      fetchRunsMock.mockImplementation(async (params: { page?: number; limit?: number }) => pageOf(all, params));
      renderTable();
      await waitFor(() => expect(rows()).toHaveLength(50));
      expect(screen.getByText('Showing 50 of 120 runs')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: '3' }));
      await waitFor(() => expect(rows()).toHaveLength(20));
      expect(fetchRunsMock).toHaveBeenLastCalledWith({ page: 3, limit: 50 });
      expect(screen.getByText('Showing 20 of 120 runs')).toBeInTheDocument();
    });

    it('pageSize sets the first page size, and the selector changes it from page 1', async () => {
      const all = manyMockRuns(30);
      fetchJobRunsMock.mockImplementation(async (_id: string, params: { page?: number; limit?: number }) =>
        pageOf(all, params),
      );
      renderTable({ jobId: JOB_REPORT_ID, pageSize: 10 });
      await waitFor(() => expect(rows()).toHaveLength(10));
      expect(fetchJobRunsMock).toHaveBeenCalledWith(JOB_REPORT_ID, { page: 1, limit: 10 });

      fireEvent.click(screen.getByRole('button', { name: '2' }));
      await waitFor(() => expect(fetchJobRunsMock).toHaveBeenLastCalledWith(JOB_REPORT_ID, { page: 2, limit: 10 }));

      fireEvent.click(screen.getByTestId('cron-runs-table-page-size'));
      // hidden: true — the dropdown stays display:none in jsdom (no transitions).
      fireEvent.click(await screen.findByRole('option', { name: '25 / page', hidden: true }));
      await waitFor(() => expect(fetchJobRunsMock).toHaveBeenLastCalledWith(JOB_REPORT_ID, { page: 1, limit: 25 }));
    });

    it('falls back to the last page when the page it asked for no longer exists', async () => {
      // Runs are pruned as new ones are written: page 3 of a history that now has 2
      let all = manyMockRuns(120);
      fetchRunsMock.mockImplementation(async (params: { page?: number; limit?: number }) => pageOf(all, params));
      renderTable();
      await waitFor(() => expect(rows()).toHaveLength(50));
      fireEvent.click(screen.getByRole('button', { name: '3' }));
      await waitFor(() => expect(rows()).toHaveLength(20));

      all = all.slice(0, 70);
      fireEvent.click(screen.getByTestId('cron-runs-table-refresh'));
      await waitFor(() => expect(screen.getByText('Showing 20 of 70 runs')).toBeInTheDocument());
      expect(fetchRunsMock).toHaveBeenLastCalledWith({ page: 2, limit: 50 });
    });
  });

  describe('refreshing', () => {
    it('the Refresh button, named for a screen reader, loads the page again', async () => {
      renderTable();
      await screen.findByText('Legacy sync');
      expect(fetchRunsMock).toHaveBeenCalledTimes(1);

      const newer = { ...mockRuns[0], id: 'newer', job_name: 'Just ran' };
      fetchRunsMock.mockResolvedValue(pageOf([newer, ...mockRuns]));
      fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));

      expect(await screen.findByText('Just ran')).toBeInTheDocument();
      expect(fetchRunsMock).toHaveBeenCalledTimes(2);
      expect(screen.getByTestId('cron-runs-table-count')).toHaveTextContent('6 runs');
    });

    it('a new refreshKey loads the page again; the same one does not', async () => {
      const { update } = renderTable({ refreshKey: 1 });
      await screen.findByText('Legacy sync');
      expect(fetchRunsMock).toHaveBeenCalledTimes(1);

      update({ refreshKey: 1 });
      await act(async () => {});
      expect(fetchRunsMock).toHaveBeenCalledTimes(1);

      update({ refreshKey: 2 });
      await waitFor(() => expect(fetchRunsMock).toHaveBeenCalledTimes(2));
    });

    it('draws only the answer to the latest request', async () => {
      // The first load is slow; a refresh is answered before it
      let answerFirst: (page: CronRunListResult) => void = () => {};
      fetchRunsMock.mockImplementationOnce(
        () =>
          new Promise<CronRunListResult>((resolve) => {
            answerFirst = resolve;
          }),
      );
      const { update } = renderTable({ refreshKey: 1 });
      await waitFor(() => expect(fetchRunsMock).toHaveBeenCalledTimes(1));

      const latest = { ...mockRuns[0], id: 'latest', job_name: 'Latest answer' };
      fetchRunsMock.mockResolvedValue(pageOf([latest]));
      update({ refreshKey: 2 });
      expect(await screen.findByText('Latest answer')).toBeInTheDocument();

      // The slow answer to the earlier request arrives last, and is dropped
      await act(async () => {
        answerFirst(pageOf([{ ...mockRuns[1], job_name: 'Stale answer' }]));
      });
      expect(screen.queryByText('Stale answer')).not.toBeInTheDocument();
      expect(screen.getByText('Latest answer')).toBeInTheDocument();
      expect(screen.getByTestId('cron-runs-table-count')).toHaveTextContent('1 run');
    });
  });

  describe('a history without rows says why', () => {
    it('a failed load shows the load-error state and a notification with the server\'s sentence', async () => {
      fetchRunsMock.mockRejectedValue(new DaaSRequestError('service unavailable', { kind: 'failure', status: 500 }));
      renderTable();

      const error = await screen.findByTestId('cron-runs-table-load-error');
      expect(error).toHaveTextContent('Failed to load run history — service unavailable');
      expect(screen.queryByTestId('cron-runs-table-empty')).not.toBeInTheDocument();
      expect(screen.queryByTestId('cron-runs-table-count')).not.toBeInTheDocument();
      expect(show).toHaveBeenCalledWith({ title: 'Error', message: 'service unavailable', color: 'red' });
    });

    it('a failure without a sentence says that the history could not be fetched', async () => {
      fetchRunsMock.mockRejectedValue('boom');
      renderTable();
      expect(await screen.findByTestId('cron-runs-table-load-error')).toHaveTextContent('Failed to fetch history');
      expect(show).toHaveBeenCalledWith(expect.objectContaining({ message: 'Failed to fetch history' }));
    });

    it('a refresh that fails takes the rows of the load before it off the screen', async () => {
      renderTable();
      await screen.findByText('Legacy sync');

      fetchRunsMock.mockRejectedValue(new DaaSRequestError('down', { kind: 'failure', status: 500 }));
      fireEvent.click(screen.getByTestId('cron-runs-table-refresh'));

      expect(await screen.findByTestId('cron-runs-table-load-error')).toHaveTextContent('down');
      // Rows that may no longer be what is stored are not left standing as current
      expect(screen.queryByText('Legacy sync')).not.toBeInTheDocument();

      // Refresh is still there, and recovers
      fetchRunsMock.mockResolvedValue(pageOf(mockRuns));
      fireEvent.click(screen.getByTestId('cron-runs-table-refresh'));
      expect(await screen.findByText('Legacy sync')).toBeInTheDocument();
      expect(screen.queryByTestId('cron-runs-table-load-error')).not.toBeInTheDocument();
    });

    it('a refused load shows the access-denied state, without an error notification', async () => {
      fetchRunsMock.mockRejectedValue(new DaaSRequestError('Permission denied', { kind: 'forbidden', status: 403 }));
      renderTable();
      const denied = await screen.findByTestId('cron-runs-table-access-denied');
      expect(denied).toHaveTextContent('Access denied');
      expect(denied).toHaveTextContent('You do not have permission to view this.');
      expect(show).not.toHaveBeenCalled();
    });

    it('a session that needs a second factor is told what the server said', async () => {
      fetchRunsMock.mockRejectedValue(
        new DaaSRequestError('Multi-factor authentication is required', {
          kind: 'mfaRequired',
          status: 403,
          code: 'MFA_REQUIRED',
        }),
      );
      renderTable();
      expect(await screen.findByTestId('cron-runs-table-access-denied')).toHaveTextContent(
        'Multi-factor authentication is required',
      );
    });

    it('a job that is gone is a load error with the server\'s sentence', async () => {
      fetchJobRunsMock.mockRejectedValue(new DaaSRequestError('Cron job not found', { kind: 'notFound', status: 404 }));
      renderTable({ jobId: JOB_REPORT_ID });
      expect(await screen.findByTestId('cron-runs-table-load-error')).toHaveTextContent('Cron job not found');
    });
  });

  it('prefixes its test ids, and reads its strings from the translations prop', async () => {
    renderTable({ 'data-testid': 'history', translations: { runsTable: { columns: { job: 'Tugas' } } } });
    await screen.findByText('Legacy sync');
    expect(screen.getByTestId('history')).toHaveTextContent('Tugas');
    expect(screen.getByTestId('history-refresh')).toBeInTheDocument();
  });
});
