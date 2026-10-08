'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Badge, Box, Button, Center, Group, Loader, Stack, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconFilter, IconPlus } from '@tabler/icons-react';
import { useHydrated, usePermissions, useWorkflowAssignments } from '@buildpad/hooks';
import { useBuildpadI18n, useBuildpadTranslations } from '@buildpad/services';
import { WORKFLOW_ASSIGNMENT_COLLECTION, type WorkflowAssignmentRecord } from '@buildpad/types';
import { VTable } from '@buildpad/ui-table';
import type { Header, HeaderRaw, Item } from '@buildpad/ui-table';
import { interpolate, pageAfterRemoval, type DeepPartial, type WorkflowsTranslations } from '@buildpad/utils';
import { WorkflowDeleteConfirmModal } from './WorkflowDeleteConfirmModal';
import { WorkflowListEmptyState } from './WorkflowListEmptyState';
import { WorkflowListFooter } from './WorkflowListFooter';
import { WorkflowPageState } from './WorkflowPageState';
import { WorkflowRichText } from './WorkflowRichText';
import { WorkflowRowActionsMenu } from './WorkflowRowActionsMenu';
import { WorkflowSearchInput } from './WorkflowSearchInput';
import { useWorkflowList } from './useWorkflowList';
import './WorkflowManagerTable.css';

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export interface WorkflowAssignmentsManagerProps {
  /** Called when an assignment row is clicked, and by the row menu's Edit. */
  onAssignmentClick?: (assignment: WorkflowAssignmentRecord) => void;
  /** Called when the "New Assignment" button is clicked. */
  onCreateAssignment?: () => void;
  /** Initial items per page (changeable via the footer selector). Default: 25. */
  pageSize?: number;
  /** Choices offered by the footer page-size selector. Default: [10, 25, 50, 100]. */
  pageSizeOptions?: number[];
  /** Hide the built-in heading + subtitle for embedded surfaces; the New Assignment button stays. Default: false. */
  hideHeader?: boolean;
  /**
   * DaaS collection used for RBAC checks. Default: 'daas_wf_assignment', the
   * name both backends enforce — gate on another name and the controls are
   * hidden from users the API would serve.
   */
  assignmentsCollection?: string;
  /**
   * Persist search and page in the URL query string so the list is
   * shareable and reload-safe; see `WorkflowsManager`. Set `false` for
   * embedded surfaces. Default: true.
   */
  urlParams?: boolean;
  /** Prefix for the managed URL parameters when two lists share a page. Default: ''. */
  urlParamPrefix?: string;
  /** Per-instance overrides of the `workflows` dictionary namespace (prop > provider > defaults). */
  translations?: DeepPartial<WorkflowsTranslations>;
}

/**
 * Workflow assignments list — which workflow the items of which collection
 * get: search by collection name, a count, the table (collection, workflow,
 * whether a filter rule narrows it, created), a row menu for edit/delete, and
 * pagination with a page-size selector. Ported from the buildpad-daas
 * reference `app/[lang]/workflow-assignments/page.tsx` to
 * `useWorkflowAssignments` + `usePermissions` and routing-agnostic navigation
 * through `onAssignmentClick` / `onCreateAssignment`.
 *
 * What differs from the reference, on purpose:
 *
 * - The controls are gated on `daas_wf_assignment`, the collection the API
 *   enforces. The reference gated on a name no backend knows, and sent a user
 *   the API would serve away from the page. Whether the list may be read is
 *   the API's answer: a refusal draws the access-denied state.
 * - A load that fails says so (the load-error state and a notification). The
 *   reference raised the notification over "No workflow assignments found".
 * - Deleting the only row of the last page loads the page before it
 *   (`pageAfterRemoval`), and an answer that puts the page past the end of the
 *   list loads the last page. The reference reloaded the same, now empty, page.
 * - The confirm button is pending while the delete runs and takes no second
 *   click; a failed delete shows the server's sentence and the dialog stays
 *   open. The reference's dialog closed on the click and sent one DELETE each.
 * - A row opens for every reader (the form is read-only without update
 *   access); the reference offered Edit to updaters only.
 * - A search without matches says so; the reference told the user to create
 *   their first assignment.
 * - A filter rule the caller's grant withholds shows the missing-value marker,
 *   not "No filter".
 *
 * Client-only gate: see `WorkflowsManager`.
 */
export const WorkflowAssignmentsManager: React.FC<WorkflowAssignmentsManagerProps> = (props) => {
  const hydrated = useHydrated();
  if (props.urlParams !== false && !hydrated) {
    return (
      <Center mih={240}>
        <Loader />
      </Center>
    );
  }
  return <WorkflowAssignmentsManagerBody {...props} />;
};

const WorkflowAssignmentsManagerBody: React.FC<WorkflowAssignmentsManagerProps> = ({
  onAssignmentClick,
  onCreateAssignment,
  pageSize = 25,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  hideHeader = false,
  assignmentsCollection = WORKFLOW_ASSIGNMENT_COLLECTION,
  urlParams = true,
  urlParamPrefix = '',
  translations,
}) => {
  const { fetchAssignments, deleteAssignment } = useWorkflowAssignments();
  const { canPerform, isAdmin, loading: permsLoading } = usePermissions({
    collections: [assignmentsCollection],
  });
  const t = useBuildpadTranslations((d) => d.workflows, translations);
  const common = useBuildpadTranslations((d) => d.common);
  const { formatCount, formatDate } = useBuildpadI18n();

  const createAllowed = permsLoading || isAdmin || canPerform(assignmentsCollection, 'create');
  const updateAllowed = permsLoading || isAdmin || canPerform(assignmentsCollection, 'update');
  const deleteAllowed = permsLoading || isAdmin || canPerform(assignmentsCollection, 'delete');

  const headers = useMemo<HeaderRaw[]>(
    () => [
      { text: t.assignmentsManager.columns.collection, value: 'collection', sortable: false },
      { text: t.assignmentsManager.columns.workflow, value: 'workflow', sortable: false },
      { text: t.assignmentsManager.columns.filterRule, value: 'filterRule', sortable: false },
      { text: t.assignmentsManager.columns.created, value: 'created', sortable: false },
    ],
    [t],
  );

  const list = useWorkflowList<WorkflowAssignmentRecord>({
    fetchPage: fetchAssignments,
    pageSize,
    pageSizeOptions,
    urlParams,
    urlParamPrefix,
    loadFailedMessage: t.assignmentsManager.notifications.loadFailed,
  });
  const { rows: assignments, loading, failure, page, setPage, reload } = list;

  // The assignment stays after the dialog closes, so its name does not blank
  // out of the sentence while the dialog fades.
  const [deleteModal, setDeleteModal] = useState<{ opened: boolean; assignment: WorkflowAssignmentRecord | null }>({
    opened: false,
    assignment: null,
  });
  const deleteTarget = deleteModal.assignment;
  const closeDeleteModal = useCallback(() => setDeleteModal((prev) => ({ ...prev, opened: false })), []);
  const [deleting, setDeleting] = useState(false);
  // The state above disables the button on the next render; the ref refuses a
  // second click that arrives before that render.
  const deletingRef = useRef(false);

  const confirmDelete = useCallback(async () => {
    if (deletingRef.current || !deleteTarget) return;
    deletingRef.current = true;
    setDeleting(true);
    try {
      await deleteAssignment(deleteTarget.id);
      closeDeleteModal();
      notifications.show({
        title: common.success,
        message: t.assignmentsManager.notifications.deleted,
        color: 'green',
      });
      // The row is gone: stay on the page while it has another row, otherwise
      // load the page before it. Changing the page reloads through the effect.
      const nextPage = pageAfterRemoval(page, assignments.length);
      if (nextPage === page) {
        await reload();
      } else {
        setPage(nextPage);
      }
    } catch (err) {
      // Keep the modal open so the user can retry or cancel.
      notifications.show({
        title: t.assignmentsManager.notifications.deleteFailed,
        message:
          err instanceof Error && err.message ? err.message : t.assignmentsManager.notifications.deleteFailed,
        color: 'red',
      });
    } finally {
      deletingRef.current = false;
      setDeleting(false);
    }
  }, [deleteAssignment, deleteTarget, closeDeleteModal, reload, page, setPage, assignments.length, t, common]);

  const addButton =
    createAllowed && onCreateAssignment ? (
      <Button
        leftSection={<IconPlus size={16} />}
        onClick={onCreateAssignment}
        data-testid="workflow-assignments-manager-add-btn"
      >
        {t.assignmentsManager.newAssignment}
      </Button>
    ) : null;

  const renderCell = useCallback(
    (item: Item, header: Header): React.ReactNode => {
      const assignment = item as unknown as WorkflowAssignmentRecord;
      switch (header.value) {
        case 'collection':
          return (
            <Badge variant="light" size="lg" style={{ textTransform: 'none' }}>
              {assignment.collection}
            </Badge>
          );
        case 'workflow':
          return (
            <Text size="sm" fw={500}>
              {/* The id when the caller's grant withholds the definition */}
              {assignment.workflow_definition?.name || assignment.workflow || t.emptyValue}
            </Text>
          );
        case 'filterRule':
          // Absent is "withheld by the caller's grant", which is not "no rule"
          if (assignment.filter_rule === undefined) {
            return (
              <Text size="xs" c="dimmed">
                {t.emptyValue}
              </Text>
            );
          }
          return assignment.filter_rule ? (
            <Group gap="xs" wrap="nowrap">
              <IconFilter size={14} />
              <Text size="xs" c="dimmed">
                {t.assignmentsManager.hasFilter}
              </Text>
            </Group>
          ) : (
            <Text size="xs" c="dimmed">
              {t.assignmentsManager.noFilter}
            </Text>
          );
        case 'created':
          return (
            <Text size="sm" c="dimmed">
              {/* `formatDate` returns '' for an empty or invalid value */}
              {formatDate(assignment.date_created) || t.emptyValue}
            </Text>
          );
        default:
          return null;
      }
    },
    [t, formatDate],
  );

  const renderRowAppend =
    updateAllowed || deleteAllowed
      ? (item: Item) => {
          const assignment = item as unknown as WorkflowAssignmentRecord;
          const names = { collection: assignment.collection };
          return (
            <WorkflowRowActionsMenu
              onEdit={updateAllowed && onAssignmentClick ? () => onAssignmentClick(assignment) : undefined}
              onDelete={deleteAllowed ? () => setDeleteModal({ opened: true, assignment }) : undefined}
              editAriaLabel={interpolate(t.assignmentsManager.editAriaLabel, names)}
              deleteAriaLabel={interpolate(t.assignmentsManager.deleteAriaLabel, names)}
              translations={translations}
            />
          );
        }
      : undefined;

  const header = !hideHeader && (
    <Box>
      <Title order={2} mb={4}>
        {t.assignmentsManager.title}
      </Title>
      <Text size="sm" c="dimmed">
        {t.assignmentsManager.subtitle}
      </Text>
    </Box>
  );

  if (failure?.kind === 'accessDenied') {
    return (
      <Stack gap="md" data-testid="workflow-assignments-manager">
        {header}
        <WorkflowPageState
          variant="accessDenied"
          title={t.accessDenied.title}
          description={failure.description || t.accessDenied.description}
          data-testid="workflow-assignments-manager-access-denied"
        />
      </Stack>
    );
  }

  const empty = !loading && assignments.length === 0;

  return (
    <Stack gap="md" data-testid="workflow-assignments-manager">
      {header}

      <div className="bp-workflow-manager-card">
        <Group className="bp-workflow-manager-toolbar" wrap="wrap">
          <WorkflowSearchInput
            placeholder={t.assignmentsManager.searchPlaceholder}
            value={list.search}
            onChange={list.setSearch}
            style={{ flex: 1, minWidth: 200, maxWidth: 360 }}
            data-testid="workflow-assignments-manager-search"
            translations={translations}
          />
          <Group gap="sm" style={{ marginLeft: 'auto' }}>
            {!failure && (
              <Badge
                variant="light"
                color="gray"
                size="lg"
                radius="sm"
                data-testid="workflow-assignments-manager-count"
              >
                {formatCount(list.totalCount, t.count.assignments)}
              </Badge>
            )}
            {addButton}
          </Group>
        </Group>

        {empty && failure && (
          <WorkflowListEmptyState
            error
            title={interpolate(t.assignmentsManager.emptyState.loadError, { error: failure.message })}
            data-testid="workflow-assignments-manager-load-error"
          />
        )}

        {empty && !failure && (
          <WorkflowListEmptyState
            title={
              list.debouncedSearch
                ? t.assignmentsManager.emptyState.search
                : t.assignmentsManager.emptyState.pristine
            }
            data-testid="workflow-assignments-manager-empty"
          />
        )}

        {!empty && (
          <VTable
            headers={headers}
            items={assignments as unknown as Item[]}
            itemKey="id"
            showSelect="none"
            fixedHeader
            loading={loading}
            clickable={Boolean(onAssignmentClick)}
            renderCell={renderCell}
            renderRowAppend={renderRowAppend}
            renderFooter={() => (
              <WorkflowListFooter
                shown={assignments.length}
                totalCount={list.totalCount}
                itemsLabel={t.assignmentsManager.itemsLabel}
                page={page}
                totalPages={list.totalPages}
                onPageChange={setPage}
                limit={list.limit}
                sizeOptions={list.sizeOptions}
                onLimitChange={list.setLimit}
                data-testid="workflow-assignments-manager-page-size"
                translations={translations}
              />
            )}
            onRowClick={
              onAssignmentClick
                ? ({ item }) => onAssignmentClick(item as unknown as WorkflowAssignmentRecord)
                : undefined
            }
            data-testid="workflow-assignments-manager-table"
          />
        )}
      </div>

      <WorkflowDeleteConfirmModal
        opened={deleteModal.opened}
        onClose={closeDeleteModal}
        onConfirm={confirmDelete}
        loading={deleting}
        title={t.assignmentsManager.deleteModal.title}
        description={
          <WorkflowRichText
            template={t.assignmentsManager.deleteModal.description}
            values={{ collection: deleteTarget?.collection ?? '' }}
            tags={{ strong: (text) => <strong>{text}</strong> }}
          />
        }
      />
    </Stack>
  );
};

export default WorkflowAssignmentsManager;
