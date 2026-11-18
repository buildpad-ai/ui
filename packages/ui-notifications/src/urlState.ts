'use client';
/**
 * Where the inbox keeps `?filter=` and `?id=`. The package does not import a router: pass
 * `nextUrlState(useSearchParams(), useRouter(), usePathname())` in a Next.js app, or nothing for
 * in-memory state.
 */
import { useMemo, useState } from 'react';

export interface InboxUrlParams {
  filter: string | null;
  id: string | null;
}

export interface InboxUrlState extends InboxUrlParams {
  replace(next: InboxUrlParams): void;
}

/** In-memory state (no URL). The inbox's default. */
export function useLocalUrlState(initial: Partial<InboxUrlParams> = {}): InboxUrlState {
  const [params, setParams] = useState<InboxUrlParams>({ filter: initial.filter ?? null, id: initial.id ?? null });
  return useMemo(() => ({ ...params, replace: setParams }), [params]);
}

interface SearchParamsLike {
  get(name: string): string | null;
  toString(): string;
}
interface RouterLike {
  replace(href: string, options?: { scroll?: boolean }): void;
}

/** URL state over a router like Next's: `router.replace(..., { scroll: false })`, other params kept. */
export function nextUrlState(searchParams: SearchParamsLike | null, router: RouterLike, pathname: string): InboxUrlState {
  return {
    filter: searchParams?.get('filter') ?? null,
    id: searchParams?.get('id') ?? null,
    replace(next) {
      const qs = new URLSearchParams(searchParams?.toString() ?? '');
      for (const key of ['filter', 'id'] as const) {
        const value = next[key];
        if (value) qs.set(key, value);
        else qs.delete(key);
      }
      const query = qs.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
  };
}
