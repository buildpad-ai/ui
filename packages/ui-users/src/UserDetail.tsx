'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Badge,
  Button,
  Fieldset,
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
  Textarea,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconTrash } from '@tabler/icons-react';
import { usePermissions, useRoles, useUsers } from '@buildpad/hooks';
import { useBuildpadI18n, useBuildpadTranslations } from '@buildpad/services';
import type { User, UserStatus, Policy } from '@buildpad/types';
import type { DeepPartial, UsersTranslations } from '@buildpad/utils';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { InfoPanel } from './InfoPanel';
import { TokenInput } from './TokenInput';
import { UserPoliciesManager } from './UserPoliciesManager';
import { DATE_TIME_FORMAT_OPTIONS, normalizeRoleIds } from './accessUtils';

/** Order of the Status select options; labels come from `users.status`. */
const STATUS_VALUES: UserStatus[] = ['active', 'suspended', 'invited', 'draft', 'terminated'];

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

/** Order of the Theme select options; labels come from `users.userDetail.theme`. */
const THEME_VALUES = ['auto', 'light', 'dark'] as const;

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
  /**
   * Called after a successful create/update with the saved record (a created
   * one carries its new id). The component itself goes nowhere: after a create
   * it becomes the editor of the user it created, so a further Save updates
   * that user whether or not the host has navigated yet.
   */
  onSaved?: (user: User) => void;
  /** Called when a policy row's "open" action is clicked in the Policies tab. */
  onPolicyClick?: (policy: Policy) => void;
  /** DaaS collection used for RBAC checks. Default: 'daas_users'. */
  usersCollection?: string;
  /** Per-instance overrides of the `users` dictionary namespace (prop > provider > defaults). */
  translations?: DeepPartial<UsersTranslations>;
}

/**
 * User create/edit surface: Basic Information (explicit Mantine fields over
 * the editable `daas_users` columns) plus a Policies tab hosting
 * `UserPoliciesManager`, with an info sidebar. Ported from the buildpad-daas
 * `app/users/[id]/page.tsx` — schema-driven `DynamicForm` replaced with
 * explicit fields so the component is self-contained after a CLI copy, and
 * routing replaced with `onBack`/`onDeleted`/`onSaved` props.
 *
 * Until the permissions are known nothing that writes is offered: the form is
 * covered and takes no edit, and no Save or Delete button is drawn. A new
 * record's form is not opened to a user who may not create before the answer
 * is in. The record itself loads at once.
 *
 * After a create the form is the stored user's: a second Save updates it.
 * Nothing is created twice when the host is slow to navigate, or does not.
 * What is typed while a save is in flight is kept as an unsaved edit, and a
 * save answered after the host opened another user in the same form is not
 * drawn over that user.
 */
export const UserDetail: React.FC<UserDetailProps> = ({
  id,
  onBack,
  onDeleted,
  onSaved,
  onPolicyClick,
  usersCollection = 'daas_users',
  translations,
}) => {
  const newRoute = id === 'new' || id === '+';
  // The user this form created while `id` still says "new". From then on it
  // edits that user: a second Save must update it, not create it once more,
  // whether or not the host has navigated to its own route yet.
  const [created, setCreated] = useState<User | null>(null);
  const isNew = newRoute && !created;
  const userId = newRoute && created ? created.id : id;
  const { getUser, createUser, updateUser, deleteUser } = useUsers();
  const { fetchRoles } = useRoles();
  const { canPerform, isAdmin, loading: permsLoading } = usePermissions({
    collections: [usersCollection],
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
  const createAllowed = permsKnown && (isAdmin || canPerform(usersCollection, 'create'));
  const updateAllowed = permsKnown && (isAdmin || canPerform(usersCollection, 'update'));
  const deleteAllowed = permsKnown && (isAdmin || canPerform(usersCollection, 'delete'));
  const saveAllowed = isNew ? createAllowed : updateAllowed;

  const statusOptions = useMemo<Array<{ value: UserStatus; label: string }>>(
    () => STATUS_VALUES.map((value) => ({ value, label: t.status[value] })),
    [t]
  );
  const themeOptions = useMemo(
    () => THEME_VALUES.map((value) => ({ value, label: t.userDetail.theme[value] })),
    [t]
  );

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(!newRoute);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
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

  // The texts of the load's failure notice, read when it is raised. They are
  // not dependencies of the load: a change of language would run it again,
  // and on the new route that empties the form (and lets go of a record the
  // form has just created).
  const textsRef = useRef({ t, common });
  textsRef.current = { t, common };

  // Only the answer for the user on screen may be drawn: neither a slow load
  // of the one opened before, nor a save that was sent for it.
  const requestRef = useRef(0);

  // Keyed on the `id` it is given, not on the user a create adopted: the load
  // runs when the host opens another user (or a new one), and not for the
  // user that was just created here.
  const load = useCallback(async () => {
    const request = ++requestRef.current;
    setCreated(null);
    if (newRoute) {
      setUser(null);
      setPolicyCount(0);
      setInitialValues(EMPTY_FORM);
      setValues(EMPTY_FORM);
      setFieldErrors((errors) => (Object.keys(errors).length > 0 ? {} : errors));
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // Without a fields param the API returns `roles` as bare junction-row
      // IDs; `roles.*` expands them to junction rows carrying `role_id`.
      const fetched = await getUser(id, { fields: '*,roles.*' });
      if (request !== requestRef.current) return;
      setUser(fetched);
      setPolicyCount(fetched.policyCount ?? 0);
      const formValues = toFormValues(fetched);
      setInitialValues(formValues);
      setValues(formValues);
      setFieldErrors({});
    } catch (err) {
      if (request !== requestRef.current) return;
      const texts = textsRef.current;
      notifications.show({
        title: texts.common.error,
        message: err instanceof Error ? err.message : texts.t.userDetail.notifications.fetchFailed,
        color: 'red',
      });
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, [getUser, id, newRoute]);

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
    const shown = requestRef.current;
    try {
      const fetched = await getUser(userId);
      if (shown !== requestRef.current) return;
      setUser(fetched);
      setPolicyCount(fetched.policyCount ?? 0);
    } catch {
      // sidebar refresh is best-effort
    }
  }, [getUser, userId, isNew]);

  const validate = useCallback((): boolean => {
    const errors: Partial<Record<keyof UserFormValues, string>> = {};
    if (!values.email.trim()) errors.email = t.userDetail.validation.emailRequired;
    if (isNew && !values.password) errors.password = t.userDetail.validation.passwordRequired;
    if (values.password && values.password.length < 6) {
      errors.password = t.userDetail.validation.passwordMinLength;
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }, [values.email, values.password, isNew, t]);

  const handleSave = useCallback(async () => {
    if (savingRef.current) return;
    if (!isNew && !isDirty) return;
    if (!validate()) {
      notifications.show({
        title: t.validationErrorTitle,
        message: t.userDetail.validation.fixHighlighted,
        color: 'red',
      });
      return;
    }

    savingRef.current = true;
    setSaving(true);
    // The answer belongs to the user on screen now. When the host has opened
    // another one by the time it arrives, it must not be drawn over that user.
    const shown = requestRef.current;
    const stillShown = () => shown === requestRef.current;
    try {
      let saved: User;
      if (isNew) {
        saved = await createUser({ ...edits, email: values.email, password: values.password });
      } else {
        saved = await updateUser(userId, edits);
      }
      notifications.show({
        title: common.success,
        message: isNew ? t.userDetail.notifications.created : t.userDetail.notifications.updated,
        color: 'green',
      });
      if (stillShown()) {
        // What was sent is what is stored now. `values` is the form as it was
        // when the request left: an edit made since then (the request takes a
        // while, and the inputs stay open) differs from it, and stays unsaved.
        // The password that was sent is taken out of its field.
        setInitialValues({ ...values, password: '' });
        setValues((current) =>
          current.password === values.password ? { ...current, password: '' } : current,
        );
        if (isNew) {
          // A created user is the one on screen from here on, so the next
          // Save updates it; where to go next is the host's to say
          setCreated(saved);
          setUser(saved);
          setPolicyCount(saved.policyCount ?? 0);
        }
      }
      onSaved?.(saved);
    } catch (err) {
      notifications.show({
        title: common.error,
        message: err instanceof Error ? err.message : t.userDetail.notifications.saveFailed,
        color: 'red',
      });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [isNew, isDirty, validate, createUser, updateUser, userId, edits, values, onSaved, t, common]);

  const confirmDelete = useCallback(async () => {
    try {
      await deleteUser(userId);
      notifications.show({
        title: common.success,
        message: t.userDetail.notifications.deleted,
        color: 'green',
      });
      setDeleteModalOpen(false);
      onDeleted?.();
    } catch (err) {
      notifications.show({
        title: common.error,
        message: err instanceof Error ? err.message : t.userDetail.notifications.deleteFailed,
        color: 'red',
      });
    }
  }, [deleteUser, userId, onDeleted, t, common]);

  // `formatDateTime` returns '' for an empty or invalid value.
  const dateTime = (value?: string | null) =>
    formatDateTime(value, DATE_TIME_FORMAT_OPTIONS) || t.emptyValue;

  return (
    <Stack gap="md" data-testid="user-detail">
      <Group justify="space-between">
        <Title order={2}>{isNew ? t.userDetail.titleNew : t.userDetail.titleEdit}</Title>
        <Group>
          {onBack && (
            <Button variant="default" onClick={onBack}>
              {common.cancel}
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
            <Tooltip label={t.userDetail.noChangesTooltip} disabled={isNew || isDirty}>
              <Button
                onClick={() => void handleSave()}
                loading={saving}
                disabled={!isNew && !isDirty}
                data-testid="user-detail-save-btn"
              >
                {isNew ? common.create : common.save}
              </Button>
            </Tooltip>
          )}
        </Group>
      </Group>

      <Grid>
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Tabs value={activeTab} onChange={setActiveTab}>
            <Tabs.List>
              <Tabs.Tab value="basic">{t.basicInformation}</Tabs.Tab>
              {!isNew && (
                <Tabs.Tab
                  value="policies"
                  rightSection={
                    <Badge size="sm" circle variant="light">
                      {policyCount}
                    </Badge>
                  }
                >
                  {t.userDetail.tabs.policies}
                </Tabs.Tab>
              )}
            </Tabs.List>

            <Tabs.Panel value="basic" pt="md">
              <Paper shadow="xs" p="md" withBorder pos="relative">
                <LoadingOverlay visible={loading || !permsKnown} />

                {/* Takes no edit until the permissions are known (the overlay only covers it) */}
                <Fieldset
                  variant="unstyled"
                  disabled={!permsKnown}
                  m={0}
                  miw={0}
                  data-testid="user-detail-form"
                >
                  <Stack gap="md">
                    <Group grow>
                      <TextInput
                        label={t.userDetail.fields.firstName}
                        placeholder={t.userDetail.fields.firstNamePlaceholder}
                        value={values.first_name}
                        onChange={(e) => setField('first_name', e.currentTarget.value)}
                        data-testid="user-detail-first-name"
                      />
                      <TextInput
                        label={t.userDetail.fields.lastName}
                        placeholder={t.userDetail.fields.lastNamePlaceholder}
                        value={values.last_name}
                        onChange={(e) => setField('last_name', e.currentTarget.value)}
                        data-testid="user-detail-last-name"
                      />
                    </Group>

                    <TextInput
                      label={t.userDetail.fields.email}
                      placeholder={t.userDetail.fields.emailPlaceholder}
                      required
                      type="email"
                      value={values.email}
                      onChange={(e) => setField('email', e.currentTarget.value)}
                      error={fieldErrors.email}
                      data-testid="user-detail-email"
                    />

                    <PasswordInput
                      label={t.userDetail.fields.password}
                      placeholder={
                        isNew
                          ? t.userDetail.fields.passwordPlaceholderNew
                          : t.userDetail.fields.passwordPlaceholderEdit
                      }
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
                      label={t.userDetail.fields.roles}
                      placeholder={values.roles.length === 0 ? t.userDetail.fields.rolesPlaceholder : undefined}
                      data={roleOptions}
                      value={values.roles}
                      onChange={(roles) => setField('roles', roles)}
                      searchable
                      clearable
                      data-testid="user-detail-roles"
                    />

                    <Group grow>
                      <Select
                        label={t.userDetail.fields.status}
                        data={statusOptions}
                        value={values.status}
                        onChange={(status) => setField('status', (status as UserStatus) ?? 'active')}
                        allowDeselect={false}
                        data-testid="user-detail-status"
                      />
                      <TextInput
                        label={t.userDetail.fields.title}
                        placeholder={t.userDetail.fields.titlePlaceholder}
                        value={values.title}
                        onChange={(e) => setField('title', e.currentTarget.value)}
                      />
                    </Group>

                    <Textarea
                      label={t.fields.description}
                      placeholder={t.userDetail.fields.descriptionPlaceholder}
                      value={values.description}
                      onChange={(e) => setField('description', e.currentTarget.value)}
                      rows={3}
                    />

                    <Group grow>
                      <TextInput
                        label={t.userDetail.fields.location}
                        placeholder={t.userDetail.fields.locationPlaceholder}
                        value={values.location}
                        onChange={(e) => setField('location', e.currentTarget.value)}
                      />
                      <TagsInput
                        label={t.userDetail.fields.tags}
                        placeholder={t.userDetail.fields.tagsPlaceholder}
                        value={values.tags}
                        onChange={(tags) => setField('tags', tags)}
                      />
                    </Group>

                    <Group grow>
                      <Select
                        label={t.userDetail.fields.language}
                        placeholder={t.userDetail.fields.languagePlaceholder}
                        data={LANGUAGE_OPTIONS}
                        value={values.language}
                        onChange={(language) => setField('language', language)}
                        searchable
                        clearable
                      />
                      <Select
                        label={t.userDetail.fields.theme}
                        placeholder={t.userDetail.fields.themePlaceholder}
                        data={themeOptions}
                        value={values.theme}
                        onChange={(theme) => setField('theme', theme)}
                        clearable
                      />
                    </Group>

                    <TokenInput
                      label={t.userDetail.fields.token}
                      description={t.userDetail.fields.tokenDescription}
                      value={values.token || null}
                      onChange={(token) => setField('token', token ?? '')}
                      data-testid="user-detail-token"
                      translations={translations}
                    />
                  </Stack>
                </Fieldset>
              </Paper>
            </Tabs.Panel>

            {!isNew && (
              <Tabs.Panel value="policies" pt="md">
                <UserPoliciesManager
                  userId={userId}
                  onUpdate={() => void refreshCounts()}
                  onPolicyClick={onPolicyClick}
                  translations={translations}
                />
              </Tabs.Panel>
            )}
          </Tabs>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 4 }}>
          {!isNew && user && (
            <InfoPanel
              items={[
                { label: t.userDetail.info.userId, value: user.id },
                {
                  label: t.userDetail.info.lastAccess,
                  value: user.last_access
                    ? formatDateTime(user.last_access, DATE_TIME_FORMAT_OPTIONS)
                    : t.never,
                },
                { label: t.created, value: dateTime(user.created_at) },
                { label: t.updated, value: dateTime(user.updated_at) },
                {
                  label: t.userDetail.info.policies,
                  value: formatCount(policyCount, t.count.policies),
                },
              ]}
              description={t.userDetail.info.description}
              translations={translations}
            />
          )}
        </Grid.Col>
      </Grid>

      <DeleteConfirmModal
        opened={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title={t.userDetail.deleteModal.title}
        description={t.userDetail.deleteModal.description}
        translations={translations}
      />
    </Stack>
  );
};

export default UserDetail;
