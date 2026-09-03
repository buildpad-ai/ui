'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Grid,
  Group,
  LoadingOverlay,
  Paper,
  Stack,
  Switch,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconTrash } from '@tabler/icons-react';
import { usePermissions, usePolicies } from '@buildpad/hooks';
import { apiRequest, useBuildpadI18n, useBuildpadTranslations } from '@buildpad/services';
import type { ModuleAccessMap, Permission, Policy } from '@buildpad/types';
import { SelectIcon } from '@buildpad/ui-interfaces/select-icon';
import {
  SystemPermissions,
  type PermissionAlterations,
} from '@buildpad/ui-interfaces/system-permissions';
import type { DeepPartial, UsersTranslations } from '@buildpad/utils';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { InfoPanel } from './InfoPanel';
import { ModuleAccessPanel } from './ModuleAccessPanel';
import { DATE_TIME_FORMAT_OPTIONS } from './accessUtils';

/** The editable subset of `Policy` this form manages. */
interface PolicyFormValues {
  name: string;
  icon: string;
  description: string;
  admin_access: boolean;
  app_access: boolean;
  delegate_access: boolean;
  /**
   * Module-level capability grants. Part of the form values (rather than
   * tracked separately like the permission matrix) so it rides the existing
   * dirty-detection and the single `updatePolicy` write.
   */
  module_access: ModuleAccessMap;
}

const EMPTY_FORM: PolicyFormValues = {
  name: '',
  icon: 'security',
  description: '',
  admin_access: false,
  app_access: false,
  delegate_access: false,
  module_access: {},
};

function hasAlterations(alterations: PermissionAlterations | null): boolean {
  if (!alterations) return false;
  return (
    alterations.create.length > 0 ||
    alterations.update.length > 0 ||
    alterations.delete.length > 0
  );
}

/** Strip the SystemPermissions display markers before sending to the API. */
function toPermissionPayload(item: Partial<Permission>): Partial<Permission> {
  const { $type: _type, $index: _index, ...payload } = item as Partial<Permission> & {
    $type?: string;
    $index?: number;
  };
  return payload;
}

/**
 * Apply a batch of permission alterations from `SystemPermissions` to the
 * `/api/permissions` endpoint: created rows are POSTed (bulk array, tagged
 * with the policy ID), updated rows PATCHed, deleted rows DELETEd.
 */
async function applyPermissionAlterations(
  policyId: string,
  alterations: PermissionAlterations
): Promise<void> {
  if (alterations.create.length > 0) {
    await apiRequest('/api/permissions', {
      method: 'POST',
      body: JSON.stringify(
        alterations.create.map((item) => ({ ...toPermissionPayload(item), policy: policyId }))
      ),
    });
  }
  for (const item of alterations.update) {
    if (item.id === undefined || item.id === null) continue;
    const { id, ...payload } = toPermissionPayload(item);
    await apiRequest(`/api/permissions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }
  for (const id of alterations.delete) {
    await apiRequest(`/api/permissions/${id}`, { method: 'DELETE' });
  }
}

export interface PolicyDetailProps {
  /** Policy ID to edit, or `'new'` to create a policy. */
  id: string;
  /** Called when the admin cancels. */
  onBack?: () => void;
  /** Called after the policy is deleted. */
  onDeleted?: () => void;
  /** Called after a successful create/update with the saved record. */
  onSaved?: (policy: Policy) => void;
  /** DaaS collection used for RBAC checks. Default: 'daas_policies'. */
  policiesCollection?: string;
  /** Per-instance overrides of the `users` dictionary namespace (prop > provider > defaults). */
  translations?: DeepPartial<UsersTranslations>;
}

/**
 * Policy create/edit surface: basic info, Access Control switches
 * (`app_access`, `admin_access`, `delegate_access`), and — for existing
 * policies — the per-collection permissions matrix reusing the
 * `SystemPermissions` interface from `@buildpad/ui-interfaces`. Matrix edits
 * are held as `PermissionAlterations` dirty state and applied to
 * `/api/permissions` together with the policy Save. Ported from the
 * buildpad-daas `app/policies/[id]/page.tsx` with the `PermissionsTable`
 * family replaced by `SystemPermissions` and routing replaced by callback
 * props.
 */
export const PolicyDetail: React.FC<PolicyDetailProps> = ({
  id,
  onBack,
  onDeleted,
  onSaved,
  policiesCollection = 'daas_policies',
  translations,
}) => {
  const isNew = id === 'new' || id === '+';
  const { getPolicy, createPolicy, updatePolicy, deletePolicy } = usePolicies();
  const { canPerform, isAdmin, loading: permsLoading } = usePermissions({
    collections: [policiesCollection],
  });
  const t = useBuildpadTranslations((d) => d.users, translations);
  const common = useBuildpadTranslations((d) => d.common);
  const { formatDateTime, formatCount } = useBuildpadI18n();

  const createAllowed = permsLoading || isAdmin || canPerform(policiesCollection, 'create');
  const updateAllowed = permsLoading || isAdmin || canPerform(policiesCollection, 'update');
  const deleteAllowed = permsLoading || isAdmin || canPerform(policiesCollection, 'delete');
  const saveAllowed = isNew ? createAllowed : updateAllowed;

  const [policy, setPolicy] = useState<Policy | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const [initialValues, setInitialValues] = useState<PolicyFormValues>(EMPTY_FORM);
  const [values, setValues] = useState<PolicyFormValues>(EMPTY_FORM);

  // Matrix edits from SystemPermissions, applied on Save. Bumping the
  // version remounts the matrix after a save so it refetches clean rows.
  const [alterations, setAlterations] = useState<PermissionAlterations | null>(null);
  const [permissionsVersion, setPermissionsVersion] = useState(0);

  const hasFormEdits = useMemo(
    () => JSON.stringify(values) !== JSON.stringify(initialValues),
    [values, initialValues]
  );
  const hasPermissionEdits = hasAlterations(alterations);
  const isDirty = hasFormEdits || hasPermissionEdits;

  const load = useCallback(async () => {
    if (isNew) return;
    setLoading(true);
    try {
      const fetched = await getPolicy(id);
      setPolicy(fetched);
      const formValues: PolicyFormValues = {
        name: fetched.name,
        icon: fetched.icon || 'security',
        description: fetched.description || '',
        admin_access: Boolean(fetched.admin_access),
        app_access: Boolean(fetched.app_access),
        delegate_access: Boolean(fetched.delegate_access),
        module_access: fetched.module_access ?? {},
      };
      setInitialValues(formValues);
      setValues(formValues);
    } catch (err) {
      notifications.show({
        title: common.error,
        message: err instanceof Error ? err.message : t.policyDetail.notifications.fetchFailed,
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  }, [getPolicy, id, isNew, t, common]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = useCallback(async () => {
    if (!values.name.trim()) {
      notifications.show({
        title: t.validationErrorTitle,
        message: t.policyDetail.validation.nameRequired,
        color: 'red',
      });
      return;
    }

    setSaving(true);
    try {
      let saved: Policy;
      if (isNew) {
        saved = await createPolicy({ ...values, name: values.name });
      } else {
        saved = hasFormEdits ? await updatePolicy(id, values) : (policy as Policy);
        if (alterations && hasPermissionEdits) {
          await applyPermissionAlterations(id, alterations);
          setAlterations(null);
          setPermissionsVersion((v) => v + 1);
        }
      }
      notifications.show({
        title: common.success,
        message: isNew ? t.policyDetail.notifications.created : t.policyDetail.notifications.updated,
        color: 'green',
      });
      setInitialValues(values);
      setPolicy(saved);
      onSaved?.(saved);
    } catch (err) {
      notifications.show({
        title: common.error,
        message: err instanceof Error ? err.message : t.policyDetail.notifications.saveFailed,
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  }, [
    values,
    isNew,
    createPolicy,
    updatePolicy,
    id,
    policy,
    hasFormEdits,
    alterations,
    hasPermissionEdits,
    onSaved,
    t,
    common,
  ]);

  const confirmDelete = useCallback(async () => {
    try {
      await deletePolicy(id);
      notifications.show({
        title: common.success,
        message: t.policyDetail.notifications.deleted,
        color: 'green',
      });
      setDeleteModalOpen(false);
      onDeleted?.();
    } catch (err) {
      notifications.show({
        title: common.error,
        message: err instanceof Error ? err.message : t.policyDetail.notifications.deleteFailed,
        color: 'red',
      });
    }
  }, [deletePolicy, id, onDeleted, t, common]);

  const userCount = policy?.userCount ?? 0;
  const roleCount = policy?.roleCount ?? 0;

  // `formatDateTime` returns '' for an empty or invalid value.
  const dateTime = (value?: string | null) =>
    formatDateTime(value, DATE_TIME_FORMAT_OPTIONS) || t.emptyValue;

  return (
    <Stack gap="md" data-testid="policy-detail">
      <Group justify="space-between">
        <Group>
          <Title order={2}>{isNew ? t.policyDetail.titleNew : t.policyDetail.titleEdit}</Title>
          {isDirty && (
            <Badge color="yellow" variant="dot">
              {t.unsavedChanges}
            </Badge>
          )}
        </Group>
        <Group>
          {onBack && (
            <Button variant="default" onClick={onBack}>
              {common.cancel}
            </Button>
          )}
          {!isNew && deleteAllowed && (
            <Button color="red" onClick={() => setDeleteModalOpen(true)} data-testid="policy-detail-delete-btn">
              <IconTrash size={16} />
            </Button>
          )}
          {saveAllowed && (
            <Button
              onClick={() => void handleSave()}
              loading={saving}
              disabled={!isNew && !isDirty}
              data-testid="policy-detail-save-btn"
            >
              {isNew ? common.create : common.save}
            </Button>
          )}
        </Group>
      </Group>

      <Grid>
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Paper shadow="xs" p="md" withBorder pos="relative">
            <LoadingOverlay visible={loading} />

            <Stack gap="md">
              <Title order={4}>{t.basicInformation}</Title>

              <TextInput
                label={t.fields.name}
                placeholder={t.policyDetail.fields.namePlaceholder}
                required
                value={values.name}
                onChange={(e) => setValues((prev) => ({ ...prev, name: e.target.value }))}
                data-testid="policy-detail-name"
              />

              <SelectIcon
                label={t.fields.icon}
                value={values.icon}
                onChange={(icon) => setValues((prev) => ({ ...prev, icon: icon || 'security' }))}
                placeholder="security"
              />

              <Textarea
                label={t.fields.description}
                placeholder={t.policyDetail.fields.descriptionPlaceholder}
                value={values.description}
                onChange={(e) => setValues((prev) => ({ ...prev, description: e.target.value }))}
                rows={4}
              />

              <Title order={4} mt="md">
                {t.policyDetail.accessControl}
              </Title>

              <Switch
                label={t.policyDetail.appAccess.label}
                description={t.policyDetail.appAccess.description}
                checked={values.app_access}
                onChange={(e) => setValues((prev) => ({ ...prev, app_access: e.currentTarget.checked }))}
                data-testid="policy-detail-app-access"
              />

              <Switch
                label={t.policyDetail.adminAccess.label}
                description={t.policyDetail.adminAccess.description}
                checked={values.admin_access}
                onChange={(e) => setValues((prev) => ({ ...prev, admin_access: e.currentTarget.checked }))}
                data-testid="policy-detail-admin-access"
              />

              <Switch
                label={t.policyDetail.delegateAccess.label}
                description={t.policyDetail.delegateAccess.description}
                checked={values.delegate_access}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, delegate_access: e.currentTarget.checked }))
                }
                data-testid="policy-detail-delegate-access"
              />
            </Stack>
          </Paper>

          {/*
            The two permission dimensions, matching the platform's Policy
            editor: Record-Level = collection CRUD (daas_permissions rows),
            Module-Level = named application capabilities
            (daas_policies.module_access).
          */}
          {!isNew && policy && (
            <Paper shadow="xs" p="md" withBorder mt="md">
              <Tabs defaultValue="record-level">
                <Tabs.List mb="md">
                  <Tabs.Tab value="record-level" data-testid="policy-detail-tab-record">
                    {t.policyDetail.tabs.recordLevel}
                  </Tabs.Tab>
                  <Tabs.Tab value="module-level" data-testid="policy-detail-tab-module">
                    {t.policyDetail.tabs.moduleLevel}
                  </Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel value="record-level">
                  <SystemPermissions
                    key={`permissions-${permissionsVersion}`}
                    primaryKey={id}
                    value={alterations}
                    onChange={setAlterations}
                    appAccess={values.app_access}
                    adminAccess={values.admin_access}
                    label={t.policyDetail.permissions.label}
                    description={t.policyDetail.permissions.description}
                    data-testid="policy-detail-permissions"
                  />
                </Tabs.Panel>

                <Tabs.Panel value="module-level">
                  <Stack gap="xs">
                    <Text size="sm" c="dimmed">
                      {t.policyDetail.moduleLevelIntro}
                    </Text>
                    <ModuleAccessPanel
                      value={values.module_access}
                      onChange={(module_access) =>
                        setValues((prev) => ({ ...prev, module_access }))
                      }
                      adminAccess={values.admin_access}
                      translations={translations}
                    />
                  </Stack>
                </Tabs.Panel>
              </Tabs>
            </Paper>
          )}
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 4 }}>
          {!isNew && policy && (
            <InfoPanel
              items={[
                { label: t.policyDetail.info.policyId, value: policy.id },
                { label: t.policyDetail.info.users, value: formatCount(userCount, t.count.users) },
                { label: t.policyDetail.info.roles, value: formatCount(roleCount, t.count.roles) },
                { label: t.created, value: dateTime(policy.created_at) },
                { label: t.updated, value: dateTime(policy.updated_at) },
              ]}
              description={t.policyDetail.info.description}
              translations={translations}
            />
          )}
        </Grid.Col>
      </Grid>

      <DeleteConfirmModal
        opened={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title={t.policyDetail.deleteModal.title}
        description={t.policyDetail.deleteModal.description}
        translations={translations}
      />
    </Stack>
  );
};

export default PolicyDetail;
