/**
 * Sidebar Navigation
 *
 * The primary nav items rendered by AuthenticatedShell. Edit freely — add,
 * remove, or reorder entries; they're matched against the current route by
 * href prefix (which also drives the header breadcrumb label).
 *
 * `href` is written WITHOUT a locale prefix — the shell prefixes the active
 * locale. `labelKey` / `sectionKey` are dictionary paths (lib/i18n) resolved
 * at render time; `label` / `section` are the fallbacks when the key is
 * missing from a dictionary.
 *
 * When you install a route module (e.g. `buildpad add users-routes`), the
 * CLI appends that module's entries above the insert marker below — entries
 * are matched by href, so your edits and ordering are preserved.
 *
 * @buildpad/origin: components/layout/navigation
 * @buildpad/version: 2.0.0
 * @buildpad-preserve-casing — ./AuthenticatedShell keeps its PascalCase filename
 */

import { IconHome } from "@tabler/icons-react";
import type { NavItem } from "./AuthenticatedShell";

export const NAV_ITEMS: NavItem[] = [
  { label: "Home", labelKey: "app.nav.home", href: "/", icon: IconHome },
  // buildpad:nav-insert — installed route modules add entries above this line. Do not remove.
];
