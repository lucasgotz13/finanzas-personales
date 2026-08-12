import type { PriceQuote, PriceSource } from '@finanzas/domain';

const BASE_URL = 'https://query1.finance.yahoo.com/v8/finance/chart';
const DEFAULT_TIMEOUT_MS = 10_000;
/** 429 safety: fail fast per ticker for 60 s instead of hammering Yahoo (PI-2). */
const COOLDOWN_MS = 60_000;

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
  private cooldownUntil = new Map<string, number>();

  constructor(
    private getCcl: () => Promise<{ value: number; fetchedAt: string } | null>,
    private fetchFn: typeof fetch = fetch,
    private timeoutMs: number = DEFAULT_TIMEOUT_MS,
    private now: () => number = Date.now,
  ) {}

  async fetch(ticker: string): Promise<PriceQuote> {
    const cooldown = this.cooldownUntil.get(ticker);
    if (cooldown !== undefined && this.now() < cooldown) {
      throw new Error(`yahoo cooldown active for ${ticker}`);
    }
    const url = `${BASE_URL}/${encodeURIComponent(ticker)}?interval=1d&range=1d`;
    // Yahoo's edge throttles headerless requests from datacenter IPs (HTTP 429);
    // a browser-like User-Agent + Accept keeps the keyless v8 chart endpoint usable.
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
