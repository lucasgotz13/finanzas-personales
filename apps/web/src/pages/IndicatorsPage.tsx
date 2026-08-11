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
export default function IndicatorsPage(): JSX.Element {
  const [tick, setTick] = useState(0);
  const indicators = useApi(() => api.getIndicators(), [tick]);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  // Auto-refresh every 5 min while mounted (page unmounts with the tab):
  // non-forced refresh respects the server TTL, then reloads the views.
  useEffect(() => {
    const id = setInterval(() => {
      void (async () => {
        try {
          await api.refreshIndicators(false);
          setRefreshError(null);
        } catch (err) {
          setRefreshError(message(err));
        } finally {
          setTick((t) => t + 1);
        }
      })();
    }, AUTO_REFRESH_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const manualRefresh = async (): Promise<void> => {
    setRefreshing(true);
    setRefreshError(null);
    try {
      await api.refreshIndicators(true);
    } catch (err) {
      setRefreshError(message(err));
    } finally {
      setRefreshing(false);
      setTick((t) => t + 1);
    }
  };

  return (
    <section className="card">
      <div className="indicators-header">
        <h2>Argentina — Indicadores económicos</h2>
        <button type="button" onClick={() => void manualRefresh()} disabled={refreshing} data-testid="indicators-refresh">
          {refreshing ? 'Actualizando…' : 'Refrescar'}
        </button>
      </div>
      {refreshError && (
        <div className="error-box" data-testid="refresh-error">
          {refreshError}
        </div>
      )}
      {indicators.error && <div className="error-box">{indicators.error}</div>}
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
