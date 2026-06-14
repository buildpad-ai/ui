'use client';

import { useResolvedVars } from './SchemeContext';
import styles from './styleguide.module.css';

const TYPE_SIZES = [
  { key: 'xs', note: 'captions, badges, table headers' },
  { key: 'sm', note: 'body text in apps (--ds-body-font-size)' },
  { key: 'base', note: 'default paragraph size' },
  { key: 'lg', note: 'lead text' },
  { key: 'xl', note: 'h4 / section titles' },
  { key: '2xl', note: 'h3' },
  { key: '3xl', note: 'h2' },
  { key: '4xl', note: 'h1 / hero' },
] as const;

export function TypeScale() {
  const { ref, values } = useResolvedVars(
    TYPE_SIZES.map((t) => `--ds-font-size-${t.key}`),
  );

  return (
    <div ref={ref} className={styles.typeScale}>
      {TYPE_SIZES.map((t) => (
        <div key={t.key} className={styles.typeRow}>
          <code className={styles.typeMeta}>
            {t.key} · {values[`--ds-font-size-${t.key}`] ?? ''}
          </code>
          <span
            className={styles.typeSample}
            style={{ fontSize: `var(--ds-font-size-${t.key})` }}
          >
            The quick brown fox jumps over the lazy dog
          </span>
          <span className={styles.typeNote}>{t.note}</span>
        </div>
      ))}
    </div>
  );
}

const SPACING_STEPS = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16] as const;

export function SpacingScale() {
  const { ref, values } = useResolvedVars(
    SPACING_STEPS.map((s) => `--ds-spacing-${s}`),
  );

  return (
    <div ref={ref} className={styles.spacingScale}>
      {SPACING_STEPS.map((s) => (
        <div key={s} className={styles.spacingRow}>
          <code className={styles.spacingMeta}>
            spacing-{s} · {values[`--ds-spacing-${s}`] ?? ''}
          </code>
          <span
            className={styles.spacingBar}
            style={{ width: `var(--ds-spacing-${s})` }}
          />
        </div>
      ))}
    </div>
  );
}

const RADII = [
  { name: '--ds-radius-sm', label: 'sm', note: 'chips, small controls' },
  { name: '--ds-radius', label: 'base', note: 'buttons, inputs, tabs' },
  { name: '--ds-radius-md', label: 'md', note: 'cards, popovers' },
  { name: '--ds-radius-lg', label: 'lg', note: 'modals' },
  { name: '--ds-radius-xl', label: 'xl', note: 'large surfaces' },
] as const;

export function RadiusScale() {
  const { ref, values } = useResolvedVars(RADII.map((r) => r.name));

  return (
    <div ref={ref} className={styles.tileRow}>
      {RADII.map((r) => (
        <div key={r.name} className={styles.tileItem}>
          <span
            className={styles.radiusBox}
            style={{ borderRadius: `var(${r.name})` }}
          />
          <code>
            {r.label} · {values[r.name] ?? ''}
          </code>
          <span className={styles.tileNote}>{r.note}</span>
        </div>
      ))}
    </div>
  );
}

const SHADOWS = [
  { name: '--ds-shadow-sm', label: 'sm', note: 'cards (default)' },
  { name: '--ds-shadow', label: 'base', note: 'raised elements' },
  { name: '--ds-shadow-md', label: 'md', note: 'dropdowns, popovers' },
  { name: '--ds-shadow-lg', label: 'lg', note: 'overlays' },
  { name: '--ds-shadow-xl', label: 'xl', note: 'modals' },
] as const;

export function ShadowScale() {
  return (
    <div className={styles.tileRow}>
      {SHADOWS.map((s) => (
        <div key={s.name} className={styles.tileItem}>
          <span
            className={styles.shadowBox}
            style={{ boxShadow: `var(${s.name})` }}
          />
          <code>{s.label}</code>
          <span className={styles.tileNote}>{s.note}</span>
        </div>
      ))}
    </div>
  );
}

export function FocusRingDemo() {
  return (
    <div className={styles.focusDemo}>
      <button type="button" className={styles.focusTarget}>
        Tab or click me
      </button>
      <span className={styles.focusTarget} data-always-focused>
        Always-on ring
      </span>
      <div className={styles.stateNotes}>
        <code>--ds-focus-ring</code> · hover opacity{' '}
        <code>--ds-hover-opacity: 0.85</code> · disabled opacity{' '}
        <code>--ds-disabled-opacity: 0.5</code> · transitions{' '}
        <code>150ms / 200ms ease</code>
      </div>
    </div>
  );
}
