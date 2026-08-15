import { useRef, useState } from 'react';
import { api } from '../api';
import { useApi } from '../hooks/useApi';
import type { SeriesCurrency, SeriesRange } from '../types';
import SeriesChart from './SeriesChart';

const RANGES: SeriesRange[] = ['1m', '3m', '6m', '1y'];
const CURRENCIES: SeriesCurrency[] = ['ARS', 'USD'];

/** Portfolio curve card (PC-5, PC-6): range chips + ARS/USD toggle, ink line,
 * es-AR tooltip and the always-visible honesty note. Cache-first reads only;
 * the page runs the force=true warm-up. */
export default function PortfolioChart(): JSX.Element {
  const [range, setRange] = useState<SeriesRange>('3m');
  const [currency, setCurrency] = useState<SeriesCurrency>('ARS');
  const forcedPairs = useRef(new Set<string>());
  const chart = useApi(() => api.getPortfolioHistory(range, currency), [range, currency]);

  // PC-4: the first time the user lands on a (range, currency) pair, force one
  // fetch so the CCL-dependent series gets cached even if the warm-up has not
  // completed. The Set bounds it to a single force per pair per session.
  const selectCurrency = (next: SeriesCurrency): void => {
    setCurrency(next);
    const key = `${range}:${next}`;
    if (!forcedPairs.current.has(key)) {
      forcedPairs.current.add(key);
      void api.getPortfolioHistory(range, next, true).catch(() => undefined);
    }
  };

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
          {RANGES.map((r) => (
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
          {CURRENCIES.map((c) => (
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
