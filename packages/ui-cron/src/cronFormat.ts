/**
 * How the cron surfaces write a point in time: date and time to the second,
 * in the locale and the time zone of the `BuildpadI18nProvider` (the browser's
 * without one). To the second because two runs of a job can be seconds apart,
 * and a history that lists both under the same minute cannot tell them apart.
 *
 * Passed to `formatDate` of `useBuildpadI18n`. Private to the package.
 */
export const CRON_DATE_TIME_FORMAT: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'medium' };
