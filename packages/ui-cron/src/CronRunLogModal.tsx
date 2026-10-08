'use client';

import React, { useState } from 'react';
import { Box, Group, Modal, ScrollArea, Stack, Text } from '@mantine/core';
import { useBuildpadI18n, useBuildpadTranslations } from '@buildpad/services';
import type { CronRunRecord } from '@buildpad/types';
import {
  interpolate,
  parseCronLogLine,
  type CronLogLevel,
  type CronTranslations,
  type DeepPartial,
} from '@buildpad/utils';
import { CRON_DATE_TIME_FORMAT } from './cronFormat';
import { CronRunStatusBadge } from './CronRunStatusBadge';
import { CronTriggerBadge } from './CronTriggerBadge';

// The console is dark in both color schemes, like a terminal: its colors are
// its own and do not follow the theme.
const CONSOLE_BACKGROUND = '#111827';
const CONSOLE_TEXT = '#e5e7eb';
const CONSOLE_DIMMED = '#9ca3af';
const LEVEL_COLORS: Record<CronLogLevel, string> = {
  INFO: '#9ca3af',
  WARN: '#fbbf24',
  ERROR: '#f87171',
  RAW: '#9ca3af',
};

/**
 * A log line's time of day, to the millisecond. `fractionalSecondDigits` is
 * ES2021; the package compiles against the ES2020 library, hence the assertion.
 */
const LOG_TIME_FORMAT = {
  hour12: false,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  fractionalSecondDigits: 3,
} as Intl.DateTimeFormatOptions;

export interface CronRunLogModalProps {
  /** The run to show. `null` closes the dialog. */
  run: CronRunRecord | null;
  /** Called by the close button, Escape and a click outside. */
  onClose: () => void;
  /**
   * Name the job in the title ("Run logs — Nightly report"). Turn it off where
   * the job is already on screen (its own History tab). Default: true.
   */
  showJobName?: boolean;
  /** Per-instance overrides of the `cron` dictionary namespace (prop > provider > defaults). */
  translations?: DeepPartial<CronTranslations>;
}

/**
 * One run of a cron job: its outcome, what started it, when, how long it took,
 * the error it ended with, and its console output line by line (time, level,
 * message). An entry that is not in the `[time] [LEVEL] message` form is shown
 * whole, so nothing a run printed is dropped.
 *
 * One dialog for the history of every job and for the history of one. The
 * reference admin UI (buildpad-daas) kept a copy per page, differing in the
 * title alone; `showJobName` is that difference.
 */
export const CronRunLogModal: React.FC<CronRunLogModalProps> = ({
  run,
  onClose,
  showJobName = true,
  translations,
}) => {
  const t = useBuildpadTranslations((d) => d.cron, translations);
  const { formatCount, formatDate, formatNumber } = useBuildpadI18n();

  // The dialog fades out after `run` goes back to null: keep drawing the run
  // it was opened with until then.
  const [shown, setShown] = useState<CronRunRecord | null>(run);
  if (run && run !== shown) setShown(run);

  const logs = shown?.logs ?? [];
  const duration =
    typeof shown?.duration_ms === 'number'
      ? interpolate(t.durationMs, { duration: formatNumber(shown.duration_ms) })
      : t.emptyValue;

  return (
    <Modal
      opened={run !== null}
      onClose={onClose}
      title={
        shown && (
          <Group gap="xs">
            <Text fw={600} size="sm">
              {showJobName && shown.job_name
                ? interpolate(t.logModal.titleWithJob, { job: shown.job_name })
                : t.logModal.title}
            </Text>
            <CronRunStatusBadge status={shown.status} translations={translations} />
            <CronTriggerBadge triggeredBy={shown.triggered_by} translations={translations} />
          </Group>
        )
      }
      size="xl"
      centered
      data-testid="cron-run-log-modal"
    >
      {shown && (
        <>
          <Stack gap="xs" mb="sm">
            <Group gap="xl">
              <Box>
                <Text size="xs" c="dimmed">
                  {t.logModal.triggered}
                </Text>
                <Text size="sm" data-testid="cron-run-log-triggered">
                  {/* `formatDate` returns '' for an empty or invalid value */}
                  {formatDate(shown.triggered_at, CRON_DATE_TIME_FORMAT) || t.emptyValue}
                </Text>
              </Box>
              <Box>
                <Text size="xs" c="dimmed">
                  {t.logModal.duration}
                </Text>
                <Text size="sm" data-testid="cron-run-log-duration">
                  {duration}
                </Text>
              </Box>
            </Group>
            {shown.error && (
              <Box
                p="xs"
                style={{
                  background: 'var(--mantine-color-red-light)',
                  border: '1px solid var(--mantine-color-red-light-hover)',
                  borderRadius: 'var(--mantine-radius-sm)',
                }}
                data-testid="cron-run-log-error"
              >
                <Text size="xs" fw={600} c="red" mb={2}>
                  {t.logModal.error}
                </Text>
                <Text size="xs" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                  {shown.error}
                </Text>
              </Box>
            )}
          </Stack>

          <Text size="xs" c="dimmed" mb={4} data-testid="cron-run-log-count">
            {formatCount(logs.length, t.count.logLines)}
          </Text>

          <ScrollArea
            h={400}
            style={{
              border: '1px solid var(--mantine-color-default-border)',
              borderRadius: 'var(--mantine-radius-sm)',
            }}
          >
            <Box
              p="sm"
              style={{
                background: CONSOLE_BACKGROUND,
                minHeight: 400,
                fontFamily: 'var(--mantine-font-family-monospace)',
                fontSize: 12,
              }}
              data-testid="cron-run-log-lines"
            >
              {logs.length > 0 ? (
                logs.map((entry, index) => {
                  const { timestamp, level, message } = parseCronLogLine(entry);
                  return (
                    // The lines of one run never reorder, so the index is a stable key
                    <Box key={index} style={{ display: 'flex', gap: 8, lineHeight: 1.7 }} data-testid="cron-run-log-line">
                      {timestamp && (
                        <Text span size="xs" style={{ color: CONSOLE_DIMMED, whiteSpace: 'nowrap', flexShrink: 0 }}>
                          {/* A time that is not a date is shown as it was written */}
                          {formatDate(timestamp, LOG_TIME_FORMAT) || timestamp}
                        </Text>
                      )}
                      <Text
                        span
                        size="xs"
                        fw={700}
                        style={{ color: LEVEL_COLORS[level], whiteSpace: 'nowrap', flexShrink: 0, width: 42 }}
                      >
                        {level === 'RAW' ? '' : level}
                      </Text>
                      <Text span size="xs" style={{ color: CONSOLE_TEXT, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                        {message}
                      </Text>
                    </Box>
                  );
                })
              ) : (
                <Text size="xs" style={{ color: CONSOLE_DIMMED, fontStyle: 'italic' }} data-testid="cron-run-log-empty">
                  {t.logModal.empty}
                </Text>
              )}
            </Box>
          </ScrollArea>
        </>
      )}
    </Modal>
  );
};

export default CronRunLogModal;
