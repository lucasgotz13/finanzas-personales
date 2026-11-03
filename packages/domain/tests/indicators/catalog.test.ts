import { describe, expect, it } from 'vitest';
import {
  CLASS_BY_KEY,
  GROUP_BY_KEY,
  GROUP_ORDER,
  KEYS,
  REFERENCE_MAX_AGE_MS,
  TTL_BY_CLASS,
  UNIT_BY_KEY,
} from '../../src/indicators/catalog';

describe('indicators catalog (EI-1, EI-3, EI-6)', () => {
  it('exposes the 15 indicator keys in stable order, market group first', () => {
    expect(KEYS).toEqual([
      'usd-blue',
      'usd-oficial',
      'usd-tarjeta',
      'usd-mep',
      'usd-ccl',
      'riesgo-pais',
      'reservas',
      'badlar',
      'brent',
      'wti',
      'ipc-mensual',
      'ipc-interanual',
      'canasta-basica-total',
      'salarios-variacion',
      'emae-variacion',
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
      'ipc-interanual': '%',
      'canasta-basica-total': 'ARS',
      'salarios-variacion': '%',
      'emae-variacion': '%',
      reservas: 'millones USD',
      badlar: '% TNA',
      brent: 'USD/bbl',
      wti: 'USD/bbl',
    });
  });

  it('classifies every key into its refresh class', () => {
    expect(CLASS_BY_KEY).toEqual({
      'usd-blue': 'fx',
      'usd-oficial': 'fx',
      'usd-tarjeta': 'fx',
      'usd-mep': 'fx',
      'usd-ccl': 'fx',
      'riesgo-pais': 'riesgo-pais',
      'ipc-mensual': 'ipc',
      'ipc-interanual': 'ipc',
      'canasta-basica-total': 'indec-canastas',
      'salarios-variacion': 'indec-salarios',
      'emae-variacion': 'indec-emae',
      reservas: 'bcra',
      badlar: 'bcra',
      brent: 'oil',
      wti: 'oil',
    });
  });

  it('splits the keys into the two display groups, market first (EI-6)', () => {
    expect(GROUP_ORDER).toEqual(['mercado', 'economia']);
    const market = KEYS.filter((key) => GROUP_BY_KEY[key] === 'mercado');
    const economy = KEYS.filter((key) => GROUP_BY_KEY[key] === 'economia');
    expect(market).toHaveLength(10);
    expect(economy).toEqual([
      'ipc-mensual',
      'ipc-interanual',
      'canasta-basica-total',
      'salarios-variacion',
      'emae-variacion',
    ]);
  });

  it('defines per-class TTLs: fx 5 min, oil 10 min, bcra/riesgo-pais 24 h, ipc and INDEC series 12 h (EI-3)', () => {
    expect(TTL_BY_CLASS).toEqual({
      fx: 5 * 60_000,
      bcra: 24 * 60 * 60_000,
      'riesgo-pais': 24 * 60 * 60_000,
      ipc: 12 * 60 * 60_000,
      oil: 10 * 60_000,
      'indec-canastas': 12 * 60 * 60_000,
      'indec-salarios': 12 * 60 * 60_000,
      'indec-emae': 12 * 60 * 60_000,
    });
  });

  it('caps the oil reference age at 4 days to clear the futures weekend gap (issue #29)', () => {
    expect(REFERENCE_MAX_AGE_MS.oil).toBe(4 * 24 * 60 * 60_000);
  });

  it('tolerates the slower INDEC publish lag: 90 days monthly, 120 days wages/activity (issue #29)', () => {
    expect(REFERENCE_MAX_AGE_MS['indec-canastas']).toBe(90 * 24 * 60 * 60_000);
    expect(REFERENCE_MAX_AGE_MS['indec-salarios']).toBe(120 * 24 * 60 * 60_000);
    expect(REFERENCE_MAX_AGE_MS['indec-emae']).toBe(120 * 24 * 60 * 60_000);
  });
});
