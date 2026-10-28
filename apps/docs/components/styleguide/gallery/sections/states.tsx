'use client';

import {
  ActionIcon,
  Alert,
  Anchor,
  Avatar,
  Badge,
  Button,
  Card,
  Checkbox,
  Divider,
  Group,
  List,
  Loader,
  LoadingOverlay,
  Notification,
  NumberInput,
  Paper,
  Pill,
  Progress,
  SegmentedControl,
  Select,
  SimpleGrid,
  Skeleton,
  Stack,
  Stepper,
  Table,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconAlertTriangle,
  IconArchive,
  IconArrowLeft,
  IconCalendar,
  IconChartBar,
  IconCheck,
  IconChecklist,
  IconCircleCheck,
  IconClock,
  IconCloudOff,
  IconDots,
  IconDownload,
  IconFileImport,
  IconFileSearch,
  IconFilterOff,
  IconLock,
  IconMessageCircle,
  IconPaperclip,
  IconPlus,
  IconRefresh,
  IconRestore,
  IconSearch,
  IconSearchOff,
  IconTrash,
  IconUpload,
  IconWifiOff,
  IconX,
  type Icon,
} from '@tabler/icons-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AppShellFrame } from '../AppShellFrame';
import { Gallery } from '../Gallery';
import { BrowserFrame, Specimen, SpecimenGrid } from '../Layout';
import { ORDERS, ORDER_STATUS, USERS, formatMoney, type MockOrder } from '../data';
import styles from './states.module.css';

/** Clears every pending timeout when the component unmounts. */
function useTimers() {
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  return (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };
}

function EmptyState({
  icon: StateIcon,
  color = 'gray',
  title,
  children,
  actions,
}: {
  icon: Icon;
  color?: string;
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <Stack align="center" gap="sm" className={styles.empty}>
      <ThemeIcon variant="light" color={color} size={56} radius="xl">
        <StateIcon size={28} stroke={1.5} />
      </ThemeIcon>
      <Title order={4} mt={4}>
        {title}
      </Title>
      <Text size="sm" c="dimmed">
        {children}
      </Text>
      {actions && (
        <Group gap="sm" justify="center" mt="xs">
          {actions}
        </Group>
      )}
    </Stack>
  );
}

function StatusBadge({ order }: { order: MockOrder }) {
  return <Badge color={ORDER_STATUS[order.status].color}>{ORDER_STATUS[order.status].label}</Badge>;
}

function OrderRows({ orders }: { orders: MockOrder[] }) {
  return (
    <>
      {orders.map((order) => (
        <div key={order.id} className={styles.row}>
          <div>
            <Text size="sm" fw={500}>
              {order.supplier}
            </Text>
            <Text size="xs" c="dimmed">
              {order.number} · {order.category}
            </Text>
          </div>
          <Group gap="md" wrap="nowrap">
            <StatusBadge order={order} />
            <Text size="sm" fw={600} className={styles.amount}>
              {formatMoney(order.amount)}
            </Text>
          </Group>
        </div>
      ))}
    </>
  );
}

/** First run, no results, no permission and archived — plus small inline empties. */
export function EmptyStates() {
  const [search, setSearch] = useState('zephyr');
  const [status, setStatus] = useState<string | null>('shipped');
  const results = ORDERS.filter(
    (o) =>
      (!search.trim() ||
        `${o.supplier} ${o.number}`.toLowerCase().includes(search.trim().toLowerCase())) &&
      (!status || o.status === status)
  );

  return (
    <Gallery>
      <div className={styles.stack}>
      <SpecimenGrid cols={2}>
        <Specimen
          surface="muted"
          label="First run"
          note={
            <>
              A collection with no records yet: ember-tinted{' '}
              <code>ThemeIcon size=&#123;56&#125;</code>, an <code>h4</code>, one sentence on what
              the page is for, the ink CTA and a secondary <code>variant=&quot;default&quot;</code>{' '}
              path.
            </>
          }
        >
          <Paper withBorder className={`${styles.block} ${styles.fill}`}>
            <div className={styles.blockHeader}>
              <Title order={5}>Purchase orders</Title>
              <Badge color="gray">0</Badge>
            </div>
            <div className={styles.blockBody}>
              <EmptyState
                icon={IconChecklist}
                color="primary"
                title="No purchase orders yet"
                actions={
                  <>
                    <Button leftSection={<IconPlus size={16} />}>New order</Button>
                    <Button variant="default" leftSection={<IconFileImport size={16} />}>
                      Import CSV
                    </Button>
                  </>
                }
              >
                Create your first order to start tracking spend, approvals and deliveries in one
                place.
              </EmptyState>
              <Text size="xs" c="dimmed" ta="center" mt="lg">
                New to approvals? <Anchor size="xs">Read the 3-minute guide</Anchor>
              </Text>
            </div>
          </Paper>
        </Specimen>

        <Specimen
          surface="muted"
          label="No search results"
          note={
            <>
              Repeats the query, names the active filters as <code>Pill</code>s and offers one way
              out. Clear the filters — the rows come back; search for something else and it returns.
            </>
          }
        >
          <Paper withBorder className={`${styles.block} ${styles.fill}`}>
            <div className={styles.blockHeader}>
              <Group gap="xs" wrap="nowrap">
                <TextInput
                  aria-label="Search orders"
                  placeholder="Search orders…"
                  leftSection={<IconSearch size={16} />}
                  value={search}
                  onChange={(e) => setSearch(e.currentTarget.value)}
                  w={170}
                />
                <Select
                  aria-label="Filter by status"
                  placeholder="All statuses"
                  data={Object.entries(ORDER_STATUS).map(([value, s]) => ({
                    value,
                    label: s.label,
                  }))}
                  value={status}
                  onChange={setStatus}
                  clearable
                  w={150}
                />
              </Group>
              {(search || status) && (
                <Group gap={6}>
                  {search && (
                    <Pill
                      withRemoveButton
                      onRemove={() => setSearch('')}
                      removeButtonProps={{ 'aria-label': 'Remove search' }}
                    >
                      “{search}”
                    </Pill>
                  )}
                  {status && (
                    <Pill
                      withRemoveButton
                      onRemove={() => setStatus(null)}
                      removeButtonProps={{ 'aria-label': 'Remove status filter' }}
                    >
                      {ORDER_STATUS[status as keyof typeof ORDER_STATUS].label}
                    </Pill>
                  )}
                </Group>
              )}
            </div>
            {results.length === 0 ? (
              <div className={styles.blockBody}>
                <EmptyState
                  icon={IconSearchOff}
                  title={search.trim() ? `No results for “${search.trim()}”` : 'No matching orders'}
                  actions={
                    <Button
                      variant="default"
                      leftSection={<IconFilterOff size={16} />}
                      onClick={() => {
                        setSearch('');
                        setStatus(null);
                      }}
                    >
                      Clear filters
                    </Button>
                  }
                >
                  {status
                    ? `No ${ORDER_STATUS[
                        status as keyof typeof ORDER_STATUS
                      ].label.toLowerCase()} orders match. Check the spelling or clear the filters.`
                    : 'Check the spelling or try a supplier name or PO number.'}
                </EmptyState>
              </div>
            ) : (
              <OrderRows orders={results.slice(0, 5)} />
            )}
          </Paper>
        </Specimen>

        <Specimen
          surface="muted"
          label="No permission"
          note={
            <>
              Say what is locked and why, then who can help. A neutral <code>gray</code> icon — it
              is not an error. The primary action asks; the secondary leaves.
            </>
          }
        >
          <Paper withBorder className={`${styles.block} ${styles.fill}`}>
            <div className={styles.blockBody}>
              <EmptyState
                icon={IconLock}
                title="You don’t have access to Finance reports"
                actions={
                  <>
                    <Button>Request access</Button>
                    <Button variant="subtle" color="gray" leftSection={<IconArrowLeft size={16} />}>
                      Back to dashboard
                    </Button>
                  </>
                }
              >
                Reports are limited to the Finance and Administrator roles. Your role is{' '}
                <Text span fw={600} inherit>
                  Viewer
                </Text>
                .
              </EmptyState>
              <Group justify="center" gap="xs" mt="lg">
                <Avatar size={22} radius="xl" color="primary">
                  {USERS[0].initials}
                </Avatar>
                <Text size="xs" c="dimmed">
                  Workspace admin: {USERS[0].name}
                </Text>
              </Group>
            </div>
          </Paper>
        </Specimen>

        <Specimen
          surface="muted"
          label="Archived & read-only"
          note={
            <>
              A gray <code>Alert</code> with the one action that undoes it, above the record
              rendered <code>readOnly</code> — values stay legible, nothing is editable.
            </>
          }
        >
          <Paper withBorder className={`${styles.block} ${styles.fill}`}>
            <div className={styles.blockHeader}>
              <Group gap="xs">
                <Title order={5}>Harbor Office Supply</Title>
                <Badge color="gray" leftSection={<IconArchive size={12} />}>
                  Archived
                </Badge>
              </Group>
            </div>
            <Stack gap="md" p="md">
              <Alert
                color="gray"
                icon={<IconArchive size={18} />}
                title="This supplier is archived"
              >
                <Text size="sm">
                  Archived on 24 Oct by {USERS[0].name}. It is hidden from new orders.
                </Text>
                <Button
                  mt="sm"
                  size="compact-sm"
                  variant="default"
                  leftSection={<IconRestore size={14} />}
                >
                  Restore supplier
                </Button>
              </Alert>
              <SimpleGrid cols={2}>
                <TextInput label="Supplier name" value="Harbor Office Supply" readOnly />
                <TextInput label="Category" value="Office" readOnly />
                <TextInput label="Account manager" value={USERS[4].name} readOnly />
                <TextInput label="Payment terms" value="Net 30" readOnly />
              </SimpleGrid>
            </Stack>
          </Paper>
        </Specimen>
      </SpecimenGrid>

      <SpecimenGrid cols={3}>
        <Specimen
          surface="muted"
          align="start"
          label="Empty thread"
          note={<>Small spaces get a small icon and one line — never the full illustration.</>}
        >
          <Card withBorder padding="lg">
            <Title order={5}>Comments</Title>
            <Stack align="center" gap={6} py="lg">
              <ThemeIcon variant="light" color="gray" radius="xl" size="lg">
                <IconMessageCircle size={18} />
              </ThemeIcon>
              <Text size="sm" fw={500}>
                No comments yet
              </Text>
              <Text size="xs" c="dimmed">
                Start the conversation about this order.
              </Text>
            </Stack>
            <Textarea
              aria-label="Write a comment"
              placeholder="Write a comment…"
              minRows={2}
              autosize
            />
          </Card>
        </Specimen>
        <Specimen
          surface="muted"
          align="start"
          label="Empty attachments"
          note={
            <>
              A dashed <code>--ds-gray-300</code> drop target (core has no Dropzone; this is
              composed) with a browse link.
            </>
          }
        >
          <Card withBorder padding="lg">
            <Title order={5} mb="sm">
              Attachments
            </Title>
            <div className={styles.dropZone}>
              <ThemeIcon variant="light" color="primary" radius="xl" size="lg">
                <IconUpload size={18} />
              </ThemeIcon>
              <Text size="sm">
                Drop files here or{' '}
                <Anchor component="button" type="button" inherit>
                  browse
                </Anchor>
              </Text>
              <Text size="xs" c="dimmed">
                PDF, PNG or XLSX up to 10 MB
              </Text>
            </div>
          </Card>
        </Specimen>
        <Specimen
          surface="muted"
          align="start"
          label="Not enough data"
          note={<>A chart with too few points says so and says when it will fill in.</>}
        >
          <Card withBorder padding="lg">
            <Text size="sm" c="dimmed" fw={500}>
              Approval time
            </Text>
            <Title order={2}>—</Title>
            <Stack align="center" gap={6} py="lg">
              <ThemeIcon variant="light" color="gray" radius="xl" size="lg">
                <IconChartBar size={18} />
              </ThemeIcon>
              <Text size="sm" fw={500}>
                Not enough data yet
              </Text>
              <Text size="xs" c="dimmed" ta="center">
                Trends appear after 5 approved orders.
              </Text>
            </Stack>
          </Card>
        </Specimen>
      </SpecimenGrid>
    </div>
    </Gallery>
  );
}

function LoadToggle({ value, onChange }: { value: boolean; onChange: (loading: boolean) => void }) {
  return (
    <SegmentedControl
      size="xs"
      aria-label="Preview state"
      data={['Loading', 'Loaded']}
      value={value ? 'Loading' : 'Loaded'}
      onChange={(v) => onChange(v === 'Loading')}
    />
  );
}

const SKELETON_WIDTHS = [72, 88, 64, 80, 76, 68];

/** A skeleton that mirrors the data table row for row, toggleable against the real thing. */
export function TableSkeleton() {
  const [loading, setLoading] = useState(true);
  const rows = ORDERS.slice(0, 6);
  return (
    <Gallery>
      <SpecimenGrid cols={1}>
        <Specimen
          span="full"
          surface="muted"
          label="Table skeleton"
          note={
            <>
              Same toolbar, columns, row height and footer as the loaded table, in{' '}
              <code>Skeleton</code> bars: circles for avatars, 20px squares for the default-size
              checkboxes, pills for badges, short right-aligned bars for amounts. Switch to <code>Loaded</code> — nothing shifts.
            </>
          }
        >
          <div className={styles.toggleBar}>
            <Text size="sm" c="dimmed">
              Purchase orders · first load
            </Text>
            <LoadToggle value={loading} onChange={setLoading} />
          </div>
          <Paper withBorder shadow="sm" className={styles.block}>
            <div className={styles.skeletonToolbar}>
              {loading ? (
                <>
                  <Group gap="xs">
                    <Skeleton h={36} w={210} radius="sm" />
                    <Skeleton h={36} w={160} radius="sm" />
                    <Skeleton h={36} w={96} radius="xl" />
                  </Group>
                  <Skeleton h={36} w={124} radius="xl" />
                </>
              ) : (
                <>
                  <Group gap="xs">
                    <TextInput
                      aria-label="Search orders"
                      placeholder="Search orders…"
                      leftSection={<IconSearch size={16} />}
                      w={210}
                    />
                    <Select
                      aria-label="Filter by status"
                      placeholder="All statuses"
                      data={['Pending approval', 'Approved', 'Shipped']}
                      w={160}
                    />
                    <Button variant="default">Filters</Button>
                  </Group>
                  <Button leftSection={<IconPlus size={16} />}>New order</Button>
                </>
              )}
            </div>
            <Table withTableBorder={false} verticalSpacing="sm" miw={680}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th className={styles.checkCell}>
                    {loading ? (
                      <Skeleton h={20} w={20} radius="sm" />
                    ) : (
                      <Checkbox aria-label="Select all rows" />
                    )}
                  </Table.Th>
                  {['Order', 'Supplier', 'Owner', 'Status'].map((h) => (
                    <Table.Th key={h}>{loading ? <Skeleton h={10} w={56} /> : h}</Table.Th>
                  ))}
                  <Table.Th className={styles.amount}>
                    {loading ? <Skeleton h={10} w={52} ml="auto" /> : 'Amount'}
                  </Table.Th>
                  <Table.Th className={styles.menuCell} aria-label="Actions" />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rows.map((order, i) => (
                  <Table.Tr key={order.id}>
                    <Table.Td>
                      {loading ? (
                        <Skeleton h={20} w={20} radius="sm" />
                      ) : (
                        <Checkbox aria-label={`Select ${order.number}`} />
                      )}
                    </Table.Td>
                    <Table.Td>
                      {loading ? (
                        <Stack gap={6} justify="center" className={styles.twoLineCell}>
                          <Skeleton h={12} w={64} />
                          <Skeleton h={8} w={52} />
                        </Stack>
                      ) : (
                        <>
                          <Text size="sm" fw={500}>
                            {order.number}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {order.category}
                          </Text>
                        </>
                      )}
                    </Table.Td>
                    <Table.Td>
                      {loading ? <Skeleton h={12} w={SKELETON_WIDTHS[i] + 40} /> : order.supplier}
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs" wrap="nowrap">
                        {loading ? (
                          <>
                            <Skeleton h={24} w={24} circle />
                            <Skeleton h={12} w={SKELETON_WIDTHS[(i + 2) % 6]} />
                          </>
                        ) : (
                          <>
                            <Avatar size={24} radius="xl" color="primary">
                              {order.owner.initials}
                            </Avatar>
                            <Text size="sm">{order.owner.name}</Text>
                          </>
                        )}
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      {loading ? (
                        <Skeleton h={20} w={SKELETON_WIDTHS[(i + 1) % 6]} radius="xl" />
                      ) : (
                        <StatusBadge order={order} />
                      )}
                    </Table.Td>
                    <Table.Td className={styles.amount}>
                      {loading ? (
                        <Skeleton h={12} w={56} ml="auto" />
                      ) : (
                        <Text size="sm" fw={500}>
                          {formatMoney(order.amount)}
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      {loading ? (
                        <Skeleton h={16} w={16} radius="xl" />
                      ) : (
                        <ActionIcon
                          variant="subtle"
                          color="gray"
                          aria-label={`Actions for ${order.number}`}
                        >
                          <IconDots size={16} />
                        </ActionIcon>
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
            <div className={styles.blockFooter}>
              {loading ? (
                <Skeleton h={12} w={84} />
              ) : (
                <Text size="sm" c="dimmed">
                  1–6 of 128
                </Text>
              )}
              {loading ? (
                <Group gap="xs">
                  <Skeleton h={30} w={72} radius="sm" />
                  <Skeleton h={30} w={180} radius="sm" />
                </Group>
              ) : (
                <Group gap="xs">
                  <Text size="xs" c="dimmed">
                    Per page
                  </Text>
                  <Select
                    size="xs"
                    w={72}
                    aria-label="Rows per page"
                    data={['10', '25', '50']}
                    defaultValue="10"
                  />
                  <Badge color="gray">Page 1 of 13</Badge>
                </Group>
              )}
            </div>
          </Paper>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

/** Card grid via Skeleton's `visible` prop, and a detail form skeleton. */
export function CardAndFormSkeletons() {
  const [cardsLoading, setCardsLoading] = useState(true);
  const [formLoading, setFormLoading] = useState(true);
  const order = ORDERS[0];

  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        <Specimen
          surface="muted"
          align="start"
          label="Card grid skeleton"
          note={
            <>
              Each text node wrapped in <code>Skeleton visible=&#123;loading&#125;</code>, so the
              placeholder takes the exact size of the content it stands in for.
            </>
          }
        >
          <div className={styles.toggleBar}>
            <Text size="sm" c="dimmed">
              Suppliers
            </Text>
            <LoadToggle value={cardsLoading} onChange={setCardsLoading} />
          </div>
          <SimpleGrid cols={2}>
            {ORDERS.slice(0, 4).map((o) => (
              <Card key={o.id} withBorder padding="md">
                <Group justify="space-between" mb={6} wrap="nowrap">
                  <Skeleton visible={cardsLoading} w="auto">
                    <Text size="xs" c="dimmed" fw={500}>
                      {o.number}
                    </Text>
                  </Skeleton>
                  <Skeleton visible={cardsLoading} radius="xl" w="auto">
                    <StatusBadge order={o} />
                  </Skeleton>
                </Group>
                <Skeleton visible={cardsLoading} mb={4}>
                  <Text fw={600} truncate="end">
                    {o.supplier}
                  </Text>
                </Skeleton>
                <Skeleton visible={cardsLoading} w="60%">
                  <Text size="sm" c="dimmed">
                    {o.category}
                  </Text>
                </Skeleton>
                <Group justify="space-between" mt="md" wrap="nowrap">
                  <Skeleton visible={cardsLoading} w="auto">
                    <Text fw={600}>{formatMoney(o.amount)}</Text>
                  </Skeleton>
                  <Skeleton visible={cardsLoading} circle h={24} w={24}>
                    <Avatar size={24} radius="xl" color="primary">
                      {o.owner.initials}
                    </Avatar>
                  </Skeleton>
                </Group>
              </Card>
            ))}
          </SimpleGrid>
        </Specimen>

        <Specimen
          surface="muted"
          align="start"
          label="Detail form skeleton"
          note={
            <>
              Label bars (12px) over input bars (36px, <code>radius=&quot;sm&quot;</code>) in the
              same two-column grid; buttons become pill-shaped bars.
            </>
          }
        >
          <div className={styles.toggleBar}>
            <Text size="sm" c="dimmed">
              Edit {order.number}
            </Text>
            <LoadToggle value={formLoading} onChange={setFormLoading} />
          </div>
          <Card withBorder padding="lg">
            {formLoading ? (
              <Stack gap="lg">
                <div>
                  <Skeleton h={16} w={140} mb={8} />
                  <Skeleton h={10} w={220} />
                </div>
                <div className={styles.formGrid}>
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i}>
                      <Skeleton h={12} w={i % 2 ? 64 : 88} mb={8} />
                      <Skeleton h={36} radius="sm" />
                    </div>
                  ))}
                  <div className={styles.formFull}>
                    <Skeleton h={12} w={52} mb={8} />
                    <Skeleton h={72} radius="sm" />
                  </div>
                </div>
                <Group justify="flex-end" gap="sm">
                  <Skeleton h={36} w={84} radius="xl" />
                  <Skeleton h={36} w={112} radius="xl" />
                </Group>
              </Stack>
            ) : (
              <Stack gap="lg">
                <div>
                  <Title order={4}>Order details</Title>
                  <Text size="sm" c="dimmed">
                    Supplier, amount and delivery for this order.
                  </Text>
                </div>
                <div className={styles.formGrid}>
                  <TextInput label="Supplier" defaultValue={order.supplier} />
                  <TextInput label="Category" defaultValue={order.category} />
                  <NumberInput
                    label="Amount"
                    defaultValue={order.amount}
                    prefix="$"
                    thousandSeparator=","
                  />
                  <TextInput
                    label="Due date"
                    defaultValue="04 Nov 2026"
                    rightSection={<IconCalendar size={16} />}
                  />
                  <Textarea
                    className={styles.formFull}
                    label="Notes"
                    defaultValue="Split delivery agreed."
                    minRows={2}
                    autosize
                  />
                </div>
                <Group justify="flex-end" gap="sm">
                  <Button variant="default">Cancel</Button>
                  <Button>Save changes</Button>
                </Group>
              </Stack>
            )}
          </Card>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

/** Button and field loading, a LoadingOverlay over a card, and background job progress. */
export function InlineLoading() {
  const later = useTimers();
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [overlay, setOverlay] = useState(true);
  const order = ORDERS[1];

  const save = () => {
    setSaveState('saving');
    later(() => setSaveState('saved'), 1400);
    later(() => setSaveState('idle'), 3600);
  };
  const reload = () => {
    setOverlay(true);
    later(() => setOverlay(false), 1600);
  };

  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        <Specimen
          label="Buttons & fields"
          note={
            <>
              <code>loading</code> keeps the button&apos;s width and disables it; a{' '}
              <code>Loader size=&quot;xs&quot;</code> in <code>rightSection</code> marks a field
              that is validating or fetching options. Press Save.
            </>
          }
        >
          <Stack gap="lg">
            <Group gap="sm">
              <Button loading>Approve</Button>
              <Button color="primary" loading>
                Submit
              </Button>
              <Button variant="default" loading loaderProps={{ type: 'dots' }}>
                Export
              </Button>
              <ActionIcon variant="default" size="input-sm" loading aria-label="Refreshing">
                <IconRefresh size={16} />
              </ActionIcon>
            </Group>
            <Group gap="sm">
              <Button
                onClick={save}
                loading={saveState === 'saving'}
                leftSection={saveState === 'saved' ? <IconCheck size={16} /> : undefined}
                variant={saveState === 'saved' ? 'light' : 'filled'}
                color={saveState === 'saved' ? 'green' : undefined}
              >
                {saveState === 'saved' ? 'Saved' : 'Save changes'}
              </Button>
              <Group gap={6} c="dimmed">
                {saveState === 'saving' ? <Loader size={14} /> : <IconCircleCheck size={16} />}
                <Text size="xs" c="dimmed">
                  {saveState === 'saving' ? 'Saving…' : 'All changes saved · just now'}
                </Text>
              </Group>
            </Group>
            <SimpleGrid cols={2}>
              <TextInput
                label="Workspace URL"
                defaultValue="northwind-ops"
                rightSection={<Loader size="xs" />}
                description="Checking availability…"
              />
              <Select
                label="Supplier"
                placeholder="Loading suppliers…"
                data={[]}
                disabled
                rightSection={<Loader size="xs" />}
              />
            </SimpleGrid>
          </Stack>
        </Specimen>

        <Specimen
          surface="muted"
          label="LoadingOverlay over a card"
          note={
            <>
              <code>LoadingOverlay</code> with{' '}
              <code>overlayProps=&#123;&#123; blur: 2 &#125;&#125;</code> on a{' '}
              <code>pos=&quot;relative&quot;</code> card — the old content stays in place while it
              refreshes. Press Refresh.
            </>
          }
        >
          <div className={styles.overlayHost}>
            <Card withBorder padding="lg" pos="relative">
              <LoadingOverlay visible={overlay} overlayProps={{ blur: 2 }} zIndex={2} />
              <Group justify="space-between" align="flex-start">
                <div>
                  <Text size="xs" c="dimmed" fw={500}>
                    {order.number}
                  </Text>
                  <Title order={4}>{order.supplier}</Title>
                </div>
                <StatusBadge order={order} />
              </Group>
              <Group gap="xl" mt="md">
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
                  <Text fw={600}>{order.owner.name}</Text>
                </div>
              </Group>
              <Divider my="md" />
              <Group justify="space-between">
                <Text size="xs" c="dimmed">
                  Synced from ERP · {overlay ? 'refreshing…' : 'just now'}
                </Text>
                <Button
                  size="compact-sm"
                  variant="default"
                  leftSection={<IconRefresh size={14} />}
                  onClick={reload}
                  disabled={overlay}
                >
                  Refresh
                </Button>
              </Group>
            </Card>
            {overlay && (
              <Group justify="center" mt="sm">
                <Button
                  size="compact-xs"
                  variant="subtle"
                  color="gray"
                  onClick={() => setOverlay(false)}
                >
                  Finish loading
                </Button>
              </Group>
            )}
          </div>
        </Specimen>

        <Specimen
          span="full"
          surface="muted"
          label="Background jobs"
          note={
            <>
              Long work reports progress where it started: a striped, animated <code>Progress</code>{' '}
              with a count, per-file bars, a green done state and a red failed state with its retry.
            </>
          }
        >
          <Card withBorder padding="lg">
            <SimpleGrid cols={2} spacing="xl">
              <Stack gap="xs">
                <Group justify="space-between">
                  <Group gap="xs">
                    <ThemeIcon variant="light" size="md" radius="md">
                      <IconDownload size={16} />
                    </ThemeIcon>
                    <div>
                      <Text size="sm" fw={600}>
                        Exporting purchase orders
                      </Text>
                      <Text size="xs" c="dimmed">
                        82 of 128 · about 20 seconds left
                      </Text>
                    </div>
                  </Group>
                  <Button size="compact-sm" variant="subtle" color="gray">
                    Cancel
                  </Button>
                </Group>
                <Progress value={64} striped animated aria-label="Export progress, 64%" />
              </Stack>
              <Stack gap="sm">
                {[
                  { name: 'invoice-PO-2041.pdf', size: '2.4 MB', value: 78, state: 'uploading' },
                  { name: 'delivery-note.png', size: '840 KB', value: 100, state: 'done' },
                  { name: 'rates-q4.xlsx', size: '1.1 MB', value: 35, state: 'failed' },
                ].map((file) => (
                  <div key={file.name}>
                    <Group justify="space-between" mb={4} wrap="nowrap">
                      <Group gap={6} wrap="nowrap">
                        <IconPaperclip size={14} />
                        <Text size="sm" truncate="end">
                          {file.name}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {file.size}
                        </Text>
                      </Group>
                      {file.state === 'done' ? (
                        <Badge color="green" leftSection={<IconCheck size={12} />}>
                          Uploaded
                        </Badge>
                      ) : file.state === 'failed' ? (
                        <Group gap={4} wrap="nowrap">
                          <Text size="xs" c="red">
                            Upload failed
                          </Text>
                          <Button
                            size="compact-xs"
                            variant="subtle"
                            color="red"
                            leftSection={<IconRefresh size={12} />}
                          >
                            Retry
                          </Button>
                        </Group>
                      ) : (
                        <Text size="xs" c="dimmed">
                          {file.value}%
                        </Text>
                      )}
                    </Group>
                    <Progress
                      size="sm"
                      value={file.value}
                      color={
                        file.state === 'done'
                          ? 'green'
                          : file.state === 'failed'
                          ? 'red'
                          : undefined
                      }
                      aria-label={`${file.name} ${file.state}`}
                    />
                  </div>
                ))}
              </Stack>
            </SimpleGrid>
          </Card>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

const BANNERS = [
  {
    color: 'yellow',
    icon: IconWifiOff,
    title: 'You’re offline',
    body: 'Changes are kept on this device and sync when you reconnect.',
    action: 'Retry now',
  },
  {
    color: 'red',
    icon: IconAlertCircle,
    title: '3 changes failed to sync',
    body: 'PO-2041, PO-2038 and PO-2035 were not saved to the ERP.',
    action: 'Review',
  },
  {
    color: 'blue',
    icon: IconClock,
    title: 'Your session expires in 2 minutes',
    body: 'Save your work or stay signed in.',
    action: 'Stay signed in',
  },
  {
    color: 'green',
    icon: IconCircleCheck,
    title: 'Back online',
    body: 'All changes are synced.',
    action: undefined,
  },
] as const;

/** Failed load with retry, not found, form submission error, banners and an offline app. */
export function ErrorStates() {
  const later = useTimers();
  const [loadState, setLoadState] = useState<'error' | 'retrying' | 'loaded'>('error');
  const [submitError, setSubmitError] = useState(true);

  const retry = () => {
    setLoadState('retrying');
    later(() => setLoadState('loaded'), 1300);
  };

  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        <Specimen
          surface="muted"
          label="Failed to load"
          note={
            <>
              Red-tinted <code>ThemeIcon</code>, a plain-language cause, reassurance, and{' '}
              <code>Try again</code> with its own <code>loading</code> state. The request id is in
              mono for support. Press it.
            </>
          }
        >
          <Paper withBorder className={`${styles.block} ${styles.fill}`}>
            <div className={styles.blockHeader}>
              <Title order={5}>Purchase orders</Title>
              {loadState === 'loaded' && (
                <Anchor
                  component="button"
                  type="button"
                  size="xs"
                  onClick={() => setLoadState('error')}
                >
                  Simulate failure
                </Anchor>
              )}
            </div>
            {loadState === 'loaded' ? (
              <OrderRows orders={ORDERS.slice(0, 4)} />
            ) : (
              <div className={styles.blockBody}>
                <EmptyState
                  icon={IconCloudOff}
                  color="red"
                  title="Couldn’t load purchase orders"
                  actions={
                    <Button
                      leftSection={<IconRefresh size={16} />}
                      loading={loadState === 'retrying'}
                      onClick={retry}
                    >
                      Try again
                    </Button>
                  }
                >
                  The server didn’t respond in time. Nothing was lost — try again in a moment.
                </EmptyState>
                <Text size="xs" c="dimmed" ta="center" mt="md" ff="monospace">
                  504 Gateway Timeout · req_8f2a91c4
                </Text>
              </div>
            )}
          </Paper>
        </Specimen>

        <Specimen
          surface="muted"
          label="Not found"
          note={
            <>
              A 404 inside the shell keeps navigation available. Name what was looked for and offer
              the nearest useful place, not just “home”.
            </>
          }
        >
          <Paper withBorder className={`${styles.block} ${styles.fill}`}>
            <div className={styles.blockBody}>
              <EmptyState
                icon={IconFileSearch}
                title="We couldn’t find PO-9999"
                actions={
                  <>
                    <Button leftSection={<IconArrowLeft size={16} />}>Back to orders</Button>
                    <Button variant="default">Search orders</Button>
                  </>
                }
              >
                It may have been deleted, or the link is mistyped. Orders you can see are listed on
                the Purchase orders page.
              </EmptyState>
              <Text size="xs" c="dimmed" ta="center" mt="md" ff="monospace">
                Error 404 · /orders/PO-9999
              </Text>
            </div>
          </Paper>
        </Specimen>

        <Specimen
          surface="muted"
          align="start"
          label="Form submission error"
          note={
            <>
              A red <code>Alert</code> at the top summarises what failed server-side; each field
              repeats its own <code>error</code>. Fix the amount and save to clear it.
            </>
          }
        >
          <Card withBorder padding="lg">
            <Stack gap="md">
              <Title order={4}>Edit PO-2041</Title>
              {submitError && (
                <Alert
                  color="red"
                  icon={<IconAlertCircle size={18} />}
                  title="We couldn’t save this order"
                  withCloseButton
                  closeButtonLabel="Dismiss error"
                  onClose={() => setSubmitError(false)}
                >
                  <List size="sm" spacing={2}>
                    <List.Item>Amount is above your $10,000 approval limit.</List.Item>
                    <List.Item>Due date must be after today.</List.Item>
                  </List>
                </Alert>
              )}
              <SimpleGrid cols={2}>
                <TextInput label="Supplier" defaultValue="Atlas Packaging" />
                <NumberInput
                  label="Amount"
                  defaultValue={12840}
                  prefix="$"
                  thousandSeparator=","
                  error={submitError ? 'Above your $10,000 limit' : undefined}
                />
                <TextInput
                  label="Due date"
                  defaultValue="21 Oct 2026"
                  rightSection={<IconCalendar size={16} />}
                  error={submitError ? 'Must be after today' : undefined}
                />
                <TextInput label="Cost centre" defaultValue="OPS-114" />
              </SimpleGrid>
              <Group justify="flex-end" gap="sm">
                <Button variant="default" onClick={() => setSubmitError(true)}>
                  Reset demo
                </Button>
                <Button onClick={() => setSubmitError(false)}>Save order</Button>
              </Group>
            </Stack>
          </Card>
        </Specimen>

        <Specimen
          surface="muted"
          align="start"
          label="System banners"
          note={
            <>
              Page-level <code>Alert</code>s for connection, sync and session state: the built-in
              hues map to <code>warning</code> / <code>danger</code> / <code>info</code> /{' '}
              <code>success</code>, each with an icon and at most one action.
            </>
          }
        >
          <Stack gap="sm">
            {BANNERS.map(({ color, icon: BannerIcon, title, body, action }) => (
              <Alert key={title} color={color} icon={<BannerIcon size={18} />} title={title}>
                <Text size="sm">{body}</Text>
                {action && (
                  <Button size="compact-xs" variant="light" color={color} mt="xs">
                    {action}
                  </Button>
                )}
              </Alert>
            ))}
          </Stack>
        </Specimen>

        <Specimen
          span="full"
          surface="muted"
          label="Connection lost, in context"
          note={
            <>
              The offline banner sits at the top of the content area inside the shell; rows changed
              while offline get a <code>Pending sync</code> badge so the user knows what is unsaved.
            </>
          }
        >
          <BrowserFrame url="/orders" height={440}>
            <AppShellFrame active="/orders">
              <div className={styles.frameContent}>
                <Alert
                  color="yellow"
                  icon={<IconWifiOff size={18} />}
                  title="Connection lost — reconnecting…"
                >
                  <Group justify="space-between" gap="sm" wrap="nowrap">
                    <Text size="sm">
                      You can keep working. 2 changes will sync when the connection returns.
                    </Text>
                    <Button size="compact-xs" variant="light" color="yellow" style={{ flexShrink: 0 }}>
                      Retry now
                    </Button>
                  </Group>
                </Alert>
                <Group justify="space-between">
                  <Title order={3}>Purchase orders</Title>
                  <Button leftSection={<IconPlus size={16} />} disabled>
                    New order
                  </Button>
                </Group>
                <Paper withBorder>
                  {ORDERS.slice(0, 4).map((order, i) => (
                    <div key={order.id} className={styles.row}>
                      <div>
                        <Text size="sm" fw={500}>
                          {order.supplier}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {order.number} · updated {i < 2 ? 'just now' : order.updated}
                        </Text>
                      </div>
                      <Group gap="sm" wrap="nowrap">
                        {i < 2 && (
                          <Badge color="yellow" leftSection={<IconClock size={12} />}>
                            Pending sync
                          </Badge>
                        )}
                        <StatusBadge order={order} />
                        <Text size="sm" fw={600} className={styles.amount}>
                          {formatMoney(order.amount)}
                        </Text>
                      </Group>
                    </div>
                  ))}
                </Paper>
              </div>
            </AppShellFrame>
          </BrowserFrame>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

/** A completed confirmation card and the small inline success signals. */
export function SuccessStates() {
  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        <Specimen
          surface="muted"
          label="Completed"
          note={
            <>
              Green <code>ThemeIcon</code> check, what happened and who acts next, a summary of what
              was submitted, then the two likely next moves.
            </>
          }
        >
          <Card withBorder padding="xl">
            <Stack align="center" gap="sm" ta="center">
              <ThemeIcon color="green" variant="light" size={56} radius="xl">
                <IconCheck size={28} />
              </ThemeIcon>
              <Title order={3}>Purchase order submitted</Title>
              <Text size="sm" c="dimmed" maw={360}>
                PO-2042 is waiting for approval from {USERS[2].name}. We’ll email you when it’s
                decided.
              </Text>
            </Stack>
            <div className={styles.summary} style={{ marginTop: 'var(--ds-spacing-6)' }}>
              <dl>
                <div>
                  <dt>Supplier</dt>
                  <dd>Atlas Packaging</dd>
                </div>
                <div>
                  <dt>Amount</dt>
                  <dd>{formatMoney(18450)}</dd>
                </div>
                <div>
                  <dt>Approver</dt>
                  <dd>{USERS[2].name}</dd>
                </div>
                <div>
                  <dt>Expected decision</dt>
                  <dd>Within 1 business day</dd>
                </div>
              </dl>
            </div>
            <Group justify="center" gap="sm" mt="lg">
              <Button variant="default">Create another</Button>
              <Button>View order</Button>
            </Group>
          </Card>
        </Specimen>

        <Specimen
          surface="muted"
          align="start"
          label="Inline success"
          note={
            <>
              Quieter confirmations: a green <code>Alert</code> after a save, a completed{' '}
              <code>Stepper</code>, and a checked task list — success never needs a modal.
            </>
          }
        >
          <Stack gap="md">
            <Alert
              color="green"
              icon={<IconCircleCheck size={18} />}
              title="Changes saved"
              withCloseButton
              closeButtonLabel="Dismiss"
            >
              Atlas Packaging’s payment terms are now Net 45.
            </Alert>
            <Card withBorder padding="lg">
              <Text size="sm" fw={600} mb="md">
                Supplier onboarding
              </Text>
              <Stepper active={3} size="xs" orientation="vertical" allowNextStepsSelect={false}>
                <Stepper.Step label="Company details" description="Registered address and tax ID" />
                <Stepper.Step label="Banking" description="Account verified" />
                <Stepper.Step label="Contract" description="Signed 27 Oct" />
                <Stepper.Completed>
                  <Group gap="xs" mt="md" c="dimmed" wrap="nowrap" align="flex-start">
                    <IconCircleCheck size={16} />
                    <Text size="sm" c="dimmed">
                      Onboarding complete · Atlas Packaging can receive orders.
                    </Text>
                  </Group>
                </Stepper.Completed>
              </Stepper>
            </Card>
            <Card withBorder padding="lg">
              <Group justify="space-between" mb="sm">
                <Text size="sm" fw={600}>
                  Month-end checklist
                </Text>
                <Badge color="green">3 of 3 done</Badge>
              </Group>
              <Stack gap="xs">
                {[
                  'Reconcile supplier invoices',
                  'Close open approvals',
                  'Export spend to finance',
                ].map((task) => (
                  <Checkbox key={task} label={task} defaultChecked size="sm" />
                ))}
              </Stack>
            </Card>
          </Stack>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

interface Toast {
  id: number;
  kind: 'undo' | 'progress' | 'error' | 'success';
  title: string;
  message: string;
}

const TOAST_ICON: Record<Toast['kind'], { color?: string; icon?: Icon }> = {
  undo: { color: 'gray', icon: IconTrash },
  progress: {},
  error: { color: 'red', icon: IconX },
  success: { color: 'green', icon: IconCheck },
};

/** A bottom-right toast stack with undo, progress, error-with-retry and success toasts. */
export function ActionToasts() {
  const nextId = useRef(4);
  const [toasts, setToasts] = useState<Toast[]>([
    {
      id: 1,
      kind: 'success',
      title: 'PO-2040 approved',
      message: 'Keystone Logistics has been notified.',
    },
    {
      id: 2,
      kind: 'progress',
      title: 'Exporting 128 orders',
      message: '64% · about 20 seconds left',
    },
    { id: 3, kind: 'undo', title: 'PO-2036 deleted', message: 'Harbor Office Supply · $980' },
  ]);

  const push = (toast: Omit<Toast, 'id'>) => {
    const id = nextId.current++;
    setToasts((cur) => [...cur, { ...toast, id }].slice(-4));
  };
  const dismiss = (id: number) => setToasts((cur) => cur.filter((t) => t.id !== id));

  return (
    <Gallery>
      <SpecimenGrid cols={1}>
        <Specimen
          span="full"
          surface="muted"
          label="Toast stack"
          note={
            <>
              Static <code>Notification withBorder</code>s stacked bottom-right, newest at the
              bottom, four at most. Toasts carry one inline action — Undo, Retry — and progress
              toasts can’t be dismissed. <code>@mantine/notifications</code> is not in the kit; this
              is the composed equivalent.
            </>
          }
        >
          <div className={styles.toastViewport}>
            <Card withBorder padding="lg">
              <Group justify="space-between" mb="md">
                <Title order={4}>Purchase orders</Title>
                <Group gap="xs">
                  <Button
                    variant="default"
                    size="compact-sm"
                    leftSection={<IconTrash size={14} />}
                    onClick={() =>
                      push({
                        kind: 'undo',
                        title: 'PO-2039 deleted',
                        message: 'Brightline Electrical · $3,150',
                      })
                    }
                  >
                    Delete an order
                  </Button>
                  <Button
                    variant="default"
                    size="compact-sm"
                    leftSection={<IconAlertTriangle size={14} />}
                    onClick={() =>
                      push({
                        kind: 'error',
                        title: 'ERP sync failed',
                        message: '3 orders could not be exported.',
                      })
                    }
                  >
                    Fail a sync
                  </Button>
                  <Button
                    variant="default"
                    size="compact-sm"
                    leftSection={<IconCheck size={14} />}
                    onClick={() =>
                      push({
                        kind: 'success',
                        title: 'Order saved',
                        message: 'PO-2041 · Atlas Packaging was updated.',
                      })
                    }
                  >
                    Save
                  </Button>
                </Group>
              </Group>
              <Table withTableBorder={false} verticalSpacing="sm">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Order</Table.Th>
                    <Table.Th>Supplier</Table.Th>
                    <Table.Th>Owner</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th className={styles.amount}>Amount</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {ORDERS.slice(0, 5).map((order) => (
                    <Table.Tr key={order.id}>
                      <Table.Td>{order.number}</Table.Td>
                      <Table.Td>{order.supplier}</Table.Td>
                      <Table.Td>{order.owner.name}</Table.Td>
                      <Table.Td>
                        <StatusBadge order={order} />
                      </Table.Td>
                      <Table.Td className={styles.amount}>{formatMoney(order.amount)}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Card>
            <div className={styles.toastStack} role="region" aria-label="Notifications">
              {[...toasts].reverse().map((toast) => {
                const { color, icon: ToastIcon } = TOAST_ICON[toast.kind];
                const isProgress = toast.kind === 'progress';
                return (
                  <Notification
                    key={toast.id}
                    withBorder
                    color={color}
                    loading={isProgress}
                    icon={ToastIcon ? <ToastIcon size={16} /> : undefined}
                    title={toast.title}
                    withCloseButton={!isProgress}
                    closeButtonProps={{ 'aria-label': `Dismiss ${toast.title}` }}
                    onClose={() => dismiss(toast.id)}
                  >
                    {isProgress ? (
                      <Stack gap={6} mt={2}>
                        <Text size="sm" c="dimmed">
                          {toast.message}
                        </Text>
                        <Progress size="xs" value={64} aria-label="Export progress, 64%" />
                      </Stack>
                    ) : (
                      <Group justify="space-between" gap="sm" wrap="nowrap">
                        <Text size="sm" c="dimmed">
                          {toast.message}
                        </Text>
                        {toast.kind === 'undo' && (
                          <Button
                            size="compact-xs"
                            variant="subtle"
                            onClick={() => dismiss(toast.id)}
                          >
                            Undo
                          </Button>
                        )}
                        {toast.kind === 'error' && (
                          <Button
                            size="compact-xs"
                            variant="subtle"
                            color="red"
                            onClick={() => dismiss(toast.id)}
                          >
                            Retry
                          </Button>
                        )}
                      </Group>
                    )}
                  </Notification>
                );
              })}
            </div>
          </div>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}
