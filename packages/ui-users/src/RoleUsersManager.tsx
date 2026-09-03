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
import { useBuildpadI18n, useBuildpadTranslations } from '@buildpad/services';
import type { Role, User } from '@buildpad/types';
import { interpolate, type DeepPartial, type UsersTranslations } from '@buildpad/utils';
import { UserAvatar } from './UserAvatar';
import { UserStatusBadge } from './UserStatusBadge';
import { splitTaggedText } from './accessUtils';
import { getUserDisplayName } from './userDisplay';

export interface RoleUsersManagerProps {
  /** ID of the role whose membership is managed. */
  roleId: string;
  /** Role name, used in confirmation copy. Default: the dictionary's "this role". */
  roleName?: string;
  /** Called after any successful membership change so the parent can refresh counts. */
  onUpdate?: () => void;
  /** Called when a user row's "open" action is clicked. Hidden when omitted. */
  onUserClick?: (user: User) => void;
  /** Called when "Add User" is clicked. Button hidden when omitted. */
  onAddUser?: () => void;
  /** Per-instance overrides of the `users` dictionary namespace (prop > provider > defaults). */
  translations?: DeepPartial<UsersTranslations>;
}

/**
 * Lists the users holding a role and manages membership: remove users from
 * the role or move them to another role, individually or in bulk — all via
 * `PATCH /api/users/bulk-update` with `addRoles`/`removeRoles`. Ported from
 * the buildpad-daas `RoleUsersManager`.
 */
export const RoleUsersManager: React.FC<RoleUsersManagerProps> = ({
  roleId,
  roleName,
  onUpdate,
  onUserClick,
  onAddUser,
  translations,
}) => {
  const { fetchUsers, bulkUpdateUsers } = useUsers();
  const { fetchRoles } = useRoles();
  const t = useBuildpadTranslations((d) => d.users, translations);
  const common = useBuildpadTranslations((d) => d.common);
  const { formatCount } = useBuildpadI18n();
  const roleLabel = roleName ?? t.roleUsers.defaultRoleName;

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
        title: common.error,
        message: err instanceof Error ? err.message : t.roleUsers.notifications.fetchFailed,
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  }, [fetchUsers, roleId, t, common]);

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
          title: common.success,
          message: formatCount(userIds.length, t.roleUsers.notifications.removed, {
            roleName: roleLabel,
          }),
          color: 'green',
        });
        await load();
        onUpdate?.();
      } catch (err) {
        notifications.show({
          title: common.error,
          message: err instanceof Error ? err.message : t.roleUsers.notifications.removeFailed,
          color: 'red',
        });
      } finally {
        setProcessing(false);
      }
    },
    [bulkUpdateUsers, roleId, roleLabel, load, onUpdate, t, common, formatCount]
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
        title: common.success,
        message: formatCount(selectedUsers.length, t.roleUsers.notifications.moved),
        color: 'green',
      });
      closeMoveModal();
      await load();
      onUpdate?.();
    } catch (err) {
      notifications.show({
        title: common.error,
        message: err instanceof Error ? err.message : t.roleUsers.notifications.moveFailed,
        color: 'red',
      });
    } finally {
      setProcessing(false);
    }
  }, [
    bulkUpdateUsers,
    targetRoleId,
    selectedUsers,
    roleId,
    closeMoveModal,
    load,
    onUpdate,
    t,
    common,
    formatCount,
  ]);

  return (
    <Paper shadow="xs" p="md" withBorder data-testid="role-users-manager">
      <Stack gap="md">
        <Group justify="space-between">
          <Group gap="sm" align="center">
            <Text fw={600} size="lg">
              {t.roleUsers.title}
            </Text>
            <Badge size="lg" circle variant="filled">
              {users.length}
            </Badge>
          </Group>
          {onAddUser && (
            <Button leftSection={<IconUserPlus size={16} />} size="sm" onClick={onAddUser}>
              {t.roleUsers.addUser}
            </Button>
          )}
        </Group>

        <Box pos="relative" mih={100}>
          <LoadingOverlay visible={loading} />

          {users.length === 0 && !loading ? (
            <Text c="dimmed" ta="center" py="xl">
              {t.roleUsers.emptyState}
            </Text>
          ) : (
            <Table withTableBorder={false}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ width: 50 }} />
                  <Table.Th>{t.columns.name}</Table.Th>
                  <Table.Th>{t.columns.email}</Table.Th>
                  <Table.Th>{t.columns.status}</Table.Th>
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
                      <UserStatusBadge status={user.status} translations={translations} />
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs" wrap="nowrap" justify="flex-end">
                        <Tooltip label={t.roleUsers.moveTooltip}>
                          <ActionIcon
                            variant="subtle"
                            onClick={() => void openMoveModal([user.id])}
                            aria-label={interpolate(t.roleUsers.moveAriaLabel, {
                              name: getUserDisplayName(user),
                            })}
                          >
                            <IconUserMinus size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label={t.roleUsers.removeTooltip}>
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            loading={processing}
                            onClick={() => void removeFromRole([user.id])}
                            aria-label={interpolate(t.roleUsers.removeAriaLabel, {
                              name: getUserDisplayName(user),
                            })}
                            data-testid={`role-user-remove-btn-${user.id}`}
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Tooltip>
                        {onUserClick && (
                          <Tooltip label={t.roleUsers.openTooltip}>
                            <ActionIcon
                              variant="subtle"
                              onClick={() => onUserClick(user)}
                              aria-label={interpolate(t.roleUsers.openAriaLabel, {
                                name: getUserDisplayName(user),
                              })}
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
              {t.roleUsers.removeAll}
            </Button>
            <Button
              variant="light"
              size="sm"
              leftSection={<IconUserMinus size={14} />}
              onClick={() => void openMoveModal(users.map((u) => u.id))}
            >
              {t.roleUsers.moveAll}
            </Button>
          </Group>
        )}
      </Stack>

      <Modal
        opened={moveModalOpen}
        onClose={closeMoveModal}
        title={formatCount(selectedUsers.length, t.roleUsers.moveModal.title)}
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            {splitTaggedText(t.roleUsers.moveModal.description, { roleName: roleLabel }).map(
              (segment, index) =>
                segment.tag === 'strong' ? (
                  <Text key={index} span fw={500}>
                    {segment.text}
                  </Text>
                ) : segment.tag === 'remove' ? (
                  <Text key={index} span c="red">
                    {segment.text}
                  </Text>
                ) : (
                  <React.Fragment key={index}>{segment.text}</React.Fragment>
                ),
            )}
          </Text>

          <Select
            label={t.roleUsers.moveModal.targetRoleLabel}
            placeholder={t.roleUsers.moveModal.targetRolePlaceholder}
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
              {common.cancel}
            </Button>
            <Button onClick={() => void moveUsers()} disabled={!targetRoleId} loading={processing}>
              {t.roleUsers.moveModal.confirm}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Paper>
  );
};

export default RoleUsersManager;
