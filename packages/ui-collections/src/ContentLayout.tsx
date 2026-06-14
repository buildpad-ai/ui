/**
 * ContentLayout Component
 *
 * Shell layout for the content module providing:
 * - Sidebar with ContentNavigation
 * - Main content area with header (title, breadcrumbs, actions)
 * - Responsive: sidebar collapses on mobile
 *
 * Ported from DaaS PrivateView + content module shell.
 *
 * @package @buildpad/ui-collections
 */

"use client";

import React, { useState, useCallback } from 'react';
import {
  AppShell,
  Group,
  ActionIcon,
  Title,
  Text,
  Breadcrumbs,
  Anchor,
  Burger,
  Box,
  ScrollArea,
  Skeleton,
  Stack,
  Divider,
  Tooltip,
} from '@mantine/core';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import {
  IconMenu2,
  IconChevronRight,
  IconBox,
} from '@tabler/icons-react';

export interface BreadcrumbItem {
  /** Display label */
  label: string;
  /** Navigation path */
  href?: string;
}

export interface ContentLayoutProps {
  /** Page title */
  title?: string;
  /** Page icon (Tabler icon name or React node) */
  icon?: React.ReactNode;
  /** Icon color */
  iconColor?: string;
  /** Breadcrumb trail */
  breadcrumbs?: BreadcrumbItem[];
  /** Show a back button */
  showBack?: boolean;
  /** Back button callback */
  onBack?: () => void;
  /** Show header shadow (e.g., when form is scrolled) */
  showHeaderShadow?: boolean;
  /** Sidebar content (typically ContentNavigation) */
  sidebar: React.ReactNode;
  /** Sidebar detail panels (right sidebar) */
  sidebarDetail?: React.ReactNode;
  /** Actions rendered in the header bar */
  actions?: React.ReactNode;
  /** Content between title and actions */
  titleAppend?: React.ReactNode;
  /** Headline area (above title, e.g. version menu) */
  headline?: React.ReactNode;
  /** Whether content is loading */
  loading?: boolean;
  /** Sidebar width in px (default: 260) */
  sidebarWidth?: number;
  /** Detail sidebar width in px (default: 284) */
  detailWidth?: number;
  /** Main content */
  children: React.ReactNode;
}

/**
 * ContentLayout — Content module shell with sidebar navigation.
 *
 * Provides a responsive layout with a collapsible sidebar on the left,
 * a header bar with breadcrumbs/title/actions, and a main content area.
 *
 * @example
 * ```tsx
 * import { ContentLayout, ContentNavigation } from '@buildpad/ui-collections';
 * import { useCollections } from '@buildpad/hooks';
 *
 * function ContentPage({ children }) {
 *   const collections = useCollections({ currentCollection: 'articles' });
 *
 *   return (
 *     <ContentLayout
 *       title="Articles"
 *       breadcrumbs={[{ label: 'Content', href: '/content' }]}
 *       sidebar={
 *         <ContentNavigation
 *           rootCollections={collections.rootCollections}
 *           activeGroups={collections.activeGroups}
 *           onToggleGroup={collections.toggleGroup}
 *           onNavigate={(col) => router.push(`/content/${col}`)}
 *         />
 *       }
 *       actions={<Button>Create Item</Button>}
 *     >
 *       <CollectionList collection="articles" />
 *     </ContentLayout>
 *   );
 * }
 * ```
 */
export const ContentLayout: React.FC<ContentLayoutProps> = ({
  title,
  icon,
  iconColor,
  breadcrumbs,
  showBack = false,
  onBack,
  showHeaderShadow = false,
  sidebar,
  sidebarDetail,
  actions,
  titleAppend,
  headline,
  loading = false,
  sidebarWidth = 260,
  detailWidth = 284,
  children,
}) => {
  const [sidebarOpened, { toggle: toggleSidebar, close: closeSidebar }] =
    useDisclosure(true);
  const isMobile = useMediaQuery('(max-width: 768px)');

  const handleBreadcrumbClick = useCallback(
    (e: React.MouseEvent, href?: string) => {
      // Let the app handle navigation via Link or router
      if (!href) e.preventDefault();
    },
    []
  );

  return (
    <AppShell
      navbar={{
        width: sidebarWidth,
        breakpoint: 'sm',
        collapsed: { mobile: !sidebarOpened, desktop: !sidebarOpened },
      }}
      aside={
        sidebarDetail
          ? {
              width: detailWidth,
              breakpoint: 'md',
              collapsed: { mobile: true, desktop: false },
            }
          : undefined
      }
      padding={0}
    >
      {/* Left sidebar - collection navigation */}
      <AppShell.Navbar p={0}>
        <AppShell.Section grow component={ScrollArea}>
          {sidebar}
        </AppShell.Section>
      </AppShell.Navbar>

      {/* Main content */}
      <AppShell.Main>
        {/* Header bar */}
        <Box
          py="sm"
          px="md"
          style={{
            borderBottom: '1px solid var(--mantine-color-default-border)',
            boxShadow: showHeaderShadow
              ? 'var(--ds-shadow-md, 0 4px 6px -1px rgb(0 0 0 / 0.1))'
              : undefined,
            transition: 'box-shadow 150ms ease',
            position: 'sticky',
            top: 0,
            zIndex: 100,
            backgroundColor: 'var(--mantine-color-body)',
          }}
        >
          {/* Headline + Breadcrumbs */}
          {(breadcrumbs || headline) && (
            <Group gap={4} mb={4}>
              {isMobile && (
                <Burger
                  opened={sidebarOpened}
                  onClick={toggleSidebar}
                  size="sm"
                  hiddenFrom="sm"
                />
              )}
              {!isMobile && !sidebarOpened && (
                <ActionIcon variant="subtle" onClick={toggleSidebar} size="sm" mr={4}>
                  <IconMenu2 size={16} />
                </ActionIcon>
              )}
              {breadcrumbs && breadcrumbs.length > 0 && (
                <Breadcrumbs
                  separator={<IconChevronRight size={12} />}
                  style={{ fontSize: 'var(--mantine-font-size-xs)' }}
                >
                  {breadcrumbs.map((item, idx) => (
                    <Anchor
                      key={idx}
                      href={item.href || '#'}
                      size="xs"
                      c="dimmed"
                      onClick={(e) => handleBreadcrumbClick(e, item.href)}
                    >
                      {item.label}
                    </Anchor>
                  ))}
                </Breadcrumbs>
              )}
              {headline}
            </Group>
          )}

          {/* Title + Actions row */}
          <Group justify="space-between" wrap="nowrap">
            <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
              {showBack && onBack && (
                <ActionIcon variant="subtle" onClick={onBack} size="md">
                  <IconChevronRight
                    size={18}
                    style={{ transform: 'rotate(180deg)' }}
                  />
                </ActionIcon>
              )}
              {icon && (
                <Box c={iconColor} style={{ display: 'flex', alignItems: 'center' }}>
                  {icon}
                </Box>
              )}
              {loading ? (
                <Skeleton width={200} height={28} />
              ) : (
                title && (
                  <Title order={3} lineClamp={1} style={{ minWidth: 0 }}>
                    {title}
                  </Title>
                )
              )}
              {titleAppend}
            </Group>

            {actions && (
              <Group gap="xs" wrap="nowrap">
                {actions}
              </Group>
            )}
          </Group>
        </Box>

        {/* Main content area */}
        <Box style={{ flex: 1 }}>
          {children}
        </Box>
      </AppShell.Main>

      {/* Right sidebar - detail panels */}
      {sidebarDetail && (
        <AppShell.Aside p="md">
          <AppShell.Section grow component={ScrollArea}>
            {sidebarDetail}
          </AppShell.Section>
        </AppShell.Aside>
      )}
    </AppShell>
  );
};

export default ContentLayout;
