'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  LoadingOverlay,
  Modal,
  Paper,
  Select,
  Stack,
  Table,
  Text,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconExternalLink,
  IconTrash,
  IconUserMinus,
  IconUserPlus,
} from '@tabler/icons-react';
import { useRoles, useUsers } from '@buildpad/hooks';
import type { Role, User } from '@buildpad/types';
import { UserAvatar } from './UserAvatar';
import { UserStatusBadge } from './UserStatusBadge';
import { getUserDisplayName } from './userDisplay';

export interface RoleUsersManagerProps {
  /** ID of the role whose membership is managed. */
  roleId: string;
  /** Role name, used in confirmation copy. */
  roleName?: string;
  /** Called after any successful membership change so the parent can refresh counts. */
  onUpdate?: () => void;
  /** Called when a user row's "open" action is clicked. Hidden when omitted. */
  onUserClick?: (user: User) => void;
  /** Called when "Add User" is clicked. Button hidden when omitted. */
  onAddUser?: () => void;
}

/**
 * Lists the users holding a role and manages membership: remove users from
 * the role or move them to another role, individually or in bulk — all via
 * `PATCH /api/users/bulk-update` with `addRoles`/`removeRoles`. Ported from
 * the buildpad-daas `RoleUsersManager`.
 */
export const RoleUsersManager: React.FC<RoleUsersManagerProps> = ({
  roleId,
  roleName = 'this role',
  onUpdate,
  onUserClick,
  onAddUser,
}) => {
  const { fetchUsers, bulkUpdateUsers } = useUsers();
  const { fetchRoles } = useRoles();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  // "Move to another role" modal: remove from this role + add to the target.
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [availableRoles, setAvailableRoles] = useState<Role[]>([]);
  const [targetRoleId, setTargetRoleId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchUsers({ role: roleId, limit: 1000 });
      setUsers(result.users);
    } catch (err) {
      notifications.show({
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to fetch users',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  }, [fetchUsers, roleId]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Remove users from this role (they keep any other roles they have). */
  const removeFromRole = useCallback(
    async (userIds: string[]) => {
      if (userIds.length === 0) return;
      setProcessing(true);
      try {
        await bulkUpdateUsers(userIds, { removeRoles: [roleId] });
        notifications.show({
          title: 'Success',
          message: `${userIds.length} user(s) removed from "${roleName}"`,
          color: 'green',
        });
        await load();
        onUpdate?.();
      } catch (err) {
        notifications.show({
          title: 'Error',
          message: err instanceof Error ? err.message : 'Failed to remove users from role',
          color: 'red',
        });
      } finally {
        setProcessing(false);
      }
    },
    [bulkUpdateUsers, roleId, roleName, load, onUpdate]
  );

  const openMoveModal = useCallback(
    async (userIds: string[]) => {
      setSelectedUsers(userIds);
      try {
        const result = await fetchRoles({ limit: 1000 });
        setAvailableRoles(result.roles.filter((r) => r.id !== roleId));
      } catch {
        setAvailableRoles([]);
      }
      setMoveModalOpen(true);
    },
    [fetchRoles, roleId]
  );

  const closeMoveModal = useCallback(() => {
    setMoveModalOpen(false);
    setSelectedUsers([]);
    setTargetRoleId(null);
  }, []);

  /** Move users: remove from this role AND add to the selected target role. */
  const moveUsers = useCallback(async () => {
    if (!targetRoleId || selectedUsers.length === 0) return;
    setProcessing(true);
    try {
      await bulkUpdateUsers(selectedUsers, {
        removeRoles: [roleId],
        addRoles: [targetRoleId],
      });
      notifications.show({
        title: 'Success',
        message: `${selectedUsers.length} user(s) moved to the selected role`,
        color: 'green',
      });
      closeMoveModal();
      await load();
      onUpdate?.();
    } catch (err) {
      notifications.show({
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to move users',
        color: 'red',
      });
    } finally {
      setProcessing(false);
    }
  }, [bulkUpdateUsers, targetRoleId, selectedUsers, roleId, closeMoveModal, load, onUpdate]);

  return (
    <Paper shadow="xs" p="md" withBorder data-testid="role-users-manager">
      <Stack gap="md">
        <Group justify="space-between">
          <Group gap="sm" align="center">
            <Text fw={600} size="lg">
              Users
            </Text>
            <Badge size="lg" circle variant="filled">
              {users.length}
            </Badge>
          </Group>
          {onAddUser && (
            <Button leftSection={<IconUserPlus size={16} />} size="sm" onClick={onAddUser}>
              Add User
            </Button>
          )}
        </Group>

        <Box pos="relative" mih={100}>
          <LoadingOverlay visible={loading} />

          {users.length === 0 && !loading ? (
            <Text c="dimmed" ta="center" py="xl">
              No users assigned to this role
            </Text>
          ) : (
            <Table withTableBorder={false}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ width: 50 }} />
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Email</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th style={{ width: 120 }} />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {users.map((user) => (
                  <Table.Tr key={user.id} data-testid={`role-user-row-${user.id}`}>
                    <Table.Td>
                      <UserAvatar user={user} size={28} />
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" fw={500}>
                        {getUserDisplayName(user)}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed">
                        {user.email}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <UserStatusBadge status={user.status} />
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs" wrap="nowrap" justify="flex-end">
                        <Tooltip label="Move to another role">
                          <ActionIcon
                            variant="subtle"
                            onClick={() => void openMoveModal([user.id])}
                            aria-label={`Move ${getUserDisplayName(user)} to another role`}
                          >
                            <IconUserMinus size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Remove from this role">
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            loading={processing}
                            onClick={() => void removeFromRole([user.id])}
                            aria-label={`Remove ${getUserDisplayName(user)} from this role`}
                            data-testid={`role-user-remove-btn-${user.id}`}
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Tooltip>
                        {onUserClick && (
                          <Tooltip label="Open user">
                            <ActionIcon
                              variant="subtle"
                              onClick={() => onUserClick(user)}
                              aria-label={`Open ${getUserDisplayName(user)}`}
                            >
                              <IconExternalLink size={16} />
                            </ActionIcon>
                          </Tooltip>
                        )}
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Box>

        {users.length > 1 && (
          <Group justify="flex-end" gap="xs">
            <Button
              variant="light"
              color="red"
              size="sm"
              leftSection={<IconTrash size={14} />}
              loading={processing}
              onClick={() => void removeFromRole(users.map((u) => u.id))}
            >
              Remove All from Role
            </Button>
            <Button
              variant="light"
              size="sm"
              leftSection={<IconUserMinus size={14} />}
              onClick={() => void openMoveModal(users.map((u) => u.id))}
            >
              Move All to Another Role
            </Button>
          </Group>
        )}
      </Stack>

      <Modal
        opened={moveModalOpen}
        onClose={closeMoveModal}
        title={`Move ${selectedUsers.length} User(s) to Another Role`}
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            The selected user(s) will be{' '}
            <Text span fw={500}>
              removed from &ldquo;{roleName}&rdquo;
            </Text>{' '}
            and added to the role you choose below. Users can hold multiple roles — if you only
            want to remove them, close this dialog and use the{' '}
            <Text span c="red">
              Remove
            </Text>{' '}
            button instead.
          </Text>

          <Select
            label="Target Role"
            placeholder="Select a role"
            data={availableRoles.map((role) => ({
              value: role.id,
              label: role.name,
              // Roles with scope rules that exclude the current scope are
              // rejected server-side on assignment — disable them here.
              disabled: role.assignable === false,
            }))}
            value={targetRoleId}
            onChange={setTargetRoleId}
            required
          />

          <Group justify="flex-end">
            <Button variant="default" onClick={closeMoveModal}>
              Cancel
            </Button>
            <Button onClick={() => void moveUsers()} disabled={!targetRoleId} loading={processing}>
              Move
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Paper>
  );
};

export default RoleUsersManager;
