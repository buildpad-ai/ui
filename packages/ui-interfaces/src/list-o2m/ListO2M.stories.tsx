import type { Meta, StoryObj } from '@storybook/react';
import { ListO2M } from './ListO2M';

const meta: Meta<typeof ListO2M> = {
  title: 'Interfaces/ListO2M',
  component: ListO2M,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `One-to-Many (O2M) relationship interface — displays MULTIPLE items from a related collection.

## DaaS Test Collection: test_o2m (TC01-TC10)
10 O2M fields configured with different options.

## Priorities Implemented
1. Changeset staging  2. Permission checking  3. Circular field exclusion
4. Unique FK guard  5. Singleton guard  6. Dynamic filter interpolation
7. Reorder disabled when paginated  8. Sort/sortDirection props
9. Nested template rendering  10. Batch edit + skeleton loading`,
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    value: { control: 'object', description: 'Array of related item IDs or objects' },
    collection: { control: 'text', description: 'Current collection name (the "one" side)' },
    field: { control: 'text', description: 'Field name for this O2M relationship' },
    primaryKey: { control: 'text', description: 'Primary key of the current item' },
    layout: { control: 'select', options: ['list', 'table'], description: 'Layout mode' },
    tableSpacing: { control: 'select', options: ['compact', 'cozy', 'comfortable'], description: 'Table spacing' },
    template: { control: 'text', description: 'Template string (supports {{field}} and {{nested.field}})' },
    disabled: { control: 'boolean' },
    enableCreate: { control: 'boolean' },
    enableSelect: { control: 'boolean' },
    enableSearchFilter: { control: 'boolean' },
    enableLink: { control: 'boolean' },
    limit: { control: 'number', description: 'Items per page' },
    sort: { control: 'text', description: 'Default sort field' },
    sortDirection: { control: 'select', options: ['asc', 'desc'] },
    label: { control: 'text' },
    description: { control: 'text' },
    error: { control: 'text' },
    required: { control: 'boolean' },
    readOnly: { control: 'boolean' },
    removeAction: { control: 'select', options: ['unlink', 'delete'] },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// ── Shared mock data ────────────────────────────────────────────────────────

const MOCK_BASIC = [
  { id: 1, text: 'First basic comment', author: 'Alice' },
  { id: 2, text: 'Second basic comment with more text', author: 'Bob' },
  { id: 3, text: 'Third comment for testing', author: 'Charlie' },
];

const MOCK_RICH = [
  { id: 101, name: 'Setup environment', priority: 1, status: 'done', due_date: '2025-03-15', is_active: true },
  { id: 102, name: 'Implement API', priority: 2, status: 'active', due_date: '2025-04-01', is_active: true },
  { id: 103, name: 'Write tests', priority: 3, status: 'draft', due_date: '2025-04-15', is_active: true },
  { id: 104, name: 'Deploy prod', priority: 5, status: 'draft', due_date: '2025-05-01', is_active: false },
];

const MOCK_MANY = Array.from({ length: 23 }, (_, i) => ({ id: 200 + i, name: `Page item ${i + 1}` }));

const MOCK_SORTED = [
  { id: 301, name: 'Alpha', sort: 1 },
  { id: 302, name: 'Bravo', sort: 2 },
  { id: 303, name: 'Charlie', sort: 3 },
  { id: 304, name: 'Delta', sort: 4 },
  { id: 305, name: 'Echo', sort: 5 },
];

const MOCK_NESTED = [
  { id: 401, text: 'Nested data item', author: { name: 'Alice', role: 'Admin' }, metadata: { created: '2025-01-10' } },
  { id: 402, text: 'Another nested item', author: { name: 'Bob', role: 'Editor' }, metadata: { created: '2025-01-11' } },
];

const REL_BASIC = {
  relatedCollection: { collection: 'test_o2m_basic' },
  reverseJunctionField: { field: 'test_o2m_id', type: 'uuid' },
};

const REL_RICH = {
  relatedCollection: { collection: 'test_o2m_rich' },
  reverseJunctionField: { field: 'test_o2m_id', type: 'uuid' },
};

// ── TC01: Basic table layout ────────────────────────────────────────────────

export const Default: Story = {
  args: {
    label: 'Basic O2M Comments',
    collection: 'test_o2m',
    field: 'o2m_basic',
    primaryKey: 'test-1',
    layout: 'table',
    fields: ['text', 'author'],
    enableCreate: true,
    enableSelect: true,
    mockItems: MOCK_BASIC,
    mockRelationInfo: REL_BASIC,
  },
};

// ── TC02: List layout with template ─────────────────────────────────────────

export const ListLayout: Story = {
  args: {
    label: 'Comments (List)',
    collection: 'test_o2m',
    field: 'o2m_list_tpl',
    primaryKey: 'test-1',
    layout: 'list',
    template: '{{text}} ({{author}})',
    mockItems: MOCK_BASIC,
    mockRelationInfo: REL_BASIC,
  },
};

// ── Table layout with multiple field types ──────────────────────────────────

export const TableLayout: Story = {
  args: {
    label: 'Rich Fields Table',
    collection: 'test_o2m',
    field: 'o2m_rich',
    primaryKey: 'test-1',
    layout: 'table',
    fields: ['name', 'priority', 'status', 'due_date', 'is_active'],
    mockItems: MOCK_RICH,
    mockRelationInfo: REL_RICH,
  },
};

// ── Table spacing variants ──────────────────────────────────────────────────

export const CompactTable: Story = {
  args: {
    label: 'Compact Table',
    collection: 'test_o2m',
    field: 'o2m_basic',
    primaryKey: 'test-1',
    layout: 'table',
    tableSpacing: 'compact',
    fields: ['text', 'author'],
    mockItems: MOCK_BASIC,
    mockRelationInfo: REL_BASIC,
  },
};

export const CozyTable: Story = {
  args: {
    label: 'Cozy Table',
    collection: 'test_o2m',
    field: 'o2m_basic',
    primaryKey: 'test-1',
    layout: 'table',
    tableSpacing: 'cozy',
    fields: ['text', 'author'],
    mockItems: MOCK_BASIC,
    mockRelationInfo: REL_BASIC,
  },
};

export const ComfortableTable: Story = {
  args: {
    label: 'Comfortable Table',
    collection: 'test_o2m',
    field: 'o2m_basic',
    primaryKey: 'test-1',
    layout: 'table',
    tableSpacing: 'comfortable',
    fields: ['text', 'author'],
    mockItems: MOCK_BASIC,
    mockRelationInfo: REL_BASIC,
  },
};

// ── TC03: Search filter ─────────────────────────────────────────────────────

export const WithSearch: Story = {
  args: {
    label: 'Searchable Tasks',
    collection: 'test_o2m',
    field: 'o2m_search',
    primaryKey: 'test-1',
    layout: 'table',
    enableSearchFilter: true,
    fields: ['name', 'status'],
    mockItems: [
      { id: 1, name: 'Setup project', status: 'done' },
      { id: 2, name: 'Implement auth', status: 'active' },
      { id: 3, name: 'Write tests', status: 'draft' },
    ],
    mockRelationInfo: { relatedCollection: { collection: 'test_o2m_search' }, reverseJunctionField: { field: 'test_o2m_id', type: 'uuid' } },
  },
};

// ── TC05: Enable link ───────────────────────────────────────────────────────

export const WithEnableLink: Story = {
  args: {
    label: 'Linked Items',
    collection: 'test_o2m',
    field: 'o2m_link',
    primaryKey: 'test-1',
    layout: 'table',
    enableLink: true,
    fields: ['text', 'author'],
    mockItems: MOCK_BASIC,
    mockRelationInfo: REL_BASIC,
  },
};

// ── TC07: Pagination ────────────────────────────────────────────────────────

export const WithPagination: Story = {
  args: {
    label: 'Paginated Items',
    collection: 'test_o2m',
    field: 'o2m_page',
    primaryKey: 'test-1',
    layout: 'table',
    limit: 5,
    fields: ['name'],
    mockItems: MOCK_MANY,
    mockRelationInfo: { relatedCollection: { collection: 'test_o2m_page' }, reverseJunctionField: { field: 'test_o2m_id', type: 'uuid' } },
  },
};

// ── Create / Select button variants ─────────────────────────────────────────

export const CreateEnabled: Story = {
  args: {
    label: 'Create Only',
    collection: 'test_o2m',
    field: 'o2m_basic',
    primaryKey: 'test-1',
    enableCreate: true,
    enableSelect: false,
    mockItems: [],
    mockRelationInfo: REL_BASIC,
  },
};

export const SelectEnabled: Story = {
  args: {
    label: 'Select Only',
    collection: 'test_o2m',
    field: 'o2m_basic',
    primaryKey: 'test-1',
    enableCreate: false,
    enableSelect: true,
    mockItems: [],
    mockRelationInfo: REL_BASIC,
  },
};

export const BothEnabled: Story = {
  args: {
    label: 'Create + Select',
    collection: 'test_o2m',
    field: 'o2m_basic',
    primaryKey: 'test-1',
    enableCreate: true,
    enableSelect: true,
    mockItems: [],
    mockRelationInfo: REL_BASIC,
  },
};

// ── Remove actions (TC09, TC10) ─────────────────────────────────────────────

export const UnlinkAction: Story = {
  args: {
    label: 'Unlink Items',
    collection: 'test_o2m',
    field: 'o2m_basic',
    primaryKey: 'test-1',
    removeAction: 'unlink',
    description: 'Removing unlinks the item (sets FK to null)',
    mockItems: MOCK_BASIC,
    mockRelationInfo: REL_BASIC,
  },
};

export const DeleteAction: Story = {
  args: {
    label: 'Delete Items',
    collection: 'test_o2m',
    field: 'o2m_delete',
    primaryKey: 'test-1',
    removeAction: 'delete',
    description: 'Removing deletes the item permanently',
    mockItems: [{ id: 1, text: 'Delete action item 1' }, { id: 2, text: 'Delete action item 2' }],
    mockRelationInfo: { relatedCollection: { collection: 'test_o2m_delete' }, reverseJunctionField: { field: 'test_o2m_id', type: 'uuid' } },
  },
};

// ── States ──────────────────────────────────────────────────────────────────

export const Required: Story = {
  args: {
    label: 'Required Items',
    collection: 'test_o2m',
    field: 'o2m_required',
    primaryKey: 'test-1',
    required: true,
    mockItems: [],
    mockRelationInfo: REL_BASIC,
  },
};

export const WithError: Story = {
  args: {
    label: 'Items',
    collection: 'test_o2m',
    field: 'o2m_basic',
    primaryKey: 'test-1',
    error: 'At least one item is required',
    mockItems: [],
    mockRelationInfo: REL_BASIC,
  },
};

export const Disabled: Story = {
  args: {
    label: 'Disabled Items',
    collection: 'test_o2m',
    field: 'o2m_basic',
    primaryKey: 'test-1',
    disabled: true,
    mockItems: MOCK_BASIC,
    mockRelationInfo: REL_BASIC,
  },
};

export const ReadOnly: Story = {
  args: {
    label: 'Read Only Items',
    collection: 'test_o2m',
    field: 'o2m_basic',
    primaryKey: 'test-1',
    readOnly: true,
    mockItems: MOCK_BASIC,
    mockRelationInfo: REL_BASIC,
  },
};

// ── Empty state ─────────────────────────────────────────────────────────────

export const Empty: Story = {
  args: {
    label: 'Empty O2M',
    collection: 'test_o2m',
    field: 'o2m_basic',
    primaryKey: 'test-1',
    layout: 'table',
    mockItems: [],
    mockRelationInfo: REL_BASIC,
  },
};

// ── Mock items – rendering ──────────────────────────────────────────────────

export const WithMockItems: Story = {
  args: {
    label: 'Blog Comments',
    collection: 'blog_posts',
    field: 'comments',
    primaryKey: 'post-1',
    layout: 'list',
    template: '{{author}} wrote: {{text}}',
    mockItems: MOCK_BASIC,
    mockRelationInfo: REL_BASIC,
  },
};

export const WithMockItemsTable: Story = {
  args: {
    label: 'Rich Fields Table',
    collection: 'test_o2m',
    field: 'o2m_rich',
    primaryKey: 'test-1',
    layout: 'table',
    fields: ['name', 'priority', 'status', 'due_date', 'is_active'],
    mockItems: MOCK_RICH,
    mockRelationInfo: REL_RICH,
  },
};

// ── Priority #1: Changeset staging / local-first states ─────────────────────

export const LocalFirstStates: Story = {
  args: {
    label: 'Local-First States',
    collection: 'test_o2m',
    field: 'o2m_basic',
    primaryKey: '+',
    layout: 'list',
    template: '{{text}} by {{author}}',
    enableCreate: true,
    enableSelect: true,
    mockItems: [
      { id: '$temp_0', text: 'Brand new item', author: 'New User', $type: 'created' },
      { id: 2, text: 'Updated comment text', author: 'Bob', $type: 'updated' },
      { id: 3, text: 'This will be removed', author: 'Charlie', $type: 'deleted' },
      { id: 4, text: 'Normal existing item', author: 'Diana' },
    ],
    mockRelationInfo: REL_BASIC,
  },
};

// ── Priority #4: Unique FK guard ────────────────────────────────────────────

export const UniqueFKGuard: Story = {
  args: {
    label: 'Unique FK (1:1)',
    collection: 'test_o2m',
    field: 'o2m_basic',
    primaryKey: 'test-1',
    enableCreate: true,
    enableSelect: true,
    mockItems: [{ id: 1, text: 'Only one allowed', author: 'Admin' }],
    mockRelationInfo: { ...REL_BASIC, isForeignKeyUnique: true },
  },
};

// ── Priority #5: Singleton guard ────────────────────────────────────────────

export const SingletonGuard: Story = {
  args: {
    label: 'Singleton Collection',
    collection: 'test_o2m',
    field: 'o2m_basic',
    primaryKey: 'test-1',
    mockItems: [],
    mockRelationInfo: { ...REL_BASIC, isSingleton: true },
  },
};

// ── Priority #6/#7/#8: Sortable with sort field ─────────────────────────────

export const Sortable: Story = {
  args: {
    label: 'Sortable Items',
    collection: 'test_o2m',
    field: 'o2m_sort',
    primaryKey: 'test-1',
    layout: 'list',
    template: '{{name}}',
    sort: 'sort',
    sortDirection: 'asc',
    mockItems: MOCK_SORTED,
    mockRelationInfo: {
      relatedCollection: { collection: 'test_o2m_sorted' },
      reverseJunctionField: { field: 'test_o2m_id', type: 'uuid' },
      sortField: 'sort',
    },
  },
};

// ── Priority #9: Nested template rendering ──────────────────────────────────

export const NestedTemplate: Story = {
  args: {
    label: 'Nested Templates',
    collection: 'test_o2m',
    field: 'o2m_basic',
    primaryKey: 'test-1',
    layout: 'list',
    template: '{{text}} by {{author.name}} ({{author.role}}) - {{metadata.created}}',
    mockItems: MOCK_NESTED,
    mockRelationInfo: REL_BASIC,
  },
};

// ── TC09: Description ───────────────────────────────────────────────────────

export const WithDescription: Story = {
  args: {
    label: 'Described Items',
    collection: 'test_o2m',
    field: 'o2m_desc',
    primaryKey: 'test-1',
    layout: 'table',
    description: 'Child items related via O2M relationship',
    fields: ['text'],
    mockItems: [{ id: 1, text: 'Description item 1' }, { id: 2, text: 'Description item 2' }, { id: 3, text: 'Description item 3' }],
    mockRelationInfo: { relatedCollection: { collection: 'test_o2m_desc' }, reverseJunctionField: { field: 'test_o2m_id', type: 'uuid' } },
  },
};

// ── Full-featured ───────────────────────────────────────────────────────────

export const FullFeatured: Story = {
  args: {
    label: 'Project Tasks',
    collection: 'test_o2m',
    field: 'o2m_rich',
    primaryKey: 'test-1',
    layout: 'table',
    tableSpacing: 'cozy',
    enableCreate: true,
    enableSelect: true,
    enableSearchFilter: true,
    enableLink: true,
    limit: 10,
    removeAction: 'unlink',
    description: 'Manage all tasks for this project',
    fields: ['name', 'priority', 'status', 'due_date', 'is_active'],
    mockItems: MOCK_RICH,
    mockRelationInfo: REL_RICH,
  },
};

// ── Without a relational provider (3.0) ─────────────────────────────────────

/**
 * Rendered without `CollectionsRelationalProvider` (the decorator opts out):
 * the field still lists and removes items, but shows the translated
 * missing-provider alert and hides create, select and edit.
 */
export const WithoutProvider: Story = {
  args: { ...Default.args, label: 'O2M without a relational provider' },
  parameters: {
    relationalUI: false,
    docs: {
      description: {
        story:
          'No relational provider: the alert explains which components are missing and the create / select / edit actions are hidden. Switch the Locale toolbar to see the translations.',
      },
    },
  },
};

/** The same, in Indonesian. */
export const WithoutProviderIndonesian: Story = {
  ...WithoutProvider,
  globals: { locale: 'id' },
};
