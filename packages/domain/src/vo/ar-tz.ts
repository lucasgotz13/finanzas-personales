/** Argentina has been UTC-3 with no DST since 2015 (fixed offset -03:00). */
const AR_TZ = 'America/Argentina/Buenos_Aires';
const AR_OFFSET = '-03:00';

const arFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: AR_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

/**
 * ISO-8601 string of an instant in the AR timezone (fixed -03:00), e.g.
 * `2026-08-09T20:58:00-03:00`. Used for indicator timestamps (EI-5).
 */
export function arIsoString(date: Date): string {
  const parts = arFormatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}${AR_OFFSET}`;
}
