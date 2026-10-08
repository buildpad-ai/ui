'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Box, Button, Center, Group, Loader, Stack, Text, Title } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconGitBranch, IconPlus } from '@tabler/icons-react';
import {
  DaaSRequestError,
  readUrlIntParam,
  readUrlParam,
  useHydrated,
  usePermissions,
  useUrlListParams,
  useWorkflowDefinitions,
} from '@buildpad/hooks';
import { useBuildpadI18n, useBuildpadTranslations } from '@buildpad/services';
import { WORKFLOW_DEFINITION_COLLECTION, type WorkflowDefinitionRecord } from '@buildpad/types';
import { VTable } from '@buildpad/ui-table';
import type { Header, HeaderRaw, Item } from '@buildpad/ui-table';
import {
  clampPage,
  interpolate,
  pageAfterRemoval,
  type DeepPartial,
  type WorkflowsTranslations,
} from '@buildpad/utils';
import { WorkflowDeleteConfirmModal } from './WorkflowDeleteConfirmModal';
import { WorkflowListEmptyState } from './WorkflowListEmptyState';
import { WorkflowListFooter } from './WorkflowListFooter';
import { WorkflowPageState } from './WorkflowPageState';
import { WorkflowRowActionsMenu } from './WorkflowRowActionsMenu';
import { WorkflowSearchInput } from './WorkflowSearchInput';
import './WorkflowManagerTable.css';

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

/** Why the list has no rows to show, when the reason is not "there are none". */
type LoadFailure =
  | {
      kind: 'accessDenied';
      /** The server's own sentence, when it says what to do (a second factor is required) */
      description?: string;
    }
  | { kind: 'error'; message: string };

export interface WorkflowsManagerProps {
  /** Called when a definition row is clicked, and by the row menu's Edit. */
  onWorkflowClick?: (workflow: WorkflowDefinitionRecord) => void;
  /** Called when the "Add Workflow" button is clicked. */
  onCreateWorkflow?: () => void;
  /** Initial items per page (changeable via the footer selector). Default: 25. */
  pageSize?: number;
  /** Choices offered by the footer page-size selector. Default: [10, 25, 50, 100]. */
  pageSizeOptions?: number[];
  /** Hide the built-in heading + subtitle for embedded surfaces; the Add Workflow button stays. Default: false. */
  hideHeader?: boolean;
  /**
   * DaaS collection used for RBAC checks. Default: 'daas_wf_definition', the
   * name both backends enforce — gate on another name and the page is hidden
   * from users the API would serve.
   */
  workflowsCollection?: string;
  /**
   * Persist search and page in the URL query string so the list is
   * shareable and reload-safe. Writes ride the 300 ms search debounce and go
   * through the app's registered URL writer (Next.js App Router:
   * `router.replace`, registered by the `DaaSProviderWrapper` template —
   * required there); outside a router they fall back to `history.replaceState`.
   * Set `false` for embedded surfaces. Default: true.
   */
  urlParams?: boolean;
  /** Prefix for the managed URL parameters when two lists share a page. Default: ''. */
  urlParamPrefix?: string;
  /** Per-instance overrides of the `workflows` dictionary namespace (prop > provider > defaults). */
  translations?: DeepPartial<WorkflowsTranslations>;
}

/**
 * Workflow definitions list: search by name or description, a count, the
 * table (name, initial state, number of states, description), a row menu for
 * edit/delete, and pagination with a page-size selector. Ported from the
 * buildpad-daas reference `app/[lang]/workflows/page.tsx` to
 * `useWorkflowDefinitions` + `usePermissions` and routing-agnostic navigation
 * through `onWorkflowClick` / `onCreateWorkflow`.
 *
 * What differs from the reference, on purpose:
 *
 * - A load that fails says so. A refusal draws the access-denied state and any
 *   other failure the load-error state; the reference showed both as "No
 *   workflow definitions found".
 * - Deleting the only row of the last page loads the page before it
 *   (`pageAfterRemoval`), and an answer that puts the page past the end of the
 *   list loads the last page (`clampPage`). The reference reloaded the same,
 *   now empty, page.
 * - The confirm button is pending while the delete runs and takes no second
 *   click; a failed delete is a notification with the server's sentence and
 *   the dialog stays open. The reference sent one DELETE per click and raised a
 *   native `alert()`.
 * - A row opens for every reader (the editor is read-only without update
 *   access); the reference let only updaters open one.
 *
 * Client-only gate: the body seeds its state from the URL in `useState`
 * initializers, which renders differently on the server (no URL) and on the
 * client — a hydration mismatch on every deep link. Until hydrated, render the
 * loading shell; skipped when URL persistence is off.
 */
export const WorkflowsManager: React.FC<WorkflowsManagerProps> = (props) => {
  const hydrated = useHydrated();
  if (props.urlParams !== false && !hydrated) {
    return (
      <Center mih={240}>
        <Loader />
      </Center>
    );
  }
  return <WorkflowsManagerBody {...props} />;
};

const WorkflowsManagerBody: React.FC<WorkflowsManagerProps> = ({
  onWorkflowClick,
  onCreateWorkflow,
  pageSize = 25,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  hideHeader = false,
  workflowsCollection = WORKFLOW_DEFINITION_COLLECTION,
  urlParams = true,
  urlParamPrefix = '',
  translations,
}) => {
  const { fetchDefinitions, deleteDefinition } = useWorkflowDefinitions();
  const { canPerform, isAdmin, loading: permsLoading } = usePermissions({
    collections: [workflowsCollection],
  });
  const t = useBuildpadTranslations((d) => d.workflows, translations);
  const common = useBuildpadTranslations((d) => d.common);
  const { formatCount } = useBuildpadI18n();

  const createAllowed = permsLoading || isAdmin || canPerform(workflowsCollection, 'create');
  const updateAllowed = permsLoading || isAdmin || canPerform(workflowsCollection, 'update');
  const deleteAllowed = permsLoading || isAdmin || canPerform(workflowsCollection, 'delete');

  const headers = useMemo<HeaderRaw[]>(
    () => [
      { text: '', value: 'icon', sortable: false, width: 48 },
      { text: t.workflowsManager.columns.name, value: 'name', sortable: false },
      { text: t.workflowsManager.columns.initialState, value: 'initialState', sortable: false },
      { text: t.workflowsManager.columns.states, value: 'states', sortable: false },
      { text: t.workflowsManager.columns.description, value: 'description', sortable: false },
    ],
    [t],
  );

  const [workflows, setWorkflows] = useState<WorkflowDefinitionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<LoadFailure | null>(null);
  const param = useCallback((name: string) => urlParamPrefix + name, [urlParamPrefix]);
  const [page, setPage] = useState(() => (urlParams ? readUrlIntParam(param('page'), 1) : 1));
  const [limit, setLimit] = useState(pageSize);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [search, setSearch] = useState(() => (urlParams ? (readUrlParam(param('search')) ?? '') : ''));
  const [debouncedSearch] = useDebouncedValue(search, 300);

  // URL persistence — see useUrlListParams. Defaults serialize to null so they
  // stay off the URL; Back/Forward and bridge rewrites flow back in below.
  useUrlListParams({
    enabled: urlParams,
    params: {
      [param('search')]: debouncedSearch || null,
      [param('page')]: page > 1 ? String(page) : null,
    },
    onExternalChange: useCallback(
      (get: (name: string) => string | null) => {
        const nextSearch = get(param('search')) ?? '';
        setSearch((current) => (current === nextSearch ? current : nextSearch));
        const rawPage = get(param('page'));
        const value = rawPage ? Number.parseInt(rawPage, 10) : 1;
        const nextPage = Number.isInteger(value) && value > 0 ? value : 1;
        setPage((current) => (current === nextPage ? current : nextPage));
      },
      [param],
    ),
  });

  const [deleteModal, setDeleteModal] = useState<{ opened: boolean; id: string }>({
    opened: false,
    id: '',
  });
  const [deleting, setDeleting] = useState(false);
  // The state above disables the button on the next render; the ref refuses a
  // second click that arrives before that render.
  const deletingRef = useRef(false);

  const sizeOptions = useMemo(() => {
    return Array.from(new Set([...pageSizeOptions, pageSize])).sort((a, b) => a - b);
  }, [pageSizeOptions, pageSize]);

  // Only the answer to the latest request may be drawn: a slow answer to an
  // earlier search must not replace the rows of a later one.
  const requestRef = useRef(0);

  const load = useCallback(async () => {
    const request = ++requestRef.current;
    setLoading(true);
    try {
      const result = await fetchDefinitions({
        page,
        limit,
        search: debouncedSearch || undefined,
      });
      if (request !== requestRef.current) return;

      // Rows can also go because someone else deleted them: a page past the
      // end of the list is answered empty, so load the last page instead.
      const lastPage = clampPage(page, result.totalPages);
      if (lastPage !== page) {
        setPage(lastPage);
        return;
      }

      setWorkflows(result.items);
      setTotalCount(result.total);
      setTotalPages(result.totalPages);
      setFailure(null);
      setLoading(false);
    } catch (err) {
      if (request !== requestRef.current) return;
      const message = err instanceof Error && err.message ? err.message : t.workflowsManager.notifications.loadFailed;
      const kind = err instanceof DaaSRequestError ? err.kind : 'failure';
      setWorkflows([]);
      setTotalCount(0);
      setTotalPages(1);
      setLoading(false);
      if (kind === 'forbidden' || kind === 'mfaRequired') {
        setFailure({ kind: 'accessDenied', description: kind === 'mfaRequired' ? message : undefined });
      } else {
        setFailure({ kind: 'error', message });
        notifications.show({ title: t.workflowsManager.notifications.loadFailed, message, color: 'red' });
      }
    }
  }, [fetchDefinitions, page, limit, debouncedSearch, t]);

  useEffect(() => {
    void load();
  }, [load]);

  // Only on CHANGES — not mount, or a ?page= restored from the URL is clobbered.
  // StrictMode-safe: compare against the previous values rather than "has
  // mounted". StrictMode re-runs mount effects with refs intact, so a
  // has-mounted flag fires setPage(1) on the second run and clobbers a
  // ?page= restored from the URL in development.
  const filtersKey = JSON.stringify([debouncedSearch, limit]);
  const previousFiltersKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (previousFiltersKeyRef.current !== null && previousFiltersKeyRef.current !== filtersKey) {
      setPage(1);
    }
    previousFiltersKeyRef.current = filtersKey;
  }, [filtersKey]);

  const confirmDelete = useCallback(async () => {
    if (deletingRef.current) return;
    deletingRef.current = true;
    setDeleting(true);
    try {
      await deleteDefinition(deleteModal.id);
      setDeleteModal({ opened: false, id: '' });
      notifications.show({
        title: common.success,
        message: t.workflowsManager.notifications.deleted,
        color: 'green',
      });
      // The row is gone: stay on the page while it has another row, otherwise
      // load the page before it. Changing the page reloads through the effect.
      const nextPage = pageAfterRemoval(page, workflows.length);
      if (nextPage === page) {
        await load();
      } else {
        setPage(nextPage);
      }
    } catch (err) {
      // Keep the modal open so the user can retry or cancel.
      notifications.show({
        title: t.workflowsManager.notifications.deleteFailed,
        message: err instanceof Error && err.message ? err.message : t.workflowsManager.notifications.deleteFailed,
        color: 'red',
      });
    } finally {
      deletingRef.current = false;
      setDeleting(false);
    }
  }, [deleteDefinition, deleteModal.id, load, page, workflows.length, t, common]);

  const addButton =
    createAllowed && onCreateWorkflow ? (
      <Button
        leftSection={<IconPlus size={16} />}
        onClick={onCreateWorkflow}
        data-testid="workflows-manager-add-btn"
      >
        {t.workflowsManager.addWorkflow}
      </Button>
    ) : null;

  const renderCell = useCallback(
    (item: Item, header: Header): React.ReactNode => {
      const workflow = item as unknown as WorkflowDefinitionRecord;
      switch (header.value) {
        case 'icon':
          return <IconGitBranch size={20} color="var(--mantine-color-blue-6)" />;
        case 'name':
          return (
            <Text size="sm" fw={500}>
              {workflow.name}
            </Text>
          );
        case 'initialState':
          return (
            <Badge variant="light" color="blue">
              {workflow.workflow_json?.initial_state || t.workflowsManager.emptyValue}
            </Badge>
          );
        case 'states':
          // Absent is "withheld by the caller's grant", which is not "no states"
          return (
            <Text size="sm">{workflow.workflow_json?.states?.length ?? t.workflowsManager.emptyValue}</Text>
          );
        case 'description':
          return (
            <Text size="sm" c="dimmed" lineClamp={1}>
              {workflow.description || t.workflowsManager.emptyValue}
            </Text>
          );
        default:
          return null;
      }
    },
    [t],
  );

  const renderRowAppend =
    updateAllowed || deleteAllowed
      ? (item: Item) => {
          const workflow = item as unknown as WorkflowDefinitionRecord;
          return (
            <WorkflowRowActionsMenu
              onEdit={updateAllowed && onWorkflowClick ? () => onWorkflowClick(workflow) : undefined}
              onDelete={
                deleteAllowed ? () => setDeleteModal({ opened: true, id: workflow.id }) : undefined
              }
              translations={translations}
            />
          );
        }
      : undefined;

  const header = !hideHeader && (
    <Box>
      <Title order={2} mb={4}>
        {t.workflowsManager.title}
      </Title>
      <Text size="sm" c="dimmed">
        {t.workflowsManager.subtitle}
      </Text>
    </Box>
  );

  if (failure?.kind === 'accessDenied') {
    return (
      <Stack gap="md" data-testid="workflows-manager">
        {header}
        <WorkflowPageState
          variant="accessDenied"
          title={t.accessDenied.title}
          description={failure.description || t.accessDenied.description}
          data-testid="workflows-manager-access-denied"
        />
      </Stack>
    );
  }

  const empty = !loading && workflows.length === 0;

  return (
    <Stack gap="md" data-testid="workflows-manager">
      {header}

      <div className="bp-workflow-manager-card">
        <Group className="bp-workflow-manager-toolbar" wrap="wrap">
          <WorkflowSearchInput
            placeholder={t.workflowsManager.searchPlaceholder}
            value={search}
            onChange={setSearch}
            style={{ flex: 1, minWidth: 200, maxWidth: 360 }}
            data-testid="workflows-manager-search"
            translations={translations}
          />
          <Group gap="sm" style={{ marginLeft: 'auto' }}>
            {!failure && (
              <Badge variant="light" color="gray" size="lg" radius="sm" data-testid="workflows-manager-count">
                {formatCount(totalCount, t.count.workflows)}
              </Badge>
            )}
            {addButton}
          </Group>
        </Group>

        {empty && failure && (
          <WorkflowListEmptyState
            error
            title={interpolate(t.workflowsManager.emptyState.loadError, { error: failure.message })}
            data-testid="workflows-manager-load-error"
          />
        )}

        {empty && !failure && (
          <WorkflowListEmptyState
            title={t.workflowsManager.emptyState.title}
            hint={debouncedSearch ? t.workflowsManager.emptyState.search : t.workflowsManager.emptyState.pristine}
            data-testid="workflows-manager-empty"
          />
        )}

        {!empty && (
          <VTable
            headers={headers}
            items={workflows as unknown as Item[]}
            itemKey="id"
            showSelect="none"
            fixedHeader
            loading={loading}
            clickable={Boolean(onWorkflowClick)}
            renderCell={renderCell}
            renderRowAppend={renderRowAppend}
            renderFooter={() => (
              <WorkflowListFooter
                shown={workflows.length}
                totalCount={totalCount}
                itemsLabel={t.workflowsManager.itemsLabel}
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
                limit={limit}
                sizeOptions={sizeOptions}
                onLimitChange={setLimit}
                data-testid="workflows-manager-page-size"
                translations={translations}
              />
            )}
            onRowClick={
              onWorkflowClick
                ? ({ item }) => onWorkflowClick(item as unknown as WorkflowDefinitionRecord)
                : undefined
            }
            data-testid="workflows-manager-table"
          />
        )}
      </div>

      <WorkflowDeleteConfirmModal
        opened={deleteModal.opened}
        onClose={() => setDeleteModal({ opened: false, id: '' })}
        onConfirm={confirmDelete}
        loading={deleting}
        title={t.workflowsManager.deleteModal.title}
        description={t.workflowsManager.deleteModal.description}
      />
    </Stack>
  );
};

export default WorkflowsManager;
