import { useEffect, useState } from 'react';
import { api, translateApiMessage } from '../api';
import IndicatorCard from '../components/IndicatorCard';
import { useApi } from '../hooks/useApi';

/** EI-6: TTL-respecting auto-refresh cadence while the tab is active. */
const AUTO_REFRESH_MS = 5 * 60_000;

function message(err: unknown): string {
  return translateApiMessage(err instanceof Error ? err.message : 'No se pudo actualizar. Verifique su conexión e intente de nuevo.');
}

/** Read-only Argentina indicators tab: cache-first GET + auto and manual refresh (EI-6). */
export default function IndicatorsPage({ active = true }: { active?: boolean }): JSX.Element {
  const [tick, setTick] = useState(0);
  const indicators = useApi(() => api.getIndicators(), [tick], active);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  // A background refresh failure is news, not an alarm: only errors the user
  // caused by pressing Refrescar keep the assertive role="alert" (S12).
  const [refreshErrorIsManual, setRefreshErrorIsManual] = useState(false);

  // Auto-refresh every 5 min while the document is visible AND the tab is
  // active. Panels stay mounted (P1), so the interval pauses in hidden tabs
  // and on tab switches, and fires once on visibilitychange back to visible.
  // The refresh is never forced: the server TTL gates the fetch, then the
  // views reload (EI-6).
  useEffect(() => {
    if (!active) return;
    let intervalId: ReturnType<typeof setInterval> | undefined;
    const tick = (): void => {
      void (async () => {
        try {
          await api.refreshIndicators(false);
          setRefreshError(null);
        } catch (err) {
          setRefreshErrorIsManual(false);
          setRefreshError(message(err));
        } finally {
          setTick((t) => t + 1);
        }
      })();
    };
    const start = (): void => {
      if (intervalId === undefined) intervalId = setInterval(tick, AUTO_REFRESH_MS);
    };
    const stop = (): void => {
      if (intervalId !== undefined) {
        clearInterval(intervalId);
        intervalId = undefined;
      }
    };
    const onVisibilityChange = (): void => {
      if (document.visibilityState === 'visible') {
        start();
        tick(); // catch up once right when the tab becomes visible again
      } else {
        stop();
      }
    };
    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [active]);

  const manualRefresh = async (): Promise<void> => {
    setRefreshing(true);
    setRefreshError(null);
    try {
      await api.refreshIndicators(true);
    } catch (err) {
      setRefreshErrorIsManual(true);
      setRefreshError(message(err));
    } finally {
      setRefreshing(false);
      setTick((t) => t + 1);
    }
  };

  return (
    <section className="indicators-page">
      <div className="indicators-header">
        <h2>Argentina — Indicadores económicos</h2>
        <button type="button" className="primary" onClick={() => void manualRefresh()} disabled={refreshing} data-testid="indicators-refresh">
          {refreshing ? 'Actualizando…' : 'Refrescar'}
        </button>
      </div>
      {refreshError && (
        <div className="error-box" role={refreshErrorIsManual ? 'alert' : 'status'} data-testid="refresh-error">
          {refreshError}
        </div>
      )}
      {indicators.error && (
        <div className="error-box" role="alert">
          {indicators.error}{' '}
          <button type="button" className="link" data-testid="retry-indicators" onClick={() => indicators.reload()}>
            Reintentar
          </button>
        </div>
      )}
      {indicators.loading && indicators.data === null ? (
        <div className="empty">Cargando…</div>
      ) : (indicators.data ?? []).length === 0 ? (
        <div className="empty">Aún no hay indicadores — presione Refrescar.</div>
      ) : (
        <div className="indicators-grid" data-testid="indicators-grid">
          {(indicators.data ?? []).map((indicator) => (
            <IndicatorCard key={indicator.key} indicator={indicator} />
          ))}
        </div>
      )}
    </section>
  );
}
