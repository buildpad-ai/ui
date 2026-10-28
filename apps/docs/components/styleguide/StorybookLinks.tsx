'use client';

import styles from './styleguide.module.css';

const STORYBOOKS = [
  { href: '/storybook/interfaces', label: 'Interfaces', desc: '32+ field components' },
  { href: '/storybook/form', label: 'Form', desc: 'VForm dynamic form' },
  { href: '/storybook/table', label: 'Table', desc: 'VTable dynamic table' },
  { href: '/storybook/collections', label: 'Collections', desc: 'CRUD form + list' },
] as const;

export function StorybookLinks() {
  return (
    <div className={styles.storybookLinks}>
      {STORYBOOKS.map((s) => (
        <a key={s.href} href={s.href} className={styles.storybookLink}>
          <strong>{s.label}</strong>
          <span>{s.desc}</span>
        </a>
      ))}
    </div>
  );
}

