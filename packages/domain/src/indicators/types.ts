/** Indicator classes: one external fetch each (EI-2). */
export type IndicatorClass =
  | 'fx'
  | 'bcra'
  | 'ipc'
  | 'riesgo-pais'
  | 'oil'
  | 'indec-canastas'
  | 'indec-salarios'
  | 'indec-emae';

/** Display groups rendered as subsections inside the Indicadores tab (EI-6). */
export type IndicatorGroup = 'mercado' | 'economia';

export type IndicatorKey =
  | 'usd-blue'
  | 'usd-oficial'
  | 'usd-tarjeta'
  | 'usd-mep'
  | 'usd-ccl'
  | 'riesgo-pais'
  | 'reservas'
  | 'badlar'
  | 'brent'
  | 'wti'
  | 'ipc-mensual'
  | 'ipc-interanual'
  | 'canasta-basica-total'
  | 'salarios-variacion'
  | 'emae-variacion';

export type IndicatorStatus = 'fresh' | 'stale' | 'absent';

/** A fresh value as returned by a source (EI-2). */
export interface IndicatorSample {
  key: IndicatorKey;
  value: number;
  referenceDate: string;
  /**
   * Previous published reading when the source exposes one (second-latest
   * series point, previous close). Absent or null means the source supplies
   * none and the refresh carry-forward may fill it from the cached snapshot.
   */
  prevValue?: number | null;
}

/** API view of one indicator: always present with value possibly null (EI-1, EI-4). */
export interface IndicatorView {
  key: IndicatorKey;
  group: IndicatorGroup;
  value: number | null;
  unit: string;
  referenceDate: string | null;
  updatedAt: string | null;
  stale: boolean;
  status: IndicatorStatus;
  /** True when the reference date is older than the class tolerance, regardless of fetch age (issue #29). */
  referenceAged: boolean;
  /**
   * Signed percent change vs the previous published reading:
   * `(value - prevValue) / prevValue * 100`. Null when value or prevValue is
   * missing, when prevValue <= 0, and always for the variation keys
   * `ipc-mensual`, `ipc-interanual`, `salarios-variacion` and
   * `emae-variacion` (their value is already a percentage variation).
   */
  changePercent: number | null;
}

/** Cached row for one indicator key. `fetchedAt` is a UTC ISO instant. */
export interface IndicatorSnapshot {
  key: string;
  value: number;
  unit: string;
  referenceDate: string;
  fetchedAt: string;
  source: string;
  /** Previous published reading; null until one is known (first run). */
  prevValue: number | null;
}

export type IndicatorRefreshStatus = 'updated' | 'cached' | 'failed';

/** Per-class outcome of a refresh (EI-2, EI-3). */
export interface IndicatorRefreshResult {
  class: IndicatorClass;
  status: IndicatorRefreshStatus;
  error?: string;
}
