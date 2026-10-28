'use client';

import {
  ActionIcon,
  Anchor,
  Avatar,
  Badge,
  Box,
  Breadcrumbs,
  Burger,
  Button,
  Group,
  NavLink,
  Pagination,
  Paper,
  SegmentedControl,
  Select,
  Stack,
  Stepper,
  Table,
  TableOfContents,
  Tabs,
  Text,
  Title,
  UnstyledButton,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconActivity,
  IconBell,
  IconChartBar,
  IconChecklist,
  IconChevronDown,
  IconChevronRight,
  IconExternalLink,
  IconFileInvoice,
  IconHome,
  IconLock,
  IconMessageCircle,
  IconPaperclip,
  IconSearch,
  IconSettings,
  IconTruckDelivery,
  IconUser,
  IconX,
} from '@tabler/icons-react';
import { useEffect, useId, useState, type MouseEvent, type ReactNode } from 'react';
import { Gallery } from '../Gallery';
import { Specimen, SpecimenGrid } from '../Layout';
import { APP, CURRENT_USER, NAV_ITEMS, ORDERS, ORDER_STATUS, formatMoney } from '../data';
import styles from './navigation.module.css';

const ORDER = ORDERS[0];

const PAGINATION_CONTROL_LABELS = {
  first: 'First page',
  previous: 'Previous page',
  next: 'Next page',
  last: 'Last page',
} as const;

const paginationControlProps = (control: keyof typeof PAGINATION_CONTROL_LABELS) => ({
  'aria-label': PAGINATION_CONTROL_LABELS[control],
});

function RecordTabs({
  variant,
  orientation,
  placement,
  grow,
}: {
  variant?: 'default' | 'outline' | 'pills';
  orientation?: 'horizontal' | 'vertical';
  placement?: 'left' | 'right';
  grow?: boolean;
}) {
  const panel = (children: ReactNode) => (
    <Text size="sm" c="dimmed" p="md">
      {children}
    </Text>
  );
  return (
    <Tabs defaultValue="overview" variant={variant} orientation={orientation} placement={placement}>
      <Tabs.List grow={grow}>
        <Tabs.Tab value="overview" leftSection={<IconFileInvoice size={16} />}>
          Overview
        </Tabs.Tab>
        <Tabs.Tab
          value="comments"
          leftSection={<IconMessageCircle size={16} />}
          rightSection={
            <Badge size="xs" circle>
              4
            </Badge>
          }
        >
          Comments
        </Tabs.Tab>
        <Tabs.Tab value="activity" leftSection={<IconActivity size={16} />}>
          Activity
        </Tabs.Tab>
        <Tabs.Tab value="audit" leftSection={<IconLock size={16} />} disabled>
          Audit log
        </Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="overview">
        {panel(`${ORDER.number} · ${ORDER.supplier} · ${formatMoney(ORDER.amount)}`)}
      </Tabs.Panel>
      <Tabs.Panel value="comments">{panel('4 comments from Finance and Fulfilment.')}</Tabs.Panel>
      <Tabs.Panel value="activity">{panel('Submitted by Daniel Osei · 1 hour ago.')}</Tabs.Panel>
    </Tabs>
  );
}

/** Tabs in the three variants, with icons, a badge counter and a disabled tab. */
export function TabsVariants() {
  return (
    <Gallery>
      <SpecimenGrid cols={1}>
        <Specimen
          label="Default"
          align="start"
          note={
            <>
              <code>variant=&quot;default&quot;</code> — the record-page tabs. Active tab is ink
              text on an ember underline (<code>--ds-primary-600</code>); hover tints{' '}
              <code>--ds-gray-100</code>. &ldquo;Audit log&rdquo; is <code>disabled</code>.
            </>
          }
        >
          <RecordTabs />
        </Specimen>
        <Specimen
          label="Outline"
          align="start"
          note={
            <>
              <code>variant=&quot;outline&quot;</code> — the active tab joins the panel with a
              hairline border; use it above a bordered surface.
            </>
          }
        >
          <RecordTabs variant="outline" />
        </Specimen>
        <Specimen
          label="Pills"
          align="start"
          note={
            <>
              <code>variant=&quot;pills&quot;</code> — the active pill fills with the primary
              (ember) colour and keeps the ink label set in globals.css. Counters are{' '}
              <code>Badge size=&quot;xs&quot; circle</code> in <code>rightSection</code>.
            </>
          }
        >
          <RecordTabs variant="pills" />
        </Specimen>
        <Specimen
          label="Grow"
          align="start"
          note={
            <>
              <code>Tabs.List grow</code> — tabs share the full width, e.g. in a drawer or narrow
              card.
            </>
          }
        >
          <RecordTabs grow />
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

/** Vertical tabs, left and right placement — settings-style navigation. */
export function TabsVertical() {
  return (
    <Gallery>
      <SpecimenGrid cols={1}>
        <Specimen
          label="Vertical"
          align="start"
          note={
            <>
              <code>orientation=&quot;vertical&quot;</code> — the underline moves to the inner edge.
              Good for settings pages with many sections.
            </>
          }
        >
          <RecordTabs orientation="vertical" />
        </Specimen>
        <Specimen
          label="Vertical, placement right"
          align="start"
          note={
            <>
              <code>placement=&quot;right&quot;</code> — tab list on the right of the panel,
              indicator on its left edge.
            </>
          }
        >
          <RecordTabs orientation="vertical" placement="right" />
        </Specimen>
        <Specimen
          label="Vertical pills"
          align="start"
          note={
            <>
              <code>variant=&quot;pills&quot; orientation=&quot;vertical&quot;</code>.
            </>
          }
        >
          <RecordTabs orientation="vertical" variant="pills" />
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

/** Breadcrumbs: default separator, chevrons, and a home icon root. */
export function BreadcrumbsDemo() {
  const link = (label: ReactNode) => (
    <Anchor href="#" onClick={(e) => e.preventDefault()} size="sm">
      {label}
    </Anchor>
  );
  const current = (
    <Text size="sm" fw={500} aria-current="page">
      {ORDER.number}
    </Text>
  );
  return (
    <Gallery>
      <SpecimenGrid cols={1}>
        <Specimen
          label="Default separator"
          note={
            <>
              Ancestors are <code>Anchor</code>s (<code>--ds-accent-text</code>
              ); the current page is plain <code>Text fw=500</code> with <code>aria-current</code>.
            </>
          }
        >
          <Breadcrumbs>
            {link(APP.name)}
            {link('Purchase orders')}
            {current}
          </Breadcrumbs>
        </Specimen>
        <Specimen
          label="Chevron separator, home icon"
          note={
            <>
              <code>separator=&#123;&lt;IconChevronRight /&gt;&#125;</code> with{' '}
              <code>separatorMargin=&quot;xs&quot;</code>; the root is an icon-only link with an{' '}
              <code>aria-label</code>.
            </>
          }
        >
          <Breadcrumbs separator={<IconChevronRight size={14} />} separatorMargin="xs">
            <Anchor
              href="#"
              onClick={(e) => e.preventDefault()}
              aria-label="Home"
              className={styles.iconLink}
            >
              <IconHome size={16} />
            </Anchor>
            {link('Suppliers')}
            {link('Atlas Packaging')}
            <Text size="sm" fw={500} aria-current="page">
              Contracts
            </Text>
          </Breadcrumbs>
        </Specimen>
        <Specimen
          label="Shell header crumb"
          note={
            <>
              The app header (<code>AuthenticatedShell</code>) uses dimmed <code>Text</code> crumbs
              with a slash and a semibold current title.
            </>
          }
        >
          <Breadcrumbs separator="/" separatorMargin="xs">
            <Text size="sm" c="dimmed" fw={500}>
              {APP.name}
            </Text>
            <Text size="sm" fw={600}>
              Purchase orders
            </Text>
          </Breadcrumbs>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

/** Pagination sizes, edges, siblings and the list footer used under tables. */
export function PaginationDemo() {
  const [page, setPage] = useState(3);
  const [footerPage, setFooterPage] = useState(1);
  const [limit, setLimit] = useState('20');
  const total = 128;
  const perPage = Number(limit);
  const totalPages = Math.ceil(total / perPage);
  const from = (footerPage - 1) * perPage + 1;
  const to = Math.min(footerPage * perPage, total);
  const [compactPage, setCompactPage] = useState(1);
  const compactFrom = (compactPage - 1) * 20 + 1;
  const compactTo = Math.min(compactPage * 20, total);

  return (
    <Gallery>
      <SpecimenGrid cols={1}>
        <Specimen
          label="Default"
          note={
            <>
              <code>Pagination total=&#123;10&#125;</code> — the active page fills with the primary
              colour; controls use <code>radius=&quot;sm&quot;</code> (8px).
            </>
          }
        >
          <Pagination
            getControlProps={paginationControlProps}
            total={10}
            value={page}
            onChange={setPage}
          />
        </Specimen>
        <Specimen
          label="Sizes"
          note={
            <>
              <code>size=&quot;xs&quot; | &quot;sm&quot; | &quot;md&quot;</code> — use{' '}
              <code>xs</code>/<code>sm</code> in dense tables and cards.
            </>
          }
        >
          <Stack gap="sm">
            {(['xs', 'sm', 'md'] as const).map((size) => (
              <Group key={size} gap="md" wrap="nowrap">
                <Text size="xs" c="dimmed" w={24}>
                  {size}
                </Text>
                <Pagination
                  getControlProps={paginationControlProps}
                  size={size}
                  total={10}
                  defaultValue={3}
                />
              </Group>
            ))}
          </Stack>
        </Specimen>
        <Specimen
          label="With edges"
          note={
            <>
              <code>withEdges</code> adds first / last controls.
            </>
          }
        >
          <Pagination
            getControlProps={paginationControlProps}
            total={20}
            defaultValue={8}
            withEdges
            size="sm"
          />
        </Specimen>
        <Specimen
          label="Siblings & boundaries"
          note={
            <>
              <code>siblings=&#123;2&#125; boundaries=&#123;2&#125;</code> on 40 pages — more
              context around the current page for long result sets.
            </>
          }
        >
          <Pagination
            getControlProps={paginationControlProps}
            total={40}
            defaultValue={20}
            siblings={2}
            boundaries={2}
            size="sm"
          />
        </Specimen>
        <SpecimenGrid cols={2}>
          <Specimen
            label="Disabled"
            note={
              <>
                <code>disabled</code> — e.g. while a page of rows is loading.
              </>
            }
          >
            <Pagination
              getControlProps={paginationControlProps}
              total={10}
              defaultValue={2}
              disabled
              size="sm"
            />
          </Specimen>
          <Specimen
            label="Previous / next only"
            note={
              <>
                <code>Pagination.Root</code> with <code>Previous</code> and <code>Next</code> — the
                compact &ldquo;1–20 of 128&rdquo; footer for cards and side panels.
              </>
            }
          >
            <Pagination.Root
              total={Math.ceil(total / 20)}
              value={compactPage}
              onChange={setCompactPage}
              size="sm"
            >
              <Group gap="sm" justify="center">
                <Text size="xs" c="dimmed">
                  {compactFrom}–{compactTo} of {total}
                </Text>
                <Group gap={4}>
                  <Pagination.Previous aria-label="Previous page" />
                  <Pagination.Next aria-label="Next page" />
                </Group>
              </Group>
            </Pagination.Root>
          </Specimen>
        </SpecimenGrid>
        <Specimen
          label="List footer"
          align="start"
          surface="muted"
          note={
            <>
              The <code>ListFooter</code> the CLI managers render under a table: &ldquo;Showing N of
              M&rdquo;, a page-size <code>Select size=&quot;xs&quot;</code> and{' '}
              <code>Pagination</code>, separated by <code>--ds-table-border</code>.
            </>
          }
        >
          <Paper withBorder className={styles.tableCard}>
            <Table withTableBorder={false} verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Order</Table.Th>
                  <Table.Th>Supplier</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th className={styles.numeric}>Amount</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {ORDERS.slice(0, 3).map((order) => (
                  <Table.Tr key={order.id}>
                    <Table.Td fw={500}>{order.number}</Table.Td>
                    <Table.Td>{order.supplier}</Table.Td>
                    <Table.Td>
                      <Badge color={ORDER_STATUS[order.status].color}>
                        {ORDER_STATUS[order.status].label}
                      </Badge>
                    </Table.Td>
                    <Table.Td className={styles.numeric}>{formatMoney(order.amount)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
            <Group justify="space-between" px="md" py="sm" className={styles.footer}>
              <Group gap="sm">
                <Text size="xs" c="dimmed">
                  Showing {from}–{to} of {total} orders
                </Text>
                <Select
                  size="xs"
                  w={110}
                  value={limit}
                  onChange={(value) => {
                    if (value) {
                      setLimit(value);
                      setFooterPage(1);
                    }
                  }}
                  data={['10', '20', '50'].map((n) => ({
                    value: n,
                    label: `${n} / page`,
                  }))}
                  aria-label="Items per page"
                  comboboxProps={{ withinPortal: true }}
                />
              </Group>
              <Pagination
                getControlProps={paginationControlProps}
                size="sm"
                siblings={0}
                value={footerPage}
                onChange={setFooterPage}
                total={totalPages}
              />
            </Group>
          </Paper>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

const APPROVAL_STEPS = [
  { label: 'Details' },
  { label: 'Budget check' },
  { label: 'Approval' },
  { label: 'Dispatch' },
];

/** Stepper: horizontal and vertical, completed / active / error / loading steps. */
export function StepperDemo() {
  const [active, setActive] = useState(2);
  const last = APPROVAL_STEPS.length;
  return (
    <Gallery>
      <SpecimenGrid cols={1}>
        <Specimen
          label="Horizontal"
          align="start"
          note={
            <>
              Completed steps fill with the primary colour and show a check; the active step has an
              ember ring. Steps are clickable (<code>onStepClick</code>) — try Back / Next.
            </>
          }
        >
          <Stepper active={active} onStepClick={setActive} size="sm">
            {APPROVAL_STEPS.map((step) => (
              <Stepper.Step key={step.label} label={step.label} />
            ))}
            <Stepper.Completed>
              <Text size="sm" c="dimmed" ta="center" mt="md">
                {ORDER.number} dispatched to {ORDER.supplier}.
              </Text>
            </Stepper.Completed>
          </Stepper>
          <Group justify="flex-end" gap="sm" mt="md">
            <Button
              variant="default"
              size="xs"
              onClick={() => setActive((s) => Math.max(0, s - 1))}
              disabled={active === 0}
            >
              Back
            </Button>
            <Button
              size="xs"
              onClick={() => setActive((s) => Math.min(last, s + 1))}
              disabled={active === last}
            >
              {active === last - 1 ? 'Finish' : 'Next'}
            </Button>
          </Group>
        </Specimen>
        <Specimen
          label="Error and loading steps"
          align="start"
          note={
            <>
              A rejected step: <code>color=&quot;red&quot;</code> (→ danger) with{' '}
              <code>completedIcon=&#123;&lt;IconX /&gt;&#125;</code>. The step in progress has{' '}
              <code>loading</code>.
            </>
          }
        >
          <Stack gap="xl">
            <Stepper active={2} size="sm">
              <Stepper.Step label="Details" description="Supplier & items" />
              <Stepper.Step
                label="Budget check"
                description="Over budget"
                color="red"
                completedIcon={<IconX size={18} />}
              />
              <Stepper.Step label="Approval" description="Blocked" />
            </Stepper>
            <Stepper active={1} size="sm">
              <Stepper.Step label="Upload" description="invoice.pdf" />
              <Stepper.Step label="Extract" description="Reading line items…" loading />
              <Stepper.Step label="Review" description="Match to PO" />
            </Stepper>
          </Stack>
        </Specimen>
        <SpecimenGrid cols={2}>
          <Specimen
            label="Vertical"
            align="start"
            note={
              <>
                <code>orientation=&quot;vertical&quot;</code> — order timelines and onboarding
                checklists.
              </>
            }
          >
            <Stepper active={2} orientation="vertical" size="sm">
              <Stepper.Step
                label="Order placed"
                description="Today, 09:42"
                icon={<IconChecklist size={16} />}
              />
              <Stepper.Step
                label="Approved"
                description="Priya Raman · 10:15"
                icon={<IconUser size={16} />}
              />
              <Stepper.Step
                label="In transit"
                description="Keystone Logistics"
                icon={<IconTruckDelivery size={16} />}
              />
              <Stepper.Step
                label="Delivered"
                description="Expected 04 Nov"
                icon={<IconHome size={16} />}
              />
            </Stepper>
          </Specimen>
          <Specimen
            label="Vertical, small"
            align="start"
            note={
              <>
                <code>size=&quot;xs&quot;</code> vertical — an onboarding checklist in a side panel.
              </>
            }
          >
            <Stepper active={1} orientation="vertical" size="xs">
              <Stepper.Step label="Create workspace" description="Done by Amelia" />
              <Stepper.Step label="Invite your team" description="2 of 5 accepted" />
              <Stepper.Step label="Connect data" description="DaaS collections" />
              <Stepper.Step label="Publish a form" description="Share with suppliers" />
            </Stepper>
          </Specimen>
        </SpecimenGrid>
        <Specimen
          label="Small, labels only"
          note={
            <>
              <code>size=&quot;xs&quot;</code> with <code>iconSize=&#123;28&#125;</code> and no
              descriptions — fits a modal header or wizard footer.
            </>
          }
        >
          <Stepper active={1} size="xs" iconSize={28}>
            <Stepper.Step label="Account" />
            <Stepper.Step label="Team" />
            <Stepper.Step label="Billing" />
            <Stepper.Step label="Review" />
          </Stepper>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

/** Mantine NavLink: icons, nested groups, active variants, descriptions, badges. */
export function NavLinkDemo() {
  const [active, setActive] = useState('/orders');
  const item = (href: string) => ({
    href: '#',
    active: active === href,
    onClick: (e: MouseEvent) => {
      e.preventDefault();
      setActive(href);
    },
  });
  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        <Specimen
          label="Icons, badge, nested"
          align="start"
          note={
            <>
              <code>leftSection</code> icon, <code>rightSection</code> badge, and a nested group via
              children (<code>defaultOpened</code>). The active link is the default{' '}
              <code>variant=&quot;light&quot;</code> — ember wash, 700 text. Click to move it.
            </>
          }
        >
          <Box className={styles.navColumn}>
            <NavLink
              label="Dashboard"
              leftSection={<IconHome size={18} />}
              {...item('/dashboard')}
            />
            <NavLink
              label="Purchase orders"
              leftSection={<IconChecklist size={18} />}
              rightSection={<Badge size="xs">12</Badge>}
              {...item('/orders')}
            />
            <NavLink
              label="Reports"
              leftSection={<IconChartBar size={18} />}
              childrenOffset={28}
              defaultOpened
              href="#"
            >
              <NavLink label="Monthly spend" {...item('/reports/spend')} />
              <NavLink label="Supplier scorecard" {...item('/reports/suppliers')} />
            </NavLink>
            <NavLink label="Settings" leftSection={<IconSettings size={18} />} disabled href="#" />
          </Box>
        </Specimen>
        <Specimen
          label="Variants & description"
          align="start"
          note={
            <>
              Active link in <code>variant=&quot;light&quot;</code>, <code>&quot;filled&quot;</code>{' '}
              and <code>&quot;subtle&quot;</code>; <code>description</code> adds a dimmed second
              line; a status badge uses <code>color=&quot;red&quot;</code> (→ danger);
              &ldquo;Archive&rdquo; is a collapsed group.
            </>
          }
        >
          <Box className={styles.navColumn}>
            <NavLink
              active
              label="Light (default)"
              leftSection={<IconChecklist size={18} />}
              href="#"
            />
            <NavLink
              active
              variant="filled"
              label="Filled"
              leftSection={<IconChecklist size={18} />}
              href="#"
            />
            <NavLink
              active
              variant="subtle"
              label="Subtle"
              leftSection={<IconChecklist size={18} />}
              href="#"
            />
            <NavLink
              label="Approvals"
              description="3 waiting on you"
              leftSection={<IconPaperclip size={18} />}
              rightSection={<IconChevronRight size={14} />}
              href="#"
            />
            <NavLink
              label="Overdue deliveries"
              leftSection={<IconTruckDelivery size={18} />}
              rightSection={
                <Badge size="xs" color="red">
                  7
                </Badge>
              }
              href="#"
            />
            <NavLink
              label="Archive"
              leftSection={<IconFileInvoice size={18} />}
              childrenOffset={28}
              href="#"
            >
              <NavLink label="2025" href="#" />
            </NavLink>
          </Box>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

/** The app sidebar's own links — the shipped `.bp-nav-link` classes. */
export function SidebarNavPreview() {
  const [active, setActive] = useState('/orders');
  const groups: Array<{ section: string; items: typeof NAV_ITEMS }> = [];
  for (const navItem of NAV_ITEMS.slice(0, 9)) {
    const section = navItem.section ?? 'Main Menu';
    let group = groups.find((g) => g.section === section);
    if (!group) {
      group = { section, items: [] };
      groups.push(group);
    }
    group.items.push(navItem);
  }
  const link = (navItem: (typeof NAV_ITEMS)[number], isActive: boolean, onSelect?: () => void) => {
    const Icon = navItem.icon;
    return (
      <a
        key={navItem.href}
        href="#"
        onClick={(e) => {
          e.preventDefault();
          onSelect?.();
        }}
        className={`bp-nav-link ${isActive ? 'bp-nav-link-active' : ''}`}
        aria-current={isActive ? 'page' : undefined}
      >
        <Icon size={18} stroke={1.8} />
        <span className={styles.grow}>{navItem.label}</span>
        {navItem.badge && (
          <Badge
            size="xs"
            variant={isActive ? 'filled' : 'light'}
            color={isActive ? 'primary' : 'gray'}
          >
            {navItem.badge}
          </Badge>
        )}
      </a>
    );
  };

  const profile = (
    <UnstyledButton className="bp-user-profile-button">
      <Group gap="xs" wrap="nowrap">
        <Avatar radius="xl" size="sm" color="primary">
          {CURRENT_USER.initials}
        </Avatar>
        <Stack gap={0} className={styles.profileText}>
          <Text size="sm" fw={600} lineClamp={1}>
            {CURRENT_USER.name}
          </Text>
          <Text c="dimmed" size="xs" lineClamp={1}>
            {CURRENT_USER.email}
          </Text>
        </Stack>
        <IconChevronDown size={14} className={styles.chevron} />
      </Group>
    </UnstyledButton>
  );

  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        <Specimen
          label="Sidebar"
          align="start"
          surface="muted"
          note={
            <>
              <code>.bp-navbar</code> + <code>.bp-nav-link</code> from the shipped globals.css, fed
              by <code>navigation.ts</code>. Section labels are xs uppercase dimmed text. Click a
              link to make it active.
            </>
          }
        >
          <div className={`bp-navbar ${styles.sidebar}`}>
            <Stack gap={4}>
              <div className="bp-brand-container">
                <div className="bp-brand-icon">{APP.initial}</div>
                <Stack gap={0}>
                  <Text fw={600} size="sm" className={styles.brandName}>
                    {APP.name}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {APP.workspace}
                  </Text>
                </Stack>
              </div>
              {groups.map((group, index) => (
                <div key={group.section}>
                  <Text
                    size="xs"
                    fw={700}
                    c="dimmed"
                    px="xs"
                    mb={4}
                    mt={index > 0 ? 'md' : 0}
                    tt="uppercase"
                    className={styles.sectionLabel}
                  >
                    {group.section}
                  </Text>
                  <Stack gap={4}>
                    {group.items.map((navItem) =>
                      link(navItem, navItem.href === active, () => setActive(navItem.href))
                    )}
                  </Stack>
                </div>
              ))}
            </Stack>
            <div className={styles.sidebarFooter}>{profile}</div>
          </div>
        </Specimen>
        <Specimen
          label="Link states"
          align="start"
          note={
            <>
              Idle: <code>--ds-ink-secondary</code> text. Hover: <code>--ds-gray-100</code> fill,
              ink text. Active (<code>.bp-nav-link-active</code>): <code>--ds-primary-50</code>{' '}
              wash, inset <code>--ds-primary-200</code> ring, semibold ink text, ember icon, filled
              count badge. Plus <code>.bp-user-profile-button</code>, <code>.bp-search-button</code>{' '}
              and <code>.bp-notification-dot</code>.
            </>
          }
        >
          <Stack gap="lg">
            {[
              { label: 'Idle', isActive: false },
              { label: 'Active', isActive: true },
            ].map(({ label, isActive }) => (
              <div key={label}>
                <Text size="xs" c="dimmed" fw={500} mb={6}>
                  {label}
                </Text>
                <Stack gap={4}>
                  {link(NAV_ITEMS[1], isActive)}
                  {link(NAV_ITEMS[2], isActive)}
                </Stack>
              </div>
            ))}
            <div>
              <Text size="xs" c="dimmed" fw={500} mb={6}>
                Profile (sidebar footer)
              </Text>
              {profile}
            </div>
            <div>
              <Text size="xs" c="dimmed" fw={500} mb={6}>
                Header search &amp; notifications
              </Text>
              <Group gap="sm" wrap="nowrap">
                <UnstyledButton className="bp-search-button">
                  <Group gap="xs" wrap="nowrap">
                    <IconSearch size={14} stroke={1.8} />
                    <Text size="xs">Search…</Text>
                  </Group>
                  <span className="bp-search-kbd">⌘K</span>
                </UnstyledButton>
                <div className="bp-notification-bell">
                  <ActionIcon variant="subtle" size="lg" color="gray" aria-label="Notifications">
                    <IconBell size={20} stroke={1.8} />
                  </ActionIcon>
                  <div className="bp-notification-dot" />
                </div>
              </Group>
            </div>
          </Stack>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

/** Anchor underline modes, sizes and inline use. */
export function AnchorDemo() {
  const prevent = (e: MouseEvent) => e.preventDefault();
  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        <Specimen
          label="Underline modes"
          note={
            <>
              <code>underline=&quot;hover&quot;</code> is the theme default;{' '}
              <code>&quot;always&quot;</code> and <code>&quot;never&quot;</code> are opt-in. Colour
              is <code>--ds-accent-text</code> (AA burnt ember).
            </>
          }
        >
          <Stack gap="xs">
            <Anchor href="#" onClick={prevent}>
              underline=&quot;hover&quot; (default)
            </Anchor>
            <Anchor href="#" onClick={prevent} underline="always">
              underline=&quot;always&quot;
            </Anchor>
            <Anchor href="#" onClick={prevent} underline="never">
              underline=&quot;never&quot;
            </Anchor>
          </Stack>
        </Specimen>
        <Specimen
          label="In prose, external, sizes"
          note={
            <>
              Inherits the paragraph size with <code>inherit</code>; external links pair an icon
              with <code>target=&quot;_blank&quot;</code>.
            </>
          }
        >
          <Stack gap="sm">
            <Text size="sm">
              Approved orders sync to the{' '}
              <Anchor href="#" onClick={prevent} inherit>
                finance ledger
              </Anchor>{' '}
              every hour.
            </Text>
            <Anchor href="#" onClick={prevent} size="sm" target="_blank" rel="noreferrer">
              <Group gap={4} component="span" display="inline-flex" wrap="nowrap">
                Supplier portal <IconExternalLink size={14} />
              </Group>
            </Anchor>
            <Group gap="md">
              <Anchor href="#" onClick={prevent} size="xs">
                xs link
              </Anchor>
              <Anchor href="#" onClick={prevent} size="sm">
                sm link
              </Anchor>
              <Anchor href="#" onClick={prevent} size="md">
                md link
              </Anchor>
            </Group>
          </Stack>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

/** Burger: toggle, sizes, and the mobile header it lives in. */
export function BurgerDemo() {
  const [opened, { toggle }] = useDisclosure(false);
  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        <Specimen
          label="Toggle & sizes"
          note={
            <>
              <code>opened</code> morphs to a close icon.{' '}
              <code>size=&quot;sm&quot; | &quot;md&quot; | &quot;lg&quot;</code>; always pass an{' '}
              <code>aria-label</code>.
            </>
          }
        >
          <Group gap="xl" justify="center">
            <Burger
              opened={opened}
              onClick={toggle}
              aria-label={opened ? 'Close navigation' : 'Open navigation'}
            />
            <Burger size="sm" opened={false} aria-label="Open navigation (small)" />
            <Burger size="lg" opened aria-label="Close navigation (large)" />
          </Group>
        </Specimen>
        <Specimen
          label="Mobile header"
          surface="muted"
          note={
            <>
              Below the <code>sm</code> breakpoint the shell hides the sidebar and shows a{' '}
              <code>Burger size=&quot;sm&quot;</code> in the header.
            </>
          }
        >
          <div className={`bp-header ${styles.mobileHeader}`}>
            <Group gap="sm" wrap="nowrap">
              <Burger size="sm" opened={opened} onClick={toggle} aria-label="Toggle navigation" />
              <div className="bp-brand-icon">{APP.initial}</div>
              <Text fw={600} size="sm" className={styles.brandName}>
                {APP.name}
              </Text>
            </Group>
          </div>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

const TOC_SECTIONS = [
  {
    id: 'summary',
    depth: 1,
    title: 'Summary',
    body: 'Atlas Packaging supplies corrugated cartons and void fill for the Northwind fulfilment centres.',
  },
  {
    id: 'terms',
    depth: 1,
    title: 'Commercial terms',
    body: 'Net 30 payment, prices fixed until March, volume rebate above 40,000 units per quarter.',
  },
  {
    id: 'pricing',
    depth: 2,
    title: 'Pricing schedule',
    body: 'Unit prices per carton size, reviewed every quarter against the packaging index.',
  },
  {
    id: 'rebates',
    depth: 2,
    title: 'Rebates',
    body: 'Rebates are credited against the next invoice once the quarterly volume is confirmed.',
  },
  {
    id: 'delivery',
    depth: 1,
    title: 'Delivery',
    body: 'Two scheduled drops per week; urgent orders ship next day for a flat fee.',
  },
  {
    id: 'contacts',
    depth: 1,
    title: 'Contacts',
    body: 'Account manager: Lena Brandt. Escalation: operations@atlas-packaging.example.',
  },
];

/** TableOfContents bound to a scrolling article (scroll-spy). */
export function TableOfContentsDemo() {
  const scope = `toc-${useId().replace(/:/g, '')}`;
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const [activeId, setActiveId] = useState(`${scope}-${TOC_SECTIONS[0].id}`);
  const [variant, setVariant] = useState<'filled' | 'light' | 'none'>('light');

  useEffect(() => {
    if (!host) return;
    const onScroll = () => {
      const headings = Array.from(host.querySelectorAll<HTMLElement>('[data-toc-heading]'));
      let current: string | undefined = headings[0]?.id;
      for (const heading of headings) {
        if (heading.offsetTop - host.scrollTop <= 24) current = heading.id;
      }
      if (host.scrollTop + host.clientHeight >= host.scrollHeight - 2)
        current = headings.at(-1)?.id;
      if (current) setActiveId(current);
    };
    host.addEventListener('scroll', onScroll, { passive: true });
    return () => host.removeEventListener('scroll', onScroll);
  }, [host]);

  return (
    <Gallery>
      <SpecimenGrid cols={1}>
        <Specimen
          label="Scroll-spy"
          align="start"
          note={
            <>
              <code>TableOfContents</code> reads headings with{' '}
              <code>scrollSpyOptions.selector</code> and highlights the active one;{' '}
              <code>variant=&quot;filled&quot; | &quot;light&quot; | &quot;none&quot;</code>. Scroll
              the contract or click an entry.
            </>
          }
        >
          <SegmentedControl
            size="xs"
            value={variant}
            onChange={(v) => setVariant(v as typeof variant)}
            data={['light', 'filled', 'none']}
            className={styles.tocSwitch}
          />
          <div className={styles.tocLayout}>
            <div
              ref={setHost}
              className={styles.tocArticle}
              data-toc-scope={scope}
              tabIndex={0}
              aria-label="Supplier contract"
            >
              {TOC_SECTIONS.map((section) => (
                <div key={section.id} className={styles.tocSection}>
                  <Title
                    order={section.depth === 1 ? 4 : 5}
                    id={`${scope}-${section.id}`}
                    data-toc-heading
                    mb={6}
                  >
                    {section.title}
                  </Title>
                  <Text size="sm" c="dimmed">
                    {section.body}
                  </Text>
                </div>
              ))}
            </div>
            <div>
              <Text
                size="xs"
                fw={700}
                c="dimmed"
                tt="uppercase"
                mb="xs"
                className={styles.sectionLabel}
              >
                On this page
              </Text>
              <TableOfContents
                variant={variant}
                size="sm"
                radius="sm"
                minDepthToOffset={4}
                depthOffset={20}
                scrollSpyOptions={{
                  selector: `[data-toc-scope="${scope}"] [data-toc-heading]`,
                  scrollHost: host ?? undefined,
                }}
                getControlProps={({ data }) => ({
                  children: data.value,
                  'data-active': data.id === activeId || undefined,
                  onClick: () => {
                    const node = data.getNode();
                    if (host && node)
                      host.scrollTo({
                        top: node.offsetTop - 8,
                        behavior: 'smooth',
                      });
                  },
                })}
              />
            </div>
          </div>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}
