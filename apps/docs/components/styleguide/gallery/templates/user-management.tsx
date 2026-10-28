'use client';

import {
  ActionIcon,
  Avatar,
  Badge,
  Box,
  Button,
  Checkbox,
  Divider,
  Grid,
  Group,
  Input,
  Menu,
  Modal,
  MultiSelect,
  Paper,
  Select,
  Stack,
  Switch,
  Table,
  Tabs,
  Text,
  TextInput,
  Textarea,
  Title,
  Tooltip,
  VisuallyHidden,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconBlockquote,
  IconCheck,
  IconChevronDown,
  IconDots,
  IconEdit,
  IconExternalLink,
  IconFolder,
  IconInfoCircle,
  IconKey,
  IconPlus,
  IconSearch,
  IconSettings,
  IconShieldCheck,
  IconTrash,
  IconUserMinus,
  IconUserPlus,
  IconUsersGroup,
  IconX,
} from '@tabler/icons-react';
import { useState, type ReactNode } from 'react';
import { AppShellFrame } from '../AppShellFrame';
import { Gallery } from '../Gallery';
import { BrowserFrame, Specimen, SpecimenGrid } from '../Layout';
import { CURRENT_USER, USERS, type MockUser, type Role } from '../data';
import styles from './user-management.module.css';

/* ── Page-specific mock data ─────────────────────────────────── */

type AccountStatus = MockUser['status'] | 'draft' | 'terminated';

/** UserStatusBadge's USER_STATUS_COLORS, with its lowercase `statusBadge` labels. */
const STATUS_BADGE: Record<AccountStatus, { color: string; label: string }> = {
  active: { color: 'green', label: 'active' },
  invited: { color: 'blue', label: 'invited' },
  draft: { color: 'gray', label: 'draft' },
  suspended: { color: 'red', label: 'suspended' },
  terminated: { color: 'orange', label: 'terminated' },
};

const STATUS_OPTIONS = ['Active', 'Suspended', 'Invited', 'Draft', 'Terminated'];
const ROLE_NAMES: Role[] = ['Administrator', 'Approver', 'Editor', 'Viewer'];

/** `last_access` as UsersManager formats it (`toLocaleDateString`); invited users have never signed in. */
const LAST_ACCESS: Record<string, string> = {
  u1: '10/28/2026',
  u2: '10/28/2026',
  u3: '10/28/2026',
  u5: '10/27/2026',
  u6: '10/7/2026',
};

/** The Approver role and its members, taken from the shared users. */
const ROLE = {
  name: 'Approver' as Role,
  id: '7c1e9a42-3b0d-4f6e-9d21-5a8f0c3e7b14',
  description: 'Signs off purchase orders over $10,000 and manages supplier budgets.',
  created: '3/14/2026, 9:12:40 AM',
  updated: '10/26/2026, 4:05:18 PM',
};
const ROLE_MEMBERS = USERS.filter((u) => u.role === ROLE.name);

const POLICY = {
  name: 'Approver access',
  id: 'b2f06d1e-8a4c-4c3b-a7e5-1d9f2c6b0e83',
  description: 'Read orders and suppliers, approve orders and manage budgets.',
  created: '3/14/2026, 9:15:02 AM',
  updated: '10/26/2026, 4:05:18 PM',
};

type Level = 'all' | 'custom' | 'none';
type Action = 'create' | 'read' | 'update' | 'delete';

const ACTIONS: Array<{ key: Action; label: string; short: string }> = [
  { key: 'create', label: 'Create', short: 'C' },
  { key: 'read', label: 'Read', short: 'R' },
  { key: 'update', label: 'Update', short: 'U' },
  { key: 'delete', label: 'Delete', short: 'D' },
];

/** SystemPermissions' PERMISSION_COLORS: filled green / filled blue / outline gray. */
const LEVEL_BADGE: Record<Level, { color: string; variant: 'filled' | 'outline'; label: string }> = {
  all: { color: 'green', variant: 'filled', label: 'All Access' },
  custom: { color: 'blue', variant: 'filled', label: 'Custom' },
  none: { color: 'gray', variant: 'outline', label: 'No Access' },
};

/** `app` marks an app-access minimum, which SystemPermissions draws as a filled `cyan` pill. */
type Cell = Level | 'app';
type Grants = Record<Action, Cell>;

const INITIAL_PERMISSIONS: Array<{ collection: string; system?: boolean; grants: Grants }> = [
  { collection: 'purchase_orders', grants: { create: 'none', read: 'all', update: 'custom', delete: 'none' } },
  { collection: 'order_lines', grants: { create: 'none', read: 'all', update: 'custom', delete: 'none' } },
  { collection: 'budgets', grants: { create: 'all', read: 'all', update: 'all', delete: 'custom' } },
  { collection: 'suppliers', grants: { create: 'none', read: 'all', update: 'none', delete: 'none' } },
  { collection: 'daas_users', system: true, grants: { create: 'none', read: 'app', update: 'custom', delete: 'none' } },
  { collection: 'daas_files', system: true, grants: { create: 'all', read: 'all', update: 'custom', delete: 'none' } },
];

/** Module-level capabilities, grouped in a folder as ModuleAccessPanel draws them. */
const MODULE_KEYS = [
  { name: 'Approve over limit', description: 'Approve orders above the team budget.', key: 'orders.approve_over_limit', on: true },
  { name: 'Export orders', description: 'Download order lists as CSV.', key: 'orders.export', on: true },
  { name: 'Manage suppliers', description: 'Add and archive suppliers.', key: 'suppliers.manage', on: false },
];

/** Pinned-open dropdowns keep their side and stay in place, with no portal or focus trap. */
const PINNED = {
  opened: true,
  withinPortal: false,
  trapFocus: false,
  returnFocus: false,
  closeOnEscape: false,
  closeOnClickOutside: false,
  hideDetached: false,
  middlewares: { flip: false, shift: false },
  transitionProps: { duration: 0 },
} as const;

/** Mantine's input clear button ships without an accessible name. */
const CLEAR_LABEL = { 'aria-label': 'Clear' } as const;

/** A Modal rendered in place, inside a transformed stage, with no scroll lock or focus trap. */
const STATIC_MODAL = {
  opened: true,
  onClose: () => {},
  withinPortal: false,
  lockScroll: false,
  trapFocus: false,
  returnFocus: false,
  closeOnEscape: false,
  closeOnClickOutside: false,
  transitionProps: { duration: 0 },
  closeButtonProps: { 'aria-label': 'Close' },
} as const;

/* ── Shared cells ────────────────────────────────────────────── */

/** UserAvatar: active users in the brand colour, everyone else neutral. */
function UserAvatar({ user, size = 32 }: { user: MockUser; size?: number }) {
  return (
    <Avatar size={size} radius="xl" color={user.status === 'active' ? 'primary' : 'gray'}>
      {user.initials}
    </Avatar>
  );
}

/** UserStatusBadge: `variant="dot" size="sm"` in the status colour. */
function StatusBadge({ status }: { status: AccountStatus }) {
  return (
    <Badge color={STATUS_BADGE[status].color} variant="dot" size="sm">
      {STATUS_BADGE[status].label}
    </Badge>
  );
}

function RowMenuItems() {
  return (
    <>
      <Menu.Item leftSection={<IconEdit size={14} />}>Edit</Menu.Item>
      <Menu.Item leftSection={<IconTrash size={14} />} color="red">
        Delete
      </Menu.Item>
    </>
  );
}

/** RowActionsMenu: a subtle gray kebab with Edit and a red Delete. */
function RowActionsMenu({ user }: { user: MockUser }) {
  return (
    <Menu position="bottom-end">
      <Menu.Target>
        <ActionIcon variant="subtle" color="gray" size="sm" aria-label={`Row actions for ${user.name}`}>
          <IconDots size={16} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <RowMenuItems />
      </Menu.Dropdown>
    </Menu>
  );
}

/** The detail pages' header: title, an unsaved-changes dot, Cancel, a red delete and Save. */
function DetailHeader({ title, save }: { title: string; save: ReactNode }) {
  return (
    <Group justify="space-between">
      <Group>
        <Title order={2}>{title}</Title>
        <Badge color="yellow" variant="dot">
          Unsaved Changes
        </Badge>
      </Group>
      <Group>
        <Button variant="default">Cancel</Button>
        <Button color="red" aria-label="Delete">
          <IconTrash size={16} />
        </Button>
        {save}
      </Group>
    </Group>
  );
}

/** InfoPanel: uppercase labels over values, then a gray description box. */
function InfoPanel({ items, description }: { items: Array<{ label: string; value: ReactNode }>; description: string }) {
  return (
    <Paper shadow="xs" p="md" withBorder>
      <Group mb="md">
        <IconInfoCircle size={20} />
        <Text fw={600}>Information</Text>
      </Group>
      <Stack gap="sm">
        {items.map((item) => (
          <div key={item.label}>
            <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
              {item.label}
            </Text>
            <Text size="sm" className={styles.breakAll}>
              {item.value}
            </Text>
          </div>
        ))}
      </Stack>
      <Paper mt="md" p="sm" bg="gray.0">
        <Text size="sm" c="dimmed">
          {description}
        </Text>
      </Paper>
    </Paper>
  );
}

/** SelectIcon's trigger: a full-width default Button showing the chosen icon and its name. */
function IconField({ value }: { value: string }) {
  return (
    <Input.Wrapper label="Icon">
      <Button variant="default" fullWidth justify="space-between" rightSection={<IconChevronDown size={16} />}>
        <Group gap="xs">
          <IconShieldCheck size={18} />
          <Text size="sm">{value}</Text>
        </Group>
      </Button>
    </Input.Wrapper>
  );
}

/* ── Users list ──────────────────────────────────────────────── */

function UsersTable({
  users,
  selected = [],
  onSelectedChange,
}: {
  users: MockUser[];
  selected?: string[];
  onSelectedChange?: (ids: string[]) => void;
}) {
  const all = users.length > 0 && users.every((u) => selected.includes(u.id));
  const some = users.some((u) => selected.includes(u.id));
  return (
    <div className={styles.tableScroll}>
      <Table highlightOnHover withTableBorder={false} verticalSpacing="sm" className={styles.usersTable}>
        <Table.Thead>
          <Table.Tr>
            <Table.Th className={styles.checkCell}>
              <Checkbox
                aria-label="Select all"
                checked={all}
                indeterminate={some && !all}
                onChange={() => onSelectedChange?.(all ? [] : users.map((u) => u.id))}
              />
            </Table.Th>
            <Table.Th>User</Table.Th>
            <Table.Th>Email</Table.Th>
            <Table.Th>Role</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th>Last Access</Table.Th>
            <Table.Th className={styles.menuCell}>
              <VisuallyHidden>Actions</VisuallyHidden>
            </Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {users.length === 0 ? (
            <Table.Tr>
              <Table.Td colSpan={7}>
                <Text c="dimmed" ta="center" py="xl">
                  No users found — try adjusting your filters
                </Text>
              </Table.Td>
            </Table.Tr>
          ) : (
            users.map((user) => (
              <Table.Tr key={user.id} className={styles.row}>
                <Table.Td>
                  <Checkbox
                    aria-label={`Select ${user.name}`}
                    checked={selected.includes(user.id)}
                    onChange={(e) => {
                      const checked = e.currentTarget.checked;
                      onSelectedChange?.(checked ? [...selected, user.id] : selected.filter((id) => id !== user.id));
                    }}
                  />
                </Table.Td>
                <Table.Td>
                  <Group gap="sm" wrap="nowrap">
                    <UserAvatar user={user} />
                    <Text size="sm" fw={500} className={styles.nowrap}>
                      {user.name}
                    </Text>
                  </Group>
                </Table.Td>
                <Table.Td className={styles.emailCell}>
                  <Text size="sm" c="dimmed" truncate="end">
                    {user.email}
                  </Text>
                </Table.Td>
                <Table.Td className={styles.nowrap}>
                  <Badge variant="light" size="sm">
                    {user.role}
                  </Badge>
                </Table.Td>
                <Table.Td className={styles.nowrap}>
                  <StatusBadge status={user.status} />
                </Table.Td>
                <Table.Td>
                  <Text size="xs" c="dimmed" className={styles.nowrap}>
                    {LAST_ACCESS[user.id] ?? 'Never'}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <RowActionsMenu user={user} />
                </Table.Td>
              </Table.Tr>
            ))
          )}
        </Table.Tbody>
      </Table>
    </div>
  );
}

/** UsersManager's bulk toolbar: a bordered Paper above the card while rows are selected. */
function UsersBulkToolbar({
  count,
  onClear,
  onUpdateRoles,
}: {
  count: number;
  onClear?: () => void;
  onUpdateRoles?: () => void;
}) {
  return (
    <Paper p="sm" radius="md" withBorder>
      <Group>
        <Text size="sm" fw={500}>
          {count} selected
        </Text>
        <Button variant="subtle" color="gray" size="xs" onClick={onClear}>
          Clear
        </Button>
        <Group gap="xs" ml="auto">
          <Button variant="light" size="xs" leftSection={<IconUsersGroup size={14} />} onClick={onUpdateRoles}>
            Update roles
          </Button>
          <Menu position="bottom-end">
            <Menu.Target>
              <Button variant="light" size="xs">
                Set status
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              {STATUS_OPTIONS.map((s) => (
                <Menu.Item key={s}>{s}</Menu.Item>
              ))}
            </Menu.Dropdown>
          </Menu>
          <Button variant="light" color="red" size="xs" leftSection={<IconTrash size={14} />}>
            Delete
          </Button>
        </Group>
      </Group>
    </Paper>
  );
}

/** ListFooter: "Showing N of M users" with a page-size Select, pagination on the right when there are pages. */
function UsersFooter({ shown }: { shown: number }) {
  return (
    <div className={styles.footer}>
      <Group gap="sm">
        <Text size="xs" c="dimmed">
          Showing {shown} of {USERS.length} {USERS.length === 1 ? 'user' : 'users'}
        </Text>
        <Select
          size="xs"
          w={110}
          aria-label="Items per page"
          data={['10', '25', '50', '100'].map((n) => ({ value: n, label: `${n} / page` }))}
          defaultValue="25"
          allowDeselect={false}
        />
      </Group>
    </div>
  );
}

function UsersPage({
  interactive,
  initialSelected = [],
  onUpdateRoles,
}: {
  interactive?: boolean;
  initialSelected?: string[];
  onUpdateRoles?: () => void;
}) {
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>(initialSelected);
  const q = search.trim().toLowerCase();
  const users = USERS.filter(
    (u) =>
      (!q || `${u.name} ${u.email}`.toLowerCase().includes(q)) &&
      (!role || u.role === role) &&
      (!status || u.status === status.toLowerCase())
  );

  return (
    <Stack gap="md">
      <Box>
        <Title order={2} mb={4}>
          Users
        </Title>
        <Text size="sm" c="dimmed">
          Manage user accounts, roles, and access permissions
        </Text>
      </Box>

      {selected.length > 0 && (
        <UsersBulkToolbar count={selected.length} onClear={() => setSelected([])} onUpdateRoles={onUpdateRoles} />
      )}

      <Paper withBorder shadow="sm" radius="md" className={styles.card}>
        <div className={styles.toolbar}>
          <TextInput
            className={styles.search}
            aria-label="Search users"
            placeholder="Search users..."
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => interactive && setSearch(e.currentTarget.value)}
            rightSection={
              search ? (
                <ActionIcon variant="subtle" color="gray" size="sm" aria-label="Clear search" onClick={() => setSearch('')}>
                  <IconX size={14} />
                </ActionIcon>
              ) : undefined
            }
          />
          <Select
            className={styles.filter}
            size="sm"
            aria-label="Role"
            placeholder="Role"
            data={ROLE_NAMES}
            value={role}
            onChange={(v) => interactive && setRole(v)}
            clearable
            clearButtonProps={CLEAR_LABEL}
          />
          <Select
            className={styles.filter}
            size="sm"
            aria-label="Status"
            placeholder="Status"
            data={STATUS_OPTIONS}
            value={status}
            onChange={(v) => interactive && setStatus(v)}
            clearable
            clearButtonProps={CLEAR_LABEL}
          />
          <Group gap="sm" className={styles.toolbarEnd}>
            <Badge variant="light" color="gray" size="lg" radius="sm">
              {USERS.length} users
            </Badge>
            <Button leftSection={<IconPlus size={16} />}>Add User</Button>
          </Group>
        </div>
        <UsersTable users={users} selected={selected} onSelectedChange={interactive ? setSelected : undefined} />
        <UsersFooter shown={users.length} />
      </Paper>
    </Stack>
  );
}

function UpdateRolesFields() {
  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        Add and/or remove roles for 2 selected users. Users can hold multiple roles.
      </Text>
      <MultiSelect
        label="Add roles"
        placeholder="Select roles to add"
        data={ROLE_NAMES}
        defaultValue={['Approver']}
        searchable
        clearable
        clearButtonProps={CLEAR_LABEL}
      />
      <MultiSelect
        label="Remove roles"
        placeholder="Select roles to remove"
        data={ROLE_NAMES}
        searchable
        clearable
        clearButtonProps={CLEAR_LABEL}
      />
    </Stack>
  );
}

function UpdateRolesActions({ onCancel }: { onCancel?: () => void }) {
  return (
    <Group justify="flex-end" gap="sm" mt="md">
      <Button variant="default" onClick={onCancel}>
        Cancel
      </Button>
      <Button>Apply</Button>
    </Group>
  );
}

/* ── Templates ───────────────────────────────────────────────── */

/**
 * The users list as UsersManager lays it out: title and subtitle, then the
 * card with search, role and status filters, the count and Add User, the
 * table and ListFooter. Select rows for the bulk toolbar.
 */
export function UsersListTemplate() {
  const [rolesOpen, roles] = useDisclosure(false);
  return (
    <Gallery>
      <BrowserFrame url="/en/users" height={720}>
        <AppShellFrame active="/users">
          <UsersPage interactive onUpdateRoles={roles.open} />
        </AppShellFrame>
      </BrowserFrame>
      <Modal
        opened={rolesOpen}
        onClose={roles.close}
        title="Update roles"
        closeButtonProps={{ 'aria-label': 'Close' }}
      >
        <UpdateRolesFields />
        <UpdateRolesActions onCancel={roles.close} />
      </Modal>
    </Gallery>
  );
}

/** "Update roles" over the users page with two rows selected, rendered in place. */
export function UpdateRolesTemplate() {
  return (
    <Gallery>
      <BrowserFrame url="/en/users" height={640}>
        <div className={styles.fixedStage}>
          <AppShellFrame active="/users">
            <UsersPage initialSelected={['u2', 'u5']} />
          </AppShellFrame>
          <Modal {...STATIC_MODAL} title="Update roles">
            <UpdateRolesFields />
            <UpdateRolesActions />
          </Modal>
        </div>
      </BrowserFrame>
    </Gallery>
  );
}

/** RoleUsersManager: the role's users with move, remove and open actions. */
function RoleUsersPanel() {
  return (
    <Paper shadow="xs" p="md" withBorder>
      <Stack gap="md">
        <Group justify="space-between">
          <Group gap="sm" align="center">
            <Text fw={600} size="lg">
              Users
            </Text>
            <Badge size="lg" circle variant="filled">
              {ROLE_MEMBERS.length}
            </Badge>
          </Group>
          <Button leftSection={<IconUserPlus size={16} />} size="sm">
            Add User
          </Button>
        </Group>
        <div className={styles.tableScroll}>
          <Table withTableBorder={false}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th className={styles.avatarCol}>
                  <VisuallyHidden>Avatar</VisuallyHidden>
                </Table.Th>
                <Table.Th>Name</Table.Th>
                <Table.Th>Email</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>
                  <VisuallyHidden>Actions</VisuallyHidden>
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {ROLE_MEMBERS.map((user) => (
                <Table.Tr key={user.id}>
                  <Table.Td>
                    <UserAvatar user={user} size={28} />
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" fw={500} className={styles.nowrap}>
                      {user.name}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {user.email}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <StatusBadge status={user.status} />
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs" wrap="nowrap" justify="flex-end">
                      <Tooltip label="Move to another role">
                        <ActionIcon variant="subtle" aria-label={`Move ${user.name} to another role`}>
                          <IconUserMinus size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Remove from this role">
                        <ActionIcon variant="subtle" color="red" aria-label={`Remove ${user.name} from this role`}>
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Open user">
                        <ActionIcon variant="subtle" aria-label={`Open ${user.name}`}>
                          <IconExternalLink size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </div>
      </Stack>
    </Paper>
  );
}

/** PolicyAttachmentManager: the attached policies with their access badges. */
function RolePoliciesPanel() {
  return (
    <Paper shadow="xs" p="md" withBorder>
      <Stack gap="md">
        <Group justify="space-between">
          <Group gap="sm" align="center">
            <Text fw={600} size="lg">
              Policies
            </Text>
            <Badge size="lg" circle variant="filled">
              1
            </Badge>
          </Group>
          <Button leftSection={<IconPlus size={16} />} size="sm">
            Add Policies
          </Button>
        </Group>
        <div className={styles.tableScroll}>
          <Table withTableBorder={false}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th className={styles.avatarCol}>
                  <VisuallyHidden>Icon</VisuallyHidden>
                </Table.Th>
                <Table.Th>Name</Table.Th>
                <Table.Th>Access</Table.Th>
                <Table.Th>Description</Table.Th>
                <Table.Th>
                  <VisuallyHidden>Actions</VisuallyHidden>
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              <Table.Tr>
                <Table.Td>
                  <IconShieldCheck size={18} />
                </Table.Td>
                <Table.Td>
                  <Text size="sm" fw={500} className={styles.nowrap}>
                    {POLICY.name}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Badge color="blue" size="sm">
                    App
                  </Badge>
                </Table.Td>
                <Table.Td className={styles.descCell}>
                  <Text size="sm" c="dimmed" lineClamp={1}>
                    {POLICY.description}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Group gap="xs" wrap="nowrap" justify="flex-end">
                    <Tooltip label="Open policy">
                      <ActionIcon variant="subtle" aria-label={`Open ${POLICY.name}`}>
                        <IconExternalLink size={16} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Remove policy">
                      <ActionIcon variant="subtle" color="red" aria-label={`Remove ${POLICY.name}`}>
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Table.Td>
              </Table.Tr>
            </Table.Tbody>
          </Table>
        </div>
      </Stack>
    </Paper>
  );
}

/**
 * RoleDetail for the Approver role: the header with an unsaved dot and the
 * Save menu, then Basic Information / Users / Policies tabs and InfoPanel.
 */
export function RoleDetailTemplate() {
  const [tab, setTab] = useState<string | null>('basic');
  return (
    <Gallery>
      <BrowserFrame url={`/en/roles/${ROLE.id.slice(0, 8)}…`} height={1020}>
        <AppShellFrame active="/roles" title={ROLE.name}>
          <Stack gap="md">
            <DetailHeader
              title="Edit Role"
              save={
                <Menu position="bottom-end">
                  <Menu.Target>
                    <Button rightSection={<IconChevronDown size={16} />}>Save</Button>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Item>Save &amp; Stay</Menu.Item>
                    <Menu.Item>Save &amp; Quit</Menu.Item>
                    <Menu.Item>Save &amp; Add New</Menu.Item>
                    <Menu.Divider />
                    <Menu.Item color="red">Discard Changes</Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              }
            />
            <Grid type="container" breakpoints={{ xs: '360px', sm: '480px', md: '560px', lg: '800px', xl: '1000px' }}>
              <Grid.Col span={{ base: 12, lg: 8 }}>
                <Tabs value={tab} onChange={setTab}>
                  <Tabs.List>
                    <Tabs.Tab value="basic">Basic Information</Tabs.Tab>
                    <Tabs.Tab value="users">Users ({ROLE_MEMBERS.length})</Tabs.Tab>
                    <Tabs.Tab value="policies">Policies (1)</Tabs.Tab>
                  </Tabs.List>
                  <Tabs.Panel value="basic" pt="md">
                    <Paper shadow="xs" p="md" withBorder>
                      <Stack gap="md">
                        <TextInput label="Name" placeholder="Administrator" required defaultValue={ROLE.name} />
                        <IconField value="Verified User" />
                        <Textarea
                          label="Description"
                          placeholder="Role description"
                          defaultValue={ROLE.description}
                          rows={4}
                        />
                        <Select
                          label="Parent Role"
                          placeholder="Select a parent role (optional)"
                          data={['Administrator', 'Editor', 'Viewer']}
                          clearable
                          clearButtonProps={CLEAR_LABEL}
                          searchable
                        />
                        <Switch
                          label="Scope Assignment Rules"
                          description="Restrict which scopes users with this role can be assigned to"
                        />
                      </Stack>
                    </Paper>
                  </Tabs.Panel>
                  <Tabs.Panel value="users" pt="md">
                    <RoleUsersPanel />
                  </Tabs.Panel>
                  <Tabs.Panel value="policies" pt="md">
                    <RolePoliciesPanel />
                  </Tabs.Panel>
                </Tabs>
              </Grid.Col>
              <Grid.Col span={{ base: 12, lg: 4 }}>
                <InfoPanel
                  items={[
                    { label: 'Role ID', value: ROLE.id },
                    { label: 'Users', value: `${ROLE_MEMBERS.length} ${ROLE_MEMBERS.length === 1 ? 'user' : 'users'}` },
                    { label: 'Policies', value: '1 policy' },
                    { label: 'Created', value: ROLE.created },
                    { label: 'Updated', value: ROLE.updated },
                  ]}
                  description="Role information and assignments"
                />
              </Grid.Col>
            </Grid>
          </Stack>
        </AppShellFrame>
      </BrowserFrame>
    </Gallery>
  );
}

/* ── Policy detail ───────────────────────────────────────────── */

/** SystemPermissions' toggle: a Badge per action opening All / No / Custom. */
function PermissionPill({
  action,
  cell,
  onChange,
}: {
  action: (typeof ACTIONS)[number];
  cell: Cell;
  onChange: (level: Level) => void;
}) {
  if (cell === 'app') {
    return (
      <Menu position="bottom" withArrow>
        <Menu.Target>
          <Badge
            component="button"
            type="button"
            color="cyan"
            variant="filled"
            size="sm"
            className={styles.pill}
            title="Required for app access"
            aria-label={`${action.label}: required for app access`}
          >
            {action.short}
          </Badge>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item leftSection={<IconCheck size={14} />} disabled>
            All Access
          </Menu.Item>
          <Menu.Divider />
          <Menu.Item leftSection={<IconSettings size={14} />}>Use Custom</Menu.Item>
        </Menu.Dropdown>
      </Menu>
    );
  }
  const badge = LEVEL_BADGE[cell];
  return (
    <Menu position="bottom" withArrow>
      <Menu.Target>
        <Badge
          component="button"
          type="button"
          size="sm"
          color={badge.color}
          variant={badge.variant}
          className={styles.pill}
          title={`${action.label} - ${badge.label}`}
          aria-label={`${action.label}: ${badge.label}`}
        >
          {action.short}
        </Badge>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item leftSection={<IconCheck size={14} />} disabled={cell === 'all'} onClick={() => onChange('all')}>
          All Access
        </Menu.Item>
        <Menu.Item leftSection={<IconBlockquote size={14} />} disabled={cell === 'none'} onClick={() => onChange('none')}>
          No Access
        </Menu.Item>
        <Menu.Divider />
        <Menu.Item leftSection={<IconSettings size={14} />} onClick={() => onChange('custom')}>
          Use Custom
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

/** SystemPermissions: a Permissions title with Add Collection, the C/R/U/D matrix and the app-access notice. */
function SystemPermissions() {
  const [rows, setRows] = useState(INITIAL_PERMISSIONS);
  const setLevel = (collection: string, action: Action | 'every', level: Level) =>
    setRows((cur) =>
      cur.map((row) => {
        if (row.collection !== collection) return row;
        if (action !== 'every') return { ...row, grants: { ...row.grants, [action]: level } };
        const grants = { ...row.grants };
        for (const a of ACTIONS) if (grants[a.key] !== 'app' || level === 'all') grants[a.key] = level;
        return { ...row, grants };
      })
    );
  const regular = rows.filter((r) => !r.system);
  const system = rows.filter((r) => r.system);

  const renderRow = (row: (typeof rows)[number]) => (
    <Table.Tr key={row.collection}>
      <Table.Td>
        <Group justify="space-between" wrap="nowrap" gap="xs">
          <Text size="sm" ff="monospace" truncate="end" className={styles.collectionName}>
            {row.collection}
          </Text>
          <Text size="xs" c="dimmed" className={styles.nowrap}>
            <button type="button" className={styles.textButton} onClick={() => setLevel(row.collection, 'every', 'all')}>
              all
            </button>
            {' / '}
            <button type="button" className={styles.textButton} onClick={() => setLevel(row.collection, 'every', 'none')}>
              none
            </button>
          </Text>
        </Group>
      </Table.Td>
      {ACTIONS.map((action) => (
        <Table.Td key={action.key} className={styles.actionCol}>
          <PermissionPill
            action={action}
            cell={row.grants[action.key]}
            onChange={(level) => setLevel(row.collection, action.key, level)}
          />
        </Table.Td>
      ))}
      <Table.Td>
        <Tooltip label="Remove collection">
          <ActionIcon variant="subtle" color="red" size="sm" aria-label={`Remove ${row.collection}`}>
            <IconX size={14} />
          </ActionIcon>
        </Tooltip>
      </Table.Td>
    </Table.Tr>
  );

  return (
    <div>
      <Group justify="space-between" mb="sm">
        <Title order={4}>Permissions</Title>
        <Button size="xs" leftSection={<IconPlus size={14} />}>
          Add Collection
        </Button>
      </Group>
      <Text size="xs" c="dimmed" mb="sm">
        Per-collection permissions granted by this policy
      </Text>
      <Paper withBorder>
        <div className={styles.tableScroll}>
          <Table striped highlightOnHover withTableBorder={false}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Collection</Table.Th>
                {ACTIONS.map((action) => (
                  <Table.Th key={action.key} className={styles.actionCol}>
                    <Text size="xs" tt="uppercase" fw={600} inherit>
                      {action.label}
                    </Text>
                  </Table.Th>
                ))}
                <Table.Th className={styles.removeCol}>
                  <VisuallyHidden>Remove</VisuallyHidden>
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {regular.map(renderRow)}
              <Table.Tr>
                <Table.Td colSpan={6} py={4}>
                  <Divider
                    label={
                      <Text size="xs" c="dimmed" fw={600} tt="uppercase">
                        System Collections
                      </Text>
                    }
                    labelPosition="center"
                  />
                </Table.Td>
              </Table.Tr>
              {system.map(renderRow)}
            </Table.Tbody>
          </Table>
        </div>
      </Paper>
      <Text size="xs" c="dimmed" mt="xs">
        <strong>App Access is enabled.</strong> Minimal permissions are automatically applied and cannot be removed.
        Reset system permissions to:{' '}
        <button type="button" className={styles.linkButton}>
          app access minimum
        </button>{' '}
        /{' '}
        <button type="button" className={styles.linkButton}>
          recommended defaults
        </button>
      </Text>
    </div>
  );
}

/** ModuleAccessPanel: a folder of capability keys, each with a Switch. */
function ModuleAccess() {
  return (
    <Stack gap="xs">
      <Text size="sm" c="dimmed">
        Application capabilities granted by this policy, independent of collection permissions.
      </Text>
      <Group gap="xs">
        <IconChevronDown size={12} aria-hidden />
        <IconFolder size={14} color="var(--mantine-color-yellow-6)" aria-hidden />
        <Text size="sm" fw={600}>
          Procurement
        </Text>
      </Group>
      <Box pl="md">
        {MODULE_KEYS.map((leaf) => (
          <Group key={leaf.key} justify="space-between" py={6} className={styles.leafRow} wrap="nowrap">
            <Group gap="xs" wrap="nowrap" className={styles.minw0}>
              <IconKey size={13} color="var(--mantine-color-blue-6)" aria-hidden />
              <Stack gap={0} className={styles.minw0}>
                <Text size="sm">{leaf.name}</Text>
                <Text size="xs" c="dimmed">
                  {leaf.description}
                </Text>
              </Stack>
            </Group>
            <Group gap="xs" wrap="nowrap">
              <Badge variant="outline" size="xs" color="blue" ff="monospace">
                {leaf.key}
              </Badge>
              <Switch size="sm" defaultChecked={leaf.on} aria-label={leaf.name} />
            </Group>
          </Group>
        ))}
      </Box>
    </Stack>
  );
}

/**
 * PolicyDetail for "Approver access": basic information and the three access
 * switches, then Record-Level (the SystemPermissions matrix) and Module-Level
 * tabs, beside InfoPanel.
 */
export function PolicyDetailTemplate() {
  return (
    <Gallery>
      <BrowserFrame url={`/en/policies/${POLICY.id.slice(0, 8)}…`} height={1480}>
        <AppShellFrame active="/policies" title={POLICY.name}>
          <Stack gap="md">
            <DetailHeader title="Edit Policy" save={<Button>Save</Button>} />
            <Grid type="container" breakpoints={{ xs: '360px', sm: '480px', md: '560px', lg: '800px', xl: '1000px' }}>
              <Grid.Col span={{ base: 12, lg: 8 }}>
                <Paper shadow="xs" p="md" withBorder>
                  <Stack gap="md">
                    <Title order={4}>Basic Information</Title>
                    <TextInput label="Name" placeholder="Admin Policy" required defaultValue={POLICY.name} />
                    <IconField value="Verified User" />
                    <Textarea
                      label="Description"
                      placeholder="Policy description"
                      defaultValue={POLICY.description}
                      rows={4}
                    />
                    <Title order={4} mt="md">
                      Access Control
                    </Title>
                    <Switch
                      label="App Access"
                      description="Allow access to the app (requires minimal permissions)"
                      defaultChecked
                    />
                    <Switch label="Admin Access" description="Grant full administrative privileges" />
                    <Switch
                      label="Delegate Access"
                      description="Allow using X-On-Behalf-Of header to delegate audit identity in server-to-server requests"
                    />
                  </Stack>
                </Paper>
                <Paper shadow="xs" p="md" withBorder mt="md">
                  <Tabs defaultValue="record-level">
                    <Tabs.List mb="md">
                      <Tabs.Tab value="record-level">Record-Level Access</Tabs.Tab>
                      <Tabs.Tab value="module-level">Module-Level Access</Tabs.Tab>
                    </Tabs.List>
                    <Tabs.Panel value="record-level">
                      <SystemPermissions />
                    </Tabs.Panel>
                    <Tabs.Panel value="module-level">
                      <ModuleAccess />
                    </Tabs.Panel>
                  </Tabs>
                </Paper>
              </Grid.Col>
              <Grid.Col span={{ base: 12, lg: 4 }}>
                <InfoPanel
                  items={[
                    { label: 'Policy ID', value: POLICY.id },
                    { label: 'Users', value: `${ROLE_MEMBERS.length} ${ROLE_MEMBERS.length === 1 ? 'user' : 'users'}` },
                    { label: 'Roles', value: '1 role' },
                    { label: 'Created', value: POLICY.created },
                    { label: 'Updated', value: POLICY.updated },
                  ]}
                  description="Policy information and assignments"
                />
              </Grid.Col>
            </Grid>
          </Stack>
        </AppShellFrame>
      </BrowserFrame>
    </Gallery>
  );
}

/** The module's overlays pinned open, and every account status. */
export function UsersMenus() {
  const user = USERS[3];
  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        <Specimen
          label="Row actions"
          align="start"
          note={
            <>
              <code>RowActionsMenu</code>: a subtle gray <code>size=&quot;sm&quot;</code> kebab with Edit and Delete in{' '}
              <code>color=&quot;red&quot;</code>. Each item appears only if you have that permission.
            </>
          }
        >
          <div className={styles.overlayStage}>
            <Menu {...PINNED} position="bottom">
              <Menu.Target>
                <ActionIcon variant="subtle" color="gray" size="sm" aria-label={`Row actions for ${user.name}`}>
                  <IconDots size={16} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <RowMenuItems />
              </Menu.Dropdown>
            </Menu>
          </div>
        </Specimen>
        <Specimen
          label="Status filter"
          align="start"
          note={
            <>
              <code>Select size=&quot;sm&quot; clearable</code> with <code>dropdownOpened</code>. The dropdown uses the
              same surface as <code>Menu</code> and <code>Popover</code>.
            </>
          }
        >
          <div className={styles.overlayStage}>
            <Select
              aria-label="Status"
              placeholder="Status"
              size="sm"
              data={STATUS_OPTIONS}
              defaultValue="Active"
              clearable
              clearButtonProps={CLEAR_LABEL}
              w={180}
              dropdownOpened
              comboboxProps={{
                withinPortal: false,
                hideDetached: false,
                middlewares: { flip: false, shift: false },
                transitionProps: { duration: 0 },
              }}
            />
          </div>
        </Specimen>
        <Specimen
          label="Permission pill"
          align="start"
          note={
            <>
              SystemPermissions&apos; toggle: a <code>Badge</code> per action that opens a <code>Menu</code>. Filled{' '}
              <code>green</code> means all, filled <code>blue</code> means custom and an <code>outline</code> gray pill
              means none.
            </>
          }
        >
          <div className={styles.overlayStage}>
            <Menu {...PINNED} position="bottom" withArrow>
              <Menu.Target>
                <Badge component="button" type="button" size="sm" color="blue" variant="filled" aria-label="Update: Custom">
                  U
                </Badge>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item leftSection={<IconCheck size={14} />}>All Access</Menu.Item>
                <Menu.Item leftSection={<IconBlockquote size={14} />}>No Access</Menu.Item>
                <Menu.Divider />
                <Menu.Item leftSection={<IconSettings size={14} />}>Use Custom</Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </div>
        </Specimen>
        <Specimen
          label="App-access minimum"
          align="start"
          note={
            <>
              A cell that app access requires is a filled <code>cyan</code> pill with no &quot;No Access&quot; item.
              <code> theme.ts</code> doesn&apos;t alias <code>cyan</code>, so it renders Mantine&apos;s stock cyan.
            </>
          }
        >
          <div className={styles.overlayStage}>
            <Menu {...PINNED} position="bottom" withArrow>
              <Menu.Target>
                <Badge
                  component="button"
                  type="button"
                  size="sm"
                  color="cyan"
                  variant="filled"
                  aria-label="Read: required for app access"
                >
                  R
                </Badge>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item leftSection={<IconCheck size={14} />} disabled>
                  All Access
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item leftSection={<IconSettings size={14} />}>Use Custom</Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </div>
        </Specimen>
        <Specimen
          label="Account status"
          span="full"
          note={
            <>
              <code>UserStatusBadge</code>: <code>variant=&quot;dot&quot; size=&quot;sm&quot;</code> with lowercase
              labels. Terminated is <code>orange</code>, which the theme aliases to the ember brand scale.{' '}
              <code>UserAvatar</code> is <code>primary</code> only for active users.
            </>
          }
        >
          <Stack gap="sm" align="center">
            <Group gap="xs">
              {(Object.keys(STATUS_BADGE) as AccountStatus[]).map((status) => (
                <StatusBadge key={status} status={status} />
              ))}
            </Group>
            <Group gap="md">
              {[CURRENT_USER, USERS[3], USERS[5]].map((u) => (
                <Group key={u.id} gap={6} wrap="nowrap">
                  <UserAvatar user={u} size={28} />
                  <Text size="xs" c="dimmed">
                    {u.name}
                  </Text>
                </Group>
              ))}
            </Group>
          </Stack>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}
