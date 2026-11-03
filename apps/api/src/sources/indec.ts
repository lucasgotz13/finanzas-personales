import type { IndicatorSample, IndicatorSource } from '@finanzas/domain';
import { ArgentinadatosSource } from './argentinadatos';

const BASE_URL = 'https://api.indec.gob.ar/v1';
const DEFAULT_TIMEOUT_MS = 10_000;

type Row = Record<string, unknown>;

export interface IndecSourceOptions {
  /** INDEC JWT; defaults to the INDEC_API_TOKEN env var. Never logged. */
  token?: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

export interface IndecIpcOptions extends IndecSourceOptions {
  /** Keyless fallback used only when the INDEC request fails (EI-2). */
  fallback?: Pick<IndicatorSource, 'fetch'>;
}

function valueOf(row: Row): number {
  const raw = row.valor;
  if (raw === null || raw === undefined || (typeof raw === 'string' && raw.trim() === '')) {
    throw new Error('INDEC returned an invalid valor');
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error('INDEC returned an invalid valor');
  return value;
}

/** INDEC periods are AAAAMM; the app renders reference months as AAAA-MM (EI-5). */
function monthOf(row: Row): string {
  const periodo = row.periodo;
  if (typeof periodo !== 'string' || !/^\d{6}$/.test(periodo)) {
    throw new Error('INDEC returned an invalid periodo');
  }
  return `${periodo.slice(0, 4)}-${periodo.slice(4, 6)}`;
}

/** Latest row plus the previous published reading (rows must be period-desc). */
function latestPair(rows: Row[]): { value: number; referenceDate: string; prevValue: number | null } {
  const [latest, previous] = rows;
  const referenceDate = monthOf(latest);
  const value = valueOf(latest);
  if (previous === undefined) return { value, referenceDate, prevValue: null };
  monthOf(previous); // reject an invalid period instead of using it as prevValue
  return { value, referenceDate, prevValue: valueOf(previous) };
}

/**
 * INDEC API-INDEC client (BETA, PostgREST-style filters). Every data endpoint
 * requires a Bearer JWT from INDEC_API_TOKEN; without it the class reports
 * `failed` and the cache keeps serving (EI-2, EI-4).
 */
abstract class IndecClient {
  private readonly token: string | undefined;
  private readonly fetchFn: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: IndecSourceOptions = {}) {
    this.token = options.token ?? process.env.INDEC_API_TOKEN;
    this.fetchFn = options.fetchFn ?? fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  protected async rows(path: string, params: Record<string, string>): Promise<Row[]> {
    if (!this.token) throw new Error('INDEC_API_TOKEN is not set');
    const url = `${BASE_URL}/${path}?${new URLSearchParams(params).toString()}`;
    const res = await this.fetchFn(url, {
      signal: AbortSignal.timeout(this.timeoutMs),
      headers: { Authorization: `Bearer ${this.token}` },
    });
    if (!res.ok) throw new Error(`INDEC returned HTTP ${res.status}`);
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      throw new Error('INDEC returned malformed JSON');
    }
    if (!Array.isArray(body) || body.length === 0) {
      throw new Error('INDEC returned an unexpected shape');
    }
    return body as Row[];
  }
}

/**
 * IPC monthly and interannual variation, national general level (EI-2, EI-5).
 * INDEC is the authoritative source; a request failure falls back to the
 * keyless argentinadatos monthly series so a missing/expired token never
 * blanks the existing IPC card.
 */
export class IndecIpcSource extends IndecClient implements IndicatorSource {
  readonly class = 'ipc' as const;
  private readonly fallback: Pick<IndicatorSource, 'fetch'>;

  constructor(options: IndecIpcOptions = {}) {
    super(options);
    this.fallback = options.fallback ?? new ArgentinadatosSource(undefined, undefined, 'ipc');
  }

  async fetch(): Promise<IndicatorSample[]> {
    try {
      return await this.fetchIndec();
    } catch (err) {
      const indecMessage = err instanceof Error ? err.message : String(err);
      try {
        const samples = await this.fallback.fetch();
        return samples.filter((sample) => sample.key === 'ipc-mensual');
      } catch (fallbackErr) {
        const fallbackMessage = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
        throw new Error(`INDEC failed (${indecMessage}) and fallback failed (${fallbackMessage})`);
      }
    }
  }

  private async fetchIndec(): Promise<IndicatorSample[]> {
    const rows = await this.rows('ipc_nacional', {
      clasificador: 'eq.IPC',
      nivel: 'eq.Nivel General',
      region: 'eq.Nacional',
      tipo_de_indicador: 'in.(v_m,v_ia)',
      select: 'periodo,tipo_de_indicador,valor',
      order: 'periodo.desc',
      limit: '8',
    });
    const byPeriod = new Map<string, Map<string, number>>();
    for (const row of rows) {
      const period = monthOf(row);
      const values = byPeriod.get(period) ?? new Map<string, number>();
      byPeriod.set(period, values);
      const tipo = row.tipo_de_indicador;
      if (typeof tipo === 'string') values.set(tipo, valueOf(row));
    }
    const periods = [...byPeriod.keys()].sort().reverse();
    const latest = periods[0];
    const previous = periods[1];
    const latestValues = latest === undefined ? undefined : byPeriod.get(latest);
    const previousValues = previous === undefined ? undefined : byPeriod.get(previous);
    const monthly = latestValues?.get('v_m');
    if (latest === undefined || monthly === undefined) {
      throw new Error('INDEC returned no monthly IPC variation');
    }
    const samples: IndicatorSample[] = [
      {
        key: 'ipc-mensual',
        value: monthly,
        referenceDate: latest,
        prevValue: previousValues?.get('v_m') ?? null,
      },
    ];
    const interannual = latestValues?.get('v_ia');
    if (interannual !== undefined) {
      samples.push({
        key: 'ipc-interanual',
        value: interannual,
        referenceDate: latest,
        prevValue: previousValues?.get('v_ia') ?? null,
      });
    }
    return samples;
  }
}

/** CBA/CBT total basket, GBA, per adult equivalent, in current pesos (EI-2). */
export class IndecCanastasSource extends IndecClient implements IndicatorSource {
  readonly class = 'indec-canastas' as const;

  async fetch(): Promise<IndicatorSample[]> {
    const rows = await this.rows('valorizacion_canastas_cba_cbt', {
      region: 'eq.GBA',
      tipo_de_indicador: 'eq.CBT',
      unidad_de_medida: 'eq.Pesos argentinos',
      select: 'periodo,valor',
      order: 'periodo.desc',
      limit: '2',
    });
    const pair = latestPair(rows);
    if (pair.value <= 0) throw new Error('INDEC returned an invalid valor');
    return [{ key: 'canasta-basica-total', ...pair }];
  }
}

/** General wage index, interannual variation (EI-2). */
export class IndecSalariosSource extends IndecClient implements IndicatorSource {
  readonly class = 'indec-salarios' as const;

  async fetch(): Promise<IndicatorSample[]> {
    const rows = await this.rows('indice_salarios', {
      descripcion: 'eq.Nivel general',
      tipo_de_indicador: 'eq.v_ia',
      select: 'periodo,valor',
      order: 'periodo.desc',
      limit: '2',
    });
    return [{ key: 'salarios-variacion', ...latestPair(rows) }];
  }
}

/** EMAE, original series interannual variation (EI-2). */
export class IndecEmaeSource extends IndecClient implements IndicatorSource {
  readonly class = 'indec-emae' as const;

  async fetch(): Promise<IndicatorSample[]> {
    const rows = await this.rows('estimador-mensual-de-actividad-economica-nivel-general', {
      tipo_de_indicador: 'eq.Variación porcentual',
      tipo_de_indicador_descripcion: 'eq.Var % interanual serie original',
      select: 'periodo,valor',
      order: 'periodo.desc',
      limit: '2',
    });
    return [{ key: 'emae-variacion', ...latestPair(rows) }];
  }
}
