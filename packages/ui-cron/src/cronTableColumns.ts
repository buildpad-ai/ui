/**
 * How the two cron tables (the jobs list and the run history) share the width
 * of their container.
 *
 * `VTable` draws a header without a `width` at a fixed 160 px, and one with a
 * `width` at exactly that width: its columns never shrink and never grow, and
 * what is left over goes to an empty spacer. With eight columns that is a
 * table of 1168 px or more, whatever the container — in an admin shell with
 * an open sidebar on a 1280 px screen (a 970 px container) the row menu was
 * off screen, behind a horizontal scrollbar.
 *
 * So the cron tables give `VTable` their own grid template (the
 * `--bp-cron-grid-columns` custom property, applied by `CronManagerTable.css`):
 * a few small fixed columns (an icon, a badge) and flexible ones that share
 * the rest and never go under a minimum. A text longer than its column ends
 * in an ellipsis; it does not widen the table.
 *
 * The minima are chosen so every column of every table, the row menu and the
 * View logs button included, is on screen in a `CRON_TABLE_FIT_WIDTH` wide
 * container without a horizontal scrollbar. Measured in a browser (English,
 * the default theme; a cell has 12 px of padding on each side): the longest
 * date, "Sep 30, 2026, 10:59:59 PM", is 153 px; a status badge 69 px; the
 * "extension" badge 72 px; the "Last Status" heading 70 px and
 * "Duration (ms)" 86 px.
 *
 * Private to the package.
 */

/** One column of a cron table. */
export interface CronTableColumn {
  /** The `value` of the column's header. */
  value: string;
  /** The least the column is drawn at, in pixels. A fixed column is drawn at exactly this. */
  min: number;
  /** The column's share of the width that is left over. `0`: a fixed column. */
  grow: number;
}

/** The narrowest container the tables are laid out for without a horizontal scrollbar, in pixels. */
export const CRON_TABLE_FIT_WIDTH = 970;

/**
 * The cell `VTable` appends to a row for its menu or its View logs button: a
 * 22 px icon button and the cell's 12 px of padding on each side. A fixed
 * track, not `min-content`: the header has no content in that cell, and a
 * content-sized track would leave the header 46 px more to share than the
 * rows, so the headings would not stand over their columns.
 */
export const CRON_ROW_APPEND_WIDTH = 46;

/**
 * The jobs list: the name takes most of what is left over; the icon and the
 * two badges are fixed. The minima and the row menu add up to 966 px: in a
 * `CRON_TABLE_FIT_WIDTH` wide container a five-field schedule
 * ("0 9 * * 1-5", up to 95 px), a named timezone ("Asia/Jakarta", 70 px) and
 * both dates are whole, and the name has 90 px ("Nightly report" is 86); a
 * longer one ends in an ellipsis.
 */
export const CRON_JOBS_COLUMNS: readonly CronTableColumn[] = [
  { value: 'icon', min: 44, grow: 0 },
  // The name, with the description under it
  { value: 'name', min: 110, grow: 3 },
  { value: 'schedule', min: 120, grow: 1.2 },
  { value: 'timezone', min: 96, grow: 1 },
  { value: 'status', min: 94, grow: 0 },
  // A date to the second
  { value: 'lastRun', min: 180, grow: 0.6 },
  { value: 'lastStatus', min: 96, grow: 0 },
  { value: 'nextRun', min: 180, grow: 0.6 },
];

/** The two columns the history of every job has in front of the others. */
export const CRON_RUNS_JOB_COLUMNS: readonly CronTableColumn[] = [
  { value: 'icon', min: 40, grow: 0 },
  { value: 'job', min: 120, grow: 2 },
];

/** The run history: the Logs column, where an error is written, takes most of what is left over. */
export const CRON_RUNS_COLUMNS: readonly CronTableColumn[] = [
  { value: 'triggered', min: 180, grow: 0.6 },
  { value: 'duration', min: 112, grow: 0.5 },
  { value: 'status', min: 94, grow: 0 },
  { value: 'triggeredBy', min: 98, grow: 0 },
  { value: 'logs', min: 140, grow: 3 },
];

/**
 * The `grid-template-columns` of a cron table's header and rows: one track per
 * column, then the spacer `VTable` puts after the columns (nothing is left
 * over for it, so it gets no width), then the appended cell when the rows
 * have one.
 *
 * A flexible track is `minmax(<min>px, <grow>fr)`: both of its limits are
 * independent of what the cells hold, so every row — each row is a grid of
 * its own — resolves to the same columns as the header.
 */
export function cronGridTemplate(columns: readonly CronTableColumn[], appended: boolean): string {
  const tracks = columns.map((column) =>
    column.grow > 0 ? `minmax(${column.min}px, ${column.grow}fr)` : `${column.min}px`,
  );
  tracks.push('0px');
  if (appended) tracks.push(`${CRON_ROW_APPEND_WIDTH}px`);
  return tracks.join(' ');
}

/** The narrowest container a table fits in without a horizontal scrollbar, in pixels. */
export function cronTableMinWidth(columns: readonly CronTableColumn[], appended: boolean): number {
  const width = columns.reduce((sum, column) => sum + column.min, 0);
  return appended ? width + CRON_ROW_APPEND_WIDTH : width;
}

/** The inline style that hands a table's grid template to `CronManagerTable.css`. */
export function cronGridStyle(columns: readonly CronTableColumn[], appended: boolean): Record<string, string> {
  return { '--bp-cron-grid-columns': cronGridTemplate(columns, appended) };
}
