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
  primary: 'Primary — Orange',
  secondary: 'Secondary — Blue',
  success: 'Success — Green',
  info: 'Info — Sky',
  warning: 'Warning — Amber',
  danger: 'Danger — Red',
  gray: 'Gray — Slate',
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
            main <code>--ds-{hue}</code> = 600 in light mode, 400 in dark
          </span>
        )}
        {hue === 'gray' && (
          <span className={styles.scaleNote}>numbered stops only, no unsuffixed main</span>
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
  { name: '--ds-body-bg', note: 'page background' },
  { name: '--ds-body-color', note: 'default text' },
  { name: '--ds-border-color', note: 'cards & dividers (gray-200)' },
  { name: '--ds-border-color-subtle', note: 'subtle separators (gray-100)' },
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
