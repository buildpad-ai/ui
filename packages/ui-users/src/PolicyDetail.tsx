'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Badge,
  Button,
  Fieldset,
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
  /**
   * Called after a successful create/update with the saved record (a created
   * one carries its new id). The component itself goes nowhere: after a create
   * it becomes the editor of the policy it created (with its permissions
   * matrix), so a further Save updates that policy whether or not the host
   * has navigated yet.
   */
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
 *
 * Until the permissions are known nothing that writes is offered: the form is
 * covered and takes no edit (nor do the matrix and the module-level grants), and no Save or Delete button is drawn. A new
 * record's form is not opened to a user who may not create before the answer
 * is in. The record itself loads at once.
 *
 * After a create the form is the stored policy's: a second Save updates it.
 * Nothing is created twice when the host is slow to navigate, or does not.
 * What is typed while a save is in flight is kept as an unsaved edit, and a
 * save answered after the host opened another policy in the same form is not
 * drawn over that policy.
 */
export const PolicyDetail: React.FC<PolicyDetailProps> = ({
  id,
  onBack,
  onDeleted,
  onSaved,
  policiesCollection = 'daas_policies',
  translations,
}) => {
  const newRoute = id === 'new' || id === '+';
  // The policy this form created while `id` still says "new". From then on it
  // edits that policy: a second Save must update it, not create it once more,
  // whether or not the host has navigated to its own route yet.
  const [created, setCreated] = useState<Policy | null>(null);
  const isNew = newRoute && !created;
  const policyId = newRoute && created ? created.id : id;
  const { getPolicy, createPolicy, updatePolicy, deletePolicy } = usePolicies();
  const { canPerform, isAdmin, loading: permsLoading } = usePermissions({
    collections: [policiesCollection],
  });
  const t = useBuildpadTranslations((d) => d.users, translations);
  const common = useBuildpadTranslations((d) => d.common);
  const { formatDateTime, formatCount } = useBuildpadI18n();

  // Nothing that writes is offered until the permissions are known: a user
  // without the right must not be shown Save, Delete or an open form for the
  // length of that request. Known once is known: a later refresh (a renewed
  // token, another scope) answers from what was known until its own answer is
  // in, so the form does not close under a user who is typing.
  const permsKnownRef = useRef(false);
  if (!permsLoading) permsKnownRef.current = true;
  const permsKnown = permsKnownRef.current;
  const createAllowed = permsKnown && (isAdmin || canPerform(policiesCollection, 'create'));
  const updateAllowed = permsKnown && (isAdmin || canPerform(policiesCollection, 'update'));
  const deleteAllowed = permsKnown && (isAdmin || canPerform(policiesCollection, 'delete'));
  const saveAllowed = isNew ? createAllowed : updateAllowed;

  const [policy, setPolicy] = useState<Policy | null>(null);
  const [loading, setLoading] = useState(!newRoute);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
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

  // The texts of the load's failure notice, read when it is raised. They are
  // not dependencies of the load: a change of language would run it again,
  // and on the new route that empties the form (and lets go of a record the
  // form has just created).
  const textsRef = useRef({ t, common });
  textsRef.current = { t, common };

  // Only the answer for the policy on screen may be drawn: neither a slow
  // load of the one opened before, nor a save that was sent for it.
  const requestRef = useRef(0);

  // Keyed on the `id` it is given, not on the policy a create adopted: the
  // load runs when the host opens another policy (or a new one), and not for
  // the policy that was just created here.
  const load = useCallback(async () => {
    const request = ++requestRef.current;
    setCreated(null);
    // Matrix edits belong to the policy they were made on
    setAlterations(null);
    if (newRoute) {
      setPolicy(null);
      setInitialValues(EMPTY_FORM);
      setValues(EMPTY_FORM);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const fetched = await getPolicy(id);
      if (request !== requestRef.current) return;
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
      if (request !== requestRef.current) return;
      const texts = textsRef.current;
      notifications.show({
        title: texts.common.error,
        message: err instanceof Error ? err.message : texts.t.policyDetail.notifications.fetchFailed,
        color: 'red',
      });
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, [getPolicy, id, newRoute]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = useCallback(async () => {
    if (savingRef.current) return;
    if (!values.name.trim()) {
      notifications.show({
        title: t.validationErrorTitle,
        message: t.policyDetail.validation.nameRequired,
        color: 'red',
      });
      return;
    }

    savingRef.current = true;
    setSaving(true);
    // The answer belongs to the policy on screen now. When the host has opened
    // another one by the time it arrives, it must not be drawn over that
    // policy.
    const shown = requestRef.current;
    const stillShown = () => shown === requestRef.current;
    try {
      let saved: Policy;
      if (isNew) {
        saved = await createPolicy({ ...values, name: values.name });
      } else {
        saved = hasFormEdits ? await updatePolicy(policyId, values) : (policy as Policy);
        if (alterations && hasPermissionEdits) {
          await applyPermissionAlterations(policyId, alterations);
          if (stillShown()) {
            setAlterations(null);
            setPermissionsVersion((v) => v + 1);
          }
        }
      }
      notifications.show({
        title: common.success,
        message: isNew ? t.policyDetail.notifications.created : t.policyDetail.notifications.updated,
        color: 'green',
      });
      if (stillShown()) {
        // What was sent is what is stored now. `values` is the form as it was
        // when the request left: an edit made since then (the request takes a
        // while, and the inputs stay open) differs from it, and stays unsaved.
        setInitialValues(values);
        setPolicy(saved);
        // A created policy is the one on screen from here on, so the next
        // Save updates it; where to go next is the host's to say
        if (isNew) setCreated(saved);
      }
      onSaved?.(saved);
    } catch (err) {
      notifications.show({
        title: common.error,
        message: err instanceof Error ? err.message : t.policyDetail.notifications.saveFailed,
        color: 'red',
      });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [
    values,
    isNew,
    createPolicy,
    updatePolicy,
    policyId,
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
      await deletePolicy(policyId);
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
  }, [deletePolicy, policyId, onDeleted, t, common]);

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
            <LoadingOverlay visible={loading || !permsKnown} />

            {/* Takes no edit until the permissions are known (the overlay only covers it) */}
            <Fieldset
              variant="unstyled"
              disabled={!permsKnown}
              m={0}
              miw={0}
              data-testid="policy-detail-form"
            >
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
            </Fieldset>
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
                    primaryKey={policyId}
                    value={alterations}
                    onChange={setAlterations}
                    disabled={!permsKnown}
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
                    <Fieldset variant="unstyled" disabled={!permsKnown} m={0} miw={0}>
                      <ModuleAccessPanel
                        value={values.module_access}
                        onChange={(module_access) =>
                          setValues((prev) => ({ ...prev, module_access }))
                        }
                        adminAccess={values.admin_access}
                        translations={translations}
                      />
                    </Fieldset>
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
