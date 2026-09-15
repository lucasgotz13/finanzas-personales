import { describe, expect, it, vi } from 'vitest';
import { YahooOilSource } from '../../src/sources/yahoo-oil';
import type { MockFetch } from './helpers';

/** Unix seconds for 2026-08-09T23:58:00Z (= 2026-08-09T20:58:00-03:00). */
const T0_SECONDS = 1_786_319_880;
const AR_REF = '2026-08-09T20:58:00-03:00';

const BZ_META = { regularMarketPrice: 67.45, currency: 'USD', regularMarketTime: T0_SECONDS };
const CL_META = { regularMarketPrice: 63.2, currency: 'USD', regularMarketTime: T0_SECONDS };

function chart(meta: unknown): unknown {
  return { chart: { result: [{ meta }] } };
}

/** BZ=F / CL=F chart bodies by symbol; a symbol without a body gets an HTTP 404. */
function oilFetch(metaBySymbol: Record<string, unknown>): MockFetch {
  return vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    const symbol = decodeURIComponent(url.slice(url.lastIndexOf('/') + 1, url.indexOf('?')));
    const meta = metaBySymbol[symbol];
    if (meta === undefined) return new Response('{}', { status: 404 });
    return new Response(JSON.stringify(chart(meta)), { status: 200 });
  }) as unknown as MockFetch;
}

describe('YahooOilSource (EI-2)', () => {
  it('fetches BZ=F and CL=F and returns raw USD prices with AR reference instants', async () => {
    const fetchFn = oilFetch({ 'BZ=F': BZ_META, 'CL=F': CL_META });
    const source = new YahooOilSource(fetchFn);

    const samples = await source.fetch();

    expect(samples).toEqual([
      { key: 'brent', value: 67.45, referenceDate: AR_REF },
      { key: 'wti', value: 63.2, referenceDate: AR_REF },
    ]);
    // Indicator values are display units (dollars per barrel), never cents.
    expect(samples[0].value).toBeGreaterThan(1);
    expect(fetchFn.mock.calls.map(([url]) => String(url))).toEqual([
      'https://query1.finance.yahoo.com/v8/finance/chart/BZ%3DF?interval=1d&range=1d',
      'https://query1.finance.yahoo.com/v8/finance/chart/CL%3DF?interval=1d&range=1d',
    ]);
  });

  it('rejects the whole fetch when one symbol returns HTTP 404 (all-or-nothing)', async () => {
    const source = new YahooOilSource(oilFetch({ 'BZ=F': BZ_META }));

    await expect(source.fetch()).rejects.toThrow('HTTP 404');
  });

  it('rejects on a missing, NaN or non-positive price', async () => {
    await expect(
      new YahooOilSource(oilFetch({ 'BZ=F': { ...BZ_META, regularMarketPrice: 0 }, 'CL=F': CL_META })).fetch(),
    ).rejects.toThrow('invalid regularMarketPrice');
    await expect(
      new YahooOilSource(oilFetch({ 'BZ=F': { ...BZ_META, regularMarketPrice: 'NaN' }, 'CL=F': CL_META })).fetch(),
    ).rejects.toThrow('invalid regularMarketPrice');
    await expect(
      new YahooOilSource(
        oilFetch({ 'BZ=F': { currency: 'USD', regularMarketTime: T0_SECONDS }, 'CL=F': CL_META }),
      ).fetch(),
    ).rejects.toThrow('invalid regularMarketPrice');
  });

  it('rejects when regularMarketTime is missing or non-numeric', async () => {
    await expect(
      new YahooOilSource(oilFetch({ 'BZ=F': { ...BZ_META, regularMarketTime: undefined }, 'CL=F': CL_META })).fetch(),
    ).rejects.toThrow('missing regularMarketTime');
    await expect(
      new YahooOilSource(oilFetch({ 'BZ=F': { ...BZ_META, regularMarketTime: 'soon' }, 'CL=F': CL_META })).fetch(),
    ).rejects.toThrow('missing regularMarketTime');
  });

  it('rejects a non-USD quote', async () => {
    const source = new YahooOilSource(oilFetch({ 'BZ=F': { ...BZ_META, currency: 'ARS' }, 'CL=F': CL_META }));

    await expect(source.fetch()).rejects.toThrow('expected USD');
  });
});
