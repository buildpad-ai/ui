"use client";

import {
  ActionIcon,
  Tooltip,
  useComputedColorScheme,
  useMantineColorScheme
} from "@mantine/core";
import { IconMoon, IconSun } from "@tabler/icons-react";
import { useI18nOptional } from "@/lib/i18n/provider";

export function ColorSchemeToggle() {
  const { setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme("light", {
    getInitialValueInEffect: true
  });
  // Works with or without the app I18nProvider (e.g. in isolated previews).
  const i18n = useI18nOptional();
  const t = (key: string, fallback: string) => {
    const value = i18n?.t(key);
    return value && value !== key ? value : fallback;
  };

  return (
    <Tooltip
      label={
        computedColorScheme === "dark"
          ? t("app.shell.lightMode", "Light mode")
          : t("app.shell.darkMode", "Dark mode")
      }
    >
      <ActionIcon
        variant="subtle"
        size="lg"
        onClick={() =>
          setColorScheme(computedColorScheme === "light" ? "dark" : "light")
        }
        aria-label={t("app.shell.toggleColorScheme", "Toggle color scheme")}
      >
        {computedColorScheme === "dark" ? (
          <IconSun size={20} />
        ) : (
          <IconMoon size={20} />
        )}
      </ActionIcon>
    </Tooltip>
  );
}
