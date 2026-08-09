import { describe, expect, it } from 'vitest';
import { arIsoString } from '../../src/vo/ar-tz';

describe('arIsoString (EI-5 timezone conversion)', () => {
  it('converts a UTC instant to America/Argentina/Buenos_Aires with fixed -03:00 offset', () => {
    // Scenario EI-5: fetched_at stored UTC 2026-08-09T23:58:00Z → 2026-08-09T20:58:00-03:00
    expect(arIsoString(new Date('2026-08-09T23:58:00.000Z'))).toBe('2026-08-09T20:58:00-03:00');
  });

  it('formats AR midnight as 00:00 (h23 hour cycle, no 24:00 overflow)', () => {
    // 2026-08-10 00:00 AR == 2026-08-10 03:00 UTC
    expect(arIsoString(new Date('2026-08-10T03:00:00.000Z'))).toBe('2026-08-10T00:00:00-03:00');
  });

  it('keeps the fixed -03:00 offset regardless of season (Argentina has no DST since 2015)', () => {
    expect(arIsoString(new Date('2026-01-15T12:30:00.000Z'))).toBe('2026-01-15T09:30:00-03:00');
  });
});
