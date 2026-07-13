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
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconTrash } from '@tabler/icons-react';
import { usePermissions, usePolicies } from '@buildpad/hooks';
import { apiRequest } from '@buildpad/services';
import type { Permission, Policy } from '@buildpad/types';
import { SelectIcon } from '@buildpad/ui-interfaces/select-icon';
import {
  SystemPermissions,
  type PermissionAlterations,
} from '@buildpad/ui-interfaces/system-permissions';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { InfoPanel } from './InfoPanel';

/** The editable subset of `Policy` this form manages. */
interface PolicyFormValues {
  name: string;
  icon: string;
  description: string;
  admin_access: boolean;
  app_access: boolean;
  delegate_access: boolean;
}

const EMPTY_FORM: PolicyFormValues = {
  name: '',
  icon: 'security',
  description: '',
  admin_access: false,
  app_access: false,
  delegate_access: false,
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
}) => {
  const isNew = id === 'new' || id === '+';
  const { getPolicy, createPolicy, updatePolicy, deletePolicy } = usePolicies();
  const { canPerform, isAdmin, loading: permsLoading } = usePermissions({
    collections: [policiesCollection],
  });

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
      };
      setInitialValues(formValues);
      setValues(formValues);
    } catch (err) {
      notifications.show({
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to fetch policy',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  }, [getPolicy, id, isNew]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = useCallback(async () => {
    if (!values.name.trim()) {
      notifications.show({ title: 'Validation Error', message: 'Name is required', color: 'red' });
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
        title: 'Success',
        message: `Policy ${isNew ? 'created' : 'updated'} successfully`,
        color: 'green',
      });
      setInitialValues(values);
      setPolicy(saved);
      onSaved?.(saved);
    } catch (err) {
      notifications.show({
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to save policy',
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
  ]);

  const confirmDelete = useCallback(async () => {
    try {
      await deletePolicy(id);
      notifications.show({
        title: 'Success',
        message: 'Policy deleted successfully',
        color: 'green',
      });
      setDeleteModalOpen(false);
      onDeleted?.();
    } catch (err) {
      notifications.show({
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to delete policy',
        color: 'red',
      });
    }
  }, [deletePolicy, id, onDeleted]);

  const userCount = policy?.userCount ?? 0;
  const roleCount = policy?.roleCount ?? 0;

  return (
    <Stack gap="md" data-testid="policy-detail">
      <Group justify="space-between">
        <Group>
          <Title order={2}>{isNew ? 'New Policy' : 'Edit Policy'}</Title>
          {isDirty && (
            <Badge color="yellow" variant="dot">
              Unsaved Changes
            </Badge>
          )}
        </Group>
        <Group>
          {onBack && (
            <Button variant="default" onClick={onBack}>
              Cancel
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
              {isNew ? 'Create' : 'Save'}
            </Button>
          )}
        </Group>
      </Group>

      <Grid>
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Paper shadow="xs" p="md" withBorder pos="relative">
            <LoadingOverlay visible={loading} />

            <Stack gap="md">
              <Title order={4}>Basic Information</Title>

              <TextInput
                label="Name"
                placeholder="Admin Policy"
                required
                value={values.name}
                onChange={(e) => setValues((prev) => ({ ...prev, name: e.target.value }))}
                data-testid="policy-detail-name"
              />

              <SelectIcon
                label="Icon"
                value={values.icon}
                onChange={(icon) => setValues((prev) => ({ ...prev, icon: icon || 'security' }))}
                placeholder="security"
              />

              <Textarea
                label="Description"
                placeholder="Policy description"
                value={values.description}
                onChange={(e) => setValues((prev) => ({ ...prev, description: e.target.value }))}
                rows={4}
              />

              <Title order={4} mt="md">
                Access Control
              </Title>

              <Switch
                label="App Access"
                description="Allow access to the app (requires minimal permissions)"
                checked={values.app_access}
                onChange={(e) => setValues((prev) => ({ ...prev, app_access: e.currentTarget.checked }))}
                data-testid="policy-detail-app-access"
              />

              <Switch
                label="Admin Access"
                description="Grant full administrative privileges"
                checked={values.admin_access}
                onChange={(e) => setValues((prev) => ({ ...prev, admin_access: e.currentTarget.checked }))}
                data-testid="policy-detail-admin-access"
              />

              <Switch
                label="Delegate Access"
                description="Allow using X-On-Behalf-Of header to delegate audit identity in server-to-server requests"
                checked={values.delegate_access}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, delegate_access: e.currentTarget.checked }))
                }
                data-testid="policy-detail-delegate-access"
              />
            </Stack>
          </Paper>

          {!isNew && policy && (
            <Paper shadow="xs" p="md" withBorder mt="md">
              <SystemPermissions
                key={`permissions-${permissionsVersion}`}
                primaryKey={id}
                value={alterations}
                onChange={setAlterations}
                appAccess={values.app_access}
                adminAccess={values.admin_access}
                label="Permissions"
                description="Per-collection permissions granted by this policy"
                data-testid="policy-detail-permissions"
              />
            </Paper>
          )}
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 4 }}>
          {!isNew && policy && (
            <InfoPanel
              items={[
                { label: 'Policy ID', value: policy.id },
                { label: 'Users', value: `${userCount} ${userCount === 1 ? 'user' : 'users'}` },
                { label: 'Roles', value: `${roleCount} ${roleCount === 1 ? 'role' : 'roles'}` },
                {
                  label: 'Created',
                  value: policy.created_at ? new Date(policy.created_at).toLocaleString() : '—',
                },
                {
                  label: 'Updated',
                  value: policy.updated_at ? new Date(policy.updated_at).toLocaleString() : '—',
                },
              ]}
              description="Policy information and assignments"
            />
          )}
        </Grid.Col>
      </Grid>

      <DeleteConfirmModal
        opened={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Delete policy"
        description="Are you sure you want to delete this policy? This action cannot be undone."
      />
    </Stack>
  );
};

export default PolicyDetail;
