import { describe, expect, it } from 'vitest';
import { DatosGobArSource } from '../../src/sources/datos-gob-ar';
import { jsonFetch, malformedJsonFetch } from './helpers';

const SERIES_OK = {
  data: [
    ['2026-04-01', 0.037],
    ['2026-05-01', 0.028],
    ['2026-06-01', -0.001],
  ],
};

const SEARCH_OK = {
  data: [
    {
      field: {
        id: '145.3_INGNACUAL_DICI_M_39',
        description: 'IPC. Tasa de variación mensual. Nivel General. Nacional. Base dic 2016.',
      },
    },
  ],
};

describe('DatosGobArSource (EI-2, EI-5)', () => {
  it('returns the latest point as signed percent with the YYYY-MM reference month', async () => {
    const fetchFn = jsonFetch(SERIES_OK);
    const source = new DatosGobArSource(fetchFn);

    const samples = await source.fetch();

    expect(samples).toEqual([{ key: 'ipc-mensual', value: -0.1, referenceDate: '2026-06' }]);
  });

  it('resolves a drifted series id via /search, caches it and retries once', async () => {
    const seriesBad = jsonFetch({ data: [] });
    const seriesGood = jsonFetch(SERIES_OK);
    const search = jsonFetch(SEARCH_OK);
    let seriesCalls = 0;
    const fetchMock = ((input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/search/')) return search(input, init);
      seriesCalls++;
      return seriesCalls === 1 ? seriesBad(input, init) : seriesGood(input, init);
    }) as typeof fetch;
    const source = new DatosGobArSource(fetchMock);

    const samples = await source.fetch();
    expect(samples[0].referenceDate).toBe('2026-06');
    expect(String(seriesGood.mock.calls[0][0])).toContain('145.3_INGNACUAL_DICI_M_39');
    // the resolved id is cached in memory: a second fetch skips /search
    await source.fetch();
    expect(search).toHaveBeenCalledTimes(1);
  });

  it('fails when /search returns no usable series', async () => {
    const fetchMock = ((input: string | URL | Request, init?: RequestInit) =>
      String(input).includes('/search/') ? jsonFetch({ data: [] })(input, init) : jsonFetch({ data: [] })(input, init)) as typeof fetch;
    const source = new DatosGobArSource(fetchMock);
    await expect(source.fetch()).rejects.toThrow('no data for series');
  });

  it('throws on HTTP 5xx', async () => {
    const source = new DatosGobArSource(jsonFetch({}, 500));
    await expect(source.fetch()).rejects.toThrow('HTTP 500');
  });

  it('throws on malformed JSON', async () => {
    const source = new DatosGobArSource(malformedJsonFetch());
    await expect(source.fetch()).rejects.toThrow('malformed JSON');
  });
});
