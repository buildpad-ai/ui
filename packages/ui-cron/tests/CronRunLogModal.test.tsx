/**
 * CronRunLogModal unit tests: what a run's log shows — outcome, trigger, time,
 * duration, error, and the console output line by line.
 */
import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { describe, it, expect, vi } from 'vitest';
import { BuildpadI18nProvider } from '@buildpad/services';
import type { CronRunRecord } from '@buildpad/types';
import { CronRunLogModal } from '../src/CronRunLogModal';
import { mockRuns } from '../src/_fixtures';

const [successRun, failedRun, timedOutRun, rawRun, runningRun] = mockRuns;

function renderModal(props: Partial<React.ComponentProps<typeof CronRunLogModal>> = {}) {
  return render(
    <MantineProvider>
      {/* A pinned locale and zone, so dates read the same on every machine */}
      <BuildpadI18nProvider locale="en" timeZone="UTC" datesProvider={false}>
        <CronRunLogModal run={successRun} onClose={vi.fn()} {...props} />
      </BuildpadI18nProvider>
    </MantineProvider>,
  );
}

describe('CronRunLogModal', () => {
  it('names the job, the outcome and what started the run in its title', async () => {
    renderModal();
    const dialog = await screen.findByRole('dialog');
    const title = dialog.querySelector('.mantine-Modal-title') as HTMLElement;
    expect(within(title).getByText('Run logs — Nightly report')).toBeInTheDocument();
    expect(within(title).getByText('Success')).toBeInTheDocument();
    expect(within(title).getByText('manual')).toBeInTheDocument();
  });

  it('shows when the run was triggered and how long it took, with its unit', async () => {
    renderModal();
    await screen.findByRole('dialog');
    expect(screen.getByText('Triggered')).toBeInTheDocument();
    expect(screen.getByTestId('cron-run-log-triggered')).toHaveTextContent('Mar 2, 2026, 9:00:00 AM');
    expect(screen.getByText('Duration')).toBeInTheDocument();
    expect(screen.getByTestId('cron-run-log-duration')).toHaveTextContent('1,234 ms');
  });

  it('lists the console output line by line: time to the millisecond, level, message', async () => {
    renderModal();
    await screen.findByRole('dialog');
    expect(screen.getByTestId('cron-run-log-count')).toHaveTextContent('2 log lines');

    const lines = screen.getAllByTestId('cron-run-log-line');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toHaveTextContent('09:00:00.120');
    expect(lines[0]).toHaveTextContent('INFO');
    expect(lines[0]).toHaveTextContent('Orders in the report: 42');
    expect(lines[1]).toHaveTextContent('09:00:01.200');
    expect(lines[1]).toHaveTextContent('WARN');
    expect(lines[1]).toHaveTextContent('Two orders have no customer');
    expect(screen.queryByTestId('cron-run-log-error')).not.toBeInTheDocument();
    expect(screen.queryByTestId('cron-run-log-empty')).not.toBeInTheDocument();
  });

  it('shows the error a run ended with, above its output', async () => {
    renderModal({ run: failedRun });
    await screen.findByRole('dialog');
    const error = screen.getByTestId('cron-run-log-error');
    expect(error).toHaveTextContent('Error');
    expect(error).toHaveTextContent('The legacy system did not answer');
    expect(screen.getByTestId('cron-run-log-count')).toHaveTextContent('1 log line');
    expect(screen.getByTestId('cron-run-log-count')).not.toHaveTextContent('lines');
    expect(screen.getByTestId('cron-run-log-line')).toHaveTextContent('ERROR');
  });

  it('says so when a run printed nothing', async () => {
    renderModal({ run: timedOutRun });
    await screen.findByRole('dialog');
    expect(screen.getByTestId('cron-run-log-count')).toHaveTextContent('0 log lines');
    expect(screen.getByTestId('cron-run-log-empty')).toHaveTextContent('No console output for this run.');
    expect(screen.queryByTestId('cron-run-log-line')).not.toBeInTheDocument();
    expect(screen.getByTestId('cron-run-log-duration')).toHaveTextContent('10,000 ms');
  });

  it('keeps a message that spans lines whole, and shows an entry in no known form as it is', async () => {
    renderModal({ run: rawRun });
    await screen.findByRole('dialog');
    const [object, raw] = screen.getAllByTestId('cron-run-log-line');
    expect(object.textContent).toContain('{\n  "sent": 40\n}');
    expect(object).toHaveTextContent('INFO');
    // Nothing a run printed is dropped: no time, no level, the entry itself
    expect(raw.textContent).toBe('a line in no known form');
    expect(within(screen.getByRole('dialog')).getByText('extension')).toBeInTheDocument();
  });

  it('shows a time that is not a date as it was written', async () => {
    renderModal({ run: { ...successRun, logs: ['[yesterday] [INFO] hello'] } });
    await screen.findByRole('dialog');
    expect(screen.getByTestId('cron-run-log-line')).toHaveTextContent('yesterdayINFOhello');
  });

  it('marks what a run that is still going does not have yet', async () => {
    renderModal({ run: { ...runningRun, triggered_at: '' } });
    await screen.findByRole('dialog');
    expect(within(screen.getByRole('dialog')).getByText('Running')).toBeInTheDocument();
    expect(screen.getByTestId('cron-run-log-duration')).toHaveTextContent('—');
    expect(screen.getByTestId('cron-run-log-triggered')).toHaveTextContent('—');
  });

  it('reads a run answered without logs as a run that printed nothing', async () => {
    renderModal({ run: { ...successRun, logs: undefined } as unknown as CronRunRecord });
    await screen.findByRole('dialog');
    expect(screen.getByTestId('cron-run-log-count')).toHaveTextContent('0 log lines');
  });

  it('showJobName={false} leaves the job out of the title, as a job\'s own history opens it', async () => {
    renderModal({ showJobName: false });
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Run logs')).toBeInTheDocument();
    expect(within(dialog).queryByText(/Nightly report/)).not.toBeInTheDocument();
  });

  it('closes by its close button and by Escape', async () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(dialog.querySelector('.mantine-Modal-close') as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('renders no dialog without a run, and opens when it is given one', async () => {
    const { rerender } = renderModal({ run: null });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    rerender(
      <MantineProvider>
        <BuildpadI18nProvider locale="en" timeZone="UTC" datesProvider={false}>
          <CronRunLogModal run={failedRun} onClose={vi.fn()} />
        </BuildpadI18nProvider>
      </MantineProvider>,
    );
    expect(await screen.findByText('Run logs — Legacy sync')).toBeInTheDocument();
  });

  it('reads its strings from the translations prop', async () => {
    renderModal({ translations: { logModal: { titleWithJob: 'Log eksekusi — {job}', triggered: 'Dipicu' } } });
    expect(await screen.findByText('Log eksekusi — Nightly report')).toBeInTheDocument();
    expect(screen.getByText('Dipicu')).toBeInTheDocument();
  });
});
