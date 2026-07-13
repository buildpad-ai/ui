'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  LoadingOverlay,
  Paper,
  Stack,
  Table,
  Text,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconExternalLink, IconPlus, IconShield, IconTrash } from '@tabler/icons-react';
import type { Policy } from '@buildpad/types';
import { IconDisplay } from '@buildpad/ui-interfaces/select-icon';
import { PolicyPickerModal } from './PolicyPickerModal';
import { DeleteConfirmModal } from './DeleteConfirmModal';

export interface PolicyAttachmentManagerProps {
  /** Fetch the currently attached policies. */
  fetchAttached: () => Promise<Policy[]>;
  /** Attach the selected policy IDs. */
  attach: (policyIds: string[]) => Promise<void>;
  /** Detach a single policy by ID. */
  detach: (policyId: string) => Promise<void>;
  /** Called after any successful attach/detach so the parent can refresh counts. */
  onUpdate?: () => void;
  /** Called when a policy row's "open" action is clicked. Hidden when omitted. */
  onPolicyClick?: (policy: Policy) => void;
  /** Empty-state message. */
  emptyMessage?: string;
}

/**
 * Attached-policies list + attach/detach flows shared by
 * `UserPoliciesManager` and `RolePoliciesManager` — the two buildpad-daas
 * reference managers are identical except for the endpoints, which are
 * injected here as `fetchAttached`/`attach`/`detach`.
 */
export const PolicyAttachmentManager: React.FC<PolicyAttachmentManagerProps> = ({
  fetchAttached,
  attach,
  detach,
  onUpdate,
  onPolicyClick,
  emptyMessage = 'No policies attached',
}) => {
  const [attached, setAttached] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [detachModal, setDetachModal] = useState<{ opened: boolean; policyId: string }>({
    opened: false,
    policyId: '',
  });
  const [detaching, setDetaching] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setAttached(await fetchAttached());
    } catch (err) {
      notifications.show({
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to fetch policies',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  }, [fetchAttached]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAttach = useCallback(
    async (policyIds: string[]) => {
      try {
        await attach(policyIds);
        notifications.show({
          title: 'Success',
          message: 'Policies attached successfully',
          color: 'green',
        });
        setPickerOpen(false);
        await load();
        onUpdate?.();
      } catch (err) {
        notifications.show({
          title: 'Error',
          message: err instanceof Error ? err.message : 'Failed to attach policies',
          color: 'red',
        });
      }
    },
    [attach, load, onUpdate]
  );

  const confirmDetach = useCallback(async () => {
    setDetaching(true);
    try {
      await detach(detachModal.policyId);
      notifications.show({
        title: 'Success',
        message: 'Policy removed successfully',
        color: 'green',
      });
      setDetachModal({ opened: false, policyId: '' });
      await load();
      onUpdate?.();
    } catch (err) {
      notifications.show({
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to remove policy',
        color: 'red',
      });
    } finally {
      setDetaching(false);
    }
  }, [detach, detachModal.policyId, load, onUpdate]);

  return (
    <Paper shadow="xs" p="md" withBorder data-testid="policy-attachment-manager">
      <Stack gap="md">
        <Group justify="space-between">
          <Group gap="sm" align="center">
            <Text fw={600} size="lg">
              Policies
            </Text>
            <Badge size="lg" circle variant="filled">
              {attached.length}
            </Badge>
          </Group>
          <Button
            leftSection={<IconPlus size={16} />}
            size="sm"
            onClick={() => setPickerOpen(true)}
            data-testid="policy-attachment-add-btn"
          >
            Add Policies
          </Button>
        </Group>

        <Box pos="relative" mih={100}>
          <LoadingOverlay visible={loading} />

          {attached.length === 0 && !loading ? (
            <Text c="dimmed" ta="center" py="xl">
              {emptyMessage}
            </Text>
          ) : (
            <Table withTableBorder={false}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ width: 48 }} />
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Access</Table.Th>
                  <Table.Th>Description</Table.Th>
                  <Table.Th style={{ width: 100 }} />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {attached.map((policy) => (
                  <Table.Tr key={policy.id} data-testid={`attached-policy-row-${policy.id}`}>
                    <Table.Td>
                      <IconDisplay icon={policy.icon} fallback={IconShield} />
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" fw={500}>
                        {policy.name}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        {policy.admin_access && (
                          <Badge color="red" size="sm">
                            Admin
                          </Badge>
                        )}
                        {policy.app_access && (
                          <Badge color="blue" size="sm">
                            App
                          </Badge>
                        )}
                        {policy.delegate_access && (
                          <Badge color="green" size="sm">
                            Delegate
                          </Badge>
                        )}
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed" lineClamp={1}>
                        {policy.description || '-'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs" wrap="nowrap" justify="flex-end">
                        {onPolicyClick && (
                          <Tooltip label="Open policy">
                            <ActionIcon
                              variant="subtle"
                              onClick={() => onPolicyClick(policy)}
                              aria-label={`Open ${policy.name}`}
                            >
                              <IconExternalLink size={16} />
                            </ActionIcon>
                          </Tooltip>
                        )}
                        <Tooltip label="Remove policy">
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            onClick={() => setDetachModal({ opened: true, policyId: policy.id })}
                            aria-label={`Remove ${policy.name}`}
                            data-testid={`detach-policy-btn-${policy.id}`}
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Box>
      </Stack>

      <PolicyPickerModal
        opened={pickerOpen}
        onClose={() => setPickerOpen(false)}
        excludeIds={attached.map((p) => p.id)}
        onAttach={handleAttach}
      />

      <DeleteConfirmModal
        opened={detachModal.opened}
        onClose={() => setDetachModal({ opened: false, policyId: '' })}
        onConfirm={confirmDetach}
        loading={detaching}
        title="Remove policy"
        description="Are you sure you want to remove this policy? The user or role will lose the permissions it grants."
        confirmLabel="Remove"
      />
    </Paper>
  );
};

export default PolicyAttachmentManager;
