'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Grid,
  Group,
  LoadingOverlay,
  MultiSelect,
  Paper,
  PasswordInput,
  Select,
  Stack,
  Tabs,
  TagsInput,
  Text,
  Textarea,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconTrash } from '@tabler/icons-react';
import { usePermissions, useRoles, useUsers } from '@buildpad/hooks';
import type { User, UserStatus } from '@buildpad/types';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { InfoPanel } from './InfoPanel';
import { TokenInput } from './TokenInput';
import { UserPoliciesManager } from './UserPoliciesManager';
import { normalizeRoleIds } from './accessUtils';
import type { Policy } from '@buildpad/types';

const STATUS_OPTIONS: Array<{ value: UserStatus; label: string }> = [
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'invited', label: 'Invited' },
  { value: 'draft', label: 'Draft' },
  { value: 'terminated', label: 'Terminated' },
];

const LANGUAGE_OPTIONS = [
  'en-US',
  'en-GB',
  'de-DE',
  'es-ES',
  'fr-FR',
  'it-IT',
  'ja-JP',
  'nl-NL',
  'pt-BR',
  'zh-CN',
];

const THEME_OPTIONS = [
  { value: 'auto', label: 'Auto' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

/**
 * The editable subset of `User` this form manages. Restricted/computed
 * fields (`admin_access`, `avatar`, `auth_data`, `provider`,
 * `external_identifier`, `last_page`, `tfa_secret`) are intentionally
 * absent — they are neither rendered nor submitted, matching the
 * buildpad-daas reference form's `excludeFields`.
 */
interface UserFormValues {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  title: string;
  description: string;
  location: string;
  tags: string[];
  language: string | null;
  theme: string | null;
  status: UserStatus;
  token: string;
  roles: string[];
}

const EMPTY_FORM: UserFormValues = {
  email: '',
  password: '',
  first_name: '',
  last_name: '',
  title: '',
  description: '',
  location: '',
  tags: [],
  language: null,
  theme: null,
  status: 'active',
  token: '',
  roles: [],
};

function toFormValues(user: User): UserFormValues {
  return {
    email: user.email ?? '',
    password: '',
    first_name: user.first_name ?? '',
    last_name: user.last_name ?? '',
    title: user.title ?? '',
    description: user.description ?? '',
    location: user.location ?? '',
    tags: user.tags ?? [],
    language: user.language ?? null,
    theme: user.theme ?? null,
    status: user.status ?? 'active',
    token: user.token ?? '',
    roles: normalizeRoleIds(user.roles),
  };
}

/**
 * Diff form values against the loaded record, producing the edits-only PATCH
 * payload (DaaS pattern: only changed fields are sent). `password` is
 * included only when non-empty.
 */
function diffFormValues(current: UserFormValues, initial: UserFormValues): Partial<User> {
  const edits: Partial<User> = {};
  if (current.email !== initial.email) edits.email = current.email;
  if (current.password) edits.password = current.password;
  if (current.first_name !== initial.first_name) edits.first_name = current.first_name;
  if (current.last_name !== initial.last_name) edits.last_name = current.last_name;
  if (current.title !== initial.title) edits.title = current.title;
  if (current.description !== initial.description) edits.description = current.description;
  if (current.location !== initial.location) edits.location = current.location;
  if (JSON.stringify(current.tags) !== JSON.stringify(initial.tags)) edits.tags = current.tags;
  if (current.language !== initial.language) edits.language = current.language;
  if (current.theme !== initial.theme) edits.theme = current.theme;
  if (current.status !== initial.status) edits.status = current.status;
  if (current.token !== initial.token) edits.token = current.token || null;
  if (JSON.stringify(current.roles) !== JSON.stringify(initial.roles)) edits.roles = current.roles;
  return edits;
}

export interface UserDetailProps {
  /** User ID to edit, or `'new'` to create a user. */
  id: string;
  /** Called when the admin cancels or after a successful save that leaves the view. */
  onBack?: () => void;
  /** Called after the user is deleted. */
  onDeleted?: () => void;
  /** Called after a successful create/update with the saved record. */
  onSaved?: (user: User) => void;
  /** Called when a policy row's "open" action is clicked in the Policies tab. */
  onPolicyClick?: (policy: Policy) => void;
  /** DaaS collection used for RBAC checks. Default: 'daas_users'. */
  usersCollection?: string;
}

/**
 * User create/edit surface: Basic Information (explicit Mantine fields over
 * the editable `daas_users` columns) plus a Policies tab hosting
 * `UserPoliciesManager`, with an info sidebar. Ported from the buildpad-daas
 * `app/users/[id]/page.tsx` — schema-driven `DynamicForm` replaced with
 * explicit fields so the component is self-contained after a CLI copy, and
 * routing replaced with `onBack`/`onDeleted`/`onSaved` props.
 */
export const UserDetail: React.FC<UserDetailProps> = ({
  id,
  onBack,
  onDeleted,
  onSaved,
  onPolicyClick,
  usersCollection = 'daas_users',
}) => {
  const isNew = id === 'new' || id === '+';
  const { getUser, createUser, updateUser, deleteUser } = useUsers();
  const { fetchRoles } = useRoles();
  const { canPerform, isAdmin, loading: permsLoading } = usePermissions({
    collections: [usersCollection],
  });

  const createAllowed = permsLoading || isAdmin || canPerform(usersCollection, 'create');
  const updateAllowed = permsLoading || isAdmin || canPerform(usersCollection, 'update');
  const deleteAllowed = permsLoading || isAdmin || canPerform(usersCollection, 'delete');
  const saveAllowed = isNew ? createAllowed : updateAllowed;

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<string | null>('basic');
  const [policyCount, setPolicyCount] = useState(0);
  const [roleOptions, setRoleOptions] = useState<
    Array<{ value: string; label: string; disabled?: boolean }>
  >([]);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof UserFormValues, string>>>({});

  const [initialValues, setInitialValues] = useState<UserFormValues>(EMPTY_FORM);
  const [values, setValues] = useState<UserFormValues>(EMPTY_FORM);

  const edits = useMemo(() => diffFormValues(values, initialValues), [values, initialValues]);
  const isDirty = Object.keys(edits).length > 0;

  const setField = useCallback(<K extends keyof UserFormValues>(key: K, value: UserFormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  }, []);

  const load = useCallback(async () => {
    if (isNew) return;
    setLoading(true);
    try {
      // Without a fields param the API returns `roles` as bare junction-row
      // IDs; `roles.*` expands them to junction rows carrying `role_id`.
      const fetched = await getUser(id, { fields: '*,roles.*' });
      setUser(fetched);
      setPolicyCount(fetched.policyCount ?? 0);
      const formValues = toFormValues(fetched);
      setInitialValues(formValues);
      setValues(formValues);
    } catch (err) {
      notifications.show({
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to fetch user',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  }, [getUser, id, isNew]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    fetchRoles({ limit: 1000 })
      .then((result) =>
        setRoleOptions(
          result.roles.map((role) => ({
            value: role.id,
            label: role.name,
            // Roles with scope rules that exclude the current (root) scope
            // are rejected server-side on assignment — disable them here.
            disabled: role.assignable === false,
          }))
        )
      )
      .catch(() => setRoleOptions([]));
  }, [fetchRoles]);

  /** Refresh sidebar counts after policy attach/detach without resetting the form. */
  const refreshCounts = useCallback(async () => {
    if (isNew) return;
    try {
      const fetched = await getUser(id);
      setUser(fetched);
      setPolicyCount(fetched.policyCount ?? 0);
    } catch {
      // sidebar refresh is best-effort
    }
  }, [getUser, id, isNew]);

  const validate = useCallback((): boolean => {
    const errors: Partial<Record<keyof UserFormValues, string>> = {};
    if (!values.email.trim()) errors.email = 'Email is required';
    if (isNew && !values.password) errors.password = 'Password is required for new users';
    if (values.password && values.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }, [values.email, values.password, isNew]);

  const handleSave = useCallback(async () => {
    if (!isNew && !isDirty) return;
    if (!validate()) {
      notifications.show({
        title: 'Validation Error',
        message: 'Please fix the highlighted fields',
        color: 'red',
      });
      return;
    }

    setSaving(true);
    try {
      let saved: User;
      if (isNew) {
        saved = await createUser({ ...edits, email: values.email, password: values.password });
      } else {
        saved = await updateUser(id, edits);
      }
      notifications.show({
        title: 'Success',
        message: `User ${isNew ? 'created' : 'updated'} successfully`,
        color: 'green',
      });
      // Keep local state consistent in case the host app stays on this view.
      const formValues = { ...values, password: '' };
      setInitialValues(formValues);
      setValues(formValues);
      onSaved?.(saved);
    } catch (err) {
      notifications.show({
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to save user',
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  }, [isNew, isDirty, validate, createUser, updateUser, id, edits, values, onSaved]);

  const confirmDelete = useCallback(async () => {
    try {
      await deleteUser(id);
      notifications.show({
        title: 'Success',
        message: 'User deleted successfully',
        color: 'green',
      });
      setDeleteModalOpen(false);
      onDeleted?.();
    } catch (err) {
      notifications.show({
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to delete user',
        color: 'red',
      });
    }
  }, [deleteUser, id, onDeleted]);

  return (
    <Stack gap="md" data-testid="user-detail">
      <Group justify="space-between">
        <Title order={2}>{isNew ? 'New User' : 'Edit User'}</Title>
        <Group>
          {onBack && (
            <Button variant="default" onClick={onBack}>
              Cancel
            </Button>
          )}
          {!isNew && deleteAllowed && (
            <Button
              color="red"
              onClick={() => setDeleteModalOpen(true)}
              data-testid="user-detail-delete-btn"
            >
              <IconTrash size={16} />
            </Button>
          )}
          {saveAllowed && (
            <Tooltip label="No changes to save" disabled={isNew || isDirty}>
              <Button
                onClick={() => void handleSave()}
                loading={saving}
                disabled={!isNew && !isDirty}
                data-testid="user-detail-save-btn"
              >
                {isNew ? 'Create' : 'Save'}
              </Button>
            </Tooltip>
          )}
        </Group>
      </Group>

      <Grid>
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Tabs value={activeTab} onChange={setActiveTab}>
            <Tabs.List>
              <Tabs.Tab value="basic">Basic Information</Tabs.Tab>
              {!isNew && (
                <Tabs.Tab
                  value="policies"
                  rightSection={
                    <Badge size="sm" circle variant="light">
                      {policyCount}
                    </Badge>
                  }
                >
                  Policies
                </Tabs.Tab>
              )}
            </Tabs.List>

            <Tabs.Panel value="basic" pt="md">
              <Paper shadow="xs" p="md" withBorder pos="relative">
                <LoadingOverlay visible={loading} />

                <Stack gap="md">
                  <Group grow>
                    <TextInput
                      label="First Name"
                      placeholder="Jane"
                      value={values.first_name}
                      onChange={(e) => setField('first_name', e.currentTarget.value)}
                      data-testid="user-detail-first-name"
                    />
                    <TextInput
                      label="Last Name"
                      placeholder="Doe"
                      value={values.last_name}
                      onChange={(e) => setField('last_name', e.currentTarget.value)}
                      data-testid="user-detail-last-name"
                    />
                  </Group>

                  <TextInput
                    label="Email"
                    placeholder="jane@example.com"
                    required
                    type="email"
                    value={values.email}
                    onChange={(e) => setField('email', e.currentTarget.value)}
                    error={fieldErrors.email}
                    data-testid="user-detail-email"
                  />

                  <PasswordInput
                    label="Password"
                    placeholder={isNew ? 'Minimum 6 characters' : 'Leave blank to keep current password'}
                    required={isNew}
                    value={values.password}
                    onChange={(e) => setField('password', e.currentTarget.value)}
                    error={fieldErrors.password}
                    autoComplete="new-password"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    data-testid="user-detail-password"
                  />

                  <MultiSelect
                    label="Roles"
                    placeholder={values.roles.length === 0 ? 'Assign roles' : undefined}
                    data={roleOptions}
                    value={values.roles}
                    onChange={(roles) => setField('roles', roles)}
                    searchable
                    clearable
                    data-testid="user-detail-roles"
                  />

                  <Group grow>
                    <Select
                      label="Status"
                      data={STATUS_OPTIONS}
                      value={values.status}
                      onChange={(status) => setField('status', (status as UserStatus) ?? 'active')}
                      allowDeselect={false}
                      data-testid="user-detail-status"
                    />
                    <TextInput
                      label="Title"
                      placeholder="Job title"
                      value={values.title}
                      onChange={(e) => setField('title', e.currentTarget.value)}
                    />
                  </Group>

                  <Textarea
                    label="Description"
                    placeholder="Notes about this user"
                    value={values.description}
                    onChange={(e) => setField('description', e.currentTarget.value)}
                    rows={3}
                  />

                  <Group grow>
                    <TextInput
                      label="Location"
                      placeholder="City, Country"
                      value={values.location}
                      onChange={(e) => setField('location', e.currentTarget.value)}
                    />
                    <TagsInput
                      label="Tags"
                      placeholder="Add tag"
                      value={values.tags}
                      onChange={(tags) => setField('tags', tags)}
                    />
                  </Group>

                  <Group grow>
                    <Select
                      label="Language"
                      placeholder="en-US"
                      data={LANGUAGE_OPTIONS}
                      value={values.language}
                      onChange={(language) => setField('language', language)}
                      searchable
                      clearable
                    />
                    <Select
                      label="Theme"
                      placeholder="Auto"
                      data={THEME_OPTIONS}
                      value={values.theme}
                      onChange={(theme) => setField('theme', theme)}
                      clearable
                    />
                  </Group>

                  <TokenInput
                    label="Static API Token"
                    description="Token for API access without a session. Generate a new value to rotate it; clear it to revoke."
                    value={values.token || null}
                    onChange={(token) => setField('token', token ?? '')}
                    data-testid="user-detail-token"
                  />
                </Stack>
              </Paper>
            </Tabs.Panel>

            {!isNew && (
              <Tabs.Panel value="policies" pt="md">
                <UserPoliciesManager
                  userId={id}
                  onUpdate={() => void refreshCounts()}
                  onPolicyClick={onPolicyClick}
                />
              </Tabs.Panel>
            )}
          </Tabs>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 4 }}>
          {!isNew && user && (
            <InfoPanel
              items={[
                { label: 'User ID', value: user.id },
                {
                  label: 'Last Access',
                  value: user.last_access ? new Date(user.last_access).toLocaleString() : 'Never',
                },
                {
                  label: 'Created',
                  value: user.created_at ? new Date(user.created_at).toLocaleString() : '—',
                },
                {
                  label: 'Updated',
                  value: user.updated_at ? new Date(user.updated_at).toLocaleString() : '—',
                },
                {
                  label: 'Policies',
                  value: `${policyCount} ${policyCount === 1 ? 'policy' : 'policies'}`,
                },
              ]}
              description="User information and activity details"
            />
          )}
        </Grid.Col>
      </Grid>

      <DeleteConfirmModal
        opened={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Delete user"
        description="Are you sure you want to delete this user? This action cannot be undone."
      />
    </Stack>
  );
};

export default UserDetail;
