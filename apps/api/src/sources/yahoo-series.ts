import type { NativeSeries, PricePoint, PriceSeriesSource, SeriesRange } from '@finanzas/domain';

const BASE_URL = 'https://query1.finance.yahoo.com/v8/finance/chart';
const DEFAULT_TIMEOUT_MS = 10_000;
/** 429 safety: fail fast per ticker for 60 s instead of hammering Yahoo (PC-4). */
const COOLDOWN_MS = 60_000;

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
  private cooldownUntil = new Map<string, number>();

  constructor(
    private fetchFn: typeof fetch = fetch,
    private timeoutMs: number = DEFAULT_TIMEOUT_MS,
    private now: () => number = Date.now,
  ) {}

  async fetchSeries(ticker: string, range: SeriesRange): Promise<NativeSeries> {
    const cooldown = this.cooldownUntil.get(ticker);
    if (cooldown !== undefined && this.now() < cooldown) {
      throw new Error(`yahoo cooldown active for ${ticker}`);
    }
    const url = `${BASE_URL}/${encodeURIComponent(ticker)}?interval=1d&range=${RANGE_TO_YAHOO[range]}`;
    const res = await this.fetchFn(url, {
      signal: AbortSignal.timeout(this.timeoutMs),
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        Accept: 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    if (!res.ok) {
      if (res.status === 429) this.cooldownUntil.set(ticker, this.now() + COOLDOWN_MS);
      throw new Error(`yahoo returned HTTP ${res.status}`);
    }
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      throw new Error('yahoo returned malformed JSON');
    }
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
