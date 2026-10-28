'use client';

import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Chip,
  Divider,
  Group,
  Radio,
  RangeSlider,
  Rating,
  SegmentedControl,
  SimpleGrid,
  Slider,
  Stack,
  Switch,
  Text,
  Tree,
  VisuallyHidden,
  getTreeExpandedState,
  useTree,
  type RenderTreeNodePayload,
  type TreeNodeData,
} from '@mantine/core';
import {
  IconCheck,
  IconChevronRight,
  IconCode,
  IconEye,
  IconFolder,
  IconFolderOpen,
  IconLayoutGrid,
  IconLayoutKanban,
  IconList,
  IconLock,
  IconMoon,
  IconSun,
  IconTag,
  IconX,
} from '@tabler/icons-react';
import { useState, type CSSProperties, type ReactNode } from 'react';
import { Gallery } from '../Gallery';
import { Specimen, SpecimenGrid } from '../Layout';
import { ORDERS, ORDER_STATUS, formatMoney, type OrderStatus } from '../data';

const SIZES = ['xs', 'sm', 'md', 'lg', 'xl'] as const;

const SPEND_CATEGORIES: TreeNodeData[] = [
  {
    value: 'ops',
    label: 'Operations',
    children: [
      {
        value: 'ops/packaging',
        label: 'Packaging',
        children: [
          { value: 'ops/packaging/boxes', label: 'Corrugated boxes' },
          { value: 'ops/packaging/wrap', label: 'Pallet wrap' },
          { value: 'ops/packaging/fill', label: 'Void fill' },
        ],
      },
      {
        value: 'ops/warehouse',
        label: 'Warehouse',
        children: [
          { value: 'ops/warehouse/racking', label: 'Racking' },
          { value: 'ops/warehouse/forklifts', label: 'Forklift hire' },
        ],
      },
    ],
  },
  {
    value: 'facilities',
    label: 'Facilities',
    children: [
      {
        value: 'facilities/cleaning',
        label: 'Cleaning',
        children: [
          { value: 'facilities/cleaning/janitorial', label: 'Janitorial supplies' },
          { value: 'facilities/cleaning/waste', label: 'Waste removal' },
        ],
      },
      {
        value: 'facilities/utilities',
        label: 'Utilities',
        children: [
          { value: 'facilities/utilities/power', label: 'Electricity' },
          { value: 'facilities/utilities/water', label: 'Water' },
        ],
      },
    ],
  },
  {
    value: 'print',
    label: 'Print & stationery',
    children: [
      { value: 'print/toner', label: 'Toner' },
      { value: 'print/paper', label: 'Copy paper' },
    ],
  },
];

const LOCKED_CATEGORIES = new Set(['print', 'print/toner', 'print/paper']);

function leafValues(nodes: TreeNodeData[]): string[] {
  return nodes.flatMap((node) => (node.children?.length ? leafValues(node.children) : [node.value]));
}

const SELECTABLE_LEAVES = leafValues(SPEND_CATEGORIES).filter((value) => !LOCKED_CATEGORIES.has(value));

function chevronStyle(expanded: boolean): CSSProperties {
  return {
    flexShrink: 0,
    transform: expanded ? 'rotate(90deg)' : undefined,
    transition: 'transform 150ms ease',
  };
}

// Radio.Card / Checkbox.Card render a <button>, which centres its content
// vertically; flex keeps every card's content top-aligned in an even row.
const CARD_LAYOUT: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
};

const REVIEWS = [
  {
    author: 'Priya Raman',
    rating: 5,
    comment: 'Atlas Packaging delivered early and the invoices matched.',
  },
  {
    author: 'Daniel Osei',
    rating: 4,
    comment: 'Good pricing; one pallet arrived with damaged wrap.',
  },
  {
    author: 'Hana Kobayashi',
    rating: 3,
    comment: 'Support was slow to answer during the holidays.',
  },
];

const APPROVAL_STEPS = [
  { value: 'submit', label: 'Submitted by requester' },
  { value: 'manager', label: 'Approved by line manager' },
  { value: 'finance', label: 'Approved by finance' },
];

const MODULES = [
  {
    value: 'orders',
    title: 'Purchase orders',
    description: 'Requests, approvals and supplier POs.',
  },
  {
    value: 'suppliers',
    title: 'Supplier directory',
    description: 'Contacts, contracts and ratings.',
  },
  {
    value: 'reports',
    title: 'Spend reports',
    description: 'Monthly spend by team and category.',
  },
];

const PLANS = [
  {
    value: 'starter',
    title: 'Starter',
    price: '$0',
    meta: 'Up to 5 seats · community support',
  },
  {
    value: 'team',
    title: 'Team',
    price: '$12',
    meta: 'Per seat / month · approvals & workflows',
  },
  {
    value: 'enterprise',
    title: 'Enterprise',
    price: 'Custom',
    meta: 'SSO, audit log, dedicated support',
  },
];

/** Checkbox states, descriptions, sizes and the outline variant. */
export function CheckboxStates() {
  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        <Specimen
          label="States"
          note="Unchecked, checked, indeterminate and disabled. The check fills with ember (primaryColor)."
          align="start"
        >
          <Stack gap="sm">
            <Checkbox label="Unchecked" />
            <Checkbox label="Checked" defaultChecked />
            <Checkbox label="Indeterminate" indeterminate />
            <Checkbox label="Disabled" disabled />
            <Checkbox label="Disabled, checked" disabled defaultChecked />
          </Stack>
        </Specimen>
        <Specimen
          label="description · error"
          note={
            <>
              Helper text under the label; <code>error</code> turns the box and message danger red.
            </>
          }
          align="start"
        >
          <Stack gap="md">
            <Checkbox
              label="Require a second approver"
              description="Orders over $10,000 need two approvals."
              defaultChecked
            />
            <Checkbox label="I confirm the supplier details are correct" error="Confirm the details to submit" />
          </Stack>
        </Specimen>
        <Specimen label='variant="outline"' note="Outlined check on a transparent box: for light-touch lists.">
          <Group>
            <Checkbox variant="outline" label="Outline" defaultChecked />
            <Checkbox variant="outline" label="Indeterminate" indeterminate />
          </Group>
        </Specimen>
        <Specimen
          label="size — xs to xl"
          note={
            <>
              The theme default is <code>sm</code>.
            </>
          }
        >
          <Group align="center">
            {SIZES.map((size) => (
              <Checkbox key={size} size={size} defaultChecked aria-label={`Checkbox ${size}`} />
            ))}
          </Group>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

/** Checkbox.Group, a select-all parent and Checkbox.Card. */
export function CheckboxGroups() {
  const [steps, setSteps] = useState<string[]>(['submit']);
  const [modules, setModules] = useState<string[]>(['orders', 'reports']);
  const allChecked = steps.length === APPROVAL_STEPS.length;
  const indeterminate = steps.length > 0 && !allChecked;

  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        <Specimen
          label="Checkbox.Group"
          note="One label and description for the set; the value is a string array."
          align="start"
        >
          <Checkbox.Group
            label="Notify me when"
            description="Email and in-app notifications."
            defaultValue={['approved', 'comment']}
          >
            <Stack gap="xs" mt="xs">
              <Checkbox value="submitted" label="An order is submitted to me" />
              <Checkbox value="approved" label="My order is approved" />
              <Checkbox value="comment" label="Someone comments on my order" />
            </Stack>
          </Checkbox.Group>
        </Specimen>
        <Specimen
          label="Group with error"
          note={
            <>
              <code>withAsterisk</code> marks it required; the group error sits under the options.
            </>
          }
          align="start"
        >
          <Checkbox.Group label="Delivery days" withAsterisk error="Pick at least one delivery day">
            <Group gap="md" mt="xs">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((day) => (
                <Checkbox key={day} value={day} label={day} />
              ))}
            </Group>
          </Checkbox.Group>
        </Specimen>
        <Specimen
          label="Select all — indeterminate parent"
          note={
            <>
              The parent is <code>indeterminate</code> while only some children are checked. Try it.
            </>
          }
          align="start"
          span="full"
        >
          <Stack gap="xs">
            <Checkbox
              label="All approval steps complete"
              checked={allChecked}
              indeterminate={indeterminate}
              onChange={() => setSteps(allChecked ? [] : APPROVAL_STEPS.map((step) => step.value))}
            />
            <Stack gap="xs" pl="lg">
              {APPROVAL_STEPS.map((step) => (
                <Checkbox
                  key={step.value}
                  label={step.label}
                  checked={steps.includes(step.value)}
                  onChange={(event) =>
                    setSteps((current) =>
                      event.currentTarget.checked
                        ? [...current, step.value]
                        : current.filter((value) => value !== step.value),
                    )
                  }
                />
              ))}
            </Stack>
          </Stack>
        </Specimen>
        <Specimen
          label="Checkbox.Card"
          note={
            <>
              The whole card is the hit area; <code>Checkbox.Indicator</code> carries the state and a checked card takes the ember wash and border.
            </>
          }
          span="full"
        >
          <Checkbox.Group value={modules} onChange={setModules} label="Modules to enable">
            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm" mt="xs">
              {MODULES.map((module) => (
                <Checkbox.Card key={module.value} value={module.value} p="md" style={CARD_LAYOUT}>
                  <Group wrap="nowrap" align="flex-start" gap="sm">
                    <Checkbox.Indicator />
                    <div>
                      <Text fw={600} size="sm">
                        {module.title}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {module.description}
                      </Text>
                    </div>
                  </Group>
                </Checkbox.Card>
              ))}
            </SimpleGrid>
          </Checkbox.Group>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

/** Radio states, a described group and Radio.Card plan choice. */
export function Radios() {
  const [plan, setPlan] = useState('team');
  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        <Specimen label="States" note="Selected, unselected, disabled and error." align="start">
          <Stack gap="sm">
            <Radio label="Selected" checked readOnly />
            <Radio label="Unselected" checked={false} readOnly />
            <Radio label="Disabled" disabled />
            <Radio label="Disabled, selected" disabled checked readOnly />
            <Radio label="Error" error />
          </Stack>
        </Specimen>
        <Specimen
          label="Radio.Group with descriptions"
          note="Exactly one choice; each option explains its consequence."
          align="start"
        >
          <Radio.Group label="Shipping method" defaultValue="standard">
            <Stack gap="sm" mt="xs">
              <Radio value="standard" label="Standard" description="3–5 business days · free" />
              <Radio value="express" label="Express" description="Next business day · $24" />
              <Radio value="pickup" label="Warehouse pickup" description="Unavailable for this supplier" disabled />
            </Stack>
          </Radio.Group>
        </Specimen>
        <Specimen
          label='variant="outline" · sizes'
          note={
            <>
              Outline dot, then <code>xs</code> to <code>xl</code>.
            </>
          }
        >
          <Stack gap="md">
            <Group>
              <Radio variant="outline" label="Outline" checked readOnly />
              <Radio variant="outline" label="Off" checked={false} readOnly />
            </Group>
            <Group align="center">
              {SIZES.map((size) => (
                <Radio key={size} size={size} checked readOnly aria-label={`Radio ${size}`} />
              ))}
            </Group>
          </Stack>
        </Specimen>
        <Specimen
          label="Horizontal group with error"
          note={
            <>
              Inline options and a group-level <code>error</code>.
            </>
          }
          align="start"
        >
          <Radio.Group label="Payment terms" withAsterisk error="Choose payment terms">
            <Group mt="xs">
              <Radio value="net15" label="Net 15" />
              <Radio value="net30" label="Net 30" />
              <Radio value="net60" label="Net 60" />
            </Group>
          </Radio.Group>
        </Specimen>
        <Specimen
          label="Radio.Card — plan choice"
          note={
            <>
              Card-sized options with <code>Radio.Indicator</code> carrying the state and an ember wash on the chosen card; arrow keys move between them.
            </>
          }
          span="full"
        >
          <Radio.Group value={plan} onChange={setPlan} label="Workspace plan">
            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm" mt="xs">
              {PLANS.map((option) => (
                <Radio.Card key={option.value} value={option.value} p="md" style={CARD_LAYOUT}>
                  <Group wrap="nowrap" align="flex-start" gap="sm">
                    <Radio.Indicator />
                    <div>
                      <Text fw={600} size="sm">
                        {option.title}
                      </Text>
                      <Text fw={700} size="lg">
                        {option.price}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {option.meta}
                      </Text>
                    </div>
                  </Group>
                </Radio.Card>
              ))}
            </SimpleGrid>
          </Radio.Group>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

/** Switch sizes, labels, inner labels, thumb icons and a settings list. */
export function Switches() {
  const [autoApprove, setAutoApprove] = useState(true);
  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        <Specimen label="States" note="On, off, disabled and error. The track fills with ember." align="start">
          <Stack gap="sm">
            <Switch label="On" defaultChecked />
            <Switch label="Off" />
            <Switch label="Disabled" disabled />
            <Switch label="Disabled, on" disabled defaultChecked />
            <Switch label="Error" error="Required for SOC 2 workspaces" />
          </Stack>
        </Specimen>
        <Specimen
          label="size — xs to xl"
          note={
            <>
              Match the switch to the row density; <code>sm</code> is the default.
            </>
          }
          align="start"
        >
          <Stack gap="sm">
            {SIZES.map((size) => (
              <Switch key={size} size={size} defaultChecked label={size} />
            ))}
          </Stack>
        </Specimen>
        <Specimen
          label="label · description · labelPosition"
          note={
            <>
              <code>labelPosition="left"</code> for forms where the label leads.
            </>
          }
          align="start"
        >
          <Stack gap="md">
            <Switch label="Weekly digest" description="A summary of open orders every Monday." defaultChecked />
            <Switch label="Public share links" labelPosition="left" />
          </Stack>
        </Specimen>
        <Specimen
          label="onLabel / offLabel · thumbIcon"
          note="Text or icons inside the track and thumb. Use size md or larger."
        >
          <Stack gap="md">
            <Group>
              <Switch size="lg" onLabel="ON" offLabel="OFF" defaultChecked aria-label="Maintenance mode" />
              <Switch
                size="lg"
                onLabel={<IconSun size={16} stroke={2.5} />}
                offLabel={<IconMoon size={16} stroke={2.5} />}
                aria-label="Light theme"
              />
            </Group>
            <Switch
              size="md"
              label="Auto-approve under $500"
              checked={autoApprove}
              onChange={(event) => setAutoApprove(event.currentTarget.checked)}
              thumbIcon={
                autoApprove ? (
                  <IconCheck size={12} stroke={3} color="var(--ds-primary)" />
                ) : (
                  <IconX size={12} stroke={3} color="var(--ds-gray-500)" />
                )
              }
            />
          </Stack>
        </Specimen>
        <Specimen
          label="Settings list"
          note="The canonical settings row: label and description left, switch right, hairline dividers."
          span="full"
        >
          <Card padding={0}>
            <SettingRow title="Email notifications" description="Approvals, comments and mentions." defaultChecked />
            <Divider />
            <SettingRow
              title="Require approval over $10,000"
              description="Routes large orders to Finance before submission."
              defaultChecked
            />
            <Divider />
            <SettingRow
              title="Allow supplier self-service"
              description="Suppliers can update their own contact details."
            />
            <Divider />
            <SettingRow
              title="Two-factor authentication"
              description="Enforced by your organisation policy."
              defaultChecked
              disabled
            />
          </Card>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

function SettingRow({
  title,
  description,
  defaultChecked,
  disabled,
}: {
  title: string;
  description: string;
  defaultChecked?: boolean;
  disabled?: boolean;
}) {
  return (
    <Group justify="space-between" wrap="nowrap" p="md" gap="lg">
      <div>
        <Text size="sm" fw={500}>
          {title}
        </Text>
        <Text size="xs" c="dimmed">
          {description}
        </Text>
      </div>
      <Switch defaultChecked={defaultChecked} disabled={disabled} aria-label={title} />
    </Group>
  );
}

const STATUS_KEYS = Object.keys(ORDER_STATUS) as OrderStatus[];

/** Chip variants, single and multiple Chip.Group, and chips as list filters. */
export function Chips() {
  const [statuses, setStatuses] = useState<string[]>(['pending', 'approved']);
  const matching = ORDERS.filter((order) => statuses.includes(order.status));
  const total = matching.reduce((sum, order) => sum + order.amount, 0);

  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        <Specimen
          label="variant"
          note={
            <>
              <code>filled</code> (default), <code>outline</code> and <code>light</code>, checked and unchecked.
            </>
          }
          align="start"
        >
          <Stack gap="sm">
            <Group gap="xs">
              <Chip defaultChecked>Filled</Chip>
              <Chip>Filled</Chip>
            </Group>
            <Group gap="xs">
              <Chip variant="outline" defaultChecked>
                Outline
              </Chip>
              <Chip variant="outline">Outline</Chip>
            </Group>
            <Group gap="xs">
              <Chip variant="light" defaultChecked>
                Light
              </Chip>
              <Chip variant="light">Light</Chip>
            </Group>
          </Stack>
        </Specimen>
        <Specimen
          label="size · disabled"
          note="xs to xl; a disabled chip keeps its checked state visible."
          align="start"
        >
          <Group gap="xs" align="center">
            {SIZES.map((size) => (
              <Chip key={size} size={size} defaultChecked>
                {size}
              </Chip>
            ))}
          </Group>
          <Group gap="xs">
            <Chip disabled>Disabled</Chip>
            <Chip disabled defaultChecked>
              Disabled
            </Chip>
          </Group>
        </Specimen>
        <Specimen
          label="Chip.Group — single"
          note={
            <>
              Without <code>multiple</code>, chips behave like radios.
            </>
          }
          align="start"
        >
          <Chip.Group defaultValue="30d">
            <Group gap="xs">
              <Chip value="7d">Last 7 days</Chip>
              <Chip value="30d">Last 30 days</Chip>
              <Chip value="qtd">Quarter to date</Chip>
              <Chip value="ytd">Year to date</Chip>
            </Group>
          </Chip.Group>
        </Specimen>
        <Specimen
          label="Chip.Group — multiple"
          note={
            <>
              <code>multiple</code> returns a string array, like Checkbox.Group.
            </>
          }
          align="start"
        >
          <Chip.Group multiple defaultValue={['Packaging', 'Freight']}>
            <Group gap="xs">
              {['Packaging', 'Freight', 'Facilities', 'Catering', 'Software', 'Office'].map((category) => (
                <Chip key={category} value={category} variant="outline">
                  {category}
                </Chip>
              ))}
            </Group>
          </Chip.Group>
        </Specimen>
        <Specimen
          label="Chips as list filters"
          note="Status filters above an order list; toggle them and the summary updates."
          align="start"
          span="full"
        >
          <Chip.Group multiple value={statuses} onChange={setStatuses}>
            <Group gap="xs">
              {STATUS_KEYS.map((status) => (
                <Chip key={status} value={status} size="sm">
                  {ORDER_STATUS[status].label} · {ORDERS.filter((order) => order.status === status).length}
                </Chip>
              ))}
            </Group>
          </Chip.Group>
          <Text size="sm" c="dimmed">
            {matching.length === 0
              ? 'No orders match these filters.'
              : `${matching.length} of ${ORDERS.length} orders · ${formatMoney(total)}`}
          </Text>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

function IconLabel({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <Group gap={6} wrap="nowrap" justify="center">
      {icon}
      <span>{children}</span>
    </Group>
  );
}

/** SegmentedControl sizes, full width, icons, colour and disabled states. */
export function SegmentedControls() {
  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        <Specimen label="Default" note="A raised indicator slides over a neutral track. Best for 2–5 options.">
          <SegmentedControl data={['All', 'Open', 'Closed']} defaultValue="Open" />
        </Specimen>
        <Specimen label='color="primary"' note="A filled ember indicator for a stronger selected state.">
          <SegmentedControl color="primary" data={['Monthly', 'Yearly']} defaultValue="Yearly" />
        </Specimen>
        <Specimen label="size — xs to xl" note="Pair with the surrounding controls." span="full">
          <Stack gap="sm" align="flex-start">
            {SIZES.map((size) => (
              <SegmentedControl key={size} size={size} data={['Day', 'Week', 'Month']} defaultValue="Week" />
            ))}
          </Stack>
        </Specimen>
        <Specimen
          label="fullWidth · with icons"
          note="View switchers above a data view; icons go inside the label."
          span="full"
        >
          <SegmentedControl
            fullWidth
            defaultValue="table"
            data={[
              {
                value: 'table',
                label: <IconLabel icon={<IconList size={16} />}>Table</IconLabel>,
              },
              {
                value: 'cards',
                label: <IconLabel icon={<IconLayoutGrid size={16} />}>Cards</IconLabel>,
              },
              {
                value: 'board',
                label: <IconLabel icon={<IconLayoutKanban size={16} />}>Board</IconLabel>,
              },
            ]}
          />
        </Specimen>
        <Specimen
          label="Icon-only"
          note={
            <>
              Hide the text with <code>VisuallyHidden</code> so the option keeps an accessible name.
            </>
          }
        >
          <Group>
            <SegmentedControl
              defaultValue="preview"
              data={[
                {
                  value: 'preview',
                  label: (
                    <>
                      <IconEye size={16} />
                      <VisuallyHidden>Preview</VisuallyHidden>
                    </>
                  ),
                },
                {
                  value: 'code',
                  label: (
                    <>
                      <IconCode size={16} />
                      <VisuallyHidden>Code</VisuallyHidden>
                    </>
                  ),
                },
              ]}
            />
          </Group>
        </Specimen>
        <Specimen label="disabled" note="The whole control, or a single option.">
          <Stack gap="sm" align="flex-start">
            <SegmentedControl disabled data={['Draft', 'Live']} defaultValue="Draft" />
            <SegmentedControl
              defaultValue="editor"
              data={[
                { value: 'viewer', label: 'Viewer' },
                { value: 'editor', label: 'Editor' },
                { value: 'admin', label: 'Admin', disabled: true },
              ]}
            />
          </Stack>
        </Specimen>
        <Specimen label='orientation="vertical"' note="Stacked options for a narrow side panel.">
          <Group>
            <SegmentedControl
              orientation="vertical"
              data={['Overview', 'Line items', 'Approvals', 'History']}
              defaultValue="Line items"
            />
          </Group>
        </Specimen>
        <Specimen label="readOnly" note="Shows the current value without allowing a change, e.g. a period locked by policy.">
          <Group>
            <SegmentedControl readOnly data={['Monthly', 'Quarterly', 'Yearly']} defaultValue="Quarterly" />
          </Group>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

const PERCENT_MARKS = [0, 25, 50, 75, 100].map((value) => ({
  value,
  label: `${value}%`,
}));
const BUDGET_MARKS = [0, 25000, 50000, 75000, 100000].map((value) => ({
  value,
  label: value === 0 ? '$0' : `$${value / 1000}k`,
}));

/** Slider and RangeSlider with marks, labels and disabled state. */
export function Sliders() {
  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        <Specimen
          label="Slider"
          note="Drag or use arrow keys; the value label appears while dragging or hovering."
          align="start"
        >
          <Text size="sm" fw={500}>
            Stock reorder threshold
          </Text>
          <Slider defaultValue={30} label={(value) => `${value}%`} aria-label="Stock reorder threshold" />
        </Specimen>
        <Specimen label="labelAlwaysOn" note="Pin the value label when the number itself matters." align="start">
          <Text size="sm" fw={500}>
            Approval quorum
          </Text>
          <Slider defaultValue={60} labelAlwaysOn label={(value) => `${value}%`} mt="lg" aria-label="Approval quorum" />
        </Specimen>
        <Specimen
          label="marks · step"
          note={
            <>
              <code>marks</code> with labels; <code>step=&#123;25&#125;</code> snaps to them.
            </>
          }
          align="start"
        >
          <Text size="sm" fw={500}>
            Budget alert at
          </Text>
          <Slider
            defaultValue={75}
            step={25}
            marks={PERCENT_MARKS}
            label={(value) => `${value}%`}
            mb="lg"
            aria-label="Budget alert at"
          />
        </Specimen>
        <Specimen label="disabled · sizes" note="Disabled track, then xs, md and xl thickness." align="start">
          <Stack gap="lg">
            <Slider defaultValue={40} disabled aria-label="Disabled slider" />
            <Slider defaultValue={40} size="xs" aria-label="Slider xs" />
            <Slider defaultValue={40} size="md" aria-label="Slider md" />
            <Slider defaultValue={40} size="xl" aria-label="Slider xl" />
          </Stack>
        </Specimen>
        <Specimen
          label="RangeSlider"
          note={
            <>
              Two thumbs for a min/max filter; <code>minRange</code> keeps them apart. Labels use the shared{' '}
              <code>formatMoney</code>.
            </>
          }
          align="start"
          span="full"
        >
          <Text size="sm" fw={500}>
            Order amount
          </Text>
          <RangeSlider
            min={0}
            max={100000}
            step={1000}
            minRange={5000}
            defaultValue={[10000, 50000]}
            marks={BUDGET_MARKS}
            label={(value) => formatMoney(value)}
            mb="lg"
            thumbFromLabel="Minimum order amount"
            thumbToLabel="Maximum order amount"
          />
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

/** Rating: interactive, fractional read-only and sizes. */
export function Ratings() {
  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        <Specimen label="Interactive" note="Stars fill with the yellow alias, i.e. the warning scale." align="start">
          <Text size="sm" fw={500}>
            Rate this supplier
          </Text>
          <Rating defaultValue={4} aria-label="Rate this supplier" />
        </Specimen>
        <Specimen
          label="readOnly · fractions"
          note={
            <>
              <code>fractions=&#123;2&#125;</code> renders half stars for averages.
            </>
          }
          align="start"
        >
          <Group gap="xs">
            <Rating value={4.5} fractions={2} readOnly aria-label="Average rating 4.5 of 5" />
            <Text size="sm" fw={600}>
              4.5
            </Text>
            <Text size="sm" c="dimmed">
              · 128 reviews
            </Text>
          </Group>
        </Specimen>
        <Specimen
          label="size — xs to xl"
          note={
            <>
              <code>sm</code> is the default.
            </>
          }
          align="start"
        >
          <Stack gap="xs">
            {SIZES.map((size) => (
              <Group key={size} gap="sm" wrap="nowrap">
                <Text size="xs" c="dimmed" w={20}>
                  {size}
                </Text>
                <Rating size={size} value={3} readOnly aria-label={`Rating ${size}, 3 of 5`} />
              </Group>
            ))}
          </Stack>
        </Specimen>
        <Specimen
          label="In context — supplier reviews"
          note={
            <>
              Read-only <code>xs</code> stars beside each review.
            </>
          }
          align="start"
        >
          <Stack gap="md">
            {REVIEWS.map((review) => (
              <div key={review.author}>
                <Group justify="space-between" wrap="nowrap">
                  <Text size="sm" fw={500}>
                    {review.author}
                  </Text>
                  <Rating size="xs" value={review.rating} readOnly aria-label={`${review.rating} of 5`} />
                </Group>
                <Text size="xs" c="dimmed">
                  {review.comment}
                </Text>
              </div>
            ))}
          </Stack>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

function BrowseNode({ node, expanded, hasChildren, elementProps }: RenderTreeNodePayload) {
  const BranchIcon = expanded ? IconFolderOpen : IconFolder;
  return (
    <Group gap={6} wrap="nowrap" py={5} pr="xs" {...elementProps}>
      {hasChildren ? (
        <IconChevronRight size={14} style={chevronStyle(expanded)} color="var(--mantine-color-dimmed)" />
      ) : (
        <Box w={14} />
      )}
      {hasChildren ? (
        <BranchIcon size={16} color="var(--mantine-color-dimmed)" />
      ) : (
        <IconTag size={14} color="var(--mantine-color-dimmed)" />
      )}
      <Text size="sm" fw={hasChildren ? 500 : 400} truncate>
        {node.label}
      </Text>
    </Group>
  );
}

function CheckNode({ node, expanded, hasChildren, elementProps, tree }: RenderTreeNodePayload) {
  const checked = tree.isNodeChecked(node.value);
  const indeterminate = tree.isNodeIndeterminate(node.value);
  const locked = LOCKED_CATEGORIES.has(node.value);
  const label = String(node.label);
  return (
    <Group gap={6} wrap="nowrap" py={3} {...elementProps}>
      {hasChildren ? (
        <ActionIcon
          variant="subtle"
          color="gray"
          size="sm"
          tabIndex={-1}
          aria-label={`${expanded ? 'Collapse' : 'Expand'} ${label}`}
          onClick={(event) => {
            event.stopPropagation();
            tree.toggleExpanded(node.value);
          }}
        >
          <IconChevronRight size={14} style={chevronStyle(expanded)} />
        </ActionIcon>
      ) : (
        <Box w={22} />
      )}
      <Checkbox
        size="sm"
        label={label}
        checked={checked}
        indeterminate={indeterminate}
        disabled={locked}
        onChange={() => (checked ? tree.uncheckNode(node.value) : tree.checkNode(node.value))}
      />
      {locked && hasChildren && (
        <Badge size="xs" color="gray" leftSection={<IconLock size={10} />}>
          Locked
        </Badge>
      )}
    </Group>
  );
}

/** Tree: an expandable category browser and a cascading checkbox tree. */
export function TreeSelection() {
  const browseTree = useTree({
    initialExpandedState: getTreeExpandedState(SPEND_CATEGORIES, [
      'ops',
      'ops/packaging',
      'facilities',
      'facilities/utilities',
      'print',
    ]),
    initialSelectedState: ['ops/packaging/boxes'],
  });
  const checkTree = useTree({
    initialExpandedState: getTreeExpandedState(SPEND_CATEGORIES, [
      'ops',
      'ops/packaging',
      'facilities',
      'facilities/cleaning',
      'print',
    ]),
    initialCheckedState: [
      'ops/packaging/boxes',
      'ops/packaging/wrap',
      'ops/packaging/fill',
      'facilities/cleaning/janitorial',
      'print/toner',
    ],
  });
  const selectedCount = checkTree
    .getCheckedNodes()
    .filter((status) => status.checked && !status.hasChildren && !LOCKED_CATEGORIES.has(status.value)).length;

  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        <Specimen
          label="Expandable tree"
          note={
            <>
              <code>useTree</code> with <code>selectOnClick</code>; the selected row takes the neutral gray wash.
              Arrow keys walk and expand nodes.
            </>
          }
          align="start"
        >
          <Tree
            data={SPEND_CATEGORIES}
            tree={browseTree}
            selectOnClick
            levelOffset="md"
            renderNode={BrowseNode}
            aria-label="Spend categories"
            w="100%"
          />
        </Specimen>
        <Specimen
          label="Checkbox tree"
          note={
            <>
              <code>renderNode</code> with <code>tree.isNodeChecked</code> / <code>isNodeIndeterminate</code>: parents
              cascade to children and show indeterminate when partly selected. The locked branch is
              <code> disabled</code>.
            </>
          }
          align="start"
        >
          <Stack gap="xs" w="100%">
            <Group justify="space-between" align="flex-start" wrap="nowrap">
              <div>
                <Text size="sm" fw={500}>
                  Approver scope
                </Text>
                <Text size="xs" c="dimmed">
                  {selectedCount} of {SELECTABLE_LEAVES.length} categories selected
                </Text>
              </div>
              <Button
                variant="subtle"
                size="compact-xs"
                disabled={selectedCount === 0}
                onClick={() => SELECTABLE_LEAVES.forEach((value) => checkTree.uncheckNode(value))}
              >
                Clear
              </Button>
            </Group>
            <Tree
              data={SPEND_CATEGORIES}
              tree={checkTree}
              expandOnClick={false}
              expandOnSpace={false}
              levelOffset="lg"
              renderNode={CheckNode}
              aria-label="Approver scope by spend category"
            />
          </Stack>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}
