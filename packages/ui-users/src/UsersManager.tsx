'use client';

import './UsersManager.css';

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
  IconX,
} from '@tabler/icons-react';
import { usePermissions, useRoles, useUsers } from '@buildpad/hooks';
import type { Role, User, UserStatus } from '@buildpad/types';
import { UserAvatar } from './UserAvatar';
import { UserStatusBadge } from './UserStatusBadge';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { getUserDisplayName } from './userDisplay';

const STATUS_OPTIONS: Array<{ value: UserStatus; label: string }> = [
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'invited', label: 'Invited' },
  { value: 'draft', label: 'Draft' },
  { value: 'terminated', label: 'Terminated' },
];

/** A role entry as it may appear on `User.roles`: a bare ID, a flattened
 * `{id,name,icon}` object, or a junction row shaped `{id, role_id: {...}}`. */
type RoleEntry = string | { id?: string; name?: string; role_id?: { id?: string; name?: string } };

/** Extract a displayable `{ id, name }` badge from a role entry in any of the supported shapes. */
function extractRoleBadge(entry: RoleEntry): { id: string; name: string } | null {
  if (typeof entry === 'string') return null; // bare ID with no name to display
  const nested = entry.role_id;
  if (nested?.name) return { id: nested.id ?? entry.id ?? nested.name, name: nested.name };
  if (entry.name) return { id: entry.id ?? entry.name, name: entry.name };
  return null;
}

export interface UsersManagerProps {
  /** Called when a user row is clicked (and the current user may update users). */
  onUserClick?: (user: User) => void;
  /** Called when the "Add User" button is clicked. */
  onCreateUser?: () => void;
  /** Items per page. Default: 25. */
  pageSize?: number;
  /** DaaS collection used for RBAC checks. Default: 'daas_users'. */
  usersCollection?: string;
}

/**
 * Full users list surface: search, role/status filters, pagination, and a
 * row menu for edit/delete. Ported from the buildpad-daas reference
 * `app/users/page.tsx`, ported to `useUsers`/`useRoles` + `usePermissions`
 * and routing-agnostic navigation via `onUserClick`/`onCreateUser` props.
 */
export const UsersManager: React.FC<UsersManagerProps> = ({
  onUserClick,
  onCreateUser,
  pageSize = 25,
  usersCollection = 'daas_users',
}) => {
  const { fetchUsers, deleteUser } = useUsers();
  const { fetchRoles } = useRoles();
  const { canPerform, isAdmin, loading: permsLoading } = usePermissions({
    collections: [usersCollection],
  });

  // Optimistic while permissions resolve, then enforce; admins bypass.
  const createAllowed = permsLoading || isAdmin || canPerform(usersCollection, 'create');
  const updateAllowed = permsLoading || isAdmin || canPerform(usersCollection, 'update');
  const deleteAllowed = permsLoading || isAdmin || canPerform(usersCollection, 'delete');

  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, 300);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<UserStatus | null>(null);

  const [deleteModal, setDeleteModal] = useState<{ opened: boolean; id: string }>({
    opened: false,
    id: '',
  });
  const [deleting, setDeleting] = useState(false);

  const hasFilters = Boolean(debouncedSearch || selectedRole || selectedStatus);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchUsers({
        page,
        limit: pageSize,
        search: debouncedSearch || undefined,
        role: selectedRole || undefined,
        status: selectedStatus || undefined,
      });
      setUsers(result.users);
      setTotalCount(result.total);
      setTotalPages(result.totalPages);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [fetchUsers, page, pageSize, debouncedSearch, selectedRole, selectedStatus]);

  useEffect(() => {
    void load();
  }, [load]);

  // Reset to page 1 whenever a filter changes.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, selectedRole, selectedStatus]);

  useEffect(() => {
    fetchRoles({ limit: 1000 })
      .then((result) => setRoles(result.roles))
      .catch(() => setRoles([]));
  }, [fetchRoles]);

  const requestDelete = useCallback((id: string) => {
    setDeleteModal({ opened: true, id });
  }, []);

  const confirmDelete = useCallback(async () => {
    setDeleting(true);
    try {
      await deleteUser(deleteModal.id);
      setDeleteModal({ opened: false, id: '' });
      await load();
    } finally {
      setDeleting(false);
    }
  }, [deleteUser, deleteModal.id, load]);

  return (
    <Stack gap="md" className="bp-users-manager" data-testid="users-manager">
      <Group justify="space-between" align="flex-start">
        <Box>
          <Title order={2} mb={4}>
            Users
          </Title>
          <Text size="sm" c="dimmed">
            Manage user accounts, roles, and access permissions
          </Text>
        </Box>
        {createAllowed && onCreateUser && (
          <Button leftSection={<IconPlus size={16} />} onClick={onCreateUser} data-testid="users-manager-add-btn">
            Add User
          </Button>
        )}
      </Group>

      <Paper p="sm" radius="md" withBorder>
        <Group>
          <TextInput
            placeholder="Search users..."
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
            data-testid="users-manager-search"
          />
          <Select
            placeholder="Role"
            data={roles.map((role) => ({ value: role.id, label: role.name }))}
            value={selectedRole}
            onChange={setSelectedRole}
            clearable
            size="sm"
            style={{ minWidth: 160 }}
            data-testid="users-manager-role-filter"
          />
          <Select
            placeholder="Status"
            data={STATUS_OPTIONS}
            value={selectedStatus}
            onChange={(value) => setSelectedStatus(value as UserStatus | null)}
            clearable
            size="sm"
            style={{ minWidth: 160 }}
            data-testid="users-manager-status-filter"
          />
          {totalCount > 0 && (
            <Badge variant="light" color="gray" size="lg" radius="sm" style={{ marginLeft: 'auto' }}>
              {totalCount} {totalCount === 1 ? 'user' : 'users'}
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
                <Table.Th>User</Table.Th>
                <Table.Th>Email</Table.Th>
                <Table.Th>Role</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Last Access</Table.Th>
                {(updateAllowed || deleteAllowed) && <Table.Th style={{ width: 50 }} />}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {users.length === 0 && !loading ? (
                <Table.Tr>
                  <Table.Td colSpan={updateAllowed || deleteAllowed ? 6 : 5}>
                    <Box className="bp-users-manager__empty-state">
                      <IconSearch size={40} stroke={1} className="bp-users-manager__empty-icon" />
                      <Text fw={500} size="sm" mb={4}>
                        No users found
                      </Text>
                      <Text size="xs" c="dimmed">
                        {hasFilters ? 'Try adjusting your filters' : 'Get started by adding your first user'}
                      </Text>
                    </Box>
                  </Table.Td>
                </Table.Tr>
              ) : (
                users.map((user) => {
                  const roleBadges = (user.roles ?? [])
                    .map((r) => extractRoleBadge(r as RoleEntry))
                    .filter((r): r is { id: string; name: string } => r !== null);

                  return (
                    <Table.Tr
                      key={user.id}
                      style={{ cursor: updateAllowed ? 'pointer' : 'default' }}
                      onClick={() => {
                        if (updateAllowed) onUserClick?.(user);
                      }}
                      data-testid={`users-manager-row-${user.id}`}
                    >
                      <Table.Td>
                        <Group gap="sm">
                          <UserAvatar user={user} size={32} />
                          <Text size="sm" fw={500}>
                            {getUserDisplayName(user)}
                          </Text>
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" c="dimmed">
                          {user.email}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        {roleBadges.length > 0 && (
                          <Group gap={4} wrap="wrap">
                            {roleBadges.map((r) => (
                              <Badge key={r.id} variant="light" size="sm">
                                {r.name}
                              </Badge>
                            ))}
                          </Group>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <UserStatusBadge status={user.status} />
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" c="dimmed">
                          {user.last_access ? new Date(user.last_access).toLocaleDateString() : 'Never'}
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
                                    onUserClick?.(user);
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
                                    requestDelete(user.id);
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
                  );
                })
              )}
            </Table.Tbody>
          </Table>
        </Box>

        {totalPages > 1 && (
          <Group justify="space-between" px="md" py="sm" style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}>
            <Text size="xs" c="dimmed">
              Showing {users.length} of {totalCount} users
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
        title="Delete user"
        description="Are you sure you want to delete this user? This action cannot be undone."
      />
    </Stack>
  );
};

export default UsersManager;
