import { describe, expect, it } from 'vitest';
import { ArgentinadatosSource } from '../../src/sources/argentinadatos';
import { jsonFetch, malformedJsonFetch } from './helpers';

const RIESGO_PAIS_OK = [
  { fecha: '2026-08-07', valor: 1100 },
  { fecha: '2026-08-08', valor: 1080 },
  { fecha: '2026-08-09', valor: 1050 },
];

describe('ArgentinadatosSource (EI-1, EI-2)', () => {
  it('takes the latest {valor, fecha} as the riesgo país sample', async () => {
    const source = new ArgentinadatosSource(jsonFetch(RIESGO_PAIS_OK));

    const samples = await source.fetch();

    expect(samples).toEqual([{ key: 'riesgo-pais', value: 1050, referenceDate: '2026-08-09' }]);
  });

  it('rejects zero or negative values', async () => {
    const source = new ArgentinadatosSource(jsonFetch([{ fecha: '2026-08-09', valor: 0 }]));
    await expect(source.fetch()).rejects.toThrow('invalid valor');
  });

  it('rejects an empty list', async () => {
    const source = new ArgentinadatosSource(jsonFetch([]));
    await expect(source.fetch()).rejects.toThrow('unexpected shape');
  });

  it('throws on HTTP 5xx', async () => {
    const source = new ArgentinadatosSource(jsonFetch({}, 503));
    await expect(source.fetch()).rejects.toThrow('HTTP 503');
  });

  it('throws on malformed JSON', async () => {
    const source = new ArgentinadatosSource(malformedJsonFetch());
    await expect(source.fetch()).rejects.toThrow('malformed JSON');
  });
});
