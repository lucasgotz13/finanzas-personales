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
 *
 * `enabled` gates the fetch: while false the hook is dormant — mount and
 * `deps` changes never call the fetcher. Flipping it true triggers the same
 * load path as a mount. `reload()` while disabled is a no-op (it neither
 * fetches nor queues a deferred reload): a dormant page cannot mutate, so
 * there is nothing to catch up on; the next activation fetches fresh anyway.
 */
export function useApi<T>(fetcher: () => Promise<T>, deps: unknown[], enabled = true): ApiState<T> {
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
    if (!enabled) return;
    load();
  }, [load, enabled]);

  return { data, loading, error, reload: () => { if (enabled) setTick((t) => t + 1); } };
}
