import { describe, expect, it } from 'vitest';
import { DolarApiSource } from '../../src/sources/dolar-api';
import { abortingFetch, jsonFetch, malformedJsonFetch } from './helpers';

const DOLARAPI_OK = [
  { casa: 'oficial', venta: 1200, fechaActualizacion: '2026-08-07T18:55:00.000Z' },
  { casa: 'blue', venta: 1350.5, fechaActualizacion: '2026-08-09T14:56:00.000Z' },
  { casa: 'tarjeta', venta: 1560, fechaActualizacion: '2026-08-07T18:55:00.000Z' },
  { casa: 'bolsa', venta: 1330, fechaActualizacion: '2026-08-09T14:56:00.000Z' },
  { casa: 'contadoconliqui', venta: 1345, fechaActualizacion: '2026-08-09T14:56:00.000Z' },
];

describe('DolarApiSource (EI-1, EI-2)', () => {
  it('maps the 5 casas to FX keys using the venta quote and its own date', async () => {
    const fetchFn = jsonFetch(DOLARAPI_OK);
    const source = new DolarApiSource(fetchFn);

    const samples = await source.fetch();

    expect(samples).toEqual([
      { key: 'usd-oficial', value: 1200, referenceDate: '2026-08-07T18:55:00.000Z' },
      { key: 'usd-blue', value: 1350.5, referenceDate: '2026-08-09T14:56:00.000Z' },
      { key: 'usd-tarjeta', value: 1560, referenceDate: '2026-08-07T18:55:00.000Z' },
      { key: 'usd-mep', value: 1330, referenceDate: '2026-08-09T14:56:00.000Z' },
      { key: 'usd-ccl', value: 1345, referenceDate: '2026-08-09T14:56:00.000Z' },
    ]);
  });

  it('rejects a missing casa as a failure (incomplete payload)', async () => {
    const fetchFn = jsonFetch(DOLARAPI_OK.slice(0, 2));
    const source = new DolarApiSource(fetchFn);
    await expect(source.fetch()).rejects.toThrow('missing casas');
  });

  it('rejects a zero or negative venta', async () => {
    const fetchFn = jsonFetch([{ ...DOLARAPI_OK[0], venta: 0 }]);
    const source = new DolarApiSource(fetchFn);
    await expect(source.fetch()).rejects.toThrow('invalid venta');
  });

  it('throws on HTTP 5xx', async () => {
    const source = new DolarApiSource(jsonFetch({}, 500));
    await expect(source.fetch()).rejects.toThrow('HTTP 500');
  });

  it('throws on malformed JSON', async () => {
    const source = new DolarApiSource(malformedJsonFetch());
    await expect(source.fetch()).rejects.toThrow('malformed JSON');
  });

  it('fails when the request times out (abort signal wired)', async () => {
    const source = new DolarApiSource(abortingFetch(), 20);
    await expect(source.fetch()).rejects.toThrow();
  });
});
