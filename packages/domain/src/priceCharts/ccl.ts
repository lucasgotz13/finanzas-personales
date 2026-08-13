import { FF_MAX_DAYS } from './catalog';
import type { CclPoint, PricePoint, SeriesCurrency } from './types';

function daysBetween(from: string, to: string): number {
  const parse = (d: string): number => Math.floor(Date.parse(`${d}T00:00:00Z`) / 86_400_000);
  return parse(to) - parse(from);
}

/** CCL lookup by date with bounded forward-fill (PC-3, D4). */
export class CclLookup {
  private byDate = new Map<string, number>();
  private sorted: CclPoint[];

  constructor(ccl: CclPoint[]) {
    this.sorted = [...ccl].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    for (const p of this.sorted) this.byDate.set(p.date, p.value);
  }

  /** Last known CCL at `date`, forward-filled at most FF_MAX_DAYS calendar
   * days back; null before the first known CCL or beyond the fill bound. */
  rateFor(date: string): number | null {
    const exact = this.byDate.get(date);
    if (exact !== undefined) return exact;
    let last: CclPoint | null = null;
    for (const p of this.sorted) {
      if (p.date > date) break;
      last = p;
    }
    if (last === null) return null;
    if (daysBetween(last.date, date) > FF_MAX_DAYS) return null;
    return last.value;
  }
}

/**
 * Converts a native series to the target currency (PC-3): USD-native points
 * multiply by CCL(t), ARS-native points divide; rounding happens once per
 * point (D8). Dates with no fillable CCL are dropped. No-op when native
 * equals target.
 */
export function convertSeries(points: PricePoint[], native: SeriesCurrency, target: SeriesCurrency, ccl: CclPoint[]): PricePoint[] {
  if (native === target) return points;
  const lookup = new CclLookup(ccl);
  const out: PricePoint[] = [];
  for (const p of points) {
    const rate = lookup.rateFor(p.date);
    if (rate === null) continue;
    out.push({
      date: p.date,
      valueMinor: target === 'ARS' ? Math.round(p.valueMinor * rate) : Math.round(p.valueMinor / rate),
    });
  }
  return out;
}
