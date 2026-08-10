import { CLASS_BY_KEY, KEYS, REFERENCE_MAX_AGE_MS, TTL_BY_CLASS, UNIT_BY_KEY } from './catalog';
import type { IndicatorCache, IndicatorSource } from './ports';
import type {
  IndicatorClass,
  IndicatorKey,
  IndicatorRefreshResult,
  IndicatorSample,
  IndicatorSnapshot,
  IndicatorView,
} from './types';
import { arIsoString } from '../vo/ar-tz';

export interface IndicatorServiceDeps {
  sources: IndicatorSource[];
  cache: IndicatorCache;
  clock: { now(): Date };
}

const CLASSES: readonly IndicatorClass[] = ['fx', 'bcra', 'riesgo-pais', 'ipc'];

/**
 * Indicator read model service (EI-1..EI-5). getAll() is cache-only and never
 * fetches; refresh() runs per class with TTL gating, force bypass, finite-value
 * validation and try/catch isolation so one failing source never affects others.
 */
export class IndicatorService {
  constructor(private deps: IndicatorServiceDeps) {}

  /** Cache-first views for all 9 keys; absent/stale degrade, never fail (EI-1, EI-4). */
  async getAll(): Promise<IndicatorView[]> {
    const views: IndicatorView[] = [];
    for (const key of KEYS) {
      views.push(this.toView(key, await this.deps.cache.get(key)));
    }
    return views;
  }

  /** Refresh every class; within-TTL classes are skipped unless forced (EI-2, EI-3). */
  async refresh(force = false): Promise<IndicatorRefreshResult[]> {
    const results: IndicatorRefreshResult[] = [];
    for (const cls of CLASSES) {
      results.push(await this.refreshClass(cls, force));
    }
    return results;
  }

  private async refreshClass(cls: IndicatorClass, force: boolean): Promise<IndicatorRefreshResult> {
    const source = this.deps.sources.find((s) => s.class === cls);
    if (!source) {
      return { class: cls, status: 'failed', error: `no source for class ${cls}` };
    }
    if (!force && (await this.isFresh(cls))) {
      return { class: cls, status: 'cached' };
    }
    try {
      const samples = await source.fetch();
      if (!samples.every((s) => Number.isFinite(s.value)) || samples.length === 0) {
        throw new Error(`source ${cls} returned invalid samples`);
      }
      const fetchedAt = this.deps.clock.now().toISOString();
      for (const sample of samples) {
        await this.deps.cache.set({
          key: sample.key,
          value: sample.value,
          unit: UNIT_BY_KEY[sample.key],
          referenceDate: sample.referenceDate,
          fetchedAt,
          source: cls,
        });
      }
      return { class: cls, status: 'updated' };
    } catch (err) {
      return { class: cls, status: 'failed', error: err instanceof Error ? err.message : String(err) };
    }
  }

  /** All keys of the class cached and younger than the class TTL (EI-3, per-class contract). */
  private async isFresh(cls: IndicatorClass): Promise<boolean> {
    const ttl = TTL_BY_CLASS[cls];
    const now = this.deps.clock.now().getTime();
    for (const key of KEYS) {
      if (CLASS_BY_KEY[key] !== cls) continue;
      const snapshot = await this.deps.cache.get(key);
      if (!snapshot) return false;
      if (now - Date.parse(snapshot.fetchedAt) > ttl) return false;
    }
    return true;
  }

  private toView(key: IndicatorKey, snapshot: IndicatorSnapshot | null): IndicatorView {
    if (!snapshot) {
      return {
        key,
        value: null,
        unit: UNIT_BY_KEY[key],
        referenceDate: null,
        updatedAt: null,
        stale: false,
        status: 'absent',
        referenceAged: false,
      };
    }
    const now = this.deps.clock.now().getTime();
    const age = now - Date.parse(snapshot.fetchedAt);
    const stale = age > TTL_BY_CLASS[CLASS_BY_KEY[key]];
    // Reference age is independent of fetch age: IPC can be freshly fetched yet
    // lag months behind (issue #29).
    const referenceAged =
      snapshot.referenceDate !== null &&
      now - Date.parse(snapshot.referenceDate) > REFERENCE_MAX_AGE_MS[CLASS_BY_KEY[key]];
    return {
      key,
      value: snapshot.value,
      unit: snapshot.unit,
      referenceDate: snapshot.referenceDate,
      // Cache stores UTC ISO; views render AR-time (-03:00) instants (EI-5).
      updatedAt: arIsoString(new Date(snapshot.fetchedAt)),
      stale,
      status: stale ? 'stale' : 'fresh',
      referenceAged,
    };
  }
}
