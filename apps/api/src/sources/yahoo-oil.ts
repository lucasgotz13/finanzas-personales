import type { IndicatorSample, IndicatorSource } from '@finanzas/domain';
import { arIsoString } from '@finanzas/domain';
import { YahooTransport } from './yahoo-transport';

interface ChartBody {
  chart?: {
    result?: Array<{
      meta?: { regularMarketPrice?: unknown; currency?: unknown; regularMarketTime?: unknown };
    }>;
  };
}

/** Yahoo oil symbol per indicator key (EI-2): Brent and WTI front-month futures. */
const SYMBOL_BY_KEY = [
  { key: 'brent', symbol: 'BZ=F' },
  { key: 'wti', symbol: 'CL=F' },
] as const;

/**
 * Yahoo Finance v8 chart adapter for oil (EI-2): one keyless request per
 * symbol, both fetched in parallel. Values are raw USD per barrel (display
 * units, NOT cents, unlike the investments PriceSource). Any missing or
 * invalid field rejects the whole fetch so the domain keeps the prior
 * snapshot (all-or-nothing, matching DolarApiSource/BcraSource).
 */
export class YahooOilSource implements IndicatorSource {
  readonly class = 'oil' as const;

  private transport: YahooTransport;

  constructor(fetchFn: typeof fetch = fetch, timeoutMs = 10_000, now: () => number = Date.now) {
    // Own transport instance: 429 cooldown state stays separate from the other
    // Yahoo adapters (sharing it would change failure behavior).
    this.transport = new YahooTransport(fetchFn, timeoutMs, now);
  }

  async fetch(): Promise<IndicatorSample[]> {
    return Promise.all(
      SYMBOL_BY_KEY.map(async ({ key, symbol }): Promise<IndicatorSample> => {
        const body = await this.transport.getJson(symbol, 'interval=1d&range=1d');
        const meta = (body as ChartBody).chart?.result?.[0]?.meta;
        const raw = meta?.regularMarketPrice;
        const price = raw === null || raw === undefined ? Number.NaN : Number(raw);
        if (!Number.isFinite(price) || price <= 0) {
          throw new Error(`yahoo oil returned an invalid regularMarketPrice for ${symbol}`);
        }
        if (meta?.currency !== 'USD') {
          throw new Error(`yahoo oil expected USD for ${symbol}, got ${String(meta?.currency)}`);
        }
        const seconds = Number(meta?.regularMarketTime);
        if (!Number.isFinite(seconds)) {
          throw new Error(`yahoo oil missing regularMarketTime for ${symbol}`);
        }
        // Yahoo reports unix seconds; store the AR-time instant like the rest of EI-5.
        return { key, value: price, referenceDate: arIsoString(new Date(seconds * 1000)) };
      }),
    );
  }
}
