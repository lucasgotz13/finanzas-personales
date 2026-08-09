import type { IndicatorSample, IndicatorSource } from '@finanzas/domain';

const URL = 'https://dolarapi.com/v1/dolares';
const DEFAULT_TIMEOUT_MS = 10_000;

/** dolarapi casa → indicator key (EI-1): bolsa = MEP, contadoconliqui = CCL. */
const KEY_BY_CASA: Record<string, string> = {
  blue: 'usd-blue',
  oficial: 'usd-oficial',
  tarjeta: 'usd-tarjeta',
  bolsa: 'usd-mep',
  contadoconliqui: 'usd-ccl',
};

interface DolarApiItem {
  casa?: unknown;
  venta?: unknown;
  fechaActualizacion?: unknown;
}

/** USD quotes from dolarapi.com: one call covers the 5 FX indicators (EI-2). */
export class DolarApiSource implements IndicatorSource {
  readonly class = 'fx' as const;

  constructor(
    private fetchFn: typeof fetch = fetch,
    private timeoutMs: number = DEFAULT_TIMEOUT_MS,
  ) {}

  async fetch(): Promise<IndicatorSample[]> {
    const body = await this.getJson();
    if (!Array.isArray(body)) throw new Error('dolarapi returned an unexpected shape');

    const samples: IndicatorSample[] = [];
    for (const item of body as DolarApiItem[]) {
      const key = typeof item.casa === 'string' ? KEY_BY_CASA[item.casa] : undefined;
      if (!key) continue;
      const value = Number(item.venta);
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error(`dolarapi returned an invalid venta for ${String(item.casa)}`);
      }
      if (typeof item.fechaActualizacion !== 'string') {
        throw new Error(`dolarapi missing fechaActualizacion for ${String(item.casa)}`);
      }
      samples.push({ key: key as IndicatorSample['key'], value, referenceDate: item.fechaActualizacion });
    }
    if (samples.length !== 5) throw new Error('dolarapi response is missing casas');
    return samples;
  }

  private async getJson(): Promise<unknown> {
    const res = await this.fetchFn(URL, { signal: AbortSignal.timeout(this.timeoutMs) });
    if (!res.ok) throw new Error(`dolarapi returned HTTP ${res.status}`);
    try {
      return await res.json();
    } catch {
      throw new Error('dolarapi returned malformed JSON');
    }
  }
}
