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
import type { Policy, Role, RoleScopeConfig, User } from '@buildpad/types';
import { SelectIcon } from '@buildpad/ui-interfaces/select-icon';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { InfoPanel } from './InfoPanel';
import { RolePoliciesManager } from './RolePoliciesManager';
import { RoleUsersManager } from './RoleUsersManager';
import { childRolesOf, isValidRegex, parentRoleOptions } from './accessUtils';

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
}) => {
  const isNew = id === 'new' || id === '+';
  const { getRole, createRole, updateRole, deleteRole, fetchRoles } = useRoles();
  const { canPerform, isAdmin, loading: permsLoading } = usePermissions({
    collections: [rolesCollection],
  });

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
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to fetch role',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  }, [getRole, id, isNew]);

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
        notifications.show({ title: 'Validation Error', message: 'Name is required', color: 'red' });
        return;
      }
      if (!scopePatternsValid) {
        notifications.show({
          title: 'Validation Error',
          message: 'Fix the invalid scope patterns before saving',
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
          title: 'Success',
          message: `Role ${isNew ? 'created' : 'updated'} successfully`,
          color: 'green',
        });
        setInitialValues(values);
        if (action === 'stay' && !isNew) {
          await load();
        }
        onSaved?.(saved, action);
      } catch (err) {
        notifications.show({
          title: 'Error',
          message: err instanceof Error ? err.message : 'Failed to save role',
          color: 'red',
        });
      } finally {
        setSaving(false);
      }
    },
    [values, scopePatternsValid, isNew, createRole, updateRole, id, load, onSaved]
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
        title: 'Success',
        message: 'Role deleted successfully',
        color: 'green',
      });
      setDeleteModalOpen(false);
      onDeleted?.();
    } catch (err) {
      notifications.show({
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to delete role',
        color: 'red',
      });
    }
  }, [deleteRole, id, onDeleted]);

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

  return (
    <Stack gap="md" data-testid="role-detail">
      <Group justify="space-between">
        <Group>
          <Title order={2}>{isNew ? 'New Role' : 'Edit Role'}</Title>
          {isDirty && (
            <Badge color="yellow" variant="dot">
              Unsaved Changes
            </Badge>
          )}
        </Group>
        <Group>
          {onBack && (
            <Button variant="default" onClick={handleCancel}>
              Cancel
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
                  Save
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item onClick={() => void handleSave('stay')}>Save &amp; Stay</Menu.Item>
                <Menu.Item onClick={() => void handleSave('quit')}>Save &amp; Quit</Menu.Item>
                <Menu.Item onClick={() => void handleSave('addNew')}>Save &amp; Add New</Menu.Item>
                {isDirty && (
                  <>
                    <Menu.Divider />
                    <Menu.Item color="red" onClick={handleDiscard}>
                      Discard Changes
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
              <Tabs.Tab value="basic">Basic Information</Tabs.Tab>
              {!isNew && <Tabs.Tab value="users">Users ({userCount})</Tabs.Tab>}
              {!isNew && <Tabs.Tab value="policies">Policies ({policyCount})</Tabs.Tab>}
            </Tabs.List>

            <Tabs.Panel value="basic" pt="md">
              <Paper shadow="xs" p="md" withBorder pos="relative">
                <LoadingOverlay visible={loading} />

                <Stack gap="md">
                  <TextInput
                    label="Name"
                    placeholder="Administrator"
                    required
                    value={values.name}
                    onChange={(e) => setValues((prev) => ({ ...prev, name: e.target.value }))}
                    data-testid="role-detail-name"
                  />

                  <SelectIcon
                    label="Icon"
                    value={values.icon}
                    onChange={(icon) =>
                      setValues((prev) => ({ ...prev, icon: icon || 'supervised_user_circle' }))
                    }
                    placeholder="supervised_user_circle"
                  />

                  <Textarea
                    label="Description"
                    placeholder="Role description"
                    value={values.description}
                    onChange={(e) => setValues((prev) => ({ ...prev, description: e.target.value }))}
                    rows={4}
                  />

                  <Select
                    label="Parent Role"
                    placeholder="Select a parent role (optional)"
                    data={parentRoleOptions(allRoles, isNew ? null : id)}
                    value={values.parent}
                    onChange={(parent) => setValues((prev) => ({ ...prev, parent }))}
                    clearable
                    searchable
                    data-testid="role-detail-parent"
                  />

                  <Stack gap="xs">
                    <Switch
                      label="Scope Assignment Rules"
                      description="Restrict which scopes users with this role can be assigned to"
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
                            Allowed Scope Patterns
                          </Text>
                          <Text size="xs" c="dimmed">
                            Regex patterns that scope URIs must match. Leave empty to block all
                            scope assignments.
                          </Text>

                          {scopePatterns.map((pattern, idx) => (
                            <Group key={idx} gap="xs">
                              <Code style={{ flex: 0, minWidth: 28, textAlign: 'center' }}>
                                {idx + 1}
                              </Code>
                              <TextInput
                                style={{ flex: 1 }}
                                placeholder="^/tenant:.*$"
                                value={pattern}
                                onChange={(e) => {
                                  const updated = [...scopePatterns];
                                  updated[idx] = e.target.value;
                                  setScopeConfig({ ...values.scope_config!, allowed_scopes: updated });
                                }}
                                error={pattern && !isValidRegex(pattern) ? 'Invalid regex' : undefined}
                                data-testid={`role-detail-scope-pattern-${idx}`}
                              />
                              <ActionIcon
                                variant="subtle"
                                color="red"
                                onClick={() => {
                                  const updated = scopePatterns.filter((_, i) => i !== idx);
                                  setScopeConfig({ ...values.scope_config!, allowed_scopes: updated });
                                }}
                                aria-label={`Remove pattern ${idx + 1}`}
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
                            Add Pattern
                          </Button>

                          <TextInput
                            label="Validation Message"
                            description="Custom error message shown when scope assignment is rejected"
                            placeholder="This role can only be assigned to specific scopes"
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
                  />
                </Tabs.Panel>

                <Tabs.Panel value="policies" pt="md">
                  <RolePoliciesManager
                    roleId={id}
                    onUpdate={() => void refreshCounts()}
                    onPolicyClick={onPolicyClick}
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
                  { label: 'Role ID', value: role.id },
                  ...(role.parent
                    ? [
                        {
                          label: 'Parent Role',
                          value: parentRole
                            ? roleLink(parentRole, 'role-detail-parent-link')
                            : role.parent,
                        },
                      ]
                    : []),
                  { label: 'Users', value: `${userCount} ${userCount === 1 ? 'user' : 'users'}` },
                  {
                    label: 'Policies',
                    value: `${policyCount} ${policyCount === 1 ? 'policy' : 'policies'}`,
                  },
                  {
                    label: 'Created',
                    value: role.created_at ? new Date(role.created_at).toLocaleString() : '—',
                  },
                  {
                    label: 'Updated',
                    value: role.updated_at ? new Date(role.updated_at).toLocaleString() : '—',
                  },
                ]}
                description="Role information and assignments"
              />

              {childRoles.length > 0 && (
                <Paper shadow="xs" p="md" withBorder data-testid="role-detail-children">
                  <Text fw={600} mb="sm">
                    Child Roles
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

      <Modal opened={pendingNav !== null} onClose={() => setPendingNav(null)} title="Unsaved Changes">
        <Stack gap="md">
          <Text size="sm">You have unsaved changes. Are you sure you want to leave?</Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setPendingNav(null)}>
              Keep Editing
            </Button>
            <Button
              color="red"
              onClick={() => {
                setValues(initialValues);
                setPendingNav(null);
                pendingNav?.();
              }}
            >
              Discard Changes
            </Button>
          </Group>
        </Stack>
      </Modal>

      <DeleteConfirmModal
        opened={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Delete role"
        description="Are you sure you want to delete this role? Users in this role will need to be reassigned."
      />
    </Stack>
  );
};

export default RoleDetail;
