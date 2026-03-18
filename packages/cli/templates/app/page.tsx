"use client";

import { Button, Group, Stack, Text, Title } from "@mantine/core";
import { ColorSchemeToggle } from "@/components/ColorSchemeToggle";

export default function HomePage() {
  return (
    <Stack gap="lg" p="xl">
      <Group justify="space-between">
        <Title order={2}>Buildpad Starter</Title>
        <ColorSchemeToggle />
      </Group>
      <Text c="dimmed">
        This starter uses token-based theming with Mantine and is ready to
        consume Buildpad UI components.
      </Text>
      <Group>
        <Button>Primary Action</Button>
        <Button variant="light" color="secondary">
          Secondary Action
        </Button>
      </Group>
    </Stack>
  );
}
