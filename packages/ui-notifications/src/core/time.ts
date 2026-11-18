/** Relative and day-group labels for notification timestamps. */
export interface TimeStrings {
  justNow: string;
  minutes: string;
  hours: string;
  days: string;
  today: string;
  yesterday: string;
}

export const DEFAULT_TIME_STRINGS: TimeStrings = {
  justNow: 'just now',
  minutes: '{count}m',
  hours: '{count}h',
  days: '{count}d',
  today: 'Today',
  yesterday: 'Yesterday',
};

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
/** Whole local calendar days between `then` and `now` (DST-safe via rounding). */
const calendarDays = (now: Date, then: Date) => Math.round((startOfDay(now) - startOfDay(then)) / DAY);

const fill = (template: string, count: number) => template.replace('{count}', String(count));

/**
 * "just now" (< 1 min), "Nm", "Nh" (< 24 h), then "Nd" by local calendar days (so it agrees with
 * `dayGroupLabel`: Yesterday is 1d) up to 6d, else the locale date.
 */
export function timeAgo(iso: string, now: Date = new Date(), strings: TimeStrings = DEFAULT_TIME_STRINGS, locale?: string): string {
  const then = new Date(iso);
  const diff = now.getTime() - then.getTime();
  if (Number.isNaN(diff)) return '';
  if (diff < MIN) return strings.justNow;
  if (diff < HOUR) return fill(strings.minutes, Math.floor(diff / MIN));
  if (diff < DAY) return fill(strings.hours, Math.floor(diff / HOUR));
  const days = calendarDays(now, then);
  if (days < 7) return fill(strings.days, Math.max(1, days));
  return then.toLocaleDateString(locale);
}


/** Local-time day group: "Today", "Yesterday", else "MMM d, yyyy". */
export function dayGroupLabel(iso: string, now: Date = new Date(), strings: TimeStrings = DEFAULT_TIME_STRINGS, locale = 'en-US'): string {
  const then = new Date(iso);
  const days = calendarDays(now, then);
  if (days === 0) return strings.today;
  if (days === 1) return strings.yesterday;
  return then.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
}

/** A stable key for the local day of `iso`, for grouping. */
export const dayKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};
