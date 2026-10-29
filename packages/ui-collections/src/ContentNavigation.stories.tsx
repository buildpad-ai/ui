// @ts-nocheck — stories use wrapper render pattern, not direct args
import React, { useState } from 'react';
import { ContentNavigation } from './ContentNavigation';
import type { ContentNavigationProps, CollectionTreeNode } from './ContentNavigation';
import type { Bookmark } from '@buildpad/types';

// ============================================================================
// Mock Data — stories work offline without a DaaS backend
// ============================================================================

const MOCK_TREE: CollectionTreeNode[] = [
  {
    collection: 'pages',
    meta: {
      collection: 'pages',
      icon: 'box',
      color: '#6644FF',
      hidden: false,
      singleton: false,
      group: null,
      collapse: 'open',
      sort: 1,
    },
    schema: { name: 'pages' },
    name: 'Pages',
    children: [],
  },
  {
    collection: 'content',
    meta: {
      collection: 'content',
      icon: 'folder',
      hidden: false,
      singleton: false,
      group: null,
      collapse: 'open',
      sort: 2,
    },
    schema: null,
    name: 'Content',
    children: [
      {
        collection: 'articles',
        meta: {
          collection: 'articles',
          icon: 'box',
          color: '#3B82F6',
          hidden: false,
          singleton: false,
          group: 'content',
          collapse: 'open',
          sort: 1,
        },
        schema: { name: 'articles' },
        name: 'Articles',
        children: [],
      },
      {
        collection: 'blog_posts',
        meta: {
          collection: 'blog_posts',
          icon: 'box',
          color: '#10B981',
          hidden: false,
          singleton: false,
          group: 'content',
          collapse: 'open',
          sort: 2,
        },
        schema: { name: 'blog_posts' },
        name: 'Blog Posts',
        children: [],
      },
      {
        collection: 'categories',
        meta: {
          collection: 'categories',
          icon: 'database',
          color: '#F59E0B',
          hidden: false,
          singleton: false,
          group: 'content',
          collapse: 'open',
          sort: 3,
        },
        schema: { name: 'categories' },
        name: 'Categories',
        children: [],
      },
    ],
  },
  {
    collection: 'settings',
    meta: {
      collection: 'settings',
      icon: 'box',
      color: '#8B5CF6',
      hidden: false,
      singleton: true,
      group: null,
      collapse: 'open',
      sort: 3,
    },
    schema: { name: 'settings' },
    name: 'Settings',
    children: [],
  },
  {
    collection: 'media',
    meta: {
      collection: 'media',
      icon: 'folder',
      hidden: false,
      singleton: false,
      group: null,
      collapse: 'locked',
      sort: 4,
    },
    schema: null,
    name: 'Media',
    children: [
      {
        collection: 'images',
        meta: {
          collection: 'images',
          icon: 'box',
          color: '#EC4899',
          hidden: false,
          singleton: false,
          group: 'media',
          collapse: 'open',
          sort: 1,
        },
        schema: { name: 'images' },
        name: 'Images',
        children: [],
      },
      {
        collection: 'videos',
        meta: {
          collection: 'videos',
          icon: 'box',
          color: '#EF4444',
          hidden: false,
          singleton: false,
          group: 'media',
          collapse: 'open',
          sort: 2,
        },
        schema: { name: 'videos' },
        name: 'Videos',
        children: [],
      },
    ],
  },
  {
    collection: 'system_logs',
    meta: {
      collection: 'system_logs',
      icon: 'database',
      color: '#6B7280',
      hidden: true,
      singleton: false,
      group: null,
      collapse: 'open',
      sort: 5,
    },
    schema: { name: 'system_logs' },
    name: 'System Logs',
    children: [],
  },
];

const MOCK_BOOKMARKS: Bookmark[] = [
  {
    id: 1,
    user: 'user-1',
    collection: 'articles',
    bookmark: 'Published Articles',
    icon: 'box',
    color: '#3B82F6',
    filter: { _and: [{ status: { _eq: 'published' } }] },
  },
  {
    id: 2,
    user: 'user-1',
    collection: 'articles',
    bookmark: 'My Drafts',
    icon: 'box',
    color: '#F59E0B',
    filter: { _and: [{ status: { _eq: 'draft' } }] },
  },
  {
    id: 3,
    user: 'user-1',
    collection: 'blog_posts',
    bookmark: 'Featured Posts',
    icon: 'box',
    color: '#10B981',
  },
];

// ============================================================================
// Interactive wrapper — manages state that ContentNavigation itself doesn't own
// ============================================================================

function NavigationWrapper(props: Partial<ContentNavigationProps>) {
  const [currentCollection, setCurrentCollection] = useState(
    props.currentCollection ?? 'articles'
  );
  const [activeGroups, setActiveGroups] = useState<string[]>(
    props.activeGroups ?? ['content']
  );
  const [showHidden, setShowHidden] = useState(props.showHidden ?? false);

  const toggleGroup = (id: string) => {
    setActiveGroups((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    );
  };

  return (
    <div className="storybook-nav-wrapper">
      <ContentNavigation
        rootCollections={props.rootCollections ?? MOCK_TREE}
        currentCollection={currentCollection}
        activeGroups={activeGroups}
        onToggleGroup={toggleGroup}
        showHidden={showHidden}
        onToggleHidden={() => setShowHidden(!showHidden)}
        hasHiddenCollections
        showSearch={props.showSearch ?? true}
        dense={props.dense ?? false}
        bookmarks={props.bookmarks}
        onNavigate={setCurrentCollection}
        onBookmarkClick={(b) => {
          setCurrentCollection(b.collection);
          console.log('Bookmark clicked:', b.bookmark);
        }}
        onEditCollection={(col) => console.log('Edit collection:', col)}
        isAdmin={props.isAdmin ?? true}
        loading={props.loading ?? false}
        onSearchChange={(val) => console.log('Search:', val)}
      />
    </div>
  );
}

// ============================================================================
// Wrapper props for the stories (subset of full ContentNavigationProps)
// ============================================================================

interface WrapperProps {
  currentCollection?: string;
  showSearch?: boolean;
  dense?: boolean;
  isAdmin?: boolean;
  loading?: boolean;
}

// ============================================================================
// Meta
// ============================================================================

const meta = {
  title: 'Collections/ContentNavigation',
  parameters: {
    layout: 'centered',
    docs: {
      // The sidebar fills its container's height, which is zero inline on the
      // docs page, so each story renders in its own frame.
      story: { inline: false, iframeHeight: 560 },
      description: {
        component:
          'Hierarchical sidebar navigation for the content module. ' +
          'Displays collections as a tree with search, bookmarks, expandable groups, ' +
          'and context menus. Use with `useCollections` hook to supply data.',
      },
    },
  },
  argTypes: {
    currentCollection: {
      control: 'text',
      description: 'Active (highlighted) collection',
    },
    showSearch: {
      control: 'boolean',
      description: 'Show the search input',
    },
    dense: {
      control: 'boolean',
      description: 'Dense mode (smaller text)',
    },
    isAdmin: {
      control: 'boolean',
      description: 'Show admin actions (edit collection)',
    },
    loading: {
      control: 'boolean',
      description: 'Show loading skeleton',
    },
  },
};

export default meta;

// ============================================================================
// Stories
// ============================================================================

/**
 * Default navigation with groups, collections, and search.
 */
export const Default = {
  render: (args: WrapperProps) => (
    <NavigationWrapper
      currentCollection={args.currentCollection}
      showSearch={args.showSearch}
      dense={args.dense}
      isAdmin={args.isAdmin}
      loading={args.loading}
    />
  ),
  args: {
    currentCollection: 'articles',
    showSearch: true,
    dense: false,
    isAdmin: true,
    loading: false,
  },
};

/**
 * With bookmarks displayed under their respective collections.
 */
export const WithBookmarks = {
  render: (args: WrapperProps) => (
    <NavigationWrapper
      currentCollection={args.currentCollection}
      bookmarks={MOCK_BOOKMARKS}
      showSearch
      isAdmin
    />
  ),
  args: {
    currentCollection: 'articles',
  },
};

/**
 * Dense mode for sidebars with many collections.
 */
export const DenseMode = {
  render: () => <NavigationWrapper dense showSearch />,
};

/**
 * Loading state shows skeleton placeholders.
 */
export const Loading = {
  render: () => <NavigationWrapper loading />,
};

/**
 * Locked group — the "Media" group has `collapse: 'locked'` so its
 * chevron is hidden and it cannot be toggled.
 */
export const LockedGroup = {
  render: () => (
    <NavigationWrapper
      activeGroups={['content', 'media']}
      currentCollection="images"
    />
  ),
};

/**
 * Non-admin view — context menu (edit collection) is hidden.
 */
export const NonAdmin = {
  render: () => <NavigationWrapper isAdmin={false} />,
};

/**
 * No search — for setups with few collections.
 */
export const NoSearch = {
  render: () => (
    <NavigationWrapper
      showSearch={false}
      rootCollections={MOCK_TREE.slice(0, 2)}
    />
  ),
};

/**
 * Empty state — no collections available.
 */
export const Empty = {
  render: () => (
    <NavigationWrapper rootCollections={[]} showSearch={false} />
  ),
};
