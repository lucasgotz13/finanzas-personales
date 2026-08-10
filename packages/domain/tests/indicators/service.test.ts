import { describe, expect, it } from 'vitest';
import { KEYS, TTL_BY_CLASS } from '../../src/indicators/catalog';
import type { IndicatorCache, IndicatorSource } from '../../src/indicators/ports';
import { IndicatorService } from '../../src/indicators/service';
import type {
  IndicatorClass,
  IndicatorKey,
  IndicatorSample,
  IndicatorSnapshot,
} from '../../src/indicators/types';
import { arIsoString } from '../../src/vo/ar-tz';
import { FakeClock } from '../helpers/fakes';

const T0 = new Date('2026-08-09T23:58:00.000Z');

function iso(offsetMs: number): string {
  return new Date(T0.getTime() + offsetMs).toISOString();
}

class InMemoryIndicatorCache implements IndicatorCache {
  private rows = new Map<string, IndicatorSnapshot>();

  async get(key: string): Promise<IndicatorSnapshot | null> {
    return this.rows.get(key) ?? null;
  }

  async set(snapshot: IndicatorSnapshot): Promise<void> {
    this.rows.set(snapshot.key, { ...snapshot });
  }

  /** Test accessor: the stored snapshot for a key. */
  stored(key: string): IndicatorSnapshot | null {
    return this.rows.get(key) ?? null;
  }
}

class StubSource implements IndicatorSource {
  calls = 0;
  readonly class: IndicatorClass;

  constructor(
    cls: IndicatorClass,
    private impl: () => Promise<IndicatorSample[]>,
  ) {
    this.class = cls;
  }

  async fetch(): Promise<IndicatorSample[]> {
    this.calls++;
    return this.impl();
  }
}

interface Harness {
  cache: InMemoryIndicatorCache;
  sources: Map<IndicatorClass, StubSource>;
  service: IndicatorService;
  seed: (key: IndicatorKey, value: number, referenceDate: string, fetchedAt: string) => void;
}

function harness(now = T0): Harness {
  const cache = new InMemoryIndicatorCache();
  const sources = new Map<IndicatorClass, StubSource>();
  const service = new IndicatorService({
    sources: [],
    cache,
    clock: new FakeClock(now),
  });
  return {
    cache,
    sources,
    service,
    seed: (key, value, referenceDate, fetchedAt) => {
      void cache.set({ key, value, unit: 'u', referenceDate, fetchedAt, source: 'test' });
    },
  };
}

/** Registers a stub source only for the classes given; missing classes have no source. */
function withSources(h: Harness, impls: Partial<Record<IndicatorClass, () => Promise<IndicatorSample[]>>>): void {
  const list: IndicatorSource[] = [];
  for (const cls of ['fx', 'bcra', 'riesgo-pais', 'ipc'] as IndicatorClass[]) {
    const impl = impls[cls];
    if (impl === undefined) continue;
    const stub = new StubSource(cls, impl);
    list.push(stub);
    h.sources.set(cls, stub);
  }
  (h.service as unknown as { deps: { sources: IndicatorSource[] } }).deps.sources = list;
}

const FX_SAMPLES: IndicatorSample[] = [
  { key: 'usd-blue', value: 1350.5, referenceDate: '2026-08-09T20:55:00-03:00' },
  { key: 'usd-oficial', value: 1200, referenceDate: '2026-08-09T20:55:00-03:00' },
  { key: 'usd-tarjeta', value: 1560, referenceDate: '2026-08-09T20:55:00-03:00' },
  { key: 'usd-mep', value: 1330, referenceDate: '2026-08-09T20:55:00-03:00' },
  { key: 'usd-ccl', value: 1345, referenceDate: '2026-08-09T20:55:00-03:00' },
];

describe('IndicatorService.getAll (EI-1, EI-4, EI-5)', () => {
  it('derives 9 fresh views from a populated cache without fetching', async () => {
    const h = harness(T0);
    withSources(h, {});
    for (const key of KEYS) h.seed(key, key === 'ipc-mensual' ? -0.1 : 1, '2026-08', iso(0));

    const views = await h.service.getAll();

    expect(views).toHaveLength(9);
    for (const view of views) {
      expect(view.status).toBe('fresh');
      expect(view.stale).toBe(false);
      expect(view.value).not.toBeNull();
    }
    for (const s of h.sources.values()) expect(s.calls).toBe(0);
    // EI-5: stored UTC instant rendered with the fixed -03:00 offset
    expect(views.find((v) => v.key === 'usd-blue')?.updatedAt).toBe('2026-08-09T20:58:00-03:00');
  });

  it('returns absent views with null value and unit on an empty cache', async () => {
    const h = harness(T0);
    withSources(h, {});
    const views = await h.service.getAll();

    expect(views).toHaveLength(9);
    for (const view of views) {
      expect(view.status).toBe('absent');
      expect(view.stale).toBe(false);
      expect(view.value).toBeNull();
      expect(view.updatedAt).toBeNull();
      expect(view.unit).toBeTruthy();
    }
    for (const s of h.sources.values()) expect(s.calls).toBe(0);
  });

  it('marks expired snapshots stale with updatedAt = last successful fetch', async () => {
    const h = harness(T0);
    withSources(h, {});
    const fxAge = TTL_BY_CLASS.fx + 60_000;
    h.seed('usd-blue', 1350.5, '2026-08-09', iso(-fxAge));

    const blue = (await h.service.getAll()).find((v) => v.key === 'usd-blue');

    expect(blue?.status).toBe('stale');
    expect(blue?.stale).toBe(true);
    expect(blue?.value).toBe(1350.5);
    expect(blue?.updatedAt).toBe(arIsoString(new Date(iso(-fxAge))));
    for (const s of h.sources.values()) expect(s.calls).toBe(0);
  });

  it('keeps referenceAged false when the reference is within the class tolerance (issue #29)', async () => {
    const h = harness(T0);
    withSources(h, {});
    // fx tolerance is 2 days; a 1-day-old reference is fine, a 20-day-old IPC reference is fine
    h.seed('usd-blue', 1350.5, '2026-08-08', iso(0));
    h.seed('ipc-mensual', 0.2, '2026-07-20', iso(0));

    const views = await h.service.getAll();

    expect(views.every((v) => v.referenceAged === false)).toBe(true);
    expect(views.find((v) => v.key === 'usd-blue')?.status).toBe('fresh');
  });

  it('flags an old reference as referenceAged while the fetch status stays fresh (issue #29)', async () => {
    const h = harness(T0);
    withSources(h, {});
    // IPC reference ~100 days old, but fetched now: fetch-fresh yet reference-aged
    const oldRef = new Date(T0.getTime() - 100 * 24 * 60 * 60_000).toISOString().slice(0, 7);
    h.seed('ipc-mensual', 0.2, oldRef, iso(0));
    h.seed('usd-blue', 1350.5, '2026-08-09', iso(0));

    const views = await h.service.getAll();

    const ipc = views.find((v) => v.key === 'ipc-mensual');
    expect(ipc?.status).toBe('fresh');
    expect(ipc?.referenceAged).toBe(true);
    const blue = views.find((v) => v.key === 'usd-blue');
    expect(blue?.referenceAged).toBe(false);
  });

  it('reports referenceAged false when no snapshot is cached (issue #29)', async () => {
    const h = harness(T0);
    withSources(h, {});

    const views = await h.service.getAll();

    expect(views).toHaveLength(9);
    expect(views.every((v) => v.status === 'absent' && v.referenceAged === false)).toBe(true);
  });
});

describe('IndicatorService.refresh (EI-2, EI-3)', () => {
  it('reports cached and does not fetch classes within TTL (fx 2 min, bcra 10 h)', async () => {
    const h = harness(T0);
    // Sources registered but must never be fetched while every class is fresh.
    withSources(h, {
      fx: () => Promise.reject(new Error('should not fetch')),
      bcra: () => Promise.reject(new Error('should not fetch')),
      'riesgo-pais': () => Promise.reject(new Error('should not fetch')),
      ipc: () => Promise.reject(new Error('should not fetch')),
    });
    for (const key of KEYS) h.seed(key, 1, '2026-08', iso(key.startsWith('usd') ? -2 * 60_000 : -10 * 60 * 60_000));

    const results = await h.service.refresh(false);

    expect(results.map((r) => [r.class, r.status])).toEqual([
      ['fx', 'cached'],
      ['bcra', 'cached'],
      ['riesgo-pais', 'cached'],
      ['ipc', 'cached'],
    ]);
    for (const s of h.sources.values()) expect(s.calls).toBe(0);
  });

  it('refetches a class past its TTL and reports updated', async () => {
    const h = harness(T0);
    withSources(h, {
      fx: async () => FX_SAMPLES,
      bcra: async () => [
        { key: 'reservas', value: 28000, referenceDate: '2026-08-09' },
        { key: 'badlar', value: 38.5, referenceDate: '2026-08-09' },
      ],
      'riesgo-pais': async () => [{ key: 'riesgo-pais', value: 1200, referenceDate: '2026-08-09' }],
      ipc: async () => [{ key: 'ipc-mensual', value: 0.2, referenceDate: '2026-06' }],
    });
    // everything 6 min old: fx (TTL 5 min) is past TTL, the other classes are not
    for (const key of KEYS) h.seed(key, 1, '2026-08', iso(-TTL_BY_CLASS.fx - 60_000));

    const results = await h.service.refresh(false);

    const fx = results.find((r) => r.class === 'fx');
    expect(fx?.status).toBe('updated');
    expect(h.sources.get('fx')?.calls).toBe(1);
    expect(h.cache.stored('usd-blue')?.value).toBe(1350.5);
    expect(h.cache.stored('usd-blue')?.fetchedAt).toBe(iso(0));
    expect(results.find((r) => r.class === 'bcra')?.status).toBe('cached');
  });

  it('force bypasses TTL and refetches every class', async () => {
    const h = harness(T0);
    withSources(h, {
      fx: async () => FX_SAMPLES,
      bcra: async () => [
        { key: 'reservas', value: 28000, referenceDate: '2026-08-09' },
        { key: 'badlar', value: 38.5, referenceDate: '2026-08-09' },
      ],
      'riesgo-pais': async () => [{ key: 'riesgo-pais', value: 1200, referenceDate: '2026-08-09' }],
      ipc: async () => [{ key: 'ipc-mensual', value: -0.1, referenceDate: '2026-06' }],
    });
    for (const key of KEYS) h.seed(key, 1, '2026-08', iso(0)); // all fresh

    const results = await h.service.refresh(true);

    expect(results.every((r) => r.status === 'updated')).toBe(true);
    for (const s of h.sources.values()) expect(s.calls).toBe(1);
  });

  it('isolates a failing source: that class reports failed, others update, cache kept (EI-2)', async () => {
    const h = harness(T0);
    withSources(h, {
      fx: async () => FX_SAMPLES,
      bcra: async () => Promise.reject(new Error('bcra down')),
      'riesgo-pais': async () => [{ key: 'riesgo-pais', value: 1200, referenceDate: '2026-08-09' }],
      ipc: async () => [{ key: 'ipc-mensual', value: 0.2, referenceDate: '2026-06' }],
    });
    h.seed('reservas', 100, '2026-08-01', iso(-60_000));

    const results = await h.service.refresh(false);

    const bcra = results.find((r) => r.class === 'bcra');
    expect(bcra?.status).toBe('failed');
    expect(bcra?.error).toBe('bcra down');
    expect(results.filter((r) => r.status === 'failed')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'updated')).toHaveLength(3);
    // prior cache row untouched
    expect(h.cache.stored('reservas')?.value).toBe(100);
    expect(h.cache.stored('reservas')?.fetchedAt).toBe(iso(-60_000));
  });

  it('all sources down: 200-able all-failed result and cache keeps serving (EI-4)', async () => {
    const h = harness(T0);
    withSources(h, {
      fx: async () => Promise.reject(new Error('fx timeout')),
      bcra: async () => Promise.reject(new Error('bcra 500')),
      'riesgo-pais': async () => Promise.reject(new Error('rp down')),
      ipc: async () => Promise.reject(new Error('ipc down')),
    });
    h.seed('usd-blue', 1350.5, '2026-08-09', iso(-60_000));

    const results = await h.service.refresh(false);

    expect(results).toHaveLength(4);
    expect(results.every((r) => r.status === 'failed')).toBe(true);
    const blue = (await h.service.getAll()).find((v) => v.key === 'usd-blue');
    expect(blue?.value).toBe(1350.5);
  });

  it('rejects non-finite values as failed without touching the cache', async () => {
    const h = harness(T0);
    withSources(h, {
      fx: async () => [{ key: 'usd-blue', value: Number.NaN, referenceDate: '2026-08-09' }],
    });
    h.seed('usd-blue', 1350.5, '2026-08-09', iso(-60_000));

    const results = await h.service.refresh(false);

    expect(results.find((r) => r.class === 'fx')?.status).toBe('failed');
    expect(h.cache.stored('usd-blue')?.value).toBe(1350.5);
  });

  it('reports failed for a class without a registered source', async () => {
    const h = harness(T0);
    withSources(h, { fx: async () => FX_SAMPLES });
    for (const key of KEYS) h.seed(key, 1, '2026-08', iso(-TTL_BY_CLASS.fx - 60_000));

    const results = await h.service.refresh(false);

    expect(results.find((r) => r.class === 'fx')?.status).toBe('updated');
    for (const cls of ['bcra', 'riesgo-pais', 'ipc'] as IndicatorClass[]) {
      expect(results.find((r) => r.class === cls)?.status).toBe('failed');
    }
  });
});
