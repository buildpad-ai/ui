'use client';

import {
  Accordion,
  ActionIcon,
  Anchor,
  AspectRatio,
  Avatar,
  Badge,
  Button,
  Card,
  Checkbox,
  CloseButton,
  Code,
  ColorSwatch,
  CopyButton,
  Divider,
  Group,
  Image,
  Indicator,
  Kbd,
  List,
  Menu,
  NumberFormatter,
  Paper,
  ScrollArea,
  SegmentedControl,
  SimpleGrid,
  Skeleton,
  Spoiler,
  Stack,
  Switch,
  Table,
  Text,
  ThemeIcon,
  Timeline,
  Title,
  Tooltip,
  UnstyledButton,
  VisuallyHidden,
  type MantineColor,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconBell,
  IconBolt,
  IconBuildingStore,
  IconCheck,
  IconChevronDown,
  IconChevronUp,
  IconCircleCheck,
  IconClock,
  IconCopy,
  IconDots,
  IconDownload,
  IconEdit,
  IconEye,
  IconFilePlus,
  IconInbox,
  IconInfoCircle,
  IconMessage,
  IconPackage,
  IconPhoto,
  IconSelector,
  IconSend,
  IconShieldCheck,
  IconTruckDelivery,
  IconX,
  type Icon,
} from '@tabler/icons-react';
import { useMemo, useState, type ReactNode } from 'react';
import { Gallery } from '../Gallery';
import { Specimen, SpecimenGrid } from '../Layout';
import {
  ACTIVITY,
  CURRENT_USER,
  MONTHLY_SPEND,
  ORDERS,
  ORDER_STATUS,
  USERS,
  USER_STATUS,
  formatMoney,
  type MockOrder,
} from '../data';
import styles from './data-display.module.css';

/** Semantic colour props, in the order the brand lists them. */
const SEMANTIC: { color: MantineColor; name: string }[] = [
  { color: 'gray', name: 'Neutral' },
  { color: 'primary', name: 'Brand' },
  { color: 'blue', name: 'Info' },
  { color: 'green', name: 'Success' },
  { color: 'yellow', name: 'Warning' },
  { color: 'red', name: 'Danger' },
];

const SIZES = ['xs', 'sm', 'md', 'lg', 'xl'] as const;

/** Short status words so every variant fits a matrix cell. */
const MATRIX_LABEL: Record<string, string> = {
  Neutral: 'Draft',
  Brand: 'New',
  Info: 'Review',
  Success: 'Paid',
  Warning: 'Due',
  Danger: 'Failed',
};

/* ── Badge ─────────────────────────────────────────────────── */

/** Badge variants × semantic colours, sizes, sections and counters. */
export function BadgeShowcase() {
  const variants = ['light', 'filled', 'outline', 'dot', 'default', 'transparent'] as const;
  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        <Specimen
          span="full"
          label="Variants × colours"
          note={
            <>
              <code>light</code> is the theme default. Light and outline text is promoted to the AA{' '}
              <code>700</code> stop; <code>blue | green | yellow | red</code> resolve to info / success / warning / danger.
            </>
          }
        >
          <div className={styles.matrix}>
            <span />
            {SEMANTIC.map((s) => (
              <span key={s.name} className={styles.matrixHead}>
                {s.color}
              </span>
            ))}
            {variants.map((variant) => (
              <BadgeRow key={variant} variant={variant} />
            ))}
          </div>
        </Specimen>
        <Specimen label="Order status" note={<>Every <code>ORDER_STATUS</code> mapped to a colour prop — the same badges the list and record templates use.</>}>
          <Group gap="xs">
            {Object.values(ORDER_STATUS).map((s) => (
              <Badge key={s.label} color={s.color}>
                {s.label}
              </Badge>
            ))}
          </Group>
        </Specimen>
        <Specimen label="Presence" note={<><code>variant=&quot;dot&quot;</code> for live state — user status, sync health.</>}>
          <Group gap="xs">
            {Object.values(USER_STATUS).map((s) => (
              <Badge key={s.label} variant="dot" color={s.color}>
                {s.label}
              </Badge>
            ))}
            <Badge variant="dot" color="gray">
              Offline
            </Badge>
          </Group>
        </Specimen>
        <Specimen label="Sizes" note={<><code>size</code> xs – xl; <code>md</code> is the default. Text is fixed at <code>--ds-font-size-xs</code> by the theme, so size changes height and padding.</>}>
          <Group gap="xs" align="center">
            {SIZES.map((size) => (
              <Badge key={size} size={size} color="primary">
                {size}
              </Badge>
            ))}
          </Group>
        </Specimen>
        <Specimen label="Sections" note={<><code>leftSection</code> / <code>rightSection</code> — an icon, an avatar, or a <code>CloseButton</code> for removable filters.</>}>
          <Group gap="xs">
            <Badge color="green" leftSection={<IconCheck size={12} />}>
              Verified
            </Badge>
            <Badge
              color="gray"
              variant="default"
              leftSection={
                <Avatar size={16} color="primary">
                  {USERS[1].initials}
                </Avatar>
              }
            >
              {USERS[1].name}
            </Badge>
            <Badge
              color="gray"
              rightSection={<CloseButton size={16} iconSize={12} variant="transparent" aria-label="Remove Packaging filter" />}
            >
              Category: Packaging
            </Badge>
          </Group>
        </Specimen>
        <Specimen label="Counters" note={<><code>circle</code> keeps single-digit counts round; longer counts (“12”, “99+”) use the pill shape.</>}>
          <SimpleGrid cols={2} spacing="sm" verticalSpacing="sm">
            {[
              { label: 'Approvals', count: '4', circle: true, variant: 'light', color: 'gray' },
              { label: 'Alerts', count: '3', circle: true, variant: 'filled', color: 'red' },
              { label: 'Orders', count: '12', circle: false, variant: 'light', color: 'gray' },
              { label: 'Inbox', count: '99+', circle: false, variant: 'filled', color: 'primary' },
            ].map((c) => (
              <Group key={c.label} gap={6} wrap="nowrap">
                <Text size="sm" fw={500}>
                  {c.label}
                </Text>
                <Badge circle={c.circle} size="sm" variant={c.variant} color={c.color}>
                  {c.count}
                </Badge>
              </Group>
            ))}
          </SimpleGrid>
        </Specimen>
        <Specimen label="White on a dark surface" note={<><code>variant=&quot;white&quot;</code> is for badges laid over imagery or a filled band (shown on <code>--ds-brand-ink-900</code>).</>}>
          <div className={styles.inkBackdrop}>
            <Group gap="xs">
              {SEMANTIC.slice(1).map((s) => (
                <Badge key={s.name} variant="white" color={s.color}>
                  {s.name}
                </Badge>
              ))}
            </Group>
          </div>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

function BadgeRow({ variant }: { variant: 'light' | 'filled' | 'outline' | 'dot' | 'default' | 'transparent' }) {
  return (
    <>
      <span className={styles.matrixVariant}>{variant}</span>
      {SEMANTIC.map((s) => (
        <Badge key={s.name} variant={variant} color={s.color} size="sm">
          {MATRIX_LABEL[s.name]}
        </Badge>
      ))}
    </>
  );
}

/* ── Avatar ────────────────────────────────────────────────── */

/** Avatars: initials, colours, sizes, radius, groups and presence. */
export function AvatarShowcase() {
  const colors: MantineColor[] = ['primary', 'gray', 'blue', 'green', 'yellow', 'red'];
  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        <Specimen label="Initials × colour" span="full" note={<>Default <code>variant=&quot;light&quot;</code> (top) and <code>filled</code>. Use <code>primary</code> for people unless a colour encodes something.</>}>
          <Stack gap="sm">
            <Group gap="xs">
              {colors.map((c, i) => (
                <Avatar key={c} color={c}>
                  {USERS[i].initials}
                </Avatar>
              ))}
            </Group>
            <Group gap="xs">
              {colors.map((c, i) => (
                <Avatar key={c} color={c} variant="filled">
                  {USERS[i].initials}
                </Avatar>
              ))}
            </Group>
          </Stack>
        </Specimen>
        <Specimen label="Sizes" span="full" note={<><code>size</code> xs (16px) – xl (84px). <code>sm</code> in tables, <code>md</code> in lists, <code>xl</code> on profile headers.</>}>
          <Group gap="lg" align="center">
            {SIZES.map((size) => (
              <Avatar key={size} size={size} color="primary">
                {CURRENT_USER.initials}
              </Avatar>
            ))}
          </Group>
        </Specimen>
        <Specimen label="Radius & fallbacks" note={<>Round for people, <code>radius=&quot;md&quot;</code> for organisations and workspaces. No children → user glyph; <code>src</code> → image.</>}>
          <Group gap="sm">
            <Avatar color="primary">
              AH
            </Avatar>
            <Avatar color="gray" radius="md">
              <IconBuildingStore size={20} />
            </Avatar>
            <Avatar color="primary" variant="filled" radius="sm">
              N
            </Avatar>
            <Avatar aria-label="Unknown user" />
            <Avatar src="/docs/buildpad-icon.png" alt="Buildpad" radius="md" />
          </Group>
        </Specimen>
        <Specimen label="Avatar.Group" note={<>Use opaque avatars in a group — <code>filled</code>, with a <code>variant=&quot;default&quot;</code> <code>+N</code>; light tints are translucent and show through the overlap.</>}>
          <Stack gap="md">
            <Tooltip.Group openDelay={200} closeDelay={100}>
              <Avatar.Group>
                {USERS.slice(0, 4).map((u, i) => (
                  <Tooltip key={u.id} label={u.name}>
                    <Avatar color={(['primary', 'blue', 'green', 'gray'] as const)[i]} variant="filled">
                      {u.initials}
                    </Avatar>
                  </Tooltip>
                ))}
                <Avatar variant="default">+{USERS.length - 4}</Avatar>
              </Avatar.Group>
            </Tooltip.Group>
            <Avatar.Group spacing="xs">
              {USERS.slice(0, 3).map((u) => (
                <Avatar key={u.id} size="sm" color="primary" variant="filled">
                  {u.initials}
                </Avatar>
              ))}
              <Avatar size="sm" variant="default">
                +9
              </Avatar>
            </Avatar.Group>
          </Stack>
        </Specimen>
        <Specimen label="With presence" span="full" note={<><code>Indicator</code> with <code>position=&quot;bottom-end&quot;</code>, <code>offset</code> and <code>withBorder</code> — the border uses the surface colour so the dot cuts out cleanly.</>}>
          <SimpleGrid cols={2} spacing="lg" verticalSpacing="md">
            {USERS.slice(0, 4).map((u) => (
              <Group key={u.id} gap="sm" wrap="nowrap">
                <Indicator
                  color={USER_STATUS[u.status].color === 'green' ? 'green' : 'gray'}
                  position="bottom-end"
                  offset={5}
                  size={11}
                  withBorder
                  disabled={u.status === 'suspended'}
                >
                  <Avatar color="primary">
                    {u.initials}
                  </Avatar>
                </Indicator>
                <div>
                  <Text size="sm" fw={500}>
                    {u.name}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {u.status === 'active' ? 'Online' : u.status === 'invited' ? 'Invite pending' : 'Suspended'}
                  </Text>
                </div>
              </Group>
            ))}
          </SimpleGrid>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

/* ── Indicator ─────────────────────────────────────────────── */

/** Indicator on avatars, icon buttons and buttons; label, processing, disabled. */
export function IndicatorShowcase() {
  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        <Specimen label="On an icon button" note={<>Unread dot on the header bell; <code>processing</code> adds the pulse for live activity.</>}>
          <Group gap="xl">
            <Indicator size={9} offset={6}>
              <ActionIcon variant="default" size="lg" aria-label="Notifications">
                <IconBell size={18} />
              </ActionIcon>
            </Indicator>
            <Indicator size={9} offset={6} processing color="green">
              <ActionIcon variant="default" size="lg" aria-label="Live sync">
                <IconBolt size={18} />
              </ActionIcon>
            </Indicator>
            <Indicator size={9} offset={6} disabled>
              <ActionIcon variant="default" size="lg" aria-label="Messages, none unread">
                <IconMessage size={18} />
              </ActionIcon>
            </Indicator>
          </Group>
        </Specimen>
        <Specimen label="On a button" note={<><code>label</code> turns the dot into a count; <code>inline</code> anchors it to inline content.</>}>
          <Group gap="xl">
            <Indicator label="4" size={18}>
              <Button variant="default" leftSection={<IconInbox size={16} />}>
                Approvals
              </Button>
            </Indicator>
            <Indicator inline label="New" size={16} color="primary">
              <Button>Reports</Button>
            </Indicator>
          </Group>
        </Specimen>
        <Specimen label="Colours" span="full" note={<>Theme <code>primary</code> (ember) by default; status colours via <code>color</code>.</>}>
          <Group gap="lg">
            {SEMANTIC.map((s) => (
              <Indicator key={s.name} color={s.color} size={10} offset={4} withBorder>
                <Avatar radius="md" color="gray" aria-label={`${s.name} indicator`}>
                  <IconPackage size={18} />
                </Avatar>
              </Indicator>
            ))}
          </Group>
        </Specimen>
        <Specimen label="Positions" span="full" note={<><code>position</code> top / middle / bottom × start / center / end; <code>offset</code> pulls the dot in for round targets.</>}>
          <Group gap="xl">
            {(['top-start', 'top-end', 'middle-end', 'bottom-start', 'bottom-end'] as const).map((p) => (
              <Stack key={p} gap={8} align="center">
                <Indicator position={p} size={10} withBorder>
                  <Avatar radius="md" color="gray" aria-label={`Indicator at ${p}`}>
                    <IconPackage size={18} />
                  </Avatar>
                </Indicator>
                <Text size="xs" c="dimmed" ff="monospace">
                  {p}
                </Text>
              </Stack>
            ))}
          </Group>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

/* ── ThemeIcon ─────────────────────────────────────────────── */

/** ThemeIcon variants, sizes, colours and use as a feature bullet. */
export function ThemeIconShowcase() {
  const variants = ['filled', 'light', 'outline', 'default', 'transparent'] as const;
  const semanticIcons: Icon[] = [IconClock, IconBolt, IconInfoCircle, IconCircleCheck, IconAlertTriangle, IconX];
  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        <Specimen label="Variants" span="full" note={<>No <code>color</code> → theme <code>primary</code> (ember). <code>light</code> is the usual choice beside text.</>}>
          <Group gap="lg">
            {variants.map((v) => (
              <Stack key={v} gap={6} align="center">
                <ThemeIcon variant={v} size="lg">
                  <IconTruckDelivery size={18} />
                </ThemeIcon>
                <Text size="xs" c="dimmed" ff="monospace">
                  {v}
                </Text>
              </Stack>
            ))}
          </Group>
        </Specimen>
        <Specimen label="Sizes & radius" note={<><code>size</code> xs – xl; <code>radius={'{1000}'}</code> for circles — the theme's <code>xl</code> radius is 16px, so it only rounds small icons fully.</>}>
          <Stack gap="sm">
            <Group gap="sm" align="center">
              {SIZES.map((size, i) => (
                <ThemeIcon key={size} size={size} variant="light">
                  <IconPackage size={10 + i * 3} />
                </ThemeIcon>
              ))}
            </Group>
            <Group gap="sm" align="center">
              {SIZES.map((size, i) => (
                <ThemeIcon key={size} size={size} radius={1000} variant="light" color="green">
                  <IconCheck size={10 + i * 3} />
                </ThemeIcon>
              ))}
            </Group>
          </Stack>
        </Specimen>
        <Specimen label="In context" align="start" note={<>A <code>light</code> ThemeIcon heading a KPI tile — the pattern the dashboard template uses.</>}>
          <Paper withBorder p="md">
            <Group justify="space-between" align="flex-start" wrap="nowrap">
              <div>
                <Text size="xs" c="dimmed">
                  Open purchase orders
                </Text>
                <Title order={3}>128</Title>
                <Text size="xs" c="dimmed">
                  <Text span c="green" fw={600} size="xs">
                    +12
                  </Text>{' '}
                  vs. last week
                </Text>
              </div>
              <ThemeIcon variant="light" size="lg" radius="md">
                <IconPackage size={18} />
              </ThemeIcon>
            </Group>
          </Paper>
        </Specimen>
        <Specimen label="Semantic colours" span="full" note={<>Light (top) and filled ThemeIcons on each semantic scale — dashboards and empty states pair them with a heading.</>}>
          <Stack gap="sm">
            <Group gap="md">
              {SEMANTIC.map((s, i) => {
                const SIcon = semanticIcons[i];
                return (
                  <ThemeIcon key={s.name} color={s.color} variant="light" size="xl" radius="md">
                    <SIcon size={22} />
                  </ThemeIcon>
                );
              })}
            </Group>
            <Group gap="md">
              {SEMANTIC.map((s, i) => {
                const SIcon = semanticIcons[i];
                return (
                  <ThemeIcon key={s.name} color={s.color} size="xl" radius="md">
                    <SIcon size={22} />
                  </ThemeIcon>
                );
              })}
            </Group>
          </Stack>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

/* ── Card ──────────────────────────────────────────────────── */

/** Cards with an image band, an image section, header/footer sections and a list. */
export function CardShowcase() {
  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        <Specimen label="Card.Section band" align="start" note={<>A full-bleed <code>Card.Section</code> on top — here a token gradient (<code>--ds-primary-50 → 300</code>) standing in for a cover image.</>}>
          <Card>
            <Card.Section>
              <div className={styles.band}>
                <Badge variant="white" color="primary" leftSection={<IconShieldCheck size={12} />}>
                  Preferred supplier
                </Badge>
              </div>
            </Card.Section>
            <Stack gap="xs" mt="md">
              <Group justify="space-between" wrap="nowrap">
                <Title order={4}>Atlas Packaging</Title>
                <Badge color="green">Active</Badge>
              </Group>
              <Text size="sm" c="dimmed">
                Corrugated boxes, void fill and pallet wrap. Net 30, ships from Rotterdam.
              </Text>
            </Stack>
            <Group gap="xl" mt="md">
              <div>
                <Text size="xs" c="dimmed">
                  Orders YTD
                </Text>
                <Text fw={600}>14</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">
                  Spend YTD
                </Text>
                <Text fw={600}>{formatMoney(186400)}</Text>
              </div>
            </Group>
            <Group mt="lg" gap="sm">
              <Button variant="default" size="xs" style={{ flex: 1 }}>
                View
              </Button>
              <Button size="xs" style={{ flex: 1 }}>
                New order
              </Button>
            </Group>
          </Card>
        </Specimen>
        <Specimen label="Image section" align="start" note={<><code>Card.Section</code> wrapping an <code>Image</code> bleeds to the card edges and inherits its top radius.</>}>
          <Card>
            <Card.Section>
              <Image src="/docs/forms-new.png" alt="New form screen" h={150} fit="cover" style={{ objectPosition: 'left top' }} />
            </Card.Section>
            <Group justify="space-between" mt="md" wrap="nowrap">
              <Title order={4}>Supplier intake</Title>
              <Badge color="blue">Shared</Badge>
            </Group>
            <Text size="sm" c="dimmed" mt={4}>
              Onboarding form for new vendors — 12 fields, routed to Procurement.
            </Text>
            <Button variant="light" fullWidth mt="lg">
              Open form
            </Button>
          </Card>
        </Specimen>
        <Specimen label="Header & footer sections" align="start" note={<><code>Card.Section withBorder inheritPadding</code> draws hairline dividers (<code>--ds-card-border</code>) between header, body and footer.</>}>
          <Card>
            <Card.Section withBorder inheritPadding py="sm">
              <Group justify="space-between">
                <Text fw={600}>Monthly spend</Text>
                <Menu position="bottom-end" width={180}>
                  <Menu.Target>
                    <ActionIcon variant="subtle" color="gray" aria-label="Report options">
                      <IconDots size={16} />
                    </ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Item leftSection={<IconDownload size={14} />}>Export CSV</Menu.Item>
                    <Menu.Item leftSection={<IconEye size={14} />}>Open report</Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              </Group>
            </Card.Section>
            <Stack gap={4} py="md">
              <Text size="xs" c="dimmed">
                October
              </Text>
              <Group gap="xs" align="baseline">
                <Title order={2}>$412,380</Title>
                <Badge color="green" size="sm">
                  +4.1%
                </Badge>
              </Group>
              <Text size="xs" c="dimmed">
                {MONTHLY_SPEND.map((m) => m.month).join(' · ')}
              </Text>
            </Stack>
            <Card.Section withBorder inheritPadding py="sm">
              <Group justify="space-between">
                <Text size="xs" c="dimmed">
                  Updated 5 min ago
                </Text>
                <Anchor size="sm" href="#card">
                  View report
                </Anchor>
              </Group>
            </Card.Section>
          </Card>
        </Specimen>
        <Specimen label="Compact list card" align="start" note={<><code>padding=&quot;sm&quot;</code> with <code>Divider</code>s — every Card gets the hairline border and <code>--ds-card-shadow</code> from globals.css.</>}>
          <Card padding="sm">
            <Group justify="space-between" px={4} pb="xs">
              <Text fw={600}>Approvers</Text>
              <Button size="xs" variant="subtle">
                Manage
              </Button>
            </Group>
            {USERS.slice(0, 3).map((u, i) => (
              <div key={u.id}>
                {i > 0 && <Divider />}
                <Group justify="space-between" wrap="nowrap" px={4} py="xs">
                  <Group gap="sm" wrap="nowrap">
                    <Avatar size="sm" color="primary">
                      {u.initials}
                    </Avatar>
                    <div>
                      <Text size="sm" fw={500}>
                        {u.name}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {u.team}
                      </Text>
                    </div>
                  </Group>
                  <Badge color={i === 0 ? 'green' : 'gray'} size="sm">
                    {i === 0 ? 'Signed' : 'Waiting'}
                  </Badge>
                </Group>
              </div>
            ))}
          </Card>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

/* ── Paper ─────────────────────────────────────────────────── */

/** Paper shadows xs – xl, radius scale and border. */
export function PaperShowcase() {
  return (
    <Gallery>
      <SpecimenGrid cols={1}>
        <Specimen label="Shadows" surface="muted" note={<><code>shadow</code> xs – xl map to <code>--ds-shadow-*</code>: soft, long and low-opacity. <code>sm</code> for raised panels, <code>lg</code> for floating surfaces, <code>xl</code> for modals.</>}>
          <SimpleGrid cols={5} spacing="lg">
            {SIZES.map((s) => (
              <Paper key={s} shadow={s} className={styles.shadowTile}>
                <Text size="sm" fw={600}>
                  {s}
                </Text>
                <Text size="xs" c="dimmed">
                  shadow
                </Text>
              </Paper>
            ))}
          </SimpleGrid>
        </Specimen>
        <Specimen label="Radius & border" note={<>The theme gives Paper <code>--ds-radius-md</code>; <code>withBorder</code> adds the hairline <code>--mantine-color-default-border</code> (→ <code>--ds-border-color</code>).</>}>
          <SimpleGrid cols={3} spacing="lg">
            <Paper withBorder p="md">
              <Text size="sm" fw={600}>
                withBorder
              </Text>
              <Text size="xs" c="dimmed">
                Flat sub-panel inside a card or page.
              </Text>
            </Paper>
            <Paper withBorder shadow="sm" p="md">
              <Text size="sm" fw={600}>
                withBorder + shadow=&quot;sm&quot;
              </Text>
              <Text size="xs" c="dimmed">
                Raised panel on the page background.
              </Text>
            </Paper>
            <Paper shadow="lg" p="md">
              <Text size="sm" fw={600}>
                shadow=&quot;lg&quot;
              </Text>
              <Text size="xs" c="dimmed">
                Floating surface — popovers, toasts.
              </Text>
            </Paper>
          </SimpleGrid>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

/* ── Table ─────────────────────────────────────────────────── */

type SortKey = 'number' | 'supplier' | 'amount' | 'status';
const STATUS_ORDER = ['draft', 'pending', 'approved', 'shipped', 'cancelled'];

function sortOrders(rows: MockOrder[], key: SortKey, reversed: boolean): MockOrder[] {
  const sorted = [...rows].sort((a, b) => {
    switch (key) {
      case 'amount':
        return a.amount - b.amount;
      case 'status':
        return STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
      default:
        return a[key].localeCompare(b[key]);
    }
  });
  return reversed ? sorted.reverse() : sorted;
}

function SortableTh({
  children,
  active,
  reversed,
  onSort,
  align,
}: {
  children: ReactNode;
  active: boolean;
  reversed: boolean;
  onSort: () => void;
  align?: 'right';
}) {
  const SortIcon = active ? (reversed ? IconChevronDown : IconChevronUp) : IconSelector;
  return (
    <Table.Th aria-sort={active ? (reversed ? 'descending' : 'ascending') : 'none'} ta={align}>
      <UnstyledButton onClick={onSort} fz="inherit" fw="inherit" c="inherit">
        <Group gap={4} wrap="nowrap" justify={align === 'right' ? 'flex-end' : 'flex-start'}>
          {children}
          <SortIcon size={14} stroke={1.75} />
        </Group>
      </UnstyledButton>
    </Table.Th>
  );
}

function RowMenu({ order }: { order: MockOrder }) {
  return (
    <Menu position="bottom-end" width={180}>
      <Menu.Target>
        <ActionIcon variant="subtle" color="gray" aria-label={`Actions for ${order.number}`}>
          <IconDots size={16} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item leftSection={<IconEye size={14} />}>View order</Menu.Item>
        <Menu.Item leftSection={<IconEdit size={14} />}>Edit</Menu.Item>
        <Menu.Item leftSection={<IconCopy size={14} />}>Duplicate</Menu.Item>
        <Menu.Divider />
        <Menu.Item color="red" leftSection={<IconX size={14} />}>
          Cancel order
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

/** The full orders table: selection, sortable headers, status badges, row menus. */
export function OrdersTable() {
  const [selection, setSelection] = useState<string[]>(['o1', 'o3']);
  const [sortBy, setSortBy] = useState<SortKey>('number');
  const [reversed, setReversed] = useState(true);
  const rows = useMemo(() => sortOrders(ORDERS, sortBy, reversed), [sortBy, reversed]);

  const sort = (key: SortKey) => {
    setReversed(key === sortBy ? !reversed : false);
    setSortBy(key);
  };
  const toggle = (id: string) =>
    setSelection((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const allSelected = selection.length === ORDERS.length;
  const selectedTotal = ORDERS.filter((o) => selection.includes(o.id)).reduce((sum, o) => sum + o.amount, 0);

  return (
    <Gallery>
      <SpecimenGrid cols={1}>
        <Specimen
          label="Orders table"
          align="start"
          note={
            <>
              <code>highlightOnHover</code>, header checkbox with <code>indeterminate</code>, sortable headers (click them),
              status badges, owner avatars with a <code>Tooltip</code>, right-aligned money and a row <code>Menu</code>. Like the shipped{' '}
              <code>VTable</code>, rows take no selected tint — selection shows in the default-size checkbox and the toolbar count.
            </>
          }
        >
          <Group justify="space-between" mih={30}>
            {selection.length > 0 ? (
              <>
                <Text size="sm">
                  <Text span fw={600}>
                    {selection.length} selected
                  </Text>{' '}
                  · {formatMoney(selectedTotal)}
                </Text>
                <Group gap="xs">
                  <Button size="xs" variant="default" leftSection={<IconDownload size={14} />}>
                    Export
                  </Button>
                  <Button size="xs" leftSection={<IconCheck size={14} />}>
                    Approve
                  </Button>
                </Group>
              </>
            ) : (
              <Text size="sm" c="dimmed">
                {ORDERS.length} purchase orders
              </Text>
            )}
          </Group>
          <Table.ScrollContainer minWidth={540}>
            <Table highlightOnHover verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th w={40}>
                    <Checkbox
                      aria-label="Select all orders"
                      checked={allSelected}
                      indeterminate={selection.length > 0 && !allSelected}
                      onChange={() => setSelection(allSelected ? [] : ORDERS.map((o) => o.id))}
                    />
                  </Table.Th>
                  <SortableTh active={sortBy === 'number'} reversed={reversed} onSort={() => sort('number')}>
                    Order
                  </SortableTh>
                  <Table.Th w={64}>Owner</Table.Th>
                  <SortableTh active={sortBy === 'amount'} reversed={reversed} onSort={() => sort('amount')} align="right">
                    Amount
                  </SortableTh>
                  <SortableTh active={sortBy === 'status'} reversed={reversed} onSort={() => sort('status')}>
                    Status
                  </SortableTh>
                  <Table.Th w={44}>
                    <VisuallyHidden>Actions</VisuallyHidden>
                  </Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rows.map((o) => {
                  const selected = selection.includes(o.id);
                  return (
                    <Table.Tr key={o.id} aria-selected={selected}>
                      <Table.Td>
                        <Checkbox aria-label={`Select ${o.number}`} checked={selected} onChange={() => toggle(o.id)} />
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" fw={500}>
                          {o.supplier}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {o.number} · {o.category}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Tooltip label={o.owner.name}>
                          <Avatar size={28} color="primary" aria-label={o.owner.name}>
                            {o.owner.initials}
                          </Avatar>
                        </Tooltip>
                      </Table.Td>
                      <Table.Td ta="right" ff="monospace" fz="sm">
                        {formatMoney(o.amount)}
                      </Table.Td>
                      <Table.Td>
                        <Badge color={ORDER_STATUS[o.status].color}>{ORDER_STATUS[o.status].label}</Badge>
                      </Table.Td>
                      <Table.Td>
                        <RowMenu order={o} />
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

/** Table appearance props, toggled live. */
export function TableOptions() {
  const [striped, setStriped] = useState(true);
  const [hover, setHover] = useState(true);
  const [columnBorders, setColumnBorders] = useState(true);
  const [rowBorders, setRowBorders] = useState(true);
  const [density, setDensity] = useState('xs');
  return (
    <Gallery>
      <SpecimenGrid cols={1}>
        <Specimen
          label="Appearance props"
          align="start"
          note={
            <>
              <code>striped</code>, <code>highlightOnHover</code>, <code>withColumnBorders</code>, <code>withRowBorders</code> and{' '}
              <code>verticalSpacing</code>. Stripes use <code>gray-0</code> (<code>--ds-gray-50</code>), deliberately faint on a white card.{' '}
              <code>withTableBorder</code> is on by default in the theme.
            </>
          }
        >
          <Group justify="space-between" gap="md">
            <Group gap="md">
              <Switch size="xs" label="striped" checked={striped} onChange={(e) => setStriped(e.currentTarget.checked)} />
              <Switch size="xs" label="highlightOnHover" checked={hover} onChange={(e) => setHover(e.currentTarget.checked)} />
              <Switch size="xs" label="withColumnBorders" checked={columnBorders} onChange={(e) => setColumnBorders(e.currentTarget.checked)} />
              <Switch size="xs" label="withRowBorders" checked={rowBorders} onChange={(e) => setRowBorders(e.currentTarget.checked)} />
            </Group>
            <SegmentedControl
              size="xs"
              value={density}
              onChange={setDensity}
              aria-label="Row density"
              data={[
                { value: 'xs', label: 'Compact' },
                { value: 'sm', label: 'Default' },
                { value: 'md', label: 'Comfortable' },
              ]}
            />
          </Group>
          <Table
            striped={striped}
            highlightOnHover={hover}
            withColumnBorders={columnBorders}
            withRowBorders={rowBorders}
            verticalSpacing={density}
          >
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Team</Table.Th>
                <Table.Th>Role</Table.Th>
                <Table.Th>Last active</Table.Th>
                <Table.Th>Status</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {USERS.slice(0, 5).map((u) => (
                <Table.Tr key={u.id}>
                  <Table.Td fw={500}>{u.name}</Table.Td>
                  <Table.Td>{u.team}</Table.Td>
                  <Table.Td>{u.role}</Table.Td>
                  <Table.Td c="dimmed">{u.lastActive}</Table.Td>
                  <Table.Td>
                    <Badge variant="dot" color={USER_STATUS[u.status].color} size="sm">
                      {USER_STATUS[u.status].label}
                    </Badge>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

/** Sticky header in a ScrollArea, plus empty and loading states. */
export function TableStates() {
  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        <Specimen span="full" label="Sticky header" align="start" note={<><code>stickyHeader</code> inside a <code>ScrollArea h={'{240}'}</code> — scroll the rows; the header stays pinned over them.</>}>
          <ScrollArea h={240} type="auto" offsetScrollbars>
            <Table stickyHeader highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Order</Table.Th>
                  <Table.Th>Supplier</Table.Th>
                  <Table.Th>Updated</Table.Th>
                  <Table.Th>Due</Table.Th>
                  <Table.Th ta="right">Amount</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {[...ORDERS, ...ORDERS.slice(0, 3).map((o) => ({ ...o, id: `${o.id}-b`, number: o.number.replace('PO-20', 'PO-19') }))].map((o) => (
                  <Table.Tr key={o.id}>
                    <Table.Td ff="monospace" fz="sm">
                      {o.number}
                    </Table.Td>
                    <Table.Td>{o.supplier}</Table.Td>
                    <Table.Td c="dimmed">{o.updated}</Table.Td>
                    <Table.Td>{o.due}</Table.Td>
                    <Table.Td ta="right" ff="monospace" fz="sm">
                      {formatMoney(o.amount)}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Specimen>
        <Specimen label="Empty" align="start" note={<>One <code>Table.Td colSpan</code> row with a ThemeIcon, a reason and a way out.</>}>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Order</Table.Th>
                <Table.Th>Supplier</Table.Th>
                <Table.Th>Status</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              <Table.Tr>
                <Table.Td colSpan={3}>
                  <Stack align="center" gap={6} py="lg">
                    <ThemeIcon variant="light" color="gray" size="xl" radius={1000}>
                      <IconInbox size={22} />
                    </ThemeIcon>
                    <Text size="sm" fw={600}>
                      No orders match these filters
                    </Text>
                    <Text size="xs" c="dimmed" ta="center">
                      Try a different status or date range.
                    </Text>
                    <Button size="xs" variant="default" mt={4}>
                      Clear filters
                    </Button>
                  </Stack>
                </Table.Td>
              </Table.Tr>
            </Table.Tbody>
          </Table>
        </Specimen>
        <Specimen label="Loading" align="start" note={<><code>Skeleton</code> bars in each cell keep the column rhythm while data loads.</>}>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Order</Table.Th>
                <Table.Th>Supplier</Table.Th>
                <Table.Th>Status</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {[0, 1, 2, 3, 4].map((i) => (
                <Table.Tr key={i}>
                  <Table.Td>
                    <Skeleton h={10} w={56} radius="xl" />
                  </Table.Td>
                  <Table.Td>
                    <Skeleton h={10} w={`${70 - i * 8}%`} radius="xl" />
                  </Table.Td>
                  <Table.Td>
                    <Skeleton h={18} w={64} radius="xl" />
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

/** Table rendered from the `data` prop. */
export function TableDataProp() {
  const byCategory = Object.values(
    ORDERS.filter((o) => o.status !== 'cancelled').reduce<Record<string, { category: string; count: number; spend: number }>>(
      (acc, o) => {
        const row = (acc[o.category] ??= { category: o.category, count: 0, spend: 0 });
        row.count += 1;
        row.spend += o.amount;
        return acc;
      },
      {},
    ),
  ).sort((a, b) => b.spend - a.spend);

  return (
    <Gallery>
      <SpecimenGrid cols={1}>
        <Specimen
          label="data prop"
          align="start"
          note={
            <>
              <code>{'<Table data={{ caption, head, body }} />'}</code> — the quickest read-only table; cells accept any React node.
            </>
          }
        >
          <Table
            captionSide="bottom"
            data={{
              caption: 'Open spend by category, October (cancelled orders excluded)',
              head: ['Category', 'Orders', 'Spend'],
              body: byCategory.map((r) => [
                r.category,
                r.count,
                <NumberFormatter key={r.category} value={r.spend} prefix="$" thousandSeparator />,
              ]),
            }}
          />
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

/* ── Accordion ─────────────────────────────────────────────── */

const ACCORDION_ITEMS = [
  {
    value: 'delivery',
    icon: IconTruckDelivery,
    title: 'Delivery address',
    body: 'Northwind DC2, Dock 4 — 18 Harbour Road, Rotterdam. Deliveries accepted 07:00–15:00 on weekdays.',
  },
  {
    value: 'billing',
    icon: IconFilePlus,
    title: 'Billing & tax',
    body: 'Invoices go to ap@northwind.io. VAT reverse charge applies; PO number must appear on every invoice.',
  },
  {
    value: 'approval',
    icon: IconShieldCheck,
    title: 'Approval chain',
    body: 'Team lead, then Finance for anything above $10,000. Approvers are notified in order.',
  },
];

function AccordionDemo({ variant }: { variant: 'default' | 'contained' | 'separated' | 'filled' }) {
  return (
    <Accordion variant={variant} defaultValue="delivery" w="100%">
      {ACCORDION_ITEMS.map((item) => {
        const ItemIcon = item.icon;
        return (
          <Accordion.Item key={item.value} value={item.value}>
            <Accordion.Control icon={<ItemIcon size={16} />}>{item.title}</Accordion.Control>
            <Accordion.Panel>
              <Text size="sm" c="dimmed">
                {item.body}
              </Text>
            </Accordion.Panel>
          </Accordion.Item>
        );
      })}
    </Accordion>
  );
}

/** The four Accordion variants. */
export function AccordionShowcase() {
  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        <Specimen label="default" align="start" note="Hairline dividers between items — for settings and FAQ lists inside a card.">
          <AccordionDemo variant="default" />
        </Specimen>
        <Specimen label="contained" align="start" note="One bordered block; the open item gets a muted surface.">
          <AccordionDemo variant="contained" />
        </Specimen>
        <Specimen label="separated" align="start" note="Each item is its own rounded panel on a gray surface.">
          <AccordionDemo variant="separated" />
        </Specimen>
        <Specimen label="filled" align="start" note="Only the open item is filled — the lightest-weight option.">
          <AccordionDemo variant="filled" />
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

/* ── Timeline ──────────────────────────────────────────────── */

/** Order history and an activity feed as Timelines. */
export function TimelineShowcase() {
  const order = ORDERS[1];
  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        <Specimen label="Order history" align="start" note={<><code>active={'{2}'}</code> colours completed steps ember; upcoming steps use <code>lineVariant=&quot;dashed&quot;</code>.</>}>
          <Timeline active={2} bulletSize={24} lineWidth={2}>
            <Timeline.Item bullet={<IconFilePlus size={13} />} title="Draft created">
              <Text size="xs" c="dimmed">
                {USERS[1].name} · 24 Oct, 14:02
              </Text>
            </Timeline.Item>
            <Timeline.Item bullet={<IconSend size={13} />} title="Submitted for approval">
              <Text size="xs" c="dimmed">
                {USERS[1].name} · 27 Oct, 10:18
              </Text>
            </Timeline.Item>
            <Timeline.Item bullet={<IconCheck size={13} />} title="Approved by Finance" lineVariant="dashed">
              <Text size="xs" c="dimmed">
                {USERS[2].name} · {order.updated}
              </Text>
              <Text size="sm" mt={4}>
                “Within Q4 freight budget.”
              </Text>
            </Timeline.Item>
            <Timeline.Item bullet={<IconTruckDelivery size={13} />} title="Awaiting shipment" lineVariant="dashed">
              <Text size="xs" c="dimmed">
                Due {order.due}
              </Text>
            </Timeline.Item>
            <Timeline.Item bullet={<IconPackage size={13} />} title="Delivered">
              <Text size="xs" c="dimmed">
                —
              </Text>
            </Timeline.Item>
          </Timeline>
        </Specimen>
        <Specimen label="Activity feed" align="start" note={<>Avatars as bullets, <code>active={'{-1}'}</code> so no step reads as “current”.</>}>
          <Timeline active={-1} bulletSize={28} lineWidth={1}>
            {ACTIVITY.map((a) => (
              <Timeline.Item
                key={a.id}
                bullet={
                  <Avatar size={26} color="primary">
                    {a.user.initials}
                  </Avatar>
                }
              >
                <Text size="sm">
                  <Text span fw={600}>
                    {a.user.name}
                  </Text>{' '}
                  {a.action} <Text span fw={500}>{a.target}</Text>
                </Text>
                <Text size="xs" c="dimmed" mt={2}>
                  {a.time}
                </Text>
              </Timeline.Item>
            ))}
          </Timeline>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

/* ── Description list ──────────────────────────────────────── */

/** Key/value metadata for a record, in grid and row layouts. */
export function DescriptionListShowcase() {
  const order = ORDERS[1];
  const supplierRows: { term: string; value: ReactNode }[] = [
    { term: 'Legal name', value: 'Keystone Logistics B.V.' },
    { term: 'Contact', value: <Anchor href="#description-list" size="sm">ops@keystone-logistics.eu</Anchor> },
    { term: 'Payment terms', value: 'Net 30' },
    { term: 'Categories', value: (
      <Group gap={6}>
        <Badge color="gray" size="sm">Freight</Badge>
        <Badge color="gray" size="sm">Customs</Badge>
      </Group>
    ) },
    { term: 'Risk rating', value: <Badge color="green" size="sm">Low</Badge> },
  ];

  return (
    <Gallery>
      <SpecimenGrid cols={1}>
        <Specimen label="Record metadata grid" align="start" note={<>A <code>&lt;dl&gt;</code> in a three-column grid — dimmed xs terms over medium-weight values. Mixed value types: badge, avatar, money, code with <code>CopyButton</code>.</>}>
          <Card>
            <Group justify="space-between" mb="lg" wrap="nowrap">
              <div>
                <Text size="xs" c="dimmed" fw={500}>
                  {order.number}
                </Text>
                <Title order={4}>{order.supplier}</Title>
              </div>
              <Badge color={ORDER_STATUS[order.status].color}>{ORDER_STATUS[order.status].label}</Badge>
            </Group>
            <dl className={styles.dlGrid}>
              <MetaItem term="Amount">
                <NumberFormatter value={order.amount} prefix="$" thousandSeparator decimalScale={2} fixedDecimalScale />
              </MetaItem>
              <MetaItem term="Owner">
                <Group gap={6} wrap="nowrap">
                  <Avatar size={20} color="primary">
                    {order.owner.initials}
                  </Avatar>
                  {order.owner.name}
                </Group>
              </MetaItem>
              <MetaItem term="Category">{order.category}</MetaItem>
              <MetaItem term="Due">{order.due} 2026</MetaItem>
              <MetaItem term="Last updated">{order.updated}</MetaItem>
              <MetaItem term="Reference">
                <Group gap={4} wrap="nowrap">
                  <Code>ord_8f3k2m1x</Code>
                  <CopyButton value="ord_8f3k2m1x">
                    {({ copied, copy }) => (
                      <Tooltip label={copied ? 'Copied' : 'Copy reference'}>
                        <ActionIcon variant="subtle" color={copied ? 'green' : 'gray'} size="sm" onClick={copy} aria-label="Copy reference">
                          {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </CopyButton>
                </Group>
              </MetaItem>
            </dl>
          </Card>
        </Specimen>
        <Specimen label="Label / value rows" align="start" note={<>Terms in a fixed 132px column, rows split by <code>--ds-divider</code> — the side panel of a record detail page.</>}>
          <Paper withBorder p="lg">
            <Text fw={600} mb="md">
              Supplier
            </Text>
            <dl className={styles.dlRows}>
              {supplierRows.map((row) => (
                <RowItem key={row.term} term={row.term}>
                  {row.value}
                </RowItem>
              ))}
            </dl>
          </Paper>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

function MetaItem({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div>
      <Text component="dt" size="xs" c="dimmed">
        {term}
      </Text>
      <Text component="dd" size="sm" fw={500}>
        {children}
      </Text>
    </div>
  );
}

function RowItem({ term, children }: { term: string; children: ReactNode }) {
  return (
    <>
      <Text component="dt" size="sm" c="dimmed">
        {term}
      </Text>
      <Text component="dd" size="sm" fw={500}>
        {children}
      </Text>
    </>
  );
}

/* ── List ──────────────────────────────────────────────────── */

/** Lists with ThemeIcon bullets, per-item icons and ordered steps. */
export function ListShowcase() {
  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        <Specimen label="ThemeIcon bullets" note={<><code>icon</code> on <code>List</code> sets every bullet; <code>List.Item icon</code> overrides one — here the pending check.</>}>
          <List
            spacing="sm"
            size="sm"
            center
            icon={
              <ThemeIcon color="green" size={20} radius="xl">
                <IconCheck size={12} />
              </ThemeIcon>
            }
          >
            <List.Item>Approved vendor</List.Item>
            <List.Item>Budget headroom</List.Item>
            <List.Item>Quote under 30 days old</List.Item>
            <List.Item
              icon={
                <ThemeIcon color="gray" variant="light" size={20} radius="xl">
                  <IconClock size={12} />
                </ThemeIcon>
              }
            >
              <Text span size="sm" c="dimmed">
                Finance sign-off
              </Text>
            </List.Item>
          </List>
        </Specimen>
        <Specimen label="Ordered & unordered" note={<><code>type=&quot;ordered&quot;</code> for sequences; nested lists use <code>withPadding</code>. Pass <code>listStyleType</code> when a CSS reset strips markers.</>}>
          <Group align="flex-start" gap="xl" grow>
            <List type="ordered" listStyleType="decimal" size="sm" spacing="xs">
              <List.Item>Draft</List.Item>
              <List.Item>Attach quote</List.Item>
              <List.Item>Submit</List.Item>
              <List.Item>Receive</List.Item>
            </List>
            <List size="sm" spacing="xs" listStyleType="disc">
              <List.Item>Packaging</List.Item>
              <List.Item>
                Freight
                <List withPadding size="sm" listStyleType="circle">
                  <List.Item>Road</List.Item>
                  <List.Item>Sea</List.Item>
                </List>
              </List.Item>
              <List.Item>Facilities</List.Item>
            </List>
          </Group>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

/* ── Code & Kbd ────────────────────────────────────────────── */

const ORDER_JSON = `{
  "id": "ord_8f3k2m1x",
  "number": "PO-2040",
  "supplier": "Keystone Logistics",
  "status": "approved",
  "amount": 48200,
  "currency": "USD"
}`;

/** Inline and block Code, and Kbd shortcuts. */
export function CodeKbdShowcase() {
  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        <Specimen label="Kbd" note={<>Keyboard hints in menus, tooltips and the command palette. <code>size</code> xs – xl.</>}>
          <Stack gap="sm">
            <Group gap="xs">
              <Text size="sm" w={120}>
                Search
              </Text>
              <Kbd>⌘</Kbd>
              <Text size="xs" c="dimmed">
                +
              </Text>
              <Kbd>K</Kbd>
            </Group>
            <Group gap="xs">
              <Text size="sm" w={120}>
                Save record
              </Text>
              <Kbd>Ctrl</Kbd>
              <Text size="xs" c="dimmed">
                +
              </Text>
              <Kbd>S</Kbd>
            </Group>
            <Group gap="xs">
              <Text size="sm" w={120}>
                Shortcuts
              </Text>
              <Kbd>Shift</Kbd>
              <Text size="xs" c="dimmed">
                +
              </Text>
              <Kbd>?</Kbd>
            </Group>
            <Group gap="xs" mt="xs" align="center">
              {SIZES.map((s) => (
                <Kbd key={s} size={s}>
                  Esc
                </Kbd>
              ))}
            </Group>
          </Stack>
        </Specimen>
        <Specimen label="Inline Code" note={<><code>Code</code> sets JetBrains Mono on a gray tint — ids, field keys and API values inside prose.</>}>
          <Text size="sm">
            The <Code>status</Code> field moves from <Code>pending</Code> to <Code>approved</Code> when the last approver signs.
            Reference <Code>ord_8f3k2m1x</Code> in support tickets.
          </Text>
        </Specimen>
        <Specimen label="Code block" span="full" align="start" note={<><code>block</code> renders a pre — API payloads, webhook samples and config snippets.</>}>
          <Code block>{ORDER_JSON}</Code>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

/* ── NumberFormatter ───────────────────────────────────────── */

/** NumberFormatter presets for money, percentages, units and locales. */
export function NumberFormatterShowcase() {
  const rows: { label: string; props: string; value: ReactNode }[] = [
    { label: 'Currency', props: 'prefix="$" thousandSeparator', value: <NumberFormatter value={48200} prefix="$" thousandSeparator /> },
    {
      label: 'Cents',
      props: 'decimalScale={2} fixedDecimalScale',
      value: <NumberFormatter value={7425.5} prefix="$" thousandSeparator decimalScale={2} fixedDecimalScale />,
    },
    { label: 'Percentage', props: 'suffix="%" decimalScale={1}', value: <NumberFormatter value={79.3046} suffix="%" decimalScale={1} /> },
    { label: 'Units', props: 'suffix=" pcs" thousandSeparator', value: <NumberFormatter value={12500} suffix=" pcs" thousandSeparator /> },
    {
      label: 'European',
      props: 'thousandSeparator="." decimalSeparator=","',
      value: <NumberFormatter value={21600.75} prefix="€ " thousandSeparator="." decimalSeparator="," decimalScale={2} />,
    },
    { label: 'Negative', props: 'value={-1250} prefix="$"', value: <NumberFormatter value={-1250} prefix="$" thousandSeparator /> },
  ];
  return (
    <Gallery>
      <SpecimenGrid cols={1}>
        <Specimen label="Formats" align="start" note={<><code>NumberFormatter</code> renders text only — pair it with tabular figures (<code>ff=&quot;monospace&quot;</code>) when values stack in a column.</>}>
          <Table verticalSpacing="xs" withTableBorder={false}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Use</Table.Th>
                <Table.Th>Props</Table.Th>
                <Table.Th ta="right">Output</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((r) => (
                <Table.Tr key={r.label}>
                  <Table.Td fw={500}>{r.label}</Table.Td>
                  <Table.Td>
                    <Code>{r.props}</Code>
                  </Table.Td>
                  <Table.Td ta="right" ff="monospace" fz="sm">
                    {r.value}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

/* ── ColorSwatch ───────────────────────────────────────────── */

/** ColorSwatch as a label-colour picker, plus sizes and radius. */
export function ColorSwatchShowcase() {
  const [tag, setTag] = useState('primary');
  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        <Specimen label="Label colour picker" note={<><code>component=&quot;button&quot;</code> swatches filled with <code>--mantine-color-*-filled</code>, so they follow the dark-mode remap. Click one.</>}>
          <Stack gap="sm">
            <Group gap="xs" role="radiogroup" aria-label="Label colour">
              {SEMANTIC.map((s) => (
                <ColorSwatch
                  key={s.name}
                  component="button"
                  type="button"
                  role="radio"
                  aria-checked={tag === s.color}
                  aria-label={s.name}
                  color={`var(--mantine-color-${s.color}-filled)`}
                  onClick={() => setTag(s.color)}
                  style={{ cursor: 'pointer' }}
                >
                  {tag === s.color && <IconCheck size={14} color="var(--mantine-color-white)" />}
                </ColorSwatch>
              ))}
            </Group>
            <Group gap="xs">
              <Text size="sm" c="dimmed">
                Preview
              </Text>
              <Badge color={tag}>Urgent</Badge>
            </Group>
          </Stack>
        </Specimen>
        <Specimen label="Sizes & radius" note={<><code>size</code> in px; <code>radius</code> from the theme scale; <code>withShadow</code> (default) adds an inner ring for light colours.</>}>
          <Stack gap="sm">
            <Group gap="sm" align="center">
              {[14, 20, 28, 36].map((size) => (
                <ColorSwatch key={size} size={size} color="var(--mantine-color-primary-filled)" />
              ))}
            </Group>
            <Group gap="sm">
              {(['xs', 'sm', 'md', 'lg'] as const).map((r) => (
                <ColorSwatch key={r} size={28} radius={r} color="var(--mantine-color-blue-filled)" />
              ))}
              <ColorSwatch size={28} color="var(--ds-gray-100)" />
              <ColorSwatch size={28} color="var(--ds-gray-100)" withShadow={false} />
            </Group>
          </Stack>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

/* ── Spoiler ───────────────────────────────────────────────── */

/** Spoiler collapsing long supplier notes. */
export function SpoilerShowcase() {
  return (
    <Gallery>
      <SpecimenGrid cols={1}>
        <Specimen label="Spoiler" align="start" note={<><code>maxHeight</code> clips long text with a <code>showLabel</code> / <code>hideLabel</code> toggle (styled as a link, <code>--ds-accent-text</code>).</>}>
          <Spoiler maxHeight={56} showLabel="Show more" hideLabel="Show less">
            <Text size="sm">
              Keystone has handled our Rotterdam inbound freight since 2023. Pickups must be booked 48 hours ahead through
              their portal; same-day collection is available for an additional fee and needs approval from the Fulfilment
              lead. Customs paperwork is prepared by Keystone, but HS codes must be confirmed by us on every order.
            </Text>
            <Text size="sm" mt="sm">
              Damaged pallets are reported within 24 hours of delivery with photos attached to the order. Credit notes
              usually arrive within 10 working days and should be matched against the original PO in Finance.
            </Text>
          </Spoiler>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

/* ── Image ─────────────────────────────────────────────────── */

/** Image with radius and fit, and a token-built placeholder for missing media. */
export function ImageShowcase() {
  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        <Specimen label="Image" align="start" note={<><code>radius=&quot;md&quot;</code>, a fixed <code>h</code> and <code>fit=&quot;cover&quot;</code> keep attachment thumbnails a consistent size.</>}>
          <Stack gap={6}>
            <Image src="/docs/forms-builder.png" alt="Form builder screen" radius="md" h={160} fit="cover" style={{ objectPosition: 'left top' }} />
            <Text size="xs" c="dimmed">
              intake-form-draft.png · 412 KB
            </Text>
          </Stack>
        </Specimen>
        <Specimen label="Placeholder" align="start" note={<>No media yet: an <code>AspectRatio</code> box on <code>--ds-gray-50</code> with a dashed <code>--ds-gray-300</code> border.</>}>
          <Stack gap={6}>
            <AspectRatio ratio={16 / 9}>
              <div className={styles.placeholder}>
                <IconPhoto size={28} stroke={1.5} />
                No preview available
              </div>
            </AspectRatio>
            <Text size="xs" c="dimmed">
              packing-list.pdf · 88 KB
            </Text>
          </Stack>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}
