'use client';

import {
  AspectRatio,
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  Center,
  Container,
  Divider,
  Flex,
  Grid,
  Group,
  Paper,
  ScrollArea,
  Select,
  SimpleGrid,
  Space,
  Stack,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  IconArrowDownRight,
  IconArrowUpRight,
  IconBuildingStore,
  IconCalendar,
  IconPhoto,
  IconPlayerPlay,
  IconSearch,
} from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { Gallery } from '../Gallery';
import { Specimen, SpecimenGrid } from '../Layout';
import { ACTIVITY, KPIS, ORDERS, ORDER_STATUS, USERS, formatMoney } from '../data';
import styles from './layout.module.css';

/** A token-filled guide box that makes layout primitives visible. */
function Guide({ children, h, className }: { children?: ReactNode; h?: number; className?: string }) {
  return (
    <div className={`${styles.guide} ${className ?? ''}`} style={h ? { minHeight: h } : undefined}>
      {children}
    </div>
  );
}

const CONTAINER_SIZES = [
  { size: 'xs', px: 540 },
  { size: 'sm', px: 720 },
  { size: 'md', px: 960 },
  { size: 'lg', px: 1140 },
  { size: 'xl', px: 1320 },
] as const;

/** Container max-widths, drawn to scale against a 1440px viewport. */
export function ContainerSizes() {
  return (
    <Gallery>
      <SpecimenGrid cols={1}>
        <Specimen
          label="Container"
          align="start"
          note={
            <>
              <code>Container size=&quot;xs&quot; … &quot;xl&quot;</code> centres content at a max width with{' '}
              <code>px=&quot;md&quot;</code> gutters. Real Containers inside a 1440px-wide viewport, scaled to
              fit. Forms read best at <code>sm</code>; list pages use <code>fluid</code>.
            </>
          }
        >
          <Stack gap={8}>
            {CONTAINER_SIZES.map((c) => (
              <div key={c.size} className={styles.containerRow}>
                <Text size="xs" fw={600}>
                  {c.size}
                </Text>
                <div className={styles.viewportTrack}>
                  <div className={styles.viewport}>
                    <Container size={c.size}>
                      <Guide className={styles.containerBar} />
                    </Container>
                  </div>
                </div>
                <Text size="xs" c="dimmed" ta="right">
                  {c.px}px
                </Text>
              </div>
            ))}
            <div className={styles.containerRow}>
              <Text size="xs" fw={600}>
                fluid
              </Text>
              <div className={styles.viewportTrack}>
                <div className={styles.viewport}>
                  <Container fluid>
                    <Guide className={styles.containerBar} />
                  </Container>
                </div>
              </div>
              <Text size="xs" c="dimmed" ta="right">
                100%
              </Text>
            </div>
          </Stack>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

function Blocks({ count = 3, widths }: { count?: number; widths?: number[] }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <Guide key={i} className={styles.block}>
          <span style={widths ? { minWidth: widths[i % widths.length] } : undefined}>{i + 1}</span>
        </Guide>
      ))}
    </>
  );
}

/** Group: gap, justify, align, wrap and grow. */
export function GroupDemo() {
  return (
    <Gallery>
      <SpecimenGrid cols={1}>
        <Specimen
          label="Gap"
          align="start"
          note={
            <>
              <code>gap=&quot;xs&quot; … &quot;xl&quot;</code> — 8 / 12 / 16 / 24 / 32px (
              <code>--ds-spacing-*</code>). The theme default is <code>sm</code>.
            </>
          }
        >
          <Stack gap="xs">
            {(['xs', 'sm', 'md', 'lg', 'xl'] as const).map((gap) => (
              <Group key={gap} gap="md" wrap="nowrap">
                <Text size="xs" c="dimmed" w={24}>
                  {gap}
                </Text>
                <Group gap={gap}>
                  <Blocks count={4} />
                </Group>
              </Group>
            ))}
          </Stack>
        </Specimen>
        <Specimen
          label="Justify"
          align="start"
          note={
            <>
              <code>justify=&quot;flex-start | center | space-between | flex-end&quot;</code> —{' '}
              <code>space-between</code> is the page-header pattern (title left, actions right).
            </>
          }
        >
          <Stack gap="xs">
            {(['flex-start', 'center', 'space-between', 'flex-end'] as const).map((justify) => (
              <div key={justify}>
                <Text size="xs" c="dimmed" mb={4}>
                  {justify}
                </Text>
                <Group justify={justify} className={styles.track}>
                  <Blocks count={3} />
                </Group>
              </div>
            ))}
          </Stack>
        </Specimen>
        <SpecimenGrid cols={2}>
          <Specimen
            label="Align"
            align="start"
            note={
              <>
                <code>align=&quot;flex-start | center | flex-end&quot;</code> on mixed-height children.
              </>
            }
          >
            <Stack gap="xs">
              {(['flex-start', 'center', 'flex-end'] as const).map((align) => (
                <Group key={align} align={align} className={styles.track} wrap="nowrap">
                  <Guide h={56}>{align}</Guide>
                  <Guide h={28}>2</Guide>
                  <Guide h={40}>3</Guide>
                </Group>
              ))}
            </Stack>
          </Specimen>
          <Specimen
            label="Wrap & grow"
            align="start"
            note={
              <>
                <code>wrap=&quot;wrap&quot;</code> (default) flows onto new lines;{' '}
                <code>wrap=&quot;nowrap&quot;</code> keeps one line; <code>grow</code> stretches children
                equally.
              </>
            }
          >
            <Stack gap="xs">
              <Text size="xs" c="dimmed">
                wrap
              </Text>
              <Group gap="xs" className={styles.track}>
                <Blocks count={7} />
              </Group>
              <Text size="xs" c="dimmed">
                grow
              </Text>
              <Group grow gap="xs" className={styles.track}>
                <Blocks count={3} />
              </Group>
            </Stack>
          </Specimen>
        </SpecimenGrid>
      </SpecimenGrid>
    </Gallery>
  );
}

/** Stack and Flex. */
export function StackFlexDemo() {
  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        <Specimen
          label="Stack"
          align="start"
          note={
            <>
              <code>Stack gap</code> — vertical rhythm. Theme default <code>md</code> (16px);{' '}
              <code>align</code> sets the cross axis.
            </>
          }
        >
          <Group grow align="flex-start" gap="md">
            <Stack gap="xs">
              <Text size="xs" c="dimmed">
                gap=&quot;xs&quot;
              </Text>
              <Blocks count={3} />
            </Stack>
            <Stack gap="lg">
              <Text size="xs" c="dimmed">
                gap=&quot;lg&quot;
              </Text>
              <Blocks count={3} />
            </Stack>
            <Stack gap="xs" align="center">
              <Text size="xs" c="dimmed">
                align=&quot;center&quot;
              </Text>
              <Blocks count={3} widths={[24, 64, 40]} />
            </Stack>
          </Group>
        </Specimen>
        <Specimen
          label="Stack justify"
          align="start"
          note={
            <>
              <code>justify=&quot;space-between&quot;</code> in a fixed height — pins a footer to the bottom
              of a card or panel.
            </>
          }
        >
          <Stack justify="space-between" className={styles.tallTrack}>
            <Guide>Header</Guide>
            <Guide>Footer</Guide>
          </Stack>
        </Specimen>
        <Specimen
          label="Flex"
          span="full"
          align="start"
          note={
            <>
              <code>Flex direction</code>, <code>wrap</code>, <code>gap</code>, <code>justify</code>,{' '}
              <code>align</code> with responsive values:{' '}
              <code>direction=&#123;&#123; base: &apos;column&apos;, sm: &apos;row&apos; &#125;&#125;</code>{' '}
              stacks on phones and lines up on tablets and up.
            </>
          }
        >
          <Stack gap="sm">
            <Text size="xs" c="dimmed">
              direction=&#123;&#123; base: &apos;column&apos;, sm: &apos;row&apos; &#125;&#125;
              gap=&quot;md&quot;
            </Text>
            <Flex direction={{ base: 'column', sm: 'row' }} gap="md" className={styles.track}>
              <Guide className={styles.flex1}>Filters</Guide>
              <Guide className={styles.flex2}>Results</Guide>
              <Guide className={styles.flex1}>Preview</Guide>
            </Flex>
            <Text size="xs" c="dimmed">
              direction=&quot;row-reverse&quot; justify=&quot;flex-end&quot; align=&quot;center&quot;
            </Text>
            <Flex direction="row-reverse" justify="flex-end" align="center" gap="xs" className={styles.track}>
              <Blocks count={3} />
            </Flex>
          </Stack>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

/** Grid: spans, offsets, responsive spans, and container-relative breakpoints. */
export function GridDemo() {
  return (
    <Gallery>
      <SpecimenGrid cols={1}>
        <Specimen
          label="Spans"
          align="start"
          note={
            <>
              A 12-column <code>Grid</code>; <code>Grid.Col span</code> takes 1–12,{' '}
              <code>&quot;auto&quot;</code> or <code>&quot;content&quot;</code>. <code>gutter</code> defaults
              to <code>md</code>.
            </>
          }
        >
          <Stack gap="xs">
            <Grid>
              {Array.from({ length: 12 }, (_, i) => (
                <Grid.Col key={i} span={1}>
                  <Guide>1</Guide>
                </Grid.Col>
              ))}
            </Grid>
            <Grid>
              <Grid.Col span={8}>
                <Guide>span 8</Guide>
              </Grid.Col>
              <Grid.Col span={4}>
                <Guide>span 4</Guide>
              </Grid.Col>
            </Grid>
            <Grid>
              <Grid.Col span={3}>
                <Guide>3</Guide>
              </Grid.Col>
              <Grid.Col span="auto">
                <Guide>auto</Guide>
              </Grid.Col>
              <Grid.Col span="content">
                <Guide>content</Guide>
              </Grid.Col>
            </Grid>
          </Stack>
        </Specimen>
        <Specimen
          label="Offsets"
          align="start"
          note={
            <>
              <code>offset=&#123;n&#125;</code> leaves <em>n</em> empty columns before a column.
            </>
          }
        >
          <Stack gap="xs">
            <Grid gutter="xs">
              <Grid.Col span={4}>
                <Guide>span 4</Guide>
              </Grid.Col>
              <Grid.Col span={4} offset={4}>
                <Guide>span 4, offset 4</Guide>
              </Grid.Col>
            </Grid>
            <Grid gutter="xs">
              <Grid.Col span={6} offset={3}>
                <Guide>span 6, offset 3</Guide>
              </Grid.Col>
            </Grid>
          </Stack>
        </Specimen>
        <Specimen
          label="Gutter & grow"
          align="start"
          note={
            <>
              <code>gutter=&quot;xl&quot;</code>; <code>grow</code> lets the last row fill the width.
            </>
          }
        >
          <Grid gutter="xl" grow>
            {[4, 4, 4, 4, 4].map((span, i) => (
              <Grid.Col key={i} span={span}>
                <Guide>{i + 1}</Guide>
              </Grid.Col>
            ))}
          </Grid>
        </Specimen>
        <Specimen
          label="Responsive (container breakpoints)"
          align="start"
          note={
            <>
              <code>span=&#123;&#123; base: 12, xs: 6, sm: 4 &#125;&#125;</code> with{' '}
              <code>type=&quot;container&quot;</code> so breakpoints follow the box, not the window. Drag the
              box&apos;s bottom-right corner to resize.
            </>
          }
        >
          <div className={styles.resizable}>
            <Grid
              type="container"
              breakpoints={{ xs: '360px', sm: '520px', md: '700px', lg: '900px', xl: '1100px' }}
            >
              {Array.from({ length: 6 }, (_, i) => (
                <Grid.Col key={i} span={{ base: 12, xs: 6, sm: 4 }}>
                  <Guide>{i + 1}</Guide>
                </Grid.Col>
              ))}
            </Grid>
          </div>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

/** SimpleGrid: equal columns, responsive cols and spacing. */
export function SimpleGridDemo() {
  return (
    <Gallery>
      <SpecimenGrid cols={1}>
        <Specimen
          label="Columns & spacing"
          align="start"
          note={
            <>
              <code>SimpleGrid cols=&#123;3&#125; spacing=&quot;md&quot; verticalSpacing=&quot;xs&quot;</code>{' '}
              — equal columns without spans. The card-grid workhorse.
            </>
          }
        >
          <SimpleGrid cols={3} spacing="md" verticalSpacing="xs">
            <Blocks count={6} />
          </SimpleGrid>
        </Specimen>
        <Specimen
          label="Responsive"
          align="start"
          note={
            <>
              <code>type=&quot;container&quot;</code> with{' '}
              <code>cols=&#123;&#123; base: 1, &apos;320px&apos;: 2, &apos;520px&apos;: 4 &#125;&#125;</code>{' '}
              — container widths as keys. Drag the corner to see 4 → 2 → 1 columns.
            </>
          }
        >
          <div className={styles.resizable}>
            <SimpleGrid
              type="container"
              cols={{ base: 1, '320px': 2, '520px': 4 }}
              spacing={{ base: 'xs', '520px': 'md' }}
            >
              <Blocks count={4} />
            </SimpleGrid>
          </div>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

/** Divider, Space, Center and AspectRatio. */
export function SpacingHelpers() {
  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        <Specimen
          label="Divider"
          align="start"
          note={
            <>
              Hairline <code>--ds-border-color</code>. <code>label</code> with <code>labelPosition</code>,{' '}
              <code>variant=&quot;dashed | dotted&quot;</code>.
            </>
          }
        >
          <Stack gap="md">
            <Divider />
            <Divider label="Or continue with" labelPosition="center" />
            <Divider label="Line items" labelPosition="left" />
            <Divider label={<Badge size="xs">3 new</Badge>} labelPosition="right" />
            <Divider variant="dashed" />
            <Divider variant="dotted" />
          </Stack>
        </Specimen>
        <Specimen
          label="Vertical divider"
          note={
            <>
              <code>orientation=&quot;vertical&quot;</code> inside a <code>Group</code> — separates toolbar
              groups and inline metadata.
            </>
          }
        >
          <Stack gap="lg">
            <Group gap="sm" wrap="nowrap">
              <Text size="sm">{ORDERS[0].number}</Text>
              <Divider orientation="vertical" />
              <Text size="sm" c="dimmed">
                {ORDERS[0].supplier}
              </Text>
              <Divider orientation="vertical" />
              <Text size="sm" fw={600}>
                {formatMoney(ORDERS[0].amount)}
              </Text>
            </Group>
            <Group gap="xs" wrap="nowrap">
              <Button variant="default" size="xs">
                Export
              </Button>
              <Button variant="default" size="xs">
                Print
              </Button>
              <Divider orientation="vertical" mx={4} />
              <Button size="xs">Approve</Button>
            </Group>
          </Stack>
        </Specimen>
        <Specimen
          label="Space"
          align="start"
          note={
            <>
              <code>Space h=&quot;xl&quot;</code> adds one-off vertical room (prefer <code>Stack gap</code>);{' '}
              <code>w</code> for horizontal.
            </>
          }
        >
          <Guide>Above</Guide>
          <div className={styles.spaceMarker}>
            <Space h="xl" />
            <Text size="xs" c="dimmed" className={styles.spaceLabel}>
              h=&quot;xl&quot; · 32px
            </Text>
          </div>
          <Guide>Below</Guide>
        </Specimen>
        <Specimen
          label="Center"
          note={
            <>
              <code>Center</code> centres on both axes; <code>inline</code> for an icon beside text.
            </>
          }
        >
          <Center className={styles.centerBox}>
            <Guide>Centred</Guide>
          </Center>
          <Center inline>
            <IconCalendar size={16} />
            <Box ml={6}>
              <Text size="sm">Inline · Due {ORDERS[0].due}</Text>
            </Box>
          </Center>
        </Specimen>
        <Specimen
          label="AspectRatio"
          span="full"
          align="start"
          note={
            <>
              <code>AspectRatio ratio=&#123;16 / 9&#125;</code>, <code>1</code> and <code>4 / 3</code> — media
              and thumbnails keep their shape at any width. (Placeholders, no images.)
            </>
          }
        >
          <div className={styles.ratioRow}>
            <AspectRatio ratio={16 / 9}>
              <Guide className={styles.media}>
                <IconPlayerPlay size={28} />
                <span>16 / 9</span>
              </Guide>
            </AspectRatio>
            <AspectRatio ratio={1}>
              <Guide className={styles.media}>
                <IconPhoto size={24} />
                <span>1 / 1</span>
              </Guide>
            </AspectRatio>
            <AspectRatio ratio={4 / 3}>
              <Guide className={styles.media}>
                <IconPhoto size={24} />
                <span>4 / 3</span>
              </Guide>
            </AspectRatio>
          </div>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

/** ScrollArea: vertical, horizontal and autosize. */
export function ScrollAreaDemo() {
  const rows = [...ACTIVITY, ...ACTIVITY.map((a) => ({ ...a, id: `${a.id}-2` }))];
  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        <Specimen
          label="Vertical"
          align="start"
          note={
            <>
              <code>ScrollArea h=&#123;200&#125;</code> — thin overlay scrollbars that appear on hover (
              <code>type=&quot;hover&quot;</code>, the default).
            </>
          }
        >
          <Paper withBorder className={styles.fullWidth}>
            <ScrollArea h={200} px="md">
              <Stack gap="sm" py="sm">
                {rows.map((a) => (
                  <Group key={a.id} gap="sm" wrap="nowrap">
                    <Avatar size="sm" radius="xl" color="primary">
                      {a.user.initials}
                    </Avatar>
                    <div className={styles.minw0}>
                      <Text size="sm" lineClamp={1}>
                        <Text span inherit fw={600}>
                          {a.user.name}
                        </Text>{' '}
                        {a.action} {a.target}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {a.time}
                      </Text>
                    </div>
                  </Group>
                ))}
              </Stack>
            </ScrollArea>
          </Paper>
        </Specimen>
        <Specimen
          label="Autosize"
          align="start"
          note={
            <>
              <code>ScrollArea.Autosize mah=&#123;200&#125;</code> grows with content and only scrolls past
              the max — dropdowns and popovers. <code>type=&quot;always&quot;</code> shows the bar.
            </>
          }
        >
          <Paper withBorder className={styles.fullWidth}>
            <ScrollArea.Autosize mah={200} type="always" offsetScrollbars>
              <Stack gap={0}>
                {USERS.map((u) => (
                  <Group
                    key={u.id}
                    justify="space-between"
                    px="md"
                    py="xs"
                    wrap="nowrap"
                    className={styles.rowDivider}
                  >
                    <Text size="sm">{u.name}</Text>
                    <Text size="xs" c="dimmed">
                      {u.team}
                    </Text>
                  </Group>
                ))}
              </Stack>
            </ScrollArea.Autosize>
          </Paper>
        </Specimen>
        <Specimen
          label="Horizontal"
          span="full"
          align="start"
          note={
            <>
              <code>ScrollArea type=&quot;auto&quot;</code> with <code>scrollbars=&quot;x&quot;</code> — a row
              of cards wider than its column; also how wide tables scroll inside a card.
            </>
          }
        >
          <ScrollArea type="auto" scrollbars="x" offsetScrollbars>
            <Group gap="md" wrap="nowrap" py="sm" px={2}>
              {ORDERS.map((o) => (
                <Card key={o.id} padding="md" className={styles.scrollCard}>
                  <Text size="xs" c="dimmed">
                    {o.number}
                  </Text>
                  <Text fw={600} size="sm" lineClamp={1}>
                    {o.supplier}
                  </Text>
                  <Group justify="space-between" mt="sm" wrap="nowrap">
                    <Text size="sm">{formatMoney(o.amount)}</Text>
                    <Badge size="xs" color={ORDER_STATUS[o.status].color}>
                      {ORDER_STATUS[o.status].label}
                    </Badge>
                  </Group>
                </Card>
              ))}
            </Group>
          </ScrollArea>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}

/** Box, Paper surfaces and shadows against the page background. */
export function SurfacesDemo() {
  return (
    <Gallery>
      <SpecimenGrid cols={1}>
        <Specimen
          label="Paper shadows"
          surface="muted"
          align="start"
          note={
            <>
              On the page background (<code>--ds-body-bg</code>):{' '}
              <code>Paper shadow=&quot;xs&quot; … &quot;xl&quot;</code> (<code>--ds-shadow-*</code>, soft and
              long) with the theme&apos;s 10px radius.
            </>
          }
        >
          <SimpleGrid cols={5} spacing="md">
            {(['xs', 'sm', 'md', 'lg', 'xl'] as const).map((shadow) => (
              <Paper key={shadow} shadow={shadow} p="md" className={styles.surfaceTile}>
                <Text size="sm" fw={600}>
                  {shadow}
                </Text>
              </Paper>
            ))}
          </SimpleGrid>
        </Specimen>
        <SpecimenGrid cols={2}>
          <Specimen
            label="Paper vs Card"
            surface="muted"
            align="start"
            note={
              <>
                <code>Paper withBorder</code> — a plain hairline surface (10px). <code>Card</code> — the
                content container: <code>--ds-card-bg</code>, card border, <code>--ds-card-shadow</code>, 16px
                radius.
              </>
            }
          >
            <Stack gap="md">
              <Paper withBorder p="md">
                <Text size="sm" fw={600}>
                  Paper withBorder
                </Text>
                <Text size="xs" c="dimmed">
                  Filters bar, table wrapper, inset panels
                </Text>
              </Paper>
              <Card>
                <Text size="sm" fw={600}>
                  Card
                </Text>
                <Text size="xs" c="dimmed">
                  Record summaries, KPIs, form sections
                </Text>
              </Card>
            </Stack>
          </Specimen>
          <Specimen
            label="Box"
            align="start"
            note={
              <>
                <code>Box</code> is the polymorphic base — style props (<code>p</code>, <code>m</code>,{' '}
                <code>w</code>, <code>bg</code>…) and <code>component=&quot;section&quot;</code> without extra
                markup.
              </>
            }
          >
            <Box component="section" p="md" className={styles.guideFrame}>
              <Text size="xs" c="dimmed" mb="xs">
                &lt;Box component=&quot;section&quot; p=&quot;md&quot;&gt;
              </Text>
              <Box p="sm" bg="var(--ds-card-bg)" className={styles.innerBox}>
                <Text size="sm">Nested Box p=&quot;sm&quot; on --ds-card-bg</Text>
              </Box>
            </Box>
          </Specimen>
        </SpecimenGrid>
      </SpecimenGrid>
    </Gallery>
  );
}

/** Common page grids: form + sidebar, 3-up cards, 4-KPI dashboard row. */
export function PageGrids() {
  const order = ORDERS[0];
  return (
    <Gallery>
      <SpecimenGrid cols={1}>
        <Specimen
          label="Form + sidebar"
          surface="muted"
          align="start"
          note={
            <>
              <code>Grid</code> with <code>span=&#123;&#123; base: 12, md: 8 &#125;&#125;</code> /{' '}
              <code>&#123;&#123; base: 12, md: 4 &#125;&#125;</code> — the record edit page: form card left,
              summary and metadata right; stacks below <code>md</code>.
            </>
          }
        >
          <Grid gutter="md">
            <Grid.Col span={{ base: 12, md: 8 }}>
              <Card>
                <Title order={4} mb="md">
                  Order details
                </Title>
                <SimpleGrid cols={2} spacing="md">
                  <TextInput
                    label="Supplier"
                    defaultValue={order.supplier}
                    leftSection={<IconBuildingStore size={16} />}
                  />
                  <Select
                    label="Category"
                    data={['Packaging', 'Freight', 'Facilities']}
                    defaultValue={order.category}
                  />
                  <TextInput label="Amount" defaultValue={formatMoney(order.amount)} />
                  <TextInput
                    label="Due date"
                    defaultValue={order.due}
                    leftSection={<IconCalendar size={16} />}
                  />
                </SimpleGrid>
                <Textarea
                  label="Notes"
                  mt="md"
                  autosize
                  minRows={2}
                  defaultValue="Two pallets, deliver to dock 3."
                />
                <Group justify="flex-end" mt="lg" gap="sm">
                  <Button variant="default">Cancel</Button>
                  <Button>Save changes</Button>
                </Group>
              </Card>
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 4 }}>
              <Stack gap="md">
                <Card>
                  <Text size="xs" c="dimmed">
                    Status
                  </Text>
                  <Badge mt={4} color={ORDER_STATUS[order.status].color}>
                    {ORDER_STATUS[order.status].label}
                  </Badge>
                  <Divider my="sm" />
                  <Text size="xs" c="dimmed">
                    Owner
                  </Text>
                  <Group gap={6} mt={4}>
                    <Avatar size="xs" color="primary">
                      {order.owner.initials}
                    </Avatar>
                    <Text size="sm" fw={500}>
                      {order.owner.name}
                    </Text>
                  </Group>
                </Card>
                <Card>
                  <Text size="xs" fw={700} c="dimmed" tt="uppercase" className={styles.tracked}>
                    Activity
                  </Text>
                  <Stack gap={6} mt="xs">
                    {ACTIVITY.slice(0, 2).map((a) => (
                      <Text key={a.id} size="xs">
                        <Text span inherit fw={600}>
                          {a.user.name.split(' ')[0]}
                        </Text>{' '}
                        {a.action} · {a.time}
                      </Text>
                    ))}
                  </Stack>
                </Card>
              </Stack>
            </Grid.Col>
          </Grid>
        </Specimen>
        <Specimen
          label="3-up card grid"
          surface="muted"
          align="start"
          note={
            <>
              <code>
                SimpleGrid cols=&#123;&#123; base: 1, sm: 2, lg: 3 &#125;&#125; spacing=&quot;md&quot;
              </code>{' '}
              — suppliers, projects, templates.
            </>
          }
        >
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
            {ORDERS.slice(0, 3).map((o) => (
              <Card key={o.id}>
                <ThemeIcon variant="light" color="gray" size="lg" radius="md" mb="sm">
                  <IconBuildingStore size={18} />
                </ThemeIcon>
                <Text fw={600} lineClamp={1}>
                  {o.supplier}
                </Text>
                <Text size="xs" c="dimmed">
                  {o.category} · {o.number}
                </Text>
                <Badge mt="sm" color={ORDER_STATUS[o.status].color}>
                  {ORDER_STATUS[o.status].label}
                </Badge>
                <Group justify="space-between" mt="md">
                  <Text size="sm" fw={600}>
                    {formatMoney(o.amount)}
                  </Text>
                  <Text size="xs" c="dimmed">
                    Due {o.due}
                  </Text>
                </Group>
              </Card>
            ))}
          </SimpleGrid>
        </Specimen>
        <Specimen
          label="Dashboard KPI row"
          surface="muted"
          align="start"
          note={
            <>
              <code>SimpleGrid</code> of <code>Card</code>s, the top row of every dashboard: four across from
              760px of content width (see the Dashboard template), 2 × 2 in this narrower column (
              <code>type=&quot;container&quot;</code>). The header is{' '}
              <code>Group justify=&quot;space-between&quot;</code>.
            </>
          }
        >
          <Group justify="space-between" mb="xs">
            <Title order={4}>This week</Title>
            <TextInput
              size="xs"
              placeholder="Search…"
              leftSection={<IconSearch size={14} />}
              aria-label="Search"
            />
          </Group>
          <SimpleGrid type="container" cols={{ base: 1, '400px': 2, '760px': 4 }} spacing="md">
            {KPIS.map((kpi) => {
              const good = kpi.label !== 'Overdue deliveries';
              const Arrow = kpi.trend === 'up' ? IconArrowUpRight : IconArrowDownRight;
              return (
                <Card key={kpi.label} padding="md">
                  <Text size="xs" c="dimmed" lineClamp={1}>
                    {kpi.label}
                  </Text>
                  <Text size="xl" fw={600} mt={4} className={styles.kpiValue}>
                    {kpi.value}
                  </Text>
                  <Group gap={4} mt={4} wrap="nowrap">
                    <Text size="xs" fw={600} c={good ? 'green.7' : 'red.7'} className={styles.inlineIcon}>
                      <Arrow size={14} />
                      {kpi.delta}
                    </Text>
                    <Text size="xs" c="dimmed" lineClamp={1}>
                      {kpi.hint}
                    </Text>
                  </Group>
                </Card>
              );
            })}
          </SimpleGrid>
        </Specimen>
      </SpecimenGrid>
    </Gallery>
  );
}
