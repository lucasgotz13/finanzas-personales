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

describe('ArgentinadatosSource IPC (issue #33, EI-2, EI-5)', () => {
  it('takes the last inflacion series entry as the IPC sample', async () => {
    const series = [
      { fecha: '2026-05-31', valor: 2.1 },
      { fecha: '2026-06-30', valor: 1.9 },
    ];
    const source = new ArgentinadatosSource(jsonFetch(series), undefined, 'ipc');

    const samples = await source.fetch();

    expect(samples).toEqual([{ key: 'ipc-mensual', value: 1.9, referenceDate: '2026-06-30' }]);
  });

  it('accepts negative IPC values (signed monthly variation)', async () => {
    const source = new ArgentinadatosSource(jsonFetch([{ fecha: '2026-06-30', valor: -0.5 }]), undefined, 'ipc');

    const samples = await source.fetch();

    expect(samples[0].value).toBe(-0.5);
  });

  it('rejects an empty series', async () => {
    const source = new ArgentinadatosSource(jsonFetch([]), undefined, 'ipc');
    await expect(source.fetch()).rejects.toThrow('unexpected shape');
  });

  it('rejects a non-array payload', async () => {
    const source = new ArgentinadatosSource(jsonFetch({ data: [] }), undefined, 'ipc');
    await expect(source.fetch()).rejects.toThrow('unexpected shape');
  });

  it('rejects non-finite values', async () => {
    const source = new ArgentinadatosSource(jsonFetch([{ fecha: '2026-06-30', valor: 'nope' }]), undefined, 'ipc');
    await expect(source.fetch()).rejects.toThrow('invalid valor');
  });

  it('rejects a missing fecha', async () => {
    const source = new ArgentinadatosSource(jsonFetch([{ valor: 1.9 }]), undefined, 'ipc');
    await expect(source.fetch()).rejects.toThrow('missing fecha');
  });

  it('throws on HTTP 5xx', async () => {
    const source = new ArgentinadatosSource(jsonFetch({}, 503), undefined, 'ipc');
    await expect(source.fetch()).rejects.toThrow('HTTP 503');
  });

  it('throws on malformed JSON', async () => {
    const source = new ArgentinadatosSource(malformedJsonFetch(), undefined, 'ipc');
    await expect(source.fetch()).rejects.toThrow('malformed JSON');
  });
});
