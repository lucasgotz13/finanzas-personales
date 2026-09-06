import type { NativeSeries, PricePoint, PriceSeriesSource, SeriesRange } from '@finanzas/domain';
import { YahooTransport } from './yahoo-transport';

/** Our range windows map to Yahoo v8 chart range params ('1m' → '1mo'). */
const RANGE_TO_YAHOO: Record<SeriesRange, string> = { '1m': '1mo', '3m': '3mo', '6m': '6mo', '1y': '1y' };

interface ChartBody {
  chart?: {
    result?: Array<{
      meta?: { currency?: unknown };
      timestamp?: unknown;
      indicators?: { quote?: Array<{ close?: unknown }> };
    }>;
    error?: unknown;
  };
}

/**
 * Yahoo Finance v8 chart series adapter (PC-1, PC-2): one symbol per request,
 * keyless. Points are `indicators.quote[0].close` in the ticker's NATIVE
 * currency (D1) — USD for US tickers, ARS for .BA — converted to minor units
 * (D8). null/NaN closes are skipped; timestamps slice to UTC dates. A 429
 * puts the ticker on a 60 s in-memory cooldown; 404/malformed responses
 * throw so the domain keeps the last cached row.
 */
export class YahooSeriesSource implements PriceSeriesSource {
  private transport: YahooTransport;

  constructor(
    fetchFn: typeof fetch = fetch,
    timeoutMs = 10_000,
    now: () => number = Date.now,
  ) {
    // Own transport instance: series cooldown state stays separate from the
    // quote adapter (sharing it would change failure behavior).
    this.transport = new YahooTransport(fetchFn, timeoutMs, now);
  }

  async fetchSeries(ticker: string, range: SeriesRange): Promise<NativeSeries> {
    const body = await this.transport.getJson(ticker, `interval=1d&range=${RANGE_TO_YAHOO[range]}`);
    const chart = (body as ChartBody).chart;
    if (chart?.error !== undefined && chart?.error !== null) {
      throw new Error(`yahoo chart error: ${String(chart.error)}`);
    }
    const result = chart?.result?.[0];
    const timestamps = result?.timestamp;
    const closes = result?.indicators?.quote?.[0]?.close;
    const currency = result?.meta?.currency;
    if (!Array.isArray(timestamps) || !Array.isArray(closes) || typeof currency !== 'string') {
      throw new Error('yahoo returned an invalid chart series');
    }
    if (currency !== 'ARS' && currency !== 'USD') throw new Error(`unsupported yahoo currency ${currency}`);

    const points: PricePoint[] = [];
    for (let i = 0; i < timestamps.length && i < closes.length; i++) {
      const ts = Number(timestamps[i]);
      const close = closes[i] === null || closes[i] === undefined ? Number.NaN : Number(closes[i]);
      if (!Number.isFinite(ts) || !Number.isFinite(close) || close <= 0) continue;
      points.push({
        date: new Date(ts * 1000).toISOString().slice(0, 10),
        valueMinor: Math.round(close * 100),
      });
    }
    if (points.length === 0) throw new Error('yahoo returned an empty chart series');
    return { ticker, nativeCurrency: currency, points };
  }
}
