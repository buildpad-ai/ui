/**
 * DaaS Provider Wrapper
 *
 * A 'use client' wrapper that configures DaaSProvider with the DaaS URL
 * and a getToken callback that reads the live Supabase session JWT. A token
 * that has expired or is missing in the browser is renewed from the server's
 * session (lib/daas-token), and a request DaaS rejects with 401 is retried
 * once with a renewed token, so an idle tab keeps working without a reload.
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
 * @buildpad/version: 1.1.0
 */

"use client";

import { DaaSProvider } from "@/lib/buildpad/services";
import { getDaaSToken, renewDaaSToken } from "@/lib/daas-token";
import { useRouter } from "next/navigation";
import { registerUrlStateWriter } from "@/lib/buildpad/hooks";
import { useEffect, useMemo, type ReactNode } from "react";

/**
 * When neither the browser nor the server has a session, the person is signed
 * out. Reload: the middleware then sends them to the login page. At most once
 * per 30 seconds, so a session the server also rejects cannot loop.
 */
function reloadForFreshSession() {
  if (typeof window === "undefined") return;
  try {
    const last = Number(window.sessionStorage.getItem("buildpad_session_reload") ?? 0);
    if (Date.now() - last < 30_000) return;
    window.sessionStorage.setItem("buildpad_session_reload", String(Date.now()));
  } catch {
    return;
  }
  window.location.reload();
}

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
      url: process.env.NEXT_PUBLIC_BUILDPAD_DAAS_URL ?? "",
      getToken: async () => {
        const token = await getDaaSToken();
        if (!token) reloadForFreshSession();
        return token;
      },
      renewToken: async () => {
        const token = await renewDaaSToken();
        if (!token) reloadForFreshSession();
        return token;
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
