import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import type { PositionView } from '../types';
import { formatChartMoney } from './SeriesChart';

const COLORS = ['var(--ink)', '#8b7563', '#66766b', '#a5967d', '#727b83', '#b19c89'];

export default function PortfolioAllocation({ positions }: { positions: PositionView[] }): JSX.Element {
  const entries = positions
    .filter((position) => position.valueUsdMinor !== null && position.valueUsdMinor > 0)
    .map((position) => ({ ...position, value: position.valueUsdMinor as number }))
    .sort((a, b) => b.value - a.value || a.ticker.localeCompare(b.ticker));
  const total = entries.reduce((sum, entry) => sum + entry.value, 0);
  const missing = positions.filter((position) => position.quantity > 0 && position.valueUsdMinor === null);
  const stale = entries.filter((entry) => entry.status === 'stale');

  return (
    <section className="card chart-card" aria-label="Distribución de la cartera">
      <div className="chart-header">
        <h2>Distribución de la cartera</h2>
        <span className="honesty-note">Por valor actual en USD</span>
      </div>
      {entries.length === 0 ? (
        <p className="empty">Sin posiciones con valor en USD para mostrar la distribución.</p>
      ) : (
        <div className="allocation-layout">
          <div className="allocation-plot" role="img" aria-label="Distribución por activo en USD">
            <div aria-hidden="true">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={entries} dataKey="value" nameKey="ticker" outerRadius={96} stroke="var(--card)" strokeWidth={2} isAnimationActive={false}>
                    {entries.map((entry, index) => <Cell key={entry.id} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <ul className="allocation-legend" aria-label="Participación por activo">
            {entries.map((entry, index) => (
              <li key={entry.id}>
                <span className="allocation-swatch" style={{ backgroundColor: COLORS[index % COLORS.length] }} aria-hidden="true" />
                <span className="allocation-asset"><strong>{entry.ticker}</strong><span>{entry.name}</span></span>
                <span className="allocation-value">
                  <strong>{(entry.value / total * 100).toLocaleString('es-AR', { maximumFractionDigits: 2 })}%</strong>
                  <span>{formatChartMoney(entry.value, 'USD')}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {missing.length > 0 && (
        <p className="honesty-note">Sin cotización en USD: {missing.map((entry) => entry.ticker).join(', ')}. Los porcentajes solo incluyen activos valuados.</p>
      )}
      {stale.length > 0 && (
        <p className="honesty-note">Cotizaciones vencidas: {stale.map((entry) => entry.ticker).join(', ')}.</p>
      )}
    </section>
  );
}
