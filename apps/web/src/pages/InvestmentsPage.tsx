import { useEffect, useState } from 'react';
import { api, translateApiMessage } from '../api';
import PositionForm from '../components/PositionForm';
import { useApi } from '../hooks/useApi';
import type { PositionEdit, PositionView } from '../types';

/** PI-5: TTL-respecting auto-refresh cadence while the tab is active. */
const AUTO_REFRESH_MS = 5 * 60_000;

function money(minor: number | null, currency: 'ARS' | 'USD'): string {
  return minor === null ? '—' : new Intl.NumberFormat('es-AR', { style: 'currency', currency }).format(minor / 100);
}

function pct(value: number | null): string {
  if (value === null) return '—';
  return `${value > 0 ? '+' : ''}${(value * 100).toLocaleString('es-AR', { maximumFractionDigits: 2 })}%`;
}

function badgeClass(minor: number | null): string {
  return minor !== null && minor < 0 ? 'badge over' : 'badge ok';
}

function errorText(err: unknown): string {
  return translateApiMessage(err instanceof Error ? err.message : 'No se pudo actualizar. Verifique su conexión e intente de nuevo.');
}

/** Portfolio tab (PI-6): money-first summary, positions table with freshness
 * chips, add/edit/delete form and a visibility-gated 5-min auto-refresh. */
export default function InvestmentsPage(): JSX.Element {
  const [tick, setTick] = useState(0);
  const portfolio = useApi(() => api.getPortfolio(), [tick]);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [editing, setEditing] = useState<PositionEdit | null>(null);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Auto-refresh every 5 min while the document is visible (PI-5): pauses in
  // hidden tabs and catches up once on visibilitychange back to visible.
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | undefined;
    const tickRefresh = (): void => {
      void api
        .refreshPortfolio(false)
        .then(() => setRefreshError(null), (err: unknown) => setRefreshError(errorText(err)))
        .finally(() => setTick((t) => t + 1));
    };
    const start = (): void => {
      if (intervalId === undefined) intervalId = setInterval(tickRefresh, AUTO_REFRESH_MS);
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
        tickRefresh();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const manualRefresh = async (): Promise<void> => {
    setRefreshing(true);
    setRefreshError(null);
    try {
      await api.refreshPortfolio(true);
    } catch (err) {
      setRefreshError(errorText(err));
    } finally {
      setRefreshing(false);
      setTick((t) => t + 1);
    }
  };

  const confirmDelete = async (): Promise<void> => {
    if (confirmingId === null) return;
    try {
      await api.deletePosition(confirmingId);
      setConfirmingId(null);
      setDeleteError(null);
      setTick((t) => t + 1);
    } catch (err) {
      setDeleteError(errorText(err));
    }
  };

  const totals = portfolio.data?.totals ?? null;
  const positions: PositionView[] = portfolio.data?.positions ?? [];
  const startEdit = (v: PositionView): void => {
    setConfirmingId(null);
    setDeleteError(null);
    setEditing({ id: v.id, ticker: v.ticker, quantity: v.quantity, avgCostMinor: v.avgCostMinor });
  };

  return (
    <section className="investments-page">
      <div className="indicators-header">
        <h2>Inversiones — Mi cartera</h2>
        <button type="button" className="primary" onClick={() => void manualRefresh()} disabled={refreshing} data-testid="portfolio-refresh">
          {refreshing ? 'Actualizando…' : 'Refrescar'}
        </button>
      </div>
      {refreshError && <div className="error-box" role="alert" data-testid="refresh-error">{refreshError}</div>}
      {portfolio.error && (
        <div className="error-box" role="alert">
          {portfolio.error}{' '}
          <button type="button" className="link" data-testid="retry-portfolio" onClick={() => portfolio.reload()}>
            Reintentar
          </button>
        </div>
      )}
      {portfolio.loading && portfolio.data === null ? (
        <div className="empty">Cargando…</div>
      ) : (
        <>
          <section className="card money-card" data-testid="portfolio-summary">
            <h2>Valor de la cartera</h2>
            <div className="totals">
              <div className="total">
                <span className="total-currency">{portfolio.data?.ccStatus === 'stale' ? 'ARS (CCL vencido)' : 'ARS (CCL)'}</span>
                <span className="total-amount">{money(totals?.valueArsMinor ?? null, 'ARS')}</span>
              </div>
              <div className="total">
                <span className="total-currency">USD</span>
                <span className="total-amount">{money(totals?.valueUsdMinor ?? null, 'USD')}</span>
              </div>
              <div className="total">
                <span className="total-currency">P&L</span>
                <span className="total-amount">
                  {money(totals?.pnlUsdMinor ?? null, 'USD')} <span className={badgeClass(totals?.pnlUsdMinor ?? null)}>{pct(totals?.pnlPct ?? null)}</span>
                </span>
              </div>
            </div>
          </section>
          <section className="card">
            <h2>{editing ? 'Editar posición' : 'Agregar posición'}</h2>
            <PositionForm
              key={editing?.id ?? 'create'}
              initial={editing ?? undefined}
              onCreated={() => setTick((t) => t + 1)}
              onUpdate={() => {
                setEditing(null);
                setTick((t) => t + 1);
              }}
              onCancel={() => setEditing(null)}
            />
          </section>
          <section className="card">
            <h2>Posiciones</h2>
            {deleteError && <div className="error-box" role="alert">{deleteError}</div>}
            {positions.length === 0 ? (
              <div className="empty" data-testid="portfolio-empty">Aún no hay posiciones — agregá la primera con el formulario.</div>
            ) : (
              <table className="data" data-testid="positions-table">
                <thead>
                  <tr><th>Ticker</th><th>Cantidad</th><th>Precio</th><th>Valor USD</th><th>Valor ARS</th><th>P&L</th><th>Estado</th><th>Acciones</th></tr>
                </thead>
                <tbody>
                  {positions.map((v) => (
                    <tr key={v.id} data-testid={`position-${v.id}`}>
                      <td>{v.name}<div className="tx-direction">{v.ticker}</div></td>
                      <td className="money">{v.quantity}</td>
                      <td className="money">{money(v.priceMinor, 'USD')}</td>
                      <td className="money">{money(v.valueUsdMinor, 'USD')}</td>
                      <td className="money">{money(v.valueArsMinor, 'ARS')}</td>
                      <td className="money">{money(v.pnlUsdMinor, 'USD')} <span className={badgeClass(v.pnlUsdMinor)}>{pct(v.pnlPct)}</span></td>
                      <td>
                        {v.status === 'fresh' && <span className="badge ok">Al día</span>}
                        {v.status === 'stale' && <span className="stale-badge">Vencido</span>}
                        {v.status === 'absent' && <span className="aged-badge">Sin precio</span>}
                      </td>
                      <td className="row-actions actions-cell">
                        <button type="button" className="link muted" onClick={() => startEdit(v)}>Editar</button>
                        {confirmingId === v.id ? (
                          <span className="confirm-prompt" role="alert">
                            <span className="confirm-question">¿Borrar la posición?</span>
                            <button type="button" className="danger" onClick={() => void confirmDelete()}>Borrar</button>
                            <button type="button" className="link muted" onClick={() => setConfirmingId(null)}>Cancelar</button>
                          </span>
                        ) : (
                          <button type="button" className="danger" onClick={() => setConfirmingId(v.id)}>Borrar</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </section>
  );
}
