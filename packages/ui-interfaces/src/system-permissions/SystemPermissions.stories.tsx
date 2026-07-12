import type { Meta, StoryObj } from '@storybook/react';
import { SystemPermissions } from './SystemPermissions';
import type { PermissionAlterations } from './SystemPermissions';
import { useState } from 'react';
import type { Collection } from '@buildpad/types';

const MOCK_COLLECTIONS: Collection[] = [
  { collection: 'articles', meta: { collection: 'Articles' } as any, schema: { name: 'articles' } },
  { collection: 'products', meta: { collection: 'Products' } as any, schema: { name: 'products' } },
  { collection: 'categories', meta: { collection: 'Categories' } as any, schema: { name: 'categories' } },
  { collection: 'daas_users', meta: { collection: 'Users' } as any, schema: { name: 'daas_users' } },
  { collection: 'daas_files', meta: { collection: 'Files' } as any, schema: { name: 'daas_files' } },
  { collection: 'daas_roles', meta: { collection: 'Roles' } as any, schema: { name: 'daas_roles' } },
  { collection: 'daas_activity', meta: { collection: 'Activity' } as any, schema: { name: 'daas_activity' } },
  { collection: 'daas_collections', meta: { collection: 'Collections' } as any, schema: { name: 'daas_collections' } },
  { collection: 'daas_fields', meta: { collection: 'Fields' } as any, schema: { name: 'daas_fields' } },
  { collection: 'daas_relations', meta: { collection: 'Relations' } as any, schema: { name: 'daas_relations' } },
  { collection: 'daas_settings', meta: { collection: 'Settings' } as any, schema: { name: 'daas_settings' } },
  { collection: 'daas_policies', meta: { collection: 'Policies' } as any, schema: { name: 'daas_policies' } },
  { collection: 'daas_extensions', meta: { collection: 'Extensions' } as any, schema: { name: 'daas_extensions' } },
];

const meta: Meta<typeof SystemPermissions> = {
  title: 'System/SystemPermissions',
  component: SystemPermissions,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `A permission management interface for DaaS policies. Renders a table of collections with CRUD+share permission toggles per action.

## Features
- Table layout showing collections vs actions (create, read, update, delete, share)
- Toggle chips with three states: All Access, Custom, No Access
- Context menu for each toggle with All Access / No Access / Use Custom options
- Add collection dropdown with system/regular collection grouping
- System collection divider and reset controls
- Admin notice for admin-access policies
- App access minimum enforcement for system collections
- Bulk All/None shortcuts per collection row

## Based on
DaaS system-permissions interface — ported to React + Mantine v8.`,
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    primaryKey: {
      control: 'text',
      description: 'Policy primary key (UUID)',
    },
    disabled: {
      control: 'boolean',
      description: 'Disable all editing',
    },
    appAccess: {
      control: 'boolean',
      description: 'Whether the policy has app access (shows reset controls)',
    },
    adminAccess: {
      control: 'boolean',
      description: 'Whether the policy has admin access (shows admin notice)',
    },
  },
};

export default meta;
type Story = StoryObj<typeof SystemPermissions>;

/** Empty state with no permissions configured. */
export const Default: Story = {
  render: () => {
    const [value, setValue] = useState<PermissionAlterations | null>(null);
    return (
      <SystemPermissions
        primaryKey="test-policy-1"
        value={value}
        onChange={setValue}
        collections={MOCK_COLLECTIONS}
        label="Permissions"
        description="Configure collection access for this policy"
        data-testid="sp"
      />
    );
  },
};

/** Permissions with some collections already configured. */
export const WithExistingPermissions: Story = {
  render: () => {
    const [value, setValue] = useState<PermissionAlterations | null>({
      create: [
        { collection: 'articles', action: 'create', fields: ['*'], permissions: null, validation: null, presets: null, policy: 'test-policy-1' },
        { collection: 'articles', action: 'read', fields: ['*'], permissions: null, validation: null, presets: null, policy: 'test-policy-1' },
        { collection: 'articles', action: 'update', fields: ['title', 'body'], permissions: { user_created: { _eq: '$CURRENT_USER' } } as any, validation: null, presets: null, policy: 'test-policy-1' },
        { collection: 'products', action: 'read', fields: ['*'], permissions: null, validation: null, presets: null, policy: 'test-policy-1' },
      ],
      update: [],
      delete: [],
    });
    return (
      <SystemPermissions
        primaryKey="test-policy-1"
        value={value}
        onChange={setValue}
        collections={MOCK_COLLECTIONS}
        label="Permissions"
        data-testid="sp"
      />
    );
  },
};

/**
 * System collections with app access enabled: reset controls, and the
 * app-minimal cells (e.g. daas_users read) rendered cyan but extendable —
 * All Access / Use Custom offered, No Access withheld. Field metadata is
 * injected so the detail modal works without an API.
 */
export const WithAppAccess: Story = {
  render: () => {
    const [value, setValue] = useState<PermissionAlterations | null>({
      create: [
        { collection: 'daas_users', action: 'read', fields: ['*'], permissions: null, validation: null, presets: null, policy: 'test-policy-1' },
        { collection: 'daas_files', action: 'read', fields: ['*'], permissions: null, validation: null, presets: null, policy: 'test-policy-1' },
        { collection: 'daas_files', action: 'create', fields: ['*'], permissions: null, validation: null, presets: null, policy: 'test-policy-1' },
      ],
      update: [],
      delete: [],
    });
    return (
      <SystemPermissions
        primaryKey="test-policy-1"
        value={value}
        onChange={setValue}
        collections={MOCK_COLLECTIONS}
        fieldsByCollection={MOCK_FIELDS_BY_COLLECTION as any}
        appAccess
        label="Permissions (App Access)"
        data-testid="sp"
      />
    );
  },
};

/** Admin access shows a simple notice. */
export const AdminAccess: Story = {
  args: {
    primaryKey: 'admin-policy',
    adminAccess: true,
    label: 'Permissions',
    'data-testid': 'sp',
  },
};

/** Disabled state prevents all editing. */
export const Disabled: Story = {
  render: () => {
    const [value, setValue] = useState<PermissionAlterations | null>({
      create: [
        { collection: 'articles', action: 'read', fields: ['*'], permissions: null, validation: null, presets: null, policy: 'test-policy-1' },
        { collection: 'articles', action: 'create', fields: ['*'], permissions: null, validation: null, presets: null, policy: 'test-policy-1' },
      ],
      update: [],
      delete: [],
    });
    return (
      <SystemPermissions
        primaryKey="test-policy-1"
        value={value}
        onChange={setValue}
        collections={MOCK_COLLECTIONS}
        disabled
        label="Permissions (Disabled)"
        data-testid="sp"
      />
    );
  },
};

/** Mixed regular and system collections. */
export const MixedCollections: Story = {
  render: () => {
    const [value, setValue] = useState<PermissionAlterations | null>({
      create: [
        { collection: 'articles', action: 'create', fields: ['*'], permissions: null, validation: null, presets: null, policy: 'test-policy-1' },
        { collection: 'articles', action: 'read', fields: ['*'], permissions: null, validation: null, presets: null, policy: 'test-policy-1' },
        { collection: 'articles', action: 'update', fields: ['*'], permissions: null, validation: null, presets: null, policy: 'test-policy-1' },
        { collection: 'articles', action: 'delete', fields: ['*'], permissions: null, validation: null, presets: null, policy: 'test-policy-1' },
        { collection: 'articles', action: 'share', fields: ['*'], permissions: null, validation: null, presets: null, policy: 'test-policy-1' },
        { collection: 'daas_users', action: 'read', fields: ['*'], permissions: null, validation: null, presets: null, policy: 'test-policy-1' },
        { collection: 'daas_files', action: 'read', fields: ['*'], permissions: null, validation: null, presets: null, policy: 'test-policy-1' },
        { collection: 'daas_files', action: 'create', fields: ['*'], permissions: null, validation: null, presets: null, policy: 'test-policy-1' },
      ],
      update: [],
      delete: [],
    });
    return (
      <SystemPermissions
        primaryKey="test-policy-1"
        value={value}
        onChange={setValue}
        collections={MOCK_COLLECTIONS}
        label="Permissions"
        description="Mixed regular and system collections with full access on articles"
        data-testid="sp"
      />
    );
  },
};

/** Custom permissions (partial access). */
export const CustomPermissions: Story = {
  render: () => {
    const [value, setValue] = useState<PermissionAlterations | null>({
      create: [
        { collection: 'articles', action: 'create', fields: ['title', 'body', 'status'], permissions: null, validation: null, presets: { status: 'draft' }, policy: 'test-policy-1' },
        { collection: 'articles', action: 'read', fields: ['*'], permissions: { status: { _eq: 'published' } } as any, validation: null, presets: null, policy: 'test-policy-1' },
        { collection: 'articles', action: 'update', fields: ['title', 'body'], permissions: { user_created: { _eq: '$CURRENT_USER' } } as any, validation: null, presets: null, policy: 'test-policy-1' },
      ],
      update: [],
      delete: [],
    });
    return (
      <SystemPermissions
        primaryKey="test-policy-1"
        value={value}
        onChange={setValue}
        collections={MOCK_COLLECTIONS}
        label="Custom Permissions"
        description="Permissions with field restrictions, item filters, and presets"
        data-testid="sp"
      />
    );
  },
};

/** With error message. */
export const WithError: Story = {
  args: {
    primaryKey: 'test-policy-1',
    collections: MOCK_COLLECTIONS,
    label: 'Permissions',
    error: 'Failed to save permissions. Please try again.',
    'data-testid': 'sp',
  },
};

const MOCK_FIELDS_BY_COLLECTION = {
  articles: [
    { collection: 'articles', field: 'id', type: 'uuid', schema: { name: 'id', table: 'articles', data_type: 'uuid', is_nullable: false, is_unique: true, is_primary_key: true, has_auto_increment: false } },
    { collection: 'articles', field: 'title', type: 'string' },
    { collection: 'articles', field: 'body', type: 'text' },
    { collection: 'articles', field: 'status', type: 'string' },
    { collection: 'articles', field: 'publish_date', type: 'timestamp' },
    { collection: 'articles', field: 'author', type: 'uuid' },
  ],
  products: [
    { collection: 'products', field: 'id', type: 'uuid' },
    { collection: 'products', field: 'name', type: 'string' },
    { collection: 'products', field: 'price', type: 'decimal' },
  ],
  daas_users: [
    { collection: 'daas_users', field: 'id', type: 'uuid' },
    { collection: 'daas_users', field: 'first_name', type: 'string' },
    { collection: 'daas_users', field: 'last_name', type: 'string' },
    { collection: 'daas_users', field: 'email', type: 'string' },
    { collection: 'daas_users', field: 'status', type: 'string' },
  ],
};

/**
 * Custom permission editing playground: open any toggle menu and pick
 * "Use Custom" to edit fields/filters/validation/presets in the detail
 * modal. Field metadata is injected so no API is needed.
 */
export const CustomEditing: Story = {
  render: () => {
    const [value, setValue] = useState<PermissionAlterations | null>({
      create: [
        { collection: 'articles', action: 'create', fields: ['title', 'body', 'status'], permissions: null, validation: { title: { _nnull: true } } as any, presets: { status: 'draft' }, policy: 'test-policy-1' },
        { collection: 'articles', action: 'read', fields: ['*'], permissions: { status: { _eq: 'published' } } as any, validation: null, presets: null, policy: 'test-policy-1' },
        { collection: 'products', action: 'read', fields: ['*'], permissions: null, validation: null, presets: null, policy: 'test-policy-1' },
      ],
      update: [],
      delete: [],
    });
    return (
      <SystemPermissions
        primaryKey="test-policy-1"
        value={value}
        onChange={setValue}
        collections={MOCK_COLLECTIONS}
        fieldsByCollection={MOCK_FIELDS_BY_COLLECTION as any}
        label="Custom Permission Editing"
        description='Open a toggle menu and choose "Use Custom" to edit the permission in detail'
        data-testid="sp"
      />
    );
  },
};
