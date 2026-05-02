/**
 * ContentNavigation Component
 *
 * Hierarchical sidebar navigation for the content module.
 * Displays all collections in a tree structure with search, grouping,
 * bookmarks, context menus, and show/hide hidden collections.
 *
 * Ported from DaaS content module's navigation.vue + navigation-item.vue.
 *
 * @package @buildpad/ui-collections
 */

"use client";

import React, { useState, useMemo, useCallback } from 'react';
import {
  NavLink,
  TextInput,
  Stack,
  ScrollArea,
  Text,
  Menu,
  ActionIcon,
  Group,
  Tooltip,
  Badge,
  Box,
  UnstyledButton,
} from '@mantine/core';
import {
  IconSearch,
  IconChevronRight,
  IconFolder,
  IconTable,
  IconEye,
  IconEyeOff,
  IconBookmark,
  IconSettings,
  IconDatabase,
  IconBox,
} from '@tabler/icons-react';
import type { Collection, Bookmark } from '@buildpad/types';

/** Node in the collection tree */
export interface CollectionTreeNode extends Collection {
  /** Display name (formatted from collection identifier) */
  name?: string;
  /** Icon identifier (flattened from meta) */
  icon?: string;
  /** Color value (flattened from meta) */
  color?: string;
  children: CollectionTreeNode[];
}

export interface ContentNavigationProps {
  /** Current active collection */
  currentCollection?: string;
  /** Tree of root collections (use useCollections hook) */
  rootCollections: CollectionTreeNode[];
  /** Currently expanded group IDs */
  activeGroups: string[];
  /** Toggle group expand/collapse */
  onToggleGroup: (collectionId: string) => void;
  /** Show hidden collections */
  showHidden?: boolean;
  /** Callback to toggle hidden collections */
  onToggleHidden?: () => void;
  /** Whether hidden collections exist */
  hasHiddenCollections?: boolean;
  /** Whether to show search (many collections) */
  showSearch?: boolean;
  /** Whether to use dense mode */
  dense?: boolean;
  /** Bookmarks grouped by collection */
  bookmarks?: Bookmark[];
  /** Navigate to a collection */
  onNavigate: (collection: string) => void;
  /** Navigate to a bookmark */
  onBookmarkClick?: (bookmark: Bookmark) => void;
  /** Navigate to collection settings (admin only) */
  onEditCollection?: (collection: string) => void;
  /** Whether user is admin */
  isAdmin?: boolean;
  /** Whether collections are loading */
  loading?: boolean;
  /** Called when search value changes */
  onSearchChange?: (search: string) => void;
}

/**
 * Map a collection icon string to a Tabler icon.
 * Falls back to IconTable for unknown icons.
 */
function CollectionIcon({ icon, color }: { icon?: string; color?: string | null }) {
  const iconColor = color || undefined;
  const size = 18;

  switch (icon) {
    case 'box':
      return <IconBox size={size} color={iconColor} />;
    case 'folder':
    case 'folder_open':
      return <IconFolder size={size} color={iconColor} />;
    case 'database':
      return <IconDatabase size={size} color={iconColor} />;
    default:
      return <IconTable size={size} color={iconColor} />;
  }
}

/**
 * Single navigation item (recursive for groups)
 */
function NavigationItem({
  node,
  currentCollection,
  activeGroups,
  onToggleGroup,
  onNavigate,
  bookmarks,
  onBookmarkClick,
  onEditCollection,
  isAdmin,
  search,
  dense,
}: {
  node: CollectionTreeNode;
  currentCollection?: string;
  activeGroups: string[];
  onToggleGroup: (id: string) => void;
  onNavigate: (collection: string) => void;
  bookmarks?: Bookmark[];
  onBookmarkClick?: (bookmark: Bookmark) => void;
  onEditCollection?: (collection: string) => void;
  isAdmin?: boolean;
  search: string;
  dense?: boolean;
}) {
  const isGroup = node.children.length > 0;
  const isExpanded = activeGroups.includes(node.collection);
  const isActive = currentCollection === node.collection;
  const isLocked = node.meta?.collapse === 'locked';
  const isHidden = node.meta?.hidden;
  const hasSchema = !!node.schema;

  // Filter bookmarks for this collection
  const collectionBookmarks = useMemo(
    () => (bookmarks || []).filter((b) => b.collection === node.collection),
    [bookmarks, node.collection]
  );

  const hasBookmarks = collectionBookmarks.length > 0;
  const isGroupWithContent = isGroup || hasBookmarks;

  // Search matching
  const matchesSearch = useMemo(() => {
    if (!search || search.length < 3) return true;
    const q = search.toLowerCase();

    const selfMatch =
      node.collection.toLowerCase().includes(q) ||
      (node.name || '').toLowerCase().includes(q);

    if (selfMatch) return true;

    // Check children recursively
    function childMatches(children: CollectionTreeNode[]): boolean {
      return children.some(
        (child) =>
          child.collection.toLowerCase().includes(q) ||
          (child.name || '').toLowerCase().includes(q) ||
          childMatches(child.children)
      );
    }

    // Check bookmarks
    const bookmarkMatch = collectionBookmarks.some((b) =>
      b.bookmark?.toLowerCase().includes(q)
    );

    return childMatches(node.children) || bookmarkMatch;
  }, [search, node, collectionBookmarks]);

  if (!matchesSearch) return null;

  const handleClick = () => {
    if (hasSchema) {
      onNavigate(node.collection);
    }
  };

  const handleGroupToggle = () => {
    if (isGroupWithContent && !isLocked) {
      onToggleGroup(node.collection);
    }
  };

  const label = (
    <Group gap={4} wrap="nowrap">
      <Text
        size={dense ? 'sm' : undefined}
        fw={isActive ? 600 : 400}
        c={isHidden ? 'dimmed' : undefined}
        truncate
      >
        {node.name || node.collection}
      </Text>
    </Group>
  );

  const contextMenu = isAdmin && hasSchema ? (
    <Menu shadow="md" width={200} position="bottom-start" withArrow>
      <Menu.Target>
        <ActionIcon
          variant="subtle"
          size="xs"
          onClick={(e) => {
            e.stopPropagation();
          }}
          style={{ opacity: 0, transition: 'opacity 150ms' }}
          className="nav-item-action"
          aria-label="Collection options"
        >
          <IconSettings size={14} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item
          leftSection={<IconDatabase size={14} />}
          onClick={() => onEditCollection?.(node.collection)}
        >
          Edit Collection
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  ) : null;

  if (isGroupWithContent) {
    return (
      <>
        <NavLink
          label={label}
          leftSection={<CollectionIcon icon={node.icon} color={node.color} />}
          rightSection={
            <Group gap={4}>
              {contextMenu}
              {!isLocked && (
                <IconChevronRight
                  size={14}
                  style={{
                    transform: isExpanded ? 'rotate(90deg)' : undefined,
                    transition: 'transform 150ms',
                  }}
                />
              )}
            </Group>
          }
          active={isActive}
          opened={isExpanded}
          onClick={() => {
            handleClick();
            handleGroupToggle();
          }}
          py={dense ? 4 : 6}
          styles={{
            root: {
              '&:hover .nav-item-action': {
                opacity: 1,
              },
            },
          }}
        >
          {/* Child collections */}
          {node.children.map((child) => (
            <NavigationItem
              key={child.collection}
              node={child}
              currentCollection={currentCollection}
              activeGroups={activeGroups}
              onToggleGroup={onToggleGroup}
              onNavigate={onNavigate}
              bookmarks={bookmarks}
              onBookmarkClick={onBookmarkClick}
              onEditCollection={onEditCollection}
              isAdmin={isAdmin}
              search={search}
              dense={dense}
            />
          ))}

          {/* Bookmarks */}
          {collectionBookmarks.map((bookmark) => (
            <NavLink
              key={bookmark.id}
              label={
                <Text size="sm" truncate>
                  {bookmark.bookmark || 'Untitled Bookmark'}
                </Text>
              }
              leftSection={
                <IconBookmark
                  size={16}
                  color={bookmark.color || undefined}
                  fill={bookmark.color || 'none'}
                />
              }
              onClick={() => onBookmarkClick?.(bookmark)}
              py={dense ? 3 : 5}
            />
          ))}
        </NavLink>
      </>
    );
  }

  return (
    <NavLink
      label={label}
      leftSection={<CollectionIcon icon={node.icon} color={node.color} />}
      rightSection={contextMenu}
      active={isActive}
      onClick={handleClick}
      py={dense ? 4 : 6}
      styles={{
        root: {
          '&:hover .nav-item-action': {
            opacity: 1,
          },
        },
      }}
    />
  );
}

/**
 * ContentNavigation — Sidebar navigation for the content module.
 *
 * Renders a hierarchical tree of collections with:
 * - Searchable collection list
 * - Expandable/collapsible groups
 * - Bookmark items under each collection
 * - Context menu for admin actions
 * - Show/hide hidden collections
 *
 * @example
 * ```tsx
 * import { ContentNavigation } from '@buildpad/ui-collections';
 * import { useCollections } from '@buildpad/hooks';
 *
 * function Sidebar() {
 *   const {
 *     rootCollections, activeGroups, toggleGroup,
 *     showHidden, setShowHidden, hasHiddenCollections,
 *     showSearch, dense, loading,
 *   } = useCollections({ currentCollection: 'articles' });
 *
 *   return (
 *     <ContentNavigation
 *       rootCollections={rootCollections}
 *       activeGroups={activeGroups}
 *       onToggleGroup={toggleGroup}
 *       currentCollection="articles"
 *       onNavigate={(col) => router.push(`/content/${col}`)}
 *       showHidden={showHidden}
 *       onToggleHidden={() => setShowHidden(!showHidden)}
 *       hasHiddenCollections={hasHiddenCollections}
 *       showSearch={showSearch}
 *       dense={dense}
 *       loading={loading}
 *     />
 *   );
 * }
 * ```
 */
export const ContentNavigation: React.FC<ContentNavigationProps> = ({
  currentCollection,
  rootCollections,
  activeGroups,
  onToggleGroup,
  showHidden = false,
  onToggleHidden,
  hasHiddenCollections = false,
  showSearch = false,
  dense = false,
  bookmarks,
  onNavigate,
  onBookmarkClick,
  onEditCollection,
  isAdmin = false,
  loading = false,
  onSearchChange,
}) => {
  const [search, setSearch] = useState('');

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearch(value);
      onSearchChange?.(value);
    },
    [onSearchChange]
  );

  if (loading) {
    return (
      <Stack gap="xs" p="md">
        {Array.from({ length: 6 }).map((_, i) => (
          <Box
            key={i}
            h={dense ? 28 : 36}
            bg="var(--mantine-color-gray-1)"
            style={{ borderRadius: 'var(--mantine-radius-sm)', animation: 'pulse 1.5s ease-in-out infinite' }}
          />
        ))}
      </Stack>
    );
  }

  if (rootCollections.length === 0) {
    return (
      <Stack gap="md" p="md" align="center" justify="center" style={{ minHeight: 200 }}>
        <IconBox size={48} color="var(--mantine-color-gray-5)" />
        <Text c="dimmed" ta="center" size="sm">
          No collections available
        </Text>
        {isAdmin && (
          <Text c="dimmed" ta="center" size="xs">
            Create your first collection in the data model settings
          </Text>
        )}
      </Stack>
    );
  }

  return (
    <Stack gap={0} style={{ minHeight: '100%' }}>
      {/* Search */}
      {showSearch && (
        <Box p="sm" pb={0} style={{ position: 'sticky', top: 0, zIndex: 1 }}>
          <TextInput
            value={search}
            onChange={(e) => handleSearchChange(e.currentTarget.value)}
            placeholder="Search collections..."
            leftSection={<IconSearch size={16} />}
            size={dense ? 'xs' : 'sm'}
            type="search"
          />
        </Box>
      )}

      {/* Collection tree */}
      <ScrollArea style={{ flex: 1 }} p="xs">
        <nav>
          {rootCollections.map((node) => (
            <NavigationItem
              key={node.collection}
              node={node}
              currentCollection={currentCollection}
              activeGroups={activeGroups}
              onToggleGroup={onToggleGroup}
              onNavigate={onNavigate}
              bookmarks={bookmarks}
              onBookmarkClick={onBookmarkClick}
              onEditCollection={onEditCollection}
              isAdmin={isAdmin}
              search={search}
              dense={dense}
            />
          ))}
        </nav>
      </ScrollArea>

      {/* Show/hide hidden collections toggle */}
      {hasHiddenCollections && onToggleHidden && (
        <Box
          p="xs"
          style={{
            borderTop: '1px solid var(--mantine-color-gray-3)',
            position: 'sticky',
            bottom: 0,
          }}
        >
          <UnstyledButton
            onClick={onToggleHidden}
            style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '4px 8px' }}
          >
            {showHidden ? <IconEyeOff size={16} /> : <IconEye size={16} />}
            <Text size="xs" c="dimmed">
              {showHidden ? 'Hide hidden collections' : 'Show hidden collections'}
            </Text>
          </UnstyledButton>
        </Box>
      )}
    </Stack>
  );
};

export default ContentNavigation;
