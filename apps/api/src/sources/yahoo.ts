import type { PriceQuote, PriceSource } from '@finanzas/domain';
import { YahooTransport } from './yahoo-transport';

interface ChartBody {
  chart?: { result?: Array<{ meta?: { regularMarketPrice?: unknown; currency?: unknown } }> };
}

/**
 * Yahoo Finance v8 chart adapter (PI-2): one symbol per request, keyless.
 * Quotes normalize to USD cents: BYMA locals arrive in ARS and are converted
 * via the cached CCL (null CCL → throw → refresh 'failed'). A 429 puts the
 * ticker on a 60 s in-memory cooldown; 404/NaN/malformed responses throw so
 * the domain keeps the prior snapshot.
 */
export class YahooSource implements PriceSource {
  private transport: YahooTransport;

  constructor(
    private getCcl: () => Promise<{ value: number; fetchedAt: string } | null>,
    fetchFn: typeof fetch = fetch,
    timeoutMs = 10_000,
    now: () => number = Date.now,
  ) {
    // Own transport instance: quote cooldown state stays separate from the
    // history adapter (sharing it would change failure behavior).
    this.transport = new YahooTransport(fetchFn, timeoutMs, now);
  }

  async fetch(ticker: string): Promise<PriceQuote> {
    const body = await this.transport.getJson(ticker, 'interval=1d&range=1d');
    const result = (body as ChartBody).chart?.result;
    const raw = result?.[0]?.meta?.regularMarketPrice;
    const price = raw === null || raw === undefined ? Number.NaN : Number(raw);
    if (!Array.isArray(result) || result.length === 0 || !Number.isFinite(price) || price <= 0) {
      throw new Error('yahoo returned an invalid regularMarketPrice');
    }
    const currency = result[0].meta?.currency;
    if (typeof currency !== 'string') throw new Error('yahoo missing currency');
    if (currency === 'ARS') {
      const ccl = await this.getCcl();
      if (ccl === null) throw new Error(`no CCL available to normalize ${ticker}`);
      return { priceMinor: Math.round((price / ccl.value) * 100), currency: 'USD' };
    }
    if (currency !== 'USD') throw new Error(`unsupported yahoo currency ${currency}`);
    return { priceMinor: Math.round(price * 100), currency: 'USD' };
  }
}
