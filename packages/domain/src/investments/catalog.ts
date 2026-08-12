import { ValidationError } from '../errors';

/** Equity snapshot TTL in ms (PI-3): ≈ 5 min, the same cadence as the FX
 * indicator class. Beyond TTL a snapshot serves as `stale`; never blank. */
export const PRICE_TTL_MS = 5 * 60_000;

/** Valid ticker shape: letters/digits with at most one exchange suffix. */
const TICKER_PATTERN = /^[A-Za-z0-9]+(\.[A-Za-z0-9]+)?$/;

/**
 * Normalizes a user-entered ticker (PI-1): trims, uppercases, and appends the
 * BYMA `.BA` suffix when the ticker carries no exchange suffix. Rejects empty
 * and malformed input — v1 accepts BYMA symbols only.
 */
export function normalizeTicker(raw: string): string {
  const ticker = raw.trim().toUpperCase();
  if (ticker === '' || !TICKER_PATTERN.test(ticker)) {
    throw new ValidationError('Invalid ticker', [
      'ticker must contain only letters, digits and an optional exchange suffix',
    ]);
  }
  return ticker.includes('.') ? ticker : `${ticker}.BA`;
}
