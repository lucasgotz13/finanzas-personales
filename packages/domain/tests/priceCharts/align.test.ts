import { describe, expect, it } from 'vitest';
import type { NativeSeries } from '../../src/priceCharts/types';
import { alignToCalendar } from '../../src/priceCharts/align';

const TODAY = '2026-08-09'; // 3m window (90 days) starts 2026-05-12

function series(ticker: string, nativeCurrency: 'ARS' | 'USD', points: Array<[string, number]>): NativeSeries {
  return { ticker, nativeCurrency, points: points.map(([date, valueMinor]) => ({ date, valueMinor })) };
}

describe('alignToCalendar (PC-2)', () => {
  it('keeps a BYMA holiday absent for AAPL.BA only, present in the common calendar', () => {
    const aapl = series('AAPL', 'USD', [
      ['2026-08-05', 20000],
      ['2026-08-06', 20100], // BYMA holiday: AAPL trades, AAPL.BA does not
      ['2026-08-07', 20200],
    ]);
    const aaplBa = series('AAPL.BA', 'ARS', [
      ['2026-08-05', 2700000],
      ['2026-08-07', 2720000],
    ]);

    const aligned = alignToCalendar([aapl, aaplBa], 90, TODAY);

    expect(aligned.dates).toEqual(['2026-08-05', '2026-08-06', '2026-08-07']);
    expect(aligned.byTicker.get('AAPL')?.get('2026-08-06')).toBe(20100);
    // Absent dates stay absent — never zero-filled.
    expect(aligned.byTicker.get('AAPL.BA')?.has('2026-08-06')).toBe(false);
    expect(aligned.byTicker.get('AAPL.BA')?.get('2026-08-07')).toBe(2720000);
  });

  it('never zero-fills a missing date for a series that lacks it', () => {
    const aapl = series('AAPL', 'USD', [['2026-08-05', 20000], ['2026-08-07', 20200]]);
    const ggal = series('GGAL.BA', 'ARS', [['2026-08-05', 60000]]);

    const aligned = alignToCalendar([aapl, ggal], 90, TODAY);

    expect(aligned.dates).toEqual(['2026-08-05', '2026-08-07']);
    const ggalMap = aligned.byTicker.get('GGAL.BA') as Map<string, number>;
    expect(ggalMap.size).toBe(1);
    expect(ggalMap.has('2026-08-07')).toBe(false);
  });

  it('drops points outside the range window', () => {
    const aapl = series('AAPL', 'USD', [
      ['2026-04-01', 100], // before the 3m window
      ['2026-05-12', 200], // first day of the window
      ['2026-08-09', 300],
      ['2026-08-10', 400], // after today
    ]);

    const aligned = alignToCalendar([aapl], 90, TODAY);

    expect(aligned.dates).toEqual(['2026-05-12', '2026-08-09']);
  });

  it('lets a newly listed asset start at its first point without fabricated history', () => {
    const aapl = series('AAPL', 'USD', [['2026-06-01', 20000], ['2026-08-07', 20200]]);
    const meli = series('MELI.BA', 'ARS', [['2026-07-15', 500000]]);

    const aligned = alignToCalendar([aapl, meli], 90, TODAY);

    expect(aligned.dates).toContain('2026-07-15');
    // No MELI.BA entry before its first point.
    const meliMap = aligned.byTicker.get('MELI.BA') as Map<string, number>;
    expect([...meliMap.keys()]).toEqual(['2026-07-15']);
    expect(aligned.byTicker.get('AAPL')?.has('2026-06-01')).toBe(true);
  });
});
