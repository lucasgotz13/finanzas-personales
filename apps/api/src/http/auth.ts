import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Clock } from '@finanzas/domain';
import { ValidationError } from '@finanzas/domain';
import type { RequestHandler, Router } from 'express';
import { Router as createRouter } from 'express';
import { HttpError, wrap } from './errors';

export const COOKIE_NAME = 'finanzas_session';
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const REMEMBER_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const MAX_LOGIN_FAILURES = 5;
const LOCKOUT_MS = 60 * 1000;

/** Fail-closed at boot: production refuses to run without a strong passphrase. */
export function validateProductionConfig(passphrase: string | undefined): void {
  if (process.env.NODE_ENV !== 'production') return;
  if (passphrase === undefined || passphrase.length < 12) {
    throw new Error('FINANZAS_AUTH_PASSPHRASE is required in production and must be at least 12 characters');
  }
}

function hmac(passphrase: string, payload: string): string {
  return createHmac('sha256', passphrase).update(payload).digest('base64url');
}

/** Mints a stateless token: base64url({sub,iat,exp}).signature over the passphrase. */
export function signToken(passphrase: string, now: Date, maxAgeMs: number = TOKEN_TTL_MS): string {
  const iat = Math.floor(now.getTime() / 1000);
  const exp = iat + Math.floor(maxAgeMs / 1000);
  const payload = Buffer.from(JSON.stringify({ sub: 'owner', iat, exp })).toString('base64url');
  return `${payload}.${hmac(passphrase, payload)}`;
}

/** Timing-safe signature check plus expiry check; malformed cookies fail closed. */
export function verifyToken(passphrase: string, cookieValue: string): boolean {
  const dot = cookieValue.indexOf('.');
  if (dot <= 0 || dot >= cookieValue.length - 1) return false;
  const payload = cookieValue.slice(0, dot);
  const signature = cookieValue.slice(dot + 1);
  const expected = hmac(passphrase, payload);
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return false;
  }
  let claims: { exp?: unknown } | null = null;
  try {
    claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { exp?: unknown };
  } catch {
    return false;
  }
  if (typeof claims.exp !== 'number') return false;
  return claims.exp >= Math.floor(Date.now() / 1000);
}

/** Per-IP in-memory lockout: 5 consecutive failures block for 60s; success resets. */
export interface Lockout {
  /** Throws UNAUTHORIZED while the IP is blocked; expires blocks lazily. */
  check(ip: string): void;
  recordFailure(ip: string): void;
  reset(ip: string): void;
}

export function createLockout(now: () => Date = () => new Date()): Lockout {
  const state = new Map<string, { fails: number; until: Date }>();
  return {
    check(ip) {
      const entry = state.get(ip);
      if (!entry || entry.fails < MAX_LOGIN_FAILURES) return;
      const current = now();
      if (current < entry.until) {
        const remaining = Math.ceil((entry.until.getTime() - current.getTime()) / 1000);
        throw new HttpError(
          'UNAUTHORIZED',
          'Too many failed attempts',
          [`too many failed attempts; try again in ${remaining}s`],
          'AUTH_LOCKED',
          { seconds: remaining },
        );
      }
      state.delete(ip);
    },
    recordFailure(ip) {
      const current = now();
      const entry = state.get(ip) ?? { fails: 0, until: current };
      entry.fails += 1;
      if (entry.fails >= MAX_LOGIN_FAILURES) {
        entry.until = new Date(current.getTime() + LOCKOUT_MS);
      }
      state.set(ip, entry);
    },
    reset(ip) {
      state.delete(ip);
    },
  };
}

function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0 && part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return undefined;
}

function buildCookie(value: string, maxAgeSeconds: number | undefined): string {
  const parts = [`${COOKIE_NAME}=${value}`];
  if (maxAgeSeconds !== undefined) parts.push(`Max-Age=${maxAgeSeconds}`);
  parts.push('Path=/api', 'HttpOnly', 'SameSite=Lax');
  if (process.env.NODE_ENV === 'production') parts.push('Secure');
  return parts.join('; ');
}

export interface AuthRouterDeps {
  /** Passphrase; undefined disables auth enforcement (dev convenience). */
  passphrase?: string;
  clock: Clock;
  lockout: Lockout;
}

export function createAuthRouter(deps: AuthRouterDeps): Router {
  const router = createRouter();
  const { passphrase, lockout } = deps;
  const now = (): Date => deps.clock.now();

  router.post(
    '/auth/login',
    wrap(async (req, res) => {
      const body = req.body as Record<string, unknown> | undefined;
      const submitted = typeof body?.passphrase === 'string' ? body.passphrase.trim() : '';
      if (submitted === '') {
        throw new ValidationError('Passphrase is required', ['passphrase must be a non-empty string']);
      }
      if (passphrase === undefined) {
        throw new HttpError('UNAUTHORIZED', 'Authentication is disabled', [], 'AUTH_DISABLED');
      }
      const ip = req.ip ?? 'unknown';
      lockout.check(ip);
      if (submitted !== passphrase) {
        lockout.recordFailure(ip);
        throw new HttpError('UNAUTHORIZED', 'Invalid passphrase', [], 'INVALID_PASSPHRASE');
      }
      lockout.reset(ip);
      const remember = body?.remember === true;
      res.setHeader('Set-Cookie', buildCookie(signToken(passphrase, now()), remember ? REMEMBER_MAX_AGE_SECONDS : undefined));
      res.status(204).end();
    }),
  );

  router.post(
    '/auth/logout',
    wrap(async (_req, res) => {
      res.setHeader('Set-Cookie', buildCookie('', 0));
      res.status(204).end();
    }),
  );

  router.get(
    '/auth/status',
    wrap(async (req, res) => {
      const value = readCookie(req.headers.cookie, COOKIE_NAME);
      const authenticated =
        passphrase !== undefined && value !== undefined && verifyToken(passphrase, value);
      res.json({ authenticated });
    }),
  );

  return router;
}

/** Gate for every other /api/v1 route; disabled (no passphrase) → allow all. */
export function requireAuth(passphrase: string | undefined): RequestHandler {
  return (req, _res, next) => {
    if (passphrase === undefined) {
      next();
      return;
    }
    const value = readCookie(req.headers.cookie, COOKIE_NAME);
    if (value === undefined || !verifyToken(passphrase, value)) {
      next(new HttpError('UNAUTHORIZED', 'Authentication required'));
      return;
    }
    next();
  };
}
