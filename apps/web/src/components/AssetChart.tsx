import { useRef, useState } from 'react';
import { api } from '../api';
import { useApi } from '../hooks/useApi';
import type { SeriesCurrency, SeriesRange } from '../types';
import SeriesChart from './SeriesChart';

const RANGES: SeriesRange[] = ['3m', '6m', '1y'];
const CURRENCIES: SeriesCurrency[] = ['ARS', 'USD'];

interface AssetChartProps {
  positionId: number;
  ticker: string;
}

/** Per-asset chart (PC-2, PC-5): inline expansion below the tapped position
 * row; the page keeps a single one open at a time. Cache-first reads. */
export default function AssetChart({ positionId, ticker }: AssetChartProps): JSX.Element {
  const [range, setRange] = useState<SeriesRange>('3m');
  const [currency, setCurrency] = useState<SeriesCurrency>('ARS');
  const forcedPairs = useRef(new Set<string>());
  const chart = useApi(() => api.getPositionHistory(positionId, range, currency), [positionId, range, currency]);

  // PC-4: same toggle-time force-once policy as the portfolio chart — one
  // force per (range, currency) pair per session, covering the warm-up race.
  const selectCurrency = (next: SeriesCurrency): void => {
    setCurrency(next);
    const key = `${range}:${next}`;
    if (!forcedPairs.current.has(key)) {
      forcedPairs.current.add(key);
      void api.getPositionHistory(positionId, range, next, true).catch(() => undefined);
    }
  };

  return (
    <section className="card asset-chart" data-testid={`asset-chart-${positionId}`}>
      <div className="chart-header">
        <h2>Evolución — {ticker}</h2>
      </div>
      <div className="chart-controls">
        <div className="chip-group" role="group" aria-label="Período">
          {RANGES.map((r) => (
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
          {CURRENCIES.map((c) => (
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
