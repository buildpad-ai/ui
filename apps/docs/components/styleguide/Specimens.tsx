'use client';

import { useState, type SVGProps } from 'react';
import styles from './styleguide.module.css';

// ── Icons (Inline SVGs for reliability and zero external deps) ────────────────

function CheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function InfoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

function AlertIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function DangerIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );
}

function SearchIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function ArrowUpRightIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <line x1="7" y1="17" x2="17" y2="7" />
      <polyline points="7 7 17 7 17 17" />
    </svg>
  );
}

function ArrowDownRightIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <line x1="7" y1="7" x2="17" y2="17" />
      <polyline points="17 7 17 17 7 17" />
    </svg>
  );
}

/**
 * Specimens component: visual compositions demonstrating real-world token styling.
 */
export function Specimens() {
  const [activeTab, setActiveTab] = useState<'overview' | 'deployments'>('overview');
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className={styles.specimens}>
      {/* 1. Buttons & Interaction States */}
      <div className={styles.specimenItem}>
        <div className={styles.sectionTitle}>Buttons & Interaction States</div>
        <table className={styles.statesTable}>
          <thead>
            <tr>
              <th>Variant</th>
              <th>Normal / Interactive</th>
              <th>Disabled State</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Primary Filled</td>
              <td>
                <button type="button" className={styles.specButton}>
                  Primary Action
                </button>
              </td>
              <td>
                <button type="button" className={styles.specButton} disabled>
                  Disabled Primary
                </button>
              </td>
            </tr>
            <tr>
              <td>Outline</td>
              <td>
                <button type="button" className={styles.specButton} data-variant="outline">
                  Secondary Action
                </button>
              </td>
              <td>
                <button type="button" className={styles.specButton} data-variant="outline" disabled>
                  Disabled Outline
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <span className={styles.tileNote}>
          Uses <code>--ds-primary</code> and <code>--ds-gray-300</code> borders. Disabled elements respect <code>--ds-disabled-opacity: 0.5</code>.
        </span>
      </div>

      {/* 2. Status Badges & Chips */}
      <div className={styles.specimenItem}>
        <div className={styles.sectionTitle}>Status Badges & Chips</div>
        <div className={styles.badgeRow}>
          <span className={`${styles.badge} ${styles.badgePrimary}`}>Primary</span>
          <span className={`${styles.badge} ${styles.badgeSecondary}`}>Secondary</span>
          <span className={`${styles.badge} ${styles.badgeSuccess}`}>Success</span>
          <span className={`${styles.badge} ${styles.badgeInfo}`}>Info</span>
          <span className={`${styles.badge} ${styles.badgeWarning}`}>Warning</span>
          <span className={`${styles.badge} ${styles.badgeDanger}`}>Danger</span>
          <span className={`${styles.badge} ${styles.badgeGray}`}>Gray</span>
        </div>
        <span className={styles.tileNote}>
          Badges pair stop 50 (background) and stop 700 (text) for optimal light/dark contrast and readability.
        </span>
      </div>

      {/* 3. Form Input Compositions */}
      <div className={styles.specimenItem}>
        <div className={styles.sectionTitle}>Input Compositions</div>
        <div className={styles.specimenGrid}>
          {/* Prefix/Suffix Icon Input */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-spacing-1)' }}>
            <label className={styles.specLabel}>Search Database</label>
            <div className={styles.inputGroup}>
              <span className={styles.inputIconLeft}>
                <SearchIcon />
              </span>
              <input
                className={`${styles.specInput} ${styles.inputWithIconLeft}`}
                type="text"
                placeholder="Search resources..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <span className={styles.inputHelper}>Search fields include title, tags, and description.</span>
          </div>

          {/* Error / Validation Input */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-spacing-1)' }}>
            <label className={styles.specLabel}>Email Address</label>
            <input
              className={`${styles.specInput} ${styles.inputInvalid}`}
              type="email"
              defaultValue="invalid-email-address"
              placeholder="you@domain.com"
            />
            <span className={styles.inputErrorText}>Please enter a valid email address.</span>
          </div>
        </div>
      </div>

      {/* 4. Alert & Notification Callouts */}
      <div className={styles.specimenItem}>
        <div className={styles.sectionTitle}>Alert Callouts</div>
        <div className={styles.specimenGrid}>
          <div className={styles.alertBox} data-type="success">
            <CheckIcon style={{ color: 'var(--ds-success)', marginTop: '2px' }} />
            <div className={styles.alertContent}>
              <div className={styles.alertTitle} style={{ color: 'var(--ds-success-700)' }}>Sync Completed</div>
              <span style={{ color: 'var(--ds-success-800)' }}>All 34 schema tables were successfully indexed and synchronized.</span>
            </div>
          </div>
          
          <div className={styles.alertBox} data-type="danger">
            <DangerIcon style={{ color: 'var(--ds-danger)', marginTop: '2px' }} />
            <div className={styles.alertContent}>
              <div className={styles.alertTitle} style={{ color: 'var(--ds-danger-700)' }}>Connection Error</div>
              <span style={{ color: 'var(--ds-danger-800)' }}>Failed to establish connection to DaaS server. Retrying...</span>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Navigation / Tabs */}
      <div className={styles.specimenItem}>
        <div className={styles.sectionTitle}>Navigation Elements</div>
        <div className={styles.tabsContainer}>
          <button
            type="button"
            className={styles.tabItem}
            data-active={activeTab === 'overview'}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button
            type="button"
            className={styles.tabItem}
            data-active={activeTab === 'deployments'}
            onClick={() => setActiveTab('deployments')}
          >
            Deployments
          </button>
          <button type="button" className={styles.tabItem} disabled>
            Settings
          </button>
        </div>
        <span className={styles.tileNote}>
          Interactive state updates: Currently showing {activeTab === 'overview' ? 'Overview' : 'Deployments'} segment.
        </span>
      </div>

      {/* 6. Dashboard Stat Card (Elevated Specimen) */}
      <div className={styles.specimenItem}>
        <div className={styles.sectionTitle}>Dashboard Stat Card</div>
        <div className={styles.specimenGrid}>
          <div className={styles.statCard}>
            <div className={styles.statHeader}>
              <span className={styles.statTitle}>API Success Rate</span>
              <span className={`${styles.badge} ${styles.badgeSuccess}`}>
                <ArrowUpRightIcon style={{ marginRight: '2px', width: '12px', height: '12px' }} /> +0.4%
              </span>
            </div>
            <div className={styles.statMetric}>99.98%</div>
            <div className={styles.statFooter}>
              <span className={styles.statFooterLabel}>Average latency: 42ms</span>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statHeader}>
              <span className={styles.statTitle}>Active Sessions</span>
              <span className={`${styles.badge} ${styles.badgeDanger}`}>
                <ArrowDownRightIcon style={{ marginRight: '2px', width: '12px', height: '12px' }} /> -8.2%
              </span>
            </div>
            <div className={styles.statMetric}>1,429</div>
            <div className={styles.statFooter}>
              <span className={styles.statFooterLabel}>Peak concurrency today: 2,105</span>
            </div>
          </div>
        </div>
        <span className={styles.tileNote}>
          Stat cards leverage <code>--ds-shadow-sm</code>, transitioning smoothly to <code>--ds-shadow-md</code> and scaling slightly upwards on hover.
        </span>
      </div>

      {/* 7. Hover & Transition Demo */}
      <div className={styles.specimenItem}>
        <div className={styles.sectionTitle}>Transition & Motion</div>
        <div className={styles.transitionGrid}>
          <div className={`${styles.transitionBox} ${styles.transitionBoxFast}`}>
            <strong>Fast Transition</strong>
            <span>150ms ease</span>
            <code>--ds-transition-fast</code>
          </div>
          <div className={`${styles.transitionBox} ${styles.transitionBoxNormal}`}>
            <strong>Normal Transition</strong>
            <span>200ms ease</span>
            <code>--ds-transition-normal</code>
          </div>
        </div>
        <span className={styles.tileNote}>
          Hover over the blocks to observe transition speeds and transforms in action.
        </span>
      </div>

      {/* 8. Table / Data List Row */}
      <div className={styles.specimenItem}>
        <div className={styles.sectionTitle}>Data List Row</div>
        <div className={styles.rowList}>
          <div className={styles.rowItem}>
            <div className={styles.rowAvatar}>JD</div>
            <div className={styles.rowBody}>
              <span className={styles.rowTitle}>John Doe</span>
              <span className={styles.rowSubtitle}>Admin · john.doe@daas.io</span>
            </div>
            <span className={`${styles.badge} ${styles.badgeSuccess}`}>Active</span>
            <span className={styles.rowMeta}>2 mins ago</span>
          </div>
          <div className={styles.rowItem}>
            <div className={styles.rowAvatar}>AS</div>
            <div className={styles.rowBody}>
              <span className={styles.rowTitle}>Automation Sync</span>
              <span className={styles.rowSubtitle}>Service Account · sync@daas.io</span>
            </div>
            <span className={`${styles.badge} ${styles.badgeWarning}`}>Warning</span>
            <span className={styles.rowMeta}>1 hour ago</span>
          </div>
          <div className={styles.rowItem}>
            <div className={styles.rowAvatar}>ML</div>
            <div className={styles.rowBody}>
              <span className={styles.rowTitle}>Maria Lopez</span>
              <span className={styles.rowSubtitle}>Developer · maria@daas.io</span>
            </div>
            <span className={`${styles.badge} ${styles.badgeDanger}`}>Suspended</span>
            <span className={styles.rowMeta}>3 days ago</span>
          </div>
        </div>
        <span className={styles.tileNote}>
          Simulates table-row spacing with subtle bottom borders, hover background transitions, and responsive content mapping.
        </span>
      </div>
    </div>
  );
}

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

