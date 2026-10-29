// @ts-nocheck
import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Stack, Text, Code } from '@mantine/core';
import { FilterPanel } from './FilterPanel';
import type { Field } from '@buildpad/types';

// ============================================================================
// Mock fields
// ============================================================================

const MOCK_FIELDS: Field[] = [
  { field: 'title', type: 'string', collection: 'posts', meta: { id: 1, collection: 'posts', field: 'title', hidden: false, readonly: false, note: 'Title' } },
  { field: 'status', type: 'string', collection: 'posts', meta: { id: 2, collection: 'posts', field: 'status', hidden: false, readonly: false, note: 'Status' } },
  { field: 'author', type: 'string', collection: 'posts', meta: { id: 3, collection: 'posts', field: 'author', hidden: false, readonly: false, note: 'Author' } },
  { field: 'word_count', type: 'integer', collection: 'posts', meta: { id: 4, collection: 'posts', field: 'word_count', hidden: false, readonly: false, note: 'Word Count' } },
  { field: 'is_featured', type: 'boolean', collection: 'posts', meta: { id: 5, collection: 'posts', field: 'is_featured', hidden: false, readonly: false, note: 'Featured' } },
  { field: 'published_at', type: 'timestamp', collection: 'posts', meta: { id: 6, collection: 'posts', field: 'published_at', hidden: false, readonly: false, note: 'Published At' } },
  { field: 'category_id', type: 'uuid', collection: 'posts', meta: { id: 7, collection: 'posts', field: 'category_id', hidden: false, readonly: false, note: 'Category' } },
];

// ============================================================================
// Interactive wrapper to show output
// ============================================================================

function FilterPanelDemo(props: React.ComponentProps<typeof FilterPanel>) {
  const [filter, setFilter] = useState<Record<string, unknown> | null>(props.value ?? null);

  return (
    <Stack gap="md">
      <FilterPanel {...props} value={filter} onChange={setFilter} />
      <div>
        <Text size="sm" fw={600} mb={4}>Filter output:</Text>
        <Code block style={{ maxHeight: 200, overflow: 'auto' }}>
          {filter ? JSON.stringify(filter, null, 2) : '(no filter)'}
        </Code>
      </div>
    </Stack>
  );
}

// ============================================================================
// Meta
// ============================================================================

const meta = {
  title: 'Collections/FilterPanel',
  component: FilterPanel,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A field-type-aware filter builder. Produces DaaS-compatible filter objects ' +
          '(`{ _and: [...] }`) for use with CollectionList or direct API queries.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default panel mode with all field types.
 * Click "Add filter" to add rules, then observe the JSON output below.
 */
export const Default: Story = {
  render: () => <FilterPanelDemo fields={MOCK_FIELDS} mode="panel" />,
};

/**
 * With pre-populated filters.
 */
export const WithExistingFilters: Story = {
  render: () => (
    <FilterPanelDemo
      fields={MOCK_FIELDS}
      mode="panel"
      value={{
        _and: [
          { status: { _eq: 'published' } },
          { word_count: { _gt: 2000 } },
        ],
      }}
    />
  ),
};

/**
 * Inline mode — no border, fits inside toolbars or sidebars.
 */
export const InlineMode: Story = {
  render: () => <FilterPanelDemo fields={MOCK_FIELDS} mode="inline" />,
};

/**
 * Collapsible mode — starts collapsed, shows filter count badge.
 */
export const Collapsible: Story = {
  render: () => (
    <FilterPanelDemo
      fields={MOCK_FIELDS}
      collapsible
      defaultCollapsed
      value={{
        _and: [
          { status: { _eq: 'draft' } },
        ],
      }}
    />
  ),
};

/**
 * Collapsible, initially expanded.
 */
export const CollapsibleExpanded: Story = {
  render: () => (
    <FilterPanelDemo
      fields={MOCK_FIELDS}
      collapsible
      defaultCollapsed={false}
    />
  ),
};

/**
 * Disabled state — all inputs are read-only.
 */
export const Disabled: Story = {
  render: () => (
    <FilterPanelDemo
      fields={MOCK_FIELDS}
      disabled
      value={{
        _and: [
          { title: { _contains: 'Buildpad' } },
          { status: { _eq: 'published' } },
        ],
      }}
    />
  ),
};

/**
 * Empty fields — shows informational state.
 */
export const NoFields: Story = {
  render: () => <FilterPanelDemo fields={[]} />,
};
