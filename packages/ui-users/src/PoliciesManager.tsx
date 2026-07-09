'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  LoadingOverlay,
  Menu,
  Pagination,
  Paper,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import {
  IconDots,
  IconEdit,
  IconPlus,
  IconSearch,
  IconShield,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import { usePermissions, usePolicies } from '@buildpad/hooks';
import type { Policy } from '@buildpad/types';
import { IconDisplay } from './IconDisplay';
import { DeleteConfirmModal } from './DeleteConfirmModal';

export interface PoliciesManagerProps {
  /** Called when a policy row is clicked (and the current user may update policies). */
  onPolicyClick?: (policy: Policy) => void;
  /** Called when the "Add Policy" button is clicked. */
  onCreatePolicy?: () => void;
  /** Items per page. Default: 25. */
  pageSize?: number;
  /** DaaS collection used for RBAC checks. Default: 'daas_policies'. */
  policiesCollection?: string;
}

/**
 * Policies list surface: search, user/role attachment counts, pagination,
 * and a row menu for edit/delete. Ported from the buildpad-daas reference
 * `app/policies/page.tsx` to `usePolicies` + `usePermissions` and
 * routing-agnostic navigation via `onPolicyClick`/`onCreatePolicy` props.
 */
export const PoliciesManager: React.FC<PoliciesManagerProps> = ({
  onPolicyClick,
  onCreatePolicy,
  pageSize = 25,
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
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, 300);

  const [deleteModal, setDeleteModal] = useState<{ opened: boolean; id: string }>({
    opened: false,
    id: '',
  });
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchPolicies({
        page,
        limit: pageSize,
        search: debouncedSearch || undefined,
      });
      setPolicies(result.policies);
      setTotalCount(result.total);
      setTotalPages(result.totalPages);
    } catch {
      setPolicies([]);
    } finally {
      setLoading(false);
    }
  }, [fetchPolicies, page, pageSize, debouncedSearch]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const confirmDelete = useCallback(async () => {
    setDeleting(true);
    try {
      await deletePolicy(deleteModal.id);
      setDeleteModal({ opened: false, id: '' });
      await load();
    } finally {
      setDeleting(false);
    }
  }, [deletePolicy, deleteModal.id, load]);

  return (
    <Stack gap="md" data-testid="policies-manager">
      <Group justify="space-between" align="flex-start">
        <Box>
          <Title order={2} mb={4}>
            Policies
          </Title>
          <Text size="sm" c="dimmed">
            Define policies that grant access and permissions to users and roles
          </Text>
        </Box>
        {createAllowed && onCreatePolicy && (
          <Button leftSection={<IconPlus size={16} />} onClick={onCreatePolicy} data-testid="policies-manager-add-btn">
            Add Policy
          </Button>
        )}
      </Group>

      <Paper p="sm" radius="md" withBorder>
        <Group>
          <TextInput
            placeholder="Search policies..."
            leftSection={<IconSearch size={15} stroke={1.5} />}
            rightSection={
              search ? (
                <ActionIcon variant="subtle" color="gray" size="xs" onClick={() => setSearch('')} aria-label="Clear search">
                  <IconX size={12} />
                </ActionIcon>
              ) : null
            }
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            size="sm"
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
                <Table.Th>Name</Table.Th>
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
                    <Box ta="center" py="xl">
                      <IconSearch size={40} stroke={1} color="var(--mantine-color-gray-4)" />
                      <Text fw={500} size="sm" mb={4}>
                        No policies found
                      </Text>
                      <Text size="xs" c="dimmed">
                        {debouncedSearch
                          ? 'Try a different search term'
                          : 'Create your first policy to get started'}
                      </Text>
                    </Box>
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
                        <Menu position="bottom-end" withinPortal>
                          <Menu.Target>
                            <ActionIcon
                              variant="subtle"
                              color="gray"
                              size="sm"
                              onClick={(e) => e.stopPropagation()}
                              aria-label="Row actions"
                            >
                              <IconDots size={16} />
                            </ActionIcon>
                          </Menu.Target>
                          <Menu.Dropdown>
                            {updateAllowed && (
                              <Menu.Item
                                leftSection={<IconEdit size={14} />}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onPolicyClick?.(policy);
                                }}
                              >
                                Edit
                              </Menu.Item>
                            )}
                            {deleteAllowed && (
                              <Menu.Item
                                leftSection={<IconTrash size={14} />}
                                color="red"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteModal({ opened: true, id: policy.id });
                                }}
                              >
                                Delete
                              </Menu.Item>
                            )}
                          </Menu.Dropdown>
                        </Menu>
                      </Table.Td>
                    )}
                  </Table.Tr>
                ))
              )}
            </Table.Tbody>
          </Table>
        </Box>

        {totalPages > 1 && (
          <Group justify="space-between" px="md" py="sm" style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}>
            <Text size="xs" c="dimmed">
              Showing {policies.length} of {totalCount} policies
            </Text>
            <Pagination value={page} onChange={setPage} total={totalPages} />
          </Group>
        )}
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
