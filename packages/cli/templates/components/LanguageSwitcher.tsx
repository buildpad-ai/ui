"use client";

/**
 * LanguageSwitcher
 *
 * Select for the locales declared in lib/i18n/config.ts. Changing it writes
 * the NEXT_LOCALE cookie (read by middleware) and re-enters the current route
 * under the new prefix. Renders nothing when only one locale is configured.
 *
 * Best-effort: the choice is also stored on the DaaS user profile
 * (`PATCH /users/me { language }` through the app's proxy) so it can seed the
 * cookie on the next device. Failure is ignored — the cookie carries the
 * choice.
 *
 * Usage: rendered by AuthenticatedShell's header by default; mount it on the
 * login page or anywhere else with `<LanguageSwitcher />`.
 *
 * @buildpad/origin: components/LanguageSwitcher
 * @buildpad/version: 1.0.0
 */

import { Select, type SelectProps } from "@mantine/core";
import { IconLanguage } from "@tabler/icons-react";
import { hasLocale, locales, localeMeta } from "@/lib/i18n/config";
import { useSwitchLocale } from "@/lib/i18n/navigation";
import { useI18n } from "@/lib/i18n/provider";

async function persistUserLanguage(language: string) {
  try {
    await fetch("/api/auth/user", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ language }),
    });
  } catch {
    // The cookie already carries the choice; the profile is a convenience.
  }
}

export interface LanguageSwitcherProps extends Omit<SelectProps, "data" | "value" | "onChange"> {
  /** Also store the choice on the DaaS user profile (default: true). */
  persist?: boolean;
}

export function LanguageSwitcher({ persist = true, ...selectProps }: LanguageSwitcherProps) {
  const { locale, t } = useI18n();
  const switchLocale = useSwitchLocale();

  if (locales.length < 2) return null;

  return (
    <Select
      size="xs"
      w={150}
      aria-label={t("app.common.language")}
      leftSection={<IconLanguage size={14} stroke={1.8} />}
      allowDeselect={false}
      comboboxProps={{ withinPortal: true }}
      {...selectProps}
      value={locale}
      data={locales.map((code) => ({ value: code, label: localeMeta[code].name }))}
      onChange={(value) => {
        if (!value || !hasLocale(value) || value === locale) return;
        if (persist) void persistUserLanguage(value);
        switchLocale(value);
      }}
    />
  );
}

export default LanguageSwitcher;
