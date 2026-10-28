'use client';

import {
  ActionIcon,
  Alert,
  Avatar,
  Burger,
  Button,
  Card,
  Divider,
  Group,
  Menu,
  Select,
  Stack,
  Text,
  Title,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconAlertCircle,
  IconBell,
  IconChevronDown,
  IconDashboard,
  IconHome,
  IconLanguage,
  IconLogout,
  IconMoon,
  IconSearch,
  IconSettings,
  IconSun,
  IconUser,
} from '@tabler/icons-react';
import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { AppShellFrame } from '../AppShellFrame';
import { Gallery } from '../Gallery';
import { BrowserFrame, Specimen, SpecimenGrid } from '../Layout';
import { APP, CURRENT_USER, NAV_ITEMS, type NavItem } from '../data';
import styles from './app-shell.module.css';

/** Copy as shipped in lib/i18n/dictionaries/en.json (app.home.*, app.shell.*). */
const HOME = {
  welcome: 'Welcome',
  intro:
    "You're signed in. This is your app home, rendered inside the AuthenticatedShell. Customize the sidebar nav and brand in app/[lang]/(authenticated)/layout.tsx.",
  nextSteps: 'Next steps',
  installHint:
    'Install components with npx buildpad add, then build your screens under app/[lang]/(authenticated)/.',
  primaryAction: 'Primary Action',
  secondaryAction: 'Secondary Action',
};

/** The root entry components/layout/navigation.ts ships with. */
const HOME_ITEM: NavItem = { label: 'Home', href: '/', icon: IconHome };

/**
 * The mock app's nav, led by the shipped Home entry; Dashboard moves to its
 * own icon so the two entries stay distinguishable.
 */
const SHELL_NAV: NavItem[] = NAV_ITEMS.some((item) => item.href === HOME_ITEM.href)
  ? NAV_ITEMS
  : [
      HOME_ITEM,
      ...NAV_ITEMS.map((item) =>
        item.href === '/dashboard' && item.icon === IconHome ? { ...item, icon: IconDashboard } : item,
      ),
    ];

const ACTIVE = HOME_ITEM.href;
const PAGE_TITLE = HOME_ITEM.label;

/** lib/i18n/config.ts after `buildpad init --locales en,id`. */
const LOCALES = [
  { value: 'en', label: 'English' },
  { value: 'id', label: 'Bahasa Indonesia' },
];

/** What GET /api/scope/available returns for a user in two scopes. */
const SCOPES = [
  { value: '/apac', label: 'Region: APAC' },
  { value: '/emea', label: 'Region: EMEA' },
];

/**
 * Pinned-open overlays keep their declared side and stay in place: no
 * portal, flip, shift, focus trap or hide-when-detached.
 */
const PINNED_FLOATING = {
  withinPortal: false,
  middlewares: { flip: false, shift: false },
} as const;

function noop() {}

/** app/[lang]/(authenticated)/page.tsx — the home page `buildpad init` writes. */
function HomeContent() {
  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>{HOME.welcome}</Title>
        <Text c="dimmed" mt="xs">
          {HOME.intro}
        </Text>
      </div>
      <Card withBorder padding="lg">
        <Stack gap="sm">
          <Title order={4}>{HOME.nextSteps}</Title>
          <Text size="sm" c="dimmed">
            {HOME.installHint}
          </Text>
          <Group>
            <Button>{HOME.primaryAction}</Button>
            <Button variant="light" color="secondary">
              {HOME.secondaryAction}
            </Button>
          </Group>
        </Stack>
      </Card>
    </Stack>
  );
}

function groupBySection(items: NavItem[]) {
  const groups: Array<{ section: string; items: NavItem[] }> = [];
  for (const item of items) {
    const section = item.section ?? 'Main Menu';
    let group = groups.find((g) => g.section === section);
    if (!group) {
      group = { section, items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups;
}

function SectionLabel({ children, first }: { children: ReactNode; first: boolean }) {
  return (
    <Text
      size="xs"
      fw={700}
      c="dimmed"
      px="xs"
      mb={4}
      mt={first ? 0 : 'md'}
      style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}
    >
      {children}
    </Text>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <a
      href="#"
      onClick={(e) => e.preventDefault()}
      className={`bp-nav-link ${active ? 'bp-nav-link-active' : ''}`}
      aria-current={active ? 'page' : undefined}
    >
      <Icon size={18} stroke={1.8} />
      <span>{item.label}</span>
    </a>
  );
}

function NavSections({ items = SHELL_NAV }: { items?: NavItem[] }) {
  return (
    <>
      {groupBySection(items).map((group, index) => (
        <div key={group.section}>
          <SectionLabel first={index === 0}>{group.section}</SectionLabel>
          <Stack gap={4}>
            {group.items.map((item) => (
              <NavLink key={item.href} item={item} active={item.href === ACTIVE} />
            ))}
          </Stack>
        </div>
      ))}
    </>
  );
}

function BrandTile() {
  return (
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
  );
}

/** Spreads the props Menu.Target injects (ref, click and aria handlers). */
const ProfileButton = forwardRef<HTMLButtonElement, ComponentPropsWithoutRef<'button'>>(
  function ProfileButton(props, ref) {
    return (
      <UnstyledButton {...props} ref={ref} className="bp-user-profile-button">
        <Group gap="xs" wrap="nowrap">
          <Avatar radius="xl" size="sm" style={{ border: '2px solid var(--ds-primary-200)' }}>
            {CURRENT_USER.initials}
          </Avatar>
          <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
            <Text size="sm" fw={600} lineClamp={1} style={{ lineHeight: 1.2 }}>
              {CURRENT_USER.name}
            </Text>
            <Text c="dimmed" size="xs" lineClamp={1} style={{ lineHeight: 1 }}>
              {CURRENT_USER.email}
            </Text>
          </Stack>
          <IconChevronDown size={14} color="var(--ds-gray-400)" />
        </Group>
      </UnstyledButton>
    );
  },
);

function ProfileMenuItems() {
  return (
    <>
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
    </>
  );
}

/** The bottom-of-sidebar profile block with its working menu. */
function ProfileFooter() {
  return (
    <Stack gap={0} pt="sm" style={{ borderTop: '1px solid var(--ds-border-color)', width: '100%' }}>
      <Menu position="right-end" offset={12} withArrow shadow="md" width={220}>
        <Menu.Target>
          <ProfileButton />
        </Menu.Target>
        <Menu.Dropdown>
          <ProfileMenuItems />
        </Menu.Dropdown>
      </Menu>
    </Stack>
  );
}

function Breadcrumb() {
  return (
    <Group gap="xs" wrap="nowrap">
      <Text size="sm" c="dimmed" fw={500}>
        {APP.name}
      </Text>
      <Text size="sm" c="dimmed" fw={500}>
        /
      </Text>
      <Text size="sm" fw={600}>
        {PAGE_TITLE}
      </Text>
    </Group>
  );
}

function SearchButton() {
  return (
    <UnstyledButton className="bp-search-button">
      <Group gap="xs" wrap="nowrap">
        <IconSearch size={14} stroke={1.8} />
        <Text size="xs">Search…</Text>
      </Group>
      <span className="bp-search-kbd">⌘K</span>
    </UnstyledButton>
  );
}

function NotificationBell({ pinned = false }: { pinned?: boolean }) {
  const tooltip = pinned ? { ...PINNED_FLOATING, opened: true, position: 'bottom' as const } : {};
  return (
    <Tooltip label="Notifications" {...tooltip}>
      <div className="bp-notification-bell">
        <ActionIcon variant="subtle" size="lg" color="gray" aria-label="Notifications">
          <IconBell size={20} stroke={1.8} />
        </ActionIcon>
        <div className="bp-notification-dot" />
      </div>
    </Tooltip>
  );
}

function ThemeToggle({ dark = false }: { dark?: boolean }) {
  return (
    <Tooltip label={dark ? 'Light mode' : 'Dark mode'}>
      <ActionIcon variant="subtle" size="lg" color="gray" aria-label="Toggle color scheme">
        {dark ? <IconSun size={20} /> : <IconMoon size={20} />}
      </ActionIcon>
    </Tooltip>
  );
}

/** components/LanguageSwitcher.tsx: rendered once more than one locale is set. */
function LanguageSwitcher() {
  return (
    <Select
      size="xs"
      w={150}
      aria-label="Language"
      leftSection={<IconLanguage size={14} stroke={1.8} />}
      allowDeselect={false}
      data={LOCALES}
      defaultValue="en"
    />
  );
}

/** scope-routes' ScopeSwitcher for a user with more than one scope. */
function ScopeSwitcher() {
  return (
    <Select
      size="sm"
      w={220}
      aria-label="Scope"
      placeholder="Select scope…"
      allowDeselect={false}
      data={SCOPES}
      defaultValue="/apac"
    />
  );
}

function FrameCaption({ children }: { children: ReactNode }) {
  return <p className={styles.frameLabel}>{children}</p>;
}

/** The authenticated home page inside the full shell. */
export function AppShellHome() {
  return (
    <Gallery>
      <BrowserFrame url="/en" height={780}>
        <AppShellFrame active={ACTIVE} title={PAGE_TITLE}>
          <HomeContent />
        </AppShellFrame>
      </BrowserFrame>
      <FrameCaption>
        <strong>Home, desktop.</strong> The sidebar (<code>.bp-navbar</code>, 260px in the app) and the 60px glass header
        (<code>.bp-header</code>) around <code>AppShell.Main</code>. The page itself is the whole
        generated home: a <code>Title</code>, an intro and one <code>Card</code> with the ink CTA beside a{' '}
        <code>variant=&quot;light&quot; color=&quot;secondary&quot;</code> button. See the Dashboard
        template for a populated screen.
      </FrameCaption>
    </Gallery>
  );
}

/** Zoomed parts of the shell header. */
export function ShellHeaderAnatomy() {
  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        <Specimen
          span="full"
          surface="muted"
          label="Header bar"
          note={
            <>
              <code>.bp-header</code>: 60px, <code>backdrop-filter: blur(12px)</code> over an 80% white
              (75% ink in dark) fill with a hairline <code>--ds-border-color</code> bottom edge. It stays
              pinned while the page scrolls under it.
            </>
          }
        >
          <div className={styles.slice}>
            <div className={`bp-header ${styles.headerStrip}`}>
              <Breadcrumb />
              <Group gap="md" wrap="nowrap">
                <SearchButton />
                <NotificationBell />
                <ThemeToggle />
              </Group>
            </div>
          </div>
        </Specimen>

        <Specimen
          span="full"
          surface="muted"
          label="Multi-locale, multi-scope workspace"
          note={
            <>
              A <code>ScopeSwitcher</code> passed through <code>headerActions</code> (a{' '}
              <code>size=&quot;sm&quot;</code> <code>Select</code>, 220px wide), then the{' '}
              <code>LanguageSwitcher</code> the shell adds once <code>buildpad init --locales</code> sets
              more than one locale (<code>size=&quot;xs&quot;</code>, 150px, language icon). The scope
              select hides itself when the user has a single scope. The search pill is left out here so
              the strip fits.
            </>
          }
        >
          <div className={styles.slice}>
            <div className={`bp-header ${styles.headerStrip}`}>
              <Breadcrumb />
              <Group gap="md" wrap="nowrap">
                <NotificationBell />
                <ScopeSwitcher />
                <LanguageSwitcher />
                <ThemeToggle />
              </Group>
            </div>
          </div>
        </Specimen>

        <Specimen
          label="1 · Breadcrumb"
          note={
            <>
              Brand name, then the active nav item&apos;s label in <code>fw=600</code>. Routes outside the
              sidebar fall back to their first path segment, title-cased.
            </>
          }
        >
          <Group justify="center">
            <Breadcrumb />
          </Group>
        </Specimen>

        <Specimen
          label="2 · Search ⌘K"
          note={
            <>
              <code>.bp-search-button</code>: a pill on <code>--ds-gray-50</code> with a mono{' '}
              <code>.bp-search-kbd</code> hint. It is presentational only, so wire it to your own search.
              It is hidden at 768px and below; turn it off with <code>showSearch=&#123;false&#125;</code>.
            </>
          }
        >
          <Group justify="center">
            <SearchButton />
          </Group>
        </Specimen>

        <Specimen
          label="3 · Notifications"
          note={
            <>
              Subtle gray <code>ActionIcon</code> with a <code>--ds-danger-500</code> dot ringed in the
              surface colour, and a <code>Tooltip</code> (pinned open here). Turn it off with{' '}
              <code>showNotifications=&#123;false&#125;</code>.
            </>
          }
        >
          <div className={styles.tooltipRoom}>
            <NotificationBell pinned />
          </div>
        </Specimen>

        <Specimen
          label="4 · Theme toggle"
          note={
            <>
              <code>ColorSchemeToggle</code>: shows a moon in light mode and a sun in dark mode. Its
              tooltip names the scheme it switches to. Hover the icons to see it.
            </>
          }
        >
          <div className={styles.toggleStates}>
            <div className={styles.toggleState}>
              <ThemeToggle />
              <Text size="xs" c="dimmed">
                In light mode
              </Text>
            </div>
            <div className={styles.toggleState}>
              <ThemeToggle dark />
              <Text size="xs" c="dimmed">
                In dark mode
              </Text>
            </div>
          </div>
        </Specimen>

        <Specimen
          span="full"
          label="No scope access"
          note={
            <>
              When the user is assigned to no scope, <code>ScopeSwitcher</code> renders a compact{' '}
              <code>color=&quot;orange&quot;</code> <code>Alert</code> (<code>p=&quot;xs&quot;</code>) in its
              place. A failed scope request shows the same alert in red.
            </>
          }
        >
          <Group justify="center">
            <Alert color="orange" icon={<IconAlertCircle size={16} />} p="xs">
              No scope assigned — contact your administrator.
            </Alert>
          </Group>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

/** Zoomed parts of the shell sidebar. */
export function ShellSidebarAnatomy() {
  const mainItems = SHELL_NAV.filter((item) => !item.section).slice(0, 3);
  return (
    <Gallery>
      <SpecimenGrid cols={3}>
        <Specimen
          surface="muted"
          label="5 · Brand tile"
          note={
            <>
              <code>.bp-brand-icon</code>: the initial on the fixed <code>--ds-brand-mark</code> ember
              gradient with <code>--ds-cta-shadow</code>. The name is set in Inter Tight. Change it with
              the <code>brand</code> prop.
            </>
          }
        >
          <div className={`${styles.slice} ${styles.navSlice}`}>
            <div className={`bp-navbar ${styles.navColumn}`}>
              <BrandTile />
            </div>
          </div>
        </Specimen>

        <Specimen
          surface="muted"
          label="6 · Sections & links"
          note={
            <>
              Uppercase dimmed section labels. <code>.bp-nav-link</code> hovers to{' '}
              <code>--ds-gray-100</code>. The active link gets a <code>--ds-primary-50</code> wash, a
              hairline <code>--ds-primary-200</code> ring and an ember icon.
            </>
          }
        >
          <div className={`${styles.slice} ${styles.navSlice}`}>
            <div className={`bp-navbar ${styles.navColumn}`}>
              <NavSections items={mainItems} />
            </div>
          </div>
        </Specimen>

        <Specimen
          surface="muted"
          label="7 · Profile button"
          note={
            <>
              <code>.bp-user-profile-button</code> above a hairline. The <code>Avatar</code> takes no{' '}
              <code>color</code>, so it is the default gray with a <code>--ds-primary-200</code> ring. Click it to open the account menu.
            </>
          }
        >
          <div className={`${styles.slice} ${styles.navSlice}`}>
            <div className={`bp-navbar ${styles.navColumn}`}>
              <ProfileFooter />
            </div>
          </div>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

/** The sidebar's account menu, pinned open. */
export function ShellProfileMenu() {
  return (
    <Gallery>
      <SpecimenGrid cols={1}>
        <Specimen
          surface="muted"
          align="start"
          label="Profile menu"
          note={
            <>
              <code>Menu position=&quot;right-end&quot; offset=&#123;12&#125; withArrow shadow=&quot;md&quot;
              width=&#123;220&#125;</code>. Account details and Workspace Settings ship{' '}
              <code>disabled</code> until you build those screens. Logout is a{' '}
              <code>color=&quot;red&quot;</code> item that calls <code>/api/auth/logout</code>.
            </>
          }
        >
          <div className={styles.menuStage}>
            <div className={`bp-navbar ${styles.navColumn} ${styles.menuColumn}`}>
              <BrandTile />
              <Stack gap={0} pt="sm" style={{ borderTop: '1px solid var(--ds-border-color)', width: '100%' }}>
                <Menu
                  {...PINNED_FLOATING}
                  opened
                  onChange={noop}
                  hideDetached={false}
                  trapFocus={false}
                  returnFocus={false}
                  closeOnItemClick={false}
                  position="right-end"
                  offset={12}
                  withArrow
                  shadow="md"
                  width={220}
                >
                  <Menu.Target>
                    <ProfileButton />
                  </Menu.Target>
                  <Menu.Dropdown>
                    <ProfileMenuItems />
                  </Menu.Dropdown>
                </Menu>
              </Stack>
            </div>
          </div>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

function PhoneShell({ initiallyOpen = false }: { initiallyOpen?: boolean }) {
  const [opened, { toggle }] = useDisclosure(initiallyOpen);
  return (
    <div className={styles.phone}>
      <header className={`bp-header ${styles.phoneHeader}`}>
        <Group gap="sm" wrap="nowrap">
          <Burger opened={opened} onClick={toggle} size="sm" aria-label="Toggle navigation" />
          <Breadcrumb />
        </Group>
        <Group gap="xs" wrap="nowrap">
          <NotificationBell />
          <ThemeToggle />
        </Group>
      </header>
      <div className={styles.phoneBody}>
        <main className={styles.phoneMain}>
          <HomeContent />
        </main>
        {opened && (
          <nav className={`bp-navbar ${styles.phoneNavbar}`} aria-label="Main navigation">
            <Stack gap={4} style={{ flex: 1, width: '100%' }}>
              <BrandTile />
              <NavSections />
            </Stack>
            <ProfileFooter />
          </nav>
        )}
      </div>
    </div>
  );
}

/** The shell at phone width: collapsed, and with the navbar open. */
export function ShellOnPhone() {
  return (
    <Gallery>
      <div className={styles.phones}>
        <div>
          <BrowserFrame url="/en" height={860}>
            <PhoneShell />
          </BrowserFrame>
          <FrameCaption>
            <strong>Collapsed.</strong> Below <code>sm</code> the sidebar is hidden and a{' '}
            <code>Burger</code> leads the header. The search pill drops out at 768px and below. Tap the
            burger to open the navigation.
          </FrameCaption>
        </div>
        <div>
          <BrowserFrame url="/en" height={860}>
            <PhoneShell initiallyOpen />
          </BrowserFrame>
          <FrameCaption>
            <strong>Navigation open.</strong> <code>AppShell.Navbar</code> fills the width under the
            header, with the same brand tile, sections and profile menu. In the app, choosing a link closes it.
          </FrameCaption>
        </div>
      </div>
    </Gallery>
  );
}
