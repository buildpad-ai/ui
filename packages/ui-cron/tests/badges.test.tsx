/**
 * The three badges: a job's status, a run's outcome and what started a run.
 * One wording each, wherever they are drawn.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { describe, it, expect } from 'vitest';
import type { CronJobStatus, CronRunStatus, CronTriggeredBy } from '@buildpad/types';
import { CronJobStatusBadge } from '../src/CronJobStatusBadge';
import { CronRunStatusBadge } from '../src/CronRunStatusBadge';
import { CronTriggerBadge } from '../src/CronTriggerBadge';

const ui = (node: React.ReactNode) => render(<MantineProvider>{node}</MantineProvider>);

/** The Mantine color a badge was given. */
const color = (element: HTMLElement) => element.style.getPropertyValue('--badge-color');

describe('CronJobStatusBadge', () => {
  // The reference drew "Active" in the list and the stored "active" in the editor
  it.each([
    ['active', 'Active', 'green'],
    ['inactive', 'Inactive', 'gray'],
  ] as const)('writes %s as "%s", in one casing wherever it is drawn', (status, label, tone) => {
    ui(<CronJobStatusBadge status={status} data-testid="badge" />);
    const badge = screen.getByTestId('badge');
    expect(badge.textContent).toBe(label);
    expect(color(badge)).toContain(tone);
  });

  it.each([undefined, null])('draws the missing-value marker for a status of %s, not a badge', (status) => {
    ui(<CronJobStatusBadge status={status} data-testid="badge" />);
    const marker = screen.getByTestId('badge');
    expect(marker).toHaveTextContent('—');
    expect(marker).not.toHaveClass('mantine-Badge-root');
  });

  it('shows a status it does not know as it is stored', () => {
    ui(<CronJobStatusBadge status={'paused' as CronJobStatus} data-testid="badge" />);
    expect(screen.getByTestId('badge').textContent).toBe('paused');
  });

  it('reads its strings from the translations prop', () => {
    ui(<CronJobStatusBadge status="active" translations={{ jobStatus: { active: 'Aktif' } }} />);
    expect(screen.getByText('Aktif')).toBeInTheDocument();
  });
});

describe('CronRunStatusBadge', () => {
  it.each([
    ['success', 'Success', 'green'],
    ['error', 'Error', 'red'],
    ['timeout', 'Timeout', 'orange'],
    ['running', 'Running', 'blue'],
  ] as const)('writes %s as "%s"', (status, label, tone) => {
    ui(<CronRunStatusBadge status={status} data-testid="badge" />);
    const badge = screen.getByTestId('badge');
    expect(badge.textContent).toBe(label);
    expect(color(badge)).toContain(tone);
  });

  it('draws the missing-value marker for a job that has not run', () => {
    ui(<CronRunStatusBadge status={null} data-testid="badge" />);
    expect(screen.getByTestId('badge')).toHaveTextContent('—');
    expect(screen.getByTestId('badge')).not.toHaveClass('mantine-Badge-root');
  });

  it('shows an outcome it does not know as it is stored, in gray', () => {
    ui(<CronRunStatusBadge status={'cancelled' as CronRunStatus} data-testid="badge" />);
    const badge = screen.getByTestId('badge');
    expect(badge.textContent).toBe('cancelled');
    expect(color(badge)).toContain('gray');
  });

  it('reads its strings from the translations prop', () => {
    ui(<CronRunStatusBadge status="timeout" translations={{ runStatus: { timeout: 'Waktu habis' } }} />);
    expect(screen.getByText('Waktu habis')).toBeInTheDocument();
  });
});

describe('CronTriggerBadge', () => {
  it.each([
    ['manual', 'violet'],
    ['schedule', 'gray'],
    ['extension', 'gray'],
  ] as const)('writes %s in lower case, as the reference does', (trigger, tone) => {
    ui(<CronTriggerBadge triggeredBy={trigger} data-testid="badge" />);
    const badge = screen.getByTestId('badge');
    expect(badge.textContent).toBe(trigger);
    expect(color(badge)).toContain(tone);
  });

  it('shows a trigger it does not know as it is stored', () => {
    ui(<CronTriggerBadge triggeredBy={'webhook' as CronTriggeredBy} data-testid="badge" />);
    expect(screen.getByTestId('badge').textContent).toBe('webhook');
  });

  it('reads its strings from the translations prop', () => {
    ui(<CronTriggerBadge triggeredBy="schedule" translations={{ trigger: { schedule: 'jadwal' } }} />);
    expect(screen.getByText('jadwal')).toBeInTheDocument();
  });
});
