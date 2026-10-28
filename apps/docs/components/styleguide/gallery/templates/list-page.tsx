'use client';

import {
  ActionIcon,
  Alert,
  Anchor,
  Avatar,
  Badge,
  Burger,
  Button,
  Checkbox,
  Collapse,
  Group,
  Menu,
  NumberInput,
  Pagination,
  Paper,
  Select,
  Skeleton,
  Stack,
  Table,
  Text,
  TextInput,
  ThemeIcon,
  Title,
  Tooltip,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconAlignCenter,
  IconAlignLeft,
  IconAlignRight,
  IconCheck,
  IconChecklist,
  IconEyeOff,
  IconFilter,
  IconFilterOff,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconSortAscending,
  IconSortDescending,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import { useMemo, useState, type ReactNode } from 'react';
import { AppShellFrame } from '../AppShellFrame';
import { Gallery } from '../Gallery';
import { BrowserFrame, Specimen, SpecimenGrid } from '../Layout';
import { PAGE_ORDERS, ORDER_STATUS, formatMoney, type MockOrder, type MockUser, type OrderStatus } from '../data';
import styles from './list-page.module.css';

/* ── Page-specific mock data ─────────────────────────────────── */

const TOTAL = 128;
const PER_PAGE = 10;
const TOTAL_PAGES = Math.ceil(TOTAL / PER_PAGE);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "31 Oct" → a sortable number; orders with no due date sort last. */
function dueKey(due: string): number {
  const [day, month] = due.split(' ');
  const m = MONTHS.indexOf(month);
  return m < 0 ? Number.POSITIVE_INFINITY : m * 100 + Number(day);
}

/** The two rules applied in the "filters open" frame: amount ≥ $10,000 and due before 1 Nov. */
const MIN_AMOUNT = 10000;
const DUE_BEFORE = '2026-11-01';
const FILTERED_ORDERS = PAGE_ORDERS.filter((o) => o.amount >= MIN_AMOUNT && dueKey(o.due) < dueKey('01 Nov'));

/** FilterPanel's operator lists for a number and a date field (`getOperatorsForType`). */
const NUMBER_OPERATORS = ['Equals', 'Not equals', 'Greater than', 'Greater or equal', 'Less than', 'Less or equal', 'Is null', 'Is not null'];
const DATE_OPERATORS = ['Equals', 'Not equals', 'After', 'On or after', 'Before', 'On or before', 'Is null', 'Is not null'];
const FILTER_FIELDS = ['Order', 'Supplier', 'Owner', 'Status', 'Due', 'Amount'];

/** Fields hidden from the table, offered by the header's "Add field" menu. */
const HIDDEN_FIELDS = ['Due', 'Category', 'Updated', 'Created by'];

/** Pinned-open overlays keep their side and stay in place, with no portal or focus trap. */
const PINNED = {
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

const COMBOBOX_PINNED = {
  withinPortal: false,
  hideDetached: false,
  middlewares: { flip: false, shift: false },
  transitionProps: { duration: 0 },
} as const;

/** Names Pagination's arrow controls, which ship without an accessible name. */
function pagerLabel(control: 'first' | 'previous' | 'last' | 'next') {
  return { 'aria-label': `${control[0].toUpperCase()}${control.slice(1)} page` };
}

/* ── Cells (the page's renderCell for owner and status) ──────── */

/** UserAvatar's rule: active users in the brand colour, everyone else neutral. */
function OwnerCell({ user }: { user: MockUser }) {
  return (
    <Tooltip label={user.name}>
      <Avatar size={28} radius="xl" color={user.status === 'active' ? 'primary' : 'gray'} aria-label={user.name}>
        {user.initials}
      </Avatar>
    </Tooltip>
  );
}

function StatusBadge({ status }: { status: OrderStatus }) {
  return <Badge color={ORDER_STATUS[status].color}>{ORDER_STATUS[status].label}</Badge>;
}

/* ── CollectionList parts ────────────────────────────────────── */

/** The page around the list: a title, a one-line description and the ink CTA. */
function PageHeader({ cta = true }: { cta?: boolean }) {
  return (
    <div className={styles.header}>
      <div className={styles.headerText}>
        <Title order={2}>Purchase orders</Title>
        <Text c="dimmed" size="sm" mt={4}>
          Raise, approve and track supplier orders.
        </Text>
      </div>
      {cta && <Button leftSection={<IconPlus size={16} />}>New order</Button>}
    </div>
  );
}

/** CollectionListToolbar's search: `size="sm"`, 250px, with a clear button once something is typed. */
function SearchField({ value, onChange }: { value: string; onChange?: (v: string) => void }) {
  return (
    <TextInput
      className={styles.search}
      size="sm"
      aria-label="Search purchase orders"
      placeholder="Search..."
      leftSection={<IconSearch size={16} />}
      value={value}
      onChange={(e) => onChange?.(e.currentTarget.value)}
      rightSection={
        value ? (
          <ActionIcon variant="subtle" size="xs" aria-label="Clear search" onClick={() => onChange?.('')}>
            <IconX size={12} />
          </ActionIcon>
        ) : undefined
      }
    />
  );
}

/**
 * The filter toggle (`enableFilter`): subtle when idle, filled ember with a red
 * count badge when rules apply. The badge sits beside the ActionIcon, whose
 * root clips overflow, so the whole count stays visible.
 */
function FilterToggle({ count, open, onClick }: { count: number; open?: boolean; onClick?: () => void }) {
  return (
    <span className={styles.filterWrap}>
      <Tooltip label={open ? 'Hide filters' : 'Show filters'}>
        <ActionIcon
          variant={count > 0 ? 'filled' : 'subtle'}
          color={count > 0 ? 'primary' : undefined}
          aria-label={count > 0 ? `Toggle filter panel, ${count} active` : 'Toggle filter panel'}
          aria-expanded={open}
          onClick={onClick}
        >
          <IconFilter size={16} />
        </ActionIcon>
      </Tooltip>
      {count > 0 && (
        <Badge size="xs" circle color="red" variant="filled" className={styles.filterBadge} aria-hidden>
          {count}
        </Badge>
      )}
    </span>
  );
}

function RefreshButton() {
  return (
    <ActionIcon variant="subtle" title="Refresh" aria-label="Refresh">
      <IconRefresh size={16} />
    </ActionIcon>
  );
}

/** BulkActionsBar, inline on the toolbar's right: count badge, the page's bulk actions, clear. */
function BulkActions({ count, onClear }: { count: number; onClear?: () => void }) {
  return (
    <Group gap="xs">
      <Badge variant="light" size="lg">
        {count} selected
      </Badge>
      <Button variant="light" size="compact-sm" leftSection={<IconCheck size={16} />}>
        Approve
      </Button>
      <Button variant="light" color="red" size="compact-sm" leftSection={<IconTrash size={16} />}>
        Delete
      </Button>
      <ActionIcon variant="subtle" title="Clear selection" aria-label="Clear selection" onClick={onClear}>
        <IconX size={16} />
      </ActionIcon>
    </Group>
  );
}

function Toolbar({
  search = '',
  onSearchChange,
  filterCount = 0,
  filterOpen,
  onToggleFilter,
  selectedCount = 0,
  onClearSelection,
}: {
  search?: string;
  onSearchChange?: (v: string) => void;
  filterCount?: number;
  filterOpen?: boolean;
  onToggleFilter?: () => void;
  selectedCount?: number;
  onClearSelection?: () => void;
}) {
  return (
    <div className={styles.toolbar}>
      <Group gap="xs">
        <SearchField value={search} onChange={onSearchChange} />
        <FilterToggle count={filterCount} open={filterOpen} onClick={onToggleFilter} />
        <RefreshButton />
      </Group>
      {selectedCount > 0 && <BulkActions count={selectedCount} onClear={onClearSelection} />}
    </div>
  );
}

function AddFieldItems() {
  return (
    <>
      <Menu.Label>Add field</Menu.Label>
      {HIDDEN_FIELDS.map((field) => (
        <Menu.Item key={field}>{field}</Menu.Item>
      ))}
    </>
  );
}

/** VTable's header append slot (`enableAddField`): a small subtle "+" opening the hidden fields. */
function AddFieldMenu() {
  return (
    <Menu position="bottom-end" withArrow shadow="md">
      <Menu.Target>
        <ActionIcon variant="subtle" size="sm" title="Add field" aria-label="Add field">
          <IconPlus size={16} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <AddFieldItems />
      </Menu.Dropdown>
    </Menu>
  );
}

const COLUMN_COUNT = 7;

/** One full-width body row, for VTable's loading, empty and error bodies. */
function BodyMessage({ children }: { children: ReactNode }) {
  return (
    <Table.Tr>
      <Table.Td colSpan={COLUMN_COUNT}>{children}</Table.Td>
    </Table.Tr>
  );
}

/**
 * VTable as CollectionList composes it: a select column at the default
 * Checkbox size, one column per field, the "Add field" append and 48px rows.
 */
function OrdersTable({
  rows,
  selected = [],
  onSelectedChange,
  body,
  minWidth,
}: {
  /** Keeps every column at phone width, so the table scrolls sideways as VTable does. */
  minWidth?: boolean;
  rows: MockOrder[];
  selected?: string[];
  onSelectedChange?: (ids: string[]) => void;
  /** Replaces the rows: VTable's loading, empty or error body. */
  body?: ReactNode;
}) {
  const allSelected = rows.length > 0 && rows.every((r) => selected.includes(r.id));
  const someSelected = rows.some((r) => selected.includes(r.id));
  return (
    <div className={styles.tableScroll}>
      <Table
        highlightOnHover={!body}
        withTableBorder={false}
        verticalSpacing="sm"
        className={minWidth ? styles.wideTable : undefined}
      >
        <Table.Thead>
          <Table.Tr>
            <Table.Th className={styles.checkCell}>
              <Checkbox
                aria-label="Select all"
                checked={allSelected}
                indeterminate={someSelected && !allSelected}
                disabled={rows.length === 0}
                onChange={() => onSelectedChange?.(allSelected ? [] : rows.map((r) => r.id))}
              />
            </Table.Th>
            <Table.Th>Order</Table.Th>
            <Table.Th>Supplier</Table.Th>
            <Table.Th>Owner</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th className={styles.amount}>Amount</Table.Th>
            <Table.Th className={styles.appendCell}>
              <AddFieldMenu />
            </Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {body ??
            rows.map((order) => {
              const isSelected = selected.includes(order.id);
              return (
                <Table.Tr key={order.id} className={styles.row}>
                  <Table.Td>
                    <Checkbox
                      aria-label={`Select ${order.number}`}
                      checked={isSelected}
                      onChange={(e) => {
                        const checked = e.currentTarget.checked;
                        onSelectedChange?.(checked ? [...selected, order.id] : selected.filter((id) => id !== order.id));
                      }}
                    />
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" fw={500} className={styles.nowrap}>
                      {order.number}
                    </Text>
                  </Table.Td>
                  <Table.Td className={styles.supplierCell}>
                    <Text size="sm" truncate="end">
                      {order.supplier}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <OwnerCell user={order.owner} />
                  </Table.Td>
                  <Table.Td>
                    <StatusBadge status={order.status} />
                  </Table.Td>
                  <Table.Td className={styles.amount}>
                    <Text size="sm">{formatMoney(order.amount)}</Text>
                  </Table.Td>
                  <Table.Td />
                </Table.Tr>
              );
            })}
        </Table.Tbody>
      </Table>
    </div>
  );
}

/** CollectionListFooter: the item count, "Per page" with a bare-number Select, and pagination. */
function ListFooter({ label, totalPages }: { label: string; totalPages: number }) {
  return (
    <div className={styles.footer}>
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Group gap="sm">
        <Group gap={4} wrap="nowrap">
          <Text size="xs" c="dimmed">
            Per page
          </Text>
          <Select
            className={styles.perPage}
            size="xs"
            aria-label="Per page"
            data={['10', '25', '50', '100']}
            defaultValue={String(PER_PAGE)}
            allowDeselect={false}
          />
        </Group>
        {totalPages > 1 && <Pagination size="sm" total={totalPages} defaultValue={1} getControlProps={pagerLabel} />}
      </Group>
    </div>
  );
}

/** The list card (CollectionList's `.collection-list` root). */
function ListCard({ children }: { children: ReactNode }) {
  return (
    <Paper withBorder shadow="sm" radius="md" className={styles.list}>
      {children}
    </Paper>
  );
}

/** One FilterPanel rule: field, operator, value and a remove button, all `size="xs"`. */
function FilterRule({
  field,
  operators,
  operator,
  value,
}: {
  field: string;
  operators: string[];
  operator: string;
  value: ReactNode;
}) {
  return (
    <Group gap="xs" wrap="nowrap">
      <Select
        className={styles.ruleSelect}
        size="xs"
        aria-label="Field"
        data={FILTER_FIELDS}
        defaultValue={field}
        allowDeselect={false}
        searchable
      />
      <Select
        className={styles.ruleSelect}
        size="xs"
        aria-label="Operator"
        data={operators}
        defaultValue={operator}
        allowDeselect={false}
      />
      {value}
      <ActionIcon variant="subtle" color="red" size="sm" title="Remove filter" aria-label="Remove filter">
        <IconTrash size={14} />
      </ActionIcon>
    </Group>
  );
}

/**
 * The inline filter panel `enableFilter` adds under the toolbar: a "Filters"
 * title with Clear all, the rules, the ALL / ANY match toggle and "Add filter".
 */
function FilterPanel({ withRules }: { withRules: boolean }) {
  const [match, setMatch] = useState<'all' | 'any'>('all');
  return (
    <div className={styles.filterPanel}>
      <Group justify="space-between" mb="xs">
        <Text size="sm" fw={600}>
          Filters
        </Text>
        {withRules && (
          <Button variant="subtle" size="compact-xs" leftSection={<IconFilterOff size={14} />}>
            Clear all
          </Button>
        )}
      </Group>
      <Stack gap="xs">
        {withRules ? (
          <>
            <Group gap="xs">
              <Text size="xs" c="dimmed">
                Match
              </Text>
              <Button size="compact-xs" variant={match === 'all' ? 'filled' : 'outline'} onClick={() => setMatch('all')}>
                ALL
              </Button>
              <Button size="compact-xs" variant={match === 'any' ? 'filled' : 'outline'} onClick={() => setMatch('any')}>
                ANY
              </Button>
            </Group>
            <Stack gap={6}>
              <FilterRule
                field="Amount"
                operators={NUMBER_OPERATORS}
                operator="Greater or equal"
                value={
                  <NumberInput
                    className={styles.ruleValue}
                    size="xs"
                    aria-label="Value"
                    placeholder="Value..."
                    defaultValue={MIN_AMOUNT}
                  />
                }
              />
              <FilterRule
                field="Due"
                operators={DATE_OPERATORS}
                operator="Before"
                value={
                  <TextInput
                    className={styles.ruleValue}
                    size="xs"
                    aria-label="Value"
                    placeholder="YYYY-MM-DD"
                    defaultValue={DUE_BEFORE}
                  />
                }
              />
            </Stack>
          </>
        ) : (
          <Text size="sm" c="dimmed">
            No filter rules. Click &quot;Add filter&quot; to get started.
          </Text>
        )}
        <Group gap="xs">
          <Menu position="bottom-start" withArrow shadow="sm">
            <Menu.Target>
              <Button variant="subtle" size="xs" leftSection={<IconPlus size={14} />}>
                Add filter
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              {FILTER_FIELDS.map((field) => (
                <Menu.Item key={field}>{field}</Menu.Item>
              ))}
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Stack>
    </div>
  );
}

/** "1–10 of 128 items", CollectionList's item count. */
const RANGE_LABEL = `1–${PER_PAGE} of ${TOTAL} items`;

/* ── Templates ───────────────────────────────────────────────── */

/**
 * The Purchase orders page: a title and the ink CTA above CollectionList with
 * two rows selected. Live: search, selection, the filter panel and menus.
 */
export function ListPageTemplate() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>(['o1', 'o3']);
  const [filterOpen, setFilterOpen] = useState(false);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return PAGE_ORDERS.filter((o) => !q || `${o.number} ${o.supplier} ${o.category}`.toLowerCase().includes(q));
  }, [search]);

  const searching = search.trim().length > 0;
  const label = searching
    ? rows.length === 0
      ? 'No items'
      : `${rows.length} ${rows.length === 1 ? 'item' : 'items'} (filtered from ${TOTAL})`
    : RANGE_LABEL;

  return (
    <Gallery>
      <BrowserFrame url="/en/orders" height={920}>
        <AppShellFrame active="/orders">
          <div className={styles.page}>
            <PageHeader />
            <ListCard>
              <Toolbar
                search={search}
                onSearchChange={setSearch}
                filterOpen={filterOpen}
                onToggleFilter={() => setFilterOpen((v) => !v)}
                selectedCount={selected.length}
                onClearSelection={() => setSelected([])}
              />
              <Collapse in={filterOpen}>
                <FilterPanel withRules={false} />
              </Collapse>
              <OrdersTable
                rows={rows}
                selected={selected}
                onSelectedChange={setSelected}
                body={
                  rows.length === 0 ? (
                    <BodyMessage>
                      <Text c="dimmed" ta="center" py="xl">
                        No results — try adjusting your search or filters
                      </Text>
                    </BodyMessage>
                  ) : undefined
                }
              />
              <ListFooter label={label} totalPages={searching ? 1 : TOTAL_PAGES} />
            </ListCard>
          </div>
        </AppShellFrame>
      </BrowserFrame>
    </Gallery>
  );
}

/** The inline filter panel open with two rules; the filter toggle carries the count and the footer says what was filtered out. */
export function ListPageFiltered() {
  return (
    <Gallery>
      <BrowserFrame url="/en/orders" height={720}>
        <AppShellFrame active="/orders">
          <div className={styles.page}>
            <PageHeader />
            <ListCard>
              <Toolbar filterCount={2} filterOpen />
              <FilterPanel withRules />
              <OrdersTable rows={FILTERED_ORDERS} />
              <ListFooter label={`${FILTERED_ORDERS.length} items (filtered from ${TOTAL})`} totalPages={1} />
            </ListCard>
          </div>
        </AppShellFrame>
      </BrowserFrame>
    </Gallery>
  );
}

/** A search that matches nothing: VTable keeps its header and says so in one dimmed line. */
export function ListPageEmpty() {
  const [search, setSearch] = useState('kestrel');
  const searching = search.trim().length > 0;
  return (
    <Gallery>
      <BrowserFrame url="/en/orders" height={520}>
        <AppShellFrame active="/orders">
          <div className={styles.page}>
            <PageHeader />
            <ListCard>
              <Toolbar search={search} onSearchChange={setSearch} />
              <OrdersTable
                rows={searching ? [] : PAGE_ORDERS.slice(0, 3)}
                body={
                  searching ? (
                    <BodyMessage>
                      <Text c="dimmed" ta="center" py="xl">
                        No results — try adjusting your search or filters
                      </Text>
                    </BodyMessage>
                  ) : undefined
                }
              />
              <ListFooter label={searching ? 'No items' : RANGE_LABEL} totalPages={searching ? 1 : TOTAL_PAGES} />
            </ListCard>
          </div>
        </AppShellFrame>
      </BrowserFrame>
    </Gallery>
  );
}

/** First load: the toolbar is ready, VTable shows its loading line over three skeleton rows, and the footer says "Loading...". */
export function ListPageLoading() {
  return (
    <Gallery>
      <BrowserFrame url="/en/orders" height={600}>
        <AppShellFrame active="/orders">
          <div className={styles.page}>
            <PageHeader />
            <ListCard>
              <Toolbar />
              <OrdersTable
                rows={[]}
                body={
                  <BodyMessage>
                    <Stack gap="xs" py="md" aria-busy="true">
                      <Text c="dimmed" ta="center" size="sm">
                        Loading items...
                      </Text>
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} height={48} />
                      ))}
                    </Stack>
                  </BodyMessage>
                }
              />
              <ListFooter label="Loading..." totalPages={0} />
            </ListCard>
          </div>
        </AppShellFrame>
      </BrowserFrame>
    </Gallery>
  );
}

/**
 * A collection with no records yet. The page renders its own first-run panel
 * in place of the list; CollectionList on its own would show "No items in
 * this collection".
 */
export function ListPageFirstRun() {
  return (
    <Gallery>
      <BrowserFrame url="/en/orders" height={520}>
        <AppShellFrame active="/orders" hideNavBadges>
          <div className={styles.page}>
            <PageHeader cta={false} />
            <Paper withBorder shadow="sm" radius="md" className={styles.firstRun}>
              <Stack align="center" gap="xs" maw={420}>
                <ThemeIcon variant="light" size={56} radius="xl">
                  <IconChecklist size={28} />
                </ThemeIcon>
                <Title order={3} mt="xs" ta="center">
                  No purchase orders yet
                </Title>
                <Text size="sm" c="dimmed" ta="center">
                  Raise your first order to send it for approval. Everything your team orders will be listed here.
                </Text>
                <Group gap="sm" mt="sm" justify="center">
                  <Button leftSection={<IconPlus size={16} />}>New order</Button>
                  <Button variant="default">Import CSV</Button>
                </Group>
                <Anchor href="#" size="sm" mt="xs" onClick={(e) => e.preventDefault()}>
                  How approvals work
                </Anchor>
              </Stack>
            </Paper>
          </div>
        </AppShellFrame>
      </BrowserFrame>
    </Gallery>
  );
}

/** A failed fetch: the red Alert sits under the toolbar, which stays usable, and Refresh retries. */
export function ListPageError() {
  return (
    <Gallery>
      <BrowserFrame url="/en/orders" height={520}>
        <AppShellFrame active="/orders">
          <div className={styles.page}>
            <PageHeader />
            <ListCard>
              <Toolbar />
              <Alert icon={<IconAlertCircle size={16} />} color="red" mt="xs">
                Failed to load items
              </Alert>
              <OrdersTable
                rows={[]}
                body={
                  <BodyMessage>
                    <Text c="dimmed" ta="center" py="xl">
                      No items in this collection
                    </Text>
                  </BodyMessage>
                }
              />
              <ListFooter label="No items" totalPages={0} />
            </ListCard>
          </div>
        </AppShellFrame>
      </BrowserFrame>
    </Gallery>
  );
}

/** The glass header at phone width: burger, page title, colour-scheme toggle. */
function PhoneHeader() {
  return (
    <header className={`bp-header ${styles.phoneHeader}`}>
      <Group gap="sm" wrap="nowrap">
        <Burger size="sm" aria-label="Toggle navigation" />
        <Text size="sm" fw={600}>
          Purchase orders
        </Text>
      </Group>
      <ActionIcon variant="subtle" color="gray" size="lg" aria-label="Search">
        <IconSearch size={18} />
      </ActionIcon>
    </header>
  );
}

/** The CollectionList card at 390px: the toolbar wraps and the table scrolls sideways. */
function PhoneCollectionList() {
  return (
    <div className={styles.phone}>
      <PhoneHeader />
      <main className={styles.phoneMain}>
        <Group justify="space-between" wrap="nowrap" gap="sm">
          <Title order={3}>Purchase orders</Title>
          <Button size="sm" leftSection={<IconPlus size={16} />}>
            New
          </Button>
        </Group>
        <ListCard>
          <Toolbar selectedCount={0} />
          <OrdersTable rows={PAGE_ORDERS.slice(0, 6)} minWidth />
          <ListFooter label={RANGE_LABEL} totalPages={TOTAL_PAGES} />
        </ListCard>
      </main>
    </div>
  );
}

/** A stacked card list the page can render below `sm` instead of the table. */
function PhoneCardList() {
  return (
    <div className={styles.phone}>
      <PhoneHeader />
      <main className={styles.phoneMain}>
        <Group justify="space-between" wrap="nowrap" gap="sm">
          <Title order={3}>Purchase orders</Title>
          <Button size="sm" leftSection={<IconPlus size={16} />}>
            New
          </Button>
        </Group>
        <Group gap="xs" wrap="nowrap">
          <TextInput
            className={styles.phoneSearch}
            aria-label="Search purchase orders"
            placeholder="Search..."
            leftSection={<IconSearch size={16} />}
          />
          <ActionIcon variant="default" size="input-sm" aria-label="Filters">
            <IconFilter size={16} />
          </ActionIcon>
        </Group>
        <Paper withBorder shadow="sm" radius="md" className={styles.list}>
          {PAGE_ORDERS.slice(0, 6).map((order) => (
            <div key={order.id} className={styles.orderCard}>
              <Group justify="space-between" wrap="nowrap" gap="sm">
                <Text size="sm" fw={600}>
                  {order.number}
                </Text>
                <StatusBadge status={order.status} />
              </Group>
              <Group justify="space-between" wrap="nowrap" gap="sm" mt={6}>
                <Group gap="xs" wrap="nowrap" className={styles.minw0}>
                  <Avatar size={22} radius="xl" color={order.owner.status === 'active' ? 'primary' : 'gray'} aria-label={order.owner.name}>
                    {order.owner.initials}
                  </Avatar>
                  <Text size="sm" c="dimmed" truncate="end">
                    {order.supplier}
                  </Text>
                </Group>
                <Text size="sm" fw={500} className={styles.nowrap}>
                  {formatMoney(order.amount)}
                </Text>
              </Group>
            </div>
          ))}
        </Paper>
        <Stack gap={6} align="center">
          <Pagination size="sm" total={TOTAL_PAGES} siblings={0} defaultValue={1} getControlProps={pagerLabel} />
          <Text size="xs" c="dimmed">
            {RANGE_LABEL}
          </Text>
        </Stack>
      </main>
    </div>
  );
}

/** The list at phone width: CollectionList as shipped, and a stacked card list the page can swap in. */
export function ListPageOnPhone() {
  return (
    <Gallery>
      <div className={styles.phones}>
        <div>
          <BrowserFrame url="/en/orders" height={720}>
            <PhoneCollectionList />
          </BrowserFrame>
          <Text size="xs" c="dimmed" mt="sm">
            <strong>CollectionList as shipped.</strong> The toolbar wraps, the table keeps its columns and scrolls
            sideways, and the footer wraps under the count.
          </Text>
        </div>
        <div>
          <BrowserFrame url="/en/orders" height={720}>
            <PhoneCardList />
          </BrowserFrame>
          <Text size="xs" c="dimmed" mt="sm">
            <strong>Card list, composed.</strong> Below <code>sm</code> your page can render one card per order
            (number, status, owner, supplier, amount) with the pager underneath.
          </Text>
        </div>
      </div>
    </Gallery>
  );
}

/** The list's overlays and toolbar states pinned open, so they can be read without clicking. */
export function ListPageMenus() {
  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        <Specimen
          label="Add field"
          align="start"
          note={
            <>
              VTable&apos;s header append (<code>enableAddField</code>): a subtle <code>size=&quot;sm&quot;</code>{' '}
              <code>ActionIcon</code> opening a <code>Menu</code> of the hidden fields.
            </>
          }
        >
          <div className={styles.overlayStage}>
            <Menu {...PINNED} position="bottom" withArrow shadow="md">
              <Menu.Target>
                <ActionIcon variant="subtle" size="sm" aria-label="Add field">
                  <IconPlus size={16} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <AddFieldItems />
              </Menu.Dropdown>
            </Menu>
          </div>
        </Specimen>
        <Specimen
          label="Header context menu"
          align="start"
          note={
            <>
              Right-click a column header to sort, align or hide it. VTable draws it in its own popup (
              <code>--mantine-radius-sm</code>, <code>shadow-md</code>). It is shown here as a <code>Menu</code>.
            </>
          }
        >
          <div className={styles.overlayStage}>
            <Menu {...PINNED} position="bottom" width={190}>
              <Menu.Target>
                <div className={styles.headerTarget}>
                  <Text size="xs" fw={600} c="dimmed">
                    Amount
                  </Text>
                </div>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>Sort</Menu.Label>
                <Menu.Item leftSection={<IconSortAscending size={14} />}>Sort ascending</Menu.Item>
                <Menu.Item leftSection={<IconSortDescending size={14} />}>Sort descending</Menu.Item>
                <Menu.Divider />
                <Menu.Label>Alignment</Menu.Label>
                <Menu.Item leftSection={<IconAlignLeft size={14} />}>Left</Menu.Item>
                <Menu.Item leftSection={<IconAlignCenter size={14} />}>Center</Menu.Item>
                <Menu.Item leftSection={<IconAlignRight size={14} />} rightSection={<IconCheck size={14} />}>
                  Right
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item color="red" leftSection={<IconEyeOff size={14} />}>
                  Hide field
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </div>
        </Specimen>
        <Specimen
          label="Bulk actions"
          span="full"
          align="start"
          note={
            <>
              <code>BulkActionsBar</code> sits on the toolbar&apos;s right while rows are selected: a light{' '}
              <code>Badge size=&quot;lg&quot;</code>, then each <code>bulkActions</code> entry as a light{' '}
              <code>compact-sm</code> Button, then a clear button. Approve is this page&apos;s action, and Delete
              passes <code>color=&quot;red&quot;</code>.
            </>
          }
        >
          <ListCard>
            <Toolbar selectedCount={2} />
          </ListCard>
        </Specimen>
        <Specimen
          label="Filter toggle"
          note={
            <>
              Subtle when idle. With rules applied it turns filled <code>primary</code> and a red{' '}
              <code>Badge circle</code> shows the count.
            </>
          }
        >
          <Group gap="xl">
            <Group gap="xs">
              <FilterToggle count={0} />
              <Text size="xs" c="dimmed">
                Idle
              </Text>
            </Group>
            <Group gap="xs">
              <FilterToggle count={2} open />
              <Text size="xs" c="dimmed">
                2 rules
              </Text>
            </Group>
          </Group>
        </Specimen>
        <Specimen
          label="Per page"
          align="start"
          note={
            <>
              A 72px <code>Select size=&quot;xs&quot;</code> with bare numbers, after a dimmed &quot;Per page&quot;
              label.
            </>
          }
        >
          <div className={styles.selectStage}>
            <Group gap={4} wrap="nowrap" align="flex-start">
              <Text size="xs" c="dimmed" mt={6}>
                Per page
              </Text>
              <Select
                className={styles.perPage}
                size="xs"
                aria-label="Per page"
                data={['10', '25', '50', '100']}
                defaultValue="10"
                allowDeselect={false}
                dropdownOpened
                comboboxProps={COMBOBOX_PINNED}
              />
            </Group>
          </div>
        </Specimen>
        <Specimen
          label="Permissions failed"
          span="full"
          note={
            <>
              When <code>/permissions/me</code> fails, the list still loads but turns off writes. A red{' '}
              <code>Alert</code> explains why and offers a light red <code>Retry</code>.
            </>
          }
        >
          <Alert icon={<IconAlertCircle size={16} />} color="red" className={styles.fill}>
            <Group justify="space-between" gap="sm">
              <Text size="sm">
                Your permissions could not be loaded, so creating, editing and deleting are turned off.
              </Text>
              <Button size="xs" variant="light" color="red">
                Retry
              </Button>
            </Group>
          </Alert>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}
