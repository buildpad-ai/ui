'use client';

import {
  ActionIcon,
  Badge,
  Button,
  Card,
  CloseButton,
  CopyButton,
  Group,
  Menu,
  Modal,
  Paper,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
  Tooltip,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconAdjustmentsHorizontal,
  IconAlertTriangle,
  IconArchive,
  IconArrowRight,
  IconBold,
  IconCheck,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconCopy,
  IconDots,
  IconDownload,
  IconFileExport,
  IconItalic,
  IconLink,
  IconMinus,
  IconPencil,
  IconPlus,
  IconPrinter,
  IconRefresh,
  IconSend,
  IconStar,
  IconTrash,
  IconUnderline,
  type Icon,
} from '@tabler/icons-react';
import { Gallery } from '../Gallery';
import { Specimen, SpecimenGrid } from '../Layout';
import { ORDERS, ORDER_STATUS, formatMoney } from '../data';
import styles from './buttons.module.css';

const SIZES = ['xs', 'sm', 'md', 'lg', 'xl'] as const;
const COLORS = ['primary', 'gray', 'red', 'green', 'blue', 'yellow'] as const;
const COLOR_VARIANTS = ['filled', 'light', 'outline'] as const;
const WEBHOOK_URL = 'https://northwind.buildpad.app/hooks/orders';

/** Every Button variant, with the ink CTA and the ember brand CTA first. */
export function ButtonVariants() {
  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        <Specimen
          label="Ink CTA — default"
          note={
            <>
              No <code>color</code>, filled: the primary action on every screen. Renders <code>--ds-cta-bg</code>,
              inverts in dark mode.
            </>
          }
        >
          <Group>
            <Button>Create order</Button>
            <Button leftSection={<IconPlus size={16} />}>New supplier</Button>
          </Group>
        </Specimen>
        <Specimen
          label='Brand CTA — color="primary"'
          note="Ember fill for brand moments: onboarding, upgrade, a hero CTA. Use at most once per view."
        >
          <Group>
            <Button color="primary">Start free trial</Button>
            <Button color="primary" rightSection={<IconArrowRight size={16} />}>
              Get started
            </Button>
          </Group>
        </Specimen>
        <Specimen
          label='variant="light"'
          note={
            <>
              Tinted secondary action. Text is promoted to the AA <code>700</code> stop.
            </>
          }
        >
          <Group>
            <Button variant="light">Add line item</Button>
            <Button variant="light" color="gray">
              Preview
            </Button>
          </Group>
        </Specimen>
        <Specimen label='variant="outline"' note="Bordered secondary action on busy surfaces.">
          <Group>
            <Button variant="outline">Export CSV</Button>
            <Button variant="outline" color="gray">
              Duplicate
            </Button>
          </Group>
        </Specimen>
        <Specimen
          label='variant="default"'
          note="Neutral surface button: Cancel, Save draft, filters. The workhorse secondary."
        >
          <Group>
            <Button variant="default">Cancel</Button>
            <Button variant="default" leftSection={<IconAdjustmentsHorizontal size={16} />}>
              Filters
            </Button>
          </Group>
        </Specimen>
        <Specimen label='variant="subtle"' note="No fill until hover. Tertiary actions inside cards and tables.">
          <Group>
            <Button variant="subtle">View all orders</Button>
            <Button variant="subtle" color="gray">
              Dismiss
            </Button>
          </Group>
        </Specimen>
        <Specimen
          label='variant="white" on an ink surface'
          note={
            <>
              For dark brand bands only — shown on <code>--ds-brand-hero</code>, which never inverts.
            </>
          }
        >
          <div className={styles.inkSurface}>
            <div>
              <div className={styles.inkTitle}>Invite your team</div>
              <div className={styles.inkSub}>Approvals move faster with more reviewers.</div>
            </div>
            <Group>
              <Button variant="white" color="dark">
                Invite people
              </Button>
            </Group>
          </div>
        </Specimen>
        <Specimen label='variant="transparent"' note="Text-only, no hover fill. Inline actions next to body copy.">
          <Group>
            <Button variant="transparent">Show details</Button>
            <Button variant="transparent" color="gray">
              Skip for now
            </Button>
          </Group>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

/** Filled, light and outline across the brand and semantic colours. */
export function ButtonColors() {
  return (
    <Gallery>
      <SpecimenGrid cols={1}>
        <Specimen
          label="Colour × variant"
          note={
            <>
              <code>red</code>, <code>green</code>, <code>blue</code>, <code>yellow</code> resolve to danger, success,
              info and warning; <code>gray</code> is the neutral scale.
            </>
          }
        >
          <div className={styles.matrixScroll}>
            <div className={styles.matrix}>
              <span />
              {COLORS.map((color) => (
                <span key={color} className={`${styles.matrixHead} ${styles.matrixCell}`}>
                  {color}
                </span>
              ))}
              {COLOR_VARIANTS.map((variant) => (
                <ColorRow key={variant} variant={variant} />
              ))}
            </div>
          </div>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

function ColorRow({ variant }: { variant: (typeof COLOR_VARIANTS)[number] }) {
  return (
    <>
      <span className={styles.matrixHead}>{variant}</span>
      {COLORS.map((color) => (
        <span key={color} className={styles.matrixCell}>
          <Button size="xs" variant={variant} color={color}>
            {color === 'primary' ? 'Ember' : color[0].toUpperCase() + color.slice(1)}
          </Button>
        </span>
      ))}
    </>
  );
}

/** The regular and compact size scales. */
export function ButtonSizes() {
  return (
    <Gallery>
      <SpecimenGrid cols={1}>
        <Specimen
          label="size — xs to xl"
          note={
            <>
              Height and padding scale; the theme pins the label to <code>md</code> type, so long labels stay readable
              at <code>xs</code>.
            </>
          }
        >
          <Group align="center">
            {SIZES.map((size) => (
              <Button key={size} size={size}>
                Size {size}
              </Button>
            ))}
          </Group>
        </Specimen>
        <Specimen
          label="size — compact-xs to compact-xl"
          note={
            <>
              Tighter padding for dense toolbars and table rows. <code>md</code> is the default.
            </>
          }
        >
          <Group align="center">
            {SIZES.map((size) => (
              <Button key={size} size={`compact-${size}`} variant="default">
                compact-{size}
              </Button>
            ))}
          </Group>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

/** Icons in leftSection / rightSection, and justify inside a full-width button. */
export function ButtonSections() {
  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        <Specimen label="leftSection" note="A leading icon names the action. Tabler icons at 16px.">
          <Group>
            <Button leftSection={<IconPlus size={16} />}>Create</Button>
            <Button variant="default" leftSection={<IconDownload size={16} />}>
              Download
            </Button>
          </Group>
        </Specimen>
        <Specimen label="rightSection" note="A trailing icon signals what happens next: navigation or a menu.">
          <Group>
            <Button rightSection={<IconArrowRight size={16} />}>Continue</Button>
            <Button variant="default" rightSection={<IconChevronDown size={16} />}>
              Export
            </Button>
          </Group>
        </Specimen>
        <Specimen
          label='fullWidth + justify="space-between"'
          note={
            <>
              With both sections, <code>justify</code> pins the icons to the edges.
            </>
          }
          span="full"
        >
          <Stack gap="sm">
            <Button
              fullWidth
              variant="default"
              justify="space-between"
              leftSection={<IconFileExport size={16} />}
              rightSection={<IconChevronRight size={16} />}
            >
              Export purchase orders
            </Button>
            <Button
              fullWidth
              variant="default"
              justify="space-between"
              leftSection={<IconPrinter size={16} />}
              rightSection={<IconChevronRight size={16} />}
            >
              Print packing slips
            </Button>
          </Stack>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

/** Loading, disabled and full-width buttons. */
export function ButtonStates() {
  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        <Specimen
          label="loading"
          note={
            <>
              Keeps its width and blocks clicks while a request is in flight. <code>loaderProps</code> picks the loader.
            </>
          }
        >
          <Group>
            <Button loading>Saving</Button>
            <Button loading variant="default">
              Saving
            </Button>
            <Button loading color="primary" loaderProps={{ type: 'dots' }}>
              Sending
            </Button>
          </Group>
        </Specimen>
        <Specimen label="disabled" note="Every variant fades to the same neutral disabled surface.">
          <Group>
            <Button disabled>Submit</Button>
            <Button disabled variant="default">
              Cancel
            </Button>
            <Button disabled variant="light">
              Add item
            </Button>
            <Button disabled variant="subtle">
              Dismiss
            </Button>
          </Group>
        </Specimen>
        <Specimen
          label="data-disabled + Tooltip"
          note={
            <>
              Use <code>data-disabled</code> (not <code>disabled</code>) when the reason must be shown on hover.
            </>
          }
        >
          <Group>
            <Tooltip label="Only Approvers can approve orders">
              <Button data-disabled onClick={(event) => event.preventDefault()}>
                Approve order
              </Button>
            </Tooltip>
          </Group>
        </Specimen>
        <Specimen label="fullWidth" note="Fills its container: sign-in forms, drawers, mobile sheets.">
          <Stack gap="sm">
            <Button fullWidth>Sign in</Button>
            <Button fullWidth variant="default">
              Continue with SSO
            </Button>
          </Stack>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

/** Button.Group for segmented choices, split buttons and steppers. */
export function ButtonGroups() {
  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        <Specimen
          label="Button.Group"
          note="Joined buttons share borders; only the outer corners keep the pill radius."
        >
          <Button.Group>
            <Button variant="default">Day</Button>
            <Button variant="default">Week</Button>
            <Button variant="default">Month</Button>
          </Button.Group>
        </Specimen>
        <Specimen label="Split button" note="Primary action plus an icon-only button for the alternatives.">
          <Button.Group>
            <Button leftSection={<IconCheck size={16} />}>Approve</Button>
            <Button aria-label="More approval options" px="xs">
              <IconChevronDown size={16} />
            </Button>
          </Button.Group>
        </Specimen>
        <Specimen label="Button.GroupSection" note="A non-interactive segment inside a group, e.g. a quantity stepper.">
          <Button.Group>
            <Button variant="default" aria-label="Decrease quantity" px="xs">
              <IconMinus size={16} />
            </Button>
            <Button.GroupSection variant="default" miw={56}>
              12
            </Button.GroupSection>
            <Button variant="default" aria-label="Increase quantity" px="xs">
              <IconPlus size={16} />
            </Button>
          </Button.Group>
        </Specimen>
        <Specimen
          label='orientation="vertical"'
          note={
            <>
              Stacked group for narrow side panels. Vertical groups drop the pill — <code>radius=&quot;md&quot;</code>{' '}
              keeps the stacked corners even.
            </>
          }
        >
          <Button.Group orientation="vertical">
            <Button variant="default" radius="md" leftSection={<IconPencil size={16} />} justify="flex-start">
              Edit
            </Button>
            <Button variant="default" radius="md" leftSection={<IconCopy size={16} />} justify="flex-start">
              Duplicate
            </Button>
            <Button variant="default" radius="md" leftSection={<IconArchive size={16} />} justify="flex-start">
              Archive
            </Button>
          </Button.Group>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

const ACTION_ICON_VARIANTS: { variant: string; label: string }[] = [
  { variant: 'filled', label: 'filled' },
  { variant: 'light', label: 'light' },
  { variant: 'outline', label: 'outline' },
  { variant: 'default', label: 'default' },
  { variant: 'subtle', label: 'subtle' },
  { variant: 'transparent', label: 'transparent' },
];

/** ActionIcon variants, sizes, states and groups. */
export function ActionIcons() {
  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        <Specimen
          label="variant"
          note={
            <>
              Icon-only buttons default to <code>primaryColor</code> (ember). Always pass <code>aria-label</code>.
            </>
          }
          span="full"
        >
          <div className={styles.iconTiles}>
            {ACTION_ICON_VARIANTS.map(({ variant, label }) => (
              <div key={variant} className={styles.iconTile}>
                <ActionIcon variant={variant} size="lg" aria-label={`Edit (${label})`}>
                  <IconPencil size={18} />
                </ActionIcon>
                <Text size="xs" c="dimmed">
                  {label}
                </Text>
              </div>
            ))}
            <div className={styles.iconTile}>
              <ActionIcon variant="default" size="lg" color="gray" aria-label="Edit (gray default)">
                <IconPencil size={18} />
              </ActionIcon>
              <Text size="xs" c="dimmed">
                gray
              </Text>
            </div>
            <div className={styles.iconTile}>
              <ActionIcon variant="light" color="red" size="lg" aria-label="Delete (red light)">
                <IconTrash size={18} />
              </ActionIcon>
              <Text size="xs" c="dimmed">
                red light
              </Text>
            </div>
          </div>
        </Specimen>
        <Specimen label="size — xs to xl" note="Pair the icon size with the control: 14 / 16 / 18 / 20 / 24px.">
          <Group align="center">
            {SIZES.map((size, i) => (
              <ActionIcon key={size} size={size} variant="default" aria-label={`Refresh (${size})`}>
                <IconRefresh size={[12, 14, 16, 20, 24][i]} />
              </ActionIcon>
            ))}
          </Group>
        </Specimen>
        <Specimen label="loading · disabled" note="Same state model as Button.">
          <Group>
            <ActionIcon loading size="lg" aria-label="Refreshing">
              <IconRefresh size={18} />
            </ActionIcon>
            <ActionIcon loading variant="default" size="lg" aria-label="Refreshing (default)">
              <IconRefresh size={18} />
            </ActionIcon>
            <ActionIcon disabled size="lg" aria-label="Favourite (disabled)">
              <IconStar size={18} />
            </ActionIcon>
            <ActionIcon disabled variant="default" size="lg" aria-label="Delete (disabled)">
              <IconTrash size={18} />
            </ActionIcon>
          </Group>
        </Specimen>
        <Specimen label="ActionIcon.Group" note="Joined icon buttons for formatting toolbars.">
          <ActionIcon.Group>
            <FormatIcon icon={IconBold} label="Bold" />
            <FormatIcon icon={IconItalic} label="Italic" />
            <FormatIcon icon={IconUnderline} label="Underline" />
            <FormatIcon icon={IconLink} label="Insert link" />
          </ActionIcon.Group>
        </Specimen>
        <Specimen label="ActionIcon.GroupSection" note="A label segment between icon buttons: pagination.">
          <ActionIcon.Group>
            <ActionIcon variant="default" size="lg" aria-label="Previous page">
              <IconChevronLeft size={16} />
            </ActionIcon>
            <ActionIcon.GroupSection variant="default" size="lg" miw={72}>
              <Text size="sm">2 / 12</Text>
            </ActionIcon.GroupSection>
            <ActionIcon variant="default" size="lg" aria-label="Next page">
              <IconChevronRight size={16} />
            </ActionIcon>
          </ActionIcon.Group>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

function FormatIcon({ icon: IconComponent, label }: { icon: Icon; label: string }) {
  return (
    <ActionIcon variant="default" size="lg" aria-label={label}>
      <IconComponent size={16} />
    </ActionIcon>
  );
}

/** CloseButton sizes and in context (removable filter, panel header). */
export function CloseButtons() {
  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        <Specimen
          label="size — xs to xl"
          note={
            <>
              Ships with an accessible name; override it with <code>aria-label</code>.
            </>
          }
        >
          <Group align="center">
            {SIZES.map((size) => (
              <CloseButton key={size} size={size} aria-label={`Close (${size})`} />
            ))}
            <CloseButton disabled aria-label="Close (disabled)" />
          </Group>
        </Specimen>
        <Specimen label="In context" note="Dismissing an applied filter and closing a side panel.">
          <Stack gap="sm">
            <Group gap="xs">
              <Badge color="gray" rightSection={<CloseButton size="xs" aria-label="Remove filter Status: Pending" />}>
                Status: Pending
              </Badge>
              <Badge color="gray" rightSection={<CloseButton size="xs" aria-label="Remove filter Owner: Daniel" />}>
                Owner: Daniel
              </Badge>
            </Group>
            <Paper withBorder p="sm">
              <Group justify="space-between" wrap="nowrap">
                <Text fw={600} size="sm">
                  Order filters
                </Text>
                <CloseButton aria-label="Close filters panel" />
              </Group>
            </Paper>
          </Stack>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

/** CopyButton with Tooltip feedback, interactive and frozen in the copied state. */
export function CopyButtons() {
  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        <Specimen
          label="CopyButton + ActionIcon + Tooltip"
          note="Click the icon: the tooltip flips to Copied and the icon to a check for 2s."
        >
          <TextInput
            label="Webhook URL"
            value={WEBHOOK_URL}
            readOnly
            rightSection={
              <CopyButton value={WEBHOOK_URL} timeout={2000}>
                {({ copied, copy }) => (
                  <Tooltip label={copied ? 'Copied' : 'Copy'} position="left">
                    <ActionIcon
                      variant="subtle"
                      color={copied ? 'green' : 'gray'}
                      onClick={copy}
                      aria-label={copied ? 'Copied webhook URL' : 'Copy webhook URL'}
                    >
                      {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                    </ActionIcon>
                  </Tooltip>
                )}
              </CopyButton>
            }
          />
        </Specimen>
        <Specimen
          label="Copied state"
          note={
            <>
              Frozen preview: <code>Tooltip opened</code>, success colour on the icon.
            </>
          }
        >
          <div className={styles.tooltipStage}>
            <TextInput
              label="Webhook URL"
              value={WEBHOOK_URL}
              readOnly
              rightSection={
                <Tooltip label="Copied" opened withinPortal={false} zIndex={1}>
                  <ActionIcon variant="subtle" color="green" aria-label="Copied webhook URL">
                    <IconCheck size={16} />
                  </ActionIcon>
                </Tooltip>
              }
            />
          </div>
        </Specimen>
        <Specimen
          label="CopyButton + Button"
          note="Label and colour swap confirm the copy without a tooltip. Right: the copied state, frozen."
          span="full"
        >
          <Group>
            <CopyButton value="https://northwind.buildpad.app/orders/PO-2041">
              {({ copied, copy }) => (
                <Button
                  variant={copied ? 'light' : 'default'}
                  color={copied ? 'green' : undefined}
                  leftSection={copied ? <IconCheck size={16} /> : <IconLink size={16} />}
                  onClick={copy}
                >
                  {copied ? 'Link copied' : 'Copy link'}
                </Button>
              )}
            </CopyButton>
            <Button variant="light" color="green" leftSection={<IconCheck size={16} />}>
              Link copied
            </Button>
          </Group>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

/** A record toolbar: secondary, primary and an overflow menu. */
export function ActionToolbar() {
  const order = ORDERS[2];
  return (
    <Gallery>
      <SpecimenGrid cols={1}>
        <Specimen
          label="Record toolbar"
          note={
            <>
              One ink CTA, a <code>default</code> secondary, everything else behind an overflow <code>Menu</code>.
            </>
          }
          align="start"
        >
          <Card>
            <Group justify="space-between" align="flex-start" wrap="wrap">
              <div>
                <Text size="xs" c="dimmed" fw={500}>
                  Purchase orders / {order.number}
                </Text>
                <Group gap="xs" align="center">
                  <Title order={3}>{order.supplier}</Title>
                  <Badge color={ORDER_STATUS[order.status].color}>{ORDER_STATUS[order.status].label}</Badge>
                </Group>
                <Text size="sm" c="dimmed">
                  {formatMoney(order.amount)} · due {order.due}
                </Text>
              </div>
              <Group gap="sm">
                <Button variant="default">Save draft</Button>
                <Button leftSection={<IconSend size={16} />}>Submit for approval</Button>
                <OrderMenu />
              </Group>
            </Group>
          </Card>
        </Specimen>
        <Specimen
          label="Overflow menu — open"
          note={
            <>
              Static preview (<code>opened</code>, <code>withinPortal=false</code>). Destructive items go last, after a
              divider, in <code>red</code>.
            </>
          }
          surface="muted"
        >
          <div className={styles.menuStage}>
            <OrderMenu opened />
          </div>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

function OrderMenu({ opened }: { opened?: boolean }) {
  return (
    <Menu
      position="bottom-end"
      width={220}
      opened={opened}
      withinPortal={!opened}
      hideDetached={!opened}
      middlewares={opened ? { flip: false, shift: false } : undefined}
      trapFocus={!opened}
      returnFocus={!opened}
      zIndex={opened ? 1 : undefined}
    >
      <Menu.Target>
        <ActionIcon variant="default" size="lg" aria-label="More actions">
          <IconDots size={18} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Order</Menu.Label>
        <Menu.Item leftSection={<IconPencil size={16} />}>Edit details</Menu.Item>
        <Menu.Item leftSection={<IconCopy size={16} />}>Duplicate</Menu.Item>
        <Menu.Item leftSection={<IconFileExport size={16} />}>Export as PDF</Menu.Item>
        <Menu.Item leftSection={<IconArchive size={16} />} disabled>
          Archive
        </Menu.Item>
        <Menu.Divider />
        <Menu.Item color="red" leftSection={<IconTrash size={16} />}>
          Delete order
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

/** Destructive confirmation, inline and in a modal. */
export function DestructiveConfirm() {
  const [opened, { open, close }] = useDisclosure(false);
  const order = ORDERS[2];
  return (
    <Gallery>
      <SpecimenGrid cols={1}>
        <Specimen
          label="Inline confirm row"
          note={
            <>
              <code>default</code> Cancel left of a filled <code>red</code> action that names exactly what it deletes.
            </>
          }
        >
          <Paper withBorder p="md">
            <Group justify="space-between" wrap="wrap" gap="md">
              <Group gap="sm" wrap="nowrap" align="flex-start">
                <ThemeIcon color="red" variant="light" size="lg" radius="xl">
                  <IconAlertTriangle size={18} />
                </ThemeIcon>
                <div>
                  <Text fw={600} size="sm">
                    Delete {order.number}?
                  </Text>
                  <Text size="sm" c="dimmed">
                    This removes 3 line items and cannot be undone.
                  </Text>
                </div>
              </Group>
              <Group gap="sm">
                <Button variant="default">Cancel</Button>
                <Button color="red" leftSection={<IconTrash size={16} />}>
                  Delete order
                </Button>
              </Group>
            </Group>
          </Paper>
        </Specimen>
        <Specimen
          label="Confirm modal"
          note={
            <>
              The trigger is a quiet <code>light red</code>; the filled red lives only inside the confirmation.
            </>
          }
        >
          <Group>
            <Button variant="light" color="red" leftSection={<IconTrash size={16} />} onClick={open}>
              Delete order…
            </Button>
          </Group>
          <Modal
            opened={opened}
            onClose={close}
            title={`Delete ${order.number}?`}
            centered
          >
            <Stack gap="lg">
              <Text size="sm">
                {order.supplier} · {formatMoney(order.amount)}. The order, its 3 line items and its approval history
                will be permanently removed.
              </Text>
              <Group justify="flex-end" gap="sm">
                <Button variant="default" onClick={close}>
                  Cancel
                </Button>
                <Button color="red" onClick={close}>
                  Delete order
                </Button>
              </Group>
            </Stack>
          </Modal>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}
