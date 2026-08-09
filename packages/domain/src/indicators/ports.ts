import type { IndicatorClass, IndicatorSample, IndicatorSnapshot } from './types';

/** External source of fresh samples for one indicator class (EI-2). */
export interface IndicatorSource {
  readonly class: IndicatorClass;
  fetch(): Promise<IndicatorSample[]>;
}

/** Snapshot store keyed by indicator key (EI-1). */
export interface IndicatorCache {
  get(key: string): Promise<IndicatorSnapshot | null>;
  set(snapshot: IndicatorSnapshot): Promise<void>;
}
