import { Fragment, lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { api, translateApiMessage } from '../api';
import { formatDate } from '../dates';
import ConfirmPrompt from '../components/ConfirmPrompt';
import TradeForm from '../components/TradeForm';
import { useApi } from '../hooks/useApi';
import type { PositionView, SeriesCurrency, SeriesRange, Trade } from '../types';

const PortfolioChart = lazy(() => import('../components/PortfolioChart'));
const AssetChart = lazy(() => import('../components/AssetChart'));

/** PI-5: TTL-respecting auto-refresh cadence while the tab is active. */
const AUTO_REFRESH_MS = 5 * 60_000;

/** PC-4: cache warm-up ranges — one force=true fetch per range and currency per warm-up. */
const WARM_UP_RANGES: SeriesRange[] = ['1m', '3m', '6m', '1y'];
const WARM_UP_CURRENCIES: SeriesCurrency[] = ['ARS', 'USD'];

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

function realizedLabel(minor: number | null): string {
  return minor !== null && minor < 0 ? 'Pérdida' : 'Ganancia';
}

/** Honest neutrality: no Ganancia/Pérdida badge rides an exact-zero result. */
function showRealizedBadge(minor: number | null): boolean {
  return minor !== null && minor !== 0;
}

function errorText(err: unknown): string {
  return translateApiMessage(err instanceof Error ? err.message : 'No se pudo actualizar. Verifique su conexión e intente de nuevo.');
}

interface TradeGroup {
  ticker: string;
  rows: Trade[]; // date desc within the group
}

function groupTrades(trades: Trade[]): TradeGroup[] {
  const byTicker = new Map<string, Trade[]>();
  for (const trade of trades) {
    const rows = byTicker.get(trade.ticker) ?? [];
    rows.push(trade);
    byTicker.set(trade.ticker, rows);
  }
  return [...byTicker.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([ticker, rows]) => ({
      ticker,
      rows: [...rows].sort((a, b) => (a.date === b.date ? b.id - a.id : a.date < b.date ? 1 : -1)),
    }));
}

/** Portfolio tab (PI-6, TH-6): money-first summary with realized P&L, trade
 * ledger grouped per asset with inline confirms, read-only derived positions
 * and a visibility-gated 5-min auto-refresh. `active` gates every fetch and
 * effect on the tab being open; `activated` latches on the first activation
 * so the lazy chart chunks and their state persist across tab switches. */
export default function InvestmentsPage({ active = true }: { active?: boolean }): JSX.Element {
  const [tick, setTick] = useState(0);
  const portfolio = useApi(() => api.getPortfolio(), [tick], active);
  const trades = useApi(() => api.listTrades(), [tick], active);
  const [activated, setActivated] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  // A background refresh failure is news, not an alarm: only errors the user
  // caused by pressing Refrescar keep the assertive role="alert" (S12).
  const [refreshErrorIsManual, setRefreshErrorIsManual] = useState(false);
  const [editing, setEditing] = useState<Trade | null>(null);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Latch: once activated, the charts stay mounted across tab switches.
  useEffect(() => {
    if (active) setActivated(true);
  }, [active]);

  // PC-4 warm-up: on activation and every visibilitychange→visible, force one
  // fetch per range and currency so renders stay cache-first. Bounded by the
  // activation + visibility gating — no timers, no repeated fetches while the
  // tab stays open.
  useEffect(() => {
    if (!active) return;
    const warmUp = (): void => {
      for (const range of WARM_UP_RANGES) {
        for (const currency of WARM_UP_CURRENCIES) {
          void api.getPortfolioHistory(range, currency, true).catch(() => undefined);
        }
      }
    };
    const onVisibilityChange = (): void => {
      if (document.visibilityState === 'visible') warmUp();
    };
    if (!document.hidden) warmUp();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [active]);

  // Auto-refresh every 5 min while the document is visible and the tab is
  // active (PI-5): pauses in hidden tabs and on tab switches, catches up once
  // on visibilitychange back to visible.
  useEffect(() => {
    if (!active) return;
    let intervalId: ReturnType<typeof setInterval> | undefined;
    const tickRefresh = (): void => {
      void api
        .refreshPortfolio(false)
        .then(
          () => setRefreshError(null),
          (err: unknown) => {
            setRefreshErrorIsManual(false);
            setRefreshError(errorText(err));
          },
        )
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
  }, [active]);

  const manualRefresh = async (): Promise<void> => {
    setRefreshing(true);
    setRefreshError(null);
    try {
      await api.refreshPortfolio(true);
    } catch (err) {
      setRefreshErrorIsManual(true);
      setRefreshError(errorText(err));
    } finally {
      setRefreshing(false);
      setTick((t) => t + 1);
    }
  };

  const confirmDelete = async (): Promise<void> => {
    if (confirmingId === null) return;
    try {
      await api.deleteTrade(confirmingId);
      setConfirmingId(null);
      setDeleteError(null);
      setTick((t) => t + 1);
    } catch (err) {
      setDeleteError(errorText(err));
    }
  };

  // Two-tap stays (same as TransactionList/CategoryTree): when the prompt
  // opens, focus lands on Borrar so Enter confirms.
  const confirmRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (confirmingId !== null) confirmRef.current?.focus();
  }, [confirmingId]);

  const totals = portfolio.data?.totals ?? null;
  const positions: PositionView[] = portfolio.data?.positions ?? [];
  const groups = useMemo(() => groupTrades(trades.data ?? []), [trades.data]);
  const startEdit = (trade: Trade): void => {
    setConfirmingId(null);
    setDeleteError(null);
    setEditing(trade);
  };
  const toggleExpand = (id: number): void => {
    setExpandedId((current) => (current === id ? null : id));
  };

  return (
    <section>
      <div className="indicators-header">
        <h2>Inversiones — Mi cartera</h2>
        <button type="button" className="primary" onClick={() => void manualRefresh()} disabled={refreshing} data-testid="portfolio-refresh">
          {refreshing ? 'Actualizando…' : 'Refrescar'}
        </button>
      </div>
      {refreshError && (
        <div className="error-box" role={refreshErrorIsManual ? 'alert' : 'status'} data-testid="refresh-error">
          {refreshError}
        </div>
      )}
      {portfolio.error && (
        <div className="error-box" role="alert">
          {portfolio.error}{' '}
          <button type="button" className="link" data-testid="retry-portfolio" onClick={() => portfolio.reload()}>
            Reintentar
          </button>
        </div>
      )}
      {activated ? (
        <Suspense fallback={<div className="empty">Cargando…</div>}>
          <PortfolioChart />
        </Suspense>
      ) : null}
      {portfolio.loading && portfolio.data === null ? (
        <div className="empty">Cargando…</div>
      ) : (
        <>
          <section className="card money-card" data-testid="portfolio-summary">
            <h2>Valor de la cartera</h2>
            <div className="totals">
              <div className="total">
                <span className="total-currency">
                  ARS (CCL){' '}
                  {portfolio.data?.ccStatus === 'stale' && <span className="stale-badge">Vencido</span>}
                </span>
                <span className="total-amount">{money(totals?.valueArsMinor ?? null, 'ARS')}</span>
              </div>
              <div className="total">
                <span className="total-currency">USD</span>
                <span className="total-amount">{money(totals?.valueUsdMinor ?? null, 'USD')}</span>
              </div>
              <div className="total">
                <span className="total-currency">Resultados</span>
                <span className="total-amount">
                  {money(totals?.pnlUsdMinor ?? null, 'USD')} <span className={badgeClass(totals?.pnlUsdMinor ?? null)}>{pct(totals?.pnlPct ?? null)}</span>
                </span>
              </div>
              <div className="total">
                <span className="total-currency">Realizado</span>
                <span className="total-amount" data-testid="realized-total">
                  {money(totals?.realizedUsdMinor ?? 0, 'USD')}{' '}
                  {showRealizedBadge(totals?.realizedUsdMinor ?? 0) && (
                    <span className={badgeClass(totals?.realizedUsdMinor ?? 0)}>{realizedLabel(totals?.realizedUsdMinor ?? 0)}</span>
                  )}
                </span>
              </div>
            </div>
          </section>
          <section className="card">
            <h2>{editing ? 'Editar operación' : 'Registrar operación'}</h2>
            <TradeForm
              key={editing?.id ?? 'create'}
              initial={editing ?? undefined}
              onSaved={() => {
                setEditing(null);
                setTick((t) => t + 1);
              }}
              onCancel={() => setEditing(null)}
            />
          </section>
          <section className="card">
            <h2>Operaciones</h2>
            {trades.error && (
              <div className="error-box" role="alert">
                {trades.error}{' '}
                <button type="button" className="link" data-testid="retry-trades" onClick={() => trades.reload()}>
                  Reintentar
                </button>
              </div>
            )}
            {deleteError && <div className="error-box" role="alert">{deleteError}</div>}
            {trades.loading && trades.data === null ? (
              <div className="empty">Cargando…</div>
            ) : groups.length === 0 ? (
              <div className="empty" data-testid="trades-empty">Aún no hay operaciones — registre la primera con el formulario.</div>
            ) : (
              groups.map((group) => {
                const realized = positions.find((p) => p.ticker === group.ticker)?.realizedUsdMinor ?? 0;
                return (
                  <div key={group.ticker} className="trade-group" data-testid={`trade-group-${group.ticker}`}>
                    <div className="trade-group-header">
                      <span className="trade-group-ticker">{group.ticker}</span>
                      <span className="money">
                        Realizado: {money(realized, 'USD')}{' '}
                        {showRealizedBadge(realized) && <span className={badgeClass(realized)}>{realizedLabel(realized)}</span>}
                      </span>
                    </div>
                    <table className="data">
                      <thead>
                        <tr><th>Tipo</th><th>Fecha</th><th>Cantidad</th><th>Precio</th><th>Opciones</th></tr>
                      </thead>
                      <tbody>
                        {group.rows.map((trade) => (
                          <tr key={trade.id} data-testid={`trade-${trade.id}`}>
                            <td>{trade.type === 'buy' ? 'Compra' : 'Venta'}</td>
                            <td>{formatDate(trade.date)}</td>
                            <td className="money">{trade.quantity}</td>
                            <td className="money">{money(trade.priceMinor, 'USD')}</td>
                            <td className="row-actions actions-cell">
                              <button type="button" className="link muted" onClick={() => startEdit(trade)}>Editar</button>
                              {confirmingId === trade.id ? (
                                <ConfirmPrompt
                                  question="¿Borrar la operación?"
                                  note="Se recalculan las posiciones y el resultado realizado."
                                  confirmLabel="Borrar"
                                  confirmRef={confirmRef}
                                  onConfirm={() => void confirmDelete()}
                                  onCancel={() => setConfirmingId(null)}
                                />
                              ) : (
                                <button type="button" className="danger" onClick={() => setConfirmingId(trade.id)}>Borrar</button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })
            )}
          </section>
          <section className="card">
            <h2>Posiciones</h2>
            {positions.length === 0 ? (
              <div className="empty" data-testid="portfolio-empty">Aún no hay posiciones — registre su primera operación.</div>
            ) : (
              <table className="data" data-testid="positions-table">
                <thead>
                  <tr><th>Ticker</th><th>Cantidad</th><th>Precio</th><th>Valor USD</th><th>Valor ARS</th><th>Resultados</th><th>Estado</th></tr>
                </thead>
                <tbody>
                  {positions.map((v) => (
                    <Fragment key={v.id}>
                      <tr
                        className="positions-row"
                        data-testid={`position-${v.id}`}
                        aria-expanded={expandedId === v.id}
                        tabIndex={0}
                        onClick={() => toggleExpand(v.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            toggleExpand(v.id);
                          }
                        }}
                      >
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
                      </tr>
                      {expandedId === v.id && (
                        <tr className="asset-chart-row" data-testid={`asset-chart-row-${v.id}`}>
                          <td colSpan={7}>
                            <Suspense fallback={<div className="empty">Cargando…</div>}>
                              <AssetChart positionId={v.id} ticker={v.ticker} />
                            </Suspense>
                          </td>
                        </tr>
                      )}
                    </Fragment>
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
