'use client';

import {
  ActionIcon,
  Alert,
  Anchor,
  Avatar,
  Badge,
  Button,
  Card,
  Group,
  Progress,
  SegmentedControl,
  Skeleton,
  Stack,
  Table,
  Text,
  ThemeIcon,
  Timeline,
  Title,
  Tooltip,
  UnstyledButton,
  VisuallyHidden,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconArrowDownRight,
  IconArrowRight,
  IconArrowUpRight,
  IconBuildingStore,
  IconChartBar,
  IconCheck,
  IconCircleCheck,
  IconClockHour4,
  IconCurrencyDollar,
  IconDownload,
  IconEye,
  IconFileInvoice,
  IconPlus,
  IconReportAnalytics,
  IconTruckDelivery,
  IconUserPlus,
  type Icon,
} from '@tabler/icons-react';
import { useState, type ReactNode } from 'react';
import { AppShellFrame } from '../AppShellFrame';
import { Gallery } from '../Gallery';
import { BrowserFrame } from '../Layout';
import {
  ACTIVITY,
  CURRENT_USER,
  KPIS,
  MONTHLY_SPEND,
  ORDER_STATUS,
  PAGE_ORDERS,
  formatMoney,
  type MockOrder,
} from '../data';
import styles from './dashboard.module.css';

/* ── Page-specific mock data ─────────────────────────────────── */

const FIRST_NAME = CURRENT_USER.name.split(' ')[0];

type Tone = 'gray' | 'green' | 'red';

/** Per-KPI icon, a 12-point trend for the sparkline, and a tone chosen by meaning, not direction. */
const KPI_META: Record<string, { icon: Icon; tone: Tone; series: number[] }> = {
  'Open purchase orders': { icon: IconFileInvoice, tone: 'gray', series: [96, 101, 99, 108, 112, 110, 116, 121, 118, 124, 126, 128] },
  'Spend this month': { icon: IconCurrencyDollar, tone: 'gray', series: [18, 41, 77, 102, 139, 171, 214, 249, 288, 331, 377, 412] },
  'Avg. approval time': { icon: IconClockHour4, tone: 'green', series: [9.1, 8.7, 8.9, 8.2, 7.8, 7.6, 7.4, 7.1, 6.9, 6.8, 6.6, 6.4] },
  'Overdue deliveries': { icon: IconTruckDelivery, tone: 'red', series: [3, 4, 3, 5, 4, 4, 5, 6, 5, 6, 5, 7] },
};

/** Monthly budget in thousands of USD — the dashed target line on the spend chart. */
const MONTHLY_BUDGET = 520;
const SPEND_AXIS_MAX = 600;
const SPEND_TICKS = [0, 150, 300, 450, 600];

/** October spend vs. budget per category, thousands of USD (sums to the $412k KPI). */
const BUDGETS = [
  { category: 'Freight', spent: 148, budget: 160 },
  { category: 'Packaging', spent: 96, budget: 90 },
  { category: 'Software', spent: 72, budget: 110 },
  { category: 'Facilities', spent: 41, budget: 70 },
  { category: 'Catering', spent: 33, budget: 50 },
  { category: 'Office', spent: 22, budget: 40 },
];

const orderByNumber = (number: string) => PAGE_ORDERS.find((o) => o.number === number) as MockOrder;

/** Orders still pending approval: the queue that lands on the signed-in approver. */
const APPROVALS = PAGE_ORDERS.filter((o) => o.status === 'pending');

const OVERDUE_COUNT = KPIS.find((k) => k.label === 'Overdue deliveries')?.value ?? '0';

const TODAY = Date.UTC(2026, 9, 28);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Deliveries due around today (28 Oct), read from the orders' due dates; negative `inDays` means late. */
const DELIVERIES = [
  { po: 'PO-2034', items: 'Printer paper and toner' },
  { po: 'PO-2037', items: '12 × laptop docks' },
  { po: 'PO-2040', items: 'Pallet freight, 3 trucks' },
  { po: 'PO-2041', items: 'Corrugated boxes' },
].map(({ po, items }) => {
  const order = orderByNumber(po);
  const [day, month] = order.due.split(' ');
  const inDays = Math.round((Date.UTC(2026, MONTHS.indexOf(month), Number(day)) - TODAY) / 86_400_000);
  return { po, items, supplier: order.supplier, day, month, inDays };
});

const QUICK_ACTIONS: Array<{ icon: Icon; label: string; hint: string }> = [
  { icon: IconFileInvoice, label: 'New purchase order', hint: 'Raise a PO for approval' },
  { icon: IconBuildingStore, label: 'Add supplier', hint: 'Onboard a new vendor' },
  { icon: IconUserPlus, label: 'Invite teammate', hint: 'Send an invite link' },
  { icon: IconReportAnalytics, label: 'Run spend report', hint: 'Export as CSV or PDF' },
];

const SETUP_STEPS: Array<{ icon: Icon; title: string; text: string; action?: string; done?: boolean; primary?: boolean }> = [
  { icon: IconCheck, title: 'Create your workspace', text: 'Northwind Ops is ready to use.', done: true },
  { icon: IconUserPlus, title: 'Invite your team', text: 'Add requesters, approvers and finance.', action: 'Invite people' },
  { icon: IconBuildingStore, title: 'Add your first supplier', text: 'Import a CSV or add vendors one by one.', action: 'Add supplier' },
  { icon: IconFileInvoice, title: 'Raise a purchase order', text: 'Send it through your approval workflow.', action: 'Create order', primary: true },
];

/* ── Shared pieces ───────────────────────────────────────────── */

function CardHeader({ title, subtitle, right }: { title: ReactNode; subtitle?: ReactNode; right?: ReactNode }) {
  return (
    <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm">
      <div className={styles.minw0}>
        <Title order={4}>{title}</Title>
        {subtitle && (
          <Text size="xs" c="dimmed" mt={2} component="div">
            {subtitle}
          </Text>
        )}
      </div>
      {right}
    </Group>
  );
}

function PageHeader({ title, subtitle, exportDisabled }: { title: string; subtitle: ReactNode; exportDisabled?: boolean }) {
  const [range, setRange] = useState('30D');
  return (
    <div className={styles.header}>
      <div className={styles.headerText}>
        <Title order={2}>{title}</Title>
        <Text c="dimmed" mt={4} component="div">
          {subtitle}
        </Text>
      </div>
      <div className={styles.headerActions}>
        <SegmentedControl
          aria-label="Date range"
          data={['7D', '30D', 'QTD', 'YTD']}
          value={range}
          onChange={setRange}
          disabled={exportDisabled}
        />
        <Button variant="default" leftSection={<IconDownload size={16} />} disabled={exportDisabled}>
          Export
        </Button>
        <Button leftSection={<IconPlus size={16} />}>New purchase order</Button>
      </div>
    </div>
  );
}

function Sparkline({ series, label }: { series: number[]; label: string }) {
  const max = Math.max(...series);
  const min = Math.min(...series);
  const range = max - min || 1;
  return (
    <div className={styles.spark} role="img" aria-label={`${label}, last 12 weeks`}>
      {series.map((v, i) => (
        <div
          key={i}
          className={styles.sparkBar}
          data-current={i === series.length - 1 || undefined}
          style={{ height: `${25 + ((v - min) / range) * 75}%` }}
        />
      ))}
    </div>
  );
}

function KpiCard({ label, value, delta, trend, hint, empty }: (typeof KPIS)[number] & { empty?: boolean }) {
  const meta = KPI_META[label];
  const Arrow = trend === 'up' ? IconArrowUpRight : IconArrowDownRight;
  const KpiIcon = meta.icon;
  return (
    <Card padding="lg" className={styles.cardFill}>
      <Group justify="space-between" align="flex-start" wrap="nowrap" gap="xs">
        <Text size="xs" c="dimmed" fw={500}>
          {label}
        </Text>
        <ThemeIcon variant="light" color="gray" size="md" radius="md" aria-hidden>
          <KpiIcon size={16} stroke={1.8} />
        </ThemeIcon>
      </Group>
      <Title order={3} mt={4}>
        {empty ? '—' : value}
      </Title>
      {empty ? (
        <Text size="xs" c="dimmed" mt={8}>
          No data yet
        </Text>
      ) : (
        <Group gap={6} mt={8} wrap="wrap">
          <Badge size="sm" color={meta.tone} leftSection={<Arrow size={12} />}>
            {delta}
          </Badge>
          <Text size="xs" c="dimmed">
            {hint}
          </Text>
        </Group>
      )}
      {empty ? <div className={styles.sparkEmpty} aria-hidden /> : <Sparkline series={meta.series} label={label} />}
    </Card>
  );
}

/* ── Dashboard cards ─────────────────────────────────────────── */

function SpendChart() {
  const total = MONTHLY_SPEND.reduce((sum, m) => sum + m.value, 0);
  const last = MONTHLY_SPEND.length - 1;
  const pct = (v: number) => `${(v / SPEND_AXIS_MAX) * 100}%`;
  return (
    <Card padding="lg" className={styles.cardFill}>
      <CardHeader
        title="Spend by month"
        subtitle="Committed spend · May – Oct 2026"
      />
      <Group gap="xs" align="center" mt="sm">
        <Title order={3}>{formatMoney(total * 1000)}</Title>
        <Badge size="sm" color="gray" leftSection={<IconArrowUpRight size={12} />}>
          +8.2% vs. prior 6 months
        </Badge>
      </Group>
      <div className={styles.chart}>
        {SPEND_TICKS.map((t) => (
          <div key={t} className={styles.gridline} style={{ bottom: pct(t) }} aria-hidden>
            <span className={styles.tick}>{t === 0 ? '$0' : `$${t}k`}</span>
          </div>
        ))}
        <div className={styles.budgetLine} style={{ bottom: pct(MONTHLY_BUDGET) }} aria-hidden>
          <span className={styles.budgetLabel}>Budget ${MONTHLY_BUDGET}k</span>
        </div>
        <div className={styles.plot} role="list" aria-label="Monthly spend, May to October">
          {MONTHLY_SPEND.map((m, i) => (
            <Tooltip.Floating
              key={m.month}
              label={`${m.month} · $${m.value}k · ${Math.round((m.value / MONTHLY_BUDGET) * 100)}% of budget`}
            >
              <div className={styles.column} role="listitem" aria-label={`${m.month}: $${m.value}k`}>
                {i === last && <span className={styles.barValue}>${m.value}k</span>}
                <div className={styles.bar} data-current={i === last || undefined} style={{ height: pct(m.value) }} />
              </div>
            </Tooltip.Floating>
          ))}
        </div>
      </div>
      <div className={styles.xAxis} aria-hidden>
        {MONTHLY_SPEND.map((m, i) => (
          <span key={m.month} data-current={i === last || undefined}>
            {m.month}
          </span>
        ))}
      </div>
      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={styles.swatch} />
          Previous months
        </span>
        <span className={styles.legendItem}>
          <span className={styles.swatch} data-current />
          Current month
        </span>
        <span className={styles.legendItem}>
          <span className={styles.swatchLine} />
          Monthly budget
        </span>
      </div>
    </Card>
  );
}

function BudgetByCategory() {
  const spent = BUDGETS.reduce((s, b) => s + b.spent, 0);
  const budget = BUDGETS.reduce((s, b) => s + b.budget, 0);
  return (
    <Card padding="lg" className={styles.cardFill}>
      <CardHeader title="Budget by category" subtitle={`October · $${spent}k of $${budget}k`} />
      <Stack gap="md" mt="lg">
        {BUDGETS.map((b) => {
          const used = Math.round((b.spent / b.budget) * 100);
          const over = used > 100;
          const near = !over && used >= 90;
          return (
            <div key={b.category}>
              <Group justify="space-between" wrap="nowrap" gap="xs" mb={6}>
                <Text size="sm" fw={500}>
                  {b.category}
                </Text>
                <Text size="xs" c="dimmed">
                  ${b.spent}k / ${b.budget}k
                </Text>
              </Group>
              <div className={styles.budgetBar}>
                <Progress
                  size="sm"
                  value={Math.min(used, 100)}
                  color={over ? 'red' : near ? 'yellow' : undefined}
                  aria-label={`${b.category}: ${used}% of budget used`}
                />
                <Badge
                  size="xs"
                  color={over ? 'red' : near ? 'yellow' : 'gray'}
                  leftSection={over ? <IconAlertTriangle size={10} /> : undefined}
                >
                  {used}%
                </Badge>
              </div>
            </div>
          );
        })}
      </Stack>
    </Card>
  );
}

function ApprovalsTable() {
  return (
    <Card padding="lg">
      <CardHeader
        title={
          <Group gap="xs" component="span">
            Approvals waiting on you
            <Badge color="primary" size="sm">
              {APPROVALS.length}
            </Badge>
          </Group>
        }
        subtitle="Oldest first · you approve for Finance and Procurement"
        right={
          <Button variant="subtle" color="gray" size="xs" rightSection={<IconArrowRight size={14} />}>
            All orders
          </Button>
        }
      />
      <Card.Section withBorder mt="md">
        <Table.ScrollContainer minWidth={540}>
          <Table className={styles.nowrap} withTableBorder={false} highlightOnHover verticalSpacing="sm" horizontalSpacing="md">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Order</Table.Th>
                <Table.Th>Requested by</Table.Th>
                <Table.Th ta="right">Amount</Table.Th>
                <Table.Th>
                  <VisuallyHidden>Actions</VisuallyHidden>
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {APPROVALS.map((o) => (
                <Table.Tr key={o.id}>
                  <Table.Td>
                    <Text size="sm" fw={600}>
                      {o.number}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {o.supplier}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs" wrap="nowrap">
                      <Avatar size={28} radius="xl" color="primary">
                        {o.owner.initials}
                      </Avatar>
                      <div className={styles.noShrink}>
                        <Text size="sm" fw={500}>
                          {o.owner.name}
                        </Text>
                        <Badge size="xs" color={ORDER_STATUS[o.status].color}>
                          {ORDER_STATUS[o.status].label}
                        </Badge>
                      </div>
                    </Group>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Text size="sm" fw={600}>
                      {formatMoney(o.amount)}
                    </Text>
                    <Text size="xs" c="dimmed">
                      Due {o.due}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={6} wrap="nowrap" justify="flex-end">
                      <Tooltip label="Review">
                        <ActionIcon variant="default" size="md" radius="xl" aria-label={`Review ${o.number}`}>
                          <IconEye size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Button size="compact-sm" leftSection={<IconCheck size={14} />}>
                        Approve
                      </Button>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Card.Section>
    </Card>
  );
}

function ActivityFeed() {
  return (
    <Card padding="lg" className={styles.cardFill}>
      <CardHeader
        title="Recent activity"
        right={
          <Anchor size="xs" href="#" onClick={(e) => e.preventDefault()}>
            View all
          </Anchor>
        }
      />
      <Timeline bulletSize={28} lineWidth={2} mt="lg">
        {ACTIVITY.map((a) => (
          <Timeline.Item
            key={a.id}
            bullet={
              <Avatar size={24} radius="xl" color="primary">
                {a.user.initials}
              </Avatar>
            }
            title={
              <Text size="sm">
                <Text span fw={600}>
                  {a.user.name}
                </Text>{' '}
                {a.action}
              </Text>
            }
          >
            <Text size="xs" c="dimmed">
              {a.target}
            </Text>
            <Text size="xs" c="dimmed" mt={2}>
              {a.time}
            </Text>
          </Timeline.Item>
        ))}
      </Timeline>
    </Card>
  );
}

function DueBadge({ inDays }: { inDays: number }) {
  if (inDays < 0) {
    return (
      <Badge size="sm" color="red" mt={6} leftSection={<IconAlertTriangle size={12} />}>
        {-inDays} days late
      </Badge>
    );
  }
  return (
    <Badge size="sm" color={inDays <= 3 ? 'yellow' : 'gray'} mt={6}>
      In {inDays} days
    </Badge>
  );
}

function UpcomingDeliveries() {
  return (
    <Card padding="lg" className={styles.cardFill}>
      <CardHeader title="Upcoming deliveries" subtitle="Next 7 days and overdue" />
      <Stack gap="md" mt="lg">
        {DELIVERIES.map((d) => (
          <Group key={d.po} gap="sm" wrap="nowrap" align="flex-start">
            <div className={styles.dateTile} aria-hidden>
              <span className={styles.dateDay}>{d.day}</span>
              <span className={styles.dateMonth}>{d.month}</span>
            </div>
            <div className={styles.minw0}>
              <Text size="sm" fw={600} truncate>
                {d.supplier}
              </Text>
              <Text size="xs" c="dimmed" truncate>
                {d.po} · {d.items}
              </Text>
              <VisuallyHidden>
                Due {d.day} {d.month}
              </VisuallyHidden>
              <DueBadge inDays={d.inDays} />
            </div>
          </Group>
        ))}
      </Stack>
    </Card>
  );
}

function QuickActions() {
  return (
    <Card padding="lg" className={styles.cardFill}>
      <CardHeader title="Quick actions" />
      <div className={styles.actions}>
        {QUICK_ACTIONS.map((a) => {
          const TileIcon = a.icon;
          return (
            <UnstyledButton key={a.label} className={styles.action}>
              <ThemeIcon variant="light" color="primary" size="lg" radius="md" aria-hidden>
                <TileIcon size={18} stroke={1.8} />
              </ThemeIcon>
              <div className={styles.minw0}>
                <Text size="sm" fw={600} truncate>
                  {a.label}
                </Text>
                <Text size="xs" c="dimmed" truncate>
                  {a.hint}
                </Text>
              </div>
            </UnstyledButton>
          );
        })}
      </div>
    </Card>
  );
}

/* ── Loading placeholders ────────────────────────────────────── */

const SKELETON_BARS = [52, 60, 56, 66, 62, 70];

function KpiSkeleton() {
  return (
    <Card padding="lg" className={styles.cardFill}>
      <Group justify="space-between" align="flex-start" wrap="nowrap" gap="xs">
        <Skeleton height={10} width="55%" mt={4} />
        <Skeleton height={28} width={28} />
      </Group>
      <Skeleton height={24} width="45%" mt={8} />
      <Skeleton height={14} width="75%" mt={12} />
      <Skeleton height={28} mt={14} />
    </Card>
  );
}

function SpendChartSkeleton() {
  const pct = (v: number) => `${(v / SPEND_AXIS_MAX) * 100}%`;
  return (
    <Card padding="lg" className={styles.cardFill}>
      <CardHeader title="Spend by month" subtitle="Committed spend · May – Oct 2026" />
      <Skeleton height={24} width={150} mt="sm" />
      <div className={styles.chart} aria-hidden>
        {SPEND_TICKS.map((t) => (
          <div key={t} className={styles.gridline} style={{ bottom: pct(t) }}>
            <span className={styles.tickSkeleton}>
              <Skeleton height={8} width={26} />
            </span>
          </div>
        ))}
        <div className={styles.plot}>
          {SKELETON_BARS.map((v, i) => (
            <div key={i} className={styles.column}>
              <Skeleton className={styles.barSkeleton} height={`${v}%`} />
            </div>
          ))}
        </div>
      </div>
      <div className={styles.xAxis} aria-hidden>
        {SKELETON_BARS.map((_, i) => (
          <span key={i} className={styles.xSkeleton}>
            <Skeleton height={8} width={24} />
          </span>
        ))}
      </div>
    </Card>
  );
}

function BudgetSkeleton() {
  return (
    <Card padding="lg" className={styles.cardFill}>
      <CardHeader title="Budget by category" subtitle={<Skeleton height={8} width={120} mt={6} />} />
      <Stack gap="md" mt="lg">
        {[64, 52, 58, 46, 50, 40].map((w, i) => (
          <div key={i}>
            <Group justify="space-between" wrap="nowrap" gap="xs" mb={8}>
              <Skeleton height={10} width={`${w}%`} />
              <Skeleton height={8} width={56} />
            </Group>
            <Skeleton height={8} />
          </div>
        ))}
      </Stack>
    </Card>
  );
}

function RowsSkeleton({ rows, avatar }: { rows: number; avatar: 'circle' | 'tile' }) {
  return (
    <Stack gap="lg" mt="lg">
      {Array.from({ length: rows }, (_, i) => (
        <Group key={i} gap="sm" wrap="nowrap" align="flex-start">
          {avatar === 'circle' ? <Skeleton height={24} circle /> : <Skeleton height={44} width={44} />}
          <div className={styles.minw0}>
            <Skeleton height={10} width={`${78 - i * 9}%`} mt={2} />
            <Skeleton height={8} width={`${56 - i * 6}%`} mt={8} />
            <Skeleton height={8} width={64} mt={8} />
          </div>
        </Group>
      ))}
    </Stack>
  );
}

function ApprovalsSkeleton() {
  return (
    <Card padding="lg">
      <CardHeader title="Approvals waiting on you" subtitle="Oldest first · you approve for Finance and Procurement" />
      <Card.Section withBorder mt="md">
        <Stack gap={0}>
          {[0, 1].map((i) => (
            <div key={i} className={styles.skeletonRow}>
              <div className={styles.minw0}>
                <Skeleton height={10} width="40%" />
                <Skeleton height={8} width="60%" mt={8} />
              </div>
              <Group gap="xs" wrap="nowrap" className={styles.minw0}>
                <Skeleton height={28} circle />
                <Skeleton height={10} width="55%" />
              </Group>
              <Skeleton height={10} width={64} />
              <Skeleton height={26} width={96} />
            </div>
          ))}
        </Stack>
      </Card.Section>
    </Card>
  );
}

/* ── Templates ───────────────────────────────────────────────── */

/** The Northwind Ops home dashboard: KPIs, spend chart, budgets, approvals, activity, deliveries and shortcuts. */
export function DashboardTemplate() {
  const [alertOpen, setAlertOpen] = useState(true);
  return (
    <Gallery>
      <BrowserFrame url="/en/dashboard" height={900}>
        <AppShellFrame active="/dashboard">
          <div className={styles.root}>
            <PageHeader
              title={`Good morning, ${FIRST_NAME}`}
              subtitle={`Wednesday, 28 October · ${APPROVALS.length} approvals and ${OVERDUE_COUNT} overdue deliveries need your attention.`}
            />

            {alertOpen && (
              <Alert
                color="yellow"
                icon={<IconAlertTriangle size={18} />}
                title="Packaging is 7% over its October budget"
                withCloseButton
                closeButtonLabel="Dismiss alert"
                onClose={() => setAlertOpen(false)}
              >
                $96k committed against a $90k budget.{' '}
                <Anchor href="#" size="sm" onClick={(e) => e.preventDefault()}>
                  Review packaging orders
                </Anchor>
              </Alert>
            )}

            <div className={styles.kpis}>
              {KPIS.map((k) => (
                <KpiCard key={k.label} {...k} />
              ))}
            </div>

            <div className={styles.split}>
              <SpendChart />
              <BudgetByCategory />
            </div>

            <ApprovalsTable />

            <div className={styles.trio}>
              <ActivityFeed />
              <UpcomingDeliveries />
              <QuickActions />
            </div>
          </div>
        </AppShellFrame>
      </BrowserFrame>
    </Gallery>
  );
}

/** The same dashboard on a brand-new workspace: setup checklist, empty KPIs and empty-state cards. */
export function DashboardFirstRun() {
  const done = SETUP_STEPS.filter((s) => s.done).length;
  return (
    <Gallery>
      <BrowserFrame url="/en/dashboard" height={820}>
        <AppShellFrame active="/dashboard" hideNavBadges>
          <div className={styles.root}>
            <PageHeader
              title={`Welcome to Northwind Ops, ${FIRST_NAME}`}
              subtitle="Let's get your workspace ready — it takes about five minutes."
              exportDisabled
            />

            <Card padding="lg">
              <CardHeader
                title="Get set up"
                subtitle={`${done} of ${SETUP_STEPS.length} steps complete`}
                right={
                  <Button variant="subtle" color="gray" size="xs">
                    Skip for now
                  </Button>
                }
              />
              <Progress value={(done / SETUP_STEPS.length) * 100} size="sm" mt="md" aria-label="Setup progress" />
              <div className={styles.setupSteps}>
                {SETUP_STEPS.map((s) => {
                  const StepIcon = s.icon;
                  return (
                    <div key={s.title} className={styles.step} data-done={s.done || undefined}>
                      <ThemeIcon
                        variant="light"
                        color={s.done ? 'green' : 'gray'}
                        size="lg"
                        radius="xl"
                        aria-hidden
                      >
                        <StepIcon size={18} stroke={1.8} />
                      </ThemeIcon>
                      <div className={styles.minw0}>
                        <Text size="sm" fw={600} c={s.done ? 'dimmed' : undefined} td={s.done ? 'line-through' : undefined}>
                          {s.title}
                        </Text>
                        <Text size="xs" c="dimmed" mt={2}>
                          {s.text}
                        </Text>
                        {s.action && (
                          <Button
                            size="compact-sm"
                            mt="sm"
                            variant={s.primary ? undefined : 'default'}
                            leftSection={s.primary ? <IconPlus size={14} /> : undefined}
                          >
                            {s.action}
                          </Button>
                        )}
                        {s.done && (
                          <Text size="xs" c="green.7" fw={500} mt="sm">
                            Done
                          </Text>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            <div className={styles.kpis}>
              {KPIS.map((k) => (
                <KpiCard key={k.label} {...k} empty />
              ))}
            </div>

            <div className={styles.split}>
              <Card padding="lg" className={styles.cardFill}>
                <CardHeader title="Spend by month" subtitle="Committed spend · last 6 months" />
                <div className={styles.emptyPanel}>
                  <ThemeIcon variant="light" color="gray" size="xl" radius="xl" aria-hidden>
                    <IconChartBar size={22} stroke={1.8} />
                  </ThemeIcon>
                  <Text fw={600}>No spend yet</Text>
                  <Text size="sm" c="dimmed" maw={300}>
                    Bars appear here once your first purchase order is approved.
                  </Text>
                </div>
              </Card>
              <Card padding="lg" className={styles.cardFill}>
                <CardHeader title="Approvals waiting on you" />
                <div className={styles.emptyPanel}>
                  <ThemeIcon variant="light" color="green" size="xl" radius="xl" aria-hidden>
                    <IconCircleCheck size={22} stroke={1.8} />
                  </ThemeIcon>
                  <Text fw={600}>You&apos;re all caught up</Text>
                  <Text size="sm" c="dimmed" maw={260}>
                    Orders that need your sign-off land here.
                  </Text>
                </div>
              </Card>
            </div>
          </div>
        </AppShellFrame>
      </BrowserFrame>
    </Gallery>
  );
}

/** The dashboard while its queries resolve: real headings and static shortcuts, Skeleton blocks wherever data will land. */
export function DashboardLoading() {
  return (
    <Gallery>
      <BrowserFrame url="/en/dashboard" height={900}>
        <AppShellFrame active="/dashboard">
          <div className={styles.root} aria-busy="true">
            <VisuallyHidden role="status">Loading dashboard</VisuallyHidden>
            <PageHeader
              title={`Good morning, ${FIRST_NAME}`}
              subtitle={<Skeleton height={10} width={360} maw="100%" mt={8} />}
              exportDisabled
            />

            <div className={styles.kpis}>
              {KPIS.map((k) => (
                <KpiSkeleton key={k.label} />
              ))}
            </div>

            <div className={styles.split}>
              <SpendChartSkeleton />
              <BudgetSkeleton />
            </div>

            <ApprovalsSkeleton />

            <div className={styles.trio}>
              <Card padding="lg" className={styles.cardFill}>
                <CardHeader title="Recent activity" />
                <RowsSkeleton rows={4} avatar="circle" />
              </Card>
              <Card padding="lg" className={styles.cardFill}>
                <CardHeader title="Upcoming deliveries" subtitle="Next 7 days and overdue" />
                <RowsSkeleton rows={3} avatar="tile" />
              </Card>
              <QuickActions />
            </div>
          </div>
        </AppShellFrame>
      </BrowserFrame>
    </Gallery>
  );
}
