'use client';

import { useResolvedVars } from './SchemeContext';
import styles from './styleguide.module.css';

// `display` rows render as headings do: Inter Tight, weight 600, tight tracking
// (h1 one step tighter).
const TYPE_SIZES = [
  { key: 'xs', note: 'captions, badges, table headers' },
  { key: 'sm', note: 'body text in apps (--ds-body-font-size)' },
  { key: 'base', note: 'default paragraph size' },
  { key: 'lg', note: 'lead text' },
  { key: 'xl', note: 'h4 / section titles · display', display: 'tight' },
  { key: '2xl', note: 'h3 · display', display: 'tight' },
  { key: '3xl', note: 'h2 · display', display: 'tight' },
  { key: '4xl', note: 'h1 / hero · display, tighter tracking', display: 'tighter' },
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
            style={{
              fontSize: `var(--ds-font-size-${t.key})`,
              ...('display' in t
                ? {
                    fontFamily: 'var(--ds-font-display)',
                    fontWeight: 'var(--ds-font-weight-semibold)',
                    letterSpacing: `var(--ds-letter-spacing-${t.display})`,
                  }
                : {}),
            }}
          >
            The quick brown fox jumps over the lazy dog
          </span>
          <span className={styles.typeNote}>{t.note}</span>
        </div>
      ))}
    </div>
  );
}

const FONT_FAMILIES = [
  {
    name: '--ds-font-sans',
    label: 'Inter',
    note: 'body & UI (--ds-font-family) · 400 / 500 / 600 / 700',
    sample: 'Schema-aware components for Next.js',
    style: {},
  },
  {
    name: '--ds-font-display',
    label: 'Inter Tight',
    note: 'headings & display · 600, letter-spacing -0.02em (h1 -0.03em)',
    sample: 'Build apps on your data',
    style: {
      fontWeight: 'var(--ds-font-weight-semibold)',
      letterSpacing: 'var(--ds-letter-spacing-tighter)',
      fontSize: 'var(--ds-font-size-3xl)',
    },
  },
  {
    name: '--ds-font-mono',
    label: 'JetBrains Mono',
    note: 'code, kbd, hex values · 400 / 500',
    sample: 'buildpad add input --with-deps',
    style: {},
  },
] as const;

export function FontFamilies() {
  return (
    <div className={styles.fontSpecimens}>
      {FONT_FAMILIES.map((f) => (
        <div key={f.name} className={styles.fontSpecimen}>
          <div className={styles.fontSpecimenMeta}>
            <strong>{f.label}</strong>
            <code>{f.name}</code>
          </div>
          <span
            className={styles.fontSpecimenSample}
            style={{ fontFamily: `var(${f.name})`, ...f.style }}
          >
            {f.sample}
          </span>
          <span className={styles.typeNote}>{f.note}</span>
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
  { name: '--ds-radius-sm', label: 'sm', note: 'tooltips, small controls' },
  { name: '--ds-radius', label: 'base', note: 'inputs (default)' },
  { name: '--ds-radius-md', label: 'md', note: 'Paper' },
  { name: '--ds-radius-lg', label: 'lg', note: 'popovers, menus' },
  { name: '--ds-radius-xl', label: 'xl', note: 'modals' },
  { name: '--ds-radius-card', label: 'card', note: 'cards' },
  { name: '--ds-radius-hero', label: 'hero', note: 'large surfaces' },
  { name: '--ds-radius-pill', label: 'pill', note: 'buttons, badges' },
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
  { name: '--ds-shadow-xs', label: 'xs', note: 'hairline lift' },
  { name: '--ds-shadow-sm', label: 'sm', note: 'small controls' },
  { name: '--ds-shadow', label: 'base', note: 'raised elements' },
  { name: '--ds-shadow-md', label: 'md', note: 'hover elevation' },
  { name: '--ds-shadow-lg', label: 'lg', note: 'popovers, menus, dropdowns' },
  { name: '--ds-shadow-xl', label: 'xl', note: 'modals' },
  { name: '--ds-card-shadow', label: 'card', note: 'cards (default)' },
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
        <code>--ds-focus-ring</code> + <code>--ds-focus-border</code> · hover opacity{' '}
        <code>--ds-hover-opacity: 0.85</code> · disabled opacity{' '}
        <code>--ds-disabled-opacity: 0.5</code> · transitions{' '}
        <code>150ms / 200ms cubic-bezier(0.2, 0, 0, 1)</code>
      </div>
    </div>
  );
}
