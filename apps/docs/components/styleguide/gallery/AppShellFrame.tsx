'use client';

import {
  ActionIcon,
  Avatar,
  Badge,
  Divider,
  Group,
  Menu,
  Stack,
  Text,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import {
  IconBell,
  IconChevronDown,
  IconLogout,
  IconMoon,
  IconSearch,
  IconSettings,
  IconSun,
  IconUser,
} from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { useScheme } from '../SchemeContext';
import { APP, CURRENT_USER, NAV_ITEMS } from './data';
import styles from './gallery.module.css';

/**
 * The CLI's components/layout/AuthenticatedShell, rebuilt for a docs frame.
 *
 * Same markup, same `.bp-*` classes from the shipped globals.css and the same
 * Mantine primitives — only the AppShell's fixed positioning is swapped for a
 * grid so the whole screen fits inside a BrowserFrame. Keep it in step with
 * AuthenticatedShell when that file changes.
 */
export function AppShellFrame({
  active,
  title,
  headerActions,
  hideNavBadges = false,
  children,
}: {
  /** href of the active nav item, e.g. `/orders`. */
  active: string;
  /** Breadcrumb page title; defaults to the active nav label. */
  title?: string;
  headerActions?: ReactNode;
  /** Hide the nav count badges, e.g. for an empty first-run workspace. */
  hideNavBadges?: boolean;
  children: ReactNode;
}) {
  const sections: Array<{ section: string; items: typeof NAV_ITEMS }> = [];
  for (const item of NAV_ITEMS) {
    const section = item.section ?? 'Main Menu';
    let group = sections.find((g) => g.section === section);
    if (!group) {
      group = { section, items: [] };
      sections.push(group);
    }
    group.items.push(item);
  }
  const scheme = useScheme();
  const pageTitle = title ?? NAV_ITEMS.find((i) => i.href === active)?.label ?? APP.name;

  return (
    <div className={styles.shell}>
      <nav className={`bp-navbar ${styles.shellNavbar}`}>
        <Stack gap={4} style={{ flex: 1, width: '100%' }}>
          <div className="bp-brand-container">
            <div className="bp-brand-icon">{APP.initial}</div>
            <Stack gap={0}>
              <Text
                fw={600}
                size="sm"
                style={{
                  lineHeight: 1.2,
                  fontFamily: 'var(--ds-font-display)',
                  letterSpacing: 'var(--ds-letter-spacing-tight, -0.02em)',
                }}
              >
                {APP.name}
              </Text>
              <Text size="xs" c="dimmed" style={{ lineHeight: 1 }}>
                {APP.workspace}
              </Text>
            </Stack>
          </div>

          {sections.map((group, groupIndex) => (
            <div key={group.section}>
              <Text
                size="xs"
                fw={700}
                c="dimmed"
                px="xs"
                mb={4}
                mt={groupIndex > 0 ? 'md' : 0}
                style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}
              >
                {group.section}
              </Text>
              <Stack gap={4}>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = item.href === active;
                  return (
                    <a
                      key={item.href}
                      href="#"
                      onClick={(e) => e.preventDefault()}
                      className={`bp-nav-link ${isActive ? 'bp-nav-link-active' : ''}`}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <Icon size={18} stroke={1.8} />
                      <span style={{ flex: 1 }}>{item.label}</span>
                      {item.badge && !hideNavBadges && (
                        <Badge size="xs" variant={isActive ? 'filled' : 'light'} color={isActive ? 'primary' : 'gray'}>
                          {item.badge}
                        </Badge>
                      )}
                    </a>
                  );
                })}
              </Stack>
            </div>
          ))}
        </Stack>

      </nav>

      <div className={styles.shellMain}>
        <header className={`bp-header ${styles.shellHeader}`}>
          <Group gap="xs">
            <Text size="sm" c="dimmed" fw={500}>
              {APP.name}
            </Text>
            <Text size="sm" c="dimmed" fw={500}>
              /
            </Text>
            <Text size="sm" fw={600}>
              {pageTitle}
            </Text>
          </Group>
          <Group gap="md">
            <UnstyledButton className="bp-search-button">
              <Group gap="xs" wrap="nowrap">
                <IconSearch size={14} stroke={1.8} />
                <Text size="xs">Search…</Text>
              </Group>
              <span className="bp-search-kbd">⌘K</span>
            </UnstyledButton>
            <Tooltip label="Notifications">
              <div className="bp-notification-bell">
                <ActionIcon variant="subtle" size="lg" color="gray" aria-label="Notifications">
                  <IconBell size={20} stroke={1.8} />
                </ActionIcon>
                <div className="bp-notification-dot" />
              </div>
            </Tooltip>
            {headerActions}
            <ActionIcon variant="subtle" size="lg" color="gray" aria-label="Toggle color scheme">
              {/* ColorSchemeToggle shows the sun in dark, the moon in light. */}
              {scheme === 'dark' ? <IconSun size={18} stroke={1.8} /> : <IconMoon size={18} stroke={1.8} />}
            </ActionIcon>
            <Menu position="bottom-end" offset={8} shadow="md" width={240}>
              <Menu.Target>
                <UnstyledButton className="bp-header-user-button" aria-label="Account">
                  <Avatar radius="xl" size={30} color="primary" style={{ border: '2px solid var(--ds-primary-200)' }}>
                    {CURRENT_USER.initials}
                  </Avatar>
                  <Group gap={6} wrap="nowrap" visibleFrom="sm">
                    <Text size="sm" fw={500} maw={160} truncate>
                      {CURRENT_USER.name}
                    </Text>
                    <IconChevronDown size={14} color="var(--ds-gray-400)" />
                  </Group>
                </UnstyledButton>
              </Menu.Target>
              <Menu.Dropdown>
                <Stack gap={0} px="sm" py="xs">
                  <Text size="sm" fw={600} truncate>
                    {CURRENT_USER.name}
                  </Text>
                  <Text size="xs" c="dimmed" truncate>
                    {CURRENT_USER.email}
                  </Text>
                </Stack>
                <Divider my={4} />
                <Menu.Label>Profile Settings</Menu.Label>
                <Menu.Item leftSection={<IconUser size={14} />} disabled>
                  Account details
                </Menu.Item>
                <Menu.Item leftSection={<IconSettings size={14} />} disabled>
                  Workspace Settings
                </Menu.Item>
                <Divider my="xs" />
                <Menu.Item color="red" leftSection={<IconLogout size={14} />}>
                  Logout
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </header>
        <main className={styles.shellContent}>{children}</main>
      </div>
    </div>
  );
}
