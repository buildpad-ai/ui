'use client';

import {
  Avatar,
  Badge,
  Button,
  Card,
  Group,
  Progress,
  SegmentedControl,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { IconArrowRight, IconPlus, IconSearch } from '@tabler/icons-react';
import { Gallery } from '../Gallery';
import { SpecimenGrid } from '../Layout';
import { ORDERS, ORDER_STATUS, USERS, formatMoney } from '../data';

/** A compact taste of the system at the top of the styleguide overview. */
export function OverviewPreview() {
  const order = ORDERS[0];
  return (
    <Gallery>
      <SpecimenGrid cols={2}>
        <Card>
          <Stack gap="md">
            <Group justify="space-between" align="flex-start">
              <div>
                <Text size="xs" c="dimmed" fw={500}>
                  {order.number}
                </Text>
                <Title order={3}>{order.supplier}</Title>
              </div>
              <Badge color={ORDER_STATUS[order.status].color}>
                {ORDER_STATUS[order.status].label}
              </Badge>
            </Group>
            <Group gap="xl">
              <div>
                <Text size="xs" c="dimmed">
                  Amount
                </Text>
                <Text fw={600}>{formatMoney(order.amount)}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">
                  Due
                </Text>
                <Text fw={600}>{order.due}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">
                  Owner
                </Text>
                <Group gap={6}>
                  <Avatar size="xs" color="primary">
                    {order.owner.initials}
                  </Avatar>
                  <Text fw={500}>{order.owner.name}</Text>
                </Group>
              </div>
            </Group>
            <div>
              <Group justify="space-between" mb={6}>
                <Text size="xs" c="dimmed">
                  Approval progress
                </Text>
                <Text size="xs" fw={500}>
                  2 of 3
                </Text>
              </Group>
              <Progress value={66} />
            </div>
            <Group justify="flex-end" gap="sm">
              <Button variant="default">Request changes</Button>
              <Button rightSection={<IconArrowRight size={16} />}>Approve</Button>
            </Group>
          </Stack>
        </Card>

        <Card>
          <Stack gap="md">
            <Group justify="space-between">
              <Title order={4}>Team</Title>
              <Button size="xs" leftSection={<IconPlus size={14} />}>
                Invite
              </Button>
            </Group>
            <TextInput placeholder="Search people…" leftSection={<IconSearch size={16} />} />
            <SegmentedControl data={['All', 'Admins', 'Editors']} defaultValue="All" />
            <Stack gap="sm">
              {USERS.slice(0, 3).map((user) => (
                <Group key={user.id} justify="space-between" wrap="nowrap">
                  <Group gap="sm" wrap="nowrap">
                    <Avatar radius="xl" color="primary">
                      {user.initials}
                    </Avatar>
                    <div>
                      <Text size="sm" fw={500}>
                        {user.name}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {user.role}
                      </Text>
                    </div>
                  </Group>
                  <Switch defaultChecked={user.status === 'active'} aria-label={`${user.name} access`} />
                </Group>
              ))}
            </Stack>
          </Stack>
        </Card>
      </SpecimenGrid>
    </Gallery>
  );
}
