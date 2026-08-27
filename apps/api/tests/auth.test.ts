import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { validateProductionConfig } from '../src/http/auth';
import { authCookieFor, createTestApp } from './helpers';
import type { TestEnv } from './helpers';

const SECRET = 'test-passphrase-12345';
const COOKIE = 'finanzas_session';

let env: TestEnv | null = null;
afterEach(() => {
  env?.cleanup();
  env = null;
  vi.unstubAllEnvs();
});

function testApp() {
  return createTestApp(new Date('2026-08-08T12:00:00.000Z'), { authSecret: SECRET });
}

describe('POST /api/v1/auth/login', () => {
  it('logs in with the correct passphrase and sets a session cookie (204)', async () => {
    env = await testApp();
    const res = await request(env.app).post('/api/v1/auth/login').send({ passphrase: SECRET });
    expect(res.status).toBe(204);
    const cookie = res.headers['set-cookie']?.[0] ?? '';
    expect(cookie).toMatch(/^finanzas_session=/);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Path=/api');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).not.toContain('Max-Age');
  });

  it('sets Max-Age=2592000 when remember=true', async () => {
    env = await testApp();
    const res = await request(env.app).post('/api/v1/auth/login').send({ passphrase: SECRET, remember: true });
    expect(res.status).toBe(204);
    expect(res.headers['set-cookie']?.[0]).toContain('Max-Age=2592000');
  });

  it('rejects a wrong passphrase with 401 UNAUTHORIZED', async () => {
    env = await testApp();
    const res = await request(env.app).post('/api/v1/auth/login').send({ passphrase: 'wrong-passphrase' });
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ error: { code: 'UNAUTHORIZED', reason: 'INVALID_PASSPHRASE' } });
    expect(Array.isArray(res.body.error.details)).toBe(true);
  });

  it('rejects a missing passphrase with 422 VALIDATION_ERROR', async () => {
    env = await testApp();
    const res = await request(env.app).post('/api/v1/auth/login').send({});
    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
  });

  it('rejects an empty passphrase with 422 VALIDATION_ERROR', async () => {
    env = await testApp();
    const res = await request(env.app).post('/api/v1/auth/login').send({ passphrase: '   ' });
    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
  });
});

describe('login lockout (per-IP)', () => {
  it('blocks for 60s after 5 consecutive failures', async () => {
    env = await testApp();
    for (let i = 0; i < 5; i++) {
      await request(env.app).post('/api/v1/auth/login').send({ passphrase: 'wrong-passphrase' });
    }
    const res = await request(env.app).post('/api/v1/auth/login').send({ passphrase: SECRET });
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ error: { code: 'UNAUTHORIZED', reason: 'AUTH_LOCKED' } });
    expect(res.body.error.meta).toEqual({ seconds: 60 });
    expect(res.body.error.details[0]).toMatch(/too many failed attempts; try again in 60s/);
  });

  it('unlocks once the lockout window elapses', async () => {
    env = await testApp();
    for (let i = 0; i < 5; i++) {
      await request(env.app).post('/api/v1/auth/login').send({ passphrase: 'wrong-passphrase' });
    }
    env.clock.advance(61_000);
    const res = await request(env.app).post('/api/v1/auth/login').send({ passphrase: SECRET });
    expect(res.status).toBe(204);
  });

  it('resets the failure counter on a successful login', async () => {
    env = await testApp();
    for (let i = 0; i < 4; i++) {
      await request(env.app).post('/api/v1/auth/login').send({ passphrase: 'wrong-passphrase' });
    }
    await request(env.app).post('/api/v1/auth/login').send({ passphrase: SECRET });
    for (let i = 0; i < 4; i++) {
      await request(env.app).post('/api/v1/auth/login').send({ passphrase: 'wrong-passphrase' });
    }
    const res = await request(env.app).post('/api/v1/auth/login').send({ passphrase: SECRET });
    expect(res.status).toBe(204);
  });
});

describe('protected routes under /api/v1', () => {
  it('returns 401 UNAUTHORIZED without a session cookie', async () => {
    env = await testApp();
    const res = await request(env.app).get('/api/v1/transactions');
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ error: { code: 'UNAUTHORIZED' } });
  });

  it('allows requests with a valid session cookie', async () => {
    env = await testApp();
    const res = await request(env.app).get('/api/v1/transactions').set('Cookie', authCookieFor(SECRET));
    expect(res.status).toBe(200);
  });

  it('rejects a tampered cookie with 401', async () => {
    env = await testApp();
    const token = authCookieFor(SECRET).slice(`${COOKIE}=`.length);
    const [payload] = token.split('.');
    const tampered = token.replace(payload, payload.slice(0, -1) + (payload.endsWith('A') ? 'B' : 'A'));
    const res = await request(env.app).get('/api/v1/transactions').set('Cookie', `${COOKIE}=${tampered}`);
    expect(res.status).toBe(401);
  });

  it('rejects an expired token with 401', async () => {
    env = await testApp();
    const res = await request(env.app)
      .get('/api/v1/transactions')
      .set('Cookie', authCookieFor(SECRET, new Date('2020-01-01T00:00:00.000Z')));
    expect(res.status).toBe(401);
  });

  it('rejects a malformed cookie with 401', async () => {
    env = await testApp();
    const res = await request(env.app).get('/api/v1/transactions').set('Cookie', `${COOKIE}=garbage`);
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/auth/status', () => {
  it('returns authenticated: true with a valid cookie', async () => {
    env = await testApp();
    const res = await request(env.app).get('/api/v1/auth/status').set('Cookie', authCookieFor(SECRET));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ authenticated: true });
  });

  it('returns authenticated: false without a cookie', async () => {
    env = await testApp();
    const res = await request(env.app).get('/api/v1/auth/status');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ authenticated: false });
  });

  it('returns authenticated: false for an invalid cookie', async () => {
    env = await testApp();
    const res = await request(env.app).get('/api/v1/auth/status').set('Cookie', `${COOKIE}=garbage`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ authenticated: false });
  });
});

describe('POST /api/v1/auth/logout', () => {
  it('clears the cookie and subsequent requests are rejected', async () => {
    env = await testApp();
    const login = await request(env.app).post('/api/v1/auth/login').send({ passphrase: SECRET });
    expect(login.status).toBe(204);

    const res = await request(env.app).post('/api/v1/auth/logout');
    expect(res.status).toBe(204);
    const cookie = res.headers['set-cookie']?.[0] ?? '';
    expect(cookie).toMatch(/^finanzas_session=;/);
    expect(cookie).toContain('Max-Age=0');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Path=/api');

    const protectedRes = await request(env.app).get('/api/v1/transactions');
    expect(protectedRes.status).toBe(401);
  });
});

describe('validateProductionConfig', () => {
  it('throws in production when the passphrase is missing', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(() => validateProductionConfig(undefined)).toThrow(/FINANZAS_AUTH_PASSPHRASE/);
  });

  it('throws in production when the passphrase is shorter than 12 characters', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(() => validateProductionConfig('short')).toThrow(/FINANZAS_AUTH_PASSPHRASE/);
  });

  it('accepts a passphrase of exactly 12 characters in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(() => validateProductionConfig('123456789012')).not.toThrow();
  });

  it('does not throw outside production even without a passphrase', () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(() => validateProductionConfig(undefined)).not.toThrow();
  });
});

describe('auth disabled (dev convenience)', () => {
  it('does not enforce auth when no secret is configured', async () => {
    env = await createTestApp();
    const res = await request(env.app).get('/api/v1/transactions');
    expect(res.status).toBe(200);
  });

  it('rejects login with 401 when no secret is configured', async () => {
    env = await createTestApp();
    const res = await request(env.app).post('/api/v1/auth/login').send({ passphrase: 'anything' });
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ error: { code: 'UNAUTHORIZED', reason: 'AUTH_DISABLED' } });
  });
});
