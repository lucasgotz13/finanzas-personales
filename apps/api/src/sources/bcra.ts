import type { IndicatorSample, IndicatorSource } from '@finanzas/domain';

const BASE = 'https://api.bcra.gob.ar/estadisticas/v4.0/Monetarias';
const DEFAULT_TIMEOUT_MS = 10_000;
const DAYS_BACK = 45;

/** BCRA variable id → indicator key: 1 reservas internacionales, 7 BADLAR (EI-2). */
const KEY_BY_VARIABLE: Record<number, string> = {
  1: 'reservas',
  7: 'badlar',
};

interface BcraPoint {
  fecha?: unknown;
  valor?: unknown;
}

interface BcraResult {
  idVariable?: unknown;
  /** v4.0 nests the daily points under detalle (verified live 2026-08-09). */
  detalle?: BcraPoint[];
}

/** Latest {fecha, valor} per BCRA variable; zero/negative values are rejected (EI-2). */
export class BcraSource implements IndicatorSource {
  readonly class = 'bcra' as const;

  constructor(
    private fetchFn: typeof fetch = fetch,
    private now: () => Date = () => new Date(),
    private timeoutMs: number = DEFAULT_TIMEOUT_MS,
  ) {}

  async fetch(): Promise<IndicatorSample[]> {
    const samples: IndicatorSample[] = [];
    for (const variable of [1, 7]) {
      samples.push(await this.fetchVariable(variable));
    }
    return samples;
  }

  private async fetchVariable(variable: number): Promise<IndicatorSample> {
    const url = `${BASE}/${variable}?desde=${this.fromDate()}&hasta=${this.toDate()}`;
    const res = await this.fetchFn(url, { signal: AbortSignal.timeout(this.timeoutMs) });
    if (!res.ok) throw new Error(`BCRA returned HTTP ${res.status}`);
    let body: { results?: unknown };
    try {
      body = (await res.json()) as { results?: unknown };
    } catch {
      throw new Error('BCRA returned malformed JSON');
    }
    if (!Array.isArray(body.results) || body.results.length === 0) {
      throw new Error(`BCRA returned no results for variable ${variable}`);
    }
    const result = (body.results as BcraResult[]).find((r) => Number(r.idVariable) === variable);
    const points = result?.detalle;
    if (!Array.isArray(points) || points.length === 0) {
      throw new Error(`BCRA returned no series for variable ${variable}`);
    }
    const latest = points[points.length - 1]; // chronologically ordered
    const value = Number(latest.valor);
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`BCRA returned an invalid value for variable ${variable}`);
    }
    const key = KEY_BY_VARIABLE[variable];
    if (!key) throw new Error(`BCRA unknown variable ${variable}`);
    if (typeof latest.fecha !== 'string') throw new Error(`BCRA missing fecha for variable ${variable}`);
    return { key: key as IndicatorSample['key'], value, referenceDate: latest.fecha };
  }

  private fromDate(): string {
    const d = new Date(this.now().getTime() - DAYS_BACK * 24 * 60 * 60_000);
    return d.toISOString().slice(0, 10);
  }

  private toDate(): string {
    return this.now().toISOString().slice(0, 10);
  }
}
