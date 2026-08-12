import { describe, expect, it, vi } from 'vitest';
import { YahooSource } from '../../src/sources/yahoo';
import { jsonFetch, malformedJsonFetch } from './helpers';

function chart(meta: unknown): unknown {
  return { chart: { result: [{ meta }] } };
}

const CCL = { value: 1345, fetchedAt: '2026-08-09T23:00:00.000Z' };

describe('YahooSource (PI-2)', () => {
  it('returns a USD quote in cents and hits the v8 chart endpoint for that symbol', async () => {
    const fetchFn = jsonFetch(chart({ regularMarketPrice: 208.35, currency: 'USD' }));
    const source = new YahooSource(async () => CCL, fetchFn);

    const quote = await source.fetch('AAPL.BA');

    expect(quote).toEqual({ priceMinor: 20835, currency: 'USD' });
    const [url] = fetchFn.mock.calls[0];
    expect(String(url)).toBe('https://query1.finance.yahoo.com/v8/finance/chart/AAPL.BA?interval=1d&range=1d');
  });

  it('normalizes an ARS quote to USD cents via the cached CCL', async () => {
    const fetchFn = jsonFetch(chart({ regularMarketPrice: 26900, currency: 'ARS' }));
    const source = new YahooSource(async () => CCL, fetchFn);

    const quote = await source.fetch('GGAL.BA');

    expect(quote).toEqual({ priceMinor: Math.round((26900 / 1345) * 100), currency: 'USD' });
  });

  it('fails an ARS quote when no CCL is available', async () => {
    const fetchFn = jsonFetch(chart({ regularMarketPrice: 26900, currency: 'ARS' }));
    const source = new YahooSource(async () => null, fetchFn);

    await expect(source.fetch('GGAL.BA')).rejects.toThrow('no CCL available');
  });

  it('throws on HTTP 404', async () => {
    const source = new YahooSource(async () => CCL, jsonFetch({}, 404));

    await expect(source.fetch('NOPE.BA')).rejects.toThrow('HTTP 404');
  });

  it('throws on a missing or NaN regularMarketPrice', async () => {
    const source = new YahooSource(async () => CCL, jsonFetch(chart({ currency: 'USD' })));

    await expect(source.fetch('AAPL.BA')).rejects.toThrow('invalid regularMarketPrice');
  });

  it('throws on malformed JSON', async () => {
    const source = new YahooSource(async () => CCL, malformedJsonFetch());

    await expect(source.fetch('AAPL.BA')).rejects.toThrow('malformed JSON');
  });

  it('throws on an unsupported quote currency', async () => {
    const fetchFn = jsonFetch(chart({ regularMarketPrice: 100, currency: 'CAD' }));
    const source = new YahooSource(async () => CCL, fetchFn);

    await expect(source.fetch('X.BA')).rejects.toThrow('unsupported yahoo currency CAD');
  });

  it('fails fast on 429: cooldown blocks retries for 60 s, then expires', async () => {
    let now = 0;
    let mode = '429';
    const fetchFn = vi.fn(async () => {
      if (mode === '429') return new Response('{}', { status: 429 });
      return new Response(JSON.stringify(chart({ regularMarketPrice: 200, currency: 'USD' })), { status: 200 });
    });
    const source = new YahooSource(async () => CCL, fetchFn as unknown as typeof fetch, 10_000, () => now);

    await expect(source.fetch('AAPL.BA')).rejects.toThrow('HTTP 429');
    now = 30_000;
    await expect(source.fetch('AAPL.BA')).rejects.toThrow('cooldown active');
    expect(fetchFn).toHaveBeenCalledTimes(1);

    now = 61_000;
    mode = 'ok';
    const quote = await source.fetch('AAPL.BA');
    expect(quote.priceMinor).toBe(20000);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});
