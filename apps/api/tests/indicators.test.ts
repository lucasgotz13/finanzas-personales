import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import type { IndicatorClass, IndicatorSample, IndicatorSource } from '@finanzas/domain';
import { createTestApp } from './helpers';
import type { TestEnv } from './helpers';

const T0 = new Date('2026-08-09T23:58:00.000Z');

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

interface StubSet {
  fx: StubSource;
  bcra: StubSource;
  rp: StubSource;
  ipc: StubSource;
}

function makeSources(): StubSet {
  return {
    fx: new StubSource('fx', async () => [
      { key: 'usd-blue', value: 1350.5, referenceDate: '2026-08-09T20:55:00-03:00' },
      { key: 'usd-oficial', value: 1200, referenceDate: '2026-08-09T20:55:00-03:00' },
      { key: 'usd-tarjeta', value: 1560, referenceDate: '2026-08-09T20:55:00-03:00' },
      { key: 'usd-mep', value: 1330, referenceDate: '2026-08-09T20:55:00-03:00' },
      { key: 'usd-ccl', value: 1345, referenceDate: '2026-08-09T20:55:00-03:00' },
    ]),
    bcra: new StubSource('bcra', async () => [
      { key: 'reservas', value: 28000, referenceDate: '2026-08-09' },
      { key: 'badlar', value: 38.5, referenceDate: '2026-08-09' },
    ]),
    rp: new StubSource('riesgo-pais', async () => [
      { key: 'riesgo-pais', value: 1050, referenceDate: '2026-08-09' },
    ]),
    ipc: new StubSource('ipc', async () => [
      { key: 'ipc-mensual', value: -0.1, referenceDate: '2026-06' },
    ]),
  };
}

function makeEnv(sources: StubSet): TestEnv {
  return createTestApp(T0, { indicatorSources: [sources.fx, sources.bcra, sources.rp, sources.ipc] });
}

let env: TestEnv | null = null;
afterEach(() => env?.cleanup());

describe('GET /api/v1/indicators (EI-1, EI-4, EI-5)', () => {
  it('returns 9 fresh views after a successful refresh, without fetching', async () => {
    const stubs = makeSources();
    env = makeEnv(stubs);
    await request(env.app).post('/api/v1/indicators/refresh');

    const res = await request(env.app).get('/api/v1/indicators');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(9);
    for (const item of res.body) {
      expect(item.status).toBe('fresh');
      expect(item.stale).toBe(false);
      expect(item.value).not.toBeNull();
      expect(item.unit).toBeTruthy();
      expect(item.referenceDate).toBeTruthy();
      expect(item.updatedAt).toBeTruthy();
    }
    // EI-1: GET is cache-first, zero external requests
    const callsBefore = Object.values(stubs).reduce((n, s) => n + s.calls, 0);
    await request(env.app).get('/api/v1/indicators');
    expect(Object.values(stubs).reduce((n, s) => n + s.calls, 0)).toBe(callsBefore);
    // EI-5: timestamps are AR -03:00 instants
    expect(res.body[0].updatedAt).toMatch(/-03:00$/);
    expect(res.body.find((i: { key: string }) => i.key === 'ipc-mensual')).toMatchObject({
      value: -0.1,
      referenceDate: '2026-06',
      unit: '%',
    });
  });

  it('returns absent views with null values on an empty cache', async () => {
    const stubs = makeSources();
    env = makeEnv(stubs);
    const res = await request(env.app).get('/api/v1/indicators');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(9);
    for (const item of res.body) {
      expect(item.status).toBe('absent');
      expect(item.value).toBeNull();
      expect(item.updatedAt).toBeNull();
      expect(item.unit).toBeTruthy();
    }
    expect(Object.values(stubs).reduce((n, s) => n + s.calls, 0)).toBe(0);
  });

  it('serves expired snapshots as stale with the last successful updatedAt', async () => {
    const stubs = makeSources();
    env = makeEnv(stubs);
    env.db
      .prepare(
        `INSERT INTO indicator_snapshots (key, value, unit, reference_date, fetched_at, source)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run('usd-blue', 1350.5, 'ARS/USD', '2026-08-09', '2026-08-09T23:00:00.000Z', 'fx');

    const res = await request(env.app).get('/api/v1/indicators');

    const blue = res.body.find((i: { key: string }) => i.key === 'usd-blue');
    expect(blue).toMatchObject({
      value: 1350.5,
      status: 'stale',
      stale: true,
      updatedAt: '2026-08-09T20:00:00-03:00',
    });
  });
});

describe('POST /api/v1/indicators/refresh (EI-2, EI-3)', () => {
  it('reports updated per class and then cached within TTL', async () => {
    const stubs = makeSources();
    env = makeEnv(stubs);

    const first = await request(env.app).post('/api/v1/indicators/refresh');
    expect(first.status).toBe(200);
    expect(first.body.results.map((r: { class: string }) => r.class)).toEqual([
      'fx',
      'bcra',
      'riesgo-pais',
      'ipc',
    ]);
    expect(first.body.results.every((r: { status: string }) => r.status === 'updated')).toBe(true);

    // EI-3: within TTL (same clock) a non-forced refresh skips all classes
    const second = await request(env.app).post('/api/v1/indicators/refresh');
    expect(second.body.results.every((r: { status: string }) => r.status === 'cached')).toBe(true);
    expect(Object.values(stubs).reduce((n, s) => n + s.calls, 0)).toBe(4);
  });

  it('force=true bypasses TTL and refetches every class', async () => {
    const stubs = makeSources();
    env = makeEnv(stubs);
    await request(env.app).post('/api/v1/indicators/refresh');

    const res = await request(env.app).post('/api/v1/indicators/refresh?force=true');

    expect(res.body.results.every((r: { status: string }) => r.status === 'updated')).toBe(true);
    expect(Object.values(stubs).reduce((n, s) => n + s.calls, 0)).toBe(8);
  });

  it('isolates a failing source: failed class keeps its prior cache (EI-2)', async () => {
    const stubs = makeSources();
    env = makeEnv(stubs);
    await request(env.app).post('/api/v1/indicators/refresh');
    stubs.bcra.fetch = async () => Promise.reject(new Error('bcra down'));

    const res = await request(env.app).post('/api/v1/indicators/refresh?force=true');

    const bcra = res.body.results.find((r: { class: string }) => r.class === 'bcra');
    expect(bcra.status).toBe('failed');
    expect(bcra.error).toBe('bcra down');
    expect(res.body.results.filter((r: { status: string }) => r.status === 'failed')).toHaveLength(1);
    // prior cache kept
    const get = await request(env.app).get('/api/v1/indicators');
    expect(get.body.find((i: { key: string }) => i.key === 'reservas').value).toBe(28000);
  });

  it('all sources down: 200 with all classes failed, GET keeps serving (EI-4)', async () => {
    const stubs = makeSources();
    env = makeEnv(stubs);
    await request(env.app).post('/api/v1/indicators/refresh');
    for (const s of Object.values(stubs)) {
      s.fetch = async () => Promise.reject(new Error('down'));
    }

    const res = await request(env.app).post('/api/v1/indicators/refresh?force=true');

    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(4);
    expect(res.body.results.every((r: { status: string }) => r.status === 'failed')).toBe(true);
    const get = await request(env.app).get('/api/v1/indicators');
    expect(get.body.find((i: { key: string }) => i.key === 'usd-blue').value).toBe(1350.5);
  });

  it('wrong method on the refresh path yields the error envelope', async () => {
    const stubs = makeSources();
    env = makeEnv(stubs);
    const res = await request(env.app).get('/api/v1/indicators/refresh');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Route not found', details: [] } });
  });
});
