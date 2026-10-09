'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Badge, Box, Button, Center, Group, Loader, Stack, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconGitBranch, IconPlus } from '@tabler/icons-react';
import { useHydrated, usePermissions, useWorkflowDefinitions } from '@buildpad/hooks';
import { useBuildpadI18n, useBuildpadTranslations } from '@buildpad/services';
import { WORKFLOW_DEFINITION_COLLECTION, type WorkflowDefinitionRecord } from '@buildpad/types';
import { VTable } from '@buildpad/ui-table';
import type { Header, HeaderRaw, Item } from '@buildpad/ui-table';
import { interpolate, pageAfterRemoval, type DeepPartial, type WorkflowsTranslations } from '@buildpad/utils';
import { WorkflowDeleteConfirmModal } from './WorkflowDeleteConfirmModal';
import { WorkflowListEmptyState } from './WorkflowListEmptyState';
import { WorkflowListFooter } from './WorkflowListFooter';
import { WorkflowPageState } from './WorkflowPageState';
import { WorkflowRowActionsMenu } from './WorkflowRowActionsMenu';
import { WorkflowSearchInput } from './WorkflowSearchInput';
import { useWorkflowList } from './useWorkflowList';
import './WorkflowManagerTable.css';

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

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
 * - Add Workflow and the row menus are drawn once the permissions are known;
 *   they do not flash for a user who has none of them. The list itself does
 *   not wait.
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

  // No write control until the permissions are known: a reader must not be
  // shown Add Workflow and a full row menu for the length of that request.
  // Known once is known: a later refresh (a renewed token, another scope)
  // answers from what was known until its own answer is in, so the controls
  // do not blink.
  const permsKnownRef = useRef(false);
  if (!permsLoading) permsKnownRef.current = true;
  const permsKnown = permsKnownRef.current;
  const createAllowed = permsKnown && (isAdmin || canPerform(workflowsCollection, 'create'));
  const updateAllowed = permsKnown && (isAdmin || canPerform(workflowsCollection, 'update'));
  const deleteAllowed = permsKnown && (isAdmin || canPerform(workflowsCollection, 'delete'));

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

  // Search, paging, URL state and the load itself: the state the three list
  // managers share
  const list = useWorkflowList<WorkflowDefinitionRecord>({
    fetchPage: fetchDefinitions,
    pageSize,
    pageSizeOptions,
    urlParams,
    urlParamPrefix,
    loadFailedMessage: t.workflowsManager.notifications.loadFailed,
  });
  const { rows: workflows, loading, failure, page, setPage, reload } = list;

  const [deleteModal, setDeleteModal] = useState<{ opened: boolean; id: string }>({
    opened: false,
    id: '',
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
        await reload();
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
  }, [deleteDefinition, deleteModal.id, reload, page, setPage, workflows.length, t, common]);

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
            value={list.search}
            onChange={list.setSearch}
            style={{ flex: 1, minWidth: 200, maxWidth: 360 }}
            data-testid="workflows-manager-search"
            translations={translations}
          />
          <Group gap="sm" style={{ marginLeft: 'auto' }}>
            {!failure && (
              <Badge variant="light" color="gray" size="lg" radius="sm" data-testid="workflows-manager-count">
                {formatCount(list.totalCount, t.count.workflows)}
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
            hint={
              list.debouncedSearch ? t.workflowsManager.emptyState.search : t.workflowsManager.emptyState.pristine
            }
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
                totalCount={list.totalCount}
                itemsLabel={t.workflowsManager.itemsLabel}
                page={page}
                totalPages={list.totalPages}
                onPageChange={setPage}
                limit={list.limit}
                sizeOptions={list.sizeOptions}
                onLimitChange={list.setLimit}
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
