/**
 * The width of the two cron tables: what a unit test can hold of it.
 *
 * jsdom lays nothing out, so nothing here measures a pixel on screen. What is
 * pinned is what the layout is made of: the column definitions (which columns
 * are fixed, which share the width, and that their minima add up to no more
 * than the container the tables are laid out for), the grid template they
 * make, that each table hands that template to its card, the CSS rule that
 * applies it, and that a long text is marked to end in an ellipsis. The
 * measurement itself is done in a browser, on the `NarrowContainer` stories.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BuildpadI18nProvider } from '@buildpad/services';
import type { CronJobRecord, CronListResult, CronRunListResult, CronRunRecord } from '@buildpad/types';
import { CronJobsManager } from '../src/CronJobsManager';
import { CronRunsTable } from '../src/CronRunsTable';
import {
  CRON_JOBS_COLUMNS,
  CRON_ROW_APPEND_WIDTH,
  CRON_RUNS_COLUMNS,
  CRON_RUNS_JOB_COLUMNS,
  CRON_TABLE_FIT_WIDTH,
  cronGridStyle,
  cronGridTemplate,
  cronTableMinWidth,
  type CronTableColumn,
} from '../src/cronTableColumns';
import { longTextJobs, longTextRuns } from '../src/_fixtures';

const { fetchJobsMock, fetchRunsMock, fetchJobRunsMock, usePermissionsMock } = vi.hoisted(() => ({
  fetchJobsMock: vi.fn(),
  fetchRunsMock: vi.fn(),
  fetchJobRunsMock: vi.fn(),
  usePermissionsMock: vi.fn(),
}));

vi.mock('@buildpad/hooks', async () => {
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
      updateJob: vi.fn(),
      deleteJob: vi.fn(),
      cloneJob: vi.fn(),
      runJob: vi.fn(),
    }),
    useCronRuns: () => ({ fetchRuns: fetchRunsMock, fetchJobRuns: fetchJobRunsMock }),
    usePermissions: usePermissionsMock,
  };
});

const ALL_RUNS_COLUMNS = [...CRON_RUNS_JOB_COLUMNS, ...CRON_RUNS_COLUMNS];

const fixed = (columns: readonly CronTableColumn[]) => columns.filter((column) => column.grow === 0).map((column) => column.value);
const flexible = (columns: readonly CronTableColumn[]) => columns.filter((column) => column.grow > 0).map((column) => column.value);

function ui(node: React.ReactNode) {
  return render(
    <MantineProvider>
      <BuildpadI18nProvider locale="en" timeZone="UTC" datesProvider={false}>
        {node}
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

/** The cells of a table's heading row and of its first row. */
function gridCells(card: HTMLElement): { heading: number; row: number } {
  const heading = card.querySelector('thead tr:not(.loading-indicator)') as HTMLElement;
  const row = card.querySelector('tbody tr.table-row') as HTMLElement;
  return { heading: heading.querySelectorAll('th').length, row: row.querySelectorAll('td').length };
}

/** The tracks of a grid template; a `minmax(…, …)` is one track. */
const tracks = (template: string) => template.match(/minmax\([^)]*\)|\S+/g) ?? [];

beforeEach(() => {
  const jobs: CronListResult<CronJobRecord> = { items: longTextJobs, total: longTextJobs.length, totalPages: 1, page: 1, limit: 25 };
  const runsOf = (items: CronRunRecord[]): CronRunListResult => ({ items, total: items.length, totalPages: 1, page: 1, limit: 50, offset: 0 });
  fetchJobsMock.mockReset().mockResolvedValue(jobs);
  fetchRunsMock.mockReset().mockResolvedValue(runsOf(longTextRuns));
  fetchJobRunsMock.mockReset().mockResolvedValue(runsOf(longTextRuns.slice(0, 1)));
  grant([], true);
});

describe('the columns of the cron tables', () => {
  it('fit a 970 px container: the minima of every table, its last cell included, add up to no more', () => {
    expect(CRON_TABLE_FIT_WIDTH).toBe(970);
    // The jobs list with its row menu, the history of every job, and of one job
    expect(cronTableMinWidth(CRON_JOBS_COLUMNS, true)).toBe(966);
    expect(cronTableMinWidth(ALL_RUNS_COLUMNS, true)).toBe(830);
    expect(cronTableMinWidth(CRON_RUNS_COLUMNS, true)).toBe(670);
    for (const columns of [CRON_JOBS_COLUMNS, ALL_RUNS_COLUMNS, CRON_RUNS_COLUMNS]) {
      expect(cronTableMinWidth(columns, true)).toBeLessThanOrEqual(CRON_TABLE_FIT_WIDTH);
    }
    // A reader's jobs list has no menu cell
    expect(cronTableMinWidth(CRON_JOBS_COLUMNS, false)).toBe(966 - CRON_ROW_APPEND_WIDTH);
  });

  it('are flexible but for the icon and the badges', () => {
    expect(CRON_JOBS_COLUMNS.map((column) => column.value)).toEqual([
      'icon', 'name', 'schedule', 'timezone', 'status', 'lastRun', 'lastStatus', 'nextRun',
    ]);
    expect(fixed(CRON_JOBS_COLUMNS)).toEqual(['icon', 'status', 'lastStatus']);
    expect(flexible(CRON_JOBS_COLUMNS)).toEqual(['name', 'schedule', 'timezone', 'lastRun', 'nextRun']);

    expect(ALL_RUNS_COLUMNS.map((column) => column.value)).toEqual([
      'icon', 'job', 'triggered', 'duration', 'status', 'triggeredBy', 'logs',
    ]);
    expect(fixed(ALL_RUNS_COLUMNS)).toEqual(['icon', 'status', 'triggeredBy']);
    expect(flexible(ALL_RUNS_COLUMNS)).toEqual(['job', 'triggered', 'duration', 'logs']);

    // No fixed column is a wide one, and the text columns get most of what is left over
    for (const column of [...CRON_JOBS_COLUMNS, ...ALL_RUNS_COLUMNS]) {
      if (column.grow === 0) expect(column.min).toBeLessThanOrEqual(100);
    }
    const share = (columns: readonly CronTableColumn[], value: string) => columns.find((column) => column.value === value)!.grow;
    expect(share(CRON_JOBS_COLUMNS, 'name')).toBe(Math.max(...CRON_JOBS_COLUMNS.map((column) => column.grow)));
    expect(share(ALL_RUNS_COLUMNS, 'logs')).toBe(Math.max(...ALL_RUNS_COLUMNS.map((column) => column.grow)));
  });

  it('make a grid template of fixed and minmax tracks, a spacer of no width, and a fixed last cell', () => {
    expect(cronGridTemplate(CRON_JOBS_COLUMNS, true)).toBe(
      '44px minmax(110px, 3fr) minmax(120px, 1.2fr) minmax(96px, 1fr) 94px minmax(180px, 0.6fr) 96px minmax(180px, 0.6fr) 0px 46px',
    );
    expect(cronGridTemplate(CRON_JOBS_COLUMNS, false)).toBe(
      '44px minmax(110px, 3fr) minmax(120px, 1.2fr) minmax(96px, 1fr) 94px minmax(180px, 0.6fr) 96px minmax(180px, 0.6fr) 0px',
    );
    expect(cronGridTemplate(ALL_RUNS_COLUMNS, true)).toBe(
      '40px minmax(120px, 2fr) minmax(180px, 0.6fr) minmax(112px, 0.5fr) 94px 98px minmax(140px, 3fr) 0px 46px',
    );
    expect(cronGridTemplate(CRON_RUNS_COLUMNS, true)).toBe(
      'minmax(180px, 0.6fr) minmax(112px, 0.5fr) 94px 98px minmax(140px, 3fr) 0px 46px',
    );

    // Nothing in a template is sized by what a cell holds: the header and every
    // row are grids of their own, and must resolve to the same columns
    for (const template of [cronGridTemplate(CRON_JOBS_COLUMNS, true), cronGridTemplate(ALL_RUNS_COLUMNS, true)]) {
      expect(template).not.toMatch(/auto|min-content|max-content|fit-content/);
    }
    expect(cronGridStyle(CRON_RUNS_COLUMNS, true)).toEqual({
      '--bp-cron-grid-columns': cronGridTemplate(CRON_RUNS_COLUMNS, true),
    });
  });

  it('are applied by the stylesheet to the heading row and to every row of a cron card', () => {
    const css = readFileSync(resolve(import.meta.dirname, '../src/CronManagerTable.css'), 'utf8').replace(/\s+/g, ' ');
    expect(css).toContain(
      '.bp-cron-manager-card .v-table table thead tr, .bp-cron-manager-card .v-table table tbody tr { --grid-columns: var(--bp-cron-grid-columns, var(--grid-columns-rows)); }',
    );
    // What a cell holds may shrink to its column
    expect(css).toContain('.bp-cron-manager-card .v-table .table-row .cell:not(.append) > * { min-width: 0; }');
  });
});

describe('CronJobsManager', () => {
  it('hands its card the jobs template, with the menu cell for a user who has a row menu', async () => {
    ui(<CronJobsManager urlParams={false} onJobClick={vi.fn()} />);
    const card = await screen.findByTestId('cron-jobs-manager-card');
    await within(card).findByText('Nightly report');

    expect(card.style.getPropertyValue('--bp-cron-grid-columns')).toBe(cronGridTemplate(CRON_JOBS_COLUMNS, true));
    // One track per cell the table draws: the columns, the spacer, the menu
    const cells = gridCells(card);
    expect(cells.row).toBe(CRON_JOBS_COLUMNS.length + 2);
    expect(cells.heading).toBe(cells.row);
    expect(tracks(cronGridTemplate(CRON_JOBS_COLUMNS, true))).toHaveLength(cells.row);
  });

  it('leaves the menu cell out of the template for a reader, whose rows have none', async () => {
    grant(['read']);
    ui(<CronJobsManager urlParams={false} onJobClick={vi.fn()} />);
    const card = await screen.findByTestId('cron-jobs-manager-card');
    await within(card).findByText('Nightly report');
    await waitFor(() =>
      expect(card.style.getPropertyValue('--bp-cron-grid-columns')).toBe(cronGridTemplate(CRON_JOBS_COLUMNS, false)),
    );

    const cells = gridCells(card);
    expect(cells.row).toBe(CRON_JOBS_COLUMNS.length + 1);
    expect(cells.heading).toBe(cells.row);
    expect(card.querySelector('td.append')).toBeNull();
  });

  it('gives no column but the icon a width of its own', async () => {
    ui(<CronJobsManager urlParams={false} onJobClick={vi.fn()} />);
    const card = await screen.findByTestId('cron-jobs-manager-card');
    await within(card).findByText('Nightly report');

    // VTable writes its own template from the headers' widths (160 px for a
    // header without one). The cron card overrides it; what is left of it is
    // the icon's 44 px and seven columns that carry no width.
    const table = card.querySelector('.v-table') as HTMLElement;
    await waitFor(() => expect(table.style.getPropertyValue('--grid-columns-rows')).not.toBe(''));
    expect(table.style.getPropertyValue('--grid-columns-rows')).toBe(`44px ${Array(7).fill('160px').join(' ')} 1fr min-content`);
  });

  it('marks a long name, description, schedule and timezone to end in an ellipsis, and keeps the whole text at hand', async () => {
    const [long] = longTextJobs;
    ui(<CronJobsManager urlParams={false} onJobClick={vi.fn()} />);
    const row = (await screen.findByText(long.name)).closest('tr') as HTMLElement;

    const name = within(row).getByText(long.name);
    expect(name).toHaveAttribute('data-truncate', 'end');
    expect(within(row).getByRole('button', { name: `Open cron job ${long.name}` })).toHaveAttribute('title', long.name);
    const description = within(row).getByText(long.description as string);
    expect(description).toHaveAttribute('data-truncate', 'end');
    expect(description).toHaveAttribute('title', long.description);
    const schedule = within(row).getByText(long.schedule as string);
    expect(schedule).toHaveClass('bp-cron-cell-code');
    expect(schedule).toHaveAttribute('title', long.schedule);
    const timezone = within(row).getByText('America/Argentina/Buenos_Aires');
    expect(timezone).toHaveAttribute('data-truncate', 'end');
    expect(timezone).toHaveAttribute('title', 'America/Argentina/Buenos_Aires');
    // The dates are whole at the minimum width; in a longer locale they end in an ellipsis too
    expect(within(row).getByText('Sep 30, 2026, 10:59:59 PM')).toHaveAttribute('data-truncate', 'end');
    expect(within(row).getByText('Dec 31, 2026, 10:59:59 PM')).toHaveAttribute('data-truncate', 'end');
  });

  it('marks the name of a job that cannot be opened the same way', async () => {
    const [long] = longTextJobs;
    ui(<CronJobsManager urlParams={false} />);
    const name = await screen.findByText(long.name);
    expect(name).toHaveAttribute('data-truncate', 'end');
    expect(name).toHaveAttribute('title', long.name);
  });
});

describe('CronRunsTable', () => {
  it('hands its card the template of the history of every job', async () => {
    ui(<CronRunsTable />);
    const card = await screen.findByTestId('cron-runs-table');
    await within(card).findAllByText('Nightly report');

    expect(card.style.getPropertyValue('--bp-cron-grid-columns')).toBe(cronGridTemplate(ALL_RUNS_COLUMNS, true));
    const cells = gridCells(card);
    expect(cells.row).toBe(ALL_RUNS_COLUMNS.length + 2);
    expect(cells.heading).toBe(cells.row);
    expect(tracks(cronGridTemplate(ALL_RUNS_COLUMNS, true))).toHaveLength(cells.row);
  });

  it('hands its card the template without the Job columns for the history of one job', async () => {
    ui(<CronRunsTable jobId={longTextJobs[0].id} />);
    const card = await screen.findByTestId('cron-runs-table');
    await within(card).findByText(longTextRuns[0].error as string);

    expect(card.style.getPropertyValue('--bp-cron-grid-columns')).toBe(cronGridTemplate(CRON_RUNS_COLUMNS, true));
    const cells = gridCells(card);
    expect(cells.row).toBe(CRON_RUNS_COLUMNS.length + 2);
    expect(cells.heading).toBe(cells.row);
  });

  it('marks a long job name and a long error to end in an ellipsis, and keeps the whole text at hand', async () => {
    const [long] = longTextRuns;
    ui(<CronRunsTable />);
    const row = (await screen.findByText(long.job_name)).closest('tr') as HTMLElement;

    const job = within(row).getByText(long.job_name);
    expect(job).toHaveAttribute('data-truncate', 'end');
    expect(job).toHaveAttribute('title', long.job_name);
    const error = within(row).getByText(long.error as string);
    expect(error).toHaveAttribute('data-truncate', 'end');
    expect(error).toHaveAttribute('title', long.error);
    expect(within(row).getByText('Sep 30, 2026, 10:59:59 PM')).toHaveAttribute('data-truncate', 'end');
    expect(within(row).getByText('1,234,567')).toHaveAttribute('data-truncate', 'end');
    // The View logs button stays in the row's last cell
    expect(row.querySelector('td.append button')).toHaveAccessibleName('View the logs of the run triggered Sep 30, 2026, 10:59:59 PM');
  });
});
