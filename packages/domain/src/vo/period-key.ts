import { ValidationError } from '../errors';

export type PeriodType = 'month' | 'quarter' | 'year';

/** Argentina has been UTC-3 with no DST since 2015; 00:00 AR == 03:00 UTC. */
const AR_UTC_OFFSET_HOURS = 3;
const AR_TZ = 'America/Argentina/Buenos_Aires';

export interface ArDateParts {
  year: number;
  month: number; // 1-12
  day: number;
}

const arFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: AR_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Calendar date components of an instant in the AR timezone (PS-1). */
export function arDateParts(date: Date): ArDateParts {
  const [year, month, day] = arFormatter.format(date).split('-').map(Number);
  return { year, month, day };
}

/** The AR-calendar date of an instant as a YYYY-MM-DD string. */
export function arDateString(date: Date): string {
  const { year, month, day } = arDateParts(date);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** True when value is a real calendar date in YYYY-MM-DD form. */
export function isArDateString(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const QUARTER_RE = /^\d{4}-Q[1-4]$/;
const YEAR_RE = /^\d{4}$/;

/**
 * A calendar period (month/quarter/year) in the AR timezone, identified by a
 * stable key: YYYY-MM, YYYY-Qn, or YYYY.
 */
export class PeriodKey {
  readonly period: PeriodType;
  readonly key: string;

  private constructor(period: PeriodType, key: string) {
    this.period = period;
    this.key = key;
  }

  /** Period key of an instant, attributed to the AR calendar (PS-1, ET-3). */
  static of(period: PeriodType, date: Date): PeriodKey {
    const { year, month } = arDateParts(date);
    if (period === 'month') return new PeriodKey(period, `${year}-${String(month).padStart(2, '0')}`);
    if (period === 'quarter') return new PeriodKey(period, `${year}-Q${Math.floor((month - 1) / 3) + 1}`);
    return new PeriodKey(period, String(year));
  }

  /** Parse a raw key string, validating it against the period type. */
  static parse(period: PeriodType, key: string): PeriodKey {
    const details: string[] = [];
    if (period === 'month' && !MONTH_RE.test(key)) details.push('month must be YYYY-MM');
    if (period === 'quarter' && !QUARTER_RE.test(key)) details.push('quarter must be YYYY-Qn with n in 1..4');
    if (period === 'year' && !YEAR_RE.test(key)) details.push('year must be YYYY');
    if (details.length > 0) {
      throw new ValidationError(`Invalid ${period} key`, details);
    }
    return new PeriodKey(period, key);
  }

  /** [start, end) UTC instants delimiting the AR-tz calendar period. */
  bounds(): { start: Date; end: Date } {
    if (this.period === 'month') {
      const [year, month] = this.key.split('-').map(Number);
      return {
        start: new Date(Date.UTC(year, month - 1, 1, AR_UTC_OFFSET_HOURS)),
        end: new Date(Date.UTC(year, month, 1, AR_UTC_OFFSET_HOURS)),
      };
    }
    if (this.period === 'quarter') {
      const [yearPart, quarterPart] = this.key.split('-Q');
      const year = Number(yearPart);
      const firstMonth = (Number(quarterPart) - 1) * 3 + 1;
      return {
        start: new Date(Date.UTC(year, firstMonth - 1, 1, AR_UTC_OFFSET_HOURS)),
        end: new Date(Date.UTC(year, firstMonth + 2, 1, AR_UTC_OFFSET_HOURS)),
      };
    }
    const year = Number(this.key);
    return {
      start: new Date(Date.UTC(year, 0, 1, AR_UTC_OFFSET_HOURS)),
      end: new Date(Date.UTC(year + 1, 0, 1, AR_UTC_OFFSET_HOURS)),
    };
  }
}
