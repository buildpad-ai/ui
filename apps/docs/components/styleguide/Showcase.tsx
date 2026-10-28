'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { SchemeContext, type Scheme } from './SchemeContext';
import styles from './styleguide.module.css';

// The docs chrome doesn't load the brand fonts, so the showcase pulls in the
// same Google Fonts set the app's globals.css imports. React 19 hoists and
// dedupes a <link rel="stylesheet"> that carries `precedence`.
const BRAND_FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Inter+Tight:wght@500;600;700&family=JetBrains+Mono:wght@400;500&display=swap';

/**
 * Wraps the demo sections and scopes the design-token color scheme to its
 * own subtree: design-tokens.css redefines the --ds-* variables under a
 * bare [data-mantine-color-scheme="dark"] attribute selector, so setting
 * the attribute here flips every token below without touching the Nextra
 * chrome (which themes via html.dark).
 */
const SCHEME_KEY = 'bp-styleguide-scheme';

export function Showcase({ children }: { children: ReactNode }) {
  const [scheme, setScheme] = useState<Scheme>('light');

  // Remember the scheme across styleguide pages (a per-viewer convenience;
  // storage may be unavailable, so every access is guarded).
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SCHEME_KEY);
      if (saved === 'light' || saved === 'dark') setScheme(saved);
    } catch {
      // ignore
    }
  }, []);

  const changeScheme = (next: Scheme) => {
    setScheme(next);
    try {
      window.localStorage.setItem(SCHEME_KEY, next);
    } catch {
      // ignore
    }
  };

  return (
    <SchemeContext.Provider value={scheme}>
      <link rel="stylesheet" href={BRAND_FONTS_HREF} precedence="default" />
      <div className={styles.showcase} data-mantine-color-scheme={scheme}>
        <div className={styles.toggleBar}>
          <div className={styles.toggle} role="group" aria-label="Color scheme">
            {(['light', 'dark'] as const).map((s) => (
              <button
                key={s}
                type="button"
                className={styles.toggleButton}
                data-active={scheme === s || undefined}
                onClick={() => changeScheme(s)}
              >
                {s === 'light' ? 'Light' : 'Dark'}
              </button>
            ))}
          </div>
        </div>
        {children}
      </div>
    </SchemeContext.Provider>
  );
}
