'use client';

import {
  ActionIcon,
  Anchor,
  Badge,
  Button,
  Card,
  Code,
  CopyButton,
  Divider,
  Group,
  NavLink,
  Progress,
  SegmentedControl,
  Select,
  Switch,
  Table,
  Text,
  TextInput,
  Textarea,
  ThemeIcon,
  Title,
  Tooltip,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconBell,
  IconBrandApple,
  IconBrandWindows,
  IconCheck,
  IconCopy,
  IconCreditCard,
  IconDeviceMobile,
  IconKey,
  IconPalette,
  IconPlug,
  IconPlus,
  IconSettings,
  IconShieldLock,
  IconTrash,
  IconUpload,
  type Icon,
} from '@tabler/icons-react';
import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppShellFrame } from '../AppShellFrame';
import { Gallery } from '../Gallery';
import { BrowserFrame } from '../Layout';
import { APP, CURRENT_USER, USERS } from '../data';
import styles from './settings.module.css';

/* ── Page-specific mock data ─────────────────────────────────── */

type Section = 'general' | 'branding' | 'notifications' | 'security' | 'integrations' | 'billing' | 'danger';

const SECTIONS: Array<{ id: Section; label: string; icon: Icon }> = [
  { id: 'general', label: 'General', icon: IconSettings },
  { id: 'branding', label: 'Branding', icon: IconPalette },
  { id: 'notifications', label: 'Notifications', icon: IconBell },
  { id: 'security', label: 'Security', icon: IconShieldLock },
  { id: 'integrations', label: 'Integrations', icon: IconPlug },
  { id: 'billing', label: 'Billing', icon: IconCreditCard },
];

const SLUG = 'northwind';

const TIMEZONES = [
  { group: 'Asia', items: ['Singapore (GMT+8)', 'Tokyo (GMT+9)', 'Jakarta (GMT+7)'] },
  { group: 'Europe', items: ['London (GMT+0)', 'Berlin (GMT+1)'] },
  { group: 'Americas', items: ['New York (GMT−5)', 'Los Angeles (GMT−8)'] },
];

const LANGUAGES = ['English (US)', 'English (UK)', 'Deutsch', 'Bahasa Indonesia', '日本語'];

interface General {
  name: string;
  slug: string;
  description: string;
  timezone: string | null;
  language: string | null;
  dateFormat: string | null;
  weekStart: string;
}

const INITIAL_GENERAL: General = {
  name: APP.name,
  slug: SLUG,
  description: 'Purchasing and suppliers for the Northwind ops team.',
  timezone: 'Singapore (GMT+8)',
  language: 'English (US)',
  dateFormat: '28 Oct 2026',
  weekStart: 'Mon',
};

interface NotifyEvent {
  id: string;
  label: string;
  hint: string;
  email: boolean;
  inApp: boolean;
  /** Can't be turned off. */
  required?: boolean;
}

const NOTIFY_GROUPS: Array<{ group: string; events: NotifyEvent[] }> = [
  {
    group: 'Purchase orders',
    events: [
      { id: 'po-approval', label: 'Waiting for my approval', hint: 'An order reaches a step you approve.', email: true, inApp: true },
      { id: 'po-decided', label: 'Approved or rejected', hint: 'Orders you raised get a decision.', email: true, inApp: true },
      { id: 'po-comment', label: 'Comments and mentions', hint: 'Someone replies or @mentions you.', email: false, inApp: true },
      { id: 'po-overdue', label: 'Delivery overdue', hint: 'A delivery misses its due date.', email: true, inApp: false },
    ],
  },
  {
    group: 'Team',
    events: [
      { id: 'team-join', label: 'Member joins', hint: 'An invite is accepted.', email: false, inApp: true },
      { id: 'team-role', label: 'Role changes', hint: 'Someone’s permissions change.', email: false, inApp: false },
    ],
  },
  {
    group: 'Account',
    events: [
      { id: 'acct-security', label: 'Security alerts', hint: 'New sign-ins and key changes.', email: true, inApp: true, required: true },
      { id: 'acct-digest', label: 'Weekly digest', hint: 'Spend and approvals every Monday.', email: true, inApp: false },
    ],
  },
];

const SESSIONS: Array<{ id: string; device: string; icon: Icon; place: string; when: string; current?: boolean }> = [
  { id: 's1', device: 'Chrome on macOS', icon: IconBrandApple, place: 'Singapore · 203.0.113.24', when: 'Active now', current: true },
  { id: 's2', device: 'Safari on iPhone', icon: IconDeviceMobile, place: 'Singapore · 198.51.100.7', when: '2 hours ago' },
  { id: 's3', device: 'Edge on Windows', icon: IconBrandWindows, place: 'Jakarta · 192.0.2.140', when: '3 days ago' },
];

const API_KEYS = [
  { id: 'k1', name: 'Warehouse sync', key: 'bp_sk_test_••••••••3f9a', created: '12 Sep 2026', used: '4 min ago', scope: 'Read & write' },
  { id: 'k2', name: 'Finance export', key: 'bp_sk_test_••••••••a71c', created: '02 Aug 2026', used: 'Yesterday', scope: 'Read only' },
  { id: 'k3', name: 'Legacy ERP bridge', key: 'bp_sk_test_••••••••09de', created: '14 Mar 2026', used: '94 days ago', scope: 'Read only' },
];

/** Suspended members can't sign in, so they don't count towards 2FA enrolment. */
const MEMBERS = USERS.filter((u) => u.status !== 'suspended');
const NOT_ENROLLED = MEMBERS.filter((u) => u.status === 'invited');
const ENROLLED = MEMBERS.length - NOT_ENROLLED.length;

/* ── Shared pieces ───────────────────────────────────────────── */

function SettingsNav({ active }: { active: Section }) {
  return (
    <nav className={styles.nav} aria-label="Settings">
      <Text size="xs" fw={700} c="dimmed" px="sm" mb={6} className={styles.navLabel}>
        Workspace
      </Text>
      {SECTIONS.map((s) => {
        const NavIcon = s.icon;
        return (
          <NavLink
            key={s.id}
            href="#"
            onClick={(e) => e.preventDefault()}
            label={s.label}
            leftSection={<NavIcon size={18} stroke={1.8} />}
            active={s.id === active}
            aria-current={s.id === active ? 'page' : undefined}
          />
        );
      })}
      <Divider my="xs" />
      <NavLink
        href="#"
        onClick={(e) => e.preventDefault()}
        label="Danger zone"
        color="red"
        leftSection={<IconAlertTriangle size={18} stroke={1.8} />}
        active={active === 'danger'}
      />
    </nav>
  );
}

function SettingsPage({
  active,
  url,
  height,
  children,
}: {
  active: Section;
  url: string;
  height: number;
  children: ReactNode;
}) {
  return (
    <Gallery>
      <BrowserFrame url={url} height={height}>
        <AppShellFrame active="" title="Settings">
          <div className={styles.root}>
            <div>
              <Title order={2}>Settings</Title>
              <Text c="dimmed" mt={4}>
                Manage {APP.name} for everyone in the workspace.
              </Text>
            </div>
            <div className={styles.layout}>
              <SettingsNav active={active} />
              <div className={styles.panel}>{children}</div>
            </div>
          </div>
        </AppShellFrame>
      </BrowserFrame>
    </Gallery>
  );
}

function PanelCard({
  title,
  description,
  right,
  children,
  footer,
}: {
  title: string;
  description?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Card padding={0}>
      <div className={styles.cardHead}>
        <div className={styles.minw0}>
          <Title order={4}>{title}</Title>
          {description && (
            <Text size="sm" c="dimmed" mt={2}>
              {description}
            </Text>
          )}
        </div>
        {right}
      </div>
      <Divider />
      {children}
      {footer && <div className={styles.cardFoot}>{footer}</div>}
    </Card>
  );
}

/** Label and description on the left, the control on the right. */
function Row({ label, description, children, inline }: { label: string; description?: string; children: ReactNode; inline?: boolean }) {
  return (
    <div className={styles.row}>
      <div className={styles.minw0}>
        <Text size="sm" fw={600}>
          {label}
        </Text>
        {description && (
          <Text size="xs" c="dimmed" mt={2}>
            {description}
          </Text>
        )}
      </div>
      <div className={styles.control} data-inline={inline || undefined}>
        {children}
      </div>
    </div>
  );
}

function SaveBar({
  dirty,
  saving,
  invalid,
  onDiscard,
  onSave,
}: {
  dirty: boolean;
  saving: boolean;
  invalid?: boolean;
  onDiscard: () => void;
  onSave: () => void;
}) {
  return (
    <div className={styles.saveBar}>
      {dirty ? (
        <Badge variant="dot" color="orange">
          Unsaved changes
        </Badge>
      ) : (
        <Text size="sm" c="dimmed">
          Saved 2 days ago
        </Text>
      )}
      <Group gap="xs" wrap="nowrap">
        <Button variant="default" disabled={!dirty || saving} onClick={onDiscard}>
          Discard
        </Button>
        <Button disabled={!dirty || invalid} loading={saving} onClick={onSave}>
          Save changes
        </Button>
      </Group>
    </div>
  );
}

function useSaveable<T>(initial: T) {
  const [values, setValues] = useState<T>(initial);
  const [saved, setSaved] = useState<T>(initial);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(values) !== JSON.stringify(saved);
  const saveTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(saveTimer.current), []);
  const save = () => {
    setSaving(true);
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      setSaved(values);
      setSaving(false);
    }, 700);
  };
  return { values, setValues, dirty, saving, save, discard: () => setValues(saved) };
}

/* ── Templates ───────────────────────────────────────────────── */

/** General settings: label-left rows for profile, logo and region, with a save bar that arms on edit. */
export function SettingsGeneral() {
  const { values, setValues, dirty, saving, save, discard } = useSaveable(INITIAL_GENERAL);
  const set = <K extends keyof General>(key: K, value: General[K]) => setValues((v) => ({ ...v, [key]: value }));
  const slugError = /^[a-z0-9-]+$/.test(values.slug) ? undefined : 'Lowercase letters, numbers and dashes only';

  return (
    <SettingsPage active="general" url="/en/settings/general" height={760}>
      <PanelCard title="Workspace profile" description="How the workspace appears to members and in emails.">
        <Row label="Workspace name" description="Shown in the sidebar and email subjects.">
          <TextInput aria-label="Workspace name" value={values.name} onChange={(e) => set('name', e.currentTarget.value)} />
        </Row>
        <Divider />
        <Row label="Workspace URL" description="Changing it breaks existing links.">
          <TextInput
            aria-label="Workspace URL"
            value={values.slug}
            onChange={(e) => set('slug', e.currentTarget.value)}
            error={slugError}
            rightSection={
              <Text size="sm" c="dimmed">
                .buildpad.app
              </Text>
            }
            rightSectionWidth={104}
            rightSectionPointerEvents="none"
          />
        </Row>
        <Divider />
        <Row label="Logo" description="Square SVG or PNG, at least 256 px.">
          <Group gap="sm" wrap="nowrap">
            <div className="bp-brand-icon" aria-hidden>
              {APP.initial}
            </div>
            <Button variant="default" size="xs" leftSection={<IconUpload size={14} />}>
              Upload
            </Button>
            <Tooltip label="Remove logo">
              <ActionIcon variant="subtle" color="gray" aria-label="Remove logo">
                <IconTrash size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Row>
        <Divider />
        <Row label="Description" description="Optional. Helps new members find their way.">
          <Textarea
            aria-label="Description"
            autosize
            minRows={2}
            maxLength={140}
            value={values.description}
            onChange={(e) => set('description', e.currentTarget.value)}
          />
        </Row>
      </PanelCard>

      <PanelCard title="Region and language" description="Defaults for new members; each person can override them.">
        <Row label="Time zone" description="Due dates and cron jobs use this zone.">
          <Select
            aria-label="Time zone"
            searchable
            allowDeselect={false}
            data={TIMEZONES}
            value={values.timezone}
            onChange={(v) => set('timezone', v)}
          />
        </Row>
        <Divider />
        <Row label="Language">
          <Select aria-label="Language" allowDeselect={false} data={LANGUAGES} value={values.language} onChange={(v) => set('language', v)} />
        </Row>
        <Divider />
        <Row label="Date format">
          <Select
            aria-label="Date format"
            allowDeselect={false}
            data={['28 Oct 2026', '10/28/2026', '28/10/2026', '2026-10-28']}
            value={values.dateFormat}
            onChange={(v) => set('dateFormat', v)}
          />
        </Row>
        <Divider />
        <Row label="Week starts on" inline>
          <SegmentedControl
            aria-label="Week starts on"
            size="xs"
            data={['Mon', 'Sun']}
            value={values.weekStart}
            onChange={(v) => set('weekStart', v)}
          />
        </Row>
      </PanelCard>

      <SaveBar dirty={dirty} saving={saving} invalid={Boolean(slugError)} onDiscard={discard} onSave={save} />
    </SettingsPage>
  );
}

type Matrix = Record<string, { email: boolean; inApp: boolean }>;

const INITIAL_MATRIX: Matrix = Object.fromEntries(
  NOTIFY_GROUPS.flatMap((g) => g.events.map((e) => [e.id, { email: e.email, inApp: e.inApp }])),
);

/** Notification preferences: delivery options and a per-event email / in-app switch matrix. */
export function SettingsNotifications() {
  const { values, setValues, dirty, saving, save, discard } = useSaveable({
    matrix: INITIAL_MATRIX,
    digest: 'Instant',
    quiet: true,
  });
  const toggle = (id: string, channel: 'email' | 'inApp') =>
    setValues((v) => ({ ...v, matrix: { ...v.matrix, [id]: { ...v.matrix[id], [channel]: !v.matrix[id][channel] } } }));

  return (
    <SettingsPage active="notifications" url="/en/settings/notifications" height={760}>
      <PanelCard title="Delivery" description={`Sent to ${CURRENT_USER.email}.`}>
        <Row label="Email frequency" description="Bundle emails to cut the noise.">
          <SegmentedControl
            aria-label="Email frequency"
            fullWidth
            size="xs"
            data={['Instant', 'Hourly', 'Daily']}
            value={values.digest}
            onChange={(digest) => setValues((v) => ({ ...v, digest }))}
          />
        </Row>
        <Divider />
        <Row label="Quiet hours" description="No in-app pings 20:00–08:00 SGT." inline>
          <Switch
            aria-label="Quiet hours"
            checked={values.quiet}
            onChange={(e) => {
              const quiet = e.currentTarget.checked;
              setValues((v) => ({ ...v, quiet }));
            }}
          />
        </Row>
      </PanelCard>

      <PanelCard title="Notify me about" description="Choose a channel per event.">
        <Table withTableBorder={false} verticalSpacing="sm" horizontalSpacing="lg" className={styles.matrix}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Event</Table.Th>
              <Table.Th w={72} ta="center">
                Email
              </Table.Th>
              <Table.Th w={72} ta="center" className={styles.nowrap}>
                In-app
              </Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {NOTIFY_GROUPS.map((g) => (
              <Fragment key={g.group}>
                <Table.Tr className={styles.groupRow}>
                  <Table.Td colSpan={3}>
                    <Text size="xs" fw={700} c="dimmed" className={styles.navLabel}>
                      {g.group}
                    </Text>
                  </Table.Td>
                </Table.Tr>
                {g.events.map((e) => (
                  <Table.Tr key={e.id}>
                    <Table.Td>
                      <Group gap={6} wrap="nowrap">
                        <Text size="sm" fw={500}>
                          {e.label}
                        </Text>
                        {e.required && (
                          <Badge size="xs" color="gray">
                            Required
                          </Badge>
                        )}
                      </Group>
                      <Text size="xs" c="dimmed" mt={2}>
                        {e.hint}
                      </Text>
                    </Table.Td>
                    {(['email', 'inApp'] as const).map((channel) => (
                      <Table.Td key={channel} ta="center">
                        <div className={styles.cellCenter}>
                          <Switch
                            size="sm"
                            aria-label={`${channel === 'email' ? 'Email' : 'In-app'}: ${e.label}`}
                            checked={values.matrix[e.id][channel]}
                            disabled={e.required}
                            onChange={() => toggle(e.id, channel)}
                          />
                        </div>
                      </Table.Td>
                    ))}
                  </Table.Tr>
                ))}
              </Fragment>
            ))}
          </Table.Tbody>
        </Table>
      </PanelCard>

      <SaveBar dirty={dirty} saving={saving} onDiscard={discard} onSave={save} />
    </SettingsPage>
  );
}

function ApiKeyRow({ k, last }: { k: (typeof API_KEYS)[number]; last: boolean }) {
  const stale = k.used.includes('days ago');
  return (
    <>
      <div className={styles.listRow}>
        <ThemeIcon variant="light" color="gray" size="lg" radius="md" aria-hidden>
          <IconKey size={18} stroke={1.8} />
        </ThemeIcon>
        <div className={styles.minw0}>
          <Group gap={6} wrap="nowrap">
            <Text size="sm" fw={600} truncate>
              {k.name}
            </Text>
            <Badge size="xs" color="gray">
              {k.scope}
            </Badge>
            {stale && (
              <Badge size="xs" color="yellow">
                Unused
              </Badge>
            )}
          </Group>
          <Group gap={4} mt={4} wrap="nowrap">
            <Code className={styles.key}>{k.key}</Code>
            <CopyButton value={k.key} timeout={1600}>
              {({ copied, copy }) => (
                <Tooltip label={copied ? 'Copied' : 'Copy key'}>
                  <ActionIcon
                    variant="subtle"
                    color={copied ? 'green' : 'gray'}
                    size="sm"
                    onClick={copy}
                    aria-label={copied ? 'Copied' : `Copy ${k.name} key`}
                  >
                    {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                  </ActionIcon>
                </Tooltip>
              )}
            </CopyButton>
          </Group>
          <Text size="xs" c="dimmed" mt={4}>
            Created {k.created} · Last used {k.used}
          </Text>
        </div>
        <Tooltip label="Revoke key">
          <ActionIcon variant="subtle" color="red" aria-label={`Revoke ${k.name}`}>
            <IconTrash size={16} />
          </ActionIcon>
        </Tooltip>
      </div>
      {!last && <Divider />}
    </>
  );
}

/** Security and danger zone: enforced 2FA, sessions with revoke, API keys with copy, and a guarded delete. */
export function SettingsSecurity() {
  const [twoFactor, setTwoFactor] = useState(true);
  const [revoked, setRevoked] = useState<string[]>([]);
  const [confirm, setConfirm] = useState('');
  const sessions = SESSIONS.filter((s) => !revoked.includes(s.id));
  const pct = Math.round((ENROLLED / MEMBERS.length) * 100);

  return (
    <SettingsPage active="security" url="/en/settings/security" height={900}>
      <PanelCard
        title="Two-factor authentication"
        right={twoFactor ? <Badge color="green">Enforced</Badge> : <Badge color="gray">Optional</Badge>}
      >
        <Row label="Require 2FA for everyone" description="Members without it are asked to set it up at next sign-in." inline>
          <Switch aria-label="Require 2FA for everyone" checked={twoFactor} onChange={(e) => setTwoFactor(e.currentTarget.checked)} />
        </Row>
        <Divider />
        <div className={styles.block}>
          <Group justify="space-between" mb={6}>
            <Text size="xs" c="dimmed">
              Members enrolled
            </Text>
            <Text size="xs" fw={600}>
              {ENROLLED} of {MEMBERS.length}
            </Text>
          </Group>
          <Progress value={pct} size="sm" aria-label="Members enrolled in 2FA" />
          <Text size="xs" c="dimmed" mt="xs">
            {NOT_ENROLLED.map((u) => u.name).join(', ')} hasn&apos;t set it up yet.{' '}
            <Anchor href="#" size="xs" onClick={(e) => e.preventDefault()}>
              Send reminder
            </Anchor>
          </Text>
        </div>
      </PanelCard>

      <PanelCard
        title="Your sessions"
        description="Devices signed in to your account."
        footer={
          <Button
            variant="light"
            color="red"
            size="xs"
            disabled={sessions.length === 1}
            onClick={() => setRevoked(SESSIONS.filter((s) => !s.current).map((s) => s.id))}
          >
            Sign out all other sessions
          </Button>
        }
      >
        <Table withTableBorder={false} verticalSpacing="sm" horizontalSpacing="lg">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Device</Table.Th>
              <Table.Th w={88}>
                <span className={styles.srOnly}>Action</span>
              </Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {sessions.map((s) => {
              const DeviceIcon = s.icon;
              return (
                <Table.Tr key={s.id}>
                  <Table.Td>
                    <Group gap="sm" wrap="nowrap">
                      <ThemeIcon variant="light" color="gray" size="md" radius="md" aria-hidden>
                        <DeviceIcon size={16} stroke={1.8} />
                      </ThemeIcon>
                      <div className={styles.minw0}>
                        <Group gap={6} wrap="nowrap">
                          <Text size="sm" fw={500} className={styles.nowrap}>
                            {s.device}
                          </Text>
                          {s.current && (
                            <Badge size="xs" color="green">
                              This device
                            </Badge>
                          )}
                        </Group>
                        <Text size="xs" c="dimmed">
                          {s.place} ·{' '}
                          <Text span size="xs" c={s.current ? 'green.7' : undefined} fw={s.current ? 500 : undefined}>
                            {s.when}
                          </Text>
                        </Text>
                      </div>
                    </Group>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Button
                      variant="subtle"
                      color="red"
                      size="compact-sm"
                      disabled={s.current}
                      onClick={() => setRevoked((r) => [...r, s.id])}
                    >
                      Revoke
                    </Button>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </PanelCard>

      <PanelCard
        title="API keys"
        description="For integrations that call the Northwind Ops API."
        right={
          <Button variant="default" size="xs" leftSection={<IconPlus size={14} />}>
            Create key
          </Button>
        }
      >
        {API_KEYS.map((k, i) => (
          <ApiKeyRow key={k.id} k={k} last={i === API_KEYS.length - 1} />
        ))}
      </PanelCard>

      <section className={styles.danger} aria-labelledby="danger-zone-title">
        <div className={styles.cardHead}>
          <div className={styles.minw0}>
            <Title order={4} c="red" id="danger-zone-title">
              Danger zone
            </Title>
            <Text size="sm" c="dimmed" mt={2}>
              These actions affect every member and can&apos;t be undone.
            </Text>
          </div>
        </div>
        <Divider />
        <Row label="Transfer ownership" description="Make another administrator the workspace owner." inline>
          <Button variant="default" size="xs">
            Transfer
          </Button>
        </Row>
        <Divider />
        <div className={styles.block}>
          <Text size="sm" fw={600}>
            Delete workspace
          </Text>
          <Text size="xs" c="dimmed" mt={2}>
            Permanently deletes {APP.name}, its 128 open orders, files and audit history for all {USERS.length} members.
          </Text>
          <div className={styles.confirm}>
            <TextInput
              label={
                <>
                  Type <Code>{SLUG}</Code> to confirm
                </>
              }
              placeholder={SLUG}
              value={confirm}
              onChange={(e) => setConfirm(e.currentTarget.value)}
              autoComplete="off"
              className={styles.minw0}
            />
            <Button color="red" leftSection={<IconTrash size={16} />} disabled={confirm !== SLUG}>
              Delete workspace
            </Button>
          </div>
        </div>
      </section>
    </SettingsPage>
  );
}
