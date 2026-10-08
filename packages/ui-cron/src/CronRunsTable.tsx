'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActionIcon, Badge, Group, Text, Tooltip } from '@mantine/core';
import { IconClock, IconFileText, IconRefresh } from '@tabler/icons-react';
import { useCronRuns } from '@buildpad/hooks';
import { useBuildpadI18n, useBuildpadTranslations } from '@buildpad/services';
import type { CronRunRecord } from '@buildpad/types';
import { VTable } from '@buildpad/ui-table';
import type { Header, HeaderRaw, Item } from '@buildpad/ui-table';
import { interpolate, type CronTranslations, type DeepPartial } from '@buildpad/utils';
import { CRON_DATE_TIME_FORMAT } from './cronFormat';
import { CRON_RUNS_COLUMNS, CRON_RUNS_JOB_COLUMNS, cronGridStyle } from './cronTableColumns';
import { CronListEmptyState } from './CronListEmptyState';
import { CronListFooter } from './CronListFooter';
import { CronPageState } from './CronPageState';
import { CronRunLogModal } from './CronRunLogModal';
import { CronRunStatusBadge } from './CronRunStatusBadge';
import { CronTriggerBadge } from './CronTriggerBadge';
import { useCronList } from './useCronList';
import './CronManagerTable.css';

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export interface CronRunsTableProps {
  /**
   * List the runs of this job only. Leave it out for the runs of every job
   * the caller can read.
   */
  jobId?: string;
  /**
   * Show the Job column (and name the job in the run log's title). Default:
   * true for the runs of every job, false for the runs of one.
   */
  showJobColumn?: boolean;
  /** Initial runs per page (changeable via the footer selector). Default: 50. */
  pageSize?: number;
  /** Choices offered by the footer page-size selector. Default: [10, 25, 50, 100]. */
  pageSizeOptions?: number[];
  /**
   * Change this value to have the table load its current page again — after
   * a Run Now elsewhere on the page, or when the tab that holds the table is
   * opened. The first value loads nothing extra.
   */
  refreshKey?: string | number;
  /** Prefix of the `data-testid`s the table sets. Default: 'cron-runs-table'. */
  'data-testid'?: string;
  /** Per-instance overrides of the `cron` dictionary namespace (prop > provider > defaults). */
  translations?: DeepPartial<CronTranslations>;
}

/**
 * The run history of cron jobs, newest first: when each run was triggered,
 * how long it took, how it ended, what started it, and its error or its
 * number of console lines. A row (or its View logs button) opens the run log.
 * It owns the load, the Refresh button and the pager.
 *
 * One table for the history of every job (the jobs list's History tab) and
 * for the history of one (the editor's), which the reference admin UI
 * (buildpad-daas) wrote twice. What differs from both, on purpose:
 *
 * - A load that fails says so (the load-error state and a notification), and
 *   a refusal draws the access-denied state. The reference kept the rows of
 *   the load before it on screen, as if they were current.
 * - Only the answer to the latest request is drawn.
 * - The history of one job is paged too; the reference showed its newest 50
 *   runs and no way to the rest.
 * - A run opens from the keyboard: the row takes focus, and its View logs
 *   button has a name. The reference's rows answered a mouse click only.
 * - The note under a job's history that promised an expandable row "(future
 *   enhancement)" is gone: a row opens the run log.
 * - Dates follow the locale and the time zone of the `BuildpadI18nProvider`.
 */
export const CronRunsTable: React.FC<CronRunsTableProps> = ({
  jobId,
  showJobColumn = jobId === undefined,
  pageSize = 50,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  refreshKey,
  'data-testid': testId = 'cron-runs-table',
  translations,
}) => {
  const { fetchRuns, fetchJobRuns } = useCronRuns();
  const t = useBuildpadTranslations((d) => d.cron, translations);
  const common = useBuildpadTranslations((d) => d.common);
  const { formatCount, formatDate, formatNumber } = useBuildpadI18n();

  const fetchPage = useCallback(
    ({ page, limit }: { page: number; limit: number }) =>
      jobId === undefined ? fetchRuns({ page, limit }) : fetchJobRuns(jobId, { page, limit }),
    [jobId, fetchRuns, fetchJobRuns],
  );

  const list = useCronList<CronRunRecord>({
    fetchPage,
    pageSize,
    pageSizeOptions,
    // The table is one part of a page: the page's URL is not its to write
    urlParams: false,
    urlParamPrefix: '',
    loadFailedTitle: common.error,
    loadFailedMessage: t.runsTable.notifications.loadFailed,
  });
  const { rows: runs, loading, failure, reload } = list;

  // A new `refreshKey` loads the current page again; the first one does not,
  // the mount already loads it.
  const refreshKeyRef = useRef(refreshKey);
  useEffect(() => {
    if (refreshKeyRef.current === refreshKey) return;
    refreshKeyRef.current = refreshKey;
    void reload();
  }, [refreshKey, reload]);

  const [selectedRun, setSelectedRun] = useState<CronRunRecord | null>(null);

  // How wide each column is drawn is not said here: the columns share the
  // width of the card (cronTableColumns.ts). The icon's `width` only tells
  // VTable to draw that heading as a narrow one.
  const headers = useMemo<HeaderRaw[]>(
    () => [
      ...(showJobColumn
        ? [
            { text: '', value: 'icon', sortable: false, width: 40 },
            { text: t.runsTable.columns.job, value: 'job', sortable: false },
          ]
        : []),
      { text: t.runsTable.columns.triggered, value: 'triggered', sortable: false },
      { text: t.runsTable.columns.durationMs, value: 'duration', sortable: false },
      { text: t.runsTable.columns.status, value: 'status', sortable: false },
      { text: t.runsTable.columns.triggeredBy, value: 'triggeredBy', sortable: false },
      { text: t.runsTable.columns.logs, value: 'logs', sortable: false },
    ],
    [t, showJobColumn],
  );
  // The same columns, as the grid they are drawn on; every row ends in the View logs cell
  const gridStyle = useMemo(
    () => cronGridStyle(showJobColumn ? [...CRON_RUNS_JOB_COLUMNS, ...CRON_RUNS_COLUMNS] : CRON_RUNS_COLUMNS, true),
    [showJobColumn],
  );

  // `formatDate` returns '' for an empty or invalid value
  const dateTime = useCallback(
    (value: string | null | undefined) => formatDate(value, CRON_DATE_TIME_FORMAT) || t.emptyValue,
    [formatDate, t],
  );

  const renderCell = useCallback(
    (item: Item, header: Header): React.ReactNode => {
      const run = item as unknown as CronRunRecord;
      switch (header.value) {
        case 'icon':
          return <IconClock size={14} color="var(--mantine-color-teal-6)" />;
        case 'job':
          return (
            <Text size="sm" fw={500} truncate="end" title={run.job_name}>
              {run.job_name}
            </Text>
          );
        case 'triggered':
          return (
            <Text size="xs" c="dimmed" truncate="end">
              {dateTime(run.triggered_at)}
            </Text>
          );
        case 'duration':
          return (
            <Text size="xs" truncate="end">
              {typeof run.duration_ms === 'number' ? formatNumber(run.duration_ms) : t.emptyValue}
            </Text>
          );
        case 'status':
          return <CronRunStatusBadge status={run.status} translations={translations} />;
        case 'triggeredBy':
          return <CronTriggerBadge triggeredBy={run.triggered_by} translations={translations} />;
        case 'logs':
          return run.error ? (
            // The whole error is in the run log; here it is one line
            <Text size="xs" c="red" truncate="end" title={run.error}>
              {run.error}
            </Text>
          ) : (
            <Text size="xs" c="dimmed">
              {formatCount(run.logs.length, t.count.lines)}
            </Text>
          );
        default:
          return null;
      }
    },
    [t, translations, dateTime, formatCount, formatNumber],
  );

  const renderRowAppend = (item: Item) => {
    const run = item as unknown as CronRunRecord;
    const label = interpolate(t.runsTable.viewLogsAriaLabel, { date: dateTime(run.triggered_at) });
    return (
      <ActionIcon
        variant="subtle"
        color="gray"
        size="sm"
        onClick={(e) => {
          // The row's own click would open the run a second time
          e.stopPropagation();
          setSelectedRun(run);
        }}
        aria-label={label}
        title={label}
      >
        <IconFileText size={16} />
      </ActionIcon>
    );
  };

  if (failure?.kind === 'accessDenied') {
    return (
      <CronPageState
        variant="accessDenied"
        title={t.accessDenied.title}
        description={failure.description || t.accessDenied.description}
        data-testid={`${testId}-access-denied`}
      />
    );
  }

  const empty = !loading && runs.length === 0;

  return (
    <>
      <div className="bp-cron-manager-card" style={gridStyle} data-testid={testId}>
        <Group className="bp-cron-manager-toolbar" justify="flex-end" gap="sm">
          {!failure && (
            <Badge variant="light" color="gray" size="lg" radius="sm" data-testid={`${testId}-count`}>
              {formatCount(list.totalCount, t.count.runs)}
            </Badge>
          )}
          <Tooltip label={common.refresh}>
            <ActionIcon
              variant="subtle"
              color="gray"
              onClick={() => void reload()}
              loading={loading}
              aria-label={common.refresh}
              data-testid={`${testId}-refresh`}
            >
              <IconRefresh size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>

        {empty && failure && (
          <CronListEmptyState
            error
            title={interpolate(t.runsTable.emptyState.loadError, { error: failure.message })}
            data-testid={`${testId}-load-error`}
          />
        )}

        {empty && !failure && (
          <CronListEmptyState
            title={jobId === undefined ? t.runsTable.emptyState.allJobs : t.runsTable.emptyState.job}
            data-testid={`${testId}-empty`}
          />
        )}

        {!empty && (
          <VTable
            headers={headers}
            items={runs as unknown as Item[]}
            itemKey="id"
            showSelect="none"
            fixedHeader
            loading={loading}
            clickable
            renderCell={renderCell}
            renderRowAppend={renderRowAppend}
            renderFooter={() => (
              <CronListFooter
                shown={runs.length}
                totalCount={list.totalCount}
                itemsLabel={t.runsTable.itemsLabel}
                page={list.page}
                totalPages={list.totalPages}
                onPageChange={list.setPage}
                limit={list.limit}
                sizeOptions={list.sizeOptions}
                onLimitChange={list.setLimit}
                data-testid={`${testId}-page-size`}
                translations={translations}
              />
            )}
            onRowClick={({ item }) => setSelectedRun(item as unknown as CronRunRecord)}
          />
        )}
      </div>

      <CronRunLogModal
        run={selectedRun}
        onClose={() => setSelectedRun(null)}
        showJobName={showJobColumn}
        translations={translations}
      />
    </>
  );
};

export default CronRunsTable;
