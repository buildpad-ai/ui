'use client';

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';

export type Scheme = 'light' | 'dark';

export const SchemeContext = createContext<Scheme>('light');

export function useScheme(): Scheme {
  return useContext(SchemeContext);
}

/**
 * Resolves CSS custom properties against a rendered element so the page
 * always shows the values from the real design-tokens.css. Values are
 * empty in the static export and fill in on hydration; they re-resolve
 * when the showcase scheme toggles.
 */
export function useResolvedVars(names: readonly string[]): {
  ref: RefObject<HTMLDivElement | null>;
  values: Record<string, string>;
} {
  const ref = useRef<HTMLDivElement>(null);
  const scheme = useScheme();
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!ref.current) return;
    const cs = getComputedStyle(ref.current);
    setValues(
      Object.fromEntries(
        names.map((n) => [n, cs.getPropertyValue(n).trim()]),
      ),
    );
    // names is a static list at every call site
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheme]);

  return { ref, values };
}
