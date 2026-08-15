import { describe, expect, it } from 'vitest';
import { RANGE_WINDOW_DAYS, SERIES_RANGES, isSeriesRange } from '../../src/priceCharts/catalog';

describe('price charts catalog (PC-1)', () => {
  it('exposes the 4 series ranges in chip order', () => {
    expect(SERIES_RANGES).toEqual(['1m', '3m', '6m', '1y']);
  });

  it('maps every range to its calendar window', () => {
    expect(RANGE_WINDOW_DAYS).toEqual({ '1m': 30, '3m': 90, '6m': 180, '1y': 365 });
  });

  it('guards valid ranges and rejects everything else', () => {
    for (const range of SERIES_RANGES) expect(isSeriesRange(range)).toBe(true);
    for (const raw of ['1w', '1M', '2m', '3M', 42, null, undefined, '']) expect(isSeriesRange(raw)).toBe(false);
  });
});
