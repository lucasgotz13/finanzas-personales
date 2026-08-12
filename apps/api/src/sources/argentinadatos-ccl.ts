import type { CclPoint, CclSeriesSource } from '@finanzas/domain';

const CCL_URL = 'https://api.argentinadatos.com/v1/cotizaciones/dolares/contadoconliqui';
const DEFAULT_TIMEOUT_MS = 10_000;

interface CclRow {
  fecha?: unknown;
  venta?: unknown;
}

/**
 * Contado-con-liqui daily series from argentinadatos.com (PC-3): the endpoint
 * returns chronologically ordered {fecha, compra, venta} rows. The adapter
 * keeps the VENTA rate as REAL values per date (D8) and skips rows with a
 * missing/non-finite venta. The domain forward-fills gaps (≤5 days) and
 * windows per range.
 */
export class ArgentinadatosCclSeriesSource implements CclSeriesSource {
  constructor(
    private fetchFn: typeof fetch = fetch,
    private timeoutMs: number = DEFAULT_TIMEOUT_MS,
  ) {}

  async fetchCclSeries(): Promise<CclPoint[]> {
    const res = await this.fetchFn(CCL_URL, {
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
    const points: CclPoint[] = [];
    for (const raw of body as CclRow[]) {
      if (typeof raw.fecha !== 'string') continue;
      const venta = raw.venta === null || raw.venta === undefined ? Number.NaN : Number(raw.venta);
      if (!Number.isFinite(venta) || venta <= 0) continue;
      points.push({ date: raw.fecha, value: venta });
    }
    if (points.length === 0) throw new Error('argentinadatos returned no valid CCL rows');
    return points;
  }
}
