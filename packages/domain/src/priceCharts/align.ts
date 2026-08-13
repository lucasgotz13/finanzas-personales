import type { NativeSeries } from './types';

/** Common-calendar alignment of several native series (PC-2). */
export interface AlignedSeries {
  /** Ascending calendar dates present in at least one series within the window. */
  dates: string[];
  /** Per ticker: date → native valueMinor. Absent dates are simply missing —
   * never zero-filled (PC-2). */
  byTicker: Map<string, Map<string, number>>;
}

function daysSinceEpoch(date: string): number {
  return Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
}

function addDays(date: string, delta: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/**
 * Aligns native series onto the range's common calendar (PC-2): every date
 * present in any series becomes a calendar day; series missing that day keep
 * it absent (never zero-filled). Points outside [today − windowDays + 1, today]
 * are dropped, so newly listed assets start at their first point.
 */
export function alignToCalendar(series: NativeSeries[], windowDays: number, today: string): AlignedSeries {
  const start = addDays(today, -(windowDays - 1));
  const startEpoch = daysSinceEpoch(start);
  const endEpoch = daysSinceEpoch(today);
  const byTicker = new Map<string, Map<string, number>>();
  const dateSet = new Set<string>();
  for (const s of series) {
    const map = new Map<string, number>();
    for (const p of s.points) {
      const epoch = daysSinceEpoch(p.date);
      if (epoch < startEpoch || epoch > endEpoch) continue;
      map.set(p.date, p.valueMinor);
      dateSet.add(p.date);
    }
    byTicker.set(s.ticker, map);
  }
  return { dates: [...dateSet].sort(), byTicker };
}
