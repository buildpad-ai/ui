'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActionIcon,
  Anchor,
  Badge,
  Button,
  Code,
  Grid,
  Group,
  LoadingOverlay,
  Menu,
  Modal,
  Paper,
  Select,
  Stack,
  Switch,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconChevronDown, IconPlus, IconTrash, IconX } from '@tabler/icons-react';
import { usePermissions, useRoles } from '@buildpad/hooks';
import { useBuildpadI18n, useBuildpadTranslations } from '@buildpad/services';
import type { Policy, Role, RoleScopeConfig, User } from '@buildpad/types';
import { SelectIcon } from '@buildpad/ui-interfaces/select-icon';
import { interpolate, type DeepPartial, type UsersTranslations } from '@buildpad/utils';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { InfoPanel } from './InfoPanel';
import { RolePoliciesManager } from './RolePoliciesManager';
import { RoleUsersManager } from './RoleUsersManager';
import {
  DATE_TIME_FORMAT_OPTIONS,
  childRolesOf,
  isValidRegex,
  parentRoleOptions,
} from './accessUtils';

/** The editable subset of `Role` this form manages. */
interface RoleFormValues {
  name: string;
  icon: string;
  description: string;
  parent: string | null;
  scope_config: RoleScopeConfig | null;
}

const EMPTY_FORM: RoleFormValues = {
  name: '',
  icon: 'supervised_user_circle',
  description: '',
  parent: null,
  scope_config: null,
};

/** What to do after a successful save — mirrors the buildpad-daas Save menu. */
export type RoleSaveAction = 'stay' | 'quit' | 'addNew';

export interface RoleDetailProps {
  /** Role ID to edit, or `'new'` to create a role. */
  id: string;
  /** Called when the admin cancels (after passing the unsaved-changes guard). */
  onBack?: () => void;
  /** Called after the role is deleted. */
  onDeleted?: () => void;
  /**
   * Called after a successful save with the saved record and the chosen
   * action: `'quit'` → navigate back to the list, `'addNew'` → navigate to a
   * fresh create view, `'stay'` → stay (the component refreshes itself; for a
   * create the host should navigate to the new role's route).
   */
  onSaved?: (role: Role, action: RoleSaveAction) => void;
  /** Called when a user row's "open" action is clicked in the Users tab. */
  onUserClick?: (user: User) => void;
  /** Called when "Add User" is clicked in the Users tab. Button hidden when omitted. */
  onAddUser?: () => void;
  /** Called when a policy row's "open" action is clicked in the Policies tab. */
  onPolicyClick?: (policy: Policy) => void;
  /**
   * Called when a parent/child role link in the sidebar is clicked (after
   * passing the unsaved-changes guard). When omitted the hierarchy renders as
   * plain text.
   */
  onRoleClick?: (role: Role) => void;
  /** DaaS collection used for RBAC checks. Default: 'daas_roles'. */
  rolesCollection?: string;
  /** Per-instance overrides of the `users` dictionary namespace (prop > provider > defaults). */
  translations?: DeepPartial<UsersTranslations>;
}

/**
 * Role create/edit surface: Basic Information (name, icon, description,
 * parent role, scope-assignment rules) plus Users and Policies tabs, a Save
 * menu (Save & Stay / & Quit / & Add New / Discard), an unsaved-changes
 * guard on Cancel, and an info sidebar. Ported from the buildpad-daas
 * `app/roles/[id]/page.tsx` with routing replaced by callback props.
 */
export const RoleDetail: React.FC<RoleDetailProps> = ({
  id,
  onBack,
  onDeleted,
  onSaved,
  onUserClick,
  onAddUser,
  onPolicyClick,
  onRoleClick,
  rolesCollection = 'daas_roles',
  translations,
}) => {
  const isNew = id === 'new' || id === '+';
  const { getRole, createRole, updateRole, deleteRole, fetchRoles } = useRoles();
  const { canPerform, isAdmin, loading: permsLoading } = usePermissions({
    collections: [rolesCollection],
  });
  const t = useBuildpadTranslations((d) => d.users, translations);
  const common = useBuildpadTranslations((d) => d.common);
  const { formatDateTime, formatCount } = useBuildpadI18n();

  const createAllowed = permsLoading || isAdmin || canPerform(rolesCollection, 'create');
  const updateAllowed = permsLoading || isAdmin || canPerform(rolesCollection, 'update');
  const deleteAllowed = permsLoading || isAdmin || canPerform(rolesCollection, 'delete');
  const saveAllowed = isNew ? createAllowed : updateAllowed;

  const [role, setRole] = useState<Role | null>(null);
  const [allRoles, setAllRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<string | null>('basic');
  const [userCount, setUserCount] = useState(0);
  const [policyCount, setPolicyCount] = useState(0);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  /** Navigation deferred behind the unsaved-changes dialog; null = closed. */
  const [pendingNav, setPendingNav] = useState<(() => void) | null>(null);

  const [initialValues, setInitialValues] = useState<RoleFormValues>(EMPTY_FORM);
  const [values, setValues] = useState<RoleFormValues>(EMPTY_FORM);

  const isDirty = useMemo(
    () => JSON.stringify(values) !== JSON.stringify(initialValues),
    [values, initialValues]
  );

  const scopePatternsValid = useMemo(
    () => (values.scope_config?.allowed_scopes ?? []).every((p) => !p || isValidRegex(p)),
    [values.scope_config]
  );

  const load = useCallback(async () => {
    if (isNew) return;
    setLoading(true);
    try {
      const fetched = await getRole(id, { includePolicies: true });
      setRole(fetched);
      setUserCount(fetched.users?.[0]?.count ?? 0);
      setPolicyCount(fetched.policies?.length ?? 0);
      const formValues: RoleFormValues = {
        name: fetched.name,
        icon: fetched.icon || 'supervised_user_circle',
        description: fetched.description || '',
        parent: fetched.parent ?? null,
        scope_config: fetched.scope_config ?? null,
      };
      setInitialValues(formValues);
      setValues(formValues);
    } catch (err) {
      notifications.show({
        title: common.error,
        message: err instanceof Error ? err.message : t.roleDetail.notifications.fetchFailed,
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  }, [getRole, id, isNew, t, common]);

  useEffect(() => {
    void load();
  }, [load]);

  // Same-route hierarchy navigation swaps `id` without a remount — land on
  // the Basic tab instead of a stale Users/Policies tab.
  useEffect(() => {
    setActiveTab('basic');
  }, [id]);

  useEffect(() => {
    fetchRoles({ limit: 1000 })
      .then((result) => setAllRoles(result.roles))
      .catch(() => setAllRoles([]));
  }, [fetchRoles]);

  /** Refresh sidebar counts after users/policies tab changes without resetting the form. */
  const refreshCounts = useCallback(async () => {
    if (isNew) return;
    try {
      const fetched = await getRole(id, { includePolicies: true });
      setRole(fetched);
      setUserCount(fetched.users?.[0]?.count ?? 0);
      setPolicyCount(fetched.policies?.length ?? 0);
    } catch {
      // sidebar refresh is best-effort
    }
  }, [getRole, id, isNew]);

  const setScopeConfig = useCallback((scope_config: RoleScopeConfig | null) => {
    setValues((prev) => ({ ...prev, scope_config }));
  }, []);

  const handleSave = useCallback(
    async (action: RoleSaveAction = 'quit') => {
      if (!values.name.trim()) {
        notifications.show({
          title: t.validationErrorTitle,
          message: t.roleDetail.validation.nameRequired,
          color: 'red',
        });
        return;
      }
      if (!scopePatternsValid) {
        notifications.show({
          title: t.validationErrorTitle,
          message: t.roleDetail.validation.invalidScopePatterns,
          color: 'red',
        });
        return;
      }

      setSaving(true);
      try {
        const saved = isNew
          ? await createRole({ ...values, name: values.name })
          : await updateRole(id, values);
        notifications.show({
          title: common.success,
          message: isNew ? t.roleDetail.notifications.created : t.roleDetail.notifications.updated,
          color: 'green',
        });
        setInitialValues(values);
        if (action === 'stay' && !isNew) {
          await load();
        }
        onSaved?.(saved, action);
      } catch (err) {
        notifications.show({
          title: common.error,
          message: err instanceof Error ? err.message : t.roleDetail.notifications.saveFailed,
          color: 'red',
        });
      } finally {
        setSaving(false);
      }
    },
    [values, scopePatternsValid, isNew, createRole, updateRole, id, load, onSaved, t, common]
  );

  const handleDiscard = useCallback(() => {
    setValues(initialValues);
  }, [initialValues]);

  /** Run `nav` immediately, or park it behind the unsaved-changes dialog when dirty. */
  const requestNav = useCallback(
    (nav: () => void) => {
      if (isDirty) setPendingNav(() => nav);
      else nav();
    },
    [isDirty]
  );

  const handleCancel = useCallback(() => {
    requestNav(() => onBack?.());
  }, [requestNav, onBack]);

  const confirmDelete = useCallback(async () => {
    try {
      await deleteRole(id);
      notifications.show({
        title: common.success,
        message: t.roleDetail.notifications.deleted,
        color: 'green',
      });
      setDeleteModalOpen(false);
      onDeleted?.();
    } catch (err) {
      notifications.show({
        title: common.error,
        message: err instanceof Error ? err.message : t.roleDetail.notifications.deleteFailed,
        color: 'red',
      });
    }
  }, [deleteRole, id, onDeleted, t, common]);

  const scopePatterns = values.scope_config?.allowed_scopes ?? [];

  // Hierarchy is derived client-side: the API exposes no children relation,
  // and allRoles is already fetched for the parent-role select (Req 14).
  const parentRole = useMemo(
    () => (role?.parent ? allRoles.find((r) => r.id === role.parent) ?? null : null),
    [allRoles, role]
  );
  const childRoles = useMemo(
    () => (isNew ? [] : childRolesOf(allRoles, id)),
    [allRoles, id, isNew]
  );

  /** Parent/child link, or plain text when the host provides no `onRoleClick`. */
  const roleLink = useCallback(
    (target: Role, testId: string) =>
      onRoleClick ? (
        <Anchor
          component="button"
          type="button"
          size="sm"
          onClick={() => requestNav(() => onRoleClick(target))}
          data-testid={testId}
        >
          {target.name}
        </Anchor>
      ) : (
        // component="span" so the fallback nests validly inside InfoPanel's <Text> rows
        <Text component="span" size="sm" data-testid={testId}>
          {target.name}
        </Text>
      ),
    [onRoleClick, requestNav]
  );

  // `formatDateTime` returns '' for an empty or invalid value.
  const dateTime = (value?: string | null) =>
    formatDateTime(value, DATE_TIME_FORMAT_OPTIONS) || t.emptyValue;

  return (
    <Stack gap="md" data-testid="role-detail">
      <Group justify="space-between">
        <Group>
          <Title order={2}>{isNew ? t.roleDetail.titleNew : t.roleDetail.titleEdit}</Title>
          {isDirty && (
            <Badge color="yellow" variant="dot">
              {t.unsavedChanges}
            </Badge>
          )}
        </Group>
        <Group>
          {onBack && (
            <Button variant="default" onClick={handleCancel}>
              {common.cancel}
            </Button>
          )}
          {!isNew && deleteAllowed && (
            <Button color="red" onClick={() => setDeleteModalOpen(true)} data-testid="role-detail-delete-btn">
              <IconTrash size={16} />
            </Button>
          )}
          {saveAllowed && (
            <Menu position="bottom-end">
              <Menu.Target>
                <Button loading={saving} rightSection={<IconChevronDown size={16} />} data-testid="role-detail-save-btn">
                  {common.save}
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item onClick={() => void handleSave('stay')}>{t.roleDetail.saveMenu.stay}</Menu.Item>
                <Menu.Item onClick={() => void handleSave('quit')}>{t.roleDetail.saveMenu.quit}</Menu.Item>
                <Menu.Item onClick={() => void handleSave('addNew')}>{t.roleDetail.saveMenu.addNew}</Menu.Item>
                {isDirty && (
                  <>
                    <Menu.Divider />
                    <Menu.Item color="red" onClick={handleDiscard}>
                      {t.roleDetail.saveMenu.discard}
                    </Menu.Item>
                  </>
                )}
              </Menu.Dropdown>
            </Menu>
          )}
        </Group>
      </Group>

      <Grid>
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Tabs value={activeTab} onChange={setActiveTab}>
            <Tabs.List>
              <Tabs.Tab value="basic">{t.basicInformation}</Tabs.Tab>
              {!isNew && (
                <Tabs.Tab value="users">
                  {interpolate(t.roleDetail.tabs.users, { count: userCount })}
                </Tabs.Tab>
              )}
              {!isNew && (
                <Tabs.Tab value="policies">
                  {interpolate(t.roleDetail.tabs.policies, { count: policyCount })}
                </Tabs.Tab>
              )}
            </Tabs.List>

            <Tabs.Panel value="basic" pt="md">
              <Paper shadow="xs" p="md" withBorder pos="relative">
                <LoadingOverlay visible={loading} />

                <Stack gap="md">
                  <TextInput
                    label={t.fields.name}
                    placeholder={t.roleDetail.fields.namePlaceholder}
                    required
                    value={values.name}
                    onChange={(e) => setValues((prev) => ({ ...prev, name: e.target.value }))}
                    data-testid="role-detail-name"
                  />

                  <SelectIcon
                    label={t.fields.icon}
                    value={values.icon}
                    onChange={(icon) =>
                      setValues((prev) => ({ ...prev, icon: icon || 'supervised_user_circle' }))
                    }
                    placeholder="supervised_user_circle"
                  />

                  <Textarea
                    label={t.fields.description}
                    placeholder={t.roleDetail.fields.descriptionPlaceholder}
                    value={values.description}
                    onChange={(e) => setValues((prev) => ({ ...prev, description: e.target.value }))}
                    rows={4}
                  />

                  <Select
                    label={t.roleDetail.fields.parentRole}
                    placeholder={t.roleDetail.fields.parentRolePlaceholder}
                    data={parentRoleOptions(allRoles, isNew ? null : id)}
                    value={values.parent}
                    onChange={(parent) => setValues((prev) => ({ ...prev, parent }))}
                    clearable
                    searchable
                    data-testid="role-detail-parent"
                  />

                  <Stack gap="xs">
                    <Switch
                      label={t.roleDetail.scope.label}
                      description={t.roleDetail.scope.description}
                      checked={values.scope_config !== null}
                      onChange={(e) => {
                        setScopeConfig(
                          e.currentTarget.checked
                            ? { allowed_scopes: [], validation_message: '' }
                            : null
                        );
                      }}
                      data-testid="role-detail-scope-switch"
                    />

                    {values.scope_config !== null && (
                      <Paper p="sm" withBorder>
                        <Stack gap="sm">
                          <Text size="sm" fw={500}>
                            {t.roleDetail.scope.patternsTitle}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {t.roleDetail.scope.patternsHint}
                          </Text>

                          {scopePatterns.map((pattern, idx) => (
                            <Group key={idx} gap="xs">
                              <Code style={{ flex: 0, minWidth: 28, textAlign: 'center' }}>
                                {idx + 1}
                              </Code>
                              <TextInput
                                style={{ flex: 1 }}
                                placeholder={t.roleDetail.scope.patternPlaceholder}
                                value={pattern}
                                onChange={(e) => {
                                  const updated = [...scopePatterns];
                                  updated[idx] = e.target.value;
                                  setScopeConfig({ ...values.scope_config!, allowed_scopes: updated });
                                }}
                                error={
                                  pattern && !isValidRegex(pattern)
                                    ? t.roleDetail.scope.invalidRegex
                                    : undefined
                                }
                                data-testid={`role-detail-scope-pattern-${idx}`}
                              />
                              <ActionIcon
                                variant="subtle"
                                color="red"
                                onClick={() => {
                                  const updated = scopePatterns.filter((_, i) => i !== idx);
                                  setScopeConfig({ ...values.scope_config!, allowed_scopes: updated });
                                }}
                                aria-label={interpolate(t.roleDetail.scope.removePatternAriaLabel, {
                                  index: idx + 1,
                                })}
                              >
                                <IconX size={16} />
                              </ActionIcon>
                            </Group>
                          ))}

                          <Button
                            variant="light"
                            size="xs"
                            leftSection={<IconPlus size={14} />}
                            onClick={() =>
                              setScopeConfig({
                                ...values.scope_config!,
                                allowed_scopes: [...scopePatterns, ''],
                              })
                            }
                            data-testid="role-detail-scope-add-pattern"
                          >
                            {t.roleDetail.scope.addPattern}
                          </Button>

                          <TextInput
                            label={t.roleDetail.scope.validationMessage.label}
                            description={t.roleDetail.scope.validationMessage.description}
                            placeholder={t.roleDetail.scope.validationMessage.placeholder}
                            value={values.scope_config?.validation_message || ''}
                            onChange={(e) =>
                              setScopeConfig({
                                ...values.scope_config!,
                                validation_message: e.target.value,
                              })
                            }
                          />
                        </Stack>
                      </Paper>
                    )}
                  </Stack>
                </Stack>
              </Paper>
            </Tabs.Panel>

            {!isNew && (
              <>
                <Tabs.Panel value="users" pt="md">
                  <RoleUsersManager
                    roleId={id}
                    roleName={role?.name || ''}
                    onUpdate={() => void refreshCounts()}
                    onUserClick={onUserClick}
                    onAddUser={onAddUser}
                    translations={translations}
                  />
                </Tabs.Panel>

                <Tabs.Panel value="policies" pt="md">
                  <RolePoliciesManager
                    roleId={id}
                    onUpdate={() => void refreshCounts()}
                    onPolicyClick={onPolicyClick}
                    translations={translations}
                  />
                </Tabs.Panel>
              </>
            )}
          </Tabs>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 4 }}>
          {!isNew && role && (
            <Stack gap="md">
              <InfoPanel
                items={[
                  { label: t.roleDetail.info.roleId, value: role.id },
                  ...(role.parent
                    ? [
                        {
                          label: t.roleDetail.info.parentRole,
                          value: parentRole
                            ? roleLink(parentRole, 'role-detail-parent-link')
                            : role.parent,
                        },
                      ]
                    : []),
                  { label: t.roleDetail.info.users, value: formatCount(userCount, t.count.users) },
                  {
                    label: t.roleDetail.info.policies,
                    value: formatCount(policyCount, t.count.policies),
                  },
                  { label: t.created, value: dateTime(role.created_at) },
                  { label: t.updated, value: dateTime(role.updated_at) },
                ]}
                description={t.roleDetail.info.description}
                translations={translations}
              />

              {childRoles.length > 0 && (
                <Paper shadow="xs" p="md" withBorder data-testid="role-detail-children">
                  <Text fw={600} mb="sm">
                    {t.roleDetail.childRoles}
                  </Text>
                  <Stack gap="xs">
                    {childRoles.map((child) => (
                      <div key={child.id}>{roleLink(child, `role-detail-child-${child.id}`)}</div>
                    ))}
                  </Stack>
                </Paper>
              )}
            </Stack>
          )}
        </Grid.Col>
      </Grid>

      <Modal
        opened={pendingNav !== null}
        onClose={() => setPendingNav(null)}
        title={t.roleDetail.unsavedModal.title}
      >
        <Stack gap="md">
          <Text size="sm">{common.unsavedChangesPrompt}</Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setPendingNav(null)}>
              {t.roleDetail.unsavedModal.keepEditing}
            </Button>
            <Button
              color="red"
              onClick={() => {
                setValues(initialValues);
                setPendingNav(null);
                pendingNav?.();
              }}
            >
              {t.roleDetail.unsavedModal.discard}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <DeleteConfirmModal
        opened={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title={t.roleDetail.deleteModal.title}
        description={t.roleDetail.deleteModal.description}
        translations={translations}
      />
    </Stack>
  );
};

export default RoleDetail;
