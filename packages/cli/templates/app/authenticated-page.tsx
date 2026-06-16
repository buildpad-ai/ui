"use client";

import { Button, Card, Group, Stack, Text, Title } from "@mantine/core";

/**
 * Authenticated home page (served at "/").
 *
 * Lives under app/(authenticated)/ so it renders inside AuthenticatedShell
 * (header, sidebar, profile menu). Add more pages under app/(authenticated)/
 * and they inherit the same chrome. No ColorSchemeToggle here — the shell
 * provides one; no outer padding — AppShell.Main already pads the content.
 */
export default function HomePage() {
  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>Welcome</Title>
        <Text c="dimmed" mt="xs">
          You&apos;re signed in. This is your app home, rendered inside the
          AuthenticatedShell. Customize the sidebar nav and brand in
          app/(authenticated)/layout.tsx.
        </Text>
      </div>

      <Card withBorder radius="md" padding="lg">
        <Stack gap="sm">
          <Title order={4}>Next steps</Title>
          <Text size="sm" c="dimmed">
            Install components with{" "}
            <Text span ff="monospace">
              npx buildpad add
            </Text>
            , then build your screens under app/(authenticated)/.
          </Text>
          <Group>
            <Button>Primary Action</Button>
            <Button variant="light" color="secondary">
              Secondary Action
            </Button>
          </Group>
        </Stack>
      </Card>
    </Stack>
  );
}
