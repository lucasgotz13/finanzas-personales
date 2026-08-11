import type { IndicatorSample, IndicatorSource } from '@finanzas/domain';

const BASE_URL = 'https://api.argentinadatos.com/v1/finanzas/indices';
const RIESGO_PAIS_URL = `${BASE_URL}/riesgo-pais`;
const IPC_URL = `${BASE_URL}/inflacion`;
const DEFAULT_TIMEOUT_MS = 10_000;

interface SeriesItem {
  fecha?: unknown;
  valor?: unknown;
}

/**
 * Riesgo país (JP Morgan EMBI) and IPC monthly variation from
 * argentinadatos.com (EI-2). Both endpoints return a chronologically ordered
 * series; the adapter takes the LAST entry. Riesgo país rejects zero/negative
 * valores; IPC is a signed monthly variation (EI-5) so only non-finite values
 * are rejected. IPC has been served by this source since issue #33 (previously
 * datos.gob.ar). One instance per indicator class: the domain resolves sources
 * by class.
 */
export class ArgentinadatosSource implements IndicatorSource {
  readonly class: 'riesgo-pais' | 'ipc';

  constructor(
    private fetchFn: typeof fetch = fetch,
    private timeoutMs: number = DEFAULT_TIMEOUT_MS,
    cls: 'riesgo-pais' | 'ipc' = 'riesgo-pais',
  ) {
    this.class = cls;
  }

  async fetch(): Promise<IndicatorSample[]> {
    const res = await this.fetchFn(this.class === 'ipc' ? IPC_URL : RIESGO_PAIS_URL, {
      signal: AbortSignal.timeout(this.timeoutMs),
    });
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
    const latest = body[body.length - 1] as SeriesItem; // chronologically ordered
    const value = Number(latest.valor);
    if (!Number.isFinite(value) || (this.class === 'riesgo-pais' && value <= 0)) {
      throw new Error('argentinadatos returned an invalid valor');
    }
    if (typeof latest.fecha !== 'string') throw new Error('argentinadatos missing fecha');
    return [
      {
        key: this.class === 'ipc' ? 'ipc-mensual' : 'riesgo-pais',
        value,
        referenceDate: latest.fecha,
      },
    ];
  }
}
