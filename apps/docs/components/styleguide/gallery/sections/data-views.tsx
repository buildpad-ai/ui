'use client';

import {
  ActionIcon,
  Anchor,
  Avatar,
  Badge,
  Button,
  Card,
  Checkbox,
  Collapse,
  CopyButton,
  Divider,
  Group,
  Indicator,
  Menu,
  Pagination,
  Paper,
  Pill,
  Popover,
  Progress,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Timeline,
  Title,
  Tooltip,
  UnstyledButton,
  VisuallyHidden,
} from '@mantine/core';
import {
  IconArrowDownRight,
  IconArrowUpRight,
  IconArrowsSort,
  IconAt,
  IconBan,
  IconCalendar,
  IconCheck,
  IconChecklist,
  IconChevronDown,
  IconChevronRight,
  IconChevronUp,
  IconClock,
  IconColumns3,
  IconCopy,
  IconCurrencyDollar,
  IconDots,
  IconDownload,
  IconEye,
  IconFilter,
  IconLayoutGrid,
  IconList,
  IconPaperclip,
  IconPencil,
  IconPlus,
  IconRefresh,
  IconMessageCircle,
  IconSearch,
  IconSend,
  IconThumbUp,
  IconTrash,
  IconTruckDelivery,
  IconUserPlus,
  IconX,
  type Icon,
} from '@tabler/icons-react';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Gallery } from '../Gallery';
import { Specimen, SpecimenGrid } from '../Layout';
import {
  ACTIVITY,
  CURRENT_USER,
  KPIS,
  MONTHLY_SPEND,
  ORDERS,
  PAGE_ORDERS,
  ORDER_STATUS,
  USERS,
  USER_STATUS,
  formatMoney,
  type MockOrder,
  type MockUser,
  type OrderStatus,
} from '../data';
import styles from './data-views.module.css';

const TOTAL_RECORDS = 128;
const STATUS_OPTIONS = (Object.keys(ORDER_STATUS) as OrderStatus[]).map((value) => ({
  value,
  label: ORDER_STATUS[value].label,
}));
const CATEGORY_OPTIONS = Array.from(new Set(PAGE_ORDERS.map((o) => o.category))).sort();
const OWNER_OPTIONS = Array.from(new Set(PAGE_ORDERS.map((o) => o.owner.name))).sort();

type ColumnKey = 'supplier' | 'owner' | 'status' | 'amount' | 'updated';
const COLUMNS: Array<{ key: ColumnKey; label: string }> = [
  { key: 'supplier', label: 'Supplier' },
  { key: 'owner', label: 'Owner' },
  { key: 'status', label: 'Status' },
  { key: 'amount', label: 'Amount' },
  { key: 'updated', label: 'Updated' },
];

/** Props that pin an overlay open in place without trapping focus. */
const STATIC_OVERLAY = {
  opened: true,
  withinPortal: false,
  trapFocus: false,
  returnFocus: false,
  closeOnEscape: false,
  closeOnClickOutside: false,
  hideDetached: false,
  middlewares: { flip: false, shift: false },
  transitionProps: { duration: 0 },
} as const;

function StatusBadge({ status }: { status: OrderStatus }) {
  return <Badge color={ORDER_STATUS[status].color}>{ORDER_STATUS[status].label}</Badge>;
}

function UserChip({ user, size = 24 }: { user: MockUser; size?: number }) {
  return (
    <Group gap="xs" wrap="nowrap">
      <Avatar size={size} radius="xl" color="primary">
        {user.initials}
      </Avatar>
      <Text size="sm" truncate="end">
        {user.name}
      </Text>
    </Group>
  );
}

function RowMenuItems({ order }: { order: MockOrder }) {
  return (
    <>
      <Menu.Label>{order.number}</Menu.Label>
      <Menu.Item leftSection={<IconEye size={16} />}>View details</Menu.Item>
      <Menu.Item leftSection={<IconPencil size={16} />}>Edit</Menu.Item>
      <Menu.Item leftSection={<IconCopy size={16} />}>Duplicate</Menu.Item>
      <Menu.Divider />
      <Menu.Item color="red" leftSection={<IconBan size={16} />}>
        Cancel order
      </Menu.Item>
    </>
  );
}

function RowMenu({ order }: { order: MockOrder }) {
  return (
    <Menu position="bottom-end" width={200}>
      <Menu.Target>
        <ActionIcon variant="subtle" color="gray" aria-label={`Actions for ${order.number}`}>
          <IconDots size={16} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <RowMenuItems order={order} />
      </Menu.Dropdown>
    </Menu>
  );
}

function ColumnToggles({
  visible,
  onChange,
}: {
  visible: ColumnKey[];
  onChange: (next: ColumnKey[]) => void;
}) {
  return (
    <Stack gap="xs">
      <Text size="xs" c="dimmed" fw={500}>
        Visible columns
      </Text>
      <Checkbox checked disabled label="Order" size="sm" />
      {COLUMNS.map((column) => (
        <Checkbox
          key={column.key}
          size="sm"
          label={column.label}
          checked={visible.includes(column.key)}
          onChange={(event) =>
            onChange(
              event.currentTarget.checked
                ? COLUMNS.map((c) => c.key).filter((k) => k === column.key || visible.includes(k))
                : visible.filter((k) => k !== column.key)
            )
          }
        />
      ))}
    </Stack>
  );
}

/**
 * The CollectionList block, composed from core components: toolbar with
 * search, status filter, filter panel and column menu; selectable rows with a
 * bulk bar; footer with the item count, page size and pagination.
 */
export function DataTableBlock() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [owner, setOwner] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [columns, setColumns] = useState<ColumnKey[]>(COLUMNS.map((c) => c.key));
  const [selected, setSelected] = useState<string[]>(['o1', 'o4']);
  const [sortDir, setSortDir] = useState<'asc' | 'desc' | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState('10');
  const [refreshing, setRefreshing] = useState(false);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = PAGE_ORDERS.filter(
      (o) =>
        (!q || `${o.number} ${o.supplier} ${o.category}`.toLowerCase().includes(q)) &&
        (!status || o.status === status) &&
        (!category || o.category === category) &&
        (!owner || o.owner.name === owner)
    );
    if (!sortDir) return filtered;
    return [...filtered].sort((a, b) =>
      sortDir === 'asc' ? a.amount - b.amount : b.amount - a.amount
    );
  }, [search, status, category, owner, sortDir]);

  const filters = [
    status && {
      key: 'status',
      label: `Status: ${ORDER_STATUS[status as OrderStatus].label}`,
      clear: () => setStatus(null),
    },
    category && {
      key: 'category',
      label: `Category: ${category}`,
      clear: () => setCategory(null),
    },
    owner && {
      key: 'owner',
      label: `Owner: ${owner}`,
      clear: () => setOwner(null),
    },
  ].filter(Boolean) as Array<{ key: string; label: string; clear: () => void }>;
  const isFiltered = filters.length > 0 || search.trim() !== '';

  const perPage = Number(limit);
  const total = isFiltered ? rows.length : TOTAL_RECORDS;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);

  const allOnPage = rows.length > 0 && rows.every((r) => selected.includes(r.id));
  const someOnPage = rows.some((r) => selected.includes(r.id));
  const show = (key: ColumnKey) => columns.includes(key);
  const colCount = 3 + columns.length;

  const clearAll = () => {
    setSearch('');
    setStatus(null);
    setCategory(null);
    setOwner(null);
  };

  const refreshTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(refreshTimer.current), []);
  const refresh = () => {
    setRefreshing(true);
    window.clearTimeout(refreshTimer.current);
    refreshTimer.current = window.setTimeout(() => setRefreshing(false), 900);
  };

  return (
    <Gallery>
      <SpecimenGrid cols={1}>
        <Specimen
          span="full"
          surface="muted"
          label="Collection table"
          note={
            <>
              The <code>CollectionList</code> structure in stock parts: toolbar, collapsible filter
              panel, removable filter <code>Pill</code>s, a bulk bar on selection, default-size{' '}
              <code>Checkbox</code>es as in <code>VTable</code>, <code>Table highlightOnHover</code>, and a footer with the count, a page-size{' '}
              <code>Select</code> and <code>Pagination</code>. Everything is interactive.
            </>
          }
        >
          <Paper withBorder shadow="sm" className={styles.tableBlock}>
            <div className={styles.toolbar}>
              <Group gap="xs">
                <TextInput
                  className={styles.search}
                  aria-label="Search orders"
                  placeholder="Search orders…"
                  leftSection={<IconSearch size={16} />}
                  value={search}
                  onChange={(e) => {
                    setSearch(e.currentTarget.value);
                    setPage(1);
                  }}
                  rightSection={
                    search ? (
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        size="sm"
                        aria-label="Clear search"
                        onClick={() => setSearch('')}
                      >
                        <IconX size={14} />
                      </ActionIcon>
                    ) : undefined
                  }
                />
                <Select
                  className={styles.statusSelect}
                  aria-label="Filter by status"
                  placeholder="All statuses"
                  data={STATUS_OPTIONS}
                  value={status}
                  onChange={(v) => {
                    setStatus(v);
                    setPage(1);
                  }}
                  clearable
                />
                <Button
                  variant={panelOpen ? 'light' : 'default'}
                  leftSection={<IconFilter size={16} />}
                  rightSection={
                    filters.length > 0 ? (
                      <Badge size="xs" circle variant="filled" color="primary">
                        {filters.length}
                      </Badge>
                    ) : undefined
                  }
                  onClick={() => setPanelOpen((o) => !o)}
                  aria-expanded={panelOpen}
                >
                  Filters
                </Button>
                <Tooltip label="Refresh">
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    size="input-sm"
                    aria-label="Refresh"
                    loading={refreshing}
                    onClick={refresh}
                  >
                    <IconRefresh size={16} />
                  </ActionIcon>
                </Tooltip>
              </Group>
              <Group gap="xs">
                <Popover position="bottom-end" width={200}>
                  <Popover.Target>
                    <Button variant="default" leftSection={<IconColumns3 size={16} />}>
                      Columns
                    </Button>
                  </Popover.Target>
                  <Popover.Dropdown>
                    <ColumnToggles visible={columns} onChange={setColumns} />
                  </Popover.Dropdown>
                </Popover>
                <Button leftSection={<IconPlus size={16} />}>New order</Button>
              </Group>
            </div>

            <Collapse in={panelOpen}>
              <div className={styles.filterPanel}>
                <Group justify="space-between" mb="xs">
                  <Text size="sm" fw={600}>
                    Filters
                  </Text>
                  <Button
                    variant="subtle"
                    size="compact-xs"
                    onClick={clearAll}
                    disabled={!isFiltered}
                  >
                    Clear all
                  </Button>
                </Group>
                <SimpleGrid cols={3}>
                  <Select
                    label="Category"
                    placeholder="Any category"
                    data={CATEGORY_OPTIONS}
                    value={category}
                    onChange={setCategory}
                    clearable
                  />
                  <Select
                    label="Owner"
                    placeholder="Anyone"
                    data={OWNER_OPTIONS}
                    value={owner}
                    onChange={setOwner}
                    clearable
                  />
                  <TextInput
                    label="Due before"
                    placeholder="dd mmm yyyy"
                    leftSection={<IconCalendar size={16} />}
                  />
                </SimpleGrid>
              </div>
            </Collapse>

            {filters.length > 0 && (
              <div className={styles.pills}>
                <Text size="xs" c="dimmed">
                  Filtered by
                </Text>
                {filters.map((f) => (
                  <Pill
                    key={f.key}
                    withRemoveButton
                    onRemove={f.clear}
                    removeButtonProps={{ 'aria-label': `Remove ${f.label}` }}
                  >
                    {f.label}
                  </Pill>
                ))}
                <Button variant="subtle" size="compact-xs" onClick={clearAll}>
                  Clear all
                </Button>
              </div>
            )}

            {selected.length > 0 && (
              <div className={styles.bulkBar}>
                <Group gap="sm">
                  <Text size="sm" fw={600}>
                    {selected.length} selected
                  </Text>
                  <Anchor component="button" type="button" size="sm">
                    Select all {TOTAL_RECORDS}
                  </Anchor>
                </Group>
                <Group gap="xs">
                  <Button variant="default" size="compact-sm" leftSection={<IconCheck size={14} />}>
                    Approve
                  </Button>
                  <Button
                    variant="default"
                    size="compact-sm"
                    leftSection={<IconDownload size={14} />}
                  >
                    Export
                  </Button>
                  <Button
                    variant="light"
                    color="red"
                    size="compact-sm"
                    leftSection={<IconTrash size={14} />}
                  >
                    Delete
                  </Button>
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    aria-label="Clear selection"
                    onClick={() => setSelected([])}
                  >
                    <IconX size={16} />
                  </ActionIcon>
                </Group>
              </div>
            )}

            <div className={styles.tableScroll}>
              <Table highlightOnHover withTableBorder={false} verticalSpacing="sm" miw={720}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th className={styles.checkCell}>
                      <Checkbox
                        aria-label="Select all rows on this page"
                        checked={allOnPage}
                        indeterminate={someOnPage && !allOnPage}
                        onChange={() =>
                          setSelected((cur) =>
                            allOnPage
                              ? cur.filter((id) => !rows.some((r) => r.id === id))
                              : Array.from(new Set([...cur, ...rows.map((r) => r.id)]))
                          )
                        }
                      />
                    </Table.Th>
                    <Table.Th>Order</Table.Th>
                    {show('supplier') && <Table.Th>Supplier</Table.Th>}
                    {show('owner') && <Table.Th>Owner</Table.Th>}
                    {show('status') && <Table.Th>Status</Table.Th>}
                    {show('amount') && (
                      <Table.Th className={styles.amount}>
                        <UnstyledButton
                          onClick={() => setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))}
                          aria-label={`Sort by amount${
                            sortDir
                              ? `, currently ${sortDir === 'asc' ? 'ascending' : 'descending'}`
                              : ''
                          }`}
                        >
                          <Group gap={4} justify="flex-end" wrap="nowrap">
                            <Text inherit>Amount</Text>
                            {sortDir === 'asc' ? (
                              <IconChevronUp size={14} />
                            ) : sortDir === 'desc' ? (
                              <IconChevronDown size={14} />
                            ) : (
                              <IconArrowsSort size={14} />
                            )}
                          </Group>
                        </UnstyledButton>
                      </Table.Th>
                    )}
                    {show('updated') && <Table.Th>Updated</Table.Th>}
                    <Table.Th className={styles.menuCell}>
                      <VisuallyHidden>Actions</VisuallyHidden>
                    </Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {rows.length === 0 ? (
                    <Table.Tr>
                      <Table.Td colSpan={colCount} className={styles.emptyCell}>
                        <Stack align="center" gap="xs">
                          <ThemeIcon variant="light" color="gray" size="xl" radius="xl">
                            <IconSearch size={20} />
                          </ThemeIcon>
                          <Text fw={600}>No orders match these filters</Text>
                          <Text size="sm" c="dimmed">
                            Try a different search or remove a filter.
                          </Text>
                          <Button variant="default" size="compact-sm" mt={4} onClick={clearAll}>
                            Clear filters
                          </Button>
                        </Stack>
                      </Table.Td>
                    </Table.Tr>
                  ) : (
                    rows.map((order) => {
                      const isSelected = selected.includes(order.id);
                      return (
                        <Table.Tr key={order.id}>
                          <Table.Td>
                            <Checkbox
                              aria-label={`Select ${order.number}`}
                              checked={isSelected}
                              onChange={(e) => {
                                const checked = e.currentTarget.checked;
                                setSelected((cur) =>
                                  checked ? [...cur, order.id] : cur.filter((id) => id !== order.id)
                                );
                              }}
                            />
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm" fw={500}>
                              {order.number}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {order.category}
                            </Text>
                          </Table.Td>
                          {show('supplier') && <Table.Td>{order.supplier}</Table.Td>}
                          {show('owner') && (
                            <Table.Td>
                              <UserChip user={order.owner} />
                            </Table.Td>
                          )}
                          {show('status') && (
                            <Table.Td>
                              <StatusBadge status={order.status} />
                            </Table.Td>
                          )}
                          {show('amount') && (
                            <Table.Td className={styles.amount}>
                              <Text size="sm" fw={500}>
                                {formatMoney(order.amount)}
                              </Text>
                            </Table.Td>
                          )}
                          {show('updated') && (
                            <Table.Td>
                              <Text size="sm" c="dimmed">
                                {order.updated}
                              </Text>
                            </Table.Td>
                          )}
                          <Table.Td>
                            <RowMenu order={order} />
                          </Table.Td>
                        </Table.Tr>
                      );
                    })
                  )}
                </Table.Tbody>
              </Table>
            </div>

            <div className={styles.footer}>
              <Text size="sm" c="dimmed">
                {total === 0 ? 'No items' : `${from}–${to} of ${total}`}
              </Text>
              <Group gap="sm">
                <Group gap={6}>
                  <Text size="xs" c="dimmed">
                    Per page
                  </Text>
                  <Select
                    className={styles.perPage}
                    size="xs"
                    aria-label="Rows per page"
                    data={['10', '25', '50', '100']}
                    value={limit}
                    allowDeselect={false}
                    onChange={(v) => {
                      if (v) setLimit(v);
                      setPage(1);
                    }}
                  />
                </Group>
                {totalPages > 1 && (
                  <Pagination size="sm" total={totalPages} value={page} onChange={setPage} />
                )}
              </Group>
            </div>
          </Paper>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

/** The table's overlays pinned open: column menu, row actions, status filter. */
export function TableOverlays() {
  const [columns, setColumns] = useState<ColumnKey[]>(['supplier', 'owner', 'status', 'amount']);
  return (
    <Gallery>
      <SpecimenGrid cols={3}>
        <Specimen
          label="Column visibility"
          note={
            <>
              <code>Popover</code> with a <code>Checkbox</code> per column; the key column stays
              locked on.
            </>
          }
          align="start"
        >
          <div className={styles.overlayStage}>
            <Popover {...STATIC_OVERLAY} position="bottom" width={200}>
              <Popover.Target>
                <Button variant="default" leftSection={<IconColumns3 size={16} />}>
                  Columns
                </Button>
              </Popover.Target>
              <Popover.Dropdown>
                <ColumnToggles visible={columns} onChange={setColumns} />
              </Popover.Dropdown>
            </Popover>
          </div>
        </Specimen>
        <Specimen
          label="Row actions"
          note={
            <>
              <code>Menu</code> on a subtle <code>ActionIcon</code>; destructive items last, after a
              divider, in <code>color=&quot;red&quot;</code>.
            </>
          }
          align="start"
        >
          <div className={styles.overlayStage}>
            <Menu {...STATIC_OVERLAY} position="bottom" width={200}>
              <Menu.Target>
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  aria-label={`Actions for ${ORDERS[0].number}`}
                >
                  <IconDots size={16} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <RowMenuItems order={ORDERS[0]} />
              </Menu.Dropdown>
            </Menu>
          </div>
        </Specimen>
        <Specimen
          label="Status filter"
          note={
            <>
              <code>Select clearable</code> with <code>dropdownOpened</code>; the checked option
              uses the ember check.
            </>
          }
          align="start"
        >
          <div className={styles.overlayStage}>
            <Select
              aria-label="Filter by status"
              placeholder="All statuses"
              data={STATUS_OPTIONS}
              defaultValue="pending"
              dropdownOpened
              clearable
              comboboxProps={{
                withinPortal: false,
                hideDetached: false,
                middlewares: { flip: false, shift: false },
                transitionProps: { duration: 0 },
              }}
              w={200}
            />
          </div>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

function OrderCard({ order }: { order: MockOrder }) {
  return (
    <Card withBorder padding="lg">
      <Group justify="space-between" mb={6}>
        <Text size="xs" c="dimmed" fw={500}>
          {order.number}
        </Text>
        <StatusBadge status={order.status} />
      </Group>
      <Title order={4} lineClamp={1}>
        {order.supplier}
      </Title>
      <Text size="sm" c="dimmed">
        {order.category}
      </Text>
      <Group justify="space-between" align="flex-end" mt="lg">
        <div>
          <Text size="xs" c="dimmed">
            Amount
          </Text>
          <Text size="lg" fw={600}>
            {formatMoney(order.amount)}
          </Text>
        </div>
        <Group gap={4} wrap="nowrap" c="dimmed">
          <IconCalendar size={14} />
          <Text size="xs" c="dimmed">
            Due {order.due}
          </Text>
        </Group>
      </Group>
      <Divider my="md" />
      <Group justify="space-between" wrap="nowrap">
        <UserChip user={order.owner} />
        <RowMenu order={order} />
      </Group>
    </Card>
  );
}

const VIEW_OPTIONS = [
  {
    value: 'cards',
    label: (
      <Group gap={6} wrap="nowrap">
        <IconLayoutGrid size={14} />
        <span>Cards</span>
      </Group>
    ),
  },
  {
    value: 'list',
    label: (
      <Group gap={6} wrap="nowrap">
        <IconList size={14} />
        <span>List</span>
      </Group>
    ),
  },
];

/** The same records as cards, with a view switcher to a compact list. */
export function CardGridView() {
  const [view, setView] = useState('cards');
  const records = PAGE_ORDERS.slice(0, 6);
  return (
    <Gallery>
      <SpecimenGrid cols={1}>
        <Specimen
          span="full"
          surface="muted"
          align="start"
          label="Card grid"
          note={
            <>
              <code>SimpleGrid cols=&#123;3&#125;</code> of <code>Card withBorder</code> (radius{' '}
              <code>--ds-radius-card</code>
              ); a <code>SegmentedControl</code> swaps to a dense list of the same records.
            </>
          }
        >
          <div className={styles.viewHeader}>
            <div>
              <Title order={4}>Purchase orders</Title>
              <Text size="sm" c="dimmed">
                {TOTAL_RECORDS} records · sorted by last updated
              </Text>
            </div>
            <SegmentedControl
              aria-label="View"
              data={VIEW_OPTIONS}
              value={view}
              onChange={setView}
            />
          </div>
          {view === 'cards' ? (
            <SimpleGrid cols={3}>
              {records.map((order) => (
                <OrderCard key={order.id} order={order} />
              ))}
            </SimpleGrid>
          ) : (
            <Paper withBorder>
              {records.map((order) => (
                <div key={order.id} className={styles.listRow}>
                  <Group gap="md" wrap="nowrap">
                    <Avatar radius="xl" color="primary">
                      {order.owner.initials}
                    </Avatar>
                    <div>
                      <Text size="sm" fw={500}>
                        {order.supplier}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {order.number} · {order.category} · due {order.due}
                      </Text>
                    </div>
                  </Group>
                  <Group gap="md" wrap="nowrap">
                    <StatusBadge status={order.status} />
                    <Text size="sm" fw={600} className={styles.amount}>
                      {formatMoney(order.amount)}
                    </Text>
                    <RowMenu order={order} />
                  </Group>
                </div>
              ))}
            </Paper>
          )}
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

/** A compact people list and a record summary description list. */
export function ListAndSummary() {
  const order = ORDERS[0];
  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        <Specimen
          surface="muted"
          align="start"
          label="Compact list"
          note={
            <>
              Rows of <code>Avatar</code> + <code>Indicator</code> (status dot), name and email, a
              role <code>Badge</code> and a dimmed timestamp; hairline <code>--ds-divider</code>{' '}
              between rows.
            </>
          }
        >
          <Paper withBorder>
            <Group justify="space-between" px="md" py="sm">
              <Group gap="xs">
                <Title order={5}>Team</Title>
                <Badge color="gray">{USERS.length}</Badge>
              </Group>
              <Button size="compact-sm" variant="default" leftSection={<IconUserPlus size={14} />}>
                Invite
              </Button>
            </Group>
            <Divider />
            {USERS.map((user) => (
              <div key={user.id} className={styles.listRow}>
                <Group gap="sm" wrap="nowrap" miw={0}>
                  <Indicator
                    color={USER_STATUS[user.status].color}
                    position="bottom-end"
                    offset={5}
                    size={10}
                    withBorder
                  >
                    <Avatar radius="xl" color="primary">
                      {user.initials}
                    </Avatar>
                  </Indicator>
                  <div style={{ minWidth: 0 }}>
                    <Text size="sm" fw={500} truncate="end">
                      {user.name}
                      <VisuallyHidden> ({USER_STATUS[user.status].label})</VisuallyHidden>
                    </Text>
                    <Text size="xs" c="dimmed" truncate="end">
                      {user.email}
                    </Text>
                  </div>
                </Group>
                <Stack gap={2} align="flex-end">
                  <Badge color="gray" size="sm">
                    {user.role}
                  </Badge>
                  <Text size="xs" c="dimmed">
                    {user.lastActive}
                  </Text>
                </Stack>
              </div>
            ))}
          </Paper>
        </Specimen>

        <Specimen
          surface="muted"
          align="start"
          label="Record summary"
          note={
            <>
              A two-column <code>&lt;dl&gt;</code>: dimmed <code>xs</code> terms over{' '}
              <code>sm</code> values, with a <code>CopyButton</code> on the reference and an{' '}
              <code>Avatar.Group</code> for approvers.
            </>
          }
        >
          <Card withBorder padding="lg">
            <Group justify="space-between" align="flex-start" wrap="nowrap">
              <div>
                <Text size="xs" c="dimmed">
                  Purchase order
                </Text>
                <Group gap="sm">
                  <Title order={3}>{order.number}</Title>
                  <StatusBadge status={order.status} />
                </Group>
              </div>
              <Group gap="xs" wrap="nowrap">
                <Button variant="default" size="compact-sm" leftSection={<IconPencil size={14} />}>
                  Edit
                </Button>
                <RowMenu order={order} />
              </Group>
            </Group>
            <Divider my="md" />
            <dl className={styles.dl}>
              <div>
                <dt>Supplier</dt>
                <dd>
                  <Anchor size="sm">{order.supplier}</Anchor>
                </dd>
              </div>
              <div>
                <dt>Category</dt>
                <dd>
                  <Text size="sm">{order.category}</Text>
                </dd>
              </div>
              <div>
                <dt>Amount</dt>
                <dd>
                  <Text size="sm" fw={600}>
                    {formatMoney(order.amount)}
                  </Text>
                </dd>
              </div>
              <div>
                <dt>Due</dt>
                <dd>
                  <Text size="sm">{order.due} 2026</Text>
                </dd>
              </div>
              <div>
                <dt>Owner</dt>
                <dd>
                  <UserChip user={order.owner} size={22} />
                </dd>
              </div>
              <div>
                <dt>Approvers</dt>
                <dd>
                  <Group gap="xs" wrap="nowrap">
                    <Avatar.Group spacing="xs">
                      {[USERS[2], USERS[0], USERS[4]].map((u) => (
                        <Tooltip key={u.id} label={u.name}>
                          <Avatar size={24} radius="xl" color="primary">
                            {u.initials}
                          </Avatar>
                        </Tooltip>
                      ))}
                    </Avatar.Group>
                    <Text size="xs" c="dimmed">
                      1 of 3 approved
                    </Text>
                  </Group>
                </dd>
              </div>
              <div>
                <dt>Reference</dt>
                <dd>
                  <Group gap={4} wrap="nowrap">
                    <Text size="sm" ff="monospace">
                      NW-7F3A-2041
                    </Text>
                    <CopyButton value="NW-7F3A-2041">
                      {({ copied, copy }) => (
                        <Tooltip label={copied ? 'Copied' : 'Copy reference'}>
                          <ActionIcon
                            variant="subtle"
                            color="gray"
                            size="sm"
                            onClick={copy}
                            aria-label="Copy reference"
                          >
                            {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                          </ActionIcon>
                        </Tooltip>
                      )}
                    </CopyButton>
                  </Group>
                </dd>
              </div>
              <div>
                <dt>Last updated</dt>
                <dd>
                  <Text size="sm">{order.updated}</Text>
                </dd>
              </div>
              <div className={styles.dlFull}>
                <dt>Notes</dt>
                <dd>
                  <Text size="sm">
                    Q4 corrugated cartons for the Leeds and Rotterdam sites. Split delivery agreed —
                    60% on 04 Nov, remainder on 18 Nov.
                  </Text>
                </dd>
              </div>
            </dl>
          </Card>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

const KPI_META: Array<{ icon: Icon; tone: 'good' | 'bad' | 'neutral' }> = [
  { icon: IconChecklist, tone: 'neutral' },
  { icon: IconCurrencyDollar, tone: 'neutral' },
  { icon: IconClock, tone: 'good' },
  { icon: IconTruckDelivery, tone: 'bad' },
];
const TONE_COLOR = { good: 'green', bad: 'red', neutral: 'gray' } as const;

/** KPI stat cards with a trend badge coloured by whether the change is good. */
export function KpiCards() {
  return (
    <Gallery>
      <SpecimenGrid cols={1}>
        <Specimen
          span="full"
          surface="muted"
          label="Stat cards"
          note={
            <>
              Inter Tight <code>Title order=&#123;2&#125;</code> values; the trend{' '}
              <code>Badge</code> is coloured by meaning, not direction — faster approvals are green,
              more overdue deliveries are red, volume changes stay neutral <code>gray</code>.
            </>
          }
        >
          <SimpleGrid cols={4}>
            {KPIS.map((kpi, i) => {
              const { icon: KpiIcon, tone } = KPI_META[i];
              const Trend = kpi.trend === 'up' ? IconArrowUpRight : IconArrowDownRight;
              return (
                <Card key={kpi.label} withBorder padding="lg">
                  <Group justify="space-between" align="flex-start" wrap="nowrap">
                    <Text size="sm" c="dimmed" fw={500}>
                      {kpi.label}
                    </Text>
                    <ThemeIcon
                      variant="light"
                      color={tone === 'bad' ? 'red' : 'primary'}
                      size="md"
                      radius="md"
                    >
                      <KpiIcon size={16} />
                    </ThemeIcon>
                  </Group>
                  <Title order={2} mt="xs">
                    {kpi.value}
                  </Title>
                  <Group gap={6} mt="sm">
                    <Badge color={TONE_COLOR[tone]} leftSection={<Trend size={12} />}>
                      {kpi.delta}
                    </Badge>
                    <Text size="xs" c="dimmed">
                      {kpi.hint}
                    </Text>
                  </Group>
                </Card>
              );
            })}
          </SimpleGrid>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

function Sparkline({
  values,
  label,
  tone = 'up',
}: {
  values: number[];
  label: string;
  tone?: 'up' | 'down';
}) {
  const width = 96;
  const height = 28;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values.map((v, i) => [
    (i / (values.length - 1)) * width,
    height - 3 - ((v - min) / span) * (height - 6),
  ]);
  const [lastX, lastY] = points[points.length - 1];
  return (
    <svg
      className={styles.spark}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
    >
      <polyline
        className={styles.sparkLine}
        data-tone={tone}
        points={points.map((p) => p.join(',')).join(' ')}
      />
      <circle className={styles.sparkDot} data-tone={tone} cx={lastX} cy={lastY} r={3.5} />
    </svg>
  );
}

const SUPPLIER_TRENDS = [
  {
    name: 'Keystone Logistics',
    orders: 18,
    spend: 264,
    series: [40, 44, 39, 46, 47, 48],
  },
  {
    name: 'Atlas Packaging',
    orders: 24,
    spend: 157,
    series: [22, 25, 24, 28, 27, 31],
  },
  {
    name: 'Cobalt IT Services',
    orders: 6,
    spend: 120,
    series: [18, 18, 19, 21, 22, 22],
  },
  { name: 'Meridian Foods', orders: 11, spend: 47, series: [9, 8, 8, 7, 8, 7] },
  {
    name: 'Brightline Electrical',
    orders: 9,
    spend: 21,
    series: [4, 3, 5, 3, 3, 3],
  },
];

/** Same budget the "Spend this month" KPI card quotes. */
const MONTHLY_BUDGET_K = 520;

/** A bar chart, a category breakdown and sparklines composed from core parts. */
export function Charts() {
  const max = 450;
  const last = MONTHLY_SPEND[MONTHLY_SPEND.length - 1];
  const budgetShare = Math.round((last.value / MONTHLY_BUDGET_K) * 100);
  const byCategory = Object.entries(
    PAGE_ORDERS.filter((o) => o.status !== 'cancelled').reduce<Record<string, number>>((acc, o) => {
      acc[o.category] = (acc[o.category] ?? 0) + o.amount;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);
  const categoryTotal = byCategory.reduce((sum, [, v]) => sum + v, 0);

  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        <Specimen
          surface="muted"
          align="start"
          label="Bar chart (composed)"
          note={
            <>
              Built from <code>Box</code>-level divs and <code>Tooltip</code> — no chart library
              ships with the kit. Past months <code>--ds-primary-200</code>, the current month{' '}
              <code>--ds-primary</code>, 4px rounded tops, dashed <code>--ds-divider</code> grid.
            </>
          }
        >
          <Card withBorder padding="lg">
            <Group justify="space-between" align="flex-start" gap="sm">
              <div>
                <Text size="sm" c="dimmed" fw={500}>
                  Monthly spend
                </Text>
                <Title order={2}>${last.value}k</Title>
                <Badge color="gray" mt={6}>
                  {budgetShare}% of ${MONTHLY_BUDGET_K}k budget
                </Badge>
              </div>
              <Select
                aria-label="Range"
                size="xs"
                w={164}
                data={['Last 6 months', 'Last 12 months', 'Year to date']}
                defaultValue="Last 6 months"
                allowDeselect={false}
              />
            </Group>
            <div
              className={styles.chart}
              style={{ '--bars': MONTHLY_SPEND.length } as CSSProperties}
            >
              <div className={styles.gridLines} aria-hidden>
                <span />
                <span />
                <span />
                <span />
              </div>
              {MONTHLY_SPEND.map((m) => {
                const current = m === last;
                return (
                  <div key={m.month} className={styles.barSlot}>
                    {current && <span className={styles.barValue}>${m.value}k</span>}
                    <Tooltip label={`${m.month}: $${m.value}k`}>
                      <div
                        className={styles.bar}
                        data-current={current || undefined}
                        style={{ height: `${(m.value / max) * 100}%` }}
                        role="img"
                        aria-label={`${m.month}: $${m.value}k`}
                      />
                    </Tooltip>
                  </div>
                );
              })}
            </div>
            <div
              className={styles.barLabels}
              style={{ '--bars': MONTHLY_SPEND.length } as CSSProperties}
              aria-hidden
            >
              {MONTHLY_SPEND.map((m) => (
                <span key={m.month}>{m.month}</span>
              ))}
            </div>
          </Card>
        </Specimen>

        <Specimen
          surface="muted"
          align="start"
          label="Breakdown (Progress)"
          note={
            <>
              Share of open spend per category as <code>Progress size=&quot;sm&quot;</code> in the
              ember <code>primaryColor</code>; values stay in ink text, never in the bar colour.
            </>
          }
        >
          <Card withBorder padding="lg">
            <Text size="sm" c="dimmed" fw={500}>
              Open spend by category
            </Text>
            <Title order={2}>{formatMoney(categoryTotal)}</Title>
            <Stack gap="md" mt="lg">
              {byCategory.slice(0, 6).map(([name, value]) => {
                const pct = Math.round((value / categoryTotal) * 100);
                return (
                  <div key={name}>
                    <Group justify="space-between" mb={6}>
                      <Text size="sm">{name}</Text>
                      <Text size="sm" fw={500} className={styles.amount}>
                        {formatMoney(value)}{' '}
                        <Text span size="xs" c="dimmed">
                          {pct}%
                        </Text>
                      </Text>
                    </Group>
                    <Progress value={pct} size="sm" aria-label={`${name}: ${pct}% of open spend`} />
                  </div>
                );
              })}
            </Stack>
          </Card>
        </Specimen>

        <Specimen
          span="full"
          surface="muted"
          label="Sparklines in a table"
          note={
            <>
              A 96×28 SVG polyline stroked with <code>--ds-primary</code> (falling series in{' '}
              <code>--ds-gray-400</code>) and an end dot — trend at a glance next to the numbers it
              summarises.
            </>
          }
        >
          <Paper withBorder>
            <Table verticalSpacing="sm" withTableBorder={false} highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Supplier</Table.Th>
                  <Table.Th className={styles.amount}>Orders</Table.Th>
                  <Table.Th className={styles.amount}>Spend (6 mo)</Table.Th>
                  <Table.Th>Trend</Table.Th>
                  <Table.Th className={styles.amount}>Change</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {SUPPLIER_TRENDS.map((s) => {
                  const first = s.series[0];
                  const end = s.series[s.series.length - 1];
                  const delta = Math.round(((end - first) / first) * 100);
                  const tone = delta >= 0 ? 'up' : 'down';
                  return (
                    <Table.Tr key={s.name}>
                      <Table.Td>
                        <Text size="sm" fw={500}>
                          {s.name}
                        </Text>
                      </Table.Td>
                      <Table.Td className={styles.amount}>{s.orders}</Table.Td>
                      <Table.Td className={styles.amount}>${s.spend}k</Table.Td>
                      <Table.Td>
                        <Sparkline
                          values={s.series}
                          tone={tone}
                          label={`${s.name} spend trend, ${delta >= 0 ? 'up' : 'down'} ${Math.abs(
                            delta
                          )}% over six months`}
                        />
                      </Table.Td>
                      <Table.Td className={styles.amount}>
                        <Badge
                          color="gray"
                          leftSection={
                            tone === 'up' ? (
                              <IconArrowUpRight size={12} />
                            ) : (
                              <IconArrowDownRight size={12} />
                            )
                          }
                        >
                          {delta >= 0 ? '+' : ''}
                          {delta}%
                        </Badge>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Paper>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

interface Comment {
  id: string;
  user: MockUser;
  time: string;
  body: string;
  likes: number;
  replies?: Comment[];
}

const INITIAL_COMMENTS: Comment[] = [
  {
    id: 'c1',
    user: USERS[2],
    time: '2 hours ago',
    body: 'Freight quote is 6% over the framework rate. Can we ask Keystone to match the Q3 price before I approve?',
    likes: 2,
    replies: [
      {
        id: 'c2',
        user: USERS[1],
        time: '1 hour ago',
        body: 'Asked them this morning — they agreed to $48,200. Line items are updated.',
        likes: 1,
      },
    ],
  },
  {
    id: 'c3',
    user: USERS[4],
    time: '40 min ago',
    body: 'Delivery window works for the Leeds site. Rotterdam needs a 48h heads-up for dock booking.',
    likes: 0,
  },
];

function CommentItem({ comment, nested }: { comment: Comment; nested?: boolean }) {
  const [liked, setLiked] = useState(false);
  return (
    <Group align="flex-start" gap="sm" wrap="nowrap" pl={nested ? 44 : 0}>
      <Avatar radius="xl" color="primary" size={nested ? 28 : 32}>
        {comment.user.initials}
      </Avatar>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Group gap="xs">
          <Text size="sm" fw={600}>
            {comment.user.name}
          </Text>
          <Text size="xs" c="dimmed">
            {comment.time}
          </Text>
        </Group>
        <Text size="sm" mt={2}>
          {comment.body}
        </Text>
        <Group gap={4} mt={6}>
          <Button
            variant={liked ? 'light' : 'subtle'}
            color="gray"
            size="compact-xs"
            leftSection={<IconThumbUp size={14} />}
            onClick={() => setLiked((l) => !l)}
            aria-pressed={liked}
          >
            {comment.likes + (liked ? 1 : 0)}
          </Button>
          {!nested && (
            <Button variant="subtle" color="gray" size="compact-xs">
              Reply
            </Button>
          )}
        </Group>
      </div>
    </Group>
  );
}

const ACTIVITY_ICONS: Record<string, Icon> = {
  approved: IconCheck,
  submitted: IconSend,
  invited: IconUserPlus,
  'commented on': IconMessageCircle,
};

/** Activity timeline and a comment thread with a working reply box. */
export function FeedAndComments() {
  const [filter, setFilter] = useState('All');
  const [comments, setComments] = useState<Comment[]>(INITIAL_COMMENTS);
  const [draft, setDraft] = useState('');
  const items =
    filter === 'All'
      ? ACTIVITY
      : ACTIVITY.filter((a) =>
          filter === 'Approvals'
            ? a.action === 'approved' || a.action === 'submitted'
            : a.action.startsWith('commented')
        );

  const post = () => {
    if (!draft.trim()) return;
    setComments((cur) => [
      ...cur,
      {
        id: `c${Date.now()}`,
        user: CURRENT_USER,
        time: 'Just now',
        body: draft.trim(),
        likes: 0,
      },
    ]);
    setDraft('');
  };

  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        <Specimen
          surface="muted"
          align="start"
          label="Activity feed"
          note={
            <>
              <code>Timeline</code> with an icon per action; <code>active=&#123;0&#125;</code> fills
              the newest bullet in ember, older ones stay outlined. Targets are <code>Anchor</code>s
              in <code>--ds-accent-text</code>.
            </>
          }
        >
          <Card withBorder padding="lg">
            <Group justify="space-between" mb="lg">
              <Title order={4}>Activity</Title>
              <SegmentedControl
                size="xs"
                aria-label="Filter activity"
                data={['All', 'Approvals', 'Comments']}
                value={filter}
                onChange={setFilter}
              />
            </Group>
            <Timeline active={0} bulletSize={26} lineWidth={2}>
              {items.map((a) => (
                <Timeline.Item
                  key={a.id}
                  bullet={(() => {
                    const ActionIconGlyph = ACTIVITY_ICONS[a.action] ?? IconMessageCircle;
                    return <ActionIconGlyph size={14} />;
                  })()}
                  title={
                    <Text size="sm">
                      <Text span fw={600} inherit>
                        {a.user.name}
                      </Text>{' '}
                      {a.action} <Anchor inherit>{a.target}</Anchor>
                    </Text>
                  }
                >
                  <Text size="xs" c="dimmed" mt={2}>
                    {a.time}
                  </Text>
                </Timeline.Item>
              ))}
            </Timeline>
            <Button
              variant="subtle"
              color="gray"
              size="compact-sm"
              mt="lg"
              rightSection={<IconChevronRight size={14} />}
            >
              View all activity
            </Button>
          </Card>
        </Specimen>

        <Specimen
          surface="muted"
          align="start"
          label="Comments thread"
          note={
            <>
              Nested replies indent under the parent avatar; the reply box is a{' '}
              <code>Textarea autosize</code> whose ink <code>Button</code> stays disabled until
              there is text. Try posting one.
            </>
          }
        >
          <Card withBorder padding="lg">
            <Group gap="xs" mb="lg">
              <Title order={4}>Comments</Title>
              <Badge color="gray">
                {comments.reduce((n, c) => n + 1 + (c.replies?.length ?? 0), 0)}
              </Badge>
            </Group>
            <Stack gap="lg">
              {comments.map((c) => (
                <Stack key={c.id} gap="md">
                  <CommentItem comment={c} />
                  {c.replies?.map((r) => (
                    <CommentItem key={r.id} comment={r} nested />
                  ))}
                </Stack>
              ))}
            </Stack>
            <Divider my="lg" />
            <Group align="flex-start" gap="sm" wrap="nowrap">
              <Avatar radius="xl" color="primary" size={32}>
                {CURRENT_USER.initials}
              </Avatar>
              <Stack gap="xs" className={styles.composer}>
                <Textarea
                  aria-label="Write a comment"
                  placeholder="Write a comment… use @ to mention someone"
                  autosize
                  minRows={2}
                  maxRows={6}
                  value={draft}
                  onChange={(e) => setDraft(e.currentTarget.value)}
                />
                <Group justify="space-between">
                  <Group gap={4}>
                    <ActionIcon variant="subtle" color="gray" aria-label="Attach a file">
                      <IconPaperclip size={16} />
                    </ActionIcon>
                    <ActionIcon variant="subtle" color="gray" aria-label="Mention someone">
                      <IconAt size={16} />
                    </ActionIcon>
                  </Group>
                  <Button size="compact-sm" disabled={!draft.trim()} onClick={post}>
                    Comment
                  </Button>
                </Group>
              </Stack>
            </Group>
          </Card>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

const BOARD_COLUMNS: OrderStatus[] = ['draft', 'pending', 'approved', 'shipped'];

/** A kanban board of orders by status; cards move between columns from their menu. */
export function KanbanBoard() {
  const [statusById, setStatusById] = useState<Record<string, OrderStatus>>(() =>
    Object.fromEntries(PAGE_ORDERS.map((o) => [o.id, o.status]))
  );
  const records = PAGE_ORDERS.filter((o) => statusById[o.id] !== 'cancelled');

  return (
    <Gallery>
      <SpecimenGrid cols={1}>
        <Specimen
          span="full"
          label="Board by status"
          note={
            <>
              Columns on <code>--ds-body-bg</code> with a status <code>Badge</code> and count; cards
              are <code>Paper withBorder shadow=&quot;xs&quot;</code>. Use a card&apos;s menu to
              move it — an empty column shows a dashed drop target.
            </>
          }
        >
          <div className={styles.board}>
            {BOARD_COLUMNS.map((column) => {
              const cards = records.filter((o) => statusById[o.id] === column);
              const total = cards.reduce((sum, o) => sum + o.amount, 0);
              return (
                <section
                  key={column}
                  className={styles.column}
                  aria-label={ORDER_STATUS[column].label}
                >
                  <Group justify="space-between" wrap="nowrap" mb={4}>
                    <Group gap="xs" wrap="nowrap" style={{ flexShrink: 0 }}>
                      <Badge color={ORDER_STATUS[column].color}>{ORDER_STATUS[column].label}</Badge>
                      <Text size="xs" c="dimmed" fw={500}>
                        {cards.length}
                      </Text>
                    </Group>
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      size="sm"
                      aria-label={`Add order to ${ORDER_STATUS[column].label}`}
                    >
                      <IconPlus size={14} />
                    </ActionIcon>
                  </Group>
                  {cards.length === 0 ? (
                    <div className={styles.dropZone}>No orders — drop one here</div>
                  ) : (
                    cards.map((order) => (
                      <Paper key={order.id} withBorder shadow="xs" p="sm">
                        <Group justify="space-between" wrap="nowrap">
                          <Text size="xs" c="dimmed" fw={500}>
                            {order.number}
                          </Text>
                          <Group gap={2} wrap="nowrap">
                            <Tooltip label={order.owner.name}>
                              <Avatar size={22} radius="xl" color="primary">
                                {order.owner.initials}
                              </Avatar>
                            </Tooltip>
                            <Menu position="bottom-end" width={190}>
                              <Menu.Target>
                                <ActionIcon
                                  variant="subtle"
                                  color="gray"
                                  size="sm"
                                  aria-label={`Actions for ${order.number}`}
                                >
                                  <IconDots size={14} />
                                </ActionIcon>
                              </Menu.Target>
                              <Menu.Dropdown>
                                <Menu.Label>Move to</Menu.Label>
                                {BOARD_COLUMNS.filter((c) => c !== column).map((target) => (
                                  <Menu.Item
                                    key={target}
                                    leftSection={<IconChevronRight size={14} />}
                                    onClick={() =>
                                      setStatusById((cur) => ({
                                        ...cur,
                                        [order.id]: target,
                                      }))
                                    }
                                  >
                                    {ORDER_STATUS[target].label}
                                  </Menu.Item>
                                ))}
                                <Menu.Divider />
                                <Menu.Item
                                  color="red"
                                  leftSection={<IconBan size={14} />}
                                  onClick={() =>
                                    setStatusById((cur) => ({
                                      ...cur,
                                      [order.id]: 'cancelled',
                                    }))
                                  }
                                >
                                  Cancel order
                                </Menu.Item>
                              </Menu.Dropdown>
                            </Menu>
                          </Group>
                        </Group>
                        <Text size="sm" fw={500} mt={2} truncate="end">
                          {order.supplier}
                        </Text>
                        {column === 'pending' && (
                          <>
                            <Group justify="space-between" mt="xs" mb={4}>
                              <Text size="xs" c="dimmed">
                                Approvals
                              </Text>
                              <Text size="xs" fw={500}>
                                1 of 3
                              </Text>
                            </Group>
                            <Progress value={33} size="xs" aria-label="1 of 3 approvals" />
                          </>
                        )}
                        <Group justify="space-between" mt="sm" wrap="nowrap">
                          <Group gap={4} wrap="nowrap" c="dimmed">
                            <IconCalendar size={13} />
                            <Text size="xs" c="dimmed">
                              {order.due}
                            </Text>
                          </Group>
                          <Text size="sm" fw={600}>
                            {formatMoney(order.amount)}
                          </Text>
                        </Group>
                      </Paper>
                    ))
                  )}
                  {cards.length > 0 && (
                    <Text size="xs" c="dimmed" ta="right" mt={2}>
                      {formatMoney(total)} total
                    </Text>
                  )}
                </section>
              );
            })}
          </div>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}
