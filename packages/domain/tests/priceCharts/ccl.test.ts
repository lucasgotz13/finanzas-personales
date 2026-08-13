import { describe, expect, it } from 'vitest';
import type { CclPoint, PricePoint } from '../../src/priceCharts/types';
import { CclLookup, convertSeries } from '../../src/priceCharts/ccl';

function pts(points: Array<[string, number]>): PricePoint[] {
  return points.map(([date, valueMinor]) => ({ date, valueMinor }));
}

// CCL published on trading days only (weekend 2026-08-08/09 in between).
const CCL: CclPoint[] = [
  { date: '2026-08-03', value: 1300 },
  { date: '2026-08-05', value: 1345 },
  { date: '2026-08-07', value: 1400 },
];

describe('CclLookup (PC-3)', () => {
  it('forward-fills a weekend date with the last known CCL', () => {
    const lookup = new CclLookup(CCL);
    expect(lookup.rateFor('2026-08-08')).toBe(1400); // Saturday
    expect(lookup.rateFor('2026-08-09')).toBe(1400); // Sunday
  });

  it('uses the exact same-date CCL when published', () => {
    const lookup = new CclLookup(CCL);
    expect(lookup.rateFor('2026-08-05')).toBe(1345);
  });

  it('fills up to 5 calendar days and drops older dates (D4 bound)', () => {
    const lookup = new CclLookup(CCL);
    expect(lookup.rateFor('2026-08-12')).toBe(1400); // exactly 5 days after 08-07
    expect(lookup.rateFor('2026-08-13')).toBeNull(); // 6 days — beyond the bound
  });

  it('returns null for dates before the first known CCL', () => {
    const lookup = new CclLookup(CCL);
    expect(lookup.rateFor('2026-08-01')).toBeNull();
  });
});

describe('convertSeries (PC-3)', () => {
  it('multiplies USD-native values by CCL(t) for an ARS target, rounding once', () => {
    const points = pts([
      ['2026-08-05', 20000],
      ['2026-08-07', 21000],
      ['2026-08-08', 22000], // weekend → FF from 08-07
    ]);

    const converted = convertSeries(points, 'USD', 'ARS', CCL);

    expect(converted).toEqual([
      { date: '2026-08-05', valueMinor: Math.round(20000 * 1345) },
      { date: '2026-08-07', valueMinor: Math.round(21000 * 1400) },
      { date: '2026-08-08', valueMinor: Math.round(22000 * 1400) },
    ]);
  });

  it('divides ARS-native values by CCL(t) for a USD target, rounding once', () => {
    const points = pts([
      ['2026-08-05', 2690000],
      ['2026-08-07', 2800000],
    ]);

    const converted = convertSeries(points, 'ARS', 'USD', CCL);

    expect(converted).toEqual([
      { date: '2026-08-05', valueMinor: Math.round(2690000 / 1345) },
      { date: '2026-08-07', valueMinor: Math.round(2800000 / 1400) },
    ]);
  });

  it('drops dates beyond the fill bound and before the first CCL', () => {
    const points = pts([
      ['2026-08-01', 10000], // pre-first-CCL
      ['2026-08-13', 20000], // beyond 5-day bound
      ['2026-08-12', 21000], // at the bound — kept
    ]);

    const converted = convertSeries(points, 'USD', 'ARS', CCL);

    expect(converted).toEqual([{ date: '2026-08-12', valueMinor: Math.round(21000 * 1400) }]);
  });

  it('returns native points unchanged when native equals target', () => {
    const points = pts([
      ['2026-08-05', 20000],
      ['2026-08-07', 21000],
    ]);

    const converted = convertSeries(points, 'ARS', 'ARS', []);

    expect(converted).toEqual(points);
  });
});
