'use client';

import {
  ActionIcon,
  Anchor,
  Avatar,
  Badge,
  Button,
  Card,
  Checkbox,
  Combobox,
  Dialog,
  Divider,
  Drawer,
  Group,
  HoverCard,
  InputBase,
  Kbd,
  Menu,
  Modal,
  Popover,
  ScrollArea,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Textarea,
  Title,
  Tooltip,
  useCombobox,
  type MantineSize,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconAdjustmentsHorizontal,
  IconArchive,
  IconCheck,
  IconCopy,
  IconDots,
  IconDownload,
  IconEdit,
  IconExternalLink,
  IconFileExport,
  IconLink,
  IconMail,
  IconMessage,
  IconPencil,
  IconPrinter,
  IconSearch,
  IconSend,
  IconShare,
  IconTrash,
  IconUserPlus,
} from '@tabler/icons-react';
import { useState, type ReactNode } from 'react';
import { Gallery } from '../Gallery';
import { BrowserFrame, Specimen, SpecimenGrid } from '../Layout';
import {
  ACTIVITY,
  KPIS,
  ORDERS,
  ORDER_STATUS,
  USERS,
  formatMoney,
  type MockUser,
} from '../data';
import styles from './overlays.module.css';

const noop = () => {};
const ROLES = ['Administrator', 'Editor', 'Approver', 'Viewer'];
const ORDER = ORDERS[0];

/**
 * Props that pin an overlay open inside its specimen: rendered in place, no
 * scroll lock or focus trap, so the page stays scrollable and focus is never
 * stolen.
 */
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

/**
 * Pinned-open dropdowns and tooltips keep their declared side: no flip, shift
 * or hide-when-detached, which would otherwise react to the specimen being
 * scrolled out of the viewport.
 */
const PINNED_FLOATING = {
  withinPortal: false,
  middlewares: { flip: false, shift: false },
} as const;
const PINNED_DROPDOWN = { ...PINNED_FLOATING, hideDetached: false } as const;
const PINNED_TOOLTIP = { ...PINNED_FLOATING, opened: true } as const;

function PageBackdrop({ title, action, children }: { title: string; action: string; children: ReactNode }) {
  return (
    <div className={styles.backdrop}>
      <Group justify="space-between" mb="lg">
        <div>
          <Text size="xs" c="dimmed">
            Northwind Ops
          </Text>
          <Title order={3}>{title}</Title>
        </div>
        <Button size="xs">
          {action}
        </Button>
      </Group>
      {children}
    </div>
  );
}

function InviteForm({ onCancel, onSubmit }: { onCancel: () => void; onSubmit: () => void }) {
  return (
    <Stack gap="md">
      <TextInput
        label="Email address"
        placeholder="name@northwind.io"
        defaultValue="marco.silva@northwind.io"
        leftSection={<IconMail size={16} />}
        required
      />
      <Select label="Role" data={ROLES} defaultValue="Editor" allowDeselect={false} />
      <Textarea
        label="Personal message"
        placeholder="Optional"
        defaultValue="Welcome to Procurement — you'll start on the Atlas account."
        autosize
        minRows={2}
      />
      <Group justify="flex-end" gap="sm">
        <Button variant="default" onClick={onCancel}>
          Cancel
        </Button>
        <Button leftSection={<IconSend size={16} />} onClick={onSubmit}>
          Send invite
        </Button>
      </Group>
    </Stack>
  );
}

function DeleteConfirm({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  return (
    <Stack gap="lg">
      <Text size="sm">
        <Text span fw={600}>
          PO-2039 · Brightline Electrical
        </Text>{' '}
        and its 3 attachments will be permanently removed. This cannot be undone.
      </Text>
      <Group justify="flex-end" gap="sm">
        <Button variant="default" onClick={onCancel}>
          Cancel
        </Button>
        <Button color="red" leftSection={<IconTrash size={16} />} onClick={onConfirm}>
          Delete order
        </Button>
      </Group>
    </Stack>
  );
}

function OrderBackdrop() {
  return (
    <Card withBorder>
      <Group justify="space-between" mb="md">
        <div>
          <Text size="xs" c="dimmed" fw={500}>
            {ORDER.number}
          </Text>
          <Title order={3}>{ORDER.supplier}</Title>
        </div>
        <Badge color={ORDER_STATUS[ORDER.status].color}>{ORDER_STATUS[ORDER.status].label}</Badge>
      </Group>
      <Group gap="xl">
        <div>
          <Text size="xs" c="dimmed">
            Amount
          </Text>
          <Text fw={600}>{formatMoney(ORDER.amount)}</Text>
        </div>
        <div>
          <Text size="xs" c="dimmed">
            Due
          </Text>
          <Text fw={600}>{ORDER.due}</Text>
        </div>
        <div>
          <Text size="xs" c="dimmed">
            Category
          </Text>
          <Text fw={600}>{ORDER.category}</Text>
        </div>
      </Group>
    </Card>
  );
}

function OrdersTable() {
  return (
    <Card withBorder padding={0}>
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Order</Table.Th>
            <Table.Th>Supplier</Table.Th>
            <Table.Th>Status</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {ORDERS.slice(0, 6).map((order) => (
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
  );
}

function UsersTable() {
  return (
    <Card withBorder padding={0}>
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Name</Table.Th>
            <Table.Th>Role</Table.Th>
            <Table.Th>Team</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {USERS.map((user) => (
            <Table.Tr key={user.id}>
              <Table.Td>
                <Group gap="xs" wrap="nowrap">
                  <Avatar size="sm" radius="xl" color="primary">
                    {user.initials}
                  </Avatar>
                  {user.name}
                </Group>
              </Table.Td>
              <Table.Td>{user.role}</Table.Td>
              <Table.Td>{user.team}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Card>
  );
}

/** Static, always-open Modal previews inside the app shell: a form and a destructive confirm. */
export function ModalPreview() {
  return (
    <Gallery>
      <SpecimenGrid cols={1}>
        <Specimen
          label="Form modal · static preview"
          note={
            <>
              <code>Modal</code> with <code>title</code>, <code>centered</code>,{' '}
              <code>size=&quot;md&quot;</code>: <code>--ds-radius-xl</code>,{' '}
              <code>--ds-shadow-xl</code>, Inter Tight title over a <code>--ds-divider</code> rule;
              ink primary action, default-variant cancel.
            </>
          }
        >
          <BrowserFrame url="/users" height={460}>
            <div className={styles.fixedStage}>
              <PageBackdrop title="Users" action="Invite">
                <UsersTable />
              </PageBackdrop>
              <Modal {...STATIC_OVERLAY} {...CLOSE_LABEL} centered size="md" title="Invite teammate">
                <InviteForm onCancel={noop} onSubmit={noop} />
              </Modal>
            </div>
          </BrowserFrame>
        </Specimen>
        <Specimen
          label="Destructive confirm · static preview"
          note={
            <>
              Name the object, state the consequence; the only filled button is{' '}
              <code>color=&quot;red&quot;</code> and Cancel sits first.
            </>
          }
        >
          <BrowserFrame url="/orders/PO-2039" height={340}>
            <div className={styles.fixedStage}>
              <PageBackdrop title="PO-2039" action="Edit order">
                <OrderBackdrop />
              </PageBackdrop>
              <Modal {...STATIC_OVERLAY} {...CLOSE_LABEL} centered size="sm" title="Delete purchase order?">
                <DeleteConfirm onCancel={noop} onConfirm={noop} />
              </Modal>
            </div>
          </BrowserFrame>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

const AUDIT_LOG = Array.from({ length: 24 }, (_, i) => {
  const entry = ACTIVITY[i % ACTIVITY.length];
  return { ...entry, id: `${entry.id}-${i}` };
});

function AuditLog() {
  return (
    <Stack gap="sm">
      {AUDIT_LOG.map((entry) => (
        <Group key={entry.id} gap="sm" wrap="nowrap" align="flex-start">
          <Avatar size="sm" radius="xl" color="primary">
            {entry.user.initials}
          </Avatar>
          <div>
            <Text size="sm">
              <Text span fw={500}>
                {entry.user.name}
              </Text>{' '}
              {entry.action} {entry.target}
            </Text>
            <Text size="xs" c="dimmed">
              {entry.time}
            </Text>
          </div>
        </Group>
      ))}
    </Stack>
  );
}

const SIZES: MantineSize[] = ['xs', 'sm', 'md', 'lg', 'xl'];

/** Trigger buttons for every Modal configuration; each opens a real portalled modal. */
export function ModalTriggers() {
  const [basic, basicHandlers] = useDisclosure(false);
  const [form, formHandlers] = useDisclosure(false);
  const [confirm, confirmHandlers] = useDisclosure(false);
  const [centered, centeredHandlers] = useDisclosure(false);
  const [sized, sizedHandlers] = useDisclosure(false);
  const [full, fullHandlers] = useDisclosure(false);
  const [inside, insideHandlers] = useDisclosure(false);
  const [outside, outsideHandlers] = useDisclosure(false);
  const [size, setSize] = useState<MantineSize>('md');

  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        <Specimen label="Basic & centered" note={<>Default sits near the top; <code>centered</code> for short prompts.</>}>
          <Group justify="center">
            <Button variant="default" onClick={basicHandlers.open}>
              Open basic modal
            </Button>
            <Button variant="default" onClick={centeredHandlers.open}>
              Open centered
            </Button>
          </Group>
        </Specimen>
        <Specimen label="Form & confirm" note="The two previews above, live — focus is trapped and Esc closes.">
          <Group justify="center">
            <Button leftSection={<IconUserPlus size={16} />} onClick={formHandlers.open}>
              Invite teammate
            </Button>
            <Button color="red" variant="light" leftSection={<IconTrash size={16} />} onClick={confirmHandlers.open}>
              Delete order
            </Button>
          </Group>
        </Specimen>
        <Specimen
          label="Sizes"
          note={
            <>
              <code>size=&quot;xs&quot;</code> 320px → <code>&quot;xl&quot;</code> 780px; forms
              use <code>md</code>.
            </>
          }
        >
          <Stack gap="sm" align="center">
            <SegmentedControl
              size="xs"
              data={SIZES}
              value={size}
              onChange={(value) => setSize(value as MantineSize)}
              aria-label="Modal size"
            />
            <Button variant="default" onClick={sizedHandlers.open}>
              Open {size} modal
            </Button>
          </Stack>
        </Specimen>
        <Specimen
          label="Full screen & scrolling"
          note={
            <>
              <code>fullScreen</code> for previews; <code>scrollAreaComponent=&#123;ScrollArea.Autosize&#125;</code>{' '}
              scrolls inside the modal, the default scrolls the page.
            </>
          }
        >
          <Stack gap="xs" align="center">
            <Button variant="default" leftSection={<IconPrinter size={16} />} onClick={fullHandlers.open}>
              Open full screen
            </Button>
            <Group justify="center" gap="xs">
              <Button variant="subtle" size="xs" onClick={insideHandlers.open}>
                Scroll inside
              </Button>
              <Button variant="subtle" size="xs" onClick={outsideHandlers.open}>
                Scroll outside
              </Button>
            </Group>
          </Stack>
        </Specimen>
      </SpecimenGrid>

      <Modal {...CLOSE_LABEL} opened={basic} onClose={basicHandlers.close} title={`${ORDER.number} · ${ORDER.supplier}`}>
        <Stack gap="md">
          <Text size="sm">
            Submitted by {ORDER.owner.name} for {formatMoney(ORDER.amount)}, due {ORDER.due}. Awaiting
            approval from Finance.
          </Text>
          <Group justify="flex-end">
            <Button onClick={basicHandlers.close}>Done</Button>
          </Group>
        </Stack>
      </Modal>

      <Modal {...CLOSE_LABEL} opened={centered} onClose={centeredHandlers.close} centered size="sm" title="Session expiring">
        <Stack gap="lg">
          <Text size="sm">You will be signed out in 2 minutes. Unsaved changes will be lost.</Text>
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={centeredHandlers.close}>
              Sign out
            </Button>
            <Button onClick={centeredHandlers.close}>Stay signed in</Button>
          </Group>
        </Stack>
      </Modal>

      <Modal {...CLOSE_LABEL} opened={form} onClose={formHandlers.close} centered title="Invite teammate">
        <InviteForm onCancel={formHandlers.close} onSubmit={formHandlers.close} />
      </Modal>

      <Modal {...CLOSE_LABEL} opened={confirm} onClose={confirmHandlers.close} centered size="sm" title="Delete purchase order?">
        <DeleteConfirm onCancel={confirmHandlers.close} onConfirm={confirmHandlers.close} />
      </Modal>

      <Modal {...CLOSE_LABEL} opened={sized} onClose={sizedHandlers.close} size={size} title={`size="${size}"`}>
        <Text size="sm">
          This modal uses <Kbd>size=&quot;{size}&quot;</Kbd>. Pick the smallest size that fits the
          content without wrapping form fields.
        </Text>
      </Modal>

      <Modal {...CLOSE_LABEL} opened={full} onClose={fullHandlers.close} fullScreen title="October spend report" transitionProps={{ transition: 'fade', duration: 150 }}>
        <Stack gap="lg">
          <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }}>
            {KPIS.map((kpi) => (
              <Card key={kpi.label} withBorder>
                <Text size="xs" c="dimmed">
                  {kpi.label}
                </Text>
                <Title order={3}>{kpi.value}</Title>
                <Text size="xs" c="dimmed">
                  {kpi.delta} {kpi.hint}
                </Text>
              </Card>
            ))}
          </SimpleGrid>
          <OrdersTable />
          <Group justify="flex-end" gap="sm">
            <Button variant="default" leftSection={<IconDownload size={16} />}>
              Download PDF
            </Button>
            <Button onClick={fullHandlers.close}>Close preview</Button>
          </Group>
        </Stack>
      </Modal>

      <Modal {...CLOSE_LABEL} opened={inside} onClose={insideHandlers.close} title="Audit log" scrollAreaComponent={ScrollArea.Autosize}>
        <AuditLog />
      </Modal>

      <Modal {...CLOSE_LABEL} opened={outside} onClose={outsideHandlers.close} title="Audit log">
        <AuditLog />
      </Modal>
    </Gallery>
  );
}

function DrawerFooter({ children }: { children: ReactNode }) {
  return <div className={styles.drawerFooter}>{children}</div>;
}

function SupplierForm() {
  return (
    <Stack gap="md">
      <TextInput label="Supplier name" defaultValue="Atlas Packaging" required />
      <TextInput label="Billing email" defaultValue="accounts@atlaspack.com" leftSection={<IconMail size={16} />} />
      <Select label="Category" data={['Packaging', 'Freight', 'Facilities', 'Software']} defaultValue="Packaging" allowDeselect={false} />
      <Textarea label="Notes" defaultValue="Net-30 terms. Prefers consolidated monthly invoices." autosize minRows={3} />
      <Switch label="Preferred supplier" defaultChecked />
    </Stack>
  );
}

function SupplierDrawerContent({ onClose }: { onClose: () => void }) {
  return (
    <>
      <Drawer.Overlay />
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title>Edit supplier</Drawer.Title>
          <Drawer.CloseButton aria-label="Close drawer" />
        </Drawer.Header>
        <Drawer.Body>
          <SupplierForm />
        </Drawer.Body>
        <DrawerFooter>
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onClose}>Save supplier</Button>
        </DrawerFooter>
      </Drawer.Content>
    </>
  );
}

/** Static right Drawer with a form and pinned footer, inside the app shell. */
export function DrawerPreview() {
  return (
    <Gallery>
      <SpecimenGrid cols={1}>
        <Specimen
          label="Drawer with form footer · static preview"
          note={
            <>
              <code>Drawer.Root</code> composition, <code>position=&quot;right&quot;</code>,{' '}
              <code>size=&quot;xs&quot;</code>; the footer sticks to the bottom while the body
              scrolls.
            </>
          }
        >
          <BrowserFrame url="/suppliers" height={500}>
            <div className={styles.fixedStage}>
              <PageBackdrop title="Suppliers" action="New supplier">
                <OrdersTable />
              </PageBackdrop>
              <Drawer.Root
                {...STATIC_OVERLAY}
                position="right"
                size="xs"
                classNames={{ content: styles.drawerContent, body: styles.drawerBody }}
              >
                <SupplierDrawerContent onClose={noop} />
              </Drawer.Root>
            </div>
          </BrowserFrame>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

/** Trigger buttons for right, left and form-footer Drawers. */
export function DrawerTriggers() {
  const [right, rightHandlers] = useDisclosure(false);
  const [left, leftHandlers] = useDisclosure(false);
  const [form, formHandlers] = useDisclosure(false);
  return (
    <Gallery>
      <SpecimenGrid cols={1}>
        <Specimen
          label="position"
          note={
            <>
              Right for record details and edits, left for filters; both slide over the page with
              the shared overlay.
            </>
          }
        >
          <Group justify="center">
            <Button variant="default" onClick={rightHandlers.open}>
              Right · order details
            </Button>
            <Button variant="default" leftSection={<IconAdjustmentsHorizontal size={16} />} onClick={leftHandlers.open}>
              Left · filters
            </Button>
            <Button leftSection={<IconPencil size={16} />} onClick={formHandlers.open}>
              Edit supplier
            </Button>
          </Group>
        </Specimen>
      </SpecimenGrid>

      <Drawer {...CLOSE_LABEL} opened={right} onClose={rightHandlers.close} position="right" title={`${ORDER.number} · ${ORDER.supplier}`}>
        <Stack gap="lg">
          <Badge color={ORDER_STATUS[ORDER.status].color}>{ORDER_STATUS[ORDER.status].label}</Badge>
          <SimpleGrid cols={2} spacing="md">
            {[
              ['Amount', formatMoney(ORDER.amount)],
              ['Due', ORDER.due],
              ['Category', ORDER.category],
              ['Owner', ORDER.owner.name],
            ].map(([label, value]) => (
              <div key={label}>
                <Text size="xs" c="dimmed">
                  {label}
                </Text>
                <Text fw={500}>{value}</Text>
              </div>
            ))}
          </SimpleGrid>
          <Divider />
          <Title order={5}>Activity</Title>
          <Stack gap="sm">
            {ACTIVITY.map((entry) => (
              <Group key={entry.id} gap="sm" wrap="nowrap" align="flex-start">
                <Avatar size="sm" radius="xl" color="primary">
                  {entry.user.initials}
                </Avatar>
                <div>
                  <Text size="sm">
                    {entry.user.name} {entry.action} {entry.target}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {entry.time}
                  </Text>
                </div>
              </Group>
            ))}
          </Stack>
        </Stack>
      </Drawer>

      <Drawer {...CLOSE_LABEL} opened={left} onClose={leftHandlers.close} position="left" size="xs" title="Filters">
        <Stack gap="lg">
          <Checkbox.Group label="Status" defaultValue={['pending', 'approved']}>
            <Stack gap="xs" mt="xs">
              {Object.entries(ORDER_STATUS).map(([value, { label }]) => (
                <Checkbox key={value} value={value} label={label} />
              ))}
            </Stack>
          </Checkbox.Group>
          <Select label="Owner" placeholder="Anyone" data={USERS.map((u) => u.name)} clearable />
          <Group justify="space-between">
            <Button variant="subtle" onClick={leftHandlers.close}>
              Reset
            </Button>
            <Button onClick={leftHandlers.close}>Apply filters</Button>
          </Group>
        </Stack>
      </Drawer>

      <Drawer.Root
        opened={form}
        onClose={formHandlers.close}
        position="right"
        size="sm"
        classNames={{ content: styles.drawerContent, body: styles.drawerBody }}
      >
        <SupplierDrawerContent onClose={formHandlers.close} />
      </Drawer.Root>
    </Gallery>
  );
}

/** Popover: a static open share panel with a form, and a click-triggered filter panel. */
export function Popovers() {
  const [copied, setCopied] = useState(false);
  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        <Specimen
          label="Static open · with form"
          note={
            <>
              <code>opened</code>, <code>withArrow</code>: the shared floating surface —{' '}
              <code>--ds-radius-lg</code>, <code>--ds-shadow-lg</code>, hairline border.
            </>
          }
          align="start"
        >
          <div className={styles.overlayStage}>
            <Popover {...PINNED_DROPDOWN} opened position="bottom" width={260} withArrow>
              <Popover.Target>
                <Button variant="default" leftSection={<IconShare size={16} />}>
                  Share
                </Button>
              </Popover.Target>
              <Popover.Dropdown>
                <Stack gap="sm">
                  <Text size="sm" fw={600}>
                    Share {ORDER.number}
                  </Text>
                  <TextInput
                    label="Link"
                    size="xs"
                    readOnly
                    value="northwind.buildpad.app/o/2041"
                    leftSection={<IconLink size={14} />}
                  />
                  <Switch size="xs" label="Anyone in the workspace can view" defaultChecked />
                  <Button
                    size="xs"
                    leftSection={copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                    onClick={() => setCopied(true)}
                  >
                    {copied ? 'Copied' : 'Copy link'}
                  </Button>
                </Stack>
              </Popover.Dropdown>
            </Popover>
          </div>
        </Specimen>
        <Specimen
          label="Trigger"
          note={
            <>
              Click to toggle; closes on outside click and <Kbd size="xs">Esc</Kbd>. Use for
              inline filters and quick edits.
            </>
          }
          align="start"
        >
          <div className={styles.overlayStage}>
            <Popover position="bottom" width={240} withArrow trapFocus>
              <Popover.Target>
                <Button variant="default" leftSection={<IconAdjustmentsHorizontal size={16} />}>
                  Filter status
                </Button>
              </Popover.Target>
              <Popover.Dropdown>
                <Checkbox.Group label="Status" defaultValue={['pending']}>
                  <Stack gap="xs" mt="xs">
                    {Object.entries(ORDER_STATUS).map(([value, { label }]) => (
                      <Checkbox key={value} size="xs" value={value} label={label} />
                    ))}
                  </Stack>
                </Checkbox.Group>
              </Popover.Dropdown>
            </Popover>
          </div>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

function OrderMenuItems() {
  return (
    <>
      <Menu.Label>Order</Menu.Label>
      <Menu.Item leftSection={<IconEdit size={16} />} rightSection={<Kbd size="xs">⌘E</Kbd>}>
        Edit
      </Menu.Item>
      <Menu.Item leftSection={<IconCopy size={16} />} rightSection={<Kbd size="xs">⌘D</Kbd>}>
        Duplicate
      </Menu.Item>
      <Menu.Item leftSection={<IconFileExport size={16} />}>Export as CSV</Menu.Item>
      <Menu.Item leftSection={<IconExternalLink size={16} />} disabled>
        Open in ERP
      </Menu.Item>
      <Menu.Divider />
      <Menu.Label>Danger zone</Menu.Label>
      <Menu.Item leftSection={<IconArchive size={16} />}>Archive</Menu.Item>
      <Menu.Item color="red" leftSection={<IconTrash size={16} />} rightSection={<Kbd size="xs">Del</Kbd>}>
        Delete order
      </Menu.Item>
    </>
  );
}

/** Menu: a static open action menu and live triggers (row actions, user menu). */
export function Menus() {
  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        <Specimen
          label="Static open"
          note={
            <>
              <code>Menu.Label</code> sections, <code>leftSection</code> icons,{' '}
              <code>Kbd</code> shortcuts, <code>Menu.Divider</code>, a <code>disabled</code> item
              and a <code>color=&quot;red&quot;</code> danger item.
            </>
          }
          align="start"
        >
          <div className={`${styles.overlayStage} ${styles.menuStage}`}>
            <Menu {...PINNED_DROPDOWN} opened trapFocus={false} returnFocus={false} position="bottom" width={220}>
              <Menu.Target>
                <Button variant="default" rightSection={<IconDots size={16} />}>
                  Actions
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <OrderMenuItems />
              </Menu.Dropdown>
            </Menu>
          </div>
        </Specimen>
        <Specimen
          label="Triggers"
          note={
            <>
              Row actions on an icon button (<code>aria-label</code> required) and the header user
              menu — click either.
            </>
          }
          align="start"
        >
          <div className={`${styles.overlayStage} ${styles.menuStage}`}>
            <Group justify="space-between" w="100%">
              <Menu position="bottom-start" width={220}>
                <Menu.Target>
                  <ActionIcon variant="default" size="lg" aria-label={`Actions for ${ORDER.number}`}>
                    <IconDots size={16} />
                  </ActionIcon>
                </Menu.Target>
                <Menu.Dropdown>
                  <OrderMenuItems />
                </Menu.Dropdown>
              </Menu>
              <Menu position="bottom-end" width={220}>
                <Menu.Target>
                  <Button variant="subtle" leftSection={<Avatar size="sm" radius="xl" color="primary">{USERS[0].initials}</Avatar>}>
                    {USERS[0].name}
                  </Button>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Label>{USERS[0].email}</Menu.Label>
                  <Menu.Item>Profile</Menu.Item>
                  <Menu.Item>Preferences</Menu.Item>
                  <Menu.Divider />
                  <Menu.Item color="red">Sign out</Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </Group>
          </div>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

const SIDES = [
  { position: 'top', label: 'Edit order', icon: IconEdit },
  { position: 'right', label: 'Duplicate', icon: IconCopy },
  { position: 'bottom', label: 'Archive', icon: IconArchive },
  { position: 'left', label: 'Delete', icon: IconTrash },
] as const;

/** Tooltip: static on four sides, arrow options, multiline and floating. */
export function Tooltips() {
  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        <Specimen
          label="Four sides"
          note={
            <>
              <code>position</code> top / right / bottom / left. Ink chip in light, inverted in
              dark (<code>--tooltip-bg</code>); <code>withArrow</code> is on by default.
            </>
          }
          span="full"
        >
          <div className={styles.tooltipRow}>
            {SIDES.map(({ position, label, icon: SideIcon }) => (
              <Tooltip key={position} {...PINNED_TOOLTIP} position={position} label={label}>
                <ActionIcon variant="default" size="lg" aria-label={label}>
                  <SideIcon size={16} />
                </ActionIcon>
              </Tooltip>
            ))}
          </div>
        </Specimen>
        <Specimen
          label="Arrow"
          note={
            <>
              Default centred arrow, <code>arrowPosition=&quot;side&quot;</code>, and{' '}
              <code>withArrow=&#123;false&#125;</code>.
            </>
          }
        >
          <div className={styles.tooltipStack}>
            <Tooltip {...PINNED_TOOLTIP} position="right" label="Centred arrow">
              <Button variant="default" size="xs">
                Default
              </Button>
            </Tooltip>
            <Tooltip {...PINNED_TOOLTIP} position="right-start" arrowPosition="side" label="Side arrow">
              <Button variant="default" size="xs">
                Side
              </Button>
            </Tooltip>
            <Tooltip {...PINNED_TOOLTIP} position="right" withArrow={false} label="No arrow">
              <Button variant="default" size="xs">
                None
              </Button>
            </Tooltip>
          </div>
        </Specimen>
        <Specimen
          label="Multiline"
          note={
            <>
              <code>multiline</code> with a fixed <code>w</code> for explanations longer than a
              few words.
            </>
          }
        >
          <div className={styles.tooltipMultiline}>
            <Tooltip
              {...PINNED_TOOLTIP}
              multiline
              w={220}
              position="bottom"
              label="Orders above $25,000 need a second approver from Finance before they can be sent."
            >
              <Badge color="yellow">Needs 2 approvals</Badge>
            </Tooltip>
          </div>
        </Specimen>
        <Specimen
          label="Floating"
          note={
            <>
              <code>Tooltip.Floating</code> follows the cursor — hover the area. Good for charts and
              heatmaps.
            </>
          }
          span="full"
        >
          <Tooltip.Floating label="Oct · $412k spend">
            <div className={styles.floatingArea}>
              <Text size="sm" c="dimmed">
                Hover anywhere in this area
              </Text>
            </div>
          </Tooltip.Floating>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

function UserCard({ user }: { user: MockUser }) {
  return (
    <Stack gap="sm">
      <Group gap="sm" wrap="nowrap">
        <Avatar radius="xl" size="lg" color="primary">
          {user.initials}
        </Avatar>
        <div>
          <Text fw={600}>{user.name}</Text>
          <Text size="xs" c="dimmed">
            {user.email}
          </Text>
        </div>
      </Group>
      <Group gap="xs">
        <Badge color="blue">{user.role}</Badge>
        <Badge color="gray">{user.team}</Badge>
      </Group>
      <Text size="xs" c="dimmed">
        Approved 14 orders this month · active {user.lastActive}
      </Text>
      <Group gap="xs" grow>
        <Button size="xs" variant="default" leftSection={<IconMessage size={14} />}>
          Message
        </Button>
        <Button size="xs">View profile</Button>
      </Group>
    </Stack>
  );
}

/** HoverCard with a user card, shown open on load. */
export function HoverCards() {
  const user = USERS[2];
  return (
    <Gallery>
      <SpecimenGrid cols={1}>
        <Specimen
          label="User card"
          note={
            <>
              <code>HoverCard</code> with <code>initiallyOpened</code> for this preview; in an app it
              opens on hover after <code>openDelay</code>. Hover the name to re-open it.
            </>
          }
          align="start"
        >
          <div className={`${styles.overlayStage} ${styles.hoverStage}`}>
            <Text size="sm" component="div">
              Approved by{' '}
              <HoverCard {...PINNED_DROPDOWN} initiallyOpened width={280} position="bottom-start" openDelay={150} closeDelay={150}>
                <HoverCard.Target>
                  <Anchor component="button" type="button" size="sm" fw={500}>
                    {user.name}
                  </Anchor>
                </HoverCard.Target>
                <HoverCard.Dropdown>
                  <UserCard user={user} />
                </HoverCard.Dropdown>
              </HoverCard>{' '}
              · 12 min ago
            </Text>
          </div>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

function UpdateDialogBody({ onClose }: { onClose: () => void }) {
  return (
    <Stack gap="sm">
      <Text size="sm" fw={600}>
        Import finished
      </Text>
      <Text size="sm" c="dimmed">
        1,986 suppliers imported, 14 rows skipped.
      </Text>
      <Group gap="xs">
        <Button size="xs" onClick={onClose}>
          View report
        </Button>
        <Button size="xs" variant="default" onClick={onClose}>
          Dismiss
        </Button>
      </Group>
    </Stack>
  );
}

/** Dialog anchored bottom-right: a static preview and a live trigger. */
export function Dialogs() {
  const [opened, { toggle, close }] = useDisclosure(false);
  return (
    <Gallery>
      <SpecimenGrid cols={1}>
        <Specimen
          label="Dialog · bottom-right"
          note={
            <>
              Non-modal: the page stays usable. <code>position=&#123;&#123; bottom: 20, right: 20 &#125;&#125;</code>,{' '}
              <code>withCloseButton</code>. The button opens a live one at the bottom-right of your
              window.
            </>
          }
          surface="muted"
        >
          <div className={styles.dialogStage}>
            <Stack gap="sm" className={styles.dialogPage}>
              <Title order={4}>Supplier import</Title>
              <Text size="sm" c="dimmed">
                suppliers.csv · 2,000 rows
              </Text>
              <Group>
                <Button variant="default" size="xs" onClick={toggle}>
                  {opened ? 'Close live dialog' : 'Open live dialog'}
                </Button>
              </Group>
            </Stack>
            <Dialog
              opened
              withinPortal={false}
              withCloseButton
              attributes={{ closeButton: { 'aria-label': 'Close' } }}
              onClose={noop}
              size="md"
              position={{ bottom: 20, right: 20 }}
              transitionProps={{ duration: 0 }}
            >
              <UpdateDialogBody onClose={noop} />
            </Dialog>
          </div>
        </Specimen>
      </SpecimenGrid>
      <Dialog
        opened={opened}
        withCloseButton
        attributes={{ closeButton: { 'aria-label': 'Close' } }}
        onClose={close}
        size="md"
        position={{ bottom: 20, right: 20 }}
      >
        <UpdateDialogBody onClose={close} />
      </Dialog>
    </Gallery>
  );
}

const OWNER_GROUPS = [
  { group: 'Approvers', users: USERS.filter((u) => u.role === 'Approver' || u.role === 'Administrator') },
  { group: 'Editors', users: USERS.filter((u) => u.role === 'Editor') },
];

function OwnerOption({ user, selected }: { user: MockUser; selected: boolean }) {
  return (
    <Group gap="sm" wrap="nowrap" justify="space-between">
      <Group gap="sm" wrap="nowrap">
        <Avatar size="sm" radius="xl" color="primary">
          {user.initials}
        </Avatar>
        <div>
          <Text size="sm">{user.name}</Text>
          <Text size="xs" c="dimmed">
            {user.team}
          </Text>
        </div>
      </Group>
      {selected && <IconCheck size={16} aria-hidden />}
    </Group>
  );
}

/** Combobox dropdown pinned open: grouped options with avatars, a selected check and a footer. */
function StaticOwnerCombobox() {
  const store = useCombobox({ opened: true });
  const [value, setValue] = useState('Priya Raman');
  return (
    <Combobox store={store} {...PINNED_DROPDOWN} onOptionSubmit={setValue}>
      <Combobox.Target>
        <InputBase
          component="button"
          type="button"
          pointer
          label="Owner"
          rightSection={<Combobox.Chevron />}
          rightSectionPointerEvents="none"
        >
          {value}
        </InputBase>
      </Combobox.Target>
      <Combobox.Dropdown>
        <Combobox.Options>
          {OWNER_GROUPS.map(({ group, users }) => (
            <Combobox.Group key={group} label={group}>
              {users.map((user) => (
                <Combobox.Option key={user.id} value={user.name} active={user.name === value}>
                  <OwnerOption user={user} selected={user.name === value} />
                </Combobox.Option>
              ))}
            </Combobox.Group>
          ))}
        </Combobox.Options>
        <Combobox.Footer>
          <Button variant="subtle" size="xs" leftSection={<IconUserPlus size={14} />}>
            Invite teammate
          </Button>
        </Combobox.Footer>
      </Combobox.Dropdown>
    </Combobox>
  );
}

const SUPPLIERS = Array.from(new Set(ORDERS.map((o) => o.supplier)));

function SupplierSearch() {
  const store = useCombobox({ onDropdownClose: () => store.resetSelectedOption() });
  const [search, setSearch] = useState('');
  const matches = SUPPLIERS.filter((s) => s.toLowerCase().includes(search.toLowerCase().trim()));
  return (
    <Combobox
      store={store}
      withinPortal={false}
      onOptionSubmit={(val) => {
        setSearch(val);
        store.closeDropdown();
      }}
    >
      <Combobox.Target>
        <TextInput
          label="Supplier"
          placeholder="Search suppliers"
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(e) => {
            setSearch(e.currentTarget.value);
            store.openDropdown();
            store.updateSelectedOptionIndex();
          }}
          onClick={() => store.openDropdown()}
          onFocus={() => store.openDropdown()}
          onBlur={() => store.closeDropdown()}
        />
      </Combobox.Target>
      <Combobox.Dropdown>
        <Combobox.Options>
          {matches.length > 0 ? (
            matches.map((s) => (
              <Combobox.Option key={s} value={s}>
                {s}
              </Combobox.Option>
            ))
          ) : (
            <Combobox.Empty>No suppliers match “{search}”</Combobox.Empty>
          )}
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
}

/** Combobox: a static open grouped picker and a live searchable one. */
export function Comboboxes() {
  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        <Specimen
          label="Static open"
          note={
            <>
              <code>useCombobox(&#123; opened: true &#125;)</code>: <code>Combobox.Group</code>,
              rich options, <code>active</code> check, <code>Combobox.Footer</code>. Same surface as
              Select / Menu.
            </>
          }
          align="start"
        >
          <div className={`${styles.overlayStage} ${styles.comboStage}`}>
            <div className={styles.field}>
              <StaticOwnerCombobox />
            </div>
          </div>
        </Specimen>
        <Specimen
          label="Searchable"
          note={
            <>
              Filters as you type; <code>Combobox.Empty</code> when nothing matches — try
              &quot;zz&quot;. Arrow keys + Enter select.
            </>
          }
          align="start"
        >
          <div className={`${styles.overlayStage} ${styles.comboStage}`}>
            <div className={styles.field}>
              <SupplierSearch />
            </div>
          </div>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}
