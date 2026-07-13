'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Group,
  LoadingOverlay,
  Paper,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconShield } from '@tabler/icons-react';
import { usePermissions, usePolicies } from '@buildpad/hooks';
import type { Policy } from '@buildpad/types';
import { IconDisplay } from '@buildpad/ui-interfaces/select-icon';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { ListEmptyState } from './ListEmptyState';
import { ListFooter } from './ListFooter';
import { RowActionsMenu } from './RowActionsMenu';
import { SearchInput } from './SearchInput';
import { SortableTh } from './SortableTh';
import { toggleSort } from './accessUtils';

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export interface PoliciesManagerProps {
  /** Called when a policy row is clicked (and the current user may update policies). */
  onPolicyClick?: (policy: Policy) => void;
  /** Called when the "Add Policy" button is clicked. */
  onCreatePolicy?: () => void;
  /** Initial items per page (changeable via the footer selector). Default: 25. */
  pageSize?: number;
  /** Choices offered by the footer page-size selector. Default: [10, 25, 50, 100]. */
  pageSizeOptions?: number[];
  /** Hide the built-in heading + subtitle for embedded surfaces; the Add Policy button stays. Default: false. */
  hideHeader?: boolean;
  /** DaaS collection used for RBAC checks. Default: 'daas_policies'. */
  policiesCollection?: string;
}

/**
 * Policies list surface: search, user/role attachment counts, sortable Name
 * column, pagination with a page-size selector, and a row menu for
 * edit/delete. Ported from the buildpad-daas reference
 * `app/policies/page.tsx` to `usePolicies` + `usePermissions` and
 * routing-agnostic navigation via `onPolicyClick`/`onCreatePolicy` props.
 *
 * Only `name` is sortable: `userCount`/`roleCount` are computed after the
 * query server-side and cannot be sorted on.
 */
export const PoliciesManager: React.FC<PoliciesManagerProps> = ({
  onPolicyClick,
  onCreatePolicy,
  pageSize = 25,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  hideHeader = false,
  policiesCollection = 'daas_policies',
}) => {
  const { fetchPolicies, deletePolicy } = usePolicies();
  const { canPerform, isAdmin, loading: permsLoading } = usePermissions({
    collections: [policiesCollection],
  });

  const createAllowed = permsLoading || isAdmin || canPerform(policiesCollection, 'create');
  const updateAllowed = permsLoading || isAdmin || canPerform(policiesCollection, 'update');
  const deleteAllowed = permsLoading || isAdmin || canPerform(policiesCollection, 'delete');

  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(pageSize);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, 300);
  // Server-side sort (`name` / `-name`); computed count columns are not sortable.
  const [sort, setSort] = useState<string | null>(null);

  const [deleteModal, setDeleteModal] = useState<{ opened: boolean; id: string }>({
    opened: false,
    id: '',
  });
  const [deleting, setDeleting] = useState(false);

  const sizeOptions = useMemo(() => {
    return Array.from(new Set([...pageSizeOptions, pageSize])).sort((a, b) => a - b);
  }, [pageSizeOptions, pageSize]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchPolicies({
        page,
        limit,
        search: debouncedSearch || undefined,
        sort: sort || undefined,
      });
      setPolicies(result.policies);
      setTotalCount(result.total);
      setTotalPages(result.totalPages);
      setLoadError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load policies';
      setPolicies([]);
      setLoadError(message);
      notifications.show({ title: 'Failed to load policies', message, color: 'red' });
    } finally {
      setLoading(false);
    }
  }, [fetchPolicies, page, limit, debouncedSearch, sort]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, sort, limit]);

  const handleSort = useCallback((field: string) => {
    setSort((current) => toggleSort(current, field));
  }, []);

  const confirmDelete = useCallback(async () => {
    setDeleting(true);
    try {
      await deletePolicy(deleteModal.id);
      setDeleteModal({ opened: false, id: '' });
      await load();
    } catch (err) {
      // Keep the modal open so the administrator can retry or cancel.
      notifications.show({
        title: 'Failed to delete policy',
        message: err instanceof Error ? err.message : 'Failed to delete policy',
        color: 'red',
      });
    } finally {
      setDeleting(false);
    }
  }, [deletePolicy, deleteModal.id, load]);

  const addButton =
    createAllowed && onCreatePolicy ? (
      <Button leftSection={<IconPlus size={16} />} onClick={onCreatePolicy} data-testid="policies-manager-add-btn">
        Add Policy
      </Button>
    ) : null;

  return (
    <Stack gap="md" data-testid="policies-manager">
      {(!hideHeader || addButton) && (
        <Group justify={hideHeader ? 'flex-end' : 'space-between'} align="flex-start">
          {!hideHeader && (
            <Box>
              <Title order={2} mb={4}>
                Policies
              </Title>
              <Text size="sm" c="dimmed">
                Define policies that grant access and permissions to users and roles
              </Text>
            </Box>
          )}
          {addButton}
        </Group>
      )}

      <Paper p="sm" radius="md" withBorder>
        <Group>
          <SearchInput
            placeholder="Search policies..."
            value={search}
            onChange={setSearch}
            style={{ flex: 1, minWidth: 200, maxWidth: 360 }}
            data-testid="policies-manager-search"
          />
          {totalCount > 0 && (
            <Badge variant="light" color="gray" size="lg" radius="sm" style={{ marginLeft: 'auto' }}>
              {totalCount} {totalCount === 1 ? 'policy' : 'policies'}
            </Badge>
          )}
        </Group>
      </Paper>

      <Paper radius="md" withBorder style={{ overflow: 'hidden' }}>
        <Box pos="relative">
          <LoadingOverlay visible={loading} />

          <Table highlightOnHover withTableBorder={false}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={{ width: 48 }} />
                <SortableTh label="Name" field="name" sort={sort} onSort={handleSort} data-testid="policies-manager-sort-name" />
                <Table.Th>Users</Table.Th>
                <Table.Th>Roles</Table.Th>
                <Table.Th>Description</Table.Th>
                {(updateAllowed || deleteAllowed) && <Table.Th style={{ width: 50 }} />}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {policies.length === 0 && !loading ? (
                <Table.Tr>
                  <Table.Td colSpan={updateAllowed || deleteAllowed ? 6 : 5}>
                    {loadError ? (
                      <ListEmptyState error title="Failed to load policies" hint={loadError} />
                    ) : (
                      <ListEmptyState
                        title="No policies found"
                        hint={
                          debouncedSearch
                            ? 'Try a different search term'
                            : 'Create your first policy to get started'
                        }
                      />
                    )}
                  </Table.Td>
                </Table.Tr>
              ) : (
                policies.map((policy) => (
                  <Table.Tr
                    key={policy.id}
                    style={{ cursor: updateAllowed ? 'pointer' : 'default' }}
                    onClick={() => {
                      if (updateAllowed) onPolicyClick?.(policy);
                    }}
                    data-testid={`policies-manager-row-${policy.id}`}
                  >
                    <Table.Td>
                      <IconDisplay icon={policy.icon} fallback={IconShield} />
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <Text size="sm" fw={500}>
                          {policy.name}
                        </Text>
                        {policy.admin_access && (
                          <Badge color="red" size="xs">
                            Admin
                          </Badge>
                        )}
                        {policy.app_access && (
                          <Badge color="blue" size="xs">
                            App
                          </Badge>
                        )}
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{policy.userCount || 0}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{policy.roleCount || 0}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed" lineClamp={1}>
                        {policy.description || '—'}
                      </Text>
                    </Table.Td>
                    {(updateAllowed || deleteAllowed) && (
                      <Table.Td>
                        <RowActionsMenu
                          onEdit={updateAllowed ? () => onPolicyClick?.(policy) : undefined}
                          onDelete={
                            deleteAllowed
                              ? () => setDeleteModal({ opened: true, id: policy.id })
                              : undefined
                          }
                        />
                      </Table.Td>
                    )}
                  </Table.Tr>
                ))
              )}
            </Table.Tbody>
          </Table>
        </Box>

        <ListFooter
          shown={policies.length}
          totalCount={totalCount}
          itemsLabel="policies"
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          limit={limit}
          sizeOptions={sizeOptions}
          onLimitChange={setLimit}
          data-testid="policies-manager-page-size"
        />
      </Paper>

      <DeleteConfirmModal
        opened={deleteModal.opened}
        onClose={() => setDeleteModal({ opened: false, id: '' })}
        onConfirm={confirmDelete}
        loading={deleting}
        title="Delete policy"
        description="Are you sure you want to delete this policy? This action cannot be undone."
      />
    </Stack>
  );
};

export default PoliciesManager;
