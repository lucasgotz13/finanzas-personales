import { describe, expect, it } from 'vitest';
import { CLASS_BY_KEY, KEYS, REFERENCE_MAX_AGE_MS, TTL_BY_CLASS, UNIT_BY_KEY } from '../../src/indicators/catalog';

describe('indicators catalog (EI-1, EI-3)', () => {
  it('exposes the 11 indicator keys in stable order', () => {
    expect(KEYS).toEqual([
      'usd-blue',
      'usd-oficial',
      'usd-tarjeta',
      'usd-mep',
      'usd-ccl',
      'riesgo-pais',
      'ipc-mensual',
      'reservas',
      'badlar',
      'brent',
      'wti',
    ]);
  });

  it('maps every key to its unit (EI-1)', () => {
    expect(UNIT_BY_KEY).toEqual({
      'usd-blue': 'ARS/USD',
      'usd-oficial': 'ARS/USD',
      'usd-tarjeta': 'ARS/USD',
      'usd-mep': 'ARS/USD',
      'usd-ccl': 'ARS/USD',
      'riesgo-pais': 'pb',
      'ipc-mensual': '%',
      reservas: 'millones USD',
      badlar: '% TNA',
      brent: 'USD/bbl',
      wti: 'USD/bbl',
    });
  });

  it('classifies the 5 FX keys as fx, brent/wti as oil, reservas/badlar as bcra', () => {
    expect(CLASS_BY_KEY).toEqual({
      'usd-blue': 'fx',
      'usd-oficial': 'fx',
      'usd-tarjeta': 'fx',
      'usd-mep': 'fx',
      'usd-ccl': 'fx',
      'riesgo-pais': 'riesgo-pais',
      'ipc-mensual': 'ipc',
      reservas: 'bcra',
      badlar: 'bcra',
      brent: 'oil',
      wti: 'oil',
    });
  });

  it('defines per-class TTLs: fx 5 min, oil 10 min, bcra 24 h, riesgo-pais 24 h, ipc 12 h (EI-3)', () => {
    expect(TTL_BY_CLASS).toEqual({
      fx: 5 * 60_000,
      bcra: 24 * 60 * 60_000,
      'riesgo-pais': 24 * 60 * 60_000,
      ipc: 12 * 60 * 60_000,
      oil: 10 * 60_000,
    });
  });

  it('caps the oil reference age at 4 days to clear the futures weekend gap (issue #29)', () => {
    expect(REFERENCE_MAX_AGE_MS.oil).toBe(4 * 24 * 60 * 60_000);
  });
});
