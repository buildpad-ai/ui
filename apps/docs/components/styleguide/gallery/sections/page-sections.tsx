'use client';

import {
  ActionIcon,
  Alert,
  Anchor,
  Avatar,
  Badge,
  Box,
  Breadcrumbs,
  Button,
  Card,
  Center,
  Checkbox,
  CloseButton,
  Divider,
  Drawer,
  Group,
  Menu,
  Progress,
  RingProgress,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  ThemeIcon,
  Timeline,
  Title,
  Tooltip,
  VisuallyHidden,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconAlertTriangle,
  IconArchive,
  IconArrowDownRight,
  IconArrowLeft,
  IconArrowUpRight,
  IconArrowsSort,
  IconCalendar,
  IconCheck,
  IconChecklist,
  IconChevronDown,
  IconChevronRight,
  IconCircleCheck,
  IconClock,
  IconCopy,
  IconCurrencyDollar,
  IconDots,
  IconDownload,
  IconEdit,
  IconFilter,
  IconLayoutGrid,
  IconLayoutSidebarRight,
  IconList,
  IconPencil,
  IconPlus,
  IconPrinter,
  IconRefresh,
  IconSearch,
  IconSettings,
  IconSpeakerphone,
  IconTool,
  IconTrash,
  IconUserPlus,
} from '@tabler/icons-react';
import { useState, type ReactNode } from 'react';
import { Gallery } from '../Gallery';
import { Specimen, SpecimenGrid } from '../Layout';
import {
  ACTIVITY,
  KPIS,
  MONTHLY_SPEND,
  ORDERS,
  ORDER_STATUS,
  USERS,
  formatMoney,
  type MockOrder,
} from '../data';
import styles from './page-sections.module.css';

/* ── Shared bits ─────────────────────────────────────────────── */

// Always-open previews must not flip above their trigger when it is scrolled out of view.
const STATIC_MIDDLEWARES = { flip: false, shift: false };

function OverflowMenu({ preview = false }: { preview?: boolean }) {
  return (
    <Menu
      position="bottom-end"
      width={200}
      {...(preview ? { opened: true, withinPortal: false, hideDetached: false, trapFocus: false, middlewares: STATIC_MIDDLEWARES } : {})}
    >
      <Menu.Target>
        <ActionIcon variant="default" size="lg" radius="xl" aria-label="More actions">
          <IconDots size={18} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Order</Menu.Label>
        <Menu.Item leftSection={<IconCopy size={16} />}>Duplicate</Menu.Item>
        <Menu.Item leftSection={<IconPrinter size={16} />}>Print</Menu.Item>
        <Menu.Item leftSection={<IconArchive size={16} />}>Archive</Menu.Item>
        <Menu.Divider />
        <Menu.Item color="red" leftSection={<IconTrash size={16} />}>
          Delete order
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

function Crumbs({ items }: { items: string[] }) {
  return (
    <Breadcrumbs separator={<IconChevronRight size={12} />} separatorMargin={6}>
      {items.map((item, i) =>
        i === items.length - 1 ? (
          <Text key={item} size="sm" fw={500}>
            {item}
          </Text>
        ) : (
          <Anchor key={item} href="#" size="sm" c="dimmed" onClick={(e) => e.preventDefault()}>
            {item}
          </Anchor>
        ),
      )}
    </Breadcrumbs>
  );
}

function Meta({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <Group gap={6} wrap="nowrap">
      <Text component="span" c="dimmed" lh={0}>
        {icon}
      </Text>
      <Text size="sm" c="dimmed">
        {children}
      </Text>
    </Group>
  );
}

function StatusBadge({ order }: { order: MockOrder }) {
  return <Badge color={ORDER_STATUS[order.status].color}>{ORDER_STATUS[order.status].label}</Badge>;
}

/* ── Page headers ───────────────────────────────────────────── */

/** Page headers: list page, record page with status and meta, and with tabs as sub-navigation. */
export function PageHeaders() {
  const order = ORDERS[0];
  const [tab, setTab] = useState<string | null>('orders');
  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        <Specimen
          label="List page header"
          span="full"
          surface="muted"
          align="start"
          note={
            <>
              <code>Breadcrumbs</code> above a <code>Title order=2</code> and dimmed description; actions right-aligned —
              secondary <code>variant=&quot;default&quot;</code>, one ink primary, then an overflow{' '}
              <code>Menu</code> on a <code>radius=&quot;xl&quot;</code> <code>ActionIcon</code> to match the pill buttons.
            </>
          }
        >
          <Stack gap="xs" className={styles.fill}>
            <Crumbs items={['Northwind Ops', 'Procurement', 'Purchase orders']} />
            <div className={styles.headerRow}>
              <div className={styles.headerText}>
                <Title order={2}>Purchase orders</Title>
                <Text c="dimmed" mt={4}>
                  Track every order from draft to delivery. 128 open, 12 waiting on you.
                </Text>
              </div>
              <Group gap="sm">
                <Button variant="default" leftSection={<IconDownload size={16} />}>
                  Export
                </Button>
                <Button leftSection={<IconPlus size={16} />}>New order</Button>
                <OverflowMenu />
              </Group>
            </div>
          </Stack>
        </Specimen>

        <Specimen
          label="Record header with status and meta"
          span="full"
          surface="muted"
          align="start"
          note={
            <>
              Status <code>Badge</code> sits on the title line; a meta row of dimmed icon + text pairs carries the facts
              people scan for. Approve is the single ink CTA.
            </>
          }
        >
          <Stack gap="xs" className={styles.fill}>
            <Crumbs items={['Purchase orders', order.number]} />
            <div className={styles.headerRow}>
              <div className={styles.headerText}>
                <Group gap="sm">
                  <Title order={2}>{order.supplier}</Title>
                  <StatusBadge order={order} />
                </Group>
                <Group gap="md" mt="xs">
                  <Group gap={6} wrap="nowrap">
                    <Avatar size={20} radius="xl" color="primary">
                      {order.owner.initials}
                    </Avatar>
                    <Text size="sm" c="dimmed">
                      {order.owner.name}
                    </Text>
                  </Group>
                  <Meta icon={<IconCurrencyDollar size={16} />}>{formatMoney(order.amount)}</Meta>
                  <Meta icon={<IconCalendar size={16} />}>Due {order.due}</Meta>
                  <Meta icon={<IconClock size={16} />}>Updated {order.updated.replace('Today, ', '')}</Meta>
                </Group>
              </div>
              <Group gap="sm">
                <Button variant="default">Request changes</Button>
                <Button leftSection={<IconCheck size={16} />}>Approve</Button>
                <OverflowMenu />
              </Group>
            </div>
          </Stack>
        </Specimen>

        <Specimen
          label="Header with tabs as sub-navigation"
          span="full"
          surface="muted"
          align="start"
          note={
            <>
              <code>Tabs</code> directly under the header split a record into sub-pages; the active tab is ink text with
              the ember underline from globals.css, counts ride in a <code>rightSection</code> Badge.
            </>
          }
        >
          <Stack gap="md" className={styles.fill}>
            <Crumbs items={['Suppliers', 'Atlas Packaging']} />
            <div className={styles.headerRow}>
              <Group gap="md" wrap="nowrap" className={styles.headerText}>
                <Avatar size={52} radius="lg" color="primary">
                  AP
                </Avatar>
                <div>
                  <Group gap="sm">
                    <Title order={2}>Atlas Packaging</Title>
                    <Badge color="green">Preferred</Badge>
                  </Group>
                  <Text c="dimmed" size="sm" mt={2}>
                    Packaging · London, UK · Supplier since 2021
                  </Text>
                </div>
              </Group>
              <Group gap="sm">
                <Button variant="default" leftSection={<IconPencil size={16} />}>
                  Edit
                </Button>
                <Button leftSection={<IconPlus size={16} />}>New order</Button>
                <OverflowMenu />
              </Group>
            </div>
            <Tabs value={tab} onChange={setTab}>
              <Tabs.List>
                <Tabs.Tab value="overview">Overview</Tabs.Tab>
                <Tabs.Tab value="orders" rightSection={<Badge size="xs" color="gray">12</Badge>}>
                  Orders
                </Tabs.Tab>
                <Tabs.Tab value="contacts">Contacts</Tabs.Tab>
                <Tabs.Tab value="documents" rightSection={<Badge size="xs" color="gray">4</Badge>}>
                  Documents
                </Tabs.Tab>
                <Tabs.Tab value="activity">Activity</Tabs.Tab>
              </Tabs.List>
            </Tabs>
          </Stack>
        </Specimen>

        <Specimen
          label="Overflow menu — open"
          note={
            <>
              <code>Menu opened withinPortal=false</code>: a <code>Menu.Label</code>, routine items, then the destructive
              item last after a divider with <code>color=&quot;red&quot;</code>.
            </>
          }
        >
          <div className={styles.menuStage}>
            <OverflowMenu preview />
          </div>
        </Specimen>

        <Specimen
          label="Compact header with back link"
          surface="muted"
          note={
            <>
              For drawers, sub-pages and narrow views: a labelled back <code>ActionIcon</code>, a{' '}
              <code>Title order=3</code> and a compact <code>size=&quot;xs&quot;</code> action.
            </>
          }
        >
          <Stack gap="lg" className={styles.fill}>
            <Group justify="space-between" wrap="nowrap">
              <Group gap="sm" wrap="nowrap">
                <ActionIcon variant="default" radius="xl" size="lg" aria-label="Back to purchase orders">
                  <IconArrowLeft size={16} />
                </ActionIcon>
                <div>
                  <Text size="xs" c="dimmed">
                    Purchase orders
                  </Text>
                  <Group gap="xs">
                    <Title order={3}>{ORDERS[2].number}</Title>
                    <StatusBadge order={ORDERS[2]} />
                  </Group>
                </div>
              </Group>
              <Button size="xs" leftSection={<IconEdit size={14} />}>
                Edit
              </Button>
            </Group>
            <Divider />
            <Group justify="space-between" wrap="nowrap">
              <Group gap="sm" wrap="nowrap">
                <ActionIcon variant="subtle" color="gray" size="lg" aria-label="Back to users">
                  <IconArrowLeft size={16} />
                </ActionIcon>
                <Avatar radius="xl" color="primary">
                  {USERS[2].initials}
                </Avatar>
                <div>
                  <Title order={4}>{USERS[2].name}</Title>
                  <Text size="xs" c="dimmed">
                    {USERS[2].role} · {USERS[2].team}
                  </Text>
                </div>
              </Group>
              <Button size="xs" variant="default">
                Message
              </Button>
            </Group>
          </Stack>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

/* ── Section headers inside cards ───────────────────────────── */

/** Section headers inside cards: action, count + link, divided header with control, icon + menu. */
export function CardSectionHeaders() {
  const [range, setRange] = useState('6M');
  const max = Math.max(...MONTHLY_SPEND.map((m) => m.value));
  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        <Specimen
          label="Title, description and action"
          surface="muted"
          align="start"
          note={
            <>
              <code>Title order=4</code> + dimmed description left, a <code>size=&quot;xs&quot;</code> default button
              right. The most common card header.
            </>
          }
        >
          <Card className={styles.fill}>
            <Group justify="space-between" align="flex-start" wrap="nowrap" mb="md">
              <div>
                <Title order={4}>Billing contact</Title>
                <Text size="sm" c="dimmed" mt={2}>
                  Receives invoices and payment reminders.
                </Text>
              </div>
              <Button size="xs" variant="default" leftSection={<IconPencil size={14} />}>
                Edit
              </Button>
            </Group>
            <Stack gap={6}>
              {[
                ['Name', 'Priya Raman'],
                ['Email', 'accounts@northwind.io'],
                ['Terms', 'Net 30'],
              ].map(([k, v]) => (
                <Group key={k} justify="space-between">
                  <Text size="sm" c="dimmed">
                    {k}
                  </Text>
                  <Text size="sm" fw={500}>
                    {v}
                  </Text>
                </Group>
              ))}
            </Stack>
          </Card>
        </Specimen>

        <Specimen
          label="Title with count and link"
          surface="muted"
          align="start"
          note={
            <>
              A gray count <code>Badge</code> beside the title and an <code>Anchor</code> (<code>--ds-accent-text</code>)
              for the full list.
            </>
          }
        >
          <Card className={styles.fill}>
            <Group justify="space-between" mb="sm">
              <Group gap="xs">
                <Title order={4}>Recent orders</Title>
                <Badge color="gray" circle>
                  {ORDERS.length}
                </Badge>
              </Group>
              <Anchor href="#" size="sm" onClick={(e) => e.preventDefault()}>
                View all
              </Anchor>
            </Group>
            <Stack gap={0}>
              {ORDERS.slice(0, 3).map((o, i) => (
                <div key={o.id}>
                  {i > 0 && <Divider />}
                  <Group justify="space-between" py="xs" wrap="nowrap">
                    <div>
                      <Text size="sm" fw={500}>
                        {o.supplier}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {o.number} · {o.updated}
                      </Text>
                    </div>
                    <StatusBadge order={o} />
                  </Group>
                </div>
              ))}
            </Stack>
          </Card>
        </Specimen>

        <Specimen
          label="Divided header with a control"
          surface="muted"
          align="start"
          note={
            <>
              <code>Card padding=0</code>, header and body split by a <code>Divider</code>, range picked with a{' '}
              <code>SegmentedControl size=&quot;xs&quot;</code>. Bars are composed from boxes on{' '}
              <code>--ds-primary-*</code> (no <code>@mantine/charts</code>).
            </>
          }
        >
          <Card padding={0} className={styles.fill}>
            <Group justify="space-between" px="lg" py="md">
              <div>
                <Title order={5}>Spend by month</Title>
                <Text size="xs" c="dimmed">
                  Thousands of USD
                </Text>
              </div>
              <SegmentedControl size="xs" data={['3M', '6M', '12M']} value={range} onChange={setRange} />
            </Group>
            <Divider />
            <Box px="lg" py="md">
              <div className={styles.bars} role="img" aria-label="Monthly spend, May to October">
                {MONTHLY_SPEND.map((m, i) => (
                  <div key={m.month} className={styles.bar}>
                    <Text size="xs" fw={500}>
                      {m.value}
                    </Text>
                    <div
                      className={styles.barFill}
                      data-current={i === MONTHLY_SPEND.length - 1 || undefined}
                      style={{ height: `${(m.value / max) * 80}%` }}
                    />
                    <Text size="xs" c="dimmed">
                      {m.month}
                    </Text>
                  </div>
                ))}
              </div>
            </Box>
          </Card>
        </Specimen>

        <Specimen
          label="Icon, title and menu"
          surface="muted"
          align="start"
          note={
            <>
              A light <code>ThemeIcon</code> anchors the section; secondary actions live in a subtle{' '}
              <code>ActionIcon</code> menu so the header stays quiet.
            </>
          }
        >
          <Card className={styles.fill}>
            <Group justify="space-between" align="flex-start" wrap="nowrap" mb="md">
              <Group gap="sm" wrap="nowrap">
                <ThemeIcon variant="light" size="lg" radius="md">
                  <IconChecklist size={18} />
                </ThemeIcon>
                <div>
                  <Title order={5}>Approvals</Title>
                  <Text size="xs" c="dimmed">
                    2 of 3 approvers have signed off
                  </Text>
                </div>
              </Group>
              <Menu position="bottom-end">
                <Menu.Target>
                  <ActionIcon variant="subtle" color="gray" aria-label="Approval options">
                    <IconDots size={16} />
                  </ActionIcon>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Item leftSection={<IconUserPlus size={16} />}>Add approver</Menu.Item>
                  <Menu.Item leftSection={<IconRefresh size={16} />}>Send reminder</Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </Group>
            <Stack gap="sm">
              {[
                { user: USERS[2], status: 'Approved', color: 'green' },
                { user: USERS[0], status: 'Approved', color: 'green' },
                { user: USERS[1], status: 'Waiting', color: 'yellow' },
              ].map(({ user, status, color }) => (
                <Group key={user.id} justify="space-between" wrap="nowrap">
                  <Group gap="sm" wrap="nowrap">
                    <Avatar size="sm" radius="xl" color="primary">
                      {user.initials}
                    </Avatar>
                    <Text size="sm">{user.name}</Text>
                  </Group>
                  <Badge color={color}>{status}</Badge>
                </Group>
              ))}
            </Stack>
          </Card>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

/* ── Toolbars ───────────────────────────────────────────────── */

const SORTS = [
  { value: 'updated', label: 'Last updated' },
  { value: 'amount', label: 'Amount' },
  { value: 'supplier', label: 'Supplier' },
  { value: 'due', label: 'Due date' },
] as const;
type SortKey = (typeof SORTS)[number]['value'];

function sortOrders(orders: MockOrder[], key: SortKey) {
  const list = [...orders];
  if (key === 'amount') list.sort((a, b) => b.amount - a.amount);
  if (key === 'supplier') list.sort((a, b) => a.supplier.localeCompare(b.supplier));
  if (key === 'due') list.sort((a, b) => a.due.localeCompare(b.due));
  return list;
}

function SortMenu({ value, onChange, preview = false }: { value: SortKey; onChange: (v: SortKey) => void; preview?: boolean }) {
  const current = SORTS.find((s) => s.value === value)!;
  return (
    <Menu
      position="bottom-end"
      width={200}
      {...(preview ? { opened: true, withinPortal: false, hideDetached: false, trapFocus: false, middlewares: STATIC_MIDDLEWARES } : {})}
    >
      <Menu.Target>
        <Button
          variant="default"
          leftSection={<IconArrowsSort size={16} />}
          rightSection={<IconChevronDown size={14} />}
        >
          Sort: {current.label}
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Sort by</Menu.Label>
        {SORTS.map((s) => (
          <Menu.Item
            key={s.value}
            onClick={() => onChange(s.value)}
            rightSection={s.value === value ? <IconCheck size={14} /> : null}
          >
            {s.label}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}

const VIEW_OPTIONS = [
  {
    value: 'table',
    label: (
      <Center>
        <IconList size={16} />
        <VisuallyHidden>Table view</VisuallyHidden>
      </Center>
    ),
  },
  {
    value: 'grid',
    label: (
      <Center>
        <IconLayoutGrid size={16} />
        <VisuallyHidden>Grid view</VisuallyHidden>
      </Center>
    ),
  },
];

/** A list toolbar: search, sort Menu, filter button with count, view toggle and a bulk-selection bar. */
export function Toolbars() {
  const [query, setQuery] = useState('');
  const [view, setView] = useState('table');
  const [sort, setSort] = useState<SortKey>('updated');
  const [previewSort, setPreviewSort] = useState<SortKey>('amount');
  const [selected, setSelected] = useState<string[]>(['o1', 'o3', 'o5']);

  const rows = sortOrders(
    ORDERS.filter((o) => `${o.number} ${o.supplier}`.toLowerCase().includes(query.trim().toLowerCase())),
    sort,
  );
  const allSelected = rows.length > 0 && rows.every((r) => selected.includes(r.id));
  const someSelected = rows.some((r) => selected.includes(r.id));
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const toggleAll = () => setSelected(allSelected ? [] : rows.map((r) => r.id));

  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        <Specimen
          label="List toolbar with bulk selection"
          span="full"
          surface="muted"
          align="start"
          note={
            <>
              Search left; filter <code>Button</code> with an orange count <code>Badge</code>, sort <code>Menu</code> and
              an icon <code>SegmentedControl</code> (labels in <code>VisuallyHidden</code>) right. Selecting rows reveals
              the bulk bar on <code>--ds-primary-50</code>; selected rows use{' '}
              <code>--mantine-primary-color-light</code>.
            </>
          }
        >
          <Card className={styles.fill}>
            <Stack gap="md">
              <div className={styles.toolbar}>
                <TextInput
                  className={styles.toolbarSearch}
                  aria-label="Search orders"
                  placeholder="Search orders"
                  leftSection={<IconSearch size={16} />}
                  value={query}
                  onChange={(e) => setQuery(e.currentTarget.value)}
                />
                <div className={styles.spacer} />
                <Button
                  variant="default"
                  leftSection={<IconFilter size={16} />}
                  rightSection={<Badge size="sm" circle color="orange">2</Badge>}
                >
                  Filters
                </Button>
                <SortMenu value={sort} onChange={setSort} />
                <SegmentedControl data={VIEW_OPTIONS} value={view} onChange={setView} aria-label="View" />
              </div>

              {selected.length > 0 && (
                <div className={styles.bulkBar}>
                  <Checkbox
                    aria-label="Select all"
                    checked={allSelected}
                    indeterminate={someSelected && !allSelected}
                    onChange={toggleAll}
                  />
                  <Text size="sm" fw={600}>
                    {selected.length} selected
                  </Text>
                  <Divider orientation="vertical" />
                  <Button size="xs" variant="default" leftSection={<IconCheck size={14} />}>
                    Approve
                  </Button>
                  <Button size="xs" variant="default" leftSection={<IconDownload size={14} />}>
                    Export
                  </Button>
                  <Button size="xs" variant="light" color="red" leftSection={<IconTrash size={14} />}>
                    Delete
                  </Button>
                  <div className={styles.spacer} />
                  <CloseButton size="sm" aria-label="Clear selection" onClick={() => setSelected([])} />
                </div>
              )}

              {view === 'table' ? (
                <Table highlightOnHover verticalSpacing="xs">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th w={40}>
                        <Checkbox
                          aria-label="Select all orders"
                          size="xs"
                          checked={allSelected}
                          indeterminate={someSelected && !allSelected}
                          onChange={toggleAll}
                        />
                      </Table.Th>
                      <Table.Th>Order</Table.Th>
                      <Table.Th>Supplier</Table.Th>
                      <Table.Th>Owner</Table.Th>
                      <Table.Th>Status</Table.Th>
                      <Table.Th>Due</Table.Th>
                      <Table.Th ta="right">Amount</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {rows.map((o) => {
                      const isSelected = selected.includes(o.id);
                      return (
                        <Table.Tr key={o.id} bg={isSelected ? 'var(--mantine-primary-color-light)' : undefined}>
                          <Table.Td>
                            <Checkbox
                              size="xs"
                              aria-label={`Select ${o.number}`}
                              checked={isSelected}
                              onChange={() => toggle(o.id)}
                            />
                          </Table.Td>
                          <Table.Td fw={500}>{o.number}</Table.Td>
                          <Table.Td>{o.supplier}</Table.Td>
                          <Table.Td>{o.owner.name}</Table.Td>
                          <Table.Td>
                            <StatusBadge order={o} />
                          </Table.Td>
                          <Table.Td>{o.due}</Table.Td>
                          <Table.Td ta="right">{formatMoney(o.amount)}</Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              ) : (
                <SimpleGrid cols={3} spacing="md">
                  {rows.map((o) => (
                    <Card key={o.id} padding="md">
                      <Group justify="space-between" align="flex-start" wrap="nowrap">
                        <div>
                          <Text size="xs" c="dimmed" fw={500}>
                            {o.number}
                          </Text>
                          <Text fw={600}>{o.supplier}</Text>
                        </div>
                        <Checkbox
                          size="xs"
                          aria-label={`Select ${o.number}`}
                          checked={selected.includes(o.id)}
                          onChange={() => toggle(o.id)}
                        />
                      </Group>
                      <Group justify="space-between" mt="md">
                        <StatusBadge order={o} />
                        <Text fw={600}>{formatMoney(o.amount)}</Text>
                      </Group>
                    </Card>
                  ))}
                </SimpleGrid>
              )}
            </Stack>
          </Card>
        </Specimen>

        <Specimen
          label="Sort menu — open"
          note={
            <>
              <code>Menu opened withinPortal=false</code>; the active option carries a check in{' '}
              <code>rightSection</code>.
            </>
          }
        >
          <div className={styles.menuStage}>
            <SortMenu value={previewSort} onChange={setPreviewSort} preview />
          </div>
        </Specimen>

        <Specimen
          label="Compact card toolbar"
          surface="muted"
          note={
            <>
              Inside a card: <code>size=&quot;xs&quot;</code> search and subtle icon actions, each with an{' '}
              <code>aria-label</code> and a <code>Tooltip</code> (shown open on the first).
            </>
          }
        >
          <Card className={styles.fill}>
            <Group justify="space-between" wrap="nowrap">
              <Title order={5}>Line items</Title>
              <Group gap={4} wrap="nowrap">
                <TextInput size="xs" w={150} aria-label="Search line items" placeholder="Search" leftSection={<IconSearch size={14} />} />
                <Tooltip label="Refresh" opened withinPortal={false} position="bottom" middlewares={STATIC_MIDDLEWARES}>
                  <ActionIcon variant="subtle" color="gray" aria-label="Refresh">
                    <IconRefresh size={16} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="Download CSV">
                  <ActionIcon variant="subtle" color="gray" aria-label="Download CSV">
                    <IconDownload size={16} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="Table settings">
                  <ActionIcon variant="subtle" color="gray" aria-label="Table settings">
                    <IconSettings size={16} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </Group>
            <Stack gap={0} mt="lg">
              {[
                ['Corrugated cartons 600×400', '2,400', '$6,480'],
                ['Pallet wrap 23µm', '120', '$1,560'],
                ['Tamper-evident tape', '800', '$1,040'],
              ].map(([item, qty, total], i) => (
                <div key={item}>
                  {i > 0 && <Divider />}
                  <Group justify="space-between" py="xs" wrap="nowrap">
                    <Text size="sm">{item}</Text>
                    <Group gap="lg" wrap="nowrap">
                      <Text size="sm" c="dimmed">
                        × {qty}
                      </Text>
                      <Text size="sm" fw={500}>
                        {total}
                      </Text>
                    </Group>
                  </Group>
                </div>
              ))}
            </Stack>
          </Card>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

/* ── Sticky action footers ──────────────────────────────────── */

/** Sticky footers: a page-level save bar and a floating selection bar, inside scrolling frames. */
export function StickyFooters() {
  const [dirty, setDirty] = useState(true);
  const [picked, setPicked] = useState<string[]>(['o2', 'o5']);
  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        <Specimen
          label="Page save bar"
          align="start"
          note={
            <>
              Scroll the frame: the bar is <code>position: sticky; bottom: 0</code> on <code>--ds-card-bg</code> with a
              hairline top border and <code>--ds-shadow-lg</code>. A dot <code>Badge</code> flags unsaved changes.
            </>
          }
        >
          <div className={styles.scrollFrame}>
            <div className={styles.scrollContent}>
              <Stack gap="md">
                <Title order={4}>Edit supplier</Title>
                {['Legal name', 'Trading name', 'VAT number', 'Account manager', 'Payment terms', 'Website'].map((label, i) => (
                  <TextInput
                    key={label}
                    label={label}
                    defaultValue={['Atlas Packaging Ltd', 'Atlas Packaging', 'GB 284 1937 22', 'Daniel Osei', 'Net 30', 'atlas.example'][i]}
                    onChange={() => setDirty(true)}
                  />
                ))}
              </Stack>
            </div>
            <div className={styles.pageFooter}>
              {dirty ? (
                <Badge variant="dot" color="orange">
                  Unsaved
                </Badge>
              ) : (
                <Text size="sm" c="dimmed">
                  Saved just now
                </Text>
              )}
              <Group gap="xs" wrap="nowrap">
                <Button variant="default" size="xs" disabled={!dirty} onClick={() => setDirty(false)}>
                  Discard
                </Button>
                <Button size="xs" disabled={!dirty} onClick={() => setDirty(false)}>
                  Save changes
                </Button>
              </Group>
            </div>
          </div>
        </Specimen>

        <Specimen
          label="Floating selection bar"
          align="start"
          note={
            <>
              A pill bar on <code>--ds-card-bg</code> with <code>--ds-shadow-xl</code>, sticky near the bottom of the
              list. Tick rows to change the count; it disappears at zero.
            </>
          }
        >
          <div className={styles.scrollFrame}>
            <div className={styles.scrollContent} data-floating-pad>
              <Stack gap={0}>
                {ORDERS.map((o, i) => (
                  <div key={o.id}>
                    {i > 0 && <Divider />}
                    <Group py="sm" wrap="nowrap" justify="space-between">
                      <Checkbox
                        size="xs"
                        checked={picked.includes(o.id)}
                        onChange={() =>
                          setPicked((p) => (p.includes(o.id) ? p.filter((x) => x !== o.id) : [...p, o.id]))
                        }
                        label={
                          <Text size="sm" fw={500} component="span">
                            {o.number} · {o.supplier}
                          </Text>
                        }
                      />
                      <Text size="sm">{formatMoney(o.amount)}</Text>
                    </Group>
                  </div>
                ))}
              </Stack>
            </div>
            {picked.length > 0 && (
              <div className={styles.floatingWrap}>
                <div className={styles.floatingBar}>
                  <Text size="sm" fw={600}>
                    {picked.length} selected
                  </Text>
                  <Button size="xs" variant="default">
                    Export
                  </Button>
                  <Button size="xs">Approve</Button>
                  <CloseButton size="sm" aria-label="Clear selection" onClick={() => setPicked([])} />
                </div>
              </div>
            )}
          </div>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

/* ── Detail panel / drawer ──────────────────────────────────── */

function OrderDetail({ order, onClose }: { order: MockOrder; onClose?: () => void }) {
  const approver = USERS[2];
  return (
    <>
      <div className={styles.panelHeader}>
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <div>
            <Text size="xs" c="dimmed" fw={500}>
              {order.number}
            </Text>
            <Title order={4}>{order.supplier}</Title>
            <Group gap="xs" mt={6}>
              <StatusBadge order={order} />
              <Badge color="gray">{order.category}</Badge>
            </Group>
          </div>
          {onClose && <CloseButton aria-label="Close details" onClick={onClose} />}
        </Group>
      </div>
      <div className={styles.panelBody}>
        <Stack gap="lg">
          <SimpleGrid cols={2} spacing="md" verticalSpacing="md">
            <div>
              <Text size="xs" c="dimmed">
                Amount
              </Text>
              <Text fw={600}>{formatMoney(order.amount)}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">
                Due
              </Text>
              <Text fw={600}>{order.due}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">
                Owner
              </Text>
              <Group gap={6} wrap="nowrap">
                <Avatar size={20} radius="xl" color="primary">
                  {order.owner.initials}
                </Avatar>
                <Text size="sm" fw={500}>
                  {order.owner.name}
                </Text>
              </Group>
            </div>
            <div>
              <Text size="xs" c="dimmed">
                Updated
              </Text>
              <Text size="sm" fw={500}>
                {order.updated}
              </Text>
            </div>
          </SimpleGrid>
          <Divider />
          <div>
            <Text size="sm" fw={600} mb="sm">
              Activity
            </Text>
            <Timeline active={1} bulletSize={20} lineWidth={2}>
              <Timeline.Item bullet={<IconPlus size={12} />} title={<Text size="sm" fw={500}>Created</Text>}>
                <Text size="xs" c="dimmed">
                  {order.owner.name} · 3 days ago
                </Text>
              </Timeline.Item>
              <Timeline.Item bullet={<IconCheck size={12} />} title={<Text size="sm" fw={500}>Submitted for approval</Text>}>
                <Text size="xs" c="dimmed">
                  {order.owner.name} · {order.updated}
                </Text>
              </Timeline.Item>
              <Timeline.Item bullet={<IconClock size={12} />} title={<Text size="sm" fw={500}>Waiting on {approver.name}</Text>}>
                <Text size="xs" c="dimmed">
                  {approver.role} · {approver.team}
                </Text>
              </Timeline.Item>
            </Timeline>
          </div>
        </Stack>
      </div>
      <div className={styles.panelFooter}>
        <Button variant="default" size="xs">
          Request changes
        </Button>
        <Button size="xs" leftSection={<IconCheck size={14} />}>
          Approve
        </Button>
      </div>
    </>
  );
}

/** A list with a right-hand detail panel, plus the same detail in a Drawer. */
export function DetailPanel() {
  const [selectedId, setSelectedId] = useState<string | null>('o1');
  const [drawerOpened, drawer] = useDisclosure(false);
  const selected = ORDERS.find((o) => o.id === selectedId);

  return (
    <Gallery>
      <SpecimenGrid cols={1}>
        <Specimen
          label="List with side panel"
          span="full"
          surface="muted"
          note={
            <>
              Click a row to load it into the 360px panel (header with <code>CloseButton</code>, facts grid,{' '}
              <code>Timeline</code>, action footer). <strong>Open as drawer</strong> shows the same content in a{' '}
              <code>Drawer position=&quot;right&quot;</code> for narrower screens.
            </>
          }
        >
          <div className={styles.split} data-closed={!selected || undefined}>
            <div className={styles.splitMain}>
              <Group justify="space-between" mb="md">
                <div>
                  <Title order={4}>Purchase orders</Title>
                  <Text size="sm" c="dimmed">
                    Select an order to see its details.
                  </Text>
                </div>
                <Button
                  variant="default"
                  size="xs"
                  leftSection={<IconLayoutSidebarRight size={14} />}
                  onClick={drawer.open}
                  disabled={!selected}
                >
                  Open as drawer
                </Button>
              </Group>
              <Table highlightOnHover verticalSpacing="sm">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Order</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th ta="right">Amount</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {ORDERS.map((o) => (
                    <Table.Tr
                      key={o.id}
                      className={styles.row}
                      onClick={() => setSelectedId(o.id)}
                      bg={o.id === selectedId ? 'var(--mantine-primary-color-light)' : undefined}
                      aria-selected={o.id === selectedId}
                    >
                      <Table.Td>
                        <Text size="sm" fw={500}>
                          {o.supplier}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {o.number} · {o.owner.name}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <StatusBadge order={o} />
                      </Table.Td>
                      <Table.Td ta="right">{formatMoney(o.amount)}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </div>
            {selected && (
              <aside className={styles.panel} aria-label={`${selected.number} details`}>
                <OrderDetail order={selected} onClose={() => setSelectedId(null)} />
              </aside>
            )}
          </div>
          <Drawer
            opened={drawerOpened}
            onClose={drawer.close}
            position="right"
            size={400}
            padding={0}
            withCloseButton={false}
            aria-label="Order details"
          >
            {selected && (
              <div className={styles.panel}>
                <OrderDetail order={selected} onClose={drawer.close} />
              </div>
            )}
          </Drawer>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

/* ── Banners ────────────────────────────────────────────────── */

/** Alert-based banners: announcement, usage limit, maintenance, incident, success and read-only. */
export function Banners() {
  const [announcement, setAnnouncement] = useState(true);
  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        <Specimen
          label="Announcement"
          span="full"
          surface="muted"
          note={
            <>
              <code>Alert color=&quot;orange&quot;</code> (→ primary) with <code>withCloseButton</code> — dismissible,
              one line, one link. Use for product news, never for errors.
            </>
          }
        >
          {announcement ? (
            <Alert
              color="orange"
              icon={<IconSpeakerphone size={18} />}
              withCloseButton
              closeButtonLabel="Dismiss announcement"
              onClose={() => setAnnouncement(false)}
            >
              <Group gap="xs">
                <Text size="sm" fw={600}>
                  New: multi-step approval workflows.
                </Text>
                <Text size="sm">Route large orders through Finance automatically.</Text>
                <Anchor href="#" size="sm" onClick={(e) => e.preventDefault()}>
                  See what&apos;s new
                </Anchor>
              </Group>
            </Alert>
          ) : (
            <Group justify="center">
              <Button variant="subtle" size="xs" onClick={() => setAnnouncement(true)}>
                Show announcement again
              </Button>
            </Group>
          )}
        </Specimen>

        <Specimen
          label="Usage limit"
          surface="muted"
          note={
            <>
              <code>color=&quot;yellow&quot;</code> (→ warning) with a <code>Progress</code> of the same colour and an
              upgrade path. Ink primary, subtle secondary.
            </>
          }
        >
          <Alert color="yellow" icon={<IconAlertTriangle size={18} />} title="23 of 25 seats used">
            <Stack gap="sm">
              <Text size="sm">Your trial ends in 6 days. Invites stop working when you run out of seats.</Text>
              <Progress value={92} color="yellow" size="sm" aria-label="Seats used" />
              <Group gap="xs">
                <Button size="xs">Upgrade plan</Button>
                <Button size="xs" variant="subtle" color="gray">
                  Manage seats
                </Button>
              </Group>
            </Stack>
          </Alert>
        </Specimen>

        <Specimen
          label="Scheduled maintenance"
          surface="muted"
          note={
            <>
              <code>color=&quot;blue&quot;</code> (→ info) for planned, time-boxed notices. Say when, how long and what
              people can still do.
            </>
          }
        >
          <Alert color="blue" icon={<IconTool size={18} />} title="Maintenance · Sun 2 Nov, 02:00–04:00 UTC">
            Northwind Ops will be read-only for about two hours. Approvals queued during the window are processed
            afterwards.
          </Alert>
        </Specimen>

        <Specimen
          label="Incident"
          surface="muted"
          note={
            <>
              <code>color=&quot;red&quot;</code> (→ danger) with a recovery action — a light red button keeps the alert
              calm.
            </>
          }
        >
          <Alert color="red" icon={<IconAlertTriangle size={18} />} title="Supplier sync is failing">
            <Stack gap="sm">
              <Text size="sm">We couldn&apos;t reach the ERP since 09:12. New orders are saved but not sent.</Text>
              <Group gap="xs">
                <Button size="xs" variant="light" color="red" leftSection={<IconRefresh size={14} />}>
                  Retry now
                </Button>
                <Anchor href="#" size="sm" onClick={(e) => e.preventDefault()}>
                  View status page
                </Anchor>
              </Group>
            </Stack>
          </Alert>
        </Specimen>

        <Specimen
          label="Success"
          surface="muted"
          note={
            <>
              <code>color=&quot;green&quot;</code> (→ success) for the result of a long-running job.
            </>
          }
        >
          <Alert
            color="green"
            icon={<IconCircleCheck size={18} />}
            title="Import complete"
            withCloseButton
            closeButtonLabel="Dismiss"
          >
            128 orders added from <strong>october-orders.csv</strong>. 3 rows were skipped.
          </Alert>
        </Specimen>

        <Specimen
          label="Read-only notice"
          span="full"
          surface="muted"
          note={
            <>
              <code>color=&quot;gray&quot;</code> for neutral state about the current record, with the action that
              lifts it.
            </>
          }
        >
          <Alert color="gray" icon={<IconArchive size={18} />} title="This order is archived">
            <Group justify="space-between" gap="xs">
              <Text size="sm">It can&apos;t be edited or approved.</Text>
              <Button size="xs" variant="default">
                Unarchive
              </Button>
            </Group>
          </Alert>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

/* ── Onboarding checklist ───────────────────────────────────── */

const ONBOARDING = [
  { id: 'workspace', title: 'Name your workspace', description: 'Shown in the sidebar and in emails.' },
  { id: 'invite', title: 'Invite your team', description: 'Add the people who create and approve orders.' },
  { id: 'supplier', title: 'Add your first supplier', description: 'Import a CSV or add one by hand.' },
  { id: 'workflow', title: 'Set an approval rule', description: 'Choose who approves orders over a limit.' },
  { id: 'order', title: 'Raise a purchase order', description: 'Try the whole flow end to end.' },
];

/** An onboarding checklist card with Progress, plus compact in-progress and complete widgets. */
export function OnboardingChecklist() {
  const [done, setDone] = useState<string[]>(['workspace', 'invite', 'supplier']);
  const nextId = ONBOARDING.find((s) => !done.includes(s.id))?.id;
  const percent = Math.round((done.length / ONBOARDING.length) * 100);
  const toggle = (id: string) => setDone((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id]));

  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        <Specimen
          label="Checklist card"
          surface="muted"
          align="start"
          note={
            <>
              <code>Progress</code> over a list of steps: done steps get a filled green <code>ThemeIcon</code> and dimmed
              text, the next step gets the only button. Click a step icon to toggle it.
            </>
          }
        >
          <Card className={styles.fill}>
            <Group justify="space-between" align="flex-start" wrap="nowrap">
              <div>
                <Title order={4}>Set up Northwind Ops</Title>
                <Text size="sm" c="dimmed" mt={2}>
                  {done.length} of {ONBOARDING.length} done · about 5 minutes left
                </Text>
              </div>
              <CloseButton aria-label="Hide checklist" />
            </Group>
            <Progress value={percent} mt="md" mb="sm" aria-label="Setup progress" />
            {ONBOARDING.map((step, i) => {
              const isDone = done.includes(step.id);
              const isNext = step.id === nextId;
              return (
                <div key={step.id} className={styles.checkRow}>
                  <ActionIcon
                    variant={isDone ? 'filled' : 'default'}
                    color={isDone ? 'green' : undefined}
                    radius="xl"
                    size={26}
                    aria-label={isDone ? `Mark "${step.title}" as not done` : `Mark "${step.title}" as done`}
                    onClick={() => toggle(step.id)}
                  >
                    {isDone ? <IconCheck size={14} /> : <Text size="xs" fw={600}>{i + 1}</Text>}
                  </ActionIcon>
                  <div>
                    <Text size="sm" fw={600} c={isDone ? 'dimmed' : undefined} td={isDone ? 'line-through' : undefined}>
                      {step.title}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {step.description}
                    </Text>
                  </div>
                  {isNext && (
                    <Button size="xs" onClick={() => toggle(step.id)}>
                      Start
                    </Button>
                  )}
                </div>
              );
            })}
          </Card>
        </Specimen>

        <Specimen
          label="Compact widgets"
          surface="muted"
          align="start"
          note={
            <>
              For a dashboard rail: <code>RingProgress</code> with the percentage as its label, the next step and one
              action — and the finished state, which should be dismissible.
            </>
          }
        >
          <Stack gap="md" className={styles.fill}>
            <Card>
              <Group wrap="nowrap" gap="md">
                <RingProgress
                  size={72}
                  thickness={7}
                  roundCaps
                  sections={[{ value: percent, color: 'primary' }]}
                  label={
                    <Text ta="center" size="xs" fw={700}>
                      {percent}%
                    </Text>
                  }
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text size="sm" fw={600}>
                    Getting started
                  </Text>
                  <Text size="xs" c="dimmed">
                    Next: {ONBOARDING.find((s) => s.id === nextId)?.title ?? 'All done'}
                  </Text>
                </div>
                <Button size="xs" variant="default" rightSection={<IconChevronRight size={14} />}>
                  Continue
                </Button>
              </Group>
            </Card>
            <Card>
              <Group wrap="nowrap" gap="md">
                <ThemeIcon color="green" size={44} radius="xl">
                  <IconCheck size={22} />
                </ThemeIcon>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text size="sm" fw={600}>
                    You&apos;re all set
                  </Text>
                  <Text size="xs" c="dimmed">
                    Every setup step is complete.
                  </Text>
                </div>
                <CloseButton aria-label="Dismiss" />
              </Group>
            </Card>
            <Card>
              <Text size="sm" fw={600} mb="xs">
                Recent activity
              </Text>
              <Stack gap="xs">
                {ACTIVITY.slice(0, 3).map((a) => (
                  <Group key={a.id} gap="sm" wrap="nowrap" align="flex-start">
                    <Avatar size="sm" radius="xl" color="primary">
                      {a.user.initials}
                    </Avatar>
                    <div style={{ minWidth: 0 }}>
                      <Text size="xs">
                        <strong>{a.user.name}</strong> {a.action} {a.target}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {a.time}
                      </Text>
                    </div>
                  </Group>
                ))}
              </Stack>
            </Card>
          </Stack>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

/* ── Stats header ───────────────────────────────────────────── */

const KPI_TONE: Record<string, 'green' | 'red' | 'gray'> = {
  'Avg. approval time': 'green',
  'Overdue deliveries': 'red',
};

/** A row of KPI cards and a page header with an inline stats strip. */
export function StatsHeader() {
  const [period, setPeriod] = useState('30D');
  return (
    <Gallery>
      <SpecimenGrid cols={1}>
        <Specimen
          label="KPI cards"
          span="full"
          surface="muted"
          note={
            <>
              <code>SimpleGrid cols=4</code> of Cards: dimmed label, <code>Title order=3</code> value (Inter Tight), a
              delta <code>Badge</code> coloured by meaning, not direction — faster approvals are green even though the
              number went down.
            </>
          }
        >
          <SimpleGrid cols={{ base: 2, md: 4 }} spacing="md">
            {KPIS.map((k) => {
              const tone = KPI_TONE[k.label] ?? 'gray';
              const Arrow = k.trend === 'up' ? IconArrowUpRight : IconArrowDownRight;
              return (
                <Card key={k.label} padding="lg">
                  <Text size="xs" c="dimmed" fw={500}>
                    {k.label}
                  </Text>
                  <Title order={3} mt={6}>
                    {k.value}
                  </Title>
                  <Badge color={tone} leftSection={<Arrow size={12} />} mt="sm">
                    {k.delta}
                  </Badge>
                  <Text size="xs" c="dimmed" mt={6}>
                    {k.hint}
                  </Text>
                </Card>
              );
            })}
          </SimpleGrid>
        </Specimen>

        <Specimen
          label="Header with stats strip"
          span="full"
          surface="muted"
          note={
            <>
              A dashboard page header: title, period <code>SegmentedControl</code> and export, then one Card holding four
              stats split by <code>--ds-divider</code> rules — denser than KPI cards for secondary pages.
            </>
          }
        >
          <Stack gap="md" className={styles.fill}>
            <div className={styles.headerRow}>
              <div className={styles.headerText}>
                <Title order={2}>Procurement overview</Title>
                <Text c="dimmed" mt={4}>
                  Spend, approvals and deliveries across every team.
                </Text>
              </div>
              <Group gap="sm">
                <SegmentedControl data={['7D', '30D', 'QTD', 'YTD']} value={period} onChange={setPeriod} />
                <Button variant="default" leftSection={<IconDownload size={16} />}>
                  Export
                </Button>
              </Group>
            </div>
            <Card padding="lg">
              <div className={styles.statsStrip}>
                {KPIS.map((k) => {
                  const tone = KPI_TONE[k.label];
                  return (
                    <div key={k.label}>
                      <Text size="xs" c="dimmed" fw={500}>
                        {k.label}
                      </Text>
                      <Group gap="xs" align="baseline" mt={4}>
                        <Title order={4}>{k.value}</Title>
                        <Text size="xs" fw={600} c={tone ? `${tone}.7` : 'dimmed'}>
                          {k.delta}
                        </Text>
                      </Group>
                    </div>
                  );
                })}
              </div>
            </Card>
          </Stack>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

