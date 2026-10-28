'use client';

import {
  ActionIcon,
  Alert,
  Anchor,
  Avatar,
  Badge,
  Breadcrumbs,
  Button,
  Card,
  Divider,
  Group,
  List,
  Menu,
  Modal,
  NumberInput,
  Progress,
  Select,
  Skeleton,
  Stack,
  Stepper,
  Table,
  Text,
  TextInput,
  Textarea,
  ThemeIcon,
  Timeline,
  Title,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconArchive,
  IconArrowBackUp,
  IconBuildingStore,
  IconCalendar,
  IconCheck,
  IconChevronRight,
  IconCircleCheck,
  IconCopy,
  IconDots,
  IconDownload,
  IconFileInvoice,
  IconFileSpreadsheet,
  IconFileTypePdf,
  IconLock,
  IconMessageCircle,
  IconPhoto,
  IconPlus,
  IconReceipt,
  IconTrash,
  IconTruckDelivery,
  IconUpload,
  IconX,
  type Icon,
} from '@tabler/icons-react';
import { useState, type ReactNode } from 'react';
import { AppShellFrame } from '../AppShellFrame';
import { Gallery } from '../Gallery';
import { BrowserFrame } from '../Layout';
import { ACTIVITY, CURRENT_USER, ORDERS, ORDER_STATUS, USERS, type MockUser, type OrderStatus } from '../data';
import styles from './record-detail.module.css';

/* ── Page-specific mock data ─────────────────────────────────── */

const ORDER = ORDERS[0];
const OWNER = ORDER.owner;
const APPROVER = USERS[2];
const SIGN_OFF = USERS[0];

const SUPPLIERS = ['Atlas Packaging', 'Keystone Logistics', 'Brightline Electrical', 'Meridian Foods', 'Cobalt IT Services', 'Harbor Office Supply'];
const CATEGORIES = ['Packaging', 'Freight', 'Facilities', 'Catering', 'Software', 'Office'];
const WAREHOUSES = ['Singapore DC · Tuas', 'Jurong West hub', 'Changi air cargo'];
const COST_CENTRES = ['OPS-410 · Fulfilment', 'OPS-220 · Warehousing', 'FIN-100 · Finance'];

const TAX_RATE = 0.08;
const SHIPPING = 420;
const BUDGET_CAP = 15000;

interface Line {
  id: string;
  item: string;
  sku: string;
  qty: number | string;
  price: number | string;
}

/** Sums to the $12,840 on ORDERS[0] once 8% tax and $420 freight are added. */
const LINES: Line[] = [
  { id: 'l1', item: 'Double-wall cartons', sku: 'ATL-DW-644', qty: 600, price: 12.5 },
  { id: 'l2', item: 'Stretch wrap 500 mm', sku: 'ATL-SW-500', qty: 40, price: 28 },
  { id: 'l3', item: 'Printed tape 48 mm', sku: 'ATL-PT-048', qty: 120, price: 9.75 },
  { id: 'l4', item: 'Void-fill paper', sku: 'ATL-VF-015', qty: 30, price: 57 },
];

/** The validation frame's edits: line 3 emptied, line 4 re-priced. */
const INVALID_LINES: Line[] = LINES.map((l) =>
  l.id === 'l3' ? { ...l, qty: 0 } : l.id === 'l4' ? { ...l, price: 54.5 } : l,
);

const ATTACHMENTS: Array<{ name: string; size: string; by: MockUser; when: string; icon: Icon }> = [
  { name: 'Atlas-quote-Q4-2026.pdf', size: '248 KB', by: OWNER, when: '24 Oct', icon: IconFileTypePdf },
  { name: 'Carton-spec-sheet.xlsx', size: '62 KB', by: OWNER, when: '24 Oct', icon: IconFileSpreadsheet },
  { name: 'Tape-artwork-v3.png', size: '1.4 MB', by: CURRENT_USER, when: '26 Oct', icon: IconPhoto },
];

interface Entry {
  id: string;
  user: MockUser;
  action: string;
  detail?: string;
  quote?: string;
  time: string;
}

/** ACTIVITY a2: Daniel submitted PO-2041 at 09:42 (ORDER.updated), an hour ago. */
const submitted = ACTIVITY.find((a) => a.target.startsWith(ORDER.number));
const SUBMITTER = submitted?.user ?? OWNER;
const SUBMITTED_AT = ORDER.updated;

const PENDING_ACTIVITY: Entry[] = [
  {
    id: 'q5',
    user: SUBMITTER,
    action: `${submitted?.action ?? 'submitted'} for approval`,
    detail: `Routed to ${APPROVER.name} · Budget owner`,
    time: submitted?.time ?? SUBMITTED_AT,
  },
  { id: 'q4', user: OWNER, action: 'added 2 line items', detail: 'Tape and void-fill paper', time: 'Today, 09:30' },
  { id: 'q3', user: CURRENT_USER, action: 'commented', quote: 'Can we bundle the void-fill into this order? Saves a second delivery.', time: '26 Oct' },
  { id: 'q2', user: OWNER, action: 'attached a file', detail: 'Atlas-quote-Q4-2026.pdf', time: '24 Oct' },
  { id: 'q1', user: OWNER, action: 'created the order', time: '24 Oct' },
];

const APPROVED_ACTIVITY: Entry[] = [
  { id: 'p3', user: SIGN_OFF, action: 'gave final sign-off', time: 'Today, 11:48' },
  { id: 'p2', user: APPROVER, action: 'approved as budget owner', quote: 'Within the Q4 packaging budget. Thanks for bundling.', time: 'Today, 11:20' },
  { id: 'p1', user: SUBMITTER, action: 'submitted for approval', detail: submitted?.target, time: SUBMITTED_AT },
  { id: 'p0', user: OWNER, action: 'created the order', time: '24 Oct' },
];

/** The create route starts with one blank line; freight is quoted after submit. */
const BLANK_LINES: Line[] = [{ id: 'n1', item: '', sku: '', qty: 1, price: '' }];

const RELATED: Array<{ icon: Icon; title: string; meta: string; status?: OrderStatus }> = [
  { icon: IconBuildingStore, title: 'Atlas Packaging', meta: 'Supplier · Net 30' },
  { icon: IconFileInvoice, title: 'PO-2035', meta: 'Previous order · $15,300', status: 'shipped' },
  { icon: IconReceipt, title: 'INV-8812', meta: 'Invoice · awaiting this PO' },
  { icon: IconTruckDelivery, title: 'GRN-0419', meta: 'Goods receipt · not started' },
];

/* ── Helpers ─────────────────────────────────────────────────── */

const usd = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);

const num = (v: number | string) => (typeof v === 'number' ? v : Number.parseFloat(v) || 0);

function totals(lines: Line[], freight: number | null = SHIPPING) {
  const subtotal = lines.reduce((sum, l) => sum + num(l.qty) * num(l.price), 0);
  const tax = subtotal * TAX_RATE;
  return { subtotal, tax, total: subtotal + tax + (freight ?? 0) };
}

/* ── Shared pieces ───────────────────────────────────────────── */

function SectionCard({
  title,
  description,
  right,
  children,
  flush,
}: {
  title: string;
  description?: string;
  right?: ReactNode;
  children: ReactNode;
  /** Let the body (a table) run edge to edge. */
  flush?: boolean;
}) {
  return (
    <Card padding="lg">
      <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm">
        <div className={styles.minw0}>
          <Title order={4}>{title}</Title>
          {description && (
            <Text size="xs" c="dimmed" mt={2}>
              {description}
            </Text>
          )}
        </div>
        {right}
      </Group>
      {flush ? children : <div className={styles.cardBody}>{children}</div>}
    </Card>
  );
}

/** One field cell in the VForm grid: `half` takes one of two columns, `full` both. */
function Field({
  width = 'half',
  state,
  children,
}: {
  width?: 'half' | 'full';
  state?: 'edited' | 'invalid';
  children: ReactNode;
}) {
  return (
    <div
      className={styles.field}
      data-width={width}
      data-edited={state === 'edited' || undefined}
      data-invalid={state === 'invalid' || undefined}
    >
      {children}
    </div>
  );
}

function GroupHeader({ label }: { label: string }) {
  return (
    <div className={styles.field} data-width="full">
      <Divider label={label} labelPosition="left" />
    </div>
  );
}

function Crumbs({ current }: { current: string }) {
  return (
    <Breadcrumbs separator={<IconChevronRight size={12} />} separatorMargin={6}>
      <Anchor href="#" size="sm" c="dimmed" onClick={(e) => e.preventDefault()}>
        Purchase orders
      </Anchor>
      <Text size="sm" fw={500}>
        {current}
      </Text>
    </Breadcrumbs>
  );
}

function StatusBadge({ status }: { status: OrderStatus }) {
  return <Badge color={ORDER_STATUS[status].color}>{ORDER_STATUS[status].label}</Badge>;
}

function OverflowMenu({ onDelete, locked }: { onDelete?: () => void; locked?: boolean }) {
  return (
    <Menu position="bottom-end" width={200}>
      <Menu.Target>
        <ActionIcon variant="default" size="lg" aria-label="More actions">
          <IconDots size={18} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item leftSection={<IconCopy size={16} />}>Duplicate</Menu.Item>
        <Menu.Item leftSection={<IconDownload size={16} />}>Download PDF</Menu.Item>
        <Menu.Item leftSection={<IconArchive size={16} />}>Archive</Menu.Item>
        <Menu.Divider />
        <Menu.Item color="red" leftSection={<IconTrash size={16} />} onClick={onDelete} disabled={locked}>
          Delete order
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

function RecordHeader({
  status,
  actions,
  extraBadge,
  title = ORDER.number,
  crumb = ORDER.number,
  updated = ORDER.updated,
  meta,
}: {
  status?: OrderStatus;
  actions?: ReactNode;
  extraBadge?: ReactNode;
  title?: string;
  crumb?: string;
  updated?: string;
  meta?: ReactNode;
}) {
  return (
    <div className={styles.header}>
      <div className={styles.headerText}>
        <Crumbs current={crumb} />
        <Group gap="sm" mt="xs" wrap="wrap">
          <Title order={2}>{title}</Title>
          {status && <StatusBadge status={status} />}
          {extraBadge}
        </Group>
        {meta ?? (
          <Group gap={8} mt={6} wrap="nowrap" align="flex-start">
            <Avatar size={20} radius="xl" color="primary">
              {OWNER.initials}
            </Avatar>
            <Text size="sm" c="dimmed">
              Created by <Text span size="sm" fw={500} c="var(--ds-ink)">{OWNER.name}</Text> on 24 Oct 2026 · Updated{' '}
              {updated.toLowerCase()}
            </Text>
          </Group>
        )}
      </div>
      {actions && <div className={styles.headerActions}>{actions}</div>}
    </div>
  );
}

function DeleteModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={`Delete ${ORDER.number}?`}
      centered
      size="sm"
    >
      <Stack gap="md">
        <Text size="sm">
          The order, its {LINES.length} line items and {ATTACHMENTS.length} attachments are removed for everyone. This
          can&apos;t be undone.
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button color="red" onClick={onClose}>
            Delete order
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

/* ── Main column ─────────────────────────────────────────────── */

function DetailsForm({ invalid, blank }: { invalid?: boolean; blank?: boolean }) {
  return (
    <SectionCard title="Details" description="Who you're buying from and where it goes.">
      <div className={styles.formGrid}>
        <Field state={invalid ? 'invalid' : undefined}>
          <Select
            label="Supplier"
            withAsterisk
            searchable
            placeholder="Choose a supplier"
            data={SUPPLIERS}
            defaultValue={invalid || blank ? null : ORDER.supplier}
            error={invalid ? 'Supplier is required' : undefined}
          />
        </Field>
        <Field>
          <Select
            label="Category"
            withAsterisk={blank}
            placeholder="Choose a category"
            data={CATEGORIES}
            defaultValue={blank ? null : ORDER.category}
            allowDeselect={false}
          />
        </Field>
        <Field state={invalid ? 'invalid' : undefined}>
          <TextInput
            label="Due date"
            withAsterisk
            placeholder="DD MMM YYYY"
            leftSection={<IconCalendar size={16} />}
            defaultValue={blank ? '' : invalid ? '20 Oct 2026' : '04 Nov 2026'}
            error={invalid ? "Can't be before today (28 Oct)" : undefined}
          />
        </Field>
        <Field state={invalid ? 'edited' : undefined}>
          <NumberInput
            label="Budget (incl. tax)"
            description={blank ? 'Over $10,000 needs two approvers' : undefined}
            placeholder="$0.00"
            prefix="$"
            thousandSeparator=","
            decimalScale={2}
            fixedDecimalScale
            min={0}
            step={500}
            defaultValue={blank ? '' : invalid ? 16500 : BUDGET_CAP}
          />
        </Field>
        <GroupHeader label="Delivery" />
        <Field>
          <Select label="Ship to" withAsterisk={blank} data={WAREHOUSES} defaultValue={WAREHOUSES[0]} allowDeselect={false} />
        </Field>
        <Field>
          <Select
            label="Cost centre"
            placeholder="Choose a cost centre"
            data={COST_CENTRES}
            defaultValue={blank ? null : COST_CENTRES[0]}
            allowDeselect={false}
          />
        </Field>
        <Field width="full">
          <Textarea
            label="Notes for the supplier"
            autosize
            minRows={2}
            placeholder="Delivery window, dock, packing instructions…"
            defaultValue={blank ? '' : 'Deliver to dock 3 between 08:00 and 14:00. Pallets no taller than 1.6 m.'}
          />
        </Field>
      </div>
    </SectionCard>
  );
}

function TotalsSummary({ lines, freight = SHIPPING }: { lines: Line[]; freight?: number | null }) {
  const t = totals(lines, freight);
  return (
    <dl className={styles.totals}>
      <div>
        <dt>Subtotal</dt>
        <dd>{usd(t.subtotal)}</dd>
      </div>
      <div>
        <dt>Tax (8% GST)</dt>
        <dd>{usd(t.tax)}</dd>
      </div>
      <div>
        <dt>Freight</dt>
        <dd>{freight === null ? 'Quoted later' : usd(freight)}</dd>
      </div>
      <div data-total>
        <dt>Total</dt>
        <dd>{usd(t.total)}</dd>
      </div>
    </dl>
  );
}

function LineItemsEditor({
  lines,
  onChange,
  invalid,
  freight = SHIPPING,
  footnote = 'Freight is quoted by Atlas per delivery. Tax applies to goods only.',
}: {
  lines: Line[];
  onChange: (next: Line[]) => void;
  invalid?: boolean;
  freight?: number | null;
  footnote?: string;
}) {
  const update = (id: string, patch: Partial<Line>) => onChange(lines.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const add = () => onChange([...lines, { id: `new-${Date.now()}`, item: '', sku: '', qty: 1, price: '' }]);

  return (
    <SectionCard
      flush
      title="Line items"
      description={`${lines.length} ${lines.length === 1 ? 'line' : 'lines'} · prices in USD, excl. tax`}
      right={
        <Button variant="default" size="xs" leftSection={<IconPlus size={14} />} onClick={add}>
          Add line
        </Button>
      }
    >
      <Card.Section withBorder mt="md">
        <Table.ScrollContainer minWidth={560}>
          <Table withTableBorder={false} verticalSpacing="xs" horizontalSpacing="sm" className={styles.lineTable}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Item</Table.Th>
                <Table.Th w={84}>Qty</Table.Th>
                <Table.Th w={116}>Unit price</Table.Th>
                <Table.Th w={104} ta="right">
                  Amount
                </Table.Th>
                <Table.Th w={44}>
                  <span className={styles.srOnly}>Remove</span>
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {lines.map((l, i) => {
                const qtyError = invalid && num(l.qty) < 1 ? 'Must be at least 1' : undefined;
                const edited = invalid && l.id === 'l4' && num(l.price) !== 57;
                return (
                  <Table.Tr key={l.id} data-edited={edited || undefined} data-invalid={qtyError ? true : undefined}>
                    <Table.Td>
                      <TextInput
                        aria-label={`Line ${i + 1} item`}
                        placeholder="Describe the item"
                        value={l.item}
                        onChange={(e) => update(l.id, { item: e.currentTarget.value })}
                      />
                      {l.sku && (
                        <Text size="xs" c="dimmed" mt={4} ff="var(--ds-font-mono)">
                          {l.sku}
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <NumberInput
                        aria-label={`Line ${i + 1} quantity`}
                        min={0}
                        hideControls
                        value={l.qty}
                        error={qtyError}
                        onChange={(v) => update(l.id, { qty: v })}
                      />
                    </Table.Td>
                    <Table.Td>
                      <NumberInput
                        aria-label={`Line ${i + 1} unit price`}
                        placeholder="$0.00"
                        prefix="$"
                        min={0}
                        decimalScale={2}
                        fixedDecimalScale
                        thousandSeparator=","
                        hideControls
                        value={l.price}
                        onChange={(v) => update(l.id, { price: v })}
                      />
                    </Table.Td>
                    <Table.Td ta="right">
                      <Text size="sm" fw={600} className={styles.num}>
                        {usd(num(l.qty) * num(l.price))}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        aria-label={`Remove line ${i + 1}`}
                        disabled={lines.length === 1}
                        onClick={() => onChange(lines.filter((x) => x.id !== l.id))}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Card.Section>
      <div className={styles.lineFooter}>
        <Text size="xs" c="dimmed" maw={240}>
          {footnote}
        </Text>
        <TotalsSummary lines={lines} freight={freight} />
      </div>
    </SectionCard>
  );
}

function LineItemsStatic() {
  return (
    <SectionCard flush title="Line items" description={`${LINES.length} lines · prices in USD, excl. tax`}>
      <Card.Section withBorder mt="md">
        <Table.ScrollContainer minWidth={520}>
          <Table withTableBorder={false} verticalSpacing="sm" horizontalSpacing="md">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Item</Table.Th>
                <Table.Th ta="right">Qty</Table.Th>
                <Table.Th ta="right">Unit price</Table.Th>
                <Table.Th ta="right">Amount</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {LINES.map((l) => (
                <Table.Tr key={l.id}>
                  <Table.Td>
                    <Text size="sm" fw={500}>
                      {l.item}
                    </Text>
                    <Text size="xs" c="dimmed" ff="var(--ds-font-mono)">
                      {l.sku}
                    </Text>
                  </Table.Td>
                  <Table.Td ta="right" className={styles.num}>
                    {num(l.qty).toLocaleString('en-US')}
                  </Table.Td>
                  <Table.Td ta="right" className={styles.num}>
                    {usd(num(l.price))}
                  </Table.Td>
                  <Table.Td ta="right" className={styles.num}>
                    <Text size="sm" fw={600} span>
                      {usd(num(l.qty) * num(l.price))}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Card.Section>
      <div className={styles.lineFooter}>
        <span />
        <TotalsSummary lines={LINES} />
      </div>
    </SectionCard>
  );
}

function Attachments({ readOnly, empty }: { readOnly?: boolean; empty?: boolean }) {
  const files = empty ? [] : ATTACHMENTS;
  return (
    <SectionCard
      title="Attachments"
      description={empty ? 'Optional · quotes and specs' : `${files.length} files · quotes and specs`}
      right={
        readOnly ? undefined : (
          <Button variant="default" size="xs" leftSection={<IconUpload size={14} />}>
            Upload
          </Button>
        )
      }
    >
      <Stack gap={0}>
        {files.map((f, i) => {
          const FileIcon = f.icon;
          return (
            <div key={f.name}>
              {i > 0 && <Divider />}
              <Group gap="sm" py="sm" wrap="nowrap">
                <ThemeIcon variant="light" color="gray" size="lg" radius="md" aria-hidden>
                  <FileIcon size={18} stroke={1.8} />
                </ThemeIcon>
                <div className={styles.minw0}>
                  <Text size="sm" fw={500} truncate>
                    {f.name}
                  </Text>
                  <Text size="xs" c="dimmed" truncate>
                    {f.size} · {f.by.name} · {f.when}
                  </Text>
                </div>
                <Tooltip label="Download">
                  <ActionIcon variant="subtle" color="gray" aria-label={`Download ${f.name}`}>
                    <IconDownload size={16} />
                  </ActionIcon>
                </Tooltip>
                {!readOnly && (
                  <Tooltip label="Remove">
                    <ActionIcon variant="subtle" color="gray" aria-label={`Remove ${f.name}`}>
                      <IconX size={16} />
                    </ActionIcon>
                  </Tooltip>
                )}
              </Group>
            </div>
          );
        })}
      </Stack>
      {!readOnly && (
        <div className={styles.dropHint}>
          <IconUpload size={16} aria-hidden />
          <Text size="xs" c="dimmed">
            Drop files here or{' '}
            <Anchor href="#" size="xs" onClick={(e) => e.preventDefault()}>
              browse
            </Anchor>{' '}
            · PDF, XLSX or images up to 25 MB
          </Text>
        </div>
      )}
    </SectionCard>
  );
}

type Stage = 'new' | 'pending' | 'approved';

const STAGE_COPY: Record<Stage, { active: number; description: string; steps: [string, string, string] }> = {
  new: {
    active: 0,
    description: 'Orders over $10,000 need two approvers.',
    steps: ['You · Requester — in progress', `${APPROVER.name} · Finance`, `${SIGN_OFF.name} · Administrator`],
  },
  pending: {
    active: 1,
    description: 'Step 1 of 2 approvals · waiting on Finance.',
    steps: [
      `${SUBMITTER.name} · submitted ${SUBMITTED_AT.toLowerCase()}`,
      `${APPROVER.name} · Finance — awaiting review`,
      `${SIGN_OFF.name} · Administrator`,
    ],
  },
  approved: {
    active: 3,
    description: 'Completed today · 2 h 6 min end to end',
    steps: [
      `${SUBMITTER.name} · submitted ${SUBMITTED_AT.toLowerCase()}`,
      `${APPROVER.name} · approved today, 11:20`,
      `${SIGN_OFF.name} · approved today, 11:48`,
    ],
  },
};

function ApprovalChain({ stage }: { stage: Stage }) {
  const copy = STAGE_COPY[stage];
  return (
    <SectionCard title="Approval" description={copy.description}>
      <Stepper active={copy.active} orientation="vertical" size="sm" allowNextStepsSelect={false}>
        <Stepper.Step label="Prepare and submit" description={copy.steps[0]} />
        <Stepper.Step label="Budget owner review" description={copy.steps[1]} />
        <Stepper.Step label="Final sign-off" description={copy.steps[2]} />
      </Stepper>
    </SectionCard>
  );
}

/** Read-only Details: the same half / full grid as the form, as label–value pairs. */
function DetailsReadOnly() {
  const rows: Array<{ label: string; value: ReactNode; width?: 'full' }> = [
    { label: 'Supplier', value: ORDER.supplier },
    { label: 'Category', value: ORDER.category },
    { label: 'Due date', value: '04 Nov 2026' },
    { label: 'Budget (incl. tax)', value: usd(BUDGET_CAP) },
    { label: 'Ship to', value: WAREHOUSES[0] },
    { label: 'Cost centre', value: COST_CENTRES[0] },
    { label: 'Notes for the supplier', value: 'Deliver to dock 3 between 08:00 and 14:00. Pallets no taller than 1.6 m.', width: 'full' },
  ];
  return (
    <SectionCard
      title="Details"
      description="Locked after approval."
      right={
        <Tooltip label="Approved orders are read-only">
          <ThemeIcon variant="light" color="gray" size="md" radius="xl" aria-label="Read-only">
            <IconLock size={14} />
          </ThemeIcon>
        </Tooltip>
      }
    >
      <dl className={styles.formGrid}>
        {rows.map((r) => (
          <div key={r.label} className={styles.field} data-width={r.width ?? 'half'}>
            <Text component="dt" size="xs" c="dimmed" fw={500}>
              {r.label}
            </Text>
            <Text component="dd" size="sm" fw={500} mt={2} className={styles.dd}>
              {r.value}
            </Text>
          </div>
        ))}
      </dl>
    </SectionCard>
  );
}

/* ── Side column ─────────────────────────────────────────────── */

function SummaryStrip({ total }: { total: number }) {
  const used = Math.round((total / BUDGET_CAP) * 100);
  return (
    <Card padding="lg">
      <div className={styles.strip}>
        <div className={styles.stat}>
          <Text size="xs" c="dimmed" fw={500}>
            Order total
          </Text>
          <Title order={3} mt={4} className={styles.num}>
            {usd(total)}
          </Title>
        </div>
        <div className={styles.stat}>
          <Group justify="space-between" gap="xs" wrap="nowrap">
            <Text size="xs" c="dimmed" fw={500} truncate>
              Budget used
            </Text>
            <Text size="xs" fw={600}>
              {used}%
            </Text>
          </Group>
          <Progress
            value={Math.min(used, 100)}
            size="sm"
            mt={10}
            aria-label="Budget used"
            color={used > 100 ? 'red' : undefined}
          />
          <Text size="xs" c="dimmed" mt={6}>
            of {usd(BUDGET_CAP).replace('.00', '')} cap
          </Text>
        </div>
        <div className={styles.stat}>
          <Text size="xs" c="dimmed" fw={500}>
            Owner
          </Text>
          <Group gap={6} mt={8} wrap="nowrap">
            <Avatar size={22} radius="xl" color="primary">
              {OWNER.initials}
            </Avatar>
            <Text size="sm" fw={500} truncate>
              {OWNER.name}
            </Text>
          </Group>
        </div>
      </div>
    </Card>
  );
}

function ActivityCard({ entries, composer = true }: { entries: Entry[]; composer?: boolean }) {
  return (
    <Card padding="lg">
      <Group justify="space-between">
        <Title order={4}>Activity</Title>
        {entries.length > 0 && <Badge color="gray">{entries.length}</Badge>}
      </Group>
      {composer && (
        <div className={styles.composer}>
          <Textarea aria-label="Add a comment" placeholder="Add a comment…" autosize minRows={2} />
          <Group justify="flex-end" mt="xs">
            <Button size="xs" variant="default">
              Comment
            </Button>
          </Group>
        </div>
      )}
      {entries.length === 0 && (
        <Stack align="center" gap={6} py="xl" ta="center">
          <ThemeIcon variant="light" color="gray" size="xl" radius="xl" aria-hidden>
            <IconMessageCircle size={20} stroke={1.8} />
          </ThemeIcon>
          <Text size="sm" fw={500}>
            No activity yet
          </Text>
          <Text size="xs" c="dimmed" maw={220}>
            Comments, edits and approvals appear here once the order is saved.
          </Text>
        </Stack>
      )}
      <Timeline bulletSize={24} lineWidth={2} mt="lg" display={entries.length ? undefined : 'none'}>
        {entries.map((e) => (
          <Timeline.Item
            key={e.id}
            bullet={
              <Avatar size={20} radius="xl" color="primary">
                {e.user.initials}
              </Avatar>
            }
          >
            <Text size="sm" lh={1.35}>
              <Text span size="sm" fw={600}>
                {e.user.name}
              </Text>{' '}
              {e.action}
            </Text>
            {e.detail && (
              <Text size="xs" c="dimmed" mt={2}>
                {e.detail}
              </Text>
            )}
            {e.quote && <div className={styles.quote}>{e.quote}</div>}
            <Text size="xs" c="dimmed" mt={4}>
              {e.time}
            </Text>
          </Timeline.Item>
        ))}
      </Timeline>
    </Card>
  );
}

function RelatedCard() {
  return (
    <Card padding="lg">
      <Title order={4}>Related</Title>
      <Stack gap={4} mt="sm">
        {RELATED.map((r) => {
          const RelIcon = r.icon;
          return (
            <UnstyledButton key={r.title} className={styles.related}>
              <ThemeIcon variant="light" color="gray" size="md" radius="md" aria-hidden>
                <RelIcon size={16} stroke={1.8} />
              </ThemeIcon>
              <div className={styles.minw0}>
                <Group gap={6} wrap="nowrap">
                  <Text size="sm" fw={500} truncate>
                    {r.title}
                  </Text>
                  {r.status && (
                    <Badge size="xs" color={ORDER_STATUS[r.status].color}>
                      {ORDER_STATUS[r.status].label}
                    </Badge>
                  )}
                </Group>
                <Text size="xs" c="dimmed" truncate>
                  {r.meta}
                </Text>
              </div>
              <IconChevronRight size={14} className={styles.chevron} aria-hidden />
            </UnstyledButton>
          );
        })}
      </Stack>
    </Card>
  );
}

/* ── Templates ───────────────────────────────────────────────── */

/** PO-2041 pending approval and open for review: VForm-style Details, editable line items, attachments, approval chain and a context column. */
export function RecordDetailTemplate() {
  const [deleting, setDeleting] = useState(false);
  const [lines, setLines] = useState<Line[]>(LINES);
  return (
    <Gallery>
      <BrowserFrame url={`/en/orders/${ORDER.number.toLowerCase()}`} height={860}>
        <AppShellFrame active="/orders" title={ORDER.number}>
          <div className={styles.root}>
            <RecordHeader
              status={ORDER.status}
              actions={
                <>
                  <OverflowMenu onDelete={() => setDeleting(true)} />
                  <Button variant="default" leftSection={<IconArrowBackUp size={16} />}>
                    Request changes
                  </Button>
                  <Button color="primary" leftSection={<IconCheck size={16} />}>
                    Approve
                  </Button>
                </>
              }
            />

            <SummaryStrip total={totals(lines).total} />
            <DetailsForm />
            <LineItemsEditor lines={lines} onChange={setLines} />

            <div className={styles.band}>
              <div className={styles.col}>
                <Attachments />
                <ApprovalChain stage="pending" />
              </div>
              <div className={styles.col} data-aside>
                <ActivityCard entries={PENDING_ACTIVITY} />
                <RelatedCard />
              </div>
            </div>
          </div>
          <DeleteModal opened={deleting} onClose={() => setDeleting(false)} />
        </AppShellFrame>
      </BrowserFrame>
    </Gallery>
  );
}

/** The same record after approval: success banner, read-only fields, static totals and a completed approval chain. */
export function RecordDetailApproved() {
  return (
    <Gallery>
      <BrowserFrame url={`/en/orders/${ORDER.number.toLowerCase()}`} height={760}>
        <AppShellFrame active="/orders" title={ORDER.number}>
          <div className={styles.root}>
            <RecordHeader
              status="approved"
              updated="Today, 11:48"
              extraBadge={
                <Badge color="gray" leftSection={<IconLock size={12} />}>
                  Read-only
                </Badge>
              }
              actions={
                <>
                  <OverflowMenu locked />
                  <Button variant="default" leftSection={<IconCopy size={16} />}>
                    Create revision
                  </Button>
                  <Button leftSection={<IconTruckDelivery size={16} />}>Record delivery</Button>
                </>
              }
            />

            <Alert color="green" icon={<IconCircleCheck size={18} />} title="Approved and sent to Atlas Packaging">
              {APPROVER.name} and {SIGN_OFF.name} approved this order today at 11:48. Fields are locked — create a
              revision to change quantities or prices.
            </Alert>

            <SummaryStrip total={totals(LINES).total} />
            <DetailsReadOnly />

            <LineItemsStatic />

            <div className={styles.band}>
              <div className={styles.col}>
                <ApprovalChain stage="approved" />
                <Attachments readOnly />
              </div>
              <div className={styles.col} data-aside>
                <ActivityCard entries={APPROVED_ACTIVITY} />
              </div>
            </div>
          </div>
        </AppShellFrame>
      </BrowserFrame>
    </Gallery>
  );
}

/** Unsaved edits that fail validation: error summary, invalid and edited fields, and a sticky save bar. */
export function RecordDetailValidation() {
  const [discarded, setDiscarded] = useState(false);
  const [lines, setLines] = useState<Line[]>(INVALID_LINES);
  const discard = () => {
    setLines(LINES);
    setDiscarded(true);
  };
  return (
    <Gallery>
      <BrowserFrame url={`/en/orders/${ORDER.number.toLowerCase()}`} height={760}>
        <AppShellFrame active="/orders" title={ORDER.number}>
          <div className={styles.root} key={discarded ? 'clean' : 'dirty'}>
            <RecordHeader
              status={ORDER.status}
              extraBadge={
                discarded ? undefined : (
                  <Badge variant="dot" color="orange">
                    Unsaved changes
                  </Badge>
                )
              }
              actions={
                <>
                  <OverflowMenu />
                  <Tooltip label="Fix the errors below first" disabled={discarded}>
                    <Button color="primary" leftSection={<IconCheck size={16} />} disabled={!discarded}>
                      Approve
                    </Button>
                  </Tooltip>
                </>
              }
            />

            {!discarded && (
              <Alert color="red" icon={<IconAlertCircle size={18} />} title="3 fields need attention before you can approve">
                <List size="sm" spacing={2}>
                  <List.Item>
                    <Anchor href="#" size="sm" onClick={(e) => e.preventDefault()}>
                      Supplier
                    </Anchor>{' '}
                    is required
                  </List.Item>
                  <List.Item>
                    <Anchor href="#" size="sm" onClick={(e) => e.preventDefault()}>
                      Due date
                    </Anchor>{' '}
                    can&apos;t be in the past
                  </List.Item>
                  <List.Item>
                    <Anchor href="#" size="sm" onClick={(e) => e.preventDefault()}>
                      Line 3 quantity
                    </Anchor>{' '}
                    must be at least 1
                  </List.Item>
                </List>
              </Alert>
            )}

            <DetailsForm invalid={!discarded} />
            <LineItemsEditor invalid={!discarded} lines={lines} onChange={setLines} />
          </div>

          <div className={styles.saveBar}>
            {discarded ? (
              <Text size="sm" c="dimmed">
                No unsaved changes
              </Text>
            ) : (
              <Group gap="sm" wrap="nowrap" className={styles.minw0}>
                <Badge variant="dot" color="orange" className={styles.noShrink}>
                  2 edits
                </Badge>
                <Badge color="red" leftSection={<IconAlertCircle size={12} />} className={styles.noShrink}>
                  3 errors
                </Badge>
                <Text size="sm" c="dimmed" truncate>
                  Saving keeps it in review.
                </Text>
              </Group>
            )}
            <Group gap="xs" wrap="nowrap">
              <Button variant="default" disabled={discarded} onClick={discard}>
                Discard
              </Button>
              <Button disabled={discarded}>Save changes</Button>
            </Group>
          </div>
        </AppShellFrame>
      </BrowserFrame>
    </Gallery>
  );
}

/** The create route `buildpad add content-routes` generates: a blank CollectionForm with one empty line and a sticky footer. */
export function RecordDetailCreate() {
  const [lines, setLines] = useState<Line[]>(BLANK_LINES);
  return (
    <Gallery>
      <BrowserFrame url="/en/orders/new" height={760}>
        <AppShellFrame active="/orders" title="New purchase order">
          <div className={styles.root}>
            <RecordHeader
              title="New purchase order"
              crumb="New"
              meta={
                <Group gap={8} mt={6} wrap="nowrap" align="flex-start">
                  <Avatar size={20} radius="xl" color="primary">
                    {CURRENT_USER.initials}
                  </Avatar>
                  <Text size="sm" c="dimmed">
                    Requested by{' '}
                    <Text span size="sm" fw={500} c="var(--ds-ink)">
                      {CURRENT_USER.name}
                    </Text>{' '}
                    · Not saved yet
                  </Text>
                </Group>
              }
            />

            <DetailsForm blank />
            <LineItemsEditor
              lines={lines}
              onChange={setLines}
              freight={null}
              footnote="The supplier quotes freight after you submit. Tax applies to goods only."
            />

            <div className={styles.band}>
              <div className={styles.col}>
                <Attachments empty />
                <ApprovalChain stage="new" />
              </div>
              <div className={styles.col} data-aside>
                <ActivityCard entries={[]} composer={false} />
              </div>
            </div>
          </div>

          <div className={styles.saveBar}>
            <Text size="sm" c="dimmed">
              Fields marked{' '}
              <Text span c="red" inherit>
                *
              </Text>{' '}
              are required
            </Text>
            <Group gap="xs" wrap="nowrap">
              <Button variant="subtle" color="gray">
                Cancel
              </Button>
              <Button variant="default">Save draft</Button>
              <Button color="primary" leftSection={<IconPlus size={16} />}>
                Create order
              </Button>
            </Group>
          </div>
        </AppShellFrame>
      </BrowserFrame>
    </Gallery>
  );
}

function SkeletonField({ full }: { full?: boolean }) {
  return (
    <div className={styles.field} data-width={full ? 'full' : 'half'}>
      <Skeleton height={10} width={90} />
      <Skeleton height={full ? 60 : 36} mt={10} />
    </div>
  );
}

/** First paint while the record loads: Skeleton blocks in the shape of the header, summary, form and side column. */
export function RecordDetailLoading() {
  return (
    <Gallery>
      <BrowserFrame url={`/en/orders/${ORDER.number.toLowerCase()}`} height={640}>
        <AppShellFrame active="/orders" title={ORDER.number}>
          <div className={styles.root} aria-busy="true" aria-label="Loading purchase order">
            <div className={styles.header}>
              <div className={styles.headerText}>
                <Skeleton height={12} width={160} />
                <Group gap="sm" mt={14}>
                  <Skeleton height={28} width={140} />
                  <Skeleton height={20} width={110} />
                </Group>
                <Group gap={8} mt={12} wrap="nowrap">
                  <Skeleton height={20} circle />
                  <Skeleton height={12} width={280} />
                </Group>
              </div>
              <div className={styles.headerActions}>
                <Skeleton height={36} width={36} />
                <Skeleton height={36} width={150} />
                <Skeleton height={36} width={110} />
              </div>
            </div>

            <Card padding="lg">
              <div className={styles.strip}>
                {[0, 1, 2].map((i) => (
                  <div key={i} className={styles.stat}>
                    <Skeleton height={10} width={80} />
                    <Skeleton height={22} width={i === 1 ? '100%' : 120} mt={12} />
                  </div>
                ))}
              </div>
            </Card>

            <div className={styles.band}>
              <Card padding="lg">
                <Skeleton height={16} width={90} />
                <Skeleton height={10} width={220} mt={8} />
                <div className={styles.cardBody}>
                  <div className={styles.formGrid}>
                    <SkeletonField />
                    <SkeletonField />
                    <SkeletonField />
                    <SkeletonField />
                    <SkeletonField full />
                  </div>
                </div>
              </Card>
              <Card padding="lg">
                <Skeleton height={16} width={80} />
                <Stack gap="lg" mt="lg">
                  {[0, 1, 2].map((i) => (
                    <Group key={i} gap="sm" wrap="nowrap" align="flex-start">
                      <Skeleton height={24} circle />
                      <div className={styles.minw0}>
                        <Skeleton height={10} width="85%" />
                        <Skeleton height={10} width="50%" mt={8} />
                      </div>
                    </Group>
                  ))}
                </Stack>
              </Card>
            </div>
          </div>
        </AppShellFrame>
      </BrowserFrame>
    </Gallery>
  );
}
