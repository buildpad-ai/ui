/**
 * Authenticated App Shell
 *
 * A modern, token-styled application shell: glass-blur header with a
 * breadcrumb + optional search/notification affordances, a sidebar with
 * brand, primary navigation, and a bottom user-profile menu.
 *
 * This is the recommended wrapper for your own app pages (dashboards,
 * custom screens). For schema-driven collection browsing under /content/*,
 * use ContentLayout + ContentNavigation instead — do NOT nest this shell
 * around those routes or you'll get duplicate chrome.
 *
 * Styling lives in app/globals.css under the `.bp-*` namespace.
 *
 * @buildpad/origin: components/layout/AuthenticatedShell
 * @buildpad/version: 1.0.0
 */

"use client";

import { ColorSchemeToggle } from "@/components/ColorSchemeToggle";
import {
  ActionIcon,
  AppShell,
  Avatar,
  Burger,
  Divider,
  Group,
  Menu,
  Stack,
  Text,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconBell,
  IconChevronDown,
  IconLogout,
  IconSearch,
  IconSettings,
  IconUser,
  type IconProps,
} from "@tabler/icons-react";
import { NAV_ITEMS } from "./navigation";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";

interface AuthUser {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar: string | null;
}

export interface NavItem {
  label: string;
  href: string;
  icon: ComponentType<IconProps>;
  /**
   * Sidebar group this entry belongs to (e.g. "Administration"). Entries
   * without a section render under "Main Menu"; groups appear in the order
   * their first entry appears in the nav list.
   */
  section?: string;
}

export interface ShellBrand {
  /** Full workspace / app name shown next to the brand mark. */
  name: string;
  /** Single letter shown inside the gradient brand mark. */
  initial: string;
}

interface AuthenticatedShellProps {
  children: ReactNode;
  /**
   * Primary sidebar navigation. Defaults to NAV_ITEMS from
   * `./navigation` — the file the CLI extends when you install route
   * modules (e.g. `buildpad add users-routes`).
   */
  navItems?: NavItem[];
  /** Brand mark + name. Defaults to NEXT_PUBLIC_APP_NAME (or "Buildpad"). */
  brand?: ShellBrand;
  /** Show the (presentational) header search affordance. */
  showSearch?: boolean;
  /** Show the (presentational) header notification bell. */
  showNotifications?: boolean;
}

// Default nav lives in ./navigation — the CLI appends route-module entries
// there on install, so new modules appear in the sidebar automatically.
const DEFAULT_NAV_ITEMS: NavItem[] = NAV_ITEMS;

function defaultBrand(): ShellBrand {
  const name = process.env.NEXT_PUBLIC_APP_NAME ?? "Buildpad";
  return { name, initial: name.charAt(0).toUpperCase() || "B" };
}

function getInitials(user: AuthUser | null): string {
  if (!user) return "U";

  const fullName = `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim();
  if (fullName) {
    return fullName
      .split(" ")
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("");
  }

  return user.email?.charAt(0).toUpperCase() ?? "U";
}

export function AuthenticatedShell({
  children,
  navItems = DEFAULT_NAV_ITEMS,
  brand = defaultBrand(),
  showSearch = true,
  showNotifications = true,
}: AuthenticatedShellProps) {
  const pathname = usePathname();
  const [mobileOpened, { toggle: toggleMobile, close: closeMobile }] =
    useDisclosure(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadUser = async () => {
      try {
        const response = await fetch("/api/auth/user", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const payload = await response.json();
        const data = payload?.data;

        if (isMounted && data) {
          setUser({
            id: String(data.id ?? ""),
            email: data.email ?? null,
            first_name: data.first_name ?? null,
            last_name: data.last_name ?? null,
            avatar: data.avatar ?? null,
          });
        }
      } catch {
        // Keep shell usable when profile endpoint is unavailable.
      }
    };

    void loadUser();

    return () => {
      isMounted = false;
    };
  }, []);

  // Group nav entries by section (default "Main Menu"), preserving the order
  // in which each section first appears.
  const navGroups = useMemo(() => {
    const groups: Array<{ section: string; items: NavItem[] }> = [];
    for (const item of navItems) {
      const section = item.section ?? "Main Menu";
      let group = groups.find((g) => g.section === section);
      if (!group) {
        group = { section, items: [] };
        groups.push(group);
      }
      group.items.push(item);
    }
    return groups;
  }, [navItems]);

  const pageTitle = useMemo(() => {
    const active = navItems.find(
      (item) =>
        pathname === item.href || pathname.startsWith(`${item.href}/`)
    );
    if (active) return active.label;
    // Routes that aren't in the sidebar (e.g. /forms from the forms module)
    // still get a meaningful crumb from the first path segment, instead of
    // repeating the brand name.
    const segment = pathname.split("/").filter(Boolean)[0];
    if (!segment) return brand.name;
    const words = segment.replace(/[-_]+/g, " ");
    return words.charAt(0).toUpperCase() + words.slice(1);
  }, [pathname, navItems, brand.name]);

  const displayName =
    `${user?.first_name ?? ""} ${user?.last_name ?? ""}`.trim() ||
    user?.email ||
    "Account";

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{
        width: 260,
        breakpoint: "sm",
        collapsed: { mobile: !mobileOpened },
      }}
      padding="lg"
    >
      <AppShell.Header className="bp-header">
        <Group h="100%" px="md" justify="space-between" align="center">
          <Group gap="sm">
            <Burger
              opened={mobileOpened}
              onClick={toggleMobile}
              hiddenFrom="sm"
              size="sm"
            />
            <Group gap="xs" style={{ display: "flex", alignItems: "center" }}>
              <Text size="sm" c="dimmed" fw={500}>
                {brand.name}
              </Text>
              <Text size="sm" c="dimmed" fw={500}>
                /
              </Text>
              <Text size="sm" fw={600}>
                {pageTitle}
              </Text>
            </Group>
          </Group>

          <Group gap="md">
            {/* Presentational only — wire these up to your own search /
                notification features when ready. */}
            {showSearch && (
              <UnstyledButton className="bp-search-button">
                <Group gap="xs" wrap="nowrap">
                  <IconSearch size={14} stroke={1.8} />
                  <Text size="xs">Search…</Text>
                </Group>
                <span className="bp-search-kbd">⌘K</span>
              </UnstyledButton>
            )}

            {showNotifications && (
              <Tooltip label="Notifications">
                <div className="bp-notification-bell">
                  <ActionIcon
                    variant="subtle"
                    size="lg"
                    aria-label="Notifications"
                    color="gray"
                  >
                    <IconBell size={20} stroke={1.8} />
                  </ActionIcon>
                  <div className="bp-notification-dot" />
                </div>
              </Tooltip>
            )}

            <ColorSchemeToggle />
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="sm" className="bp-navbar">
        {/* Navigation & branding stack */}
        <Stack gap={4} style={{ flex: 1, width: "100%" }}>
          <div className="bp-brand-container">
            <div className="bp-brand-icon">{brand.initial}</div>
            <Stack gap={0}>
              <Text fw={700} size="sm" style={{ lineHeight: 1.2 }}>
                {brand.name}
              </Text>
              <Text size="xs" c="dimmed" style={{ lineHeight: 1 }}>
                Workspace
              </Text>
            </Stack>
          </div>

          {navGroups.map((group, groupIndex) => (
            <div key={group.section}>
              <Text
                size="xs"
                fw={700}
                c="dimmed"
                px="xs"
                mb={4}
                mt={groupIndex > 0 ? "md" : 0}
                style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}
              >
                {group.section}
              </Text>

              <Stack gap={4}>
                {group.items.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    pathname.startsWith(`${item.href}/`);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`bp-nav-link ${
                        isActive ? "bp-nav-link-active" : ""
                      }`}
                      onClick={closeMobile}
                    >
                      <Icon size={18} stroke={1.8} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </Stack>
            </div>
          ))}
        </Stack>

        {/* User profile section at the bottom */}
        <Stack
          gap={0}
          pt="sm"
          style={{
            borderTop: "1px solid var(--ds-border-color)",
            width: "100%",
          }}
        >
          <Menu position="right-end" offset={12} withArrow shadow="md" width={220}>
            <Menu.Target>
              <UnstyledButton className="bp-user-profile-button">
                <Group gap="xs" wrap="nowrap">
                  <Avatar
                    radius="xl"
                    size="sm"
                    src={user?.avatar ?? undefined}
                    style={{ border: "2px solid var(--ds-primary-200)" }}
                  >
                    {getInitials(user)}
                  </Avatar>
                  <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      size="sm"
                      fw={600}
                      lineClamp={1}
                      style={{ lineHeight: 1.2 }}
                    >
                      {displayName}
                    </Text>
                    <Text
                      c="dimmed"
                      size="xs"
                      lineClamp={1}
                      style={{ lineHeight: 1 }}
                    >
                      {user?.email ?? "Signed in"}
                    </Text>
                  </Stack>
                  <IconChevronDown size={14} color="var(--ds-gray-400)" />
                </Group>
              </UnstyledButton>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>Profile Settings</Menu.Label>
              <Menu.Item leftSection={<IconUser size={14} />} disabled>
                Account details
              </Menu.Item>
              <Menu.Item leftSection={<IconSettings size={14} />} disabled>
                Workspace Settings
              </Menu.Item>
              <Divider my="xs" />
              <Menu.Item
                color="red"
                leftSection={<IconLogout size={14} />}
                onClick={() => {
                  window.location.href = "/api/auth/logout";
                }}
              >
                Logout
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
