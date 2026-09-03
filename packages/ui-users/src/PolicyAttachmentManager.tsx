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
import { useBuildpadTranslations } from '@buildpad/services';
import type { Policy } from '@buildpad/types';
import { IconDisplay } from '@buildpad/ui-interfaces/select-icon';
import { interpolate, type DeepPartial, type UsersTranslations } from '@buildpad/utils';
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
  /** Empty-state message. Default: the dictionary's "No policies attached". */
  emptyMessage?: string;
  /** Per-instance overrides of the `users` dictionary namespace (prop > provider > defaults). */
  translations?: DeepPartial<UsersTranslations>;
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
  emptyMessage,
  translations,
}) => {
  const t = useBuildpadTranslations((d) => d.users, translations);
  const common = useBuildpadTranslations((d) => d.common);
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
        title: common.error,
        message: err instanceof Error ? err.message : t.policyAttachment.notifications.fetchFailed,
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  }, [fetchAttached, t, common]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAttach = useCallback(
    async (policyIds: string[]) => {
      try {
        await attach(policyIds);
        notifications.show({
          title: common.success,
          message: t.policyAttachment.notifications.attached,
          color: 'green',
        });
        setPickerOpen(false);
        await load();
        onUpdate?.();
      } catch (err) {
        notifications.show({
          title: common.error,
          message: err instanceof Error ? err.message : t.policyAttachment.notifications.attachFailed,
          color: 'red',
        });
      }
    },
    [attach, load, onUpdate, t, common]
  );

  const confirmDetach = useCallback(async () => {
    setDetaching(true);
    try {
      await detach(detachModal.policyId);
      notifications.show({
        title: common.success,
        message: t.policyAttachment.notifications.removed,
        color: 'green',
      });
      setDetachModal({ opened: false, policyId: '' });
      await load();
      onUpdate?.();
    } catch (err) {
      notifications.show({
        title: common.error,
        message: err instanceof Error ? err.message : t.policyAttachment.notifications.removeFailed,
        color: 'red',
      });
    } finally {
      setDetaching(false);
    }
  }, [detach, detachModal.policyId, load, onUpdate, t, common]);

  return (
    <Paper shadow="xs" p="md" withBorder data-testid="policy-attachment-manager">
      <Stack gap="md">
        <Group justify="space-between">
          <Group gap="sm" align="center">
            <Text fw={600} size="lg">
              {t.policyAttachment.title}
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
            {t.policyAttachment.addButton}
          </Button>
        </Group>

        <Box pos="relative" mih={100}>
          <LoadingOverlay visible={loading} />

          {attached.length === 0 && !loading ? (
            <Text c="dimmed" ta="center" py="xl">
              {emptyMessage ?? t.policyAttachment.emptyState}
            </Text>
          ) : (
            <Table withTableBorder={false}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ width: 48 }} />
                  <Table.Th>{t.columns.name}</Table.Th>
                  <Table.Th>{t.columns.access}</Table.Th>
                  <Table.Th>{t.columns.description}</Table.Th>
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
                            {t.policyAccess.admin}
                          </Badge>
                        )}
                        {policy.app_access && (
                          <Badge color="blue" size="sm">
                            {t.policyAccess.app}
                          </Badge>
                        )}
                        {policy.delegate_access && (
                          <Badge color="green" size="sm">
                            {t.policyAccess.delegate}
                          </Badge>
                        )}
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed" lineClamp={1}>
                        {policy.description || t.policyAttachment.emptyDescription}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs" wrap="nowrap" justify="flex-end">
                        {onPolicyClick && (
                          <Tooltip label={t.policyAttachment.openTooltip}>
                            <ActionIcon
                              variant="subtle"
                              onClick={() => onPolicyClick(policy)}
                              aria-label={interpolate(t.policyAttachment.openAriaLabel, { name: policy.name })}
                            >
                              <IconExternalLink size={16} />
                            </ActionIcon>
                          </Tooltip>
                        )}
                        <Tooltip label={t.policyAttachment.removeTooltip}>
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            onClick={() => setDetachModal({ opened: true, policyId: policy.id })}
                            aria-label={interpolate(t.policyAttachment.removeAriaLabel, { name: policy.name })}
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
        translations={translations}
      />

      <DeleteConfirmModal
        opened={detachModal.opened}
        onClose={() => setDetachModal({ opened: false, policyId: '' })}
        onConfirm={confirmDetach}
        loading={detaching}
        title={t.policyAttachment.detachModal.title}
        description={t.policyAttachment.detachModal.description}
        confirmLabel={t.policyAttachment.detachModal.confirm}
        translations={translations}
      />
    </Paper>
  );
};

export default PolicyAttachmentManager;
