import { describe, expect, it } from 'vitest';
import { YahooSource } from '../../src/sources/yahoo';
import { jsonFetch } from './helpers';

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

  it('throws on HTTP 404 (transport failure propagation)', async () => {
    const source = new YahooSource(async () => CCL, jsonFetch({}, 404));

    await expect(source.fetch('NOPE.BA')).rejects.toThrow('HTTP 404');
  });

  it('throws on a missing or NaN regularMarketPrice', async () => {
    const source = new YahooSource(async () => CCL, jsonFetch(chart({ currency: 'USD' })));

    await expect(source.fetch('AAPL.BA')).rejects.toThrow('invalid regularMarketPrice');
  });

  it('throws on an unsupported quote currency', async () => {
    const fetchFn = jsonFetch(chart({ regularMarketPrice: 100, currency: 'CAD' }));
    const source = new YahooSource(async () => CCL, fetchFn);

    await expect(source.fetch('X.BA')).rejects.toThrow('unsupported yahoo currency CAD');
  });
});
