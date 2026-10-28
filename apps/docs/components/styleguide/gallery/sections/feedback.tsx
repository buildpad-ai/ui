'use client';

import {
  ActionIcon,
  Alert,
  Anchor,
  Avatar,
  Badge,
  Button,
  type ButtonProps,
  Card,
  ColorSwatch,
  Group,
  Loader,
  LoadingOverlay,
  Notification,
  NumberInput,
  Progress,
  RingProgress,
  SemiCircleProgress,
  Skeleton,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  IconAlertOctagon,
  IconAlertTriangle,
  IconArrowRight,
  IconCheck,
  IconCircleCheck,
  IconDeviceFloppy,
  IconInfoCircle,
  IconRefresh,
  IconX,
  type Icon,
} from '@tabler/icons-react';
import { useEffect, useRef, useState } from 'react';
import { Gallery } from '../Gallery';
import { Specimen, SpecimenGrid } from '../Layout';
import { ORDERS, ORDER_STATUS, USERS, formatMoney } from '../data';
import styles from './feedback.module.css';

interface Semantic {
  color: 'blue' | 'green' | 'yellow' | 'red';
  name: string;
  icon: Icon;
  title: string;
  message: string;
  toastTitle: string;
  toast: string;
}

const SEMANTIC: Semantic[] = [
  {
    color: 'blue',
    name: 'Info',
    icon: IconInfoCircle,
    title: 'Approval workflow updated',
    message: 'Orders above $25,000 now need a second approver from Finance.',
    toastTitle: 'New comment',
    toast: 'Priya Raman commented on PO-2038.',
  },
  {
    color: 'green',
    name: 'Success',
    icon: IconCircleCheck,
    title: 'PO-2040 approved',
    message: 'Keystone Logistics was notified and the order moved to fulfilment.',
    toastTitle: 'PO-2040 approved',
    toast: 'Keystone Logistics has been notified.',
  },
  {
    color: 'yellow',
    name: 'Warning',
    icon: IconAlertTriangle,
    title: 'Budget at 79%',
    message: 'Spend this month is $412,380 of the $520k operations budget.',
    toastTitle: 'Budget at 79%',
    toast: '$412,380 of $520k spent this month.',
  },
  {
    color: 'red',
    name: 'Danger',
    icon: IconAlertOctagon,
    title: 'ERP sync failed',
    message: '3 orders could not be exported. Check the connection and retry.',
    toastTitle: 'ERP sync failed',
    toast: '3 orders could not be exported.',
  },
];

/** Alert in the four semantic colours, light variant, with title, icon and close button. */
export function AlertSemantic() {
  const [dismissed, setDismissed] = useState<string[]>([]);
  const visible = SEMANTIC.filter((s) => !dismissed.includes(s.color));
  return (
    <Gallery>
      <SpecimenGrid cols={1}>
        <Specimen
          label="Semantic colours · variant light (default)"
          note={
            <>
              <code>color=&quot;blue | green | yellow | red&quot;</code> resolve to the info /
              success / warning / danger scales; light tints the 50 stop and promotes text to the
              700 stop. <code>withCloseButton</code> dismisses — try it.
            </>
          }
        >
          <Stack gap="sm">
            {visible.map(({ color, icon: AlertIcon, title, message, name }) => (
              <Alert
                key={color}
                color={color}
                title={title}
                icon={<AlertIcon size={18} />}
                withCloseButton
                closeButtonLabel={`Dismiss ${name.toLowerCase()} alert`}
                onClose={() => setDismissed((d) => [...d, color])}
              >
                {message}
              </Alert>
            ))}
            {visible.length < SEMANTIC.length && (
              <Group justify="center">
                <Button
                  variant="subtle"
                  size="xs"
                  leftSection={<IconRefresh size={14} />}
                  onClick={() => setDismissed([])}
                >
                  Restore alerts
                </Button>
              </Group>
            )}
          </Stack>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

const ALERT_VARIANTS = [
  { variant: 'filled', note: 'Solid main stop with white text — reserve for the one message that must not be missed.' },
  { variant: 'outline', note: 'Coloured border and 700-stop text on the card surface.' },
  { variant: 'default', note: 'Neutral surface, border and ink text — colour drops out, so the icon carries the meaning.' },
  { variant: 'transparent', note: 'No surface at all — for inline hints inside cards and forms.' },
] as const;

/** Alert's filled / outline / default / transparent variants across the semantic colours. */
export function AlertVariants() {
  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        {ALERT_VARIANTS.map(({ variant, note }) => (
          <Specimen
            key={variant}
            label={`variant="${variant}"`}
            note={note}
            align="start"
          >
            <Stack gap="xs">
              {SEMANTIC.map(({ color, icon: AlertIcon, title }) => (
                <Alert
                  key={color}
                  variant={variant}
                  color={color}
                  title={title}
                  icon={<AlertIcon size={18} />}
                />
              ))}
            </Stack>
          </Specimen>
        ))}
        <Specimen
          label="Message only"
          note="Without a title the body text sits beside the icon — the compact form for in-form hints."
          span="full"
        >
          <Stack gap="xs">
            <Alert color="blue" icon={<IconInfoCircle size={18} />}>
              Supplier changes are reviewed by Procurement before they go live.
            </Alert>
            <Alert color="red" variant="outline" icon={<IconAlertOctagon size={18} />}>
              This order is locked because an approver has already signed it off.
            </Alert>
          </Stack>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

const NOTIFICATION_ICONS: Record<Semantic['color'], Icon> = {
  blue: IconInfoCircle,
  green: IconCheck,
  yellow: IconAlertTriangle,
  red: IconX,
};

const SHIPPED_VARIANT: Record<Semantic['color'], string> = {
  blue: 'info',
  green: 'success',
  yellow: 'warning',
  red: 'error',
};

/** Static Notification in every colour, with icon, loading, border and no-close states. */
export function NotificationVariants() {
  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        <Specimen
          label="Colour bar"
          note={
            <>
              Default form: a 6px bar in <code>color</code>, title and message, close button.
              Shadow is <code>--ds-shadow-lg</code>.
            </>
          }
          align="start"
        >
          <Stack gap="sm">
            {SEMANTIC.map(({ color, name, toastTitle, toast }) => (
              <Notification
                key={color}
                color={color}
                title={toastTitle}
                closeButtonProps={{ 'aria-label': `Dismiss ${name.toLowerCase()} notification` }}
              >
                {toast}
              </Notification>
            ))}
          </Stack>
        </Specimen>
        <Specimen
          label="With icon"
          note={
            <>
              <code>icon</code> replaces the bar with a filled circle in the same colour.
            </>
          }
          align="start"
        >
          <Stack gap="sm">
            {SEMANTIC.map(({ color, name, toastTitle, toast }) => {
              const NotifIcon = NOTIFICATION_ICONS[color];
              return (
                <Notification
                  key={color}
                  color={color}
                  title={toastTitle}
                  icon={<NotifIcon size={16} />}
                  closeButtonProps={{ 'aria-label': `Dismiss ${name.toLowerCase()} notification` }}
                >
                  {toast}
                </Notification>
              );
            })}
          </Stack>
        </Specimen>
        <Specimen
          label="withBorder + shipped variants"
          note={
            <>
              <code>withBorder</code> adds a hairline; the shipped globals.css colours its left edge
              for <code>variant=&quot;success | error | warning | info&quot;</code>.
            </>
          }
          align="start"
        >
          <Stack gap="sm">
            {SEMANTIC.map(({ color, name }) => (
              <Notification
                key={color}
                withBorder
                color={color}
                variant={SHIPPED_VARIANT[color]}
                title={`variant="${SHIPPED_VARIANT[color]}"`}
                closeButtonProps={{ 'aria-label': `Dismiss ${name.toLowerCase()} notification` }}
              >
                Bordered {name.toLowerCase()} notification
              </Notification>
            ))}
          </Stack>
        </Specimen>
        <Specimen
          label="Loading & persistent"
          note={
            <>
              <code>loading</code> swaps the bar for a Loader; <code>withCloseButton=&#123;false&#125;</code>{' '}
              for notifications the user cannot dismiss.
            </>
          }
          align="start"
        >
          <Stack gap="sm">
            <Notification loading withCloseButton={false} title="Exporting 128 orders">
              Preparing your CSV — this can take a minute.
            </Notification>
            <Notification loading withBorder withCloseButton={false} title="Uploading invoice.pdf">
              2.4 MB of 3.1 MB
            </Notification>
            <Notification
              color="green"
              icon={<IconCheck size={16} />}
              withCloseButton={false}
              title="All changes saved"
            />
          </Stack>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

interface Toast {
  id: number;
  color: Semantic['color'] | undefined;
  title: string;
  message: string;
  icon?: Icon;
  loading?: boolean;
}

const INITIAL_TOASTS: Toast[] = [
  { id: 1, color: 'green', icon: IconCheck, title: 'PO-2040 approved', message: 'Keystone Logistics has been notified.' },
  { id: 2, color: undefined, loading: true, title: 'Uploading invoice.pdf', message: '2.4 MB of 3.1 MB' },
  { id: 3, color: 'red', icon: IconX, title: 'ERP sync failed', message: '3 orders could not be exported.' },
];

const NEW_TOASTS: Omit<Toast, 'id'>[] = [
  { color: 'green', icon: IconCheck, title: 'Order saved', message: 'PO-2041 · Atlas Packaging was updated.' },
  { color: 'blue', icon: IconInfoCircle, title: 'New comment', message: 'Priya Raman commented on PO-2038.' },
  { color: 'yellow', icon: IconAlertTriangle, title: 'Delivery overdue', message: 'PO-2038 · Meridian Foods is 1 day late.' },
];

/**
 * A top-right toast stack composed from static Notifications (the core
 * package has no notifications manager), over a sample page.
 */
export function ToastStack() {
  const [toasts, setToasts] = useState<Toast[]>(INITIAL_TOASTS);
  const next = useRef(0);
  const nextId = useRef(INITIAL_TOASTS.length + 1);

  const push = () => {
    const toast = { ...NEW_TOASTS[next.current % NEW_TOASTS.length], id: nextId.current };
    next.current += 1;
    nextId.current += 1;
    setToasts((current) => [toast, ...current].slice(0, 4));
  };

  return (
    <Gallery>
      <SpecimenGrid cols={1}>
        <Specimen
          label="Toast stack"
          note={
            <>
              Static <code>Notification</code>s stacked top-right, 340px wide, newest first, max
              four. <code>@mantine/notifications</code> is not part of the kit — this is the
              composed equivalent.
            </>
          }
          surface="muted"
        >
          <div className={styles.toastViewport}>
            <Card withBorder className={styles.toastPage}>
              <Title order={4} mb="md">
                Purchase orders
              </Title>
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Order</Table.Th>
                    <Table.Th>Supplier</Table.Th>
                    <Table.Th>Status</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {ORDERS.slice(0, 5).map((order) => (
                    <Table.Tr key={order.id}>
                      <Table.Td>{order.number}</Table.Td>
                      <Table.Td>{order.supplier}</Table.Td>
                      <Table.Td>
                        <Badge color={ORDER_STATUS[order.status].color}>
                          {ORDER_STATUS[order.status].label}
                        </Badge>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Card>
            <div className={styles.toastStack} role="region" aria-label="Notifications">
              {toasts.map(({ id, color, title, message, icon: ToastIcon, loading }) => (
                <Notification
                  key={id}
                  color={color}
                  title={title}
                  loading={loading}
                  icon={ToastIcon ? <ToastIcon size={16} /> : undefined}
                  withBorder
                  withCloseButton={!loading}
                  closeButtonProps={{ 'aria-label': `Dismiss ${title}` }}
                  onClose={() => setToasts((current) => current.filter((t) => t.id !== id))}
                >
                  {message}
                </Notification>
              ))}
            </div>
          </div>
          <Group justify="center">
            <Button variant="default" size="xs" leftSection={<IconDeviceFloppy size={14} />} onClick={push}>
              Trigger a toast
            </Button>
          </Group>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

const SPEND_SECTIONS = [
  { label: 'Freight', value: 38, color: 'blue' },
  { label: 'Packaging', value: 22, color: 'primary' },
  { label: 'Software', value: 14, color: 'green' },
  { label: 'Facilities', value: 6, color: 'gray' },
] as const;

/** Progress sizes, colours, stacked sections, striped/animated and labelled. */
export function ProgressBars() {
  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        <Specimen
          label="Sizes"
          note={
            <>
              <code>size=&quot;xs&quot;</code> → <code>&quot;xl&quot;</code>. The fill is{' '}
              <code>primaryColor</code> — ember.
            </>
          }
        >
          <Stack gap="md">
            {(['xs', 'sm', 'md', 'lg', 'xl'] as const).map((size, i) => (
              <Group key={size} gap="sm" wrap="nowrap">
                <Text size="xs" c="dimmed" w={20}>
                  {size}
                </Text>
                <Progress size={size} value={30 + i * 14} className={styles.grow} aria-label={`Progress ${size}`} />
              </Group>
            ))}
          </Stack>
        </Specimen>
        <Specimen
          label="Semantic colours"
          note={
            <>
              <code>color=&quot;green | yellow | red | blue&quot;</code> for status meaning — healthy,
              nearing a limit, over it, informational.
            </>
          }
        >
          <Stack gap="md">
            {[
              { color: 'green', value: 92, label: 'On-time delivery' },
              { color: 'yellow', value: 79, label: 'Budget used' },
              { color: 'red', value: 100, label: 'Storage quota' },
              { color: 'blue', value: 45, label: 'Q4 sourcing plan' },
            ].map(({ color, value, label }) => (
              <div key={color}>
                <Group justify="space-between" mb={4}>
                  <Text size="xs" c="dimmed">
                    {label}
                  </Text>
                  <Text size="xs" fw={500}>
                    {value}%
                  </Text>
                </Group>
                <Progress color={color} value={value} aria-label={label} />
              </div>
            ))}
          </Stack>
        </Specimen>
        <Specimen
          label="Stacked sections"
          note={
            <>
              <code>Progress.Root</code> + <code>Progress.Section</code> with{' '}
              <code>Progress.Label</code>; legend uses <code>ColorSwatch</code>.
            </>
          }
        >
          <Stack gap="sm">
            <Group justify="space-between">
              <Text size="sm" fw={500}>
                Spend by category
              </Text>
              <Text size="xs" c="dimmed">
                80% of budget
              </Text>
            </Group>
            <Progress.Root size="xl">
              {SPEND_SECTIONS.map(({ label, value, color }) => (
                <Progress.Section key={label} value={value} color={color} aria-label={label}>
                  {value >= 10 && <Progress.Label>{value}%</Progress.Label>}
                </Progress.Section>
              ))}
            </Progress.Root>
            <Group gap="sm">
              {SPEND_SECTIONS.map(({ label, color }) => (
                <Group key={label} gap={6}>
                  <ColorSwatch size={10} color={`var(--mantine-color-${color}-filled)`} withShadow={false} />
                  <Text size="xs" c="dimmed">
                    {label}
                  </Text>
                </Group>
              ))}
            </Group>
          </Stack>
        </Specimen>
        <Specimen
          label="Striped, animated & labelled"
          note={
            <>
              <code>striped</code>, <code>animated</code> for work in flight; a label row above for
              the value and context.
            </>
          }
        >
          <Stack gap="md">
            <div>
              <Group justify="space-between" mb={6}>
                <Text size="sm" fw={500}>
                  Importing suppliers.csv
                </Text>
                <Text size="xs" c="dimmed">
                  1,240 / 2,000 rows
                </Text>
              </Group>
              <Progress value={62} size="lg" striped animated aria-label="Import progress" />
            </div>
            <div>
              <Group justify="space-between" mb={6}>
                <Text size="sm" fw={500}>
                  Approval progress
                </Text>
                <Text size="xs" fw={500}>
                  2 of 3
                </Text>
              </Group>
              <Progress value={66} striped aria-label="Approval progress" />
            </div>
          </Stack>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

/** RingProgress with centred labels and SemiCircleProgress. */
export function CircularProgress() {
  return (
    <Gallery>
      <SpecimenGrid cols={1}>
        <Specimen
          label="RingProgress"
          note={
            <>
              <code>sections</code> with a centred <code>label</code>; a ThemeIcon marks completion.
            </>
          }
        >
          <Group justify="center" gap="lg">
            <RingProgress
              size={110}
              thickness={10}
              roundCaps
              sections={[{ value: 66, color: 'primary' }]}
              label={
                <Text ta="center" fw={600} size="lg">
                  66%
                </Text>
              }
            />
            <RingProgress
              size={110}
              thickness={10}
              sections={SPEND_SECTIONS.map(({ value, color, label }) => ({ value, color, tooltip: `${label} · ${value}%` }))}
              label={
                <Stack gap={0} align="center">
                  <Text fw={600} size="md">
                    80%
                  </Text>
                  <Text size="xs" c="dimmed">
                    budget
                  </Text>
                </Stack>
              }
            />
            <RingProgress
              size={110}
              thickness={10}
              roundCaps
              sections={[{ value: 100, color: 'green' }]}
              label={
                <Group justify="center">
                  <ThemeIcon color="green" variant="light" radius="xl" size="xl" aria-label="Complete">
                    <IconCheck size={20} />
                  </ThemeIcon>
                </Group>
              }
            />
          </Group>
        </Specimen>
        <Specimen
          label="SemiCircleProgress"
          note={
            <>
              Gauge for a single ratio; <code>filledSegmentColor</code> follows the same semantic
              colours.
            </>
          }
        >
          <Group justify="center" gap="lg">
            <SemiCircleProgress
              size={150}
              thickness={12}
              value={79}
              filledSegmentColor="yellow"
              label="79% budget"
            />
            <SemiCircleProgress
              size={150}
              thickness={12}
              value={92}
              filledSegmentColor="green"
              label="92% on time"
            />
          </Group>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

/** Loader types, sizes and colours. */
export function Loaders() {
  return (
    <Gallery>
      <SpecimenGrid cols={1}>
        <Specimen
          label="Types"
          note={
            <>
              <code>type=&quot;oval&quot;</code> (default), <code>&quot;bars&quot;</code>,{' '}
              <code>&quot;dots&quot;</code>.
            </>
          }
        >
          <Group justify="center" gap="xl">
            {(['oval', 'bars', 'dots'] as const).map((type) => (
              <Stack key={type} gap="xs" align="center">
                <Loader type={type} aria-label={`Loading (${type})`} />
                <Text size="xs" c="dimmed">
                  {type}
                </Text>
              </Stack>
            ))}
          </Group>
        </Specimen>
        <Specimen
          label="Sizes"
          note={
            <>
              <code>size=&quot;xs&quot;</code> → <code>&quot;xl&quot;</code> (18–58px).
            </>
          }
        >
          <Group justify="center" gap="lg" align="flex-end">
            {(['xs', 'sm', 'md', 'lg', 'xl'] as const).map((size) => (
              <Stack key={size} gap="xs" align="center">
                <Loader size={size} aria-label={`Loading (${size})`} />
                <Text size="xs" c="dimmed">
                  {size}
                </Text>
              </Stack>
            ))}
          </Group>
        </Specimen>
        <Specimen
          label="Colours"
          note={
            <>
              Ember by default; <code>color=&quot;secondary&quot;</code> for ink, or a semantic hue.
            </>
          }
          span="full"
        >
          <Group justify="center" gap="xl">
            {[
              { color: undefined, label: 'primary' },
              { color: 'secondary', label: 'secondary' },
              { color: 'blue', label: 'blue' },
              { color: 'green', label: 'green' },
              { color: 'yellow', label: 'yellow' },
              { color: 'red', label: 'red' },
            ].map(({ color, label }) => (
              <Stack key={label} gap="xs" align="center">
                <Loader color={color} type="dots" aria-label={`Loading (${label})`} />
                <Text size="xs" c="dimmed">
                  {label}
                </Text>
              </Stack>
            ))}
          </Group>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

const LOADING_BUTTONS: Array<{ label: string; props: ButtonProps }> = [
  { label: 'Save', props: {} },
  { label: 'Publish', props: { color: 'primary' } },
  { label: 'Cancel', props: { variant: 'default' } },
  { label: 'Sync', props: { variant: 'light', loaderProps: { type: 'dots' } } },
];

/** Button and ActionIcon loading states, including a live save simulation. */
export function ButtonLoading() {
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!saving) return;
    const timer = window.setTimeout(() => setSaving(false), 1800);
    return () => window.clearTimeout(timer);
  }, [saving]);

  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        <Specimen
          label="loading"
          note={
            <>
              Idle → <code>loading</code>: keeps the button&apos;s width, swaps the label for a
              Loader and blocks clicks. <code>loaderProps</code> picks the loader type.
            </>
          }
        >
          <Stack gap="sm" align="center">
            {LOADING_BUTTONS.map(({ label, props }) => (
              <Group key={label} gap="sm" wrap="nowrap">
                <Button {...props}>{label}</Button>
                <IconArrowRight size={14} className={styles.dim} aria-hidden />
                <Button {...props} loading>
                  {label}
                </Button>
              </Group>
            ))}
            <Group gap="sm" wrap="nowrap">
              <ActionIcon variant="default" size="lg" aria-label="Refresh">
                <IconRefresh size={16} />
              </ActionIcon>
              <IconArrowRight size={14} className={styles.dim} aria-hidden />
              <ActionIcon variant="default" size="lg" loading aria-label="Refreshing">
                <IconRefresh size={16} />
              </ActionIcon>
            </Group>
          </Stack>
        </Specimen>
        <Specimen
          label="Live: save cycle"
          note="Click to run idle → loading → idle (1.8s); the button dims behind its loader and ignores clicks."
        >
          <Stack gap="sm" align="center">
            <Button
              loading={saving}
              leftSection={<IconDeviceFloppy size={16} />}
              onClick={() => setSaving(true)}
            >
              Save changes
            </Button>
            <Text size="xs" c="dimmed" aria-live="polite">
              {saving ? 'Saving…' : 'Idle'}
            </Text>
          </Stack>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

/** Skeleton placeholders: text lines, an avatar card and table rows, with a live toggle. */
export function Skeletons() {
  const [loaded, setLoaded] = useState(false);
  const user = USERS[2];
  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        <Specimen label="Text lines" note="Fixed-height bars; the last line runs short like a paragraph.">
          <Stack gap="xs">
            <Skeleton height={14} width="45%" />
            <Skeleton height={10} />
            <Skeleton height={10} />
            <Skeleton height={10} width="70%" />
          </Stack>
        </Specimen>
        <Specimen
          label="Avatar card"
          note={
            <>
              <code>visible</code> wraps the real content so the layout does not shift when data
              arrives — toggle it.
            </>
          }
        >
          <Card withBorder>
            <Group wrap="nowrap" align="flex-start">
              <Skeleton visible={!loaded} circle height={40} width={40}>
                <Avatar radius="xl" color="primary">
                  {user.initials}
                </Avatar>
              </Skeleton>
              <Stack gap={6} className={styles.grow}>
                <Skeleton visible={!loaded} width="60%">
                  <Text fw={500}>{user.name}</Text>
                </Skeleton>
                <Skeleton visible={!loaded} width="85%">
                  <Text size="sm" c="dimmed">
                    {user.role} · {user.team}
                  </Text>
                </Skeleton>
              </Stack>
            </Group>
          </Card>
          <Switch
            checked={loaded}
            onChange={(e) => setLoaded(e.currentTarget.checked)}
            label="Data loaded"
          />
        </Specimen>
        <Specimen
          label="Table rows"
          note="Real headers, skeleton cells — the table keeps its columns while rows load."
          span="full"
        >
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Order</Table.Th>
                <Table.Th>Supplier</Table.Th>
                <Table.Th>Owner</Table.Th>
                <Table.Th>Amount</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {[0, 1, 2, 3].map((row) => (
                <Table.Tr key={row}>
                  <Table.Td>
                    <Skeleton height={10} width={56} />
                  </Table.Td>
                  <Table.Td>
                    <Skeleton height={10} width={row % 2 ? '70%' : '85%'} />
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs" wrap="nowrap">
                      <Skeleton circle height={22} />
                      <Skeleton height={10} width={80} />
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Skeleton height={10} width={64} />
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

/** LoadingOverlay over a form card, toggled by a switch or by saving. */
export function LoadingOverlayDemo() {
  const [busy, setBusy] = useState(true);
  const order = ORDERS[0];
  return (
    <Gallery>
      <SpecimenGrid cols={1}>
        <Specimen
          label="LoadingOverlay"
          note={
            <>
              Covers its nearest positioned parent (<code>pos=&quot;relative&quot;</code>) and
              blocks input; <code>overlayProps=&#123;&#123; blur: 2 &#125;&#125;</code> softens the
              content behind.
            </>
          }
        >
          <Card withBorder pos="relative" className={styles.overlayCard}>
            <LoadingOverlay visible={busy} overlayProps={{ blur: 2 }} zIndex={2} />
            <Stack gap="md">
              <Group justify="space-between">
                <div>
                  <Text size="xs" c="dimmed" fw={500}>
                    {order.number}
                  </Text>
                  <Title order={4}>{order.supplier}</Title>
                </div>
                <Badge color={ORDER_STATUS[order.status].color}>
                  {ORDER_STATUS[order.status].label}
                </Badge>
              </Group>
              <Group grow>
                <TextInput label="Category" defaultValue={order.category} />
                <NumberInput label="Amount (USD)" defaultValue={order.amount} thousandSeparator="," />
              </Group>
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  Total {formatMoney(order.amount)}
                </Text>
                <Button onClick={() => setBusy(true)}>Save</Button>
              </Group>
            </Stack>
          </Card>
          <Group justify="center">
            <Switch
              checked={busy}
              onChange={(e) => setBusy(e.currentTarget.checked)}
              label="Show overlay"
            />
            <Anchor component="button" type="button" size="sm" onClick={() => setBusy(false)}>
              Finish loading
            </Anchor>
          </Group>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}
