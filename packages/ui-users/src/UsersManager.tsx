'use client';

import './UsersManager.css';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Checkbox,
  Group,
  LoadingOverlay,
  Menu,
  Modal,
  MultiSelect,
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
import { notifications } from '@mantine/notifications';
import {
  IconDots,
  IconEdit,
  IconPlus,
  IconSearch,
  IconTrash,
  IconUsersGroup,
  IconX,
} from '@tabler/icons-react';
import { usePermissions, useRoles, useSelection, useUsers } from '@buildpad/hooks';
import type { Role, User, UserStatus } from '@buildpad/types';
import { UserAvatar } from './UserAvatar';
import { UserStatusBadge } from './UserStatusBadge';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { SortableTh } from './SortableTh';
import { toggleSort } from './accessUtils';
import { getUserDisplayName } from './userDisplay';

const STATUS_OPTIONS: Array<{ value: UserStatus; label: string }> = [
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'invited', label: 'Invited' },
  { value: 'draft', label: 'Draft' },
  { value: 'terminated', label: 'Terminated' },
];

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

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
  /** Initial items per page (changeable via the footer selector). Default: 25. */
  pageSize?: number;
  /** Choices offered by the footer page-size selector. Default: [10, 25, 50, 100]. */
  pageSizeOptions?: number[];
  /** Hide the built-in heading + subtitle for embedded surfaces; the Add User button stays. Default: false. */
  hideHeader?: boolean;
  /** DaaS collection used for RBAC checks. Default: 'daas_users'. */
  usersCollection?: string;
}

interface BulkRolesModalProps {
  opened: boolean;
  onClose: () => void;
  roles: Role[];
  count: number;
  busy: boolean;
  onApply: (addRoles: string[], removeRoles: string[]) => void;
}

/** Staged add/remove role picks applied in a single `bulkUpdateUsers` call. */
const BulkRolesModal: React.FC<BulkRolesModalProps> = ({
  opened,
  onClose,
  roles,
  count,
  busy,
  onApply,
}) => {
  const [addRoles, setAddRoles] = useState<string[]>([]);
  const [removeRoles, setRemoveRoles] = useState<string[]>([]);

  useEffect(() => {
    if (opened) {
      setAddRoles([]);
      setRemoveRoles([]);
    }
  }, [opened]);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Update roles"
      data-testid="users-manager-bulk-roles-modal"
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Add and/or remove roles for {count} selected {count === 1 ? 'user' : 'users'}. Users can
          hold multiple roles.
        </Text>
        <MultiSelect
          label="Add roles"
          placeholder="Select roles to add"
          data={roles.map((role) => ({
            value: role.id,
            label: role.name,
            // Scope rules reject assignment of non-assignable roles server-side.
            disabled: role.assignable === false,
          }))}
          value={addRoles}
          onChange={setAddRoles}
          searchable
          clearable
          data-testid="users-manager-bulk-roles-add"
        />
        <MultiSelect
          label="Remove roles"
          placeholder="Select roles to remove"
          data={roles.map((role) => ({ value: role.id, label: role.name }))}
          value={removeRoles}
          onChange={setRemoveRoles}
          searchable
          clearable
          data-testid="users-manager-bulk-roles-remove"
        />
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={() => onApply(addRoles, removeRoles)}
            loading={busy}
            disabled={addRoles.length === 0 && removeRoles.length === 0}
            data-testid="users-manager-bulk-roles-apply"
          >
            Apply
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};

/**
 * Full users list surface: search, role/status filters, sortable columns,
 * pagination with a page-size selector, bulk actions (roles/status/delete),
 * and a row menu for edit/delete. Ported from the buildpad-daas reference
 * `app/users/page.tsx` to `useUsers`/`useRoles` + `usePermissions` and
 * routing-agnostic navigation via `onUserClick`/`onCreateUser` props.
 */
export const UsersManager: React.FC<UsersManagerProps> = ({
  onUserClick,
  onCreateUser,
  pageSize = 25,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  hideHeader = false,
  usersCollection = 'daas_users',
}) => {
  const { fetchUsers, updateUser, deleteUser, bulkUpdateUsers } = useUsers();
  const { fetchRoles } = useRoles();
  const { canPerform, isAdmin, loading: permsLoading } = usePermissions({
    collections: [usersCollection],
  });

  // Optimistic while permissions resolve, then enforce; admins bypass.
  const createAllowed = permsLoading || isAdmin || canPerform(usersCollection, 'create');
  const updateAllowed = permsLoading || isAdmin || canPerform(usersCollection, 'update');
  const deleteAllowed = permsLoading || isAdmin || canPerform(usersCollection, 'delete');
  const selectable = updateAllowed || deleteAllowed;

  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(pageSize);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, 300);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<UserStatus | null>(null);
  // Server-side sort (`field` / `-field`); fields are whitelisted real columns.
  const [sort, setSort] = useState<string | null>(null);

  const {
    selection,
    setSelection,
    toggleSelection,
    clearSelection,
    isSelected,
    selectionCount,
  } = useSelection<string>();

  const [deleteModal, setDeleteModal] = useState<{ opened: boolean; id: string }>({
    opened: false,
    id: '',
  });
  const [deleting, setDeleting] = useState(false);

  const [bulkRolesOpen, setBulkRolesOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  const hasFilters = Boolean(debouncedSearch || selectedRole || selectedStatus);

  const sizeOptions = useMemo(() => {
    return Array.from(new Set([...pageSizeOptions, pageSize])).sort((a, b) => a - b);
  }, [pageSizeOptions, pageSize]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchUsers({
        page,
        limit,
        search: debouncedSearch || undefined,
        role: selectedRole || undefined,
        status: selectedStatus || undefined,
        sort: sort || undefined,
        // Expand the roles junction so the Role column has names to badge
        // (daas reference projection — without it the API returns bare IDs).
        fields: '*,roles.*,roles.role_id.name',
      });
      setUsers(result.users);
      setTotalCount(result.total);
      setTotalPages(result.totalPages);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [fetchUsers, page, limit, debouncedSearch, selectedRole, selectedStatus, sort]);

  useEffect(() => {
    void load();
  }, [load]);

  // Reset to page 1 whenever a filter, the sort, or the page size changes.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, selectedRole, selectedStatus, sort, limit]);

  // Selection survives page changes but not a change of what's being listed.
  useEffect(() => {
    clearSelection();
  }, [debouncedSearch, selectedRole, selectedStatus, clearSelection]);

  useEffect(() => {
    fetchRoles({ limit: 1000 })
      .then((result) => setRoles(result.roles))
      .catch(() => setRoles([]));
  }, [fetchRoles]);

  const handleSort = useCallback((field: string) => {
    setSort((current) => toggleSort(current, field));
  }, []);

  const pageIds = useMemo(() => users.map((user) => user.id), [users]);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => isSelected(id));
  const somePageSelected = pageIds.some((id) => isSelected(id));

  const togglePageSelection = useCallback(() => {
    if (allPageSelected) {
      setSelection(selection.filter((id) => !pageIds.includes(id)));
    } else {
      setSelection(Array.from(new Set([...selection, ...pageIds])));
    }
  }, [allPageSelected, selection, pageIds, setSelection]);

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

  const bulkApplyRoles = useCallback(
    async (addRoles: string[], removeRoles: string[]) => {
      setBulkBusy(true);
      try {
        await bulkUpdateUsers(selection, {
          addRoles: addRoles.length > 0 ? addRoles : undefined,
          removeRoles: removeRoles.length > 0 ? removeRoles : undefined,
        });
        notifications.show({
          title: 'Roles updated',
          message: `Roles updated for ${selection.length} ${selection.length === 1 ? 'user' : 'users'}`,
          color: 'green',
        });
        setBulkRolesOpen(false);
        clearSelection();
        await load();
      } catch (err) {
        notifications.show({
          title: 'Error',
          message: err instanceof Error ? err.message : 'Failed to update roles',
          color: 'red',
        });
      } finally {
        setBulkBusy(false);
      }
    },
    [bulkUpdateUsers, selection, clearSelection, load]
  );

  // No bulk-status/bulk-delete endpoints exist — fan out per user.
  const bulkSetStatus = useCallback(
    async (status: UserStatus) => {
      setBulkBusy(true);
      try {
        const results = await Promise.allSettled(
          selection.map((id) => updateUser(id, { status }))
        );
        const failed = results.filter((r) => r.status === 'rejected').length;
        const succeeded = results.length - failed;
        notifications.show({
          title: failed > 0 ? 'Completed with errors' : 'Status updated',
          message:
            failed > 0
              ? `Status updated for ${succeeded} of ${results.length} users (${failed} failed)`
              : `Status set to "${status}" for ${succeeded} ${succeeded === 1 ? 'user' : 'users'}`,
          color: failed > 0 ? 'orange' : 'green',
        });
        clearSelection();
        await load();
      } finally {
        setBulkBusy(false);
      }
    },
    [selection, updateUser, clearSelection, load]
  );

  const bulkDelete = useCallback(async () => {
    setBulkBusy(true);
    try {
      const results = await Promise.allSettled(selection.map((id) => deleteUser(id)));
      const failed = results.filter((r) => r.status === 'rejected').length;
      const succeeded = results.length - failed;
      notifications.show({
        title: failed > 0 ? 'Completed with errors' : 'Users deleted',
        message:
          failed > 0
            ? `Deleted ${succeeded} of ${results.length} users (${failed} failed)`
            : `Deleted ${succeeded} ${succeeded === 1 ? 'user' : 'users'}`,
        color: failed > 0 ? 'orange' : 'green',
      });
      setBulkDeleteOpen(false);
      clearSelection();
      await load();
    } finally {
      setBulkBusy(false);
    }
  }, [selection, deleteUser, clearSelection, load]);

  const addButton =
    createAllowed && onCreateUser ? (
      <Button leftSection={<IconPlus size={16} />} onClick={onCreateUser} data-testid="users-manager-add-btn">
        Add User
      </Button>
    ) : null;

  return (
    <Stack gap="md" className="bp-users-manager" data-testid="users-manager">
      {(!hideHeader || addButton) && (
        <Group justify={hideHeader ? 'flex-end' : 'space-between'} align="flex-start">
          {!hideHeader && (
            <Box>
              <Title order={2} mb={4}>
                Users
              </Title>
              <Text size="sm" c="dimmed">
                Manage user accounts, roles, and access permissions
              </Text>
            </Box>
          )}
          {addButton}
        </Group>
      )}

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

      {selectionCount > 0 && (
        <Paper p="sm" radius="md" withBorder data-testid="users-manager-bulk-toolbar">
          <Group>
            <Text size="sm" fw={500}>
              {selectionCount} selected
            </Text>
            <Button
              variant="subtle"
              color="gray"
              size="xs"
              onClick={clearSelection}
              data-testid="users-manager-bulk-clear"
            >
              Clear
            </Button>
            <Group gap="xs" style={{ marginLeft: 'auto' }}>
              {updateAllowed && (
                <>
                  <Button
                    variant="light"
                    size="xs"
                    leftSection={<IconUsersGroup size={14} />}
                    onClick={() => setBulkRolesOpen(true)}
                    data-testid="users-manager-bulk-roles"
                  >
                    Update roles…
                  </Button>
                  <Menu position="bottom-end" withinPortal>
                    <Menu.Target>
                      <Button variant="light" size="xs" data-testid="users-manager-bulk-status">
                        Set status
                      </Button>
                    </Menu.Target>
                    <Menu.Dropdown>
                      {STATUS_OPTIONS.map((option) => (
                        <Menu.Item
                          key={option.value}
                          onClick={() => void bulkSetStatus(option.value)}
                          data-testid={`users-manager-bulk-status-${option.value}`}
                        >
                          {option.label}
                        </Menu.Item>
                      ))}
                    </Menu.Dropdown>
                  </Menu>
                </>
              )}
              {deleteAllowed && (
                <Button
                  variant="light"
                  color="red"
                  size="xs"
                  leftSection={<IconTrash size={14} />}
                  onClick={() => setBulkDeleteOpen(true)}
                  data-testid="users-manager-bulk-delete"
                >
                  Delete
                </Button>
              )}
            </Group>
          </Group>
        </Paper>
      )}

      <Paper radius="md" withBorder style={{ overflow: 'hidden' }}>
        <Box pos="relative">
          <LoadingOverlay visible={loading} />

          <Table highlightOnHover withTableBorder={false}>
            <Table.Thead>
              <Table.Tr>
                {selectable && (
                  <Table.Th style={{ width: 40 }}>
                    <Checkbox
                      size="xs"
                      checked={allPageSelected}
                      indeterminate={!allPageSelected && somePageSelected}
                      onChange={togglePageSelection}
                      aria-label="Select all on page"
                      data-testid="users-manager-select-all"
                    />
                  </Table.Th>
                )}
                <SortableTh label="User" field="first_name" sort={sort} onSort={handleSort} data-testid="users-manager-sort-first_name" />
                <SortableTh label="Email" field="email" sort={sort} onSort={handleSort} data-testid="users-manager-sort-email" />
                <Table.Th>Role</Table.Th>
                <SortableTh label="Status" field="status" sort={sort} onSort={handleSort} data-testid="users-manager-sort-status" />
                <SortableTh label="Last Access" field="last_access" sort={sort} onSort={handleSort} data-testid="users-manager-sort-last_access" />
                {(updateAllowed || deleteAllowed) && <Table.Th style={{ width: 50 }} />}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {users.length === 0 && !loading ? (
                <Table.Tr>
                  <Table.Td colSpan={selectable ? 7 : 5}>
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
                      {selectable && (
                        <Table.Td onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            size="xs"
                            checked={isSelected(user.id)}
                            onChange={() => toggleSelection(user.id)}
                            aria-label={`Select ${getUserDisplayName(user)}`}
                            data-testid={`users-manager-select-${user.id}`}
                          />
                        </Table.Td>
                      )}
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

        {totalCount > 0 && (
          <Group justify="space-between" px="md" py="sm" style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}>
            <Group gap="sm">
              <Text size="xs" c="dimmed">
                Showing {users.length} of {totalCount} users
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
                data-testid="users-manager-page-size"
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
        title="Delete user"
        description="Are you sure you want to delete this user? This action cannot be undone."
      />

      <DeleteConfirmModal
        opened={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        onConfirm={bulkDelete}
        loading={bulkBusy}
        title="Delete users"
        description={`Are you sure you want to delete ${selectionCount} ${selectionCount === 1 ? 'user' : 'users'}? This action cannot be undone.`}
      />

      <BulkRolesModal
        opened={bulkRolesOpen}
        onClose={() => setBulkRolesOpen(false)}
        roles={roles}
        count={selectionCount}
        busy={bulkBusy}
        onApply={(addRoles, removeRoles) => void bulkApplyRoles(addRoles, removeRoles)}
      />
    </Stack>
  );
};

export default UsersManager;
