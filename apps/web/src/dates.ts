/**
 * es-AR date helpers: ISO keys are rendered for Argentine users. Output is
 * always es-AR; unparseable input is returned as-is (never throws).
 *
 * Dates are parsed as UTC and formatted with timeZone 'UTC' so the rendered
 * month/day never shifts under the host's local offset.
 */

function parseIsoDate(value: string): Date | null {
  const [year, month, day] = value.split('T')[0].split('-').map(Number);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  const roundTrips =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return roundTrips ? date : null;
}

/** 'YYYY-MM' input needs a day before it can be parsed as an ISO date. */
function asFullDay(iso: string): string {
  return iso.length === 7 ? `${iso}-01` : iso;
}

/** '2026-08' → 'Agosto 2026' (long month name + year). */
export function formatMonth(iso: string): string {
  const date = parseIsoDate(asFullDay(iso));
  if (!date) return iso;
  const parts = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).formatToParts(date);
  const month = parts.find((p) => p.type === 'month')?.value;
  const year = parts.find((p) => p.type === 'year')?.value;
  if (!month || !year) return iso;
  return `${month.charAt(0).toUpperCase()}${month.slice(1)} ${year}`;
}

/** '2026-08-11' → '11/08/2026' (day/month/year). */
export function formatDate(iso: string): string {
  const date = parseIsoDate(iso);
  if (!date) return iso;
  return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(date);
}

/** '2026-07-31' (or '2026-07') → 'jul 2026' (short month name + year). */
export function formatRefMonth(iso: string): string {
  const date = parseIsoDate(asFullDay(iso));
  if (!date) return iso;
  return new Intl.DateTimeFormat('es-AR', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date);
}
