const BASE_URL = 'https://query1.finance.yahoo.com/v8/finance/chart';
const DEFAULT_TIMEOUT_MS = 10_000;
/** 429 safety: fail fast per ticker for 60 s instead of hammering Yahoo (PI-2, PC-4). */
const COOLDOWN_MS = 60_000;

// Yahoo's edge throttles headerless requests from datacenter IPs (HTTP 429);
// a browser-like User-Agent + Accept keeps the keyless v8 chart endpoint usable.
const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  Accept: 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
} as const;

/**
 * Shared Yahoo Finance v8 chart HTTP transport: URL construction, timeout,
 * headers, HTTP-error mapping, JSON parsing and per-ticker 429 cooldown.
 * Each adapter owns its instance, so cooldown state stays separate per
 * adapter (sharing it would change failure behavior).
 */
export class YahooTransport {
  private cooldownUntil = new Map<string, number>();

  constructor(
    private fetchFn: typeof fetch = fetch,
    private timeoutMs: number = DEFAULT_TIMEOUT_MS,
    private now: () => number = Date.now,
  ) {}

  /** GETs the v8 chart endpoint for one ticker and returns the parsed JSON. */
  async getJson(ticker: string, query: string): Promise<unknown> {
    const cooldown = this.cooldownUntil.get(ticker);
    if (cooldown !== undefined && this.now() < cooldown) {
      throw new Error(`yahoo cooldown active for ${ticker}`);
    }
    const url = `${BASE_URL}/${encodeURIComponent(ticker)}?${query}`;
    const res = await this.fetchFn(url, {
      signal: AbortSignal.timeout(this.timeoutMs),
      headers: { ...HEADERS },
    });
    if (!res.ok) {
      if (res.status === 429) this.cooldownUntil.set(ticker, this.now() + COOLDOWN_MS);
      throw new Error(`yahoo returned HTTP ${res.status}`);
    }
    try {
      return await res.json();
    } catch {
      throw new Error('yahoo returned malformed JSON');
    }
  }
}
