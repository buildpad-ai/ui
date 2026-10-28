'use client';

import { useState } from 'react';
import { useResolvedVars } from './SchemeContext';
import styles from './styleguide.module.css';

const STOPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;

export type Hue =
  | 'primary'
  | 'secondary'
  | 'success'
  | 'info'
  | 'warning'
  | 'danger'
  | 'gray';

const HUE_LABELS: Record<Hue, string> = {
  primary: 'Primary — Ember',
  secondary: 'Secondary — Ink',
  success: 'Success — Emerald',
  info: 'Info — Blue',
  warning: 'Warning — Amber',
  danger: 'Danger — Red',
  gray: 'Gray — Neutral',
};

/** Extra context shown next to the scale header. */
const HUE_NOTES: Partial<Record<Hue, string>> = {
  primary: 'brand accent — interactive state, focus, highlights (aliased as orange / accent)',
  secondary: 'ink — the default CTA colour; inverts to light greys in dark mode',
  success: 'aliased as green',
  info: 'aliased as blue',
  warning: 'aliased as yellow',
  danger: 'aliased as red',
};

function Swatch({
  varName,
  label,
  hex,
  wide,
}: {
  varName: string;
  label: string;
  hex: string;
  wide?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard
      .writeText(`var(${varName})${hex ? ` — ${hex}` : ''}`)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      });
  };

  return (
    <button
      type="button"
      className={styles.swatch}
      data-wide={wide || undefined}
      onClick={copy}
      title={`Copy var(${varName})`}
    >
      <span
        className={styles.swatchColor}
        style={{ background: `var(${varName})` }}
      />
      <span className={styles.swatchLabel}>{copied ? 'Copied!' : label}</span>
      <span className={styles.swatchHex}>{copied ? '' : hex}</span>
    </button>
  );
}

export function ColorScale({ hue }: { hue: Hue }) {
  const names = [
    ...STOPS.map((s) => `--ds-${hue}-${s}`),
    ...(hue === 'gray' ? [] : [`--ds-${hue}`]),
  ];
  const { ref, values } = useResolvedVars(names);

  return (
    <div ref={ref} className={styles.scaleBlock}>
      <div className={styles.scaleHeader}>
        <strong>{HUE_LABELS[hue]}</strong>
        {hue !== 'gray' && (
          <span className={styles.scaleNote}>
            main <code>--ds-{hue}</code> = the 600 stop (mirrored scales make it the lighter tone in dark)
          </span>
        )}
        {hue === 'gray' && (
          <span className={styles.scaleNote}>
            cool neutrals (no blue cast) · numbered stops only, no unsuffixed main ·
            hand-tuned in dark so muted text stays AA
          </span>
        )}
        {HUE_NOTES[hue] && (
          <span className={styles.scaleNote}>{HUE_NOTES[hue]}</span>
        )}
      </div>
      <div className={styles.swatchRow}>
        {hue !== 'gray' && (
          <Swatch
            varName={`--ds-${hue}`}
            label="main"
            hex={values[`--ds-${hue}`] ?? ''}
            wide
          />
        )}
        {STOPS.map((s) => (
          <Swatch
            key={s}
            varName={`--ds-${hue}-${s}`}
            label={String(s)}
            hex={values[`--ds-${hue}-${s}`] ?? ''}
          />
        ))}
      </div>
    </div>
  );
}

const SEMANTIC_TOKENS = [
  { name: '--ds-body-bg', note: 'page background (flat, no gradient)' },
  { name: '--ds-body-color', note: 'default text' },
  { name: '--ds-ink', note: 'headings & strongest text' },
  { name: '--ds-ink-secondary', note: 'secondary text, idle nav links' },
  { name: '--ds-ink-faint', note: 'muted text (AA on white)' },
  { name: '--ds-accent-text', note: 'orange text — links, accents (primary-700)' },
  { name: '--ds-card-bg', note: 'card surface' },
  { name: '--ds-card-border', note: 'hairline card border' },
  { name: '--ds-border-color', note: 'dividers & cards (gray-200)' },
  { name: '--ds-border-color-subtle', note: 'subtle separators (gray-100)' },
  { name: '--ds-cta-bg', note: 'default Button background (ink)' },
  { name: '--ds-cta-color', note: 'default Button text' },
  { name: '--ds-focus-border', note: 'input border on focus (primary-500)' },
  { name: '--ds-focus-ring-color', note: 'focus ring overlay' },
] as const;

export function SemanticTokens() {
  const { ref, values } = useResolvedVars(SEMANTIC_TOKENS.map((t) => t.name));

  return (
    <div ref={ref} className={styles.semanticGrid}>
      {SEMANTIC_TOKENS.map((t) => (
        <div key={t.name} className={styles.semanticItem}>
          <Swatch
            varName={t.name}
            label={t.name.replace('--ds-', '')}
            hex={values[t.name] ?? ''}
            wide
          />
          <span className={styles.semanticNote}>{t.note}</span>
        </div>
      ))}
    </div>
  );
}
