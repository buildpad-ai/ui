"use client";

import { Button, Card, Group, Stack, Text, Title } from "@mantine/core";
import { useI18n } from "@/lib/i18n/provider";

/**
 * Authenticated home page (served at "/<lang>").
 *
 * Lives under app/[lang]/(authenticated)/ so it renders inside
 * AuthenticatedShell (header, sidebar, profile menu). Add more pages under
 * app/[lang]/(authenticated)/ and they inherit the same chrome. No
 * ColorSchemeToggle here — the shell provides one; no outer padding —
 * AppShell.Main already pads the content.
 */
export default function HomePage() {
  const { t } = useI18n();

  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>{t("app.home.welcome")}</Title>
        <Text c="dimmed" mt="xs">
          {t("app.home.intro")}
        </Text>
      </div>

      <Card withBorder radius="md" padding="lg">
        <Stack gap="sm">
          <Title order={4}>{t("app.home.nextSteps")}</Title>
          <Text size="sm" c="dimmed">
            {t("app.home.installHint", { command: "npx buildpad add" })}
          </Text>
          <Group>
            <Button>{t("app.home.primaryAction")}</Button>
            <Button variant="light" color="secondary">
              {t("app.home.secondaryAction")}
            </Button>
          </Group>
        </Stack>
      </Card>
    </Stack>
  );
}
