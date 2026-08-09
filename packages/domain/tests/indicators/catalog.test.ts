import { describe, expect, it } from 'vitest';
import { CLASS_BY_KEY, KEYS, TTL_BY_CLASS, UNIT_BY_KEY } from '../../src/indicators/catalog';

describe('indicators catalog (EI-1, EI-3)', () => {
  it('exposes the 9 indicator keys in stable order', () => {
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
    });
  });

  it('classifies the 5 FX keys as fx, reservas/badlar as bcra', () => {
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
    });
  });

  it('defines per-class TTLs: fx 5 min, bcra 24 h, riesgo-pais 24 h, ipc 12 h (EI-3)', () => {
    expect(TTL_BY_CLASS).toEqual({
      fx: 5 * 60_000,
      bcra: 24 * 60 * 60_000,
      'riesgo-pais': 24 * 60 * 60_000,
      ipc: 12 * 60 * 60_000,
    });
  });
});
