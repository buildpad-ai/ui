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
import type { ReactNode } from "react";

export default function AuthenticatedLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return <DaaSProviderWrapper>{children}</DaaSProviderWrapper>;
}
