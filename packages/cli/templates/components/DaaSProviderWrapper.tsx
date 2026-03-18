/**
 * DaaS Provider Wrapper
 *
 * A 'use client' wrapper that configures DaaSProvider with the DaaS URL
 * and a getToken callback that reads the live Supabase session JWT.
 * Also reads the `daas_resource_uri` cookie and injects it as the
 * `X-Resource-Uri` header so scope-based RBAC works on direct DaaS calls.
 *
 * Usage — place inside app/(authenticated)/layout.tsx, NOT in the root layout:
 *
 *   export default function AuthenticatedLayout({ children }) {
 *     return <DaaSProviderWrapper>{children}</DaaSProviderWrapper>;
 *   }
 *
 * @buildpad/origin: components/DaaSProviderWrapper
 * @buildpad/version: 1.0.0
 */

"use client";

import { DaaSProvider } from "@/lib/buildpad/services";
import { createClient } from "@/lib/supabase/client";
import { useMemo, type ReactNode } from "react";

export function DaaSProviderWrapper({ children }: { children: ReactNode }) {
  const config = useMemo(
    () => ({
      url: process.env.NEXT_PUBLIC_BUILDPAD_DAAS_URL ?? "",
      getToken: async () => {
        const supabase = createClient();
        const { data } = await supabase.auth.getSession();
        return data.session?.access_token ?? null;
      },
      /**
       * Inject the active tenant scope header into every direct DaaS call.
       * The Next.js middleware stores the scope in a `daas_resource_uri` cookie.
       * Without this header, DaaS falls back to root scope and may return 403
       * for users whose role is only assigned at tenant level.
       */
      getHeaders: async (): Promise<Record<string, string>> => {
        if (typeof document === "undefined") return {};
        const raw = document.cookie
          .split("; ")
          .find((r) => r.startsWith("daas_resource_uri="))
          ?.split("=")[1];
        if (!raw) return {};
        return { "X-Resource-Uri": decodeURIComponent(raw) };
      },
    }),
    []
  );

  return <DaaSProvider config={config}>{children}</DaaSProvider>;
}
