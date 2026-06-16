/**
 * Authenticated Route-Group Layout
 *
 * Wraps all authenticated pages (e.g. /content/*, /select-scope) with
 * DaaSProvider and ScopeProvider.
 *
 * This layout lives at  app/(authenticated)/layout.tsx  so that it mounts
 * fresh every time a user logs in and unmounts cleanly on logout.
 *
 * Why NOT in the root layout (app/layout.tsx):
 *   Next.js root layouts NEVER unmount during client-side navigation.
 *   If DaaSProvider lived there it would persist across logout → login
 *   cycles, causing stale-token 401 errors (Bug 22).
 *
 * @buildpad/origin: app/authenticated-layout
 * @buildpad/version: 1.0.0
 */

import { DaaSProviderWrapper } from "@/components/DaaSProviderWrapper";
import { AuthenticatedShell } from "@/components/layout/AuthenticatedShell";
import type { ReactNode } from "react";

export default function AuthenticatedLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  // AuthenticatedShell renders the app chrome (header, sidebar nav, profile
  // menu) around every authenticated page. It uses sensible defaults (a single
  // "Home" nav item + the NEXT_PUBLIC_APP_NAME brand) so a fresh project works
  // out of the box. To customize, create a "use client" wrapper that passes
  // `navItems` / `brand` to <AuthenticatedShell> and render that here — see
  // https://buildpad.dev/app-shell. (For the schema-driven content browser,
  // use ContentLayout under its own /content route instead.)
  return (
    <DaaSProviderWrapper>
      <AuthenticatedShell>{children}</AuthenticatedShell>
    </DaaSProviderWrapper>
  );
}
