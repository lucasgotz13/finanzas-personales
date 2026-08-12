import { describe, expect, it } from 'vitest';
import { ArgentinadatosCclSeriesSource } from '../../src/sources/argentinadatos-ccl';
import { jsonFetch, malformedJsonFetch } from './helpers';

const CCL_URL = 'https://api.argentinadatos.com/v1/cotizaciones/dolares/contadoconliqui';

describe('ArgentinadatosCclSeriesSource (PC-3)', () => {
  it('returns the venta rate per fecha as a chronological REAL series', async () => {
    const fetchFn = jsonFetch([
      { fecha: '2026-08-05', compra: 1300, venta: 1345 },
      { fecha: '2026-08-06', compra: 1320, venta: 1365.5 },
    ]);
    const source = new ArgentinadatosCclSeriesSource(fetchFn);

    const points = await source.fetchCclSeries();

    expect(String(fetchFn.mock.calls[0][0])).toBe(CCL_URL);
    expect(points).toEqual([
      { date: '2026-08-05', value: 1345 },
      { date: '2026-08-06', value: 1365.5 },
    ]);
  });

  it('skips rows with a missing or invalid venta', async () => {
    const fetchFn = jsonFetch([
      { fecha: '2026-08-05', compra: 1300, venta: null },
      { fecha: '2026-08-06', compra: 1320 },
      { fecha: '2026-08-07', compra: 1330, venta: 1370 },
    ]);
    const source = new ArgentinadatosCclSeriesSource(fetchFn);

    const points = await source.fetchCclSeries();

    expect(points).toEqual([{ date: '2026-08-07', value: 1370 }]);
  });

  it('throws on HTTP errors, malformed JSON and unexpected shapes', async () => {
    await expect(new ArgentinadatosCclSeriesSource(jsonFetch({}, 500)).fetchCclSeries()).rejects.toThrow('HTTP 500');
    await expect(new ArgentinadatosCclSeriesSource(malformedJsonFetch()).fetchCclSeries()).rejects.toThrow('malformed JSON');
    await expect(new ArgentinadatosCclSeriesSource(jsonFetch({})).fetchCclSeries()).rejects.toThrow('unexpected shape');
    await expect(new ArgentinadatosCclSeriesSource(jsonFetch([])).fetchCclSeries()).rejects.toThrow('unexpected shape');
    await expect(new ArgentinadatosCclSeriesSource(jsonFetch([{ fecha: 'x' }])).fetchCclSeries()).rejects.toThrow('no valid CCL rows');
  });
});
