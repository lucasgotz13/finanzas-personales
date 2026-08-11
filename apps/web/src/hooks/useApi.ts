import { useCallback, useEffect, useState } from 'react';
import { translateApiMessage } from '../api';

export interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * Plain-fetch hook (D5: no state library). Re-fetches when `deps` change;
 * `reload` re-runs the fetcher manually after mutations.
 */
export function useApi<T>(fetcher: () => Promise<T>, deps: unknown[]): ApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetcher()
      .then((result) => setData(result))
      .catch((err: unknown) => setError(translateApiMessage(err instanceof Error ? err.message : 'Error desconocido')))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, reload: () => setTick((t) => t + 1) };
}
