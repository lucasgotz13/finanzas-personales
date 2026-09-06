import { api } from '../api';
import { HISTORY_CURRENCIES, HISTORY_RANGES, useHistoryChart } from '../hooks/useHistoryChart';
import SeriesChart from './SeriesChart';

interface AssetChartProps {
  positionId: number;
  ticker: string;
}

/** Per-asset chart (PC-2, PC-5): inline expansion below the tapped position
 * row; the page keeps a single one open at a time. Cache-first reads. */
export default function AssetChart({ positionId, ticker }: AssetChartProps): JSX.Element {
  const { range, setRange, currency, selectCurrency, chart } = useHistoryChart({
    fetchHistory: (fetchRange, fetchCurrency, force) =>
      force === true
        ? api.getPositionHistory(positionId, fetchRange, fetchCurrency, true)
        : api.getPositionHistory(positionId, fetchRange, fetchCurrency),
    extraDeps: [positionId],
  });

  return (
    <section className="card asset-chart" data-testid={`asset-chart-${positionId}`}>
      <div className="chart-header">
        <h2>Evolución — {ticker}</h2>
      </div>
      <div className="chart-controls">
        <div className="chip-group" role="group" aria-label="Período">
          {HISTORY_RANGES.map((r) => (
            <button
              key={r}
              type="button"
              data-testid={`asset-chip-${r}`}
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
              data-testid={`asset-currency-${c.toLowerCase()}`}
              className={c === currency ? 'chip active' : 'chip'}
              onClick={() => selectCurrency(c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
      {chart.error !== null && (
        <div className="error-box" data-testid={`asset-chart-error-${positionId}`}>
          {chart.error}{' '}
          <button type="button" className="link" data-testid="retry-asset-chart" onClick={() => chart.reload()}>
            Reintentar
          </button>
        </div>
      )}
      {chart.data !== null && chart.data.degraded === true && (
        <div className="empty" data-testid={`asset-chart-degraded-note-${positionId}`}>
          Cotización CCL no disponible — mostrando {chart.data.currency}.
        </div>
      )}
      {chart.loading && chart.data === null ? (
        <div className="empty" data-testid="asset-chart-loading">
          Cargando…
        </div>
      ) : chart.data !== null && chart.data.points.length === 0 ? (
        <div className="empty" data-testid={`asset-chart-empty-${positionId}`}>
          Sin datos históricos
        </div>
      ) : chart.data !== null ? (
        <SeriesChart points={chart.data.points} currency={chart.data.currency} />
      ) : null}
    </section>
  );
}
