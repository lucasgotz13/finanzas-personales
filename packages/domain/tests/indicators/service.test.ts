import { describe, expect, it } from 'vitest';
import { CLASS_BY_KEY, KEYS, TTL_BY_CLASS } from '../../src/indicators/catalog';
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
  seed: (key: IndicatorKey, value: number, referenceDate: string, fetchedAt: string, prevValue?: number | null) => void;
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
    seed: (key, value, referenceDate, fetchedAt, prevValue = null) => {
      void cache.set({ key, value, unit: 'u', referenceDate, fetchedAt, source: 'test', prevValue });
    },
  };
}

/** Registers a stub source only for the classes given; missing classes have no source. */
function withSources(h: Harness, impls: Partial<Record<IndicatorClass, () => Promise<IndicatorSample[]>>>): void {
  const list: IndicatorSource[] = [];
  for (const cls of ['fx', 'bcra', 'riesgo-pais', 'ipc', 'oil'] as IndicatorClass[]) {
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

const OIL_SAMPLES: IndicatorSample[] = [
  { key: 'brent', value: 67.45, referenceDate: '2026-08-09T20:58:00-03:00' },
  { key: 'wti', value: 63.2, referenceDate: '2026-08-09T20:58:00-03:00' },
];

describe('IndicatorService.getAll (EI-1, EI-4, EI-5)', () => {
  it('derives 11 fresh views from a populated cache without fetching', async () => {
    const h = harness(T0);
    withSources(h, {});
    for (const key of KEYS) h.seed(key, key === 'ipc-mensual' ? -0.1 : 1, '2026-08', iso(0));

    const views = await h.service.getAll();

    expect(views).toHaveLength(11);
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

    expect(views).toHaveLength(11);
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

    expect(views).toHaveLength(11);
    expect(views.every((v) => v.status === 'absent' && v.referenceAged === false)).toBe(true);
  });
});

describe('IndicatorService.refresh (EI-2, EI-3)', () => {
  it('reports cached and does not fetch classes within TTL (fx 2 min, oil 2 min, bcra 10 h)', async () => {
    const h = harness(T0);
    // Sources registered but must never be fetched while every class is fresh.
    withSources(h, {
      fx: () => Promise.reject(new Error('should not fetch')),
      bcra: () => Promise.reject(new Error('should not fetch')),
      'riesgo-pais': () => Promise.reject(new Error('should not fetch')),
      ipc: () => Promise.reject(new Error('should not fetch')),
      oil: () => Promise.reject(new Error('should not fetch')),
    });
    for (const key of KEYS) {
      const shortLived = CLASS_BY_KEY[key] === 'fx' || CLASS_BY_KEY[key] === 'oil';
      h.seed(key, 1, '2026-08', iso(shortLived ? -2 * 60_000 : -10 * 60 * 60_000));
    }

    const results = await h.service.refresh(false);

    expect(results.map((r) => [r.class, r.status])).toEqual([
      ['fx', 'cached'],
      ['bcra', 'cached'],
      ['riesgo-pais', 'cached'],
      ['ipc', 'cached'],
      ['oil', 'cached'],
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
      oil: async () => OIL_SAMPLES,
    });
    // everything 6 min old: fx (TTL 5 min) is past its TTL, the other classes are not
    for (const key of KEYS) h.seed(key, 1, '2026-08', iso(-TTL_BY_CLASS.fx - 60_000));
    // oil (TTL 10 min) is pushed past its TTL as well to prove both keys refetch
    h.seed('brent', 60, '2026-08-09', iso(-TTL_BY_CLASS.oil - 60_000));
    h.seed('wti', 60, '2026-08-09', iso(-TTL_BY_CLASS.oil - 60_000));

    const results = await h.service.refresh(false);

    const fx = results.find((r) => r.class === 'fx');
    expect(fx?.status).toBe('updated');
    expect(h.sources.get('fx')?.calls).toBe(1);
    expect(h.cache.stored('usd-blue')?.value).toBe(1350.5);
    expect(h.cache.stored('usd-blue')?.fetchedAt).toBe(iso(0));
    expect(results.find((r) => r.class === 'bcra')?.status).toBe('cached');
    expect(results.find((r) => r.class === 'oil')?.status).toBe('updated');
    expect(h.cache.stored('brent')).toMatchObject({ value: 67.45, unit: 'USD/bbl' });
    expect(h.cache.stored('wti')).toMatchObject({ value: 63.2, unit: 'USD/bbl' });
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
      oil: async () => OIL_SAMPLES,
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
      oil: async () => OIL_SAMPLES,
    });
    h.seed('reservas', 100, '2026-08-01', iso(-60_000));

    const results = await h.service.refresh(false);

    const bcra = results.find((r) => r.class === 'bcra');
    expect(bcra?.status).toBe('failed');
    expect(bcra?.error).toBe('bcra down');
    expect(results.filter((r) => r.status === 'failed')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'updated')).toHaveLength(4);
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
      oil: async () => Promise.reject(new Error('oil down')),
    });
    h.seed('usd-blue', 1350.5, '2026-08-09', iso(-60_000));

    const results = await h.service.refresh(false);

    expect(results).toHaveLength(5);
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
    for (const cls of ['bcra', 'riesgo-pais', 'ipc', 'oil'] as IndicatorClass[]) {
      expect(results.find((r) => r.class === cls)?.status).toBe('failed');
    }
  });
});

describe('IndicatorService changePercent derivation (indicator-day-change)', () => {
  it('derives the signed percent change from value and prevValue', async () => {
    const h = harness(T0);
    withSources(h, {});
    h.seed('usd-oficial', 1560, '2026-08-10', iso(0), 1540);
    h.seed('usd-blue', 1520, '2026-08-10', iso(0), 1540);

    const views = await h.service.getAll();

    // 1540 → 1560 = +1.2987...%; 1540 → 1520 = -1.2987...%
    expect(views.find((v) => v.key === 'usd-oficial')?.changePercent).toBeCloseTo((20 / 1540) * 100);
    expect(views.find((v) => v.key === 'usd-blue')?.changePercent).toBeCloseTo((-20 / 1540) * 100);
  });

  it('is null when value or prevValue is missing or prevValue is non-positive', async () => {
    const h = harness(T0);
    withSources(h, {});
    h.seed('usd-blue', 1560, '2026-08-10', iso(0), null); // first run: no previous reading
    h.seed('usd-oficial', 1560, '2026-08-10', iso(0), 0);
    h.seed('usd-tarjeta', 1560, '2026-08-10', iso(0), -5);

    const views = await h.service.getAll();

    for (const key of ['usd-blue', 'usd-oficial', 'usd-tarjeta']) {
      expect(views.find((v) => v.key === key)?.changePercent).toBeNull();
    }
    // absent snapshot: no value, no change
    expect(views.find((v) => v.key === 'usd-mep')?.changePercent).toBeNull();
  });

  it('always hides the change for ipc-mensual (its value is already a variation %)', async () => {
    const h = harness(T0);
    withSources(h, {});
    h.seed('ipc-mensual', 2, '2026-06', iso(0), 1.5);

    const ipc = (await h.service.getAll()).find((v) => v.key === 'ipc-mensual');

    expect(ipc?.changePercent).toBeNull();
  });
});

describe('IndicatorService refresh prevValue carry-forward (indicator-day-change)', () => {
  it('prefers the adapter-supplied prevValue over the cached snapshot', async () => {
    const h = harness(T0);
    withSources(h, {
      bcra: async () => [
        { key: 'reservas', value: 28500, referenceDate: '2026-08-10', prevValue: 28000 },
        { key: 'badlar', value: 38.5, referenceDate: '2026-08-10', prevValue: 38 },
      ],
    });
    h.seed('reservas', 27500, '2026-08-09', iso(-60_000), 27000);
    h.seed('badlar', 37, '2026-08-09', iso(-60_000), 36);

    await h.service.refresh(true);

    expect(h.cache.stored('reservas')).toMatchObject({ value: 28500, prevValue: 28000 });
    expect(h.cache.stored('badlar')).toMatchObject({ value: 38.5, prevValue: 38 });
  });

  it('carries the cached value forward as prevValue when the reference date rolls', async () => {
    // dolar-api style: the sample has no prevValue of its own.
    const h = harness(T0);
    withSources(h, {
      fx: async () => [{ key: 'usd-oficial', value: 1560, referenceDate: '2026-08-10T14:00:00-03:00' }],
    });
    h.seed('usd-oficial', 1540, '2026-08-09T14:00:00-03:00', iso(-60_000), null);

    await h.service.refresh(true);

    expect(h.cache.stored('usd-oficial')).toMatchObject({ value: 1560, prevValue: 1540 });
    const view = (await h.service.getAll()).find((v) => v.key === 'usd-oficial');
    expect(view?.changePercent).toBeCloseTo((20 / 1540) * 100);
  });

  it('keeps the cached prevValue on a same-referenceDate refresh (no double-shift)', async () => {
    const h = harness(T0);
    withSources(h, {
      fx: async () => [{ key: 'usd-oficial', value: 1560, referenceDate: '2026-08-10T14:00:00-03:00' }],
    });
    h.seed('usd-oficial', 1560, '2026-08-10T14:00:00-03:00', iso(-60_000), 1540);

    await h.service.refresh(true);
    await h.service.refresh(true);

    expect(h.cache.stored('usd-oficial')).toMatchObject({ value: 1560, prevValue: 1540 });
    const view = (await h.service.getAll()).find((v) => v.key === 'usd-oficial');
    expect(view?.changePercent).toBeCloseTo((20 / 1540) * 100);
  });

  it('stores a null prevValue on the first run without a cached snapshot', async () => {
    const h = harness(T0);
    withSources(h, {
      fx: async () => [{ key: 'usd-oficial', value: 1560, referenceDate: '2026-08-10T14:00:00-03:00' }],
    });

    await h.service.refresh(true);

    expect(h.cache.stored('usd-oficial')?.prevValue).toBeNull();
    const view = (await h.service.getAll()).find((v) => v.key === 'usd-oficial');
    expect(view?.changePercent).toBeNull();
  });
});
