import type { IndicatorClass, IndicatorKey } from './types';

/** All 9 indicator keys, in display order (EI-1). */
export const KEYS: readonly IndicatorKey[] = [
  'usd-blue',
  'usd-oficial',
  'usd-tarjeta',
  'usd-mep',
  'usd-ccl',
  'riesgo-pais',
  'ipc-mensual',
  'reservas',
  'badlar',
];

/** Display unit per indicator (EI-1): FX ARS/USD, riesgo país pb, IPC %, reservas millones USD, BADLAR % TNA. */
export const UNIT_BY_KEY: Record<IndicatorKey, string> = {
  'usd-blue': 'ARS/USD',
  'usd-oficial': 'ARS/USD',
  'usd-tarjeta': 'ARS/USD',
  'usd-mep': 'ARS/USD',
  'usd-ccl': 'ARS/USD',
  'riesgo-pais': 'pb',
  'ipc-mensual': '%',
  reservas: 'millones USD',
  badlar: '% TNA',
};

/** Refresh class per indicator (EI-2): one external fetch covers one class. */
export const CLASS_BY_KEY: Record<IndicatorKey, IndicatorClass> = {
  'usd-blue': 'fx',
  'usd-oficial': 'fx',
  'usd-tarjeta': 'fx',
  'usd-mep': 'fx',
  'usd-ccl': 'fx',
  'riesgo-pais': 'riesgo-pais',
  'ipc-mensual': 'ipc',
  reservas: 'bcra',
  badlar: 'bcra',
};

/** TTL per class in ms (EI-3): FX ≈ 5 min; BCRA and riesgo país ≈ daily; IPC ≈ 12 h. */
export const TTL_BY_CLASS: Record<IndicatorClass, number> = {
  fx: 5 * 60_000,
  bcra: 24 * 60 * 60_000,
  'riesgo-pais': 24 * 60 * 60_000,
  ipc: 12 * 60 * 60_000,
};
