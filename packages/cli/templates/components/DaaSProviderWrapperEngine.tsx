/**
 * DaaS Provider Wrapper
 *
 * A 'use client' wrapper that configures DaaSProvider for an Engine project:
 * an empty URL, so the hooks call the app's own /api proxy routes (the
 * Engine accepts no browser session), and a getToken callback that reads the
 * live session JWT. Also reads the `daas_resource_uri` cookie and injects it
 * as the `X-Resource-Uri` header so scope-based RBAC works through the proxies.
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
import { useRouter } from "next/navigation";
import { registerUrlStateWriter } from "@/lib/buildpad/hooks";
import { useEffect, useMemo, type ReactNode } from "react";

export function DaaSProviderWrapper({ children }: { children: ReactNode }) {
  // Route the URL-state writes of Buildpad's list managers through the App
  // Router. Native history.replaceState is invisible to useSearchParams AND is
  // re-asserted away by the router's own stale state (observed on Next 16);
  // registering router.replace keeps the two in agreement. Cleared on unmount
  // so a logout/login cycle re-registers the fresh router.
  const router = useRouter();
  useEffect(() => {
    registerUrlStateWriter((url) => router.replace(url, { scroll: false }));
    return () => registerUrlStateWriter(null);
  }, [router]);

  const config = useMemo(
    () => ({
      // "" = same-origin: every call goes through the app's /api proxy routes,
      // which forward the session's access token to the Engine as Bearer. The
      // Engine refuses credentialed cross-origin requests from the browser.
      url: "",
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
