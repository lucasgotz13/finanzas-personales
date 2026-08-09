import { describe, expect, it } from 'vitest';
import { BcraSource } from '../../src/sources/bcra';
import { jsonFetch, malformedJsonFetch } from './helpers';

const NOW = new Date('2026-08-09T12:00:00.000Z');

/** v4.0 shape verified live 2026-08-09: points nested under detalle, ascending order. */
const BCRA_OK = {
  status: 200,
  results: [
    {
      idVariable: 1,
      detalle: [
        { fecha: '2026-08-05', valor: 27500 },
        { fecha: '2026-08-07', valor: 28000 },
      ],
    },
  ],
};

const BADLAR_OK = {
  status: 200,
  results: [
    {
      idVariable: 7,
      detalle: [
        { fecha: '2026-08-05', valor: 37.9 },
        { fecha: '2026-08-07', valor: 38.5 },
      ],
    },
  ],
};

describe('BcraSource (EI-2)', () => {
  it('takes the latest detalle point for variables 1 (reservas) and 7 (badlar)', async () => {
    const fetchFn = jsonFetch(BCRA_OK);
    const fetchBadlar = jsonFetch(BADLAR_OK);
    const fetchMock = ((input: string | URL | Request, init?: RequestInit) =>
      String(input).includes('/7') ? fetchBadlar(input, init) : fetchFn(input, init)) as typeof fetch;
    const source = new BcraSource(fetchMock, () => NOW);

    const samples = await source.fetch();

    expect(samples).toEqual([
      { key: 'reservas', value: 28000, referenceDate: '2026-08-07' },
      { key: 'badlar', value: 38.5, referenceDate: '2026-08-07' },
    ]);
  });

  it('queries a 45-day window around today', async () => {
    const fetchFn = jsonFetch(BCRA_OK);
    const fetchBadlar = jsonFetch(BADLAR_OK);
    const fetchMock = ((input: string | URL | Request, init?: RequestInit) =>
      String(input).includes('/7') ? fetchBadlar(input, init) : fetchFn(input, init)) as typeof fetch;
    const source = new BcraSource(fetchMock, () => NOW);
    await source.fetch();
    const url = String(fetchFn.mock.calls[0][0]);
    expect(url).toContain('desde=2026-06-25');
    expect(url).toContain('hasta=2026-08-09');
  });

  it('rejects an empty results list', async () => {
    const source = new BcraSource(jsonFetch({ status: 200, results: [] }), () => NOW);
    await expect(source.fetch()).rejects.toThrow('no results');
  });

  it('rejects a missing detalle series', async () => {
    const source = new BcraSource(jsonFetch({ status: 200, results: [{ idVariable: 1 }] }), () => NOW);
    await expect(source.fetch()).rejects.toThrow('no series');
  });

  it('rejects zero or negative values', async () => {
    const bad = {
      status: 200,
      results: [{ idVariable: 1, detalle: [{ fecha: '2026-08-07', valor: -5 }] }],
    };
    const source = new BcraSource(jsonFetch(bad), () => NOW);
    await expect(source.fetch()).rejects.toThrow('invalid value');
  });

  it('throws on HTTP 5xx', async () => {
    const source = new BcraSource(jsonFetch({}, 502), () => NOW);
    await expect(source.fetch()).rejects.toThrow('HTTP 502');
  });

  it('throws on malformed JSON', async () => {
    const source = new BcraSource(malformedJsonFetch(), () => NOW);
    await expect(source.fetch()).rejects.toThrow('malformed JSON');
  });
});
