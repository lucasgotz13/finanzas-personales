import { describe, expect, it, vi } from 'vitest';
import { YahooSeriesSource } from '../../src/sources/yahoo-series';
import { jsonFetch, malformedJsonFetch } from './helpers';

const DAY = 86_400;

function ts(date: string): number {
  return Math.floor(Date.parse(`${date}T12:00:00Z`) / 1000);
}

function chart(currency: unknown, timestamps: unknown, closes: unknown): unknown {
  return { chart: { result: [{ meta: { currency }, timestamp: timestamps, indicators: { quote: [{ close: closes }] } }] } };
}

describe('YahooSeriesSource (PC-1, PC-2)', () => {
  it('returns native minor-unit points from quote[0].close and maps the range param', async () => {
    const t0 = ts('2026-08-05');
    const fetchFn = jsonFetch(chart('USD', [t0, t0 + DAY], [200.5, 201.25]));
    const source = new YahooSeriesSource(fetchFn);

    const series = await source.fetchSeries('AAPL', '3m');

    expect(series).toEqual({
      ticker: 'AAPL',
      nativeCurrency: 'USD',
      points: [
        { date: '2026-08-05', valueMinor: 20050 },
        { date: '2026-08-06', valueMinor: 20125 },
      ],
    });
    expect(String(fetchFn.mock.calls[0][0])).toBe(
      'https://query1.finance.yahoo.com/v8/finance/chart/AAPL?interval=1d&range=3mo',
    );
  });

  it('maps the 1m range to the Yahoo 1mo param', async () => {
    const fetchFn = jsonFetch(chart('USD', [ts('2026-08-05')], [200]));
    const source = new YahooSeriesSource(fetchFn);

    await source.fetchSeries('AAPL', '1m');

    expect(String(fetchFn.mock.calls[0][0])).toBe(
      'https://query1.finance.yahoo.com/v8/finance/chart/AAPL?interval=1d&range=1mo',
    );
  });

  it('passes ARS-native series through without CCL conversion (D1)', async () => {
    const t0 = ts('2026-08-05');
    const fetchFn = jsonFetch(chart('ARS', [t0], [26900]));
    const source = new YahooSeriesSource(fetchFn);

    const series = await source.fetchSeries('GGAL.BA', '6m');

    expect(series.nativeCurrency).toBe('ARS');
    expect(series.points).toEqual([{ date: '2026-08-05', valueMinor: 2_690_000 }]);
    expect(String(fetchFn.mock.calls[0][0])).toContain('range=6mo');
  });

  it('skips null and NaN closes, keeping their dates absent (PC-2)', async () => {
    const t0 = ts('2026-08-03');
    const fetchFn = jsonFetch(chart('USD', [t0, t0 + DAY, t0 + 2 * DAY, t0 + 3 * DAY], [100, null, 'NaN', 102]));
    const source = new YahooSeriesSource(fetchFn);

    const series = await source.fetchSeries('AAPL', '3m');

    expect(series.points).toEqual([
      { date: '2026-08-03', valueMinor: 10000 },
      { date: '2026-08-06', valueMinor: 10200 },
    ]);
  });

  it('throws on HTTP 404', async () => {
    const source = new YahooSeriesSource(jsonFetch({ chart: { error: 'Not found' } }, 404));

    await expect(source.fetchSeries('NOPE.BA', '3m')).rejects.toThrow('HTTP 404');
  });

  it('throws on a chart error body (invalid ticker)', async () => {
    const source = new YahooSeriesSource(jsonFetch({ chart: { result: null, error: { code: 'Not Found' } } }));

    await expect(source.fetchSeries('NOPE.BA', '3m')).rejects.toThrow('yahoo chart error');
  });

  it('throws on a missing quote array or unsupported currency', async () => {
    await expect(new YahooSeriesSource(jsonFetch(chart('USD', undefined, undefined))).fetchSeries('AAPL', '3m')).rejects.toThrow(
      'invalid chart series',
    );
    await expect(new YahooSeriesSource(jsonFetch(chart('USD', [], []))).fetchSeries('AAPL', '3m')).rejects.toThrow(
      'empty chart series',
    );
    await expect(new YahooSeriesSource(jsonFetch(chart('CAD', [ts('2026-08-05')], [1]))).fetchSeries('AAPL', '3m')).rejects.toThrow(
      'unsupported yahoo currency CAD',
    );
  });

  it('throws on malformed JSON', async () => {
    await expect(new YahooSeriesSource(malformedJsonFetch()).fetchSeries('AAPL', '3m')).rejects.toThrow('malformed JSON');
  });

  it('fails fast on 429: cooldown blocks retries for 60 s, then expires', async () => {
    let now = 0;
    let mode = '429';
    const fetchFn = vi.fn(async () => {
      if (mode === '429') return new Response('{}', { status: 429 });
      return new Response(JSON.stringify(chart('USD', [ts('2026-08-05')], [200])), { status: 200 });
    });
    const source = new YahooSeriesSource(fetchFn as unknown as typeof fetch, 10_000, () => now);

    await expect(source.fetchSeries('AAPL', '3m')).rejects.toThrow('HTTP 429');
    now = 30_000;
    await expect(source.fetchSeries('AAPL', '3m')).rejects.toThrow('cooldown active');
    expect(fetchFn).toHaveBeenCalledTimes(1);

    now = 61_000;
    mode = 'ok';
    const series = await source.fetchSeries('AAPL', '3m');
    expect(series.points).toEqual([{ date: '2026-08-05', valueMinor: 20000 }]);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});
