import type { IndicatorSample, IndicatorSource } from '@finanzas/domain';

const SERIES_URL = 'https://apis.datos.gob.ar/series/api/series/';
const SEARCH_URL = 'https://apis.datos.gob.ar/series/api/search/';
const DEFAULT_TIMEOUT_MS = 10_000;
const SEARCH_QUERY = 'tasa de variacion mensual IPC nivel general';

/**
 * Default IPC series id, resolved live from datos.gob.ar /search on
 * 2026-08-09: "IPC. Tasa de variación mensual. Nivel General. Nacional.
 * Base dic 2016." (145.3_INGNACUAL_DICI_M_38). Overridable via IPC_SERIES_ID.
 */
const DEFAULT_SERIES_ID = process.env.IPC_SERIES_ID ?? '145.3_INGNACUAL_DICI_M_38';

interface SearchItem {
  field?: { id?: unknown; description?: unknown };
}

/**
 * IPC monthly variation from datos.gob.ar. The series API returns the
 * variation as a fraction (0.042 = 4.2%); the adapter converts it to signed
 * percent for the `%` unit (EI-5). On an invalid/empty series it resolves the
 * series id through /search (matching `tasa_variacion_mensual`), caches it in
 * memory and retries once (EI-2).
 */
export class DatosGobArSource implements IndicatorSource {
  readonly class = 'ipc' as const;
  private resolvedId: string | null = null;

  constructor(
    private fetchFn: typeof fetch = fetch,
    private timeoutMs: number = DEFAULT_TIMEOUT_MS,
  ) {}

  async fetch(): Promise<IndicatorSample[]> {
    return [await this.fetchWithId(this.seriesId())];
  }

  private seriesId(): string {
    return this.resolvedId ?? DEFAULT_SERIES_ID;
  }

  private async fetchWithId(id: string): Promise<IndicatorSample> {
    const url = `${SERIES_URL}?ids=${encodeURIComponent(id)}`;
    const res = await this.fetchFn(url, { signal: AbortSignal.timeout(this.timeoutMs) });
    if (!res.ok) throw new Error(`datos.gob.ar series returned HTTP ${res.status}`);
    let body: { data?: unknown };
    try {
      body = (await res.json()) as { data?: unknown };
    } catch {
      throw new Error('datos.gob.ar returned malformed JSON');
    }
    const data = body.data;
    if (!Array.isArray(data) || data.length === 0) {
      // EI-2: series id drifted → resolve a fresh id via /search and retry once.
      const resolved = await this.resolveSeriesId();
      if (resolved !== null && resolved !== id) return this.fetchWithId(resolved);
      throw new Error(`datos.gob.ar returned no data for series ${id}`);
    }
    const latest = data[data.length - 1];
    if (!Array.isArray(latest) || typeof latest[0] !== 'string') {
      throw new Error('datos.gob.ar returned an unexpected series row');
    }
    const fraction = Number(latest[1]);
    if (!Number.isFinite(fraction)) throw new Error('datos.gob.ar returned an invalid value');
    return {
      key: 'ipc-mensual',
      value: fraction * 100, // fraction → signed percent (EI-5)
      referenceDate: latest[0].slice(0, 7), // YYYY-MM reference month (EI-5)
    };
  }

  private async resolveSeriesId(): Promise<string | null> {
    if (this.resolvedId) return this.resolvedId;
    const url = `${SEARCH_URL}?q=${encodeURIComponent(SEARCH_QUERY)}&limit=10`;
    const res = await this.fetchFn(url, { signal: AbortSignal.timeout(this.timeoutMs) });
    if (!res.ok) throw new Error(`datos.gob.ar search returned HTTP ${res.status}`);
    let body: { data?: unknown };
    try {
      body = (await res.json()) as { data?: unknown };
    } catch {
      throw new Error('datos.gob.ar search returned malformed JSON');
    }
    if (!Array.isArray(body.data)) throw new Error('datos.gob.ar search returned an unexpected shape');
    const items = body.data as SearchItem[];
    const monthly = items.find((item) => {
      const description = typeof item.field?.description === 'string' ? item.field.description : '';
      return /tasa de variaci[oó]n mensual/i.test(description);
    });
    const chosen = (monthly ?? items[0])?.field?.id;
    if (typeof chosen !== 'string') return null;
    this.resolvedId = chosen; // in-memory cache of the resolved id
    return chosen;
  }
}
