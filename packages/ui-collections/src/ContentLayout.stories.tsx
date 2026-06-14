// @ts-nocheck — stories use wrapper render pattern, not direct args
import React, { useState } from 'react';
import { Button, Text, Stack, Paper, Badge, Group, TextInput, Textarea, Table } from '@mantine/core';
import { IconPlus, IconCheck, IconBox } from '@tabler/icons-react';
import { ContentLayout } from './ContentLayout';
import type { ContentLayoutProps } from './ContentLayout';
import { ContentNavigation } from './ContentNavigation';
import type { CollectionTreeNode } from './ContentNavigation';

// ============================================================================
// Mock sidebar data (same tree as ContentNavigation stories)
// ============================================================================

const MOCK_TREE: CollectionTreeNode[] = [
  {
    collection: 'pages',
    meta: { collection: 'pages', icon: 'box', color: '#6644FF', hidden: false, singleton: false, collapse: 'open', sort: 1 },
    schema: { name: 'pages' },
    name: 'Pages',
    children: [],
  },
  {
    collection: 'content',
    meta: { collection: 'content', icon: 'folder', hidden: false, singleton: false, collapse: 'open', sort: 2 },
    schema: null,
    name: 'Content',
    children: [
      {
        collection: 'articles',
        meta: { collection: 'articles', icon: 'box', color: '#3B82F6', hidden: false, singleton: false, group: 'content', collapse: 'open', sort: 1 },
        schema: { name: 'articles' },
        name: 'Articles',
        children: [],
      },
      {
        collection: 'blog_posts',
        meta: { collection: 'blog_posts', icon: 'box', color: '#10B981', hidden: false, singleton: false, group: 'content', collapse: 'open', sort: 2 },
        schema: { name: 'blog_posts' },
        name: 'Blog Posts',
        children: [],
      },
    ],
  },
  {
    collection: 'settings',
    meta: { collection: 'settings', icon: 'box', color: '#8B5CF6', hidden: false, singleton: true, collapse: 'open', sort: 3 },
    schema: { name: 'settings' },
    name: 'Settings',
    children: [],
  },
];

// ============================================================================
// Mock content
// ============================================================================

function MockCollectionList() {
  // Mirror the real CollectionList/VTable default surface: bordered card
  // with radius-md and shadow-sm (the Paper carries the chrome, so the
  // table's own theme-default border is disabled).
  return (
    <Paper radius="md" shadow="xs" withBorder p={0} style={{ overflow: 'hidden', marginTop: 16 }}>
    <Table striped highlightOnHover withTableBorder={false}>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Title</Table.Th>
          <Table.Th>Status</Table.Th>
          <Table.Th>Author</Table.Th>
          <Table.Th>Published</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {[
          { title: 'Getting Started with Buildpad', status: 'published', author: 'Jane Smith', date: '2025-06-01' },
          { title: 'Building Dynamic Forms', status: 'published', author: 'John Doe', date: '2025-06-10' },
          { title: 'Advanced Table Patterns', status: 'draft', author: 'Alice Brown', date: null },
          { title: 'Authentication & Permissions', status: 'published', author: 'Bob Wilson', date: '2025-07-01' },
        ].map((item, i) => (
          <Table.Tr key={i}>
            <Table.Td>{item.title}</Table.Td>
            <Table.Td>
              <Badge size="sm" color={item.status === 'published' ? 'green' : 'yellow'}>
                {item.status}
              </Badge>
            </Table.Td>
            <Table.Td>{item.author}</Table.Td>
            <Table.Td>{item.date || '—'}</Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
    </Paper>
  );
}

function MockFormContent() {
  return (
    <Paper p="md" maw={720}>
      <Stack gap="md">
        <TextInput label="Title" placeholder="Enter title" defaultValue="Getting Started with Buildpad" />
        <Group grow>
          <TextInput label="Status" defaultValue="published" />
          <TextInput label="Category" defaultValue="tutorial" />
        </Group>
        <Textarea label="Content" rows={6} defaultValue="This guide covers the basics of building forms and tables with Buildpad UI components." />
      </Stack>
    </Paper>
  );
}

// ============================================================================
// Interactive wrapper — manages sidebar state
// ============================================================================

function LayoutWrapper({
  title = 'Articles',
  breadcrumbs = [{ label: 'Content', href: '/content' }],
  actions,
  children,
  ...rest
}: Partial<ContentLayoutProps>) {
  const [activeGroups, setActiveGroups] = useState<string[]>(['content']);
  const [currentCollection, setCurrentCollection] = useState('articles');

  const toggleGroup = (id: string) => {
    setActiveGroups((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    );
  };

  const sidebar = (
    <ContentNavigation
      rootCollections={MOCK_TREE}
      currentCollection={currentCollection}
      activeGroups={activeGroups}
      onToggleGroup={toggleGroup}
      showSearch
      onNavigate={(col) => {
        setCurrentCollection(col);
        console.log('Navigate to:', col);
      }}
      isAdmin
    />
  );

  return (
    <div className="storybook-fullscreen">
      <ContentLayout
        title={title}
        breadcrumbs={breadcrumbs}
        sidebar={sidebar}
        actions={actions}
        {...rest}
      >
        {children ?? <MockCollectionList />}
      </ContentLayout>
    </div>
  );
}

// ============================================================================
// Wrapper props for the stories
// ============================================================================

interface WrapperProps {
  title?: string;
  loading?: boolean;
  showBack?: boolean;
  showHeaderShadow?: boolean;
  sidebarWidth?: number;
}

// ============================================================================
// Meta
// ============================================================================

const meta = {
  title: 'Collections/ContentLayout',
  tags: ['!autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Shell layout for the content module. Provides a responsive sidebar (collapsible), ' +
          'a sticky header with breadcrumbs, title, and action buttons, and a main content area. ' +
          'Pair with `ContentNavigation` for the sidebar and `CollectionList`/`CollectionForm` for content.',
      },
    },
  },
  argTypes: {
    title: { control: 'text' },
    loading: { control: 'boolean' },
    showBack: { control: 'boolean' },
    showHeaderShadow: { control: 'boolean' },
    sidebarWidth: { control: { type: 'number', min: 200, max: 400 } },
  },
};

export default meta;

// ============================================================================
// Stories
// ============================================================================

/**
 * Collection list view — typical layout showing a list of items with
 * a create button in the header.
 */
export const CollectionListView = {
  render: (args: WrapperProps) => (
    <LayoutWrapper
      title={args.title}
      loading={args.loading}
      showHeaderShadow={args.showHeaderShadow}
      actions={
        <Button leftSection={<IconPlus size={16} />} size="sm">
          Create Item
        </Button>
      }
    />
  ),
  args: {
    title: 'Articles',
    loading: false,
    showHeaderShadow: false,
  },
};

/**
 * Item edit view — shows a form with save button and back navigation.
 */
export const ItemEditView = {
  render: () => (
    <LayoutWrapper
      title="Getting Started with Buildpad"
      breadcrumbs={[
        { label: 'Content', href: '/content' },
        { label: 'Articles', href: '/content/articles' },
      ]}
      showBack
      onBack={() => console.log('Back clicked')}
      icon={<IconBox size={20} />}
      iconColor="#3B82F6"
      actions={
        <Group gap={0}>
          <Button leftSection={<IconCheck size={16} />} size="sm">
            Save
          </Button>
        </Group>
      }
    >
      <MockFormContent />
    </LayoutWrapper>
  ),
};

/**
 * Loading state — skeleton placeholders in the header.
 */
export const Loading = {
  render: () => <LayoutWrapper loading />,
};

/**
 * Header shadow — shown when content is scrolled down.
 */
export const WithHeaderShadow = {
  render: () => (
    <LayoutWrapper showHeaderShadow>
      <Stack p="md" gap="xs">
        {Array.from({ length: 50 }, (_, i) => (
          <Paper key={i} p="sm" withBorder>
            <Text>Item {i + 1}</Text>
          </Paper>
        ))}
      </Stack>
    </LayoutWrapper>
  ),
};

/**
 * With right sidebar — detail panels appear on the right.
 */
export const WithDetailSidebar = {
  render: () => (
    <LayoutWrapper
      sidebarDetail={
        <Stack gap="sm">
          <Text fw={600} size="sm">
            Item Details
          </Text>
          <Paper p="xs" withBorder>
            <Stack gap={4}>
              <Text size="xs" c="dimmed">Created</Text>
              <Text size="sm">Jan 15, 2025</Text>
            </Stack>
          </Paper>
          <Paper p="xs" withBorder>
            <Stack gap={4}>
              <Text size="xs" c="dimmed">Last Modified</Text>
              <Text size="sm">Feb 10, 2025</Text>
            </Stack>
          </Paper>
          <Paper p="xs" withBorder>
            <Stack gap={4}>
              <Text size="xs" c="dimmed">Status</Text>
              <Badge color="green" size="sm">Published</Badge>
            </Stack>
          </Paper>
        </Stack>
      }
    >
      <MockFormContent />
    </LayoutWrapper>
  ),
};

/**
 * Custom sidebar width — narrower sidebar for minimal layouts.
 */
export const NarrowSidebar = {
  render: () => <LayoutWrapper sidebarWidth={200} />,
  args: {
    sidebarWidth: 200,
  },
};
