import type { IndicatorSample, IndicatorSource } from '@finanzas/domain';

const URL = 'https://api.argentinadatos.com/v1/finanzas/indices/riesgo-pais';
const DEFAULT_TIMEOUT_MS = 10_000;

interface RiesgoPaisItem {
  fecha?: unknown;
  valor?: unknown;
}

/** Riesgo país (JP Morgan EMBI) from argentinadatos.com; zero/negative rejected (EI-2). */
export class ArgentinadatosSource implements IndicatorSource {
  readonly class = 'riesgo-pais' as const;

  constructor(
    private fetchFn: typeof fetch = fetch,
    private timeoutMs: number = DEFAULT_TIMEOUT_MS,
  ) {}

  async fetch(): Promise<IndicatorSample[]> {
    const res = await this.fetchFn(URL, { signal: AbortSignal.timeout(this.timeoutMs) });
    if (!res.ok) throw new Error(`argentinadatos returned HTTP ${res.status}`);
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      throw new Error('argentinadatos returned malformed JSON');
    }
    if (!Array.isArray(body) || body.length === 0) {
      throw new Error('argentinadatos returned an unexpected shape');
    }
    const latest = body[body.length - 1] as RiesgoPaisItem; // chronologically ordered
    const value = Number(latest.valor);
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error('argentinadatos returned an invalid valor');
    }
    if (typeof latest.fecha !== 'string') throw new Error('argentinadatos missing fecha');
    return [{ key: 'riesgo-pais', value, referenceDate: latest.fecha }];
  }
}
