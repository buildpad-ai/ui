'use client';

import {
  ActionIcon,
  Alert,
  Anchor,
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  Center,
  Checkbox,
  Divider,
  Drawer,
  FileButton,
  Group,
  List,
  Loader,
  Modal,
  NumberInput,
  Pagination,
  Paper,
  PasswordInput,
  Pill,
  Popover,
  Progress,
  Radio,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Stepper,
  Switch,
  Table,
  TagsInput,
  Text,
  TextInput,
  Textarea,
  ThemeIcon,
  Title,
  Tooltip,
  VisuallyHidden,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconAdjustmentsHorizontal,
  IconAlertTriangle,
  IconArrowBackUp,
  IconCalendar,
  IconCheck,
  IconChevronRight,
  IconCircleCheck,
  IconEdit,
  IconExternalLink,
  IconFile,
  IconFileSpreadsheet,
  IconFileTypePdf,
  IconFileZip,
  IconFilterOff,
  IconFolder,
  IconFolderOpen,
  IconGripVertical,
  IconInfoCircle,
  IconKey,
  IconLayoutGrid,
  IconLink,
  IconList,
  IconMail,
  IconMovie,
  IconPhoto,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconTrash,
  IconUpload,
  IconX,
  type Icon,
} from '@tabler/icons-react';
import { useCallback, useEffect, useRef, useState, type FormEvent, type MouseEvent, type ReactNode } from 'react';
import { Gallery } from '../Gallery';
import { BrowserFrame, Specimen, SpecimenGrid } from '../Layout';
import {
  CURRENT_USER,
  ORDERS,
  ORDER_STATUS,
  USERS,
  USER_STATUS,
  formatMoney,
  type MockUser,
  type OrderStatus,
} from '../data';
import styles from './forms.module.css';

const SUPPLIERS = Array.from(new Set(ORDERS.map((o) => o.supplier))).sort();
const CATEGORIES = Array.from(new Set(ORDERS.map((o) => o.category))).sort();
const APPROVERS = USERS.filter((u) => u.role === 'Approver' || u.role === 'Administrator').map((u) => ({
  value: u.id,
  label: `${u.name} · ${u.team}`,
}));
const COST_CENTRES = ['CC-100 Operations', 'CC-210 Fulfilment', 'CC-320 Facilities', 'CC-400 Finance'];
const CURRENCIES = ['USD', 'EUR', 'GBP', 'SGD'];
const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

/** A single pending timeout that is replaced on re-schedule and cleared on unmount. */
function useTimer() {
  const ref = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(ref.current), []);
  return useCallback((fn: () => void, ms: number) => {
    window.clearTimeout(ref.current);
    ref.current = window.setTimeout(fn, ms);
  }, []);
}

const noop = () => {};

/** Pins an overlay open in place: no portal, scroll lock, focus trap or transition. */
const STATIC_OVERLAY = {
  opened: true,
  onClose: noop,
  withinPortal: false,
  lockScroll: false,
  trapFocus: false,
  returnFocus: false,
  closeOnEscape: false,
  closeOnClickOutside: false,
  transitionProps: { duration: 0 },
} as const;

/** Mantine's built-in Modal/Drawer close button ships without an accessible name. */
const CLOSE_LABEL = { closeButtonProps: { 'aria-label': 'Close' } } as const;

const PAGINATION_LABELS = {
  first: 'First page',
  previous: 'Previous page',
  next: 'Next page',
  last: 'Last page',
} as const;
const paginationControlProps = (control: keyof typeof PAGINATION_LABELS) => ({
  'aria-label': PAGINATION_LABELS[control],
});

/* ── Create-record form ─────────────────────────────────────── */

interface OrderDraft {
  supplier: string | null;
  category: string | null;
  reference: string;
  title: string;
  amount: string | number;
  currency: string | null;
  delivery: string;
  costCentre: string | null;
  notes: string;
  approver: string | null;
  urgent: boolean;
  notifySupplier: boolean;
}

const EMPTY_DRAFT: OrderDraft = {
  supplier: null,
  category: null,
  reference: '',
  title: '',
  amount: '',
  currency: 'USD',
  delivery: '',
  costCentre: null,
  notes: '',
  approver: null,
  urgent: false,
  notifySupplier: true,
};

function validateDraft(d: OrderDraft): Partial<Record<keyof OrderDraft, string>> {
  const errors: Partial<Record<keyof OrderDraft, string>> = {};
  if (!d.supplier) errors.supplier = 'Choose a supplier';
  if (!d.category) errors.category = 'Choose a category';
  if (!d.title.trim()) errors.title = 'Give the order a short title';
  if (d.amount === '' || Number(d.amount) <= 0) errors.amount = 'Enter an amount greater than $0';
  if (!d.delivery.trim()) errors.delivery = 'Enter a delivery date';
  if (!d.approver) errors.approver = 'Choose who approves this order';
  return errors;
}

function FormSection({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className={styles.formSection}>
      <div>
        <Title order={5}>{title}</Title>
        <Text size="sm" c="dimmed" mt={4}>
          {description}
        </Text>
      </div>
      <div className={styles.fieldGrid}>{children}</div>
    </div>
  );
}

/** A create-record form: sectioned two-column grid, validation on submit and a sticky footer. */
export function CreateRecordForm() {
  const [draft, setDraft] = useState<OrderDraft>(EMPTY_DRAFT);
  const [submitted, setSubmitted] = useState(false);
  const [created, setCreated] = useState(false);
  const [savedDraft, setSavedDraft] = useState(false);
  const errors = submitted ? validateDraft(draft) : {};
  const errorCount = Object.keys(errors).length;

  const set = <K extends keyof OrderDraft>(key: K, value: OrderDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setSavedDraft(false);
  };

  const reset = () => {
    setDraft(EMPTY_DRAFT);
    setSubmitted(false);
    setCreated(false);
    setSavedDraft(false);
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (Object.keys(validateDraft(draft)).length === 0) setCreated(true);
  };

  const approverName = USERS.find((u) => u.id === draft.approver)?.name;

  return (
    <Gallery>
      <SpecimenGrid cols={1}>
        <Specimen
          label="Create record"
          span="full"
          surface="muted"
          note={
            <>
              <code>Card padding=0</code> with section rows (title + description left, two-column field grid right).
              Required fields use <code>withAsterisk</code>; errors appear after <strong>Create order</strong> via the{' '}
              <code>error</code> prop. The footer is <code>position: sticky</code> inside the scrolling card. The date
              field is a <code>TextInput</code> with a calendar icon here; the datetime interface renders a picker.
            </>
          }
        >
          <Card padding={0} className={styles.card}>
            <form onSubmit={onSubmit} noValidate className={styles.scroll}>
              <div className={styles.formHeader}>
                <Group justify="space-between" align="flex-start">
                  <div>
                    <Text size="xs" c="dimmed" fw={500}>
                      Purchase orders / New
                    </Text>
                    <Title order={3}>New purchase order</Title>
                    <Text size="sm" c="dimmed" mt={4}>
                      Orders over $10,000 need approval before they are sent to the supplier.
                    </Text>
                  </div>
                  <Badge color="gray">Draft</Badge>
                </Group>
                {submitted && errorCount > 0 && (
                  <Alert mt="md" color="red" icon={<IconAlertTriangle size={18} />} title={`Fix ${errorCount} fields to create this order`}>
                    Required fields are highlighted below.
                  </Alert>
                )}
                {created && (
                  <Alert
                    mt="md"
                    color="green"
                    icon={<IconCircleCheck size={18} />}
                    title="PO-2042 created"
                    withCloseButton
                    closeButtonLabel="Dismiss"
                    onClose={reset}
                  >
                    Sent to {approverName ?? 'the approver'} for approval.
                  </Alert>
                )}
              </div>
              <Divider />
              <FormSection title="Supplier" description="Who you are buying from and what the order is for.">
                <Select
                  label="Supplier"
                  placeholder="Search suppliers"
                  withAsterisk
                  searchable
                  data={SUPPLIERS}
                  value={draft.supplier}
                  onChange={(v) => set('supplier', v)}
                  error={errors.supplier}
                />
                <Select
                  label="Category"
                  placeholder="Pick one"
                  withAsterisk
                  data={CATEGORIES}
                  value={draft.category}
                  onChange={(v) => set('category', v)}
                  error={errors.category}
                />
                <TextInput
                  className={styles.full}
                  label="Order title"
                  placeholder="e.g. Q4 shipping cartons"
                  withAsterisk
                  value={draft.title}
                  onChange={(e) => set('title', e.currentTarget.value)}
                  error={errors.title}
                />
                <TextInput
                  label="Supplier reference"
                  description="Their quote or invoice number"
                  placeholder="QT-88120"
                  value={draft.reference}
                  onChange={(e) => set('reference', e.currentTarget.value)}
                />
              </FormSection>
              <Divider />
              <FormSection title="Amount & delivery" description="What it costs, when it arrives and who pays for it.">
                <NumberInput
                  label="Amount"
                  placeholder="0"
                  withAsterisk
                  prefix="$"
                  thousandSeparator=","
                  min={0}
                  hideControls
                  value={draft.amount}
                  onChange={(v) => set('amount', v)}
                  error={errors.amount}
                />
                <Select
                  label="Currency"
                  data={CURRENCIES}
                  allowDeselect={false}
                  value={draft.currency}
                  onChange={(v) => set('currency', v)}
                />
                <TextInput
                  label="Delivery date"
                  placeholder="DD MMM YYYY"
                  withAsterisk
                  leftSection={<IconCalendar size={16} />}
                  value={draft.delivery}
                  onChange={(e) => set('delivery', e.currentTarget.value)}
                  error={errors.delivery}
                />
                <Select
                  label="Cost centre"
                  placeholder="Optional"
                  clearable
                  data={COST_CENTRES}
                  value={draft.costCentre}
                  onChange={(v) => set('costCentre', v)}
                />
                <Textarea
                  className={styles.full}
                  label="Notes for the approver"
                  placeholder="Anything the approver should know"
                  autosize
                  minRows={3}
                  value={draft.notes}
                  onChange={(e) => set('notes', e.currentTarget.value)}
                />
              </FormSection>
              <Divider />
              <FormSection title="Approval" description="Routing and notifications once the order is created.">
                <Select
                  className={styles.full}
                  label="Approver"
                  placeholder="Choose an approver"
                  withAsterisk
                  data={APPROVERS}
                  value={draft.approver}
                  onChange={(v) => set('approver', v)}
                  error={errors.approver}
                />
                <Checkbox
                  label="Mark as urgent"
                  description="Approver is notified immediately"
                  checked={draft.urgent}
                  onChange={(e) => set('urgent', e.currentTarget.checked)}
                />
                <Switch
                  label="Email the supplier"
                  description="Once the order is approved"
                  checked={draft.notifySupplier}
                  onChange={(e) => set('notifySupplier', e.currentTarget.checked)}
                />
              </FormSection>
              <div className={styles.stickyFooter}>
                <Text size="sm" c="dimmed">
                  {savedDraft ? 'Draft saved · just now' : 'Fields marked * are required'}
                </Text>
                <Group gap="sm">
                  <Button variant="subtle" color="gray" onClick={reset}>
                    Cancel
                  </Button>
                  <Button variant="default" onClick={() => setSavedDraft(true)}>
                    Save draft
                  </Button>
                  <Button type="submit">Create order</Button>
                </Group>
              </div>
            </form>
          </Card>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

/* ── Settings form ──────────────────────────────────────────── */

interface WorkspaceSettings {
  name: string;
  slug: string;
  currency: string | null;
  threshold: string | number;
  timezone: string | null;
  digest: boolean;
  twoFactor: boolean;
}

const INITIAL_SETTINGS: WorkspaceSettings = {
  name: 'Northwind Ops',
  slug: 'northwind',
  currency: 'USD',
  threshold: 10000,
  timezone: 'Asia/Singapore',
  digest: true,
  twoFactor: false,
};

function SettingsRow({
  label,
  description,
  inline,
  children,
}: {
  label: string;
  description: string;
  inline?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={styles.settingsRow}>
      <div>
        <Text size="sm" fw={600}>
          {label}
        </Text>
        <Text size="sm" c="dimmed" mt={2}>
          {description}
        </Text>
      </div>
      <div className={styles.settingsControl} data-inline={inline || undefined}>
        {children}
      </div>
    </div>
  );
}

/** Settings-style form: label and description left, control right, rows split by dividers. */
export function SettingsForm() {
  const [values, setValues] = useState<WorkspaceSettings>(INITIAL_SETTINGS);
  const [saved, setSaved] = useState(INITIAL_SETTINGS);
  const [saving, setSaving] = useState(false);
  const schedule = useTimer();
  const dirty = JSON.stringify(values) !== JSON.stringify(saved);
  const set = <K extends keyof WorkspaceSettings>(key: K, value: WorkspaceSettings[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  const save = () => {
    setSaving(true);
    schedule(() => {
      setSaved(values);
      setSaving(false);
    }, 700);
  };

  return (
    <Gallery>
      <SpecimenGrid cols={1}>
        <Specimen
          label="Settings rows"
          span="full"
          surface="muted"
          note={
            <>
              Two-column rows (<code>Text fw=600</code> + dimmed description, control right) separated by{' '}
              <code>Divider</code>. Edit anything to arm the footer; the disabled row shows a plan-gated control.
            </>
          }
        >
          <Card padding={0} className={styles.card}>
            <div className={styles.formHeader}>
              <Title order={4}>Workspace</Title>
              <Text size="sm" c="dimmed" mt={4}>
                Applies to everyone in {INITIAL_SETTINGS.name}.
              </Text>
            </div>
            <Divider />
            <SettingsRow label="Workspace name" description="Shown in the sidebar, emails and exports.">
              <TextInput aria-label="Workspace name" value={values.name} onChange={(e) => set('name', e.currentTarget.value)} />
            </SettingsRow>
            <Divider />
            <SettingsRow label="Workspace URL" description="Changing it breaks existing bookmarks.">
              <TextInput
                aria-label="Workspace URL"
                value={values.slug}
                onChange={(e) => set('slug', e.currentTarget.value)}
                rightSection={
                  <Text size="sm" c="dimmed">
                    .buildpad.app
                  </Text>
                }
                rightSectionWidth={104}
                error={/^[a-z0-9-]+$/.test(values.slug) ? undefined : 'Use lowercase letters, numbers and dashes'}
              />
            </SettingsRow>
            <Divider />
            <SettingsRow label="Default currency" description="Used for new orders and reports.">
              <Select
                aria-label="Default currency"
                data={CURRENCIES}
                allowDeselect={false}
                value={values.currency}
                onChange={(v) => set('currency', v)}
              />
            </SettingsRow>
            <Divider />
            <SettingsRow label="Approval threshold" description="Orders above this amount need an approver.">
              <NumberInput
                aria-label="Approval threshold"
                prefix="$"
                thousandSeparator=","
                min={0}
                step={500}
                value={values.threshold}
                onChange={(v) => set('threshold', v)}
              />
            </SettingsRow>
            <Divider />
            <SettingsRow label="Time zone" description="Due dates and cron jobs run in this zone.">
              <Select
                aria-label="Time zone"
                searchable
                data={['Europe/London', 'Europe/Berlin', 'America/New_York', 'America/Los_Angeles', 'Asia/Singapore', 'Asia/Tokyo']}
                allowDeselect={false}
                value={values.timezone}
                onChange={(v) => set('timezone', v)}
              />
            </SettingsRow>
            <Divider />
            <SettingsRow label="Weekly digest" description="A Monday summary of spend and open approvals." inline>
              <Switch aria-label="Weekly digest" checked={values.digest} onChange={(e) => set('digest', e.currentTarget.checked)} />
            </SettingsRow>
            <Divider />
            <SettingsRow label="Require two-factor" description="Members must set up 2FA at their next sign-in." inline>
              <Switch
                aria-label="Require two-factor"
                checked={values.twoFactor}
                onChange={(e) => set('twoFactor', e.currentTarget.checked)}
              />
            </SettingsRow>
            <Divider />
            <SettingsRow label="Single sign-on" description="Sign in with your identity provider." inline>
              <Group gap="sm" wrap="nowrap">
                <Badge color="orange">Business plan</Badge>
                <Switch aria-label="Single sign-on" disabled />
              </Group>
            </SettingsRow>
            <div className={styles.stickyFooter}>
              <Text size="sm" c="dimmed">
                {dirty ? 'You have unsaved changes' : 'All changes saved'}
              </Text>
              <Group gap="sm">
                <Button variant="default" disabled={!dirty || saving} onClick={() => setValues(saved)}>
                  Discard
                </Button>
                <Button disabled={!dirty} loading={saving} onClick={save}>
                  Save changes
                </Button>
              </Group>
            </div>
          </Card>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

/* ── Filter bar ─────────────────────────────────────────────── */

interface MoreFilters {
  categories: string[];
  minAmount: string | number;
  overdueOnly: boolean;
}

const NO_MORE_FILTERS: MoreFilters = { categories: [], minAmount: '', overdueOnly: false };

function MoreFiltersPanel({
  value,
  onChange,
  onDone,
}: {
  value: MoreFilters;
  onChange: (value: MoreFilters) => void;
  onDone?: () => void;
}) {
  return (
    <Stack gap="md" w={280}>
      <Group justify="space-between">
        <Text size="sm" fw={600}>
          More filters
        </Text>
        <Anchor component="button" type="button" size="sm" onClick={() => onChange(NO_MORE_FILTERS)}>
          Reset
        </Anchor>
      </Group>
      <Checkbox.Group label="Category" value={value.categories} onChange={(categories) => onChange({ ...value, categories })}>
        <Stack gap={8} mt={6}>
          {CATEGORIES.map((c) => (
            <Checkbox key={c} value={c} label={c} size="xs" />
          ))}
        </Stack>
      </Checkbox.Group>
      <NumberInput
        label="Minimum amount"
        placeholder="Any"
        prefix="$"
        thousandSeparator=","
        min={0}
        step={1000}
        size="xs"
        value={value.minAmount}
        onChange={(minAmount) => onChange({ ...value, minAmount })}
      />
      <Switch
        label="Overdue only"
        size="xs"
        checked={value.overdueOnly}
        onChange={(e) => onChange({ ...value, overdueOnly: e.currentTarget.checked })}
      />
      {onDone && (
        <Button size="xs" onClick={onDone}>
          Show results
        </Button>
      )}
    </Stack>
  );
}

function countMore(f: MoreFilters) {
  return f.categories.length + (f.minAmount !== '' ? 1 : 0) + (f.overdueOnly ? 1 : 0);
}

/** An inline filter bar: search, Select filters, a "More filters" popover, active chips and clear. */
export function FilterBar() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [owner, setOwner] = useState<string | null>('u2');
  const [more, setMore] = useState<MoreFilters>({ ...NO_MORE_FILTERS, categories: ['Packaging'] });
  const [moreOpen, setMoreOpen] = useState(false);
  const [previewMore, setPreviewMore] = useState<MoreFilters>({
    categories: ['Freight', 'Packaging'],
    minAmount: 5000,
    overdueOnly: false,
  });

  const moreCount = countMore(more);
  const ownerName = USERS.find((u) => u.id === owner)?.name;

  const results = ORDERS.filter((o) => {
    const q = search.trim().toLowerCase();
    if (q && !`${o.number} ${o.supplier}`.toLowerCase().includes(q)) return false;
    if (status && o.status !== status) return false;
    if (owner && o.owner.id !== owner) return false;
    if (more.categories.length && !more.categories.includes(o.category)) return false;
    if (more.minAmount !== '' && o.amount < Number(more.minAmount)) return false;
    if (more.overdueOnly && o.status !== 'pending') return false;
    return true;
  });

  const chips: Array<{ key: string; label: string; clear: () => void }> = [];
  if (search.trim()) chips.push({ key: 'q', label: `“${search.trim()}”`, clear: () => setSearch('') });
  if (status) chips.push({ key: 's', label: `Status: ${ORDER_STATUS[status as OrderStatus].label}`, clear: () => setStatus(null) });
  if (owner) chips.push({ key: 'o', label: `Owner: ${ownerName}`, clear: () => setOwner(null) });
  more.categories.forEach((c) =>
    chips.push({ key: `c-${c}`, label: `Category: ${c}`, clear: () => setMore((m) => ({ ...m, categories: m.categories.filter((x) => x !== c) })) }),
  );
  if (more.minAmount !== '')
    chips.push({ key: 'min', label: `Over ${formatMoney(Number(more.minAmount))}`, clear: () => setMore((m) => ({ ...m, minAmount: '' })) });
  if (more.overdueOnly) chips.push({ key: 'od', label: 'Overdue only', clear: () => setMore((m) => ({ ...m, overdueOnly: false })) });

  const clearAll = () => {
    setSearch('');
    setStatus(null);
    setOwner(null);
    setMore(NO_MORE_FILTERS);
  };

  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        <Specimen
          label="Filter bar"
          span="full"
          surface="muted"
          align="start"
          note={
            <>
              <code>TextInput</code> search, two clearable <code>Select</code>s, a <code>Popover</code> for less-used
              filters (count in a <code>Badge</code>), then active filters as removable <code>Pill</code>s with a
              Clear all. Filters really narrow the table.
            </>
          }
        >
          <Card className={styles.card}>
            <Stack gap="md">
              <div className={styles.filterBar}>
                <TextInput
                  className={styles.filterSearch}
                  aria-label="Search orders"
                  placeholder="Search by PO number or supplier"
                  leftSection={<IconSearch size={16} />}
                  value={search}
                  onChange={(e) => setSearch(e.currentTarget.value)}
                />
                <Select
                  className={styles.filterSelect}
                  aria-label="Status"
                  placeholder="Any status"
                  clearable
                  data={Object.entries(ORDER_STATUS).map(([value, s]) => ({ value, label: s.label }))}
                  value={status}
                  onChange={setStatus}
                />
                <Select
                  className={styles.filterSelect}
                  aria-label="Owner"
                  placeholder="Any owner"
                  clearable
                  data={USERS.map((u) => ({ value: u.id, label: u.name }))}
                  value={owner}
                  onChange={setOwner}
                />
                <Popover opened={moreOpen} onChange={setMoreOpen} position="bottom-end" shadow="lg">
                  <Popover.Target>
                    <Button
                      variant="default"
                      leftSection={<IconAdjustmentsHorizontal size={16} />}
                      rightSection={moreCount > 0 ? <Badge size="sm" circle color="orange">{moreCount}</Badge> : undefined}
                      onClick={() => setMoreOpen((o) => !o)}
                    >
                      More filters
                    </Button>
                  </Popover.Target>
                  <Popover.Dropdown>
                    <MoreFiltersPanel value={more} onChange={setMore} onDone={() => setMoreOpen(false)} />
                  </Popover.Dropdown>
                </Popover>
              </div>
              {chips.length > 0 && (
                <Group gap="xs">
                  <Text size="xs" c="dimmed" fw={500}>
                    Filtered by
                  </Text>
                  <Pill.Group>
                    {chips.map((chip) => (
                      <Pill
                        key={chip.key}
                        withRemoveButton
                        onRemove={chip.clear}
                        removeButtonProps={{ 'aria-label': `Remove filter ${chip.label}` }}
                      >
                        {chip.label}
                      </Pill>
                    ))}
                  </Pill.Group>
                  <Button variant="subtle" color="gray" size="compact-sm" onClick={clearAll}>
                    Clear all
                  </Button>
                </Group>
              )}
              <Divider />
              <Text size="xs" c="dimmed">
                Showing {results.length} of {ORDERS.length} orders
              </Text>
              {results.length > 0 ? (
                <Table verticalSpacing="xs">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Order</Table.Th>
                      <Table.Th>Supplier</Table.Th>
                      <Table.Th>Category</Table.Th>
                      <Table.Th>Owner</Table.Th>
                      <Table.Th>Status</Table.Th>
                      <Table.Th ta="right">Amount</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {results.map((o) => (
                      <Table.Tr key={o.id}>
                        <Table.Td fw={500}>{o.number}</Table.Td>
                        <Table.Td>{o.supplier}</Table.Td>
                        <Table.Td>{o.category}</Table.Td>
                        <Table.Td>{o.owner.name}</Table.Td>
                        <Table.Td>
                          <Badge color={ORDER_STATUS[o.status].color}>{ORDER_STATUS[o.status].label}</Badge>
                        </Table.Td>
                        <Table.Td ta="right">{formatMoney(o.amount)}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              ) : (
                <NoResults onClear={clearAll} />
              )}
            </Stack>
          </Card>
        </Specimen>
        <Specimen
          label="More filters — open"
          align="start"
          note={
            <>
              <code>Popover opened withinPortal=false</code> — the dropdown surface (radius lg, shadow lg, hairline
              border) comes from the theme; <code>hideDetached=false</code> keeps it visible while the trigger scrolls.
              Controls inside drop to <code>size=&quot;xs&quot;</code>.
            </>
          }
        >
          <div className={styles.popoverStage}>
            <Popover
              opened
              withinPortal={false}
              hideDetached={false}
              middlewares={{ flip: false, shift: false }}
              position="bottom-start"
              shadow="lg"
            >
              <Popover.Target>
                <Button
                  variant="default"
                  leftSection={<IconAdjustmentsHorizontal size={16} />}
                  rightSection={<Badge size="sm" circle color="orange">{countMore(previewMore)}</Badge>}
                >
                  More filters
                </Button>
              </Popover.Target>
              <Popover.Dropdown>
                <MoreFiltersPanel value={previewMore} onChange={setPreviewMore} />
              </Popover.Dropdown>
            </Popover>
          </div>
        </Specimen>
        <Specimen
          label="No matching results"
          note={
            <>
              When filters exclude everything, keep the chips visible and offer one way out — a{' '}
              <code>variant=&quot;default&quot;</code> Clear filters button.
            </>
          }
        >
          <Stack gap="md">
            <Group gap="xs">
              <Pill.Group>
                <Pill withRemoveButton removeButtonProps={{ 'aria-label': 'Remove filter Status: Cancelled' }}>
                  Status: Cancelled
                </Pill>
                <Pill withRemoveButton removeButtonProps={{ 'aria-label': 'Remove filter Over $20,000' }}>
                  Over $20,000
                </Pill>
              </Pill.Group>
            </Group>
            <NoResults onClear={() => undefined} />
          </Stack>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

function NoResults({ onClear }: { onClear: () => void }) {
  return (
    <Stack align="center" gap="xs" py="xl">
      <ThemeIcon variant="light" color="gray" size={44} radius="xl">
        <IconFilterOff size={22} />
      </ThemeIcon>
      <Text fw={600}>No orders match these filters</Text>
      <Text size="sm" c="dimmed" ta="center">
        Try removing a filter or searching for something else.
      </Text>
      <Button variant="default" size="xs" mt={4} onClick={onClear}>
        Clear filters
      </Button>
    </Stack>
  );
}

/* ── Multi-step form ────────────────────────────────────────── */

/** A multi-step form: Stepper header, one group of fields per step, Back / Next footer. */
export function MultiStepForm() {
  const [active, setActive] = useState(0);
  const [supplier, setSupplier] = useState<string | null>('Keystone Logistics');
  const [contact, setContact] = useState('dispatch@keystone.example');
  const [lines, setLines] = useState([
    { item: 'Pallet freight — London to Leeds', qty: 12 as string | number, price: 340 as string | number },
    { item: 'Tail-lift delivery', qty: 2 as string | number, price: 95 as string | number },
  ]);
  const [address, setAddress] = useState('Unit 4, Harbour Park, Leeds LS10 1AB');
  const [date, setDate] = useState('');
  const [shipping, setShipping] = useState('standard');
  const [tried, setTried] = useState(false);

  const total = lines.reduce((sum, l) => sum + Number(l.qty || 0) * Number(l.price || 0), 0);
  const stepErrors: Array<Record<string, string>> = [
    {
      ...(supplier ? {} : { supplier: 'Choose a supplier' }),
      ...(isEmail(contact) ? {} : { contact: 'Enter a valid email' }),
    },
    lines.some((l) => !l.item.trim()) ? { lines: 'Every line needs a description' } : {},
    {
      ...(address.trim() ? {} : { address: 'Enter a delivery address' }),
      ...(date.trim() ? {} : { date: 'Enter a delivery date' }),
    },
    {},
  ];
  const errors = tried ? stepErrors[active] ?? {} : {};

  const next = () => {
    if (Object.keys(stepErrors[active]).length > 0) {
      setTried(true);
      return;
    }
    setTried(false);
    setActive((a) => Math.min(a + 1, 4));
  };
  const back = () => {
    setTried(false);
    setActive((a) => Math.max(a - 1, 0));
  };

  const updateLine = (index: number, patch: Partial<(typeof lines)[number]>) =>
    setLines((ls) => ls.map((l, i) => (i === index ? { ...l, ...patch } : l)));

  return (
    <Gallery>
      <SpecimenGrid cols={1}>
        <Specimen
          label="Multi-step form"
          span="full"
          surface="muted"
          note={
            <>
              <code>Stepper</code> with <code>allowNextStepsSelect=false</code>: completed steps turn ember and stay
              clickable. <strong>Next</strong> validates only the current step — the delivery step starts empty so you
              can see it block.
            </>
          }
        >
          <Card padding={0} className={styles.card}>
            <div className={styles.formHeader}>
              <Stepper active={active} onStepClick={setActive} allowNextStepsSelect={false} size="sm">
                <Stepper.Step label="Supplier" description="Who and contact" />
                <Stepper.Step label="Line items" description="What you're buying" />
                <Stepper.Step label="Delivery" description="Where and when" />
                <Stepper.Step label="Review" description="Check and submit" />
              </Stepper>
            </div>
            <Divider />
            <Box p="lg" mih={300}>
              {active === 0 && (
                <div className={styles.narrow}>
                  <Stack>
                    <Select
                      label="Supplier"
                      withAsterisk
                      searchable
                      data={SUPPLIERS}
                      value={supplier}
                      onChange={setSupplier}
                      error={errors.supplier}
                    />
                    <TextInput
                      label="Order contact"
                      description="Confirmations are sent here"
                      withAsterisk
                      leftSection={<IconMail size={16} />}
                      value={contact}
                      onChange={(e) => setContact(e.currentTarget.value)}
                      error={errors.contact}
                    />
                  </Stack>
                </div>
              )}
              {active === 1 && (
                <Stack gap="sm">
                  {errors.lines && (
                    <Alert color="red" icon={<IconAlertTriangle size={18} />}>
                      {errors.lines}
                    </Alert>
                  )}
                  {lines.map((line, i) => (
                    <Group key={i} gap="sm" align="flex-end" wrap="nowrap">
                      <TextInput
                        style={{ flex: 1 }}
                        label={i === 0 ? 'Description' : undefined}
                        aria-label={`Line ${i + 1} description`}
                        value={line.item}
                        onChange={(e) => updateLine(i, { item: e.currentTarget.value })}
                        error={tried && !line.item.trim()}
                      />
                      <NumberInput
                        w={90}
                        label={i === 0 ? 'Qty' : undefined}
                        aria-label={`Line ${i + 1} quantity`}
                        min={1}
                        value={line.qty}
                        onChange={(qty) => updateLine(i, { qty })}
                      />
                      <NumberInput
                        w={130}
                        label={i === 0 ? 'Unit price' : undefined}
                        aria-label={`Line ${i + 1} unit price`}
                        prefix="$"
                        thousandSeparator=","
                        min={0}
                        hideControls
                        value={line.price}
                        onChange={(price) => updateLine(i, { price })}
                      />
                      <Text w={100} ta="right" fw={500} pb={8}>
                        {formatMoney(Number(line.qty || 0) * Number(line.price || 0))}
                      </Text>
                    </Group>
                  ))}
                  <Group justify="space-between" mt="xs">
                    <Button
                      variant="subtle"
                      size="xs"
                      leftSection={<IconPlus size={14} />}
                      onClick={() => setLines((ls) => [...ls, { item: '', qty: 1, price: 0 }])}
                    >
                      Add line
                    </Button>
                    <Group gap="xs">
                      <Text size="sm" c="dimmed">
                        Total
                      </Text>
                      <Text fw={700}>{formatMoney(total)}</Text>
                    </Group>
                  </Group>
                </Stack>
              )}
              {active === 2 && (
                <div className={styles.narrow}>
                  <Stack>
                    <Textarea
                      label="Delivery address"
                      withAsterisk
                      autosize
                      minRows={2}
                      value={address}
                      onChange={(e) => setAddress(e.currentTarget.value)}
                      error={errors.address}
                    />
                    <TextInput
                      label="Delivery date"
                      withAsterisk
                      placeholder="DD MMM YYYY"
                      leftSection={<IconCalendar size={16} />}
                      value={date}
                      onChange={(e) => setDate(e.currentTarget.value)}
                      error={errors.date}
                    />
                    <Radio.Group label="Shipping" value={shipping} onChange={setShipping}>
                      <Group mt={6}>
                        <Radio value="standard" label="Standard · 3–5 days" />
                        <Radio value="express" label="Express · next day" />
                      </Group>
                    </Radio.Group>
                  </Stack>
                </div>
              )}
              {active === 3 && (
                <div className={styles.narrow}>
                  <Stack gap="sm">
                    {[
                      ['Supplier', supplier ?? '—'],
                      ['Contact', contact],
                      ['Line items', `${lines.length} lines · ${formatMoney(total)}`],
                      ['Deliver to', address],
                      ['Delivery', `${date || '—'} · ${shipping === 'express' ? 'Express' : 'Standard'}`],
                    ].map(([k, v]) => (
                      <Group key={k} justify="space-between" wrap="nowrap" align="flex-start">
                        <Text size="sm" c="dimmed">
                          {k}
                        </Text>
                        <Text size="sm" fw={500} ta="right">
                          {v}
                        </Text>
                      </Group>
                    ))}
                    <Alert color="blue" icon={<IconInfoCircle size={18} />} mt="xs">
                      Over $10,000 — this order will go to Priya Raman for approval.
                    </Alert>
                  </Stack>
                </div>
              )}
              {active === 4 && (
                <Stack align="center" gap="xs" py="lg">
                  <ThemeIcon color="green" size={48} radius="xl">
                    <IconCheck size={26} />
                  </ThemeIcon>
                  <Title order={4}>Submitted for approval</Title>
                  <Text size="sm" c="dimmed">
                    PO-2042 · {supplier} · {formatMoney(total)}
                  </Text>
                  <Button variant="default" size="xs" mt="xs" onClick={() => setActive(0)}>
                    Start another
                  </Button>
                </Stack>
              )}
            </Box>
            {active < 4 && (
              <div className={styles.stickyFooter}>
                <Text size="sm" c="dimmed">
                  Step {active + 1} of 4
                </Text>
                <Group gap="sm">
                  <Button variant="default" onClick={back} disabled={active === 0}>
                    Back
                  </Button>
                  <Button onClick={next}>{active === 3 ? 'Submit for approval' : 'Next'}</Button>
                </Group>
              </div>
            )}
          </Card>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

/* ── Sign in / sign up ──────────────────────────────────────── */

function passwordChecks(pw: string) {
  return [
    { label: 'At least 8 characters', ok: pw.length >= 8 },
    { label: 'A number', ok: /\d/.test(pw) },
    { label: 'An uppercase letter', ok: /[A-Z]/.test(pw) },
    { label: 'A symbol', ok: /[^A-Za-z0-9]/.test(pw) },
  ];
}

/** Compact sign-in and sign-up forms, with loading, error and password-strength states. */
export function AuthForms() {
  const [email, setEmail] = useState(CURRENT_USER.email);
  const [password, setPassword] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  const [signInResult, setSignInResult] = useState<'error' | 'ok' | null>(null);
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const schedule = useTimer();

  const [name, setName] = useState('Marco Silva');
  const [workEmail, setWorkEmail] = useState('marco.silva@');
  const [newPassword, setNewPassword] = useState('Northwind');
  const [terms, setTerms] = useState(false);
  const [signUpTried, setSignUpTried] = useState(false);

  const checks = passwordChecks(newPassword);
  const score = checks.filter((c) => c.ok).length;
  const strengthColor = score <= 1 ? 'red' : score <= 3 ? 'yellow' : 'green';

  const signIn = (event: FormEvent) => {
    event.preventDefault();
    setSignInResult(null);
    if (!password) {
      setPasswordError('Enter your password');
      return;
    }
    setPasswordError(undefined);
    setSigningIn(true);
    schedule(() => {
      setSigningIn(false);
      setSignInResult(password.length >= 8 ? 'ok' : 'error');
    }, 900);
  };

  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        <Specimen
          label="Sign in"
          surface="muted"
          note={
            <>
              Ink <code>Button fullWidth</code> with <code>loading</code> while submitting. Empty password shows a field
              error; fewer than 8 characters returns a form-level <code>Alert</code>.
            </>
          }
        >
          <Card className={styles.authCard} padding="xl">
            <form onSubmit={signIn} noValidate>
              <Stack gap="md">
                <div>
                  <Title order={3}>Sign in</Title>
                  <Text size="sm" c="dimmed" mt={4}>
                    Welcome back to Northwind Ops.
                  </Text>
                </div>
                {signInResult === 'error' && (
                  <Alert color="red" icon={<IconAlertTriangle size={18} />}>
                    That email and password don&apos;t match.
                  </Alert>
                )}
                {signInResult === 'ok' && (
                  <Alert color="green" icon={<IconCircleCheck size={18} />}>
                    Signed in — redirecting…
                  </Alert>
                )}
                <TextInput label="Email" type="email" value={email} onChange={(e) => setEmail(e.currentTarget.value)} />
                <PasswordInput
                  label="Password"
                  placeholder="Your password"
                  value={password}
                  onChange={(e) => setPassword(e.currentTarget.value)}
                  error={passwordError}
                />
                <Group justify="space-between">
                  <Checkbox label="Keep me signed in" size="xs" defaultChecked />
                  <Anchor href="#" size="sm" onClick={(e) => e.preventDefault()}>
                    Forgot password?
                  </Anchor>
                </Group>
                <Button type="submit" fullWidth loading={signingIn}>
                  Sign in
                </Button>
                <Divider label="or" labelPosition="center" />
                <Button variant="default" fullWidth leftSection={<IconKey size={16} />}>
                  Continue with SSO
                </Button>
              </Stack>
            </form>
          </Card>
        </Specimen>
        <Specimen
          label="Create account"
          surface="muted"
          note={
            <>
              <code>color=&quot;primary&quot;</code> — the ember brand CTA, reserved for moments like sign-up. Strength is
              a <code>Progress</code> whose colour follows the score; the button stays enabled and validates on click.
            </>
          }
        >
          <Card className={styles.authCard} padding="xl">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setSignUpTried(true);
              }}
              noValidate
            >
              <Stack gap="md">
                <div>
                  <Title order={3}>Create your account</Title>
                  <Text size="sm" c="dimmed" mt={4}>
                    You&apos;ve been invited to the Procurement team.
                  </Text>
                </div>
                <TextInput label="Full name" value={name} onChange={(e) => setName(e.currentTarget.value)} />
                <TextInput
                  label="Work email"
                  value={workEmail}
                  onChange={(e) => setWorkEmail(e.currentTarget.value)}
                  error={isEmail(workEmail) ? undefined : 'Enter a full email address, like name@northwind.io'}
                />
                <div>
                  <PasswordInput
                    label="Password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.currentTarget.value)}
                  />
                  <Progress value={score * 25} color={strengthColor} size="sm" mt="xs" aria-label="Password strength" />
                  <SimpleGrid cols={2} spacing={4} verticalSpacing={2} mt={8}>
                    {checks.map((c) => (
                      <Group key={c.label} gap={6} wrap="nowrap">
                        <Text c={c.ok ? 'green' : 'dimmed'} component="span" lh={0}>
                          {c.ok ? <IconCheck size={14} /> : <IconX size={14} />}
                        </Text>
                        <Text size="xs" c={c.ok ? undefined : 'dimmed'}>
                          {c.label}
                        </Text>
                      </Group>
                    ))}
                  </SimpleGrid>
                </div>
                <Checkbox
                  size="xs"
                  checked={terms}
                  onChange={(e) => setTerms(e.currentTarget.checked)}
                  error={signUpTried && !terms ? 'Accept the terms to continue' : undefined}
                  label={
                    <>
                      I agree to the{' '}
                      <Anchor href="#" size="xs" onClick={(e) => e.preventDefault()}>
                        terms of service
                      </Anchor>
                    </>
                  }
                />
                <Button type="submit" color="primary" fullWidth>
                  Create account
                </Button>
              </Stack>
            </form>
          </Card>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

/* ── Invite + destructive confirmation ──────────────────────── */

const ROLES = [
  { value: 'Viewer', label: 'Viewer', description: 'Can view orders and reports' },
  { value: 'Editor', label: 'Editor', description: 'Can create and edit orders' },
  { value: 'Approver', label: 'Approver', description: 'Can approve orders in their team' },
  { value: 'Administrator', label: 'Administrator', description: 'Full access, including billing' },
];

function InviteCard() {
  const [emails, setEmails] = useState<string[]>(['marco.silva@northwind.io', 'lena@northwind']);
  const [role, setRole] = useState<string | null>('Editor');
  const [sent, setSent] = useState<string[] | null>(null);
  const invalid = emails.filter((e) => !isEmail(e));
  const pending = USERS.filter((u) => u.status === 'invited');

  return (
    <Card className={styles.card}>
      <Stack gap="md">
        <div>
          <Title order={4}>Invite people</Title>
          <Text size="sm" c="dimmed" mt={4}>
            They&apos;ll get an email with a link to join Northwind Ops.
          </Text>
        </div>
        {sent && (
          <Alert color="green" icon={<IconCircleCheck size={18} />} withCloseButton closeButtonLabel="Dismiss" onClose={() => setSent(null)}>
            Invites sent to {sent.join(', ')}.
          </Alert>
        )}
        <TagsInput
          label="Email addresses"
          description="Press Enter or comma after each address"
          placeholder={emails.length ? '' : 'name@northwind.io'}
          splitChars={[',', ' ', ';']}
          clearable
          value={emails}
          onChange={setEmails}
          error={invalid.length ? `${invalid.join(', ')} is not a valid email address` : undefined}
        />
        <Select
          label="Role"
          data={ROLES}
          allowDeselect={false}
          value={role}
          onChange={setRole}
          renderOption={({ option }) => {
            const r = ROLES.find((x) => x.value === option.value);
            return (
              <div>
                <Text size="sm" fw={500}>
                  {option.label}
                </Text>
                <Text size="xs" c="dimmed">
                  {r?.description}
                </Text>
              </div>
            );
          }}
        />
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={() => setEmails([])}>
            Cancel
          </Button>
          <Button
            disabled={emails.length === 0 || invalid.length > 0}
            onClick={() => {
              setSent(emails);
              setEmails([]);
            }}
          >
            {emails.length > 1 ? `Send ${emails.length} invites` : 'Send invite'}
          </Button>
        </Group>
        <Divider label="Pending" labelPosition="left" />
        {pending.map((u) => (
          <Group key={u.id} justify="space-between" wrap="nowrap">
            <Group gap="sm" wrap="nowrap">
              <Avatar radius="xl" size="sm" color="primary">
                {u.initials}
              </Avatar>
              <div>
                <Text size="sm" fw={500}>
                  {u.email}
                </Text>
                <Text size="xs" c="dimmed">
                  {u.role} · invited 2 days ago
                </Text>
              </div>
            </Group>
            <Button variant="subtle" size="compact-sm">
              Resend
            </Button>
          </Group>
        ))}
      </Stack>
    </Card>
  );
}

const DELETE_TARGET = 'Atlas Packaging';

function DeleteConfirmFields({ onCancel, onDone }: { onCancel?: () => void; onDone: () => void }) {
  const [typed, setTyped] = useState('');
  const [deleting, setDeleting] = useState(false);
  const schedule = useTimer();
  const matches = typed.trim() === DELETE_TARGET;
  return (
    <Stack gap="md">
      <Alert color="red" icon={<IconAlertTriangle size={18} />}>
        This permanently deletes <strong>{DELETE_TARGET}</strong>, its 2 purchase orders and 14 attached files. It
        can&apos;t be undone.
      </Alert>
      <TextInput
        label={
          <>
            Type <strong>{DELETE_TARGET}</strong> to confirm
          </>
        }
        placeholder={DELETE_TARGET}
        autoComplete="off"
        value={typed}
        onChange={(e) => setTyped(e.currentTarget.value)}
      />
      <Group justify="flex-end" gap="sm">
        {onCancel && (
          <Button variant="default" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button
          color="red"
          leftSection={<IconTrash size={16} />}
          disabled={!matches}
          loading={deleting}
          onClick={() => {
            setDeleting(true);
            schedule(() => {
              setDeleting(false);
              setTyped('');
              onDone();
            }, 800);
          }}
        >
          Delete supplier
        </Button>
      </Group>
    </Stack>
  );
}

function DeleteCard() {
  const [opened, { open, close }] = useDisclosure(false);
  const [deleted, setDeleted] = useState(false);
  return (
    <Card className={styles.card}>
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <div>
            <Title order={4}>Delete supplier</Title>
            <Text size="sm" c="dimmed" mt={4}>
              Removes the supplier and everything attached to it.
            </Text>
          </div>
          <Button variant="light" color="red" size="xs" onClick={open} style={{ flexShrink: 0 }}>
            Open as modal
          </Button>
        </Group>
        {deleted ? (
          <Alert color="gray" icon={<IconCheck size={18} />} withCloseButton closeButtonLabel="Dismiss" onClose={() => setDeleted(false)}>
            {DELETE_TARGET} was deleted.
          </Alert>
        ) : (
          <DeleteConfirmFields onDone={() => setDeleted(true)} />
        )}
      </Stack>
      <Modal {...CLOSE_LABEL} opened={opened} onClose={close} title={`Delete ${DELETE_TARGET}?`} centered>
        <DeleteConfirmFields
          onCancel={close}
          onDone={() => {
            close();
            setDeleted(true);
          }}
        />
      </Modal>
    </Card>
  );
}

/** An "invite people" form and a type-to-confirm destructive form, side by side. */
export function InviteAndConfirmForms() {
  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        <Specimen
          label="Invite people"
          surface="muted"
          align="start"
          note={
            <>
              <code>TagsInput</code> splits on comma, space or semicolon and errors on invalid addresses; the role{' '}
              <code>Select</code> uses <code>renderOption</code> for descriptions. Send stays disabled while anything is
              invalid.
            </>
          }
        >
          <InviteCard />
        </Specimen>
        <Specimen
          label="Type to confirm"
          surface="muted"
          align="start"
          note={
            <>
              Danger <code>Alert</code> + a confirmation <code>TextInput</code>; the <code>color=&quot;red&quot;</code>{' '}
              button unlocks only on an exact match. The same fields work inside a <code>Modal</code>.
            </>
          }
        >
          <DeleteCard />
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

/* ── Validation states ──────────────────────────────────────── */

/** A validation summary Alert linking to errored fields, plus a reference of field states. */
export function ValidationStates() {
  const focus = (id: string) => (event: MouseEvent) => {
    event.preventDefault();
    document.getElementById(id)?.focus();
  };
  const problems = [
    { id: 'val-reference', label: 'Supplier reference is already used by PO-2031' },
    { id: 'val-amount', label: 'Amount must be greater than $0' },
    { id: 'val-approver', label: 'Choose an approver' },
  ];

  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        <Specimen
          label="Error summary"
          surface="muted"
          align="start"
          note={
            <>
              A <code>color=&quot;red&quot;</code> Alert at the top of the form lists every problem as an anchor that
              focuses its field; each field repeats its own message via <code>error</code>. Warnings that don&apos;t
              block saving use <code>color=&quot;yellow&quot;</code>.
            </>
          }
        >
          <Card className={styles.card}>
            <Stack gap="md">
              <Alert color="red" icon={<IconAlertTriangle size={18} />} title={`${problems.length} fields need attention`}>
                <List size="sm" spacing={2}>
                  {problems.map((p) => (
                    <List.Item key={p.id}>
                      <Anchor href={`#${p.id}`} size="sm" onClick={focus(p.id)}>
                        {p.label}
                      </Anchor>
                    </List.Item>
                  ))}
                </List>
              </Alert>
              <TextInput id="val-reference" label="Supplier reference" defaultValue="QT-88120" error={problems[0].label} />
              <NumberInput id="val-amount" label="Amount" prefix="$" defaultValue={0} hideControls withAsterisk error={problems[1].label} />
              <Select id="val-approver" label="Approver" placeholder="Choose an approver" data={APPROVERS} withAsterisk error={problems[2].label} />
              <Alert color="yellow" icon={<IconInfoCircle size={18} />}>
                Delivery date falls on a public holiday — you can still save.
              </Alert>
            </Stack>
          </Card>
        </Specimen>
        <Specimen
          label="Field states"
          align="start"
          note={
            <>
              Default, with <code>description</code>, focus (click any field — ember border + <code>--ds-focus-ring</code>),{' '}
              <code>error</code>, async check via a <code>Loader</code> in <code>rightSection</code>,{' '}
              <code>readOnly</code> and <code>disabled</code>.
            </>
          }
        >
          <Stack gap="md">
            <TextInput label="Default" placeholder="Placeholder text" />
            <TextInput label="With description" description="Shown under the label" defaultValue="Atlas Packaging" />
            <TextInput label="Error" defaultValue="atlas packaging" error="Supplier names are case-sensitive" />
            <TextInput
              label="Checking"
              defaultValue="PO-2042"
              rightSection={<Loader size={14} />}
              description="Checking the number is free…"
            />
            <TextInput
              label="Valid"
              defaultValue="PO-2043"
              rightSection={
                <Text c="green" component="span" lh={0}>
                  <IconCheck size={16} />
                </Text>
              }
              description="Available"
            />
            <TextInput label="Read-only" defaultValue="Created by Amelia Hart" readOnly />
            <TextInput label="Disabled" defaultValue="Locked after approval" disabled />
          </Stack>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

/* ── Relational fields ──────────────────────────────────────── */

interface SupplierRecord {
  id: string;
  name: string;
  category: string;
  orders: number;
}

const SUPPLIER_RECORDS: SupplierRecord[] = SUPPLIERS.map((name, i) => {
  const orders = ORDERS.filter((o) => o.supplier === name);
  return { id: `sup-${i + 1}`, name, category: orders[0]?.category ?? '—', orders: orders.length };
});
const supplierByName = (name: string) => SUPPLIER_RECORDS.find((s) => s.name === name)?.id ?? null;

type StagedState = 'created' | 'removed';

interface RelatedRow {
  id: string;
  primary: string;
  secondary?: string;
  leading?: ReactNode;
  collection?: string;
  badge?: { label: string; color: string };
  state?: StagedState;
}

interface CatalogItem {
  id: string;
  sku: string;
  name: string;
  unit: number;
  stock: 'In stock' | 'Backordered';
}

const STOCK_COLOR: Record<CatalogItem['stock'], string> = { 'In stock': 'green', Backordered: 'yellow' };

const CATALOG: CatalogItem[] = [
  { id: 'cat-1', sku: 'PK-0112', name: 'Corner edge protectors', unit: 0.85, stock: 'In stock' },
  { id: 'cat-2', sku: 'PK-0140', name: 'Fragile warning labels', unit: 0.12, stock: 'In stock' },
  { id: 'cat-3', sku: 'PK-0207', name: 'Bubble wrap, 50 m roll', unit: 38, stock: 'Backordered' },
  { id: 'cat-4', sku: 'PK-0231', name: 'Mailer boxes, small', unit: 1.9, stock: 'In stock' },
  { id: 'cat-5', sku: 'PK-0288', name: 'Pallet top sheets', unit: 4.25, stock: 'In stock' },
  { id: 'cat-6', sku: 'PK-0302', name: 'Strapping kit, steel', unit: 126, stock: 'Backordered' },
];

const lineRow = (id: string, name: string, qty: number, unit: number, stock: CatalogItem['stock'], state?: StagedState): RelatedRow => ({
  id,
  primary: name,
  secondary: `${qty.toLocaleString('en-US')} × $${unit.toFixed(2)} · ${formatMoney(qty * unit)}`,
  badge: { label: stock, color: STOCK_COLOR[stock] },
  state,
});

const LINE_ITEMS: RelatedRow[] = [
  lineRow('li-1', 'Double-wall cartons 600×400', 1200, 5.4, 'In stock'),
  lineRow('li-2', 'Kraft paper void fill', 40, 59, 'In stock'),
  lineRow('li-3', 'Custom printed tape', 160, 15.5, 'Backordered'),
  lineRow('li-4', 'Pallet stretch wrap', 32, 47.5, 'In stock'),
];

const userRow = (u: MockUser, state?: StagedState): RelatedRow => ({
  id: u.id,
  primary: u.name,
  secondary: `${u.role} · ${u.team}`,
  leading: (
    <Avatar size={28} radius="xl" color="primary">
      {u.initials}
    </Avatar>
  ),
  badge: USER_STATUS[u.status],
  state,
});

const INITIAL_APPROVERS = [USERS[2], USERS[0]].map((u) => userRow(u));

const M2A_ROWS: RelatedRow[] = [
  {
    id: 'm2a-1',
    collection: 'Orders',
    primary: `${ORDERS[0].number} · ${ORDERS[0].supplier}`,
    secondary: formatMoney(ORDERS[0].amount),
    badge: ORDER_STATUS[ORDERS[0].status],
  },
  { id: 'm2a-2', collection: 'Users', primary: USERS[1].name, secondary: `${USERS[1].role} · ${USERS[1].team}` },
  { id: 'm2a-3', collection: 'Files', primary: 'atlas-packaging-quote.pdf', secondary: '312 KB · PDF' },
];

function RelationLabel({ label, description, required }: { label: string; description?: string; required?: boolean }) {
  return (
    <div>
      <Text size="sm" fw={500}>
        {label}
        {required && (
          <Text span c="red">
            {' '}
            *
          </Text>
        )}
      </Text>
      {description && (
        <Text size="xs" c="dimmed" mt={2}>
          {description}
        </Text>
      )}
    </div>
  );
}

function SupplierPicker({
  value,
  onSelect,
  onClear,
  onCancel,
}: {
  value: string | null;
  onSelect: (id: string) => void;
  onClear: () => void;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const rows = SUPPLIER_RECORDS.filter((s) => `${s.name} ${s.category}`.toLowerCase().includes(q));
  return (
    <Stack gap="md">
      <TextInput
        aria-label="Search suppliers"
        placeholder="Search…"
        leftSection={<IconSearch size={16} />}
        value={query}
        onChange={(e) => setQuery(e.currentTarget.value)}
      />
      <Paper withBorder className={styles.tableWrap}>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Name</Table.Th>
              <Table.Th>Category</Table.Th>
              <Table.Th ta="right">Orders</Table.Th>
              <Table.Th w={110}>
                <VisuallyHidden>Actions</VisuallyHidden>
              </Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={4}>
                  <Text ta="center" c="dimmed" size="sm" py="md">
                    No items found
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              rows.map((s) => {
                const selected = s.id === value;
                return (
                  <Table.Tr key={s.id}>
                    <Table.Td fw={500}>{s.name}</Table.Td>
                    <Table.Td>{s.category}</Table.Td>
                    <Table.Td ta="right">{s.orders}</Table.Td>
                    <Table.Td ta="right">
                      <Button
                        size="xs"
                        variant={selected ? 'filled' : 'light'}
                        aria-label={`${selected ? 'Selected' : 'Select'} ${s.name}`}
                        onClick={() => onSelect(s.id)}
                      >
                        {selected ? 'Selected' : 'Select'}
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                );
              })
            )}
          </Table.Tbody>
        </Table>
      </Paper>
      <Group justify="space-between">
        {value ? (
          <Button variant="subtle" color="red" leftSection={<IconTrash size={14} />} onClick={onClear}>
            Clear selection
          </Button>
        ) : (
          <span />
        )}
        <Button variant="default" onClick={onCancel}>
          Cancel
        </Button>
      </Group>
    </Stack>
  );
}

function ManyToOneField({
  label,
  description,
  required,
  value,
  error,
  readOnly,
  onChange,
}: {
  label: string;
  description?: string;
  required?: boolean;
  value: string | null;
  error?: string;
  readOnly?: boolean;
  onChange?: (id: string | null) => void;
}) {
  const [pickerOpened, picker] = useDisclosure(false);
  const record = SUPPLIER_RECORDS.find((s) => s.id === value);
  const editable = !readOnly && !!onChange;
  return (
    <Stack gap="xs">
      <RelationLabel label={label} description={description} required={required} />
      <Paper p="md" withBorder>
        {record ? (
          <Group justify="space-between" wrap="nowrap" gap="sm">
            <Group gap="sm" wrap="nowrap" className={styles.grow}>
              <Text c="dimmed" span lh={0}>
                <IconLink size={16} />
              </Text>
              <div className={styles.grow}>
                <Text size="sm" fw={500} truncate>
                  {record.name}
                </Text>
                <Text size="xs" c="dimmed" truncate>
                  {record.category} · {record.orders} {record.orders === 1 ? 'order' : 'orders'}
                </Text>
              </div>
            </Group>
            <Group gap={4} wrap="nowrap">
              <Tooltip label="View item">
                <ActionIcon variant="subtle" size="sm" aria-label={`View ${record.name}`}>
                  <IconExternalLink size={14} />
                </ActionIcon>
              </Tooltip>
              {editable && (
                <>
                  <Tooltip label="Change">
                    <ActionIcon variant="subtle" color="gray" size="sm" aria-label={`Change ${label}`} onClick={picker.open}>
                      <IconEdit size={14} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Remove">
                    <ActionIcon variant="subtle" color="red" size="sm" aria-label={`Remove ${label}`} onClick={() => onChange(null)}>
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Tooltip>
                </>
              )}
            </Group>
          </Group>
        ) : (
          <Group justify="center" py="md">
            <Text c="dimmed">No item selected</Text>
            {editable && (
              <Button variant="light" leftSection={<IconPlus size={14} />} onClick={picker.open}>
                Select Item
              </Button>
            )}
          </Group>
        )}
      </Paper>
      {error && (
        <Text size="xs" c="red">
          {error}
        </Text>
      )}
      {editable && (
        <Modal {...CLOSE_LABEL} opened={pickerOpened} onClose={picker.close} title={`Select ${label.toLowerCase()}`} size="xl">
          <SupplierPicker
            value={value}
            onSelect={(id) => {
              onChange(id);
              picker.close();
            }}
            onClear={() => {
              onChange(null);
              picker.close();
            }}
            onCancel={picker.close}
          />
        </Modal>
      )}
    </Stack>
  );
}

function RelatedList({
  label,
  description,
  required,
  rows,
  onRowsChange,
  readOnly,
  onCreate,
  onAddExisting,
}: {
  label: string;
  description?: string;
  required?: boolean;
  rows: RelatedRow[];
  onRowsChange?: (rows: RelatedRow[]) => void;
  readOnly?: boolean;
  onCreate?: () => void;
  onAddExisting?: () => void;
}) {
  const editable = !readOnly && !!onRowsChange;
  const initialOrder = useRef(rows.map((r) => r.id).join());
  const [armedId, setArmedId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const count = rows.filter((r) => r.state !== 'removed').length;
  const dirty = rows.some((r) => r.state) || rows.map((r) => r.id).join() !== initialOrder.current;

  const move = (from: number, to: number) => {
    if (!onRowsChange || from === to || from < 0 || to < 0 || to >= rows.length) return;
    const next = rows.slice();
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onRowsChange(next);
  };
  const remove = (row: RelatedRow) =>
    onRowsChange?.(
      row.state === 'created'
        ? rows.filter((r) => r.id !== row.id)
        : rows.map((r) => (r.id === row.id ? { ...r, state: 'removed' } : r)),
    );
  const restore = (row: RelatedRow) => onRowsChange?.(rows.map((r) => (r.id === row.id ? { ...r, state: undefined } : r)));

  return (
    <Stack gap="xs">
      <RelationLabel label={label} description={description} required={required} />
      <Paper p="md" withBorder>
        <Group justify="flex-end" gap="sm" mb="md">
          {count > 0 && (
            <Text size="sm" c="dimmed">
              {count === 1 ? '1 item' : `${count} items`}
              {dirty && (
                <Text span c="yellow" size="xs">
                  {' '}
                  (unsaved changes)
                </Text>
              )}
            </Text>
          )}
          {editable && onAddExisting && (
            <Button variant="light" size="sm" leftSection={<IconPlus size={16} />} onClick={onAddExisting}>
              Add Existing
            </Button>
          )}
          {editable && onCreate && (
            <Button size="sm" leftSection={<IconPlus size={16} />} onClick={onCreate}>
              Create New
            </Button>
          )}
        </Group>
        {rows.length === 0 ? (
          <Paper p="xl" ta="center">
            <Text c="dimmed" size="sm">
              No related items
            </Text>
          </Paper>
        ) : (
          <Stack gap="xs">
            {rows.map((row, index) => {
              const removed = row.state === 'removed';
              return (
                <Paper
                  key={row.id}
                  p="sm"
                  withBorder
                  className={styles.relatedRow}
                  data-dragging={dragId === row.id || undefined}
                  data-removed={removed || undefined}
                  draggable={editable && armedId === row.id}
                  onDragStart={(e) => {
                    setDragId(row.id);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragOver={(e) => {
                    if (!dragId) return;
                    e.preventDefault();
                    move(
                      rows.findIndex((r) => r.id === dragId),
                      index,
                    );
                  }}
                  onDrop={(e) => e.preventDefault()}
                  onDragEnd={() => {
                    setDragId(null);
                    setArmedId(null);
                  }}
                >
                  <Group justify="space-between" wrap="nowrap" gap="sm">
                    <Group gap="sm" wrap="nowrap" className={styles.grow}>
                      {editable && (
                        <Tooltip label="Drag to reorder">
                          <ActionIcon
                            variant="subtle"
                            size="sm"
                            className={styles.grab}
                            aria-label={`Reorder ${row.primary}. Use the arrow keys to move it.`}
                            disabled={removed}
                            onPointerDown={() => setArmedId(row.id)}
                            onPointerUp={() => setArmedId(null)}
                            onKeyDown={(e) => {
                              if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                                e.preventDefault();
                                move(index, e.key === 'ArrowUp' ? index - 1 : index + 1);
                              }
                            }}
                          >
                            <IconGripVertical size={14} />
                          </ActionIcon>
                        </Tooltip>
                      )}
                      {row.collection && (
                        <Badge color="blue" size="sm" className={styles.noShrink}>
                          {row.collection}
                        </Badge>
                      )}
                      {row.leading}
                      <div className={styles.grow}>
                        <Text size="sm" fw={500} truncate td={removed ? 'line-through' : undefined}>
                          {row.primary}
                        </Text>
                        {row.secondary && (
                          <Text size="xs" c="dimmed" truncate>
                            {row.secondary}
                          </Text>
                        )}
                      </div>
                      {row.badge && (
                        <Badge size="sm" color={row.badge.color} className={styles.noShrink}>
                          {row.badge.label}
                        </Badge>
                      )}
                      {row.state === 'created' && (
                        <Badge size="xs" color="green" className={styles.noShrink}>
                          New
                        </Badge>
                      )}
                      {removed && (
                        <Badge size="xs" color="red" className={styles.noShrink}>
                          Removed
                        </Badge>
                      )}
                    </Group>
                    <Group gap={4} wrap="nowrap">
                      <Tooltip label="Navigate to item">
                        <ActionIcon variant="subtle" size="sm" aria-label={`Open ${row.primary}`}>
                          <IconExternalLink size={14} />
                        </ActionIcon>
                      </Tooltip>
                      {editable &&
                        (removed ? (
                          <Tooltip label="Undo remove">
                            <ActionIcon variant="subtle" color="gray" size="sm" aria-label={`Undo remove ${row.primary}`} onClick={() => restore(row)}>
                              <IconArrowBackUp size={14} />
                            </ActionIcon>
                          </Tooltip>
                        ) : (
                          <Tooltip label="Remove">
                            <ActionIcon variant="subtle" color="red" size="sm" aria-label={`Remove ${row.primary}`} onClick={() => remove(row)}>
                              <IconTrash size={14} />
                            </ActionIcon>
                          </Tooltip>
                        ))}
                    </Group>
                  </Group>
                </Paper>
              );
            })}
          </Stack>
        )}
      </Paper>
    </Stack>
  );
}

interface PickerColumn<T> {
  header: string;
  cell: (row: T) => ReactNode;
  align?: 'right';
}

function ItemPicker<T extends { id: string }>({
  rows,
  columns,
  rowLabel,
  matches,
  noun,
  pageSize = 4,
  initialSelected = [],
  onCancel,
  onAdd,
}: {
  rows: T[];
  columns: PickerColumn<T>[];
  rowLabel: (row: T) => string;
  matches: (row: T, query: string) => boolean;
  noun: string;
  pageSize?: number;
  initialSelected?: string[];
  onCancel: () => void;
  onAdd: (rows: T[]) => void;
}) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>(initialSelected);
  const q = query.trim().toLowerCase();
  const filtered = q ? rows.filter((r) => matches(r, q)) : rows;
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pages);
  const pageRows = filtered.slice((current - 1) * pageSize, current * pageSize);
  const pageIds = pageRows.map((r) => r.id);
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => selected.includes(id));
  const someOnPage = pageIds.some((id) => selected.includes(id));
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const togglePage = () =>
    setSelected((s) => (allOnPage ? s.filter((id) => !pageIds.includes(id)) : Array.from(new Set([...s, ...pageIds]))));
  const start = filtered.length ? (current - 1) * pageSize + 1 : 0;
  const end = Math.min(current * pageSize, filtered.length);

  return (
    <Stack gap="md">
      <TextInput
        aria-label={`Search ${noun}`}
        placeholder={`Search ${noun}…`}
        leftSection={<IconSearch size={16} />}
        value={query}
        onChange={(e) => {
          setQuery(e.currentTarget.value);
          setPage(1);
        }}
      />
      <Paper withBorder className={styles.tableWrap}>
        <Table highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th w={44}>
                <Checkbox
                  aria-label="Select all on this page"
                  checked={allOnPage}
                  indeterminate={someOnPage && !allOnPage}
                  disabled={pageRows.length === 0}
                  onChange={togglePage}
                />
              </Table.Th>
              {columns.map((c) => (
                <Table.Th key={c.header} ta={c.align}>
                  {c.header}
                </Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {pageRows.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={columns.length + 1}>
                  <Text ta="center" c="dimmed" size="sm" py="lg">
                    No {noun} match “{query.trim()}”
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              pageRows.map((row) => {
                const checked = selected.includes(row.id);
                return (
                  <Table.Tr key={row.id} className={styles.pickRow} data-selected={checked || undefined}>
                    <Table.Td>
                      <Checkbox aria-label={`Select ${rowLabel(row)}`} checked={checked} onChange={() => toggle(row.id)} />
                    </Table.Td>
                    {columns.map((c) => (
                      <Table.Td key={c.header} ta={c.align}>
                        {c.cell(row)}
                      </Table.Td>
                    ))}
                  </Table.Tr>
                );
              })
            )}
          </Table.Tbody>
        </Table>
      </Paper>
      <Group justify="space-between" gap="sm">
        <Text size="sm" c="dimmed">
          {filtered.length ? `Showing ${start}–${end} of ${filtered.length}` : 'No results'}
        </Text>
        {pages > 1 && (
          <Pagination size="sm" total={pages} value={current} onChange={setPage} getControlProps={paginationControlProps} />
        )}
      </Group>
      <Group justify="flex-end" gap="sm">
        <Button variant="default" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          leftSection={<IconPlus size={16} />}
          disabled={selected.length === 0}
          onClick={() => onAdd(rows.filter((r) => selected.includes(r.id)))}
        >
          {selected.length ? `Add Selected (${selected.length})` : 'Add Selected'}
        </Button>
      </Group>
    </Stack>
  );
}

const USER_COLUMNS: PickerColumn<MockUser>[] = [
  {
    header: 'Name',
    cell: (u) => (
      <Group gap="sm" wrap="nowrap">
        <Avatar size={28} radius="xl" color="primary">
          {u.initials}
        </Avatar>
        <div>
          <Text size="sm" fw={500}>
            {u.name}
          </Text>
          <Text size="xs" c="dimmed">
            {u.email}
          </Text>
        </div>
      </Group>
    ),
  },
  { header: 'Team', cell: (u) => u.team },
  { header: 'Role', cell: (u) => u.role },
  {
    header: 'Status',
    cell: (u) => (
      <Badge size="sm" color={USER_STATUS[u.status].color}>
        {USER_STATUS[u.status].label}
      </Badge>
    ),
  },
];

const CATALOG_COLUMNS: PickerColumn<CatalogItem>[] = [
  { header: 'SKU', cell: (c) => <Text size="sm" ff="monospace">{c.sku}</Text> },
  { header: 'Name', cell: (c) => <Text size="sm" fw={500}>{c.name}</Text> },
  {
    header: 'Stock',
    cell: (c) => (
      <Badge size="sm" color={STOCK_COLOR[c.stock]}>
        {c.stock}
      </Badge>
    ),
  },
  { header: 'Unit price', cell: (c) => `$${c.unit.toFixed(2)}`, align: 'right' },
];

const userMatches = (u: MockUser, q: string) => `${u.name} ${u.email} ${u.team} ${u.role}`.toLowerCase().includes(q);
const catalogMatches = (c: CatalogItem, q: string) => `${c.sku} ${c.name}`.toLowerCase().includes(q);

function CreateLineItemForm({ onSave, onCancel }: { onSave: (row: RelatedRow) => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [qty, setQty] = useState<string | number>(1);
  const [unit, setUnit] = useState<string | number>('');
  const [stock, setStock] = useState<string | null>('In stock');
  const [tried, setTried] = useState(false);
  const errors = {
    name: name.trim() ? undefined : 'Describe the item',
    qty: Number(qty) > 0 ? undefined : 'Enter a quantity',
    unit: unit !== '' && Number(unit) > 0 ? undefined : 'Enter a unit price',
  };
  const valid = !errors.name && !errors.qty && !errors.unit;
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setTried(true);
        if (!valid) return;
        onSave(
          lineRow(`li-new-${Date.now()}`, name.trim(), Number(qty), Number(unit), (stock ?? 'In stock') as CatalogItem['stock'], 'created'),
        );
      }}
    >
      <Stack gap="md">
        <TextInput label="Description" withAsterisk value={name} onChange={(e) => setName(e.currentTarget.value)} error={tried && errors.name} />
        <Group grow align="flex-start">
          <NumberInput label="Quantity" withAsterisk min={1} value={qty} onChange={setQty} error={tried && errors.qty} />
          <NumberInput
            label="Unit price"
            withAsterisk
            prefix="$"
            decimalScale={2}
            min={0}
            hideControls
            value={unit}
            onChange={setUnit}
            error={tried && errors.unit}
          />
        </Group>
        <Select label="Availability" data={['In stock', 'Backordered']} value={stock} onChange={setStock} allowDeselect={false} />
        <Group justify="flex-end" gap="sm" mt="sm">
          <Button variant="default" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit">Save</Button>
        </Group>
      </Stack>
    </form>
  );
}

/** Many-to-one, one-to-many, many-to-many and many-to-any fields with staged edits, reordering and pickers. */
export function RelationalFields() {
  const [supplier, setSupplier] = useState<string | null>(supplierByName('Atlas Packaging'));
  const [lines, setLines] = useState<RelatedRow[]>(LINE_ITEMS);
  const [approvers, setApprovers] = useState<RelatedRow[]>(INITIAL_APPROVERS);
  const [createOpened, create] = useDisclosure(false);
  const [catalogOpened, catalog] = useDisclosure(false);
  const [usersOpened, users] = useDisclosure(false);
  const linkedUsers = new Set(approvers.map((r) => r.id));
  const linkedCatalog = new Set(lines.map((r) => r.id));

  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        <Specimen
          label="Many-to-one · select-dropdown-m2o"
          align="start"
          note={
            <>
              Bordered <code>Paper</code> with the display template, then view, change and remove{' '}
              <code>ActionIcon</code>s. Change opens a <code>Modal size=&quot;xl&quot;</code> picker; remove leaves the
              empty state with a light <code>Select Item</code> button.
            </>
          }
        >
          <Stack gap="lg" className={styles.card}>
            <ManyToOneField label="Supplier" required value={supplier} onChange={setSupplier} />
            <ManyToOneField label="Parent order" description="Link a blanket order this one draws from." value={null} onChange={noop} />
          </Stack>
        </Specimen>
        <Specimen
          label="Many-to-one · error and read-only"
          align="start"
          note={
            <>
              <code>error</code> renders as red <code>xs</code> text under the field. <code>readOnly</code> and{' '}
              <code>disabled</code> look the same: the value and its view link stay, the edit actions go.
            </>
          }
        >
          <Stack gap="lg" className={styles.card}>
            <ManyToOneField label="Supplier" required value={null} onChange={noop} error="Choose a supplier" />
            <ManyToOneField label="Supplier" value={supplierByName('Keystone Logistics')} readOnly />
          </Stack>
        </Specimen>
        <Specimen
          label="One-to-many · list-o2m"
          span="full"
          align="start"
          note={
            <>
              Each related item is a bordered row: grip handle (drag it, or focus it and press ↑/↓), display template,
              status <code>Badge</code>, open and remove. Edits are staged until the parent saves — new rows get a{' '}
              <code>New</code> badge, removed rows strike through with undo, and the count shows <em>unsaved changes</em>.
              Create New opens a <code>Drawer</code>; Add Existing opens the picker.
            </>
          }
        >
          <div className={styles.card}>
            <RelatedList
              label="Line items"
              required
              rows={lines}
              onRowsChange={setLines}
              onCreate={create.open}
              onAddExisting={catalog.open}
            />
          </div>
        </Specimen>
        <Specimen
          label="Many-to-many · list-m2m"
          align="start"
          note={
            <>
              Junction rows show the related record: an <code>Avatar</code>, name and role, with the user&apos;s status
              badge. Add Existing excludes people already linked.
            </>
          }
        >
          <div className={styles.card}>
            <RelatedList
              label="Approvers"
              description="Everyone listed must approve before the order is sent."
              rows={approvers}
              onRowsChange={setApprovers}
              onAddExisting={users.open}
            />
          </div>
        </Specimen>
        <Specimen
          label="Empty"
          align="start"
          note={
            <>
              With nothing linked the count disappears and the list reads <em>No related items</em> under its actions.
            </>
          }
        >
          <div className={styles.card}>
            <RelatedList
              label="Watchers"
              description="People notified when this order changes."
              rows={[]}
              onRowsChange={noop}
              onAddExisting={noop}
            />
          </div>
        </Specimen>
        <Specimen
          label="Many-to-any · list-m2a, read-only"
          span="full"
          align="start"
          note={
            <>
              Rows from different collections carry a <code>color=&quot;blue&quot;</code> collection badge.{' '}
              <code>readOnly</code> drops the grip, remove and add controls but keeps each row&apos;s open link.
            </>
          }
        >
          <div className={styles.card}>
            <RelatedList label="Linked records" rows={M2A_ROWS} readOnly />
          </div>
        </Specimen>
      </SpecimenGrid>

      <Drawer {...CLOSE_LABEL} opened={createOpened} onClose={create.close} position="right" size="md" title="Create item">
        <CreateLineItemForm
          onCancel={create.close}
          onSave={(row) => {
            setLines((rows) => [...rows, row]);
            create.close();
          }}
        />
      </Drawer>
      <Modal {...CLOSE_LABEL} opened={catalogOpened} onClose={catalog.close} title="Select Items" size="xl">
        <ItemPicker
          rows={CATALOG.filter((c) => !linkedCatalog.has(c.id))}
          columns={CATALOG_COLUMNS}
          rowLabel={(c) => c.name}
          matches={catalogMatches}
          noun="items"
          onCancel={catalog.close}
          onAdd={(picked) => {
            setLines((rows) => [...rows, ...picked.map((c) => lineRow(c.id, c.name, 1, c.unit, c.stock, 'created'))]);
            catalog.close();
          }}
        />
      </Modal>
      <Modal {...CLOSE_LABEL} opened={usersOpened} onClose={users.close} title="Select Items" size="xl">
        <ItemPicker
          rows={USERS.filter((u) => !linkedUsers.has(u.id))}
          columns={USER_COLUMNS}
          rowLabel={(u) => u.name}
          matches={userMatches}
          noun="users"
          onCancel={users.close}
          onAdd={(picked) => {
            setApprovers((rows) => [...rows, ...picked.map((u) => userRow(u, 'created'))]);
            users.close();
          }}
        />
      </Modal>
    </Gallery>
  );
}

function StageBackdrop({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className={styles.stageBackdrop}>
      <div>
        <Title order={3}>{title}</Title>
        <Text size="sm" c="dimmed" mt={4}>
          {subtitle}
        </Text>
      </div>
      {children}
    </div>
  );
}

/** The Add Existing picker pinned open over a record: search, a checkbox table, pagination and Add Selected (n). */
export function RelationPicker() {
  return (
    <Gallery>
      <SpecimenGrid cols={1}>
        <Specimen
          label="Add Existing picker · static preview"
          span="full"
          note={
            <>
              <code>Modal size=&quot;xl&quot;</code> titled <em>Select Items</em>: search resets to page 1, the header{' '}
              <code>Checkbox</code> selects the page (indeterminate when partial), selected rows tint{' '}
              <code>--ds-primary-50</code>, and the ink button counts the selection. Linked records are filtered out.
            </>
          }
        >
          <BrowserFrame url="/orders/PO-2041" height={520}>
            <div className={styles.fixedStage}>
              <StageBackdrop title="PO-2041 · Atlas Packaging" subtitle="Pending approval · due 04 Nov">
                <Card>
                  <RelatedList label="Approvers" rows={INITIAL_APPROVERS} onRowsChange={noop} onAddExisting={noop} />
                </Card>
              </StageBackdrop>
              <Modal {...STATIC_OVERLAY} {...CLOSE_LABEL} title="Select Items" size="xl" yOffset={32}>
                <ItemPicker
                  rows={USERS.filter((u) => !INITIAL_APPROVERS.some((r) => r.id === u.id))}
                  columns={USER_COLUMNS}
                  rowLabel={(u) => u.name}
                  matches={userMatches}
                  noun="users"
                  pageSize={3}
                  initialSelected={[USERS[1].id]}
                  onCancel={noop}
                  onAdd={noop}
                />
              </Modal>
            </div>
          </BrowserFrame>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

/* ── File upload ────────────────────────────────────────────── */

type FileKind = 'image' | 'pdf' | 'spreadsheet' | 'archive' | 'video' | 'other';

const KIND_ICON: Record<Exclude<FileKind, 'image'>, Icon> = {
  pdf: IconFileTypePdf,
  spreadsheet: IconFileSpreadsheet,
  archive: IconFileZip,
  video: IconMovie,
  other: IconFile,
};

const KIND_LABEL: Record<FileKind, string> = {
  image: 'Image',
  pdf: 'PDF',
  spreadsheet: 'Sheet',
  archive: 'Zip',
  video: 'Video',
  other: 'Other',
};

const MAX_UPLOAD = 25_000_000;

function formatBytes(bytes: number) {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1000))} KB`;
}

function kindOf(name: string): FileKind {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'heic'].includes(ext)) return 'image';
  if (ext === 'pdf') return 'pdf';
  if (['xls', 'xlsx', 'csv', 'numbers'].includes(ext)) return 'spreadsheet';
  if (['zip', 'tar', 'gz', '7z'].includes(ext)) return 'archive';
  if (['mp4', 'mov', 'webm', 'avi'].includes(ext)) return 'video';
  return 'other';
}

/** A token-coloured stand-in for an image thumbnail (the shipped field loads the real asset). */
function PhotoThumb({ size }: { size?: number }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} className={styles.photoThumb} aria-hidden preserveAspectRatio="xMidYMid slice">
      <rect width="40" height="40" fill="var(--ds-primary-50)" />
      <circle cx="29" cy="11" r="4" fill="var(--ds-primary-200)" />
      <path d="M0 31 L12 18 L21 27 L27 21 L40 33 V40 H0 Z" fill="var(--ds-primary-500)" fillOpacity={0.45} />
      <path d="M0 36 L10 29 L20 35 L30 30 L40 37 V40 H0 Z" fill="var(--ds-primary-600)" fillOpacity={0.5} />
    </svg>
  );
}

function FileThumb({ kind, size }: { kind: FileKind; size: number }) {
  if (kind === 'image') return <PhotoThumb size={size} />;
  const KindIcon = KIND_ICON[kind];
  return (
    <ThemeIcon size={size} variant="light" color="gray">
      <KindIcon size={Math.round(size * 0.55)} stroke={1.5} />
    </ThemeIcon>
  );
}

function DropZone({
  forced,
  disabled,
  onFiles,
  onLibrary,
}: {
  forced?: 'dragover' | 'uploading';
  disabled?: boolean;
  onFiles?: (files: File[]) => void;
  onLibrary?: () => void;
}) {
  const [over, setOver] = useState(false);
  const live = !forced && !disabled;
  const dragover = forced === 'dragover' || (live && over);
  return (
    <Paper
      p="xl"
      withBorder
      className={styles.dropzone}
      data-dragover={dragover || undefined}
      data-disabled={disabled || undefined}
      aria-disabled={disabled || undefined}
      onDragOver={
        live
          ? (e) => {
              e.preventDefault();
              setOver(true);
            }
          : undefined
      }
      onDragLeave={live ? () => setOver(false) : undefined}
      onDrop={
        live
          ? (e) => {
              e.preventDefault();
              setOver(false);
              const files = Array.from(e.dataTransfer.files);
              if (files.length) onFiles?.(files);
            }
          : undefined
      }
    >
      <Stack align="center" gap="md">
        {forced === 'uploading' ? (
          <>
            <Loader size="lg" />
            <Text size="sm" c="dimmed">
              Uploading...
            </Text>
          </>
        ) : (
          <>
            <Box className={styles.dropIcon}>
              <IconPhoto size={52} stroke={1.5} />
            </Box>
            <Box ta="center">
              <Text size="lg">{dragover ? 'Drop files here' : 'Drag files here or click to select'}</Text>
              <Text size="sm" c="dimmed" mt={4}>
                PDF, images or spreadsheets, up to 25 MB each
              </Text>
            </Box>
            <Group gap="sm" justify="center">
              <FileButton onChange={(files) => onFiles?.(files)} multiple disabled={disabled}>
                {(props) => (
                  <Button {...props} variant="default" leftSection={<IconUpload size={16} />} disabled={disabled}>
                    Upload from device
                  </Button>
                )}
              </FileButton>
              <Button variant="default" leftSection={<IconFolderOpen size={16} />} onClick={onLibrary} disabled={disabled}>
                Choose from library
              </Button>
            </Group>
          </>
        )}
      </Stack>
    </Paper>
  );
}

interface QueueItem {
  id: string;
  name: string;
  size: number;
  kind: FileKind;
  status: 'uploading' | 'done' | 'failed';
  progress: number;
  live?: boolean;
  error?: string;
  retryable?: boolean;
}

const SEED_QUEUE: QueueItem[] = [
  { id: 'q1', name: 'freight-contract-2026.pdf', size: 4_100_000, kind: 'pdf', status: 'uploading', progress: 58 },
  { id: 'q2', name: 'dock-3-after.jpg', size: 1_800_000, kind: 'image', status: 'done', progress: 100 },
  { id: 'q3', name: 'supplier-scorecard.xlsx', size: 220_000, kind: 'spreadsheet', status: 'done', progress: 100 },
  {
    id: 'q4',
    name: 'site-survey-walkthrough.mov',
    size: 18_600_000,
    kind: 'video',
    status: 'failed',
    progress: 34,
    error: 'Upload failed — the connection was interrupted.',
    retryable: true,
  },
];

function UploadRow({
  item,
  onCancel,
  onRetry,
  onRemove,
}: {
  item: QueueItem;
  onCancel: () => void;
  onRetry: () => void;
  onRemove: () => void;
}) {
  const meta =
    item.status === 'uploading'
      ? `${formatBytes((item.size * item.progress) / 100)} of ${formatBytes(item.size)}`
      : formatBytes(item.size);
  return (
    <Group wrap="nowrap" gap="md" py="sm">
      <FileThumb kind={item.kind} size={40} />
      <div className={styles.grow}>
        <Group justify="space-between" wrap="nowrap" gap="sm">
          <Text size="sm" fw={500} truncate>
            {item.name}
          </Text>
          <Text size="xs" c="dimmed" className={styles.noShrink}>
            {meta}
          </Text>
        </Group>
        {item.status === 'uploading' && (
          <Progress value={item.progress} size="sm" mt={8} striped animated={item.live} aria-label={`Uploading ${item.name}`} />
        )}
        {item.status === 'done' && (
          <Group gap={4} mt={2} wrap="nowrap">
            <Text c="green" span lh={0}>
              <IconCircleCheck size={14} />
            </Text>
            <Text size="xs" c="dimmed">
              Uploaded
            </Text>
          </Group>
        )}
        {item.status === 'failed' && (
          <Text size="xs" c="red" mt={2}>
            {item.error}
          </Text>
        )}
      </div>
      <Group gap={4} wrap="nowrap" className={styles.noShrink}>
        {item.status === 'failed' && item.retryable && (
          <Button variant="subtle" size="compact-sm" leftSection={<IconRefresh size={14} />} onClick={onRetry}>
            Retry
          </Button>
        )}
        {item.status === 'uploading' ? (
          <Tooltip label="Cancel upload">
            <ActionIcon variant="subtle" color="gray" aria-label={`Cancel upload of ${item.name}`} onClick={onCancel}>
              <IconX size={16} />
            </ActionIcon>
          </Tooltip>
        ) : (
          <Tooltip label="Remove">
            <ActionIcon variant="subtle" color={item.status === 'failed' ? 'gray' : 'red'} aria-label={`Remove ${item.name}`} onClick={onRemove}>
              {item.status === 'failed' ? <IconX size={16} /> : <IconTrash size={16} />}
            </ActionIcon>
          </Tooltip>
        )}
      </Group>
    </Group>
  );
}

interface LibraryFile {
  id: string;
  name: string;
  kind: FileKind;
  size: number;
}

const LIBRARY_FOLDERS = ['Contracts', 'Invoices', 'Site photos'];

const LIBRARY_FILES: LibraryFile[] = [
  { id: 'lib-1', name: 'atlas-packaging-quote.pdf', kind: 'pdf', size: 312_000 },
  { id: 'lib-2', name: 'dock-3-before.jpg', kind: 'image', size: 1_650_000 },
  { id: 'lib-3', name: 'dock-3-after.jpg', kind: 'image', size: 1_800_000 },
  { id: 'lib-4', name: 'supplier-scorecard.xlsx', kind: 'spreadsheet', size: 220_000 },
  { id: 'lib-5', name: 'freight-rates-2026.csv', kind: 'spreadsheet', size: 48_000 },
  { id: 'lib-6', name: 'brand-assets.zip', kind: 'archive', size: 14_200_000 },
  { id: 'lib-7', name: 'safety-induction.mp4', kind: 'video', size: 86_000_000 },
];

function LibraryCard({ label, onActivate, thumb, children }: { label: string; onActivate: () => void; thumb: ReactNode; children: ReactNode }) {
  return (
    <Paper
      withBorder
      className={styles.libraryCard}
      role="button"
      tabIndex={0}
      aria-label={label}
      onClick={onActivate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onActivate();
        }
      }}
    >
      <div className={styles.libraryThumb}>{thumb}</div>
      <Box p="xs">{children}</Box>
    </Paper>
  );
}

function LibraryPicker({ onSelect }: { onSelect: (file: LibraryFile) => void }) {
  const [query, setQuery] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [folder, setFolder] = useState<string | null>(null);
  const q = query.trim().toLowerCase();
  const searching = q.length > 0;
  const folders = searching || folder ? [] : LIBRARY_FOLDERS;
  const files = folder ? [] : LIBRARY_FILES.filter((f) => f.name.toLowerCase().includes(q));
  const total = folders.length + files.length;

  return (
    <Stack gap="sm">
      <Group gap="sm" wrap="nowrap" align="flex-start">
        <TextInput
          className={styles.grow}
          aria-label="Search files"
          placeholder="Search files..."
          leftSection={<IconSearch size={14} />}
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          rightSection={
            query ? (
              <ActionIcon variant="subtle" aria-label="Clear search" onClick={() => setQuery('')}>
                <IconX size={14} />
              </ActionIcon>
            ) : null
          }
        />
        <SegmentedControl
          aria-label="Library layout"
          value={view}
          onChange={(v) => setView(v as 'grid' | 'list')}
          data={[
            {
              value: 'grid',
              label: (
                <Center title="Grid view">
                  <IconLayoutGrid size={16} />
                  <VisuallyHidden>Grid view</VisuallyHidden>
                </Center>
              ),
            },
            {
              value: 'list',
              label: (
                <Center title="List view">
                  <IconList size={16} />
                  <VisuallyHidden>List view</VisuallyHidden>
                </Center>
              ),
            },
          ]}
        />
      </Group>
      {!searching && (
        <Group gap={4} wrap="nowrap">
          <Anchor component="button" type="button" size="xs" underline="never" c={folder ? undefined : 'dimmed'} onClick={() => setFolder(null)}>
            Library
          </Anchor>
          {folder && (
            <>
              <Text c="dimmed" span lh={0}>
                <IconChevronRight size={12} />
              </Text>
              <Text size="xs" c="dimmed">
                {folder}
              </Text>
            </>
          )}
        </Group>
      )}
      <div className={styles.libraryBody}>
        {total === 0 ? (
          <Stack align="center" justify="center" gap="xs" className={styles.libraryEmpty}>
            <ThemeIcon size={52} variant="light" color="gray">
              <IconFile size={28} stroke={1.5} />
            </ThemeIcon>
            <Text size="sm" c="dimmed">
              {searching ? `No files match "${query.trim()}"` : 'No files found'}
            </Text>
          </Stack>
        ) : view === 'grid' ? (
          <div className={styles.libraryGrid}>
            {folders.map((name) => (
              <LibraryCard
                key={name}
                label={`Open folder ${name}`}
                onActivate={() => setFolder(name)}
                thumb={
                  <ThemeIcon size={52} variant="light" color="gray">
                    <IconFolder size={28} stroke={1.5} />
                  </ThemeIcon>
                }
              >
                <Text size="xs" fw={500} lineClamp={1}>
                  {name}
                </Text>
                <Text size="xs" c="dimmed">
                  Folder
                </Text>
              </LibraryCard>
            ))}
            {files.map((file) => (
              <LibraryCard
                key={file.id}
                label={`Select ${file.name}`}
                onActivate={() => onSelect(file)}
                thumb={file.kind === 'image' ? <PhotoThumb /> : <FileThumb kind={file.kind} size={52} />}
              >
                <Text size="xs" fw={500} lineClamp={1} title={file.name}>
                  {file.name}
                </Text>
                <Group justify="space-between" gap={4} wrap="nowrap" mt={2}>
                  <Badge size="xs" color="gray">
                    {KIND_LABEL[file.kind]}
                  </Badge>
                  <Text size="xs" c="dimmed" className={styles.noWrap}>
                    {formatBytes(file.size)}
                  </Text>
                </Group>
              </LibraryCard>
            ))}
          </div>
        ) : (
          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th ta="right">Size</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {folders.map((name) => (
                <Table.Tr key={name}>
                  <Table.Td>
                    <Anchor component="button" type="button" size="sm" onClick={() => setFolder(name)}>
                      <Group gap="sm" wrap="nowrap">
                        <ThemeIcon size={32} variant="light" color="gray">
                          <IconFolder size={18} stroke={1.5} />
                        </ThemeIcon>
                        {name}
                      </Group>
                    </Anchor>
                  </Table.Td>
                  <Table.Td>Folder</Table.Td>
                  <Table.Td ta="right">—</Table.Td>
                </Table.Tr>
              ))}
              {files.map((file) => (
                <Table.Tr key={file.id}>
                  <Table.Td>
                    <Anchor component="button" type="button" size="sm" onClick={() => onSelect(file)}>
                      <Group gap="sm" wrap="nowrap">
                        <FileThumb kind={file.kind} size={32} />
                        {file.name}
                      </Group>
                    </Anchor>
                  </Table.Td>
                  <Table.Td>{KIND_LABEL[file.kind]}</Table.Td>
                  <Table.Td ta="right">{formatBytes(file.size)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </div>
      <Text size="xs" c="dimmed">
        {total ? `Showing 1–${total}` : 'Showing 0'}
      </Text>
    </Stack>
  );
}

/** Upload drop zones (idle, drag-over, uploading, disabled), a live upload queue and the library picker. */
export function FileUpload() {
  const [queue, setQueue] = useState<QueueItem[]>(SEED_QUEUE);
  const [libraryOpened, library] = useDisclosure(false);
  const hasLive = queue.some((q) => q.live && q.status === 'uploading');

  useEffect(() => {
    if (!hasLive) return;
    const id = window.setInterval(() => {
      setQueue((items) =>
        items.map((q) => {
          if (!q.live || q.status !== 'uploading') return q;
          const progress = Math.min(100, q.progress + 9);
          return progress >= 100 ? { ...q, progress: 100, status: 'done', live: false } : { ...q, progress };
        }),
      );
    }, 350);
    return () => window.clearInterval(id);
  }, [hasLive]);

  const addFiles = (files: File[]) =>
    setQueue((items) => [
      ...files.map<QueueItem>((f, i) =>
        f.size > MAX_UPLOAD
          ? { id: `up-${Date.now()}-${i}`, name: f.name, size: f.size, kind: kindOf(f.name), status: 'failed', progress: 0, error: 'Exceeds the 25 MB limit.' }
          : { id: `up-${Date.now()}-${i}`, name: f.name, size: f.size, kind: kindOf(f.name), status: 'uploading', progress: 0, live: true },
      ),
      ...items,
    ]);
  const patch = (id: string, next: Partial<QueueItem>) => setQueue((items) => items.map((q) => (q.id === id ? { ...q, ...next } : q)));
  const drop = (id: string) => setQueue((items) => items.filter((q) => q.id !== id));

  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        <Specimen
          label="Drop zone · idle"
          note={
            <>
              Dashed <code>Paper p=&quot;xl&quot;</code> with default-variant buttons, as the shipped <code>Upload</code>{' '}
              interface renders it. Drag a file over it, or use Upload from device — files join the queue below.
            </>
          }
        >
          <div className={styles.card}>
            <DropZone onFiles={addFiles} onLibrary={library.open} />
          </div>
        </Specimen>
        <Specimen
          label="Drop zone · drag-over"
          note={
            <>
              While a file is over it the border turns <code>--ds-primary-500</code> on a <code>--ds-primary-50</code>{' '}
              wash, the icon goes ember and the copy changes to <em>Drop files here</em>.
            </>
          }
        >
          <div className={styles.card}>
            <DropZone forced="dragover" onFiles={addFiles} onLibrary={library.open} />
          </div>
        </Specimen>
        <Specimen
          label="Upload queue"
          span="full"
          align="start"
          note={
            <>
              One row per file: type icon or image thumbnail, name, size, then a <code>Progress</code> bar with cancel,
              a green <em>Uploaded</em> check, or a red message with Retry. Over-limit files fail without a retry. The
              shipped field also raises a toast on completion or failure (<code>@mantine/notifications</code>, not
              shown here).
            </>
          }
        >
          <Card padding="md" className={styles.card}>
            {queue.length === 0 ? (
              <Text size="sm" c="dimmed" ta="center" py="md">
                No files yet — drop some into the zone above.
              </Text>
            ) : (
              queue.map((item, i) => (
                <div key={item.id}>
                  {i > 0 && <Divider />}
                  <UploadRow
                    item={item}
                    onCancel={() => drop(item.id)}
                    onRemove={() => drop(item.id)}
                    onRetry={() => patch(item.id, { status: 'uploading', progress: 0, live: true, error: undefined })}
                  />
                </div>
              ))
            )}
          </Card>
        </Specimen>
        <Specimen label="Drop zone · uploading" note="The whole zone swaps to a large Loader while a batch is sent.">
          <div className={styles.card}>
            <DropZone forced="uploading" />
          </div>
        </Specimen>
        <Specimen label="Drop zone · disabled" note="Disabled buttons, ignored drops and a dimmed zone.">
          <div className={styles.card}>
            <DropZone disabled />
          </div>
        </Specimen>
      </SpecimenGrid>
      <Modal {...CLOSE_LABEL} opened={libraryOpened} onClose={library.close} title="Choose from library" size="xl">
        <LibraryPicker
          onSelect={(file) => {
            setQueue((items) => [
              { id: `lib-${file.id}-${Date.now()}`, name: file.name, size: file.size, kind: file.kind, status: 'done', progress: 100 },
              ...items,
            ]);
            library.close();
          }}
        />
      </Modal>
    </Gallery>
  );
}

/** The "Choose from library" picker pinned open: search, grid/list toggle, breadcrumb and file cards. */
export function FileLibraryPicker() {
  return (
    <Gallery>
      <SpecimenGrid cols={1}>
        <Specimen
          label="Choose from library · static preview"
          span="full"
          note={
            <>
              <code>Modal size=&quot;xl&quot;</code> with a search field, an icon-only <code>SegmentedControl</code>{' '}
              (visually hidden labels) for grid or list, a folder breadcrumb and keyboard-focusable cards — folders open,
              files select. Images show their thumbnail; everything else a gray light <code>ThemeIcon</code>.
            </>
          }
        >
          <BrowserFrame url="/orders/PO-2041" height={640}>
            <div className={styles.fixedStage}>
              <StageBackdrop title="PO-2041 · Atlas Packaging" subtitle="Attachments">
                <DropZone />
              </StageBackdrop>
              <Modal {...STATIC_OVERLAY} {...CLOSE_LABEL} title="Choose from library" size="xl" yOffset={32}>
                <LibraryPicker onSelect={noop} />
              </Modal>
            </div>
          </BrowserFrame>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}
