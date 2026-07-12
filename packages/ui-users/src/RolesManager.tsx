'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  Select,
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
  IconTrash,
  IconUsersGroup,
  IconX,
} from '@tabler/icons-react';
import { usePermissions, useRoles } from '@buildpad/hooks';
import type { Role } from '@buildpad/types';
import { IconDisplay } from './IconDisplay';
import { DeleteConfirmModal } from './DeleteConfirmModal';

function getUserCount(role: Role): number {
  return role.users?.[0]?.count ?? 0;
}

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export interface RolesManagerProps {
  /** Called when a role row is clicked (and the current user may update roles). */
  onRoleClick?: (role: Role) => void;
  /** Called when the "Add Role" button is clicked. */
  onCreateRole?: () => void;
  /** Initial items per page (changeable via the footer selector). Default: 25. */
  pageSize?: number;
  /** Choices offered by the footer page-size selector. Default: [10, 25, 50, 100]. */
  pageSizeOptions?: number[];
  /** Hide the built-in heading + subtitle for embedded surfaces; the Add Role button stays. Default: false. */
  hideHeader?: boolean;
  /** DaaS collection used for RBAC checks. Default: 'daas_roles'. */
  rolesCollection?: string;
}

/**
 * Roles list surface: search, member counts (`includeUsers=true`),
 * pagination with a page-size selector, and a row menu for edit/delete.
 * Ported from the buildpad-daas reference `app/roles/page.tsx` to
 * `useRoles` + `usePermissions` and routing-agnostic navigation via
 * `onRoleClick`/`onCreateRole` props.
 *
 * No column sorting: the roles API ignores the `sort` param (hardcodes
 * name-asc), so a sort UI here would lie across pages (Req 20.6).
 */
export const RolesManager: React.FC<RolesManagerProps> = ({
  onRoleClick,
  onCreateRole,
  pageSize = 25,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  hideHeader = false,
  rolesCollection = 'daas_roles',
}) => {
  const { fetchRoles, deleteRole } = useRoles();
  const { canPerform, isAdmin, loading: permsLoading } = usePermissions({
    collections: [rolesCollection],
  });

  const createAllowed = permsLoading || isAdmin || canPerform(rolesCollection, 'create');
  const updateAllowed = permsLoading || isAdmin || canPerform(rolesCollection, 'update');
  const deleteAllowed = permsLoading || isAdmin || canPerform(rolesCollection, 'delete');

  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(pageSize);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, 300);

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
      const result = await fetchRoles({
        page,
        limit,
        search: debouncedSearch || undefined,
        includeUsers: true,
      });
      setRoles(result.roles);
      setTotalCount(result.total);
      setTotalPages(result.totalPages);
    } catch {
      setRoles([]);
    } finally {
      setLoading(false);
    }
  }, [fetchRoles, page, limit, debouncedSearch]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, limit]);

  const confirmDelete = useCallback(async () => {
    setDeleting(true);
    try {
      await deleteRole(deleteModal.id);
      setDeleteModal({ opened: false, id: '' });
      await load();
    } finally {
      setDeleting(false);
    }
  }, [deleteRole, deleteModal.id, load]);

  const addButton =
    createAllowed && onCreateRole ? (
      <Button leftSection={<IconPlus size={16} />} onClick={onCreateRole} data-testid="roles-manager-add-btn">
        Add Role
      </Button>
    ) : null;

  return (
    <Stack gap="md" data-testid="roles-manager">
      {(!hideHeader || addButton) && (
        <Group justify={hideHeader ? 'flex-end' : 'space-between'} align="flex-start">
          {!hideHeader && (
            <Box>
              <Title order={2} mb={4}>
                Roles
              </Title>
              <Text size="sm" c="dimmed">
                Define roles to group users and assign permissions
              </Text>
            </Box>
          )}
          {addButton}
        </Group>
      )}

      <Paper p="sm" radius="md" withBorder>
        <Group>
          <TextInput
            placeholder="Search roles..."
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
            data-testid="roles-manager-search"
          />
          {totalCount > 0 && (
            <Badge variant="light" color="gray" size="lg" radius="sm" style={{ marginLeft: 'auto' }}>
              {totalCount} {totalCount === 1 ? 'role' : 'roles'}
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
                <Table.Th>Description</Table.Th>
                {(updateAllowed || deleteAllowed) && <Table.Th style={{ width: 50 }} />}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {roles.length === 0 && !loading ? (
                <Table.Tr>
                  <Table.Td colSpan={updateAllowed || deleteAllowed ? 5 : 4}>
                    <Box ta="center" py="xl">
                      <IconSearch size={40} stroke={1} color="var(--mantine-color-gray-4)" />
                      <Text fw={500} size="sm" mb={4}>
                        No roles found
                      </Text>
                      <Text size="xs" c="dimmed">
                        {debouncedSearch
                          ? 'Try a different search term'
                          : 'Create your first role to get started'}
                      </Text>
                    </Box>
                  </Table.Td>
                </Table.Tr>
              ) : (
                roles.map((role) => (
                  <Table.Tr
                    key={role.id}
                    style={{ cursor: updateAllowed ? 'pointer' : 'default' }}
                    onClick={() => {
                      if (updateAllowed) onRoleClick?.(role);
                    }}
                    data-testid={`roles-manager-row-${role.id}`}
                  >
                    <Table.Td>
                      <IconDisplay icon={role.icon} />
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" fw={500}>
                        {role.name}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4}>
                        <IconUsersGroup size={14} stroke={1.5} color="var(--mantine-color-gray-5)" />
                        <Text size="sm" c="dimmed">
                          {getUserCount(role)}
                        </Text>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed" lineClamp={1}>
                        {role.description || '—'}
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
                                  onRoleClick?.(role);
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
                                  setDeleteModal({ opened: true, id: role.id });
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

        {totalCount > 0 && (
          <Group justify="space-between" px="md" py="sm" style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}>
            <Group gap="sm">
              <Text size="xs" c="dimmed">
                Showing {roles.length} of {totalCount} roles
              </Text>
              <Select
                size="xs"
                w={110}
                value={String(limit)}
                onChange={(value) => {
                  if (value) setLimit(Number(value));
                }}
                data={sizeOptions.map((n) => ({ value: String(n), label: `${n} / page` }))}
                aria-label="Items per page"
                data-testid="roles-manager-page-size"
              />
            </Group>
            {totalPages > 1 && <Pagination value={page} onChange={setPage} total={totalPages} />}
          </Group>
        )}
      </Paper>

      <DeleteConfirmModal
        opened={deleteModal.opened}
        onClose={() => setDeleteModal({ opened: false, id: '' })}
        onConfirm={confirmDelete}
        loading={deleting}
        title="Delete role"
        description="Are you sure you want to delete this role? Users in this role will need to be reassigned."
      />
    </Stack>
  );
};

export default RolesManager;
