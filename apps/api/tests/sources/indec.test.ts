import { describe, expect, it, vi } from 'vitest';
import {
  IndecCanastasSource,
  IndecEmaeSource,
  IndecIpcSource,
  IndecSalariosSource,
} from '../../src/sources/indec';
import type { MockFetch } from './helpers';

const TOKEN = 'test-token';

/** fetch stub that answers by URL pattern and records every call. */
function routedFetch(routes: Array<[RegExp, () => Response]>): MockFetch {
  return vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    for (const [pattern, respond] of routes) {
      if (pattern.test(url)) return respond();
    }
    throw new Error(`unexpected fetch: ${url}`);
  }) as unknown as MockFetch;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe('IndecIpcSource (EI-2, EI-5)', () => {
  const IPC_ROWS = [
    { periodo: '202609', tipo_de_indicador: 'v_m', valor: 1.9 },
    { periodo: '202609', tipo_de_indicador: 'v_ia', valor: 33.4 },
    { periodo: '202608', tipo_de_indicador: 'v_ia', valor: 33.5 },
    { periodo: '202608', tipo_de_indicador: 'v_m', valor: 1.7 },
  ];

  it('returns the national general monthly and interannual variations with the previous month as prevValue', async () => {
    const fetchFn = routedFetch([[/ipc_nacional/, () => json(IPC_ROWS)]]);
    const source = new IndecIpcSource({ token: TOKEN, fetchFn });

    const samples = await source.fetch();

    expect(samples).toEqual([
      { key: 'ipc-mensual', value: 1.9, referenceDate: '2026-09', prevValue: 1.7 },
      { key: 'ipc-interanual', value: 33.4, referenceDate: '2026-09', prevValue: 33.5 },
    ]);
    const [url, init] = fetchFn.mock.calls[0];
    expect(String(url)).toContain('clasificador=eq.IPC');
    expect(String(url)).toContain('nivel=eq.Nivel+General');
    expect(String(url)).toContain('region=eq.Nacional');
    expect(String(url)).toContain('tipo_de_indicador=in.%28v_m%2Cv_ia%29');
    expect(String(url)).toContain('order=periodo.desc');
    expect((init?.headers as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN}`);
  });

  it('returns the monthly variation alone when the interannual row is missing', async () => {
    const fetchFn = routedFetch([
      [/ipc_nacional/, () => json([{ periodo: '202609', tipo_de_indicador: 'v_m', valor: 1.9 }])],
    ]);
    const source = new IndecIpcSource({ token: TOKEN, fetchFn });

    const samples = await source.fetch();

    expect(samples).toEqual([
      { key: 'ipc-mensual', value: 1.9, referenceDate: '2026-09', prevValue: null },
    ]);
  });

  it('falls back to argentinadatos for the monthly variation when INDEC fails', async () => {
    const fetchFn = routedFetch([[/ipc_nacional/, () => json({ error: 'down' }, 503)]]);
    const fallback = {
      fetch: vi.fn(async () => [
        { key: 'ipc-mensual' as const, value: 1.9, referenceDate: '2026-09-30', prevValue: 1.7 },
      ]),
    };
    const source = new IndecIpcSource({ token: TOKEN, fetchFn, fallback });

    const samples = await source.fetch();

    expect(samples).toEqual([
      { key: 'ipc-mensual', value: 1.9, referenceDate: '2026-09-30', prevValue: 1.7 },
    ]);
    expect(fallback.fetch).toHaveBeenCalledTimes(1);
  });

  it('throws a combined error when both INDEC and the fallback fail', async () => {
    const fetchFn = routedFetch([[/ipc_nacional/, () => json({}, 401)]]);
    const fallback = { fetch: async () => Promise.reject(new Error('argentinadatos down')) };
    const source = new IndecIpcSource({ token: TOKEN, fetchFn, fallback });

    await expect(source.fetch()).rejects.toThrow('INDEC failed (INDEC returned HTTP 401) and fallback failed (argentinadatos down)');
  });

  it('never includes the token in an error message', async () => {
    const fetchFn = routedFetch([[/ipc_nacional/, () => json({}, 500)]]);
    const fallback = { fetch: async () => Promise.reject(new Error('argentinadatos down')) };
    const source = new IndecIpcSource({ token: TOKEN, fetchFn, fallback });

    await expect(source.fetch()).rejects.not.toThrow(TOKEN);
  });
});

describe('IndecCanastasSource (EI-2, EI-5)', () => {
  const ROWS = [
    { periodo: '202609', valor: 528318.67 },
    { periodo: '202608', valor: 519578.43 },
  ];

  it('returns the GBA total basket per adult with the previous month as prevValue', async () => {
    const fetchFn = routedFetch([[/valorizacion_canastas_cba_cbt/, () => json(ROWS)]]);
    const source = new IndecCanastasSource({ token: TOKEN, fetchFn });

    const samples = await source.fetch();

    expect(samples).toEqual([
      { key: 'canasta-basica-total', value: 528318.67, referenceDate: '2026-09', prevValue: 519578.43 },
    ]);
    const [url] = fetchFn.mock.calls[0];
    expect(String(url)).toContain('region=eq.GBA');
    expect(String(url)).toContain('tipo_de_indicador=eq.CBT');
    expect(String(url)).toContain('unidad_de_medida=eq.Pesos+argentinos');
  });

  it('rejects a zero basket value', async () => {
    const fetchFn = routedFetch([[/valorizacion_canastas_cba_cbt/, () => json([{ periodo: '202609', valor: 0 }])]]);
    const source = new IndecCanastasSource({ token: TOKEN, fetchFn });

    await expect(source.fetch()).rejects.toThrow('invalid valor');
  });
});

describe('IndecSalariosSource (EI-2, EI-5)', () => {
  it('returns the general wage level interannual variation with the previous month as prevValue', async () => {
    const rows = [
      { periodo: '202608', valor: 35.61 },
      { periodo: '202607', valor: 36.18 },
    ];
    const fetchFn = routedFetch([[/indice_salarios/, () => json(rows)]]);
    const source = new IndecSalariosSource({ token: TOKEN, fetchFn });

    const samples = await source.fetch();

    expect(samples).toEqual([
      { key: 'salarios-variacion', value: 35.61, referenceDate: '2026-08', prevValue: 36.18 },
    ]);
    const [url] = fetchFn.mock.calls[0];
    expect(String(url)).toContain('descripcion=eq.Nivel+general');
    expect(String(url)).toContain('tipo_de_indicador=eq.v_ia');
  });
});

describe('IndecEmaeSource (EI-2, EI-5)', () => {
  it('returns the original-series interannual variation with the previous month as prevValue', async () => {
    const rows = [
      { periodo: '202608', valor: -1.7442909681778529 },
      { periodo: '202607', valor: -1.4690865441220669 },
    ];
    const fetchFn = routedFetch([
      [/estimador-mensual-de-actividad-economica-nivel-general/, () => json(rows)],
    ]);
    const source = new IndecEmaeSource({ token: TOKEN, fetchFn });

    const samples = await source.fetch();

    expect(samples[0].key).toBe('emae-variacion');
    expect(samples[0].value).toBeCloseTo(-1.7443);
    expect(samples[0].referenceDate).toBe('2026-08');
    expect(samples[0].prevValue).toBeCloseTo(-1.4691);
    const [url] = fetchFn.mock.calls[0];
    expect(String(url)).toContain('tipo_de_indicador=eq.Variaci%C3%B3n+porcentual');
    expect(String(url)).toContain('tipo_de_indicador_descripcion=eq.Var+%25+interanual+serie+original');
  });
});

describe('INDEC adapter failure modes (EI-2)', () => {
  it('throws when the token is not configured', async () => {
    const source = new IndecCanastasSource({ token: '', fetchFn: routedFetch([]) });

    await expect(source.fetch()).rejects.toThrow('INDEC_API_TOKEN is not set');
  });

  it('throws on HTTP errors', async () => {
    const fetchFn = routedFetch([[/valorizacion_canastas_cba_cbt/, () => json({}, 503)]]);
    const source = new IndecCanastasSource({ token: TOKEN, fetchFn });

    await expect(source.fetch()).rejects.toThrow('INDEC returned HTTP 503');
  });

  it('throws on malformed JSON', async () => {
    const fetchFn = vi.fn(async () => new Response('<html>oops</html>', { status: 200 })) as unknown as MockFetch;
    const source = new IndecCanastasSource({ token: TOKEN, fetchFn });

    await expect(source.fetch()).rejects.toThrow('INDEC returned malformed JSON');
  });

  it('throws on an empty row set', async () => {
    const fetchFn = routedFetch([[/valorizacion_canastas_cba_cbt/, () => json([])]]);
    const source = new IndecCanastasSource({ token: TOKEN, fetchFn });

    await expect(source.fetch()).rejects.toThrow('unexpected shape');
  });

  it('throws on a non-finite value', async () => {
    const fetchFn = routedFetch([[/indice_salarios/, () => json([{ periodo: '202608', valor: 'nope' }])]]);
    const source = new IndecSalariosSource({ token: TOKEN, fetchFn });

    await expect(source.fetch()).rejects.toThrow('invalid valor');
  });

  it('rejects a null valor instead of reading it as zero', async () => {
    const fetchFn = routedFetch([[/indice_salarios/, () => json([{ periodo: '202608', valor: null }])]]);
    const source = new IndecSalariosSource({ token: TOKEN, fetchFn });

    await expect(source.fetch()).rejects.toThrow('invalid valor');
  });

  it('throws on an invalid period', async () => {
    const fetchFn = routedFetch([[/indice_salarios/, () => json([{ periodo: '2026-08', valor: 1 }])]]);
    const source = new IndecSalariosSource({ token: TOKEN, fetchFn });

    await expect(source.fetch()).rejects.toThrow('invalid periodo');
  });

  it('rejects an invalid period on the previous row instead of using it as prevValue', async () => {
    const fetchFn = routedFetch([
      [/indice_salarios/, () => json([
        { periodo: '202608', valor: 35.61 },
        { periodo: '2026-07', valor: 36.18 },
      ])],
    ]);
    const source = new IndecSalariosSource({ token: TOKEN, fetchFn });

    await expect(source.fetch()).rejects.toThrow('invalid periodo');
  });
});
