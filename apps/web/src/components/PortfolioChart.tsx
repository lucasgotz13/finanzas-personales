import { api } from '../api';
import { HISTORY_CURRENCIES, HISTORY_RANGES, useHistoryChart } from '../hooks/useHistoryChart';
import SeriesChart from './SeriesChart';

/** Portfolio curve card (PC-5, PC-6): range chips + ARS/USD toggle, ink line,
 * es-AR tooltip and the always-visible honesty note. Cache-first reads only;
 * the page runs the force=true warm-up. */
export default function PortfolioChart(): JSX.Element {
  const { range, setRange, currency, selectCurrency, chart } = useHistoryChart({
    fetchHistory: (fetchRange, fetchCurrency, force) =>
      force === true
        ? api.getPortfolioHistory(fetchRange, fetchCurrency, true)
        : api.getPortfolioHistory(fetchRange, fetchCurrency),
  });

  return (
    <section className="card chart-card" data-testid="portfolio-chart">
      <div className="chart-header">
        <h2>Evolución de la cartera</h2>
        <span className="honesty-note" data-testid="chart-honesty-note">
          Valores con cantidades actuales
        </span>
      </div>
      <div className="chart-controls">
        <div className="chip-group" role="group" aria-label="Período">
          {HISTORY_RANGES.map((r) => (
            <button
              key={r}
              type="button"
              data-testid={`chip-${r}`}
              className={r === range ? 'chip active' : 'chip'}
              onClick={() => setRange(r)}
            >
              {r}
            </button>
          ))}
        </div>
        <div className="chip-group" role="group" aria-label="Moneda">
          {HISTORY_CURRENCIES.map((c) => (
            <button
              key={c}
              type="button"
              data-testid={`currency-${c.toLowerCase()}`}
              className={c === currency ? 'chip active' : 'chip'}
              onClick={() => selectCurrency(c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
      {chart.error !== null && (
        <div className="error-box" data-testid="chart-error">
          {chart.error}{' '}
          <button type="button" className="link" data-testid="retry-chart" onClick={() => chart.reload()}>
            Reintentar
          </button>
        </div>
      )}
      {chart.data !== null && chart.data.degraded === true && (
        <div className="empty" data-testid="chart-degraded-note">
          Cotización CCL no disponible — mostrando {chart.data.currency}.
        </div>
      )}
      {chart.loading && chart.data === null ? (
        <div className="empty" data-testid="chart-loading">
          Cargando…
        </div>
      ) : chart.data !== null && chart.data.points.length === 0 ? (
        <div className="empty" data-testid="chart-empty">
          Sin datos históricos
        </div>
      ) : chart.data !== null ? (
        <SeriesChart points={chart.data.points} currency={chart.data.currency} />
      ) : null}
    </section>
  );
}
