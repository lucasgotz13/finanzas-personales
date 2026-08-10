/** Indicator classes: one external fetch each (EI-2). */
export type IndicatorClass = 'fx' | 'bcra' | 'ipc' | 'riesgo-pais';

export type IndicatorKey =
  | 'usd-blue'
  | 'usd-oficial'
  | 'usd-tarjeta'
  | 'usd-mep'
  | 'usd-ccl'
  | 'riesgo-pais'
  | 'ipc-mensual'
  | 'reservas'
  | 'badlar';

export type IndicatorStatus = 'fresh' | 'stale' | 'absent';

/** A fresh value as returned by a source (EI-2). */
export interface IndicatorSample {
  key: IndicatorKey;
  value: number;
  referenceDate: string;
}

/** API view of one indicator: always present with value possibly null (EI-1, EI-4). */
export interface IndicatorView {
  key: IndicatorKey;
  value: number | null;
  unit: string;
  referenceDate: string | null;
  updatedAt: string | null;
  stale: boolean;
  status: IndicatorStatus;
  /** True when the reference date is older than the class tolerance, regardless of fetch age (issue #29). */
  referenceAged: boolean;
}

/** Cached row for one indicator key. `fetchedAt` is a UTC ISO instant. */
export interface IndicatorSnapshot {
  key: string;
  value: number;
  unit: string;
  referenceDate: string;
  fetchedAt: string;
  source: string;
}

export type IndicatorRefreshStatus = 'updated' | 'cached' | 'failed';

/** Per-class outcome of a refresh (EI-2, EI-3). */
export interface IndicatorRefreshResult {
  class: IndicatorClass;
  status: IndicatorRefreshStatus;
  error?: string;
}
