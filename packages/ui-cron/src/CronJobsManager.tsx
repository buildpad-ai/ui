'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Center,
  Code,
  Group,
  Loader,
  Stack,
  Tabs,
  Text,
  Title,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconClock,
  IconHistory,
  IconList,
  IconPlayerPlayFilled,
  IconPlus,
  IconRefresh,
} from '@tabler/icons-react';
import { readUrlParam, useCronJobs, useHydrated, usePermissions, useUrlListParams } from '@buildpad/hooks';
import { useBuildpadI18n, useBuildpadTranslations } from '@buildpad/services';
import { CRON_JOBS_COLLECTION, type CronJobRecord } from '@buildpad/types';
import { VTable } from '@buildpad/ui-table';
import type { Header, HeaderRaw, Item } from '@buildpad/ui-table';
import {
  displayCronTimezone,
  interpolate,
  pageAfterRemoval,
  type CronTranslations,
  type DeepPartial,
} from '@buildpad/utils';
import { CRON_DATE_TIME_FORMAT } from './cronFormat';
import { CronDeleteConfirmModal } from './CronDeleteConfirmModal';
import { CronJobStatusBadge } from './CronJobStatusBadge';
import { CronListEmptyState } from './CronListEmptyState';
import { CronListFooter } from './CronListFooter';
import { CronPageState } from './CronPageState';
import { CronRowActionsMenu } from './CronRowActionsMenu';
import { CronRunStatusBadge } from './CronRunStatusBadge';
import { CronRunsTable } from './CronRunsTable';
import { CronSearchInput } from './CronSearchInput';
import { useCronList } from './useCronList';
import './CronManagerTable.css';

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

type ManagerTab = 'jobs' | 'history';

/** The tab a `tab` URL parameter names; anything but `history` is the jobs list. */
function readTab(value: string | null): ManagerTab {
  return value === 'history' ? 'history' : 'jobs';
}

export interface CronJobsManagerProps {
  /**
   * Called when a job is opened: a row click, the row's Open button (the
   * job's name) and the row menu's Edit. Without it rows do not open and the
   * menu has no Edit.
   */
  onJobClick?: (job: CronJobRecord) => void;
  /** Called when the "New Cron Job" button is clicked. Without it the button is not drawn. */
  onCreateJob?: () => void;
  /**
   * DaaS collection used for RBAC checks. Default: 'daas_cron_jobs', the one
   * name both backends decide every cron route by — the two history routes
   * included. Gate on another name and the buttons no longer match what the
   * API allows.
   */
  collection?: string;
  /** Initial jobs per page (changeable via the footer selector). Default: 25. */
  pageSize?: number;
  /** Choices offered by the footer page-size selectors. Default: [10, 25, 50, 100]. */
  pageSizeOptions?: number[];
  /** Initial runs per page on the History tab. Default: 50. */
  historyPageSize?: number;
  /** Hide the built-in heading for embedded surfaces; the New Cron Job button stays. Default: false. */
  hideHeader?: boolean;
  /**
   * Persist the search, the page and the open tab in the URL query string
   * (`search`, `page`, `tab`) so the list is shareable and reload-safe. Writes
   * ride the 300 ms search debounce and go through the app's registered URL
   * writer (Next.js App Router: `router.replace`, registered by the
   * `DaaSProviderWrapper` template — required there); outside a router they
   * fall back to `history.replaceState`. Set `false` for embedded surfaces.
   * Default: true.
   */
  urlParams?: boolean;
  /** Prefix for the managed URL parameters when two lists share a page. Default: ''. */
  urlParamPrefix?: string;
  /** Per-instance overrides of the `cron` dictionary namespace (prop > provider > defaults). */
  translations?: DeepPartial<CronTranslations>;
}

/**
 * Cron jobs list: a Jobs tab (search, refresh, the table of jobs with their
 * schedule, timezone, status, last run and next run, a row menu for Edit, Run
 * Now, Activate or Deactivate, Clone and Delete, and pagination with a
 * page-size selector) and a History tab with the runs of every job
 * (`CronRunsTable`). Ported from the buildpad-daas reference
 * `app/[lang]/cron/page.tsx` to `useCronJobs` + `usePermissions` and
 * routing-agnostic navigation through `onJobClick` / `onCreateJob`.
 *
 * What differs from the reference, on purpose:
 *
 * - No redirect. A caller who may not read gets the access-denied state in
 *   place; the reference sent them to the home page.
 * - A load that fails says so (the load-error state and a notification) and
 *   clears the rows. The reference kept the rows of the load before it on
 *   screen, and only the answer to the latest request is drawn now.
 * - Deleting the only row of the last page loads the page before it
 *   (`pageAfterRemoval`), and an answer that puts the page past the end of the
 *   list loads the last page (`clampPage`). The reference reloaded the same,
 *   now empty, page, and its pager disappeared.
 * - The delete confirm is pending while the delete runs and takes no second
 *   click; the reference sent one DELETE per click.
 * - Run Now, Activate, Deactivate and Clone show a pending row menu and take
 *   no second click while they run.
 * - Run Now reads its answer: a job that was already running was not started
 *   again, and the notification says so instead of "started". The list is
 *   loaded again when the request is answered — which is when the run has
 *   ended — not two seconds after the click.
 * - A job opens from the keyboard: its name is a button with a name of its
 *   own, and the row takes focus. The reference's rows answered a mouse click
 *   only.
 * - The row menu is not drawn for a user with no action in it; the reference
 *   drew a trigger that opened an empty menu.
 * - Next Run is shown for an active job only: both backends leave the last
 *   computed time on a job that is deactivated, and an inactive job never
 *   fires.
 * - The footer (count, page size, pager) is always there, and the search, the
 *   page and the open tab survive a reload (`urlParams`).
 * - Dates follow the locale and the time zone of the `BuildpadI18nProvider`.
 *
 * Client-only gate: the body seeds its state from the URL in `useState`
 * initializers, which renders differently on the server (no URL) and on the
 * client — a hydration mismatch on every deep link. Until hydrated, render the
 * loading shell; skipped when URL persistence is off.
 */
export const CronJobsManager: React.FC<CronJobsManagerProps> = (props) => {
  const hydrated = useHydrated();
  if (props.urlParams !== false && !hydrated) {
    return (
      <Center mih={240}>
        <Loader />
      </Center>
    );
  }
  return <CronJobsManagerBody {...props} />;
};

const CronJobsManagerBody: React.FC<CronJobsManagerProps> = ({
  onJobClick,
  onCreateJob,
  collection = CRON_JOBS_COLLECTION,
  pageSize = 25,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  historyPageSize = 50,
  hideHeader = false,
  urlParams = true,
  urlParamPrefix = '',
  translations,
}) => {
  const { fetchJobs, updateJob, deleteJob, cloneJob, runJob } = useCronJobs();
  const { canPerform, isAdmin, loading: permsLoading } = usePermissions({ collections: [collection] });
  const t = useBuildpadTranslations((d) => d.cron, translations);
  const common = useBuildpadTranslations((d) => d.common);
  const { formatCount, formatDate } = useBuildpadI18n();

  const createAllowed = permsLoading || isAdmin || canPerform(collection, 'create');
  const updateAllowed = permsLoading || isAdmin || canPerform(collection, 'update');
  const deleteAllowed = permsLoading || isAdmin || canPerform(collection, 'delete');

  // -- Tabs -------------------------------------------------------------------

  const tabParam = `${urlParamPrefix}tab`;
  const [tab, setTab] = useState<ManagerTab>(() => (urlParams ? readTab(readUrlParam(tabParam)) : 'jobs'));
  useUrlListParams({
    enabled: urlParams,
    params: { [tabParam]: tab === 'history' ? 'history' : null },
    onExternalChange: useCallback(
      (get: (name: string) => string | null) => {
        const next = readTab(get(tabParam));
        setTab((current) => (current === next ? current : next));
      },
      [tabParam],
    ),
  });

  // The history is loaded when its tab is first opened, and again each time
  // the tab is opened after that: runs are written while the page is open.
  const [historyOpened, setHistoryOpened] = useState(tab === 'history');
  const [historyVisits, setHistoryVisits] = useState(0);
  const previousTabRef = useRef(tab);
  useEffect(() => {
    if (previousTabRef.current === tab) return;
    previousTabRef.current = tab;
    if (tab !== 'history') return;
    setHistoryOpened(true);
    setHistoryVisits((visits) => visits + 1);
  }, [tab]);

  // -- The jobs list ------------------------------------------------------------

  const headers = useMemo<HeaderRaw[]>(
    () => [
      { text: '', value: 'icon', sortable: false, width: 48 },
      { text: t.jobsManager.columns.name, value: 'name', sortable: false },
      { text: t.jobsManager.columns.schedule, value: 'schedule', sortable: false },
      { text: t.jobsManager.columns.timezone, value: 'timezone', sortable: false },
      { text: t.jobsManager.columns.status, value: 'status', sortable: false },
      { text: t.jobsManager.columns.lastRun, value: 'lastRun', sortable: false },
      { text: t.jobsManager.columns.lastStatus, value: 'lastStatus', sortable: false },
      { text: t.jobsManager.columns.nextRun, value: 'nextRun', sortable: false },
    ],
    [t],
  );

  const list = useCronList<CronJobRecord>({
    fetchPage: fetchJobs,
    pageSize,
    pageSizeOptions,
    urlParams,
    urlParamPrefix,
    loadFailedTitle: common.error,
    loadFailedMessage: t.jobsManager.notifications.loadFailed,
  });
  const { rows: jobs, loading, failure, page, setPage, reload } = list;

  // A row action can outlive the page it was started on (Run Now is answered
  // when the run has ended): it reloads whatever the list shows by then.
  const reloadRef = useRef(reload);
  reloadRef.current = reload;
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // -- Row actions --------------------------------------------------------------

  // The jobs with an action in flight. The state draws the pending row menu on
  // the next render; the ref refuses a second click that arrives before it.
  const [pendingJobs, setPendingJobs] = useState<Record<string, true>>({});
  const pendingJobsRef = useRef(new Set<string>());

  const runRowAction = useCallback(
    async (job: CronJobRecord, failedMessage: string, work: () => Promise<void>) => {
      if (pendingJobsRef.current.has(job.id)) return;
      pendingJobsRef.current.add(job.id);
      setPendingJobs((current) => ({ ...current, [job.id]: true }));
      try {
        await work();
        if (mountedRef.current) await reloadRef.current();
      } catch (err) {
        notifications.show({
          title: common.error,
          message: err instanceof Error && err.message ? err.message : failedMessage,
          color: 'red',
        });
      } finally {
        pendingJobsRef.current.delete(job.id);
        setPendingJobs((current) => {
          const { [job.id]: _done, ...rest } = current;
          return rest;
        });
      }
    },
    [common],
  );

  const handleRunNow = useCallback(
    (job: CronJobRecord) =>
      runRowAction(job, t.jobsManager.notifications.runFailed, async () => {
        const result = await runJob(job.id);
        if (result.skipped) {
          // Nothing ran: the job was already running, and saying "started" would be false
          notifications.show({
            title: t.notificationTitles.runSkipped,
            message: interpolate(t.jobsManager.notifications.runSkipped, { name: job.name }),
            color: 'yellow',
          });
        } else {
          notifications.show({
            title: t.notificationTitles.triggered,
            message: interpolate(t.jobsManager.notifications.triggered, { name: job.name }),
            color: 'blue',
            icon: <IconPlayerPlayFilled size={16} />,
          });
        }
      }),
    [runRowAction, runJob, t],
  );

  const handleActivate = useCallback(
    (job: CronJobRecord) =>
      runRowAction(job, t.jobsManager.notifications.activateFailed, async () => {
        await updateJob(job.id, { status: 'active' });
        notifications.show({
          title: t.notificationTitles.activated,
          message: interpolate(t.jobsManager.notifications.activated, { name: job.name }),
          color: 'green',
        });
      }),
    [runRowAction, updateJob, t],
  );

  const handleDeactivate = useCallback(
    (job: CronJobRecord) =>
      runRowAction(job, t.jobsManager.notifications.deactivateFailed, async () => {
        await updateJob(job.id, { status: 'inactive' });
        notifications.show({
          title: t.notificationTitles.deactivated,
          message: interpolate(t.jobsManager.notifications.deactivated, { name: job.name }),
          color: 'yellow',
        });
      }),
    [runRowAction, updateJob, t],
  );

  const handleClone = useCallback(
    (job: CronJobRecord) =>
      runRowAction(job, t.jobsManager.notifications.cloneFailed, async () => {
        await cloneJob(job.id);
        notifications.show({
          title: t.notificationTitles.cloned,
          message: interpolate(t.jobsManager.notifications.cloned, { name: job.name }),
          color: 'green',
        });
      }),
    [runRowAction, cloneJob, t],
  );

  // -- Delete -------------------------------------------------------------------

  const [deleteModal, setDeleteModal] = useState<{ opened: boolean; id: string; name: string }>({
    opened: false,
    id: '',
    name: '',
  });
  const [deleting, setDeleting] = useState(false);
  // The state above disables the button on the next render; the ref refuses a
  // second click that arrives before that render.
  const deletingRef = useRef(false);

  const confirmDelete = useCallback(async () => {
    if (deletingRef.current) return;
    deletingRef.current = true;
    setDeleting(true);
    try {
      await deleteJob(deleteModal.id);
      setDeleteModal((current) => ({ ...current, opened: false }));
      notifications.show({
        title: t.notificationTitles.deleted,
        message: interpolate(t.jobsManager.notifications.deleted, { name: deleteModal.name }),
        color: 'red',
      });
      // The row is gone: stay on the page while it has another row, otherwise
      // load the page before it. Changing the page reloads through the effect.
      const nextPage = pageAfterRemoval(page, jobs.length);
      if (nextPage === page) {
        await reload();
      } else {
        setPage(nextPage);
      }
    } catch (err) {
      // Keep the modal open so the user can retry or cancel.
      notifications.show({
        title: common.error,
        message: err instanceof Error && err.message ? err.message : t.jobsManager.notifications.deleteFailed,
        color: 'red',
      });
    } finally {
      deletingRef.current = false;
      setDeleting(false);
    }
  }, [deleteJob, deleteModal.id, deleteModal.name, reload, page, setPage, jobs.length, t, common]);

  // -- Cells --------------------------------------------------------------------

  // `formatDate` returns '' for an empty or invalid value
  const dateTime = useCallback(
    (value: string | null | undefined) => formatDate(value, CRON_DATE_TIME_FORMAT) || t.emptyValue,
    [formatDate, t],
  );

  const renderCell = useCallback(
    (item: Item, header: Header): React.ReactNode => {
      const job = item as unknown as CronJobRecord;
      switch (header.value) {
        case 'icon':
          return <IconClock size={20} color="var(--mantine-color-teal-6)" />;
        case 'name':
          return (
            <Stack gap={2}>
              {onJobClick ? (
                // A real button: the way into a job for a keyboard and for a
                // screen reader, which a clickable row alone does not give
                <UnstyledButton
                  onClick={(e) => {
                    // The row's own click would open the job a second time
                    e.stopPropagation();
                    onJobClick(job);
                  }}
                  aria-label={interpolate(t.jobsManager.openAriaLabel, { name: job.name })}
                  data-testid="cron-jobs-manager-open-job"
                >
                  <Text size="sm" fw={500}>
                    {job.name}
                  </Text>
                </UnstyledButton>
              ) : (
                <Text size="sm" fw={500}>
                  {job.name}
                </Text>
              )}
              {job.description && (
                <Text size="xs" c="dimmed" lineClamp={1}>
                  {job.description}
                </Text>
              )}
            </Stack>
          );
        case 'schedule':
          // Absent is "withheld by the caller's grant"
          return job.schedule ? <Code>{job.schedule}</Code> : <Text size="xs" c="dimmed">{t.emptyValue}</Text>;
        case 'timezone':
          return (
            <Text size="xs" c="dimmed">
              {displayCronTimezone(job.timezone) || t.emptyValue}
            </Text>
          );
        case 'status':
          return <CronJobStatusBadge status={job.status} translations={translations} />;
        case 'lastRun':
          return (
            <Text size="xs" c="dimmed">
              {dateTime(job.last_run_at)}
            </Text>
          );
        case 'lastStatus':
          return <CronRunStatusBadge status={job.last_run_status} translations={translations} />;
        case 'nextRun':
          return (
            <Text size="xs" c="dimmed">
              {/* A job that is not active never fires, whatever time is left on it */}
              {job.status === 'active' ? dateTime(job.next_run_at) : t.emptyValue}
            </Text>
          );
        default:
          return null;
      }
    },
    [t, translations, onJobClick, dateTime],
  );

  const canEdit = updateAllowed && Boolean(onJobClick);
  const renderRowAppend =
    canEdit || updateAllowed || createAllowed || deleteAllowed
      ? (item: Item) => {
          const job = item as unknown as CronJobRecord;
          const active = job.status === 'active';
          return (
            <CronRowActionsMenu
              jobName={job.name}
              onEdit={canEdit ? () => onJobClick?.(job) : undefined}
              onRunNow={updateAllowed ? () => void handleRunNow(job) : undefined}
              onActivate={updateAllowed && !active ? () => void handleActivate(job) : undefined}
              onDeactivate={updateAllowed && active ? () => void handleDeactivate(job) : undefined}
              onClone={createAllowed ? () => void handleClone(job) : undefined}
              onDelete={
                deleteAllowed ? () => setDeleteModal({ opened: true, id: job.id, name: job.name }) : undefined
              }
              pending={Boolean(pendingJobs[job.id])}
              translations={translations}
            />
          );
        }
      : undefined;

  // -- Chrome -------------------------------------------------------------------

  const addButton =
    createAllowed && onCreateJob ? (
      <Button leftSection={<IconPlus size={16} />} onClick={onCreateJob} data-testid="cron-jobs-manager-add-btn">
        {t.jobsManager.newJob}
      </Button>
    ) : null;

  const header = (!hideHeader || addButton) && (
    <Group justify={hideHeader ? 'flex-end' : 'space-between'}>
      {!hideHeader && <Title order={2}>{t.jobsManager.title}</Title>}
      {addButton}
    </Group>
  );

  if (failure?.kind === 'accessDenied') {
    return (
      <Stack gap="md" data-testid="cron-jobs-manager">
        {!hideHeader && <Title order={2}>{t.jobsManager.title}</Title>}
        <CronPageState
          variant="accessDenied"
          title={t.accessDenied.title}
          description={failure.description || t.accessDenied.description}
          data-testid="cron-jobs-manager-access-denied"
        />
      </Stack>
    );
  }

  const empty = !loading && jobs.length === 0;

  return (
    <Stack gap="md" data-testid="cron-jobs-manager">
      {header}

      <Tabs value={tab} onChange={(value) => setTab(readTab(value))}>
        <Tabs.List mb="md">
          <Tabs.Tab value="jobs" leftSection={<IconList size={14} />} data-testid="cron-jobs-manager-tab-jobs">
            {t.jobsManager.tabs.jobs}
          </Tabs.Tab>
          <Tabs.Tab
            value="history"
            leftSection={<IconHistory size={14} />}
            data-testid="cron-jobs-manager-tab-history"
          >
            {t.jobsManager.tabs.history}
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="jobs">
          <div className="bp-cron-manager-card">
            <Group className="bp-cron-manager-toolbar" wrap="wrap">
              <CronSearchInput
                placeholder={t.jobsManager.searchPlaceholder}
                value={list.search}
                onChange={list.setSearch}
                style={{ flex: 1, minWidth: 200, maxWidth: 360 }}
                data-testid="cron-jobs-manager-search"
                translations={translations}
              />
              <Group gap="sm" style={{ marginLeft: 'auto' }}>
                {!failure && (
                  <Badge variant="light" color="gray" size="lg" radius="sm" data-testid="cron-jobs-manager-count">
                    {formatCount(list.totalCount, t.count.jobs)}
                  </Badge>
                )}
                <Tooltip label={common.refresh}>
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    onClick={() => void reload()}
                    loading={loading}
                    aria-label={common.refresh}
                    data-testid="cron-jobs-manager-refresh"
                  >
                    <IconRefresh size={16} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </Group>

            {empty && failure && (
              <CronListEmptyState
                error
                title={interpolate(t.jobsManager.emptyState.loadError, { error: failure.message })}
                data-testid="cron-jobs-manager-load-error"
              />
            )}

            {empty && !failure && (
              <CronListEmptyState
                title={list.debouncedSearch ? t.jobsManager.emptyState.search : t.jobsManager.emptyState.pristine}
                data-testid="cron-jobs-manager-empty"
              />
            )}

            {!empty && (
              <VTable
                headers={headers}
                items={jobs as unknown as Item[]}
                itemKey="id"
                showSelect="none"
                fixedHeader
                loading={loading}
                clickable={Boolean(onJobClick)}
                renderCell={renderCell}
                renderRowAppend={renderRowAppend}
                renderFooter={() => (
                  <CronListFooter
                    shown={jobs.length}
                    totalCount={list.totalCount}
                    itemsLabel={t.jobsManager.itemsLabel}
                    page={page}
                    totalPages={list.totalPages}
                    onPageChange={setPage}
                    limit={list.limit}
                    sizeOptions={list.sizeOptions}
                    onLimitChange={list.setLimit}
                    data-testid="cron-jobs-manager-page-size"
                    translations={translations}
                  />
                )}
                onRowClick={onJobClick ? ({ item }) => onJobClick(item as unknown as CronJobRecord) : undefined}
              />
            )}
          </div>
        </Tabs.Panel>

        <Tabs.Panel value="history">
          {historyOpened && (
            <CronRunsTable
              pageSize={historyPageSize}
              pageSizeOptions={pageSizeOptions}
              refreshKey={historyVisits}
              data-testid="cron-jobs-manager-history"
              translations={translations}
            />
          )}
        </Tabs.Panel>
      </Tabs>

      <CronDeleteConfirmModal
        opened={deleteModal.opened}
        onClose={() => setDeleteModal((current) => ({ ...current, opened: false }))}
        onConfirm={confirmDelete}
        loading={deleting}
        title={t.jobsManager.deleteModal.title}
        description={interpolate(t.jobsManager.deleteModal.description, { name: deleteModal.name })}
      />
    </Stack>
  );
};

export default CronJobsManager;
