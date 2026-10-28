'use client';

import {
  Anchor,
  Badge,
  Blockquote,
  Box,
  Card,
  Code,
  Divider,
  Group,
  Highlight,
  Kbd,
  List,
  Mark,
  Stack,
  Text,
  ThemeIcon,
  Title,
  Typography,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconBug,
  IconCircleCheck,
  IconInfoCircle,
  IconQuote,
  IconSparkles,
} from '@tabler/icons-react';
import { Gallery } from '../Gallery';
import { Specimen, SpecimenGrid } from '../Layout';
import { ACTIVITY, ORDERS, USERS, formatMoney } from '../data';
import styles from './typography.module.css';

const HEADINGS = [
  { order: 1, size: '34px', sample: 'Operations overview' },
  { order: 2, size: '26px', sample: 'Purchase orders' },
  { order: 3, size: '22px', sample: 'Atlas Packaging' },
  { order: 4, size: '18px', sample: 'Approval history' },
  { order: 5, size: '16px', sample: 'Line items' },
  { order: 6, size: '14px', sample: 'Attachments' },
] as const;

/** Title order 1–6 in Inter Tight with the theme's heading line-heights. */
export function TitleScale() {
  return (
    <Gallery>
      <SpecimenGrid cols={1}>
        <Specimen
          label="Title"
          align="start"
          note={
            <>
              <code>Title order=&#123;1–6&#125;</code> — Inter Tight (<code>--ds-font-display</code>), weight
              600, tracking <code>--ds-letter-spacing-tight</code> (<code>-tighter</code> on h1). Use one h1
              per page (the page title); h3/h4 for card and section titles.
            </>
          }
        >
          <Stack gap="md">
            {HEADINGS.map((h) => (
              <div key={h.order} className={styles.scaleRow}>
                <div className={styles.scaleMeta}>
                  <Text size="xs" fw={600}>
                    h{h.order}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {h.size}
                  </Text>
                </div>
                <Title order={h.order} className={styles.minw0}>
                  {h.sample}
                </Title>
              </div>
            ))}
          </Stack>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

const TEXT_SIZES = [
  { size: 'xs', px: '12px', token: '--ds-font-size-xs', use: 'Captions, table headers, badges' },
  { size: 'sm', px: '13px', token: 'theme', use: 'Labels, secondary text, dense tables' },
  { size: 'md', px: '14px', token: '--ds-body-font-size', use: 'Body text — the default' },
  { size: 'lg', px: '16px', token: '--ds-font-size-base', use: 'Lead paragraphs, modal titles' },
  { size: 'xl', px: '20px', token: '--ds-font-size-xl', use: 'KPI values, emphasis' },
] as const;

/** Text sizes xs–xl and font weights. */
export function TextScale() {
  return (
    <Gallery>
      <SpecimenGrid cols={1}>
        <Specimen
          label="Text sizes"
          align="start"
          note={
            <>
              <code>Text size=&quot;xs&quot; … &quot;xl&quot;</code> — Inter. <code>md</code> (14px) is the
              body size and the default; <code>sm</code> is the theme&apos;s 13px step for labels.
            </>
          }
        >
          <Stack gap="sm">
            {TEXT_SIZES.map((t) => (
              <div key={t.size} className={styles.scaleRow}>
                <div className={styles.scaleMeta}>
                  <Text size="xs" fw={600}>
                    {t.size}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {t.px}
                  </Text>
                </div>
                <div className={styles.minw0}>
                  <Text size={t.size}>{t.use}</Text>
                  <Text size="xs" c="dimmed" ff="monospace">
                    {t.token}
                  </Text>
                </div>
              </div>
            ))}
          </Stack>
        </Specimen>
        <SpecimenGrid cols={2}>
          <Specimen
            label="Weights"
            align="start"
            note={
              <>
                <code>fw=&#123;400 | 500 | 600 | 700&#125;</code> — 500 for labels and nav, 600 for emphasis
                and titles, 700 sparingly (section labels).
              </>
            }
          >
            <Stack gap={6}>
              {[400, 500, 600, 700].map((w) => (
                <Group key={w} gap="md" wrap="nowrap">
                  <Text size="xs" c="dimmed" w={28}>
                    {w}
                  </Text>
                  <Text fw={w}>Approve purchase order</Text>
                </Group>
              ))}
            </Stack>
          </Specimen>
          <Specimen
            label="Section label"
            align="start"
            note={
              <>
                <code>
                  size=&quot;xs&quot; fw=&#123;700&#125; c=&quot;dimmed&quot; tt=&quot;uppercase&quot;
                </code>{' '}
                — the sidebar and card group heading.
              </>
            }
          >
            <Text size="xs" fw={700} c="dimmed" tt="uppercase" className={styles.tracked}>
              Recent activity
            </Text>
            <Stack gap={8}>
              {ACTIVITY.slice(0, 3).map((a) => (
                <Text key={a.id} size="sm">
                  <Text span inherit fw={600}>
                    {a.user.name}
                  </Text>{' '}
                  {a.action} {a.target.split(' · ')[0]}{' '}
                  <Text span inherit c="dimmed" size="xs">
                    · {a.time}
                  </Text>
                </Text>
              ))}
            </Stack>
          </Specimen>
        </SpecimenGrid>
      </SpecimenGrid>
    </Gallery>
  );
}

/** Colour, truncation, clamping and inheritance on Text. */
export function TextStyles() {
  const long = `${ORDERS[1].supplier} — freight consolidation for the Q4 peak, including weekend dock slots, customs pre-clearance, temperature-controlled trailers for the catering lines and a weekly exception report to Fulfilment.`;
  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        <Specimen
          label="Colour"
          align="start"
          note={
            <>
              Default ink (<code>--ds-ink</code>), <code>c=&quot;dimmed&quot;</code> (
              <code>--ds-ink-secondary</code>), <code>c=&quot;primary.7&quot;</code> accent (AA ember text)
              and the 700 stop of the status hues.
            </>
          }
        >
          <Stack gap={6}>
            <Text>Default text — ink</Text>
            <Text c="dimmed">Dimmed — secondary information</Text>
            <Text c="primary.7" fw={500}>
              Accent — primary.7
            </Text>
            <Text c="red.7">Danger — red.7 → danger-700</Text>
            <Text c="green.7">Success — green.7 → success-700</Text>
          </Stack>
        </Specimen>
        <Specimen
          label="Transform & decoration"
          align="start"
          note={
            <>
              <code>tt</code>, <code>fs</code>, <code>td</code> and <code>ff=&quot;monospace&quot;</code>{' '}
              (JetBrains Mono).
            </>
          }
        >
          <Stack gap={6}>
            <Text tt="uppercase" size="sm" fw={600}>
              Uppercase label
            </Text>
            <Text fs="italic">Italic — drafts and placeholders</Text>
            <Text td="line-through" c="dimmed">
              {formatMoney(ORDERS[0].amount)}
            </Text>
            <Text ff="monospace" size="sm">
              {ORDERS[0].number} · ord_8f2k1x
            </Text>
          </Stack>
        </Specimen>
        <Specimen
          label="Truncate"
          align="start"
          note={
            <>
              <code>truncate=&quot;end&quot;</code> (default) and <code>truncate=&quot;start&quot;</code> —
              single line with an ellipsis; needs a width-bounded parent.
            </>
          }
        >
          <Stack gap="xs" className={styles.bounded}>
            <Text truncate="end">{long}</Text>
            <Text truncate="start" c="dimmed" size="sm">
              files/suppliers/atlas-packaging/contracts/2026/master-services-agreement-v4-signed.pdf
            </Text>
          </Stack>
        </Specimen>
        <Specimen
          label="Line clamp"
          align="start"
          note={
            <>
              <code>lineClamp=&#123;2&#125;</code> — multi-line truncation for card descriptions.
            </>
          }
        >
          <Text lineClamp={2}>{long}</Text>
        </Specimen>
        <Specimen
          label="Inherit"
          span="full"
          align="start"
          note={
            <>
              <code>inherit</code> and <code>span</code> — nested Text takes the parent&apos;s size and
              family, so you can emphasise words inside a Title or paragraph.
            </>
          }
        >
          <Title order={3}>
            Spend is{' '}
            <Text span inherit c="primary.7">
              4.1% over
            </Text>{' '}
            last month
          </Title>
          <Text size="sm" c="dimmed">
            Approved by{' '}
            <Text span inherit fw={600}>
              {USERS[2].name}
            </Text>{' '}
            on 27 Oct.
          </Text>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

/** Highlight (search matches) and Mark. */
export function HighlightMark() {
  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        <Specimen
          label="Highlight"
          align="start"
          note={
            <>
              <code>Highlight highlight=&#123;[&apos;atlas&apos;, &apos;packaging&apos;]&#125;</code> — marks
              search matches in results; case-insensitive.
            </>
          }
        >
          <Stack gap="xs">
            {[
              'Atlas Packaging — corrugated cartons',
              'Packaging consumables, Q4',
              'Atlas freight surcharge',
            ].map((line) => (
              <Highlight key={line} highlight={['atlas', 'packaging']} size="sm">
                {line}
              </Highlight>
            ))}
          </Stack>
        </Specimen>
        <Specimen
          label="Mark & colour"
          align="start"
          note={
            <>
              <code>Mark</code> defaults to <code>yellow</code> (→ warning tint); <code>color</code> on Mark /
              Highlight takes any theme hue.
            </>
          }
        >
          <Text size="sm">
            Delivery moved to <Mark>04 Nov</Mark> after the carrier delay.
          </Text>
          <Highlight highlight="approved" color="green" size="sm">
            PO-2040 approved by Finance; PO-2037 approved by Platform.
          </Highlight>
          <Highlight highlight="ember" color="primary" size="sm">
            The ember accent marks interactive state.
          </Highlight>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

/** Blockquote with citation and icon. */
export function BlockquoteDemo() {
  return (
    <Gallery>
      <SpecimenGrid cols={1}>
        <Specimen
          label="Blockquote"
          align="start"
          note={
            <>
              <code>Blockquote cite icon</code> — defaults to the primary colour (ember rule, soft wash). Pass{' '}
              <code>color=&quot;blue&quot;</code> (→ info) for neutral callouts in comments and notes.
            </>
          }
        >
          <Stack gap="xl" className={styles.quoteStack}>
            <Blockquote cite={`— ${USERS[2].name}, Finance`} icon={<IconQuote size={20} />}>
              Approved on condition that the Q4 rebate is credited against the next invoice. Please attach the
              signed rate card before dispatch.
            </Blockquote>
            <Blockquote
              color="blue"
              cite="— Fulfilment playbook"
              icon={<IconInfoCircle size={20} />}
              iconSize={36}
            >
              Orders over $25,000 need a second approver from a different team.
            </Blockquote>
          </Stack>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

/** List: unordered, ordered, nested and with icons. */
export function ListDemo() {
  return (
    <Gallery>
      <div>
        <SpecimenGrid cols={2}>
          <Specimen label="Unordered" align="start" note={<code>List</code>}>
            <List size="sm">
              <List.Item>Two scheduled drops per week</List.Item>
              <List.Item>Urgent orders ship next day</List.Item>
              <List.Item>Rebate above 40,000 units</List.Item>
            </List>
          </Specimen>
          <Specimen label="Ordered" align="start" note={<code>List type=&quot;ordered&quot;</code>}>
            <List type="ordered" size="sm">
              <List.Item>Create the purchase order</List.Item>
              <List.Item>Request budget approval</List.Item>
              <List.Item>Send to supplier</List.Item>
            </List>
          </Specimen>
          <Specimen
            label="Nested"
            align="start"
            note={
              <>
                <code>withPadding</code> on the inner list indents it.
              </>
            }
          >
            <List size="sm">
              <List.Item>Packaging</List.Item>
              <List.Item>
                Freight
                <List withPadding listStyleType="circle" size="sm">
                  <List.Item>Road</List.Item>
                  <List.Item>Sea</List.Item>
                </List>
              </List.Item>
              <List.Item>Facilities</List.Item>
            </List>
          </Specimen>
          <Specimen
            label="With icons"
            align="start"
            note={
              <>
                <code>icon=&#123;&lt;ThemeIcon /&gt;&#125;</code> per list or per item,{' '}
                <code>spacing=&quot;xs&quot;</code> — checklists and plan features.
              </>
            }
          >
            <List
              size="sm"
              spacing="xs"
              center
              icon={
                <ThemeIcon color="green" size={20} radius="xl">
                  <IconCircleCheck size={14} />
                </ThemeIcon>
              }
            >
              <List.Item>Supplier verified</List.Item>
              <List.Item>Budget available</List.Item>
              <List.Item
                icon={
                  <ThemeIcon color="yellow" size={20} radius="xl">
                    <IconAlertTriangle size={14} />
                  </ThemeIcon>
                }
              >
                Rate card missing
              </List.Item>
            </List>
          </Specimen>
        </SpecimenGrid>
      </div>
    </Gallery>
  );
}

/** Inline Code, code blocks and Kbd shortcuts in prose. */
export function CodeKbd() {
  return (
    <Gallery>
      <SpecimenGrid cols={1}>
        <Specimen
          label="Code & Kbd in prose"
          align="start"
          note={
            <>
              <code>Code</code> inline and <code>Code block</code> (JetBrains Mono); <code>Kbd</code> for
              keyboard shortcuts.
            </>
          }
        >
          <Text size="sm">
            Set <Code>status</Code> to <Code>approved</Code> to release the order, or press <Kbd>⌘</Kbd> +{' '}
            <Kbd>Enter</Kbd> in the form. Open search anywhere with <Kbd>⌘</Kbd> + <Kbd>K</Kbd>.
          </Text>
          <Code block>{`await daas.items('purchase_orders').updateOne('${ORDERS[0].id}', {
  status: 'approved',
  approved_by: '${USERS[2].id}',
});`}</Code>
          <Group gap="xs">
            <Kbd size="xs">Esc</Kbd>
            <Kbd size="sm">Tab</Kbd>
            <Kbd size="md">Shift</Kbd>
            <Text size="xs" c="dimmed">
              Kbd sizes xs · sm · md
            </Text>
          </Group>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

/** Rich text rendered through Mantine's Typography styles (CMS / markdown output). */
export function RichText() {
  return (
    <Gallery>
      <SpecimenGrid cols={1}>
        <Specimen
          label="Typography"
          align="start"
          note={
            <>
              <code>Typography</code> (formerly <code>TypographyStylesProvider</code>) styles raw HTML —
              headings, lists, tables, code, quotes — for content from a rich-text field or markdown.
            </>
          }
        >
          <Typography>
            <h2>Supplier onboarding</h2>
            <p>
              Every new supplier goes through a <strong>three-step review</strong> before their first order.
              The checklist lives in the <a href="#">supplier handbook</a>; this page summarises it.
            </p>
            <h3>What we check</h3>
            <ul>
              <li>Company registration and tax number</li>
              <li>
                Insurance certificate, valid for at least <em>12 months</em>
              </li>
              <li>Bank details, confirmed by a call-back</li>
            </ul>
            <h3>Approval limits</h3>
            <table>
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Limit</th>
                  <th>Second approver</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Editor</td>
                  <td>$5,000</td>
                  <td>Not required</td>
                </tr>
                <tr>
                  <td>Approver</td>
                  <td>$25,000</td>
                  <td>Above limit</td>
                </tr>
                <tr>
                  <td>Administrator</td>
                  <td>Unlimited</td>
                  <td>Above $100,000</td>
                </tr>
              </tbody>
            </table>
            <blockquote>Never change bank details from an email request alone.</blockquote>
            <p>
              Suppliers are created through the API with <code>POST /items/suppliers</code>:
            </p>
            <pre>
              <code>{`{ "name": "Atlas Packaging", "category": "Packaging", "status": "review" }`}</code>
            </pre>
          </Typography>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

const RELEASES = [
  {
    version: '2.4.0',
    date: '28 Oct 2026',
    tag: { label: 'Latest', color: 'primary' },
    summary:
      'Bulk approvals and a faster orders list. Approvers can now act on up to 50 purchase orders at once, and the list loads in under 300 ms for workspaces with 100k orders.',
    groups: [
      {
        title: 'New',
        icon: IconSparkles,
        color: 'primary',
        items: [
          'Bulk approve and reject from the orders list, with a single comment for every order.',
          <>
            Saved filters — pin <Code>Status: Pending approval</Code> and <Code>Owner: me</Code> to the
            sidebar.
          </>,
        ],
      },
      {
        title: 'Fixed',
        icon: IconBug,
        color: 'green',
        items: [
          'Totals no longer round to the nearest dollar on multi-currency orders.',
          <>
            Pressing <Kbd size="xs">Esc</Kbd> inside a date field closed the whole drawer.
          </>,
        ],
      },
    ],
  },
  {
    version: '2.3.2',
    date: '14 Oct 2026',
    tag: { label: 'Patch', color: 'gray' },
    summary: 'Security and reliability fixes. No action needed.',
    groups: [
      {
        title: 'Fixed',
        icon: IconBug,
        color: 'green',
        items: [
          'File uploads over 25 MB resume after a dropped connection.',
          'Session timeout now warns two minutes ahead.',
        ],
      },
    ],
  },
] as const;

/** A long-form release-notes page: the type system in a real reading context. */
export function ReleaseNotes() {
  return (
    <Gallery>
      <SpecimenGrid cols={1}>
        <Specimen
          label="Release notes"
          align="start"
          surface="muted"
          note={
            <>
              A changelog page composed from <code>Title</code>, <code>Text</code>, <code>Badge</code>,{' '}
              <code>List</code>, <code>Code</code>, <code>Kbd</code>, <code>Divider</code> and{' '}
              <code>Anchor</code> on a <code>Card</code>.
            </>
          }
        >
          <Card padding="xl">
            <Text size="xs" fw={700} c="dimmed" tt="uppercase" className={styles.tracked}>
              Changelog
            </Text>
            <Title order={2} mt={4}>
              What&apos;s new in Northwind Ops
            </Title>
            <Text c="dimmed" mt="xs" mb="lg">
              Product updates for the operations workspace.{' '}
              <Anchor href="#" onClick={(e) => e.preventDefault()} inherit>
                Subscribe to updates
              </Anchor>
            </Text>
            {RELEASES.map((release, index) => (
              <Box key={release.version}>
                {index > 0 && <Divider my="xl" />}
                <Group gap="sm" mb={4}>
                  <Title order={3}>Version {release.version}</Title>
                  <Badge color={release.tag.color}>{release.tag.label}</Badge>
                </Group>
                <Text size="sm" c="dimmed" mb="md">
                  {release.date}
                </Text>
                <Text mb="lg" className={styles.measure}>
                  {release.summary}
                </Text>
                <Stack gap="lg">
                  {release.groups.map((group) => {
                    const Icon = group.icon;
                    return (
                      <div key={group.title}>
                        <Group gap="xs" mb="xs">
                          <ThemeIcon variant="light" color={group.color} size="sm" radius="xl">
                            <Icon size={12} />
                          </ThemeIcon>
                          <Title order={5}>{group.title}</Title>
                        </Group>
                        <List size="sm" spacing={6} className={styles.measure}>
                          {group.items.map((item, i) => (
                            <List.Item key={i}>{item}</List.Item>
                          ))}
                        </List>
                      </div>
                    );
                  })}
                </Stack>
              </Box>
            ))}
          </Card>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}
