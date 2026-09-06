import { describe, expect, it, vi } from 'vitest';
import { YahooTransport } from '../../src/sources/yahoo-transport';
import { abortingFetch, jsonFetch, malformedJsonFetch } from './helpers';

describe('YahooTransport (Item 6)', () => {
  it('GETs the v8 chart endpoint for the ticker with the caller query', async () => {
    const fetchFn = jsonFetch({ chart: { result: [] } });
    const transport = new YahooTransport(fetchFn);

    await transport.getJson('AAPL.BA', 'interval=1d&range=1d');

    const [url] = fetchFn.mock.calls[0];
    expect(String(url)).toBe('https://query1.finance.yahoo.com/v8/finance/chart/AAPL.BA?interval=1d&range=1d');
  });

  it('sends browser headers and an abort signal to fetch', async () => {
    const fetchFn = jsonFetch({ ok: true });
    const transport = new YahooTransport(fetchFn, 1234);

    await transport.getJson('AAPL', 'interval=1d&range=3mo');

    const [, init] = fetchFn.mock.calls[0];
    expect(init?.headers).toMatchObject({
      'User-Agent': expect.stringContaining('Mozilla/5.0'),
      Accept: 'application/json',
      'Accept-Language': 'en-US,en;q=0.9',
    });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it('aborts the request when the timeout elapses', async () => {
    const transport = new YahooTransport(abortingFetch(), 20);

    await expect(transport.getJson('AAPL', 'interval=1d&range=1d')).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('returns the parsed JSON body on success', async () => {
    const body = { chart: { result: [{ meta: { regularMarketPrice: 10 } }] } };
    const transport = new YahooTransport(jsonFetch(body));

    await expect(transport.getJson('AAPL', 'interval=1d&range=1d')).resolves.toEqual(body);
  });

  it('throws the HTTP status without cooling down on non-429 failures', async () => {
    const fetchFn = jsonFetch({}, 500);
    const transport = new YahooTransport(fetchFn);

    await expect(transport.getJson('AAPL', 'interval=1d&range=1d')).rejects.toThrow('yahoo returned HTTP 500');
    // No cooldown: the retry hits the network again.
    await expect(transport.getJson('AAPL', 'interval=1d&range=1d')).rejects.toThrow('yahoo returned HTTP 500');
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('throws on malformed JSON', async () => {
    const transport = new YahooTransport(malformedJsonFetch());

    await expect(transport.getJson('AAPL', 'interval=1d&range=1d')).rejects.toThrow('yahoo returned malformed JSON');
  });

  it('fails fast per ticker for 60 s after a 429, then retries', async () => {
    let now = 0;
    let mode = '429';
    const fetchFn = vi.fn(async () => {
      if (mode === '429') return new Response('{}', { status: 429 });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    const transport = new YahooTransport(fetchFn as unknown as typeof fetch, 10_000, () => now);

    await expect(transport.getJson('AAPL', 'interval=1d&range=1d')).rejects.toThrow('yahoo returned HTTP 429');
    now = 30_000;
    await expect(transport.getJson('AAPL', 'interval=1d&range=1d')).rejects.toThrow('yahoo cooldown active for AAPL');
    expect(fetchFn).toHaveBeenCalledTimes(1);

    // Other tickers are unaffected by the per-ticker cooldown.
    mode = 'ok';
    await expect(transport.getJson('GGAL.BA', 'interval=1d&range=1d')).resolves.toEqual({ ok: true });
    expect(fetchFn).toHaveBeenCalledTimes(2);

    // After 60 s the cooled-down ticker retries over the network.
    now = 61_000;
    await expect(transport.getJson('AAPL', 'interval=1d&range=1d')).resolves.toEqual({ ok: true });
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it('keeps cooldown state per instance so adapters stay independent', async () => {
    let now = 0;
    const fetchFn = vi.fn(async () => new Response('{}', { status: 429 }));
    const first = new YahooTransport(fetchFn as unknown as typeof fetch, 10_000, () => now);
    const second = new YahooTransport(fetchFn as unknown as typeof fetch, 10_000, () => now);

    await expect(first.getJson('AAPL', 'interval=1d&range=1d')).rejects.toThrow('yahoo returned HTTP 429');
    now = 30_000;
    await expect(first.getJson('AAPL', 'interval=1d&range=1d')).rejects.toThrow('cooldown active');
    // The second instance has its own cooldown map: it hits the network.
    await expect(second.getJson('AAPL', 'interval=1d&range=1d')).rejects.toThrow('yahoo returned HTTP 429');
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});
