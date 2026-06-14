'use client';

import { useState, type ReactNode } from 'react';
import { SchemeContext, type Scheme } from './SchemeContext';
import styles from './styleguide.module.css';

/**
 * Wraps the demo sections and scopes the design-token color scheme to its
 * own subtree: design-tokens.css redefines the --ds-* variables under a
 * bare [data-mantine-color-scheme="dark"] attribute selector, so setting
 * the attribute here flips every token below without touching the Nextra
 * chrome (which themes via html.dark).
 */
export function Showcase({ children }: { children: ReactNode }) {
  const [scheme, setScheme] = useState<Scheme>('light');

  return (
    <SchemeContext.Provider value={scheme}>
      <div className={styles.showcase} data-mantine-color-scheme={scheme}>
        <div className={styles.toggleBar}>
          <div className={styles.toggle} role="group" aria-label="Color scheme">
            {(['light', 'dark'] as const).map((s) => (
              <button
                key={s}
                type="button"
                className={styles.toggleButton}
                data-active={scheme === s || undefined}
                onClick={() => setScheme(s)}
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
