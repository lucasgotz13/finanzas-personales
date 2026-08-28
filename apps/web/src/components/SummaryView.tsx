import { formatMonth } from '../dates';
import type { PeriodSummary } from '../types';

export interface SummaryViewProps {
  summary: PeriodSummary;
}

function formatMinor(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency }).format(amountMinor / 100);
}

/**
 * Narrated net flow per currency: one honest sentence that never mixes
 * currencies (each is income − expense within its own unit). Currencies with
 * zero movement are skipped — silence is more honest than "+$ 0,00".
 */
function narrateFlow(summary: PeriodSummary): string {
  const parts = summary.currencies
    .filter((c) => c.income !== 0 || c.expense !== 0)
    .map((c) => `${c.netFlow < 0 ? '−' : '+'}${formatMinor(Math.abs(c.netFlow), c.currency)} ${c.currency}`);
  return parts.length > 0 ? `Flujo del período: ${parts.join(' · ')}` : '';
}

/** Per-currency totals with net flow and savings rate, plus per-category breakdown (PS-1..5, IT-3). */
export default function SummaryView({ summary }: SummaryViewProps): JSX.Element {
  return (
    <div>
      <h3>{formatMonth(summary.period)}</h3>
      {narrateFlow(summary) !== '' && <p className="summary-flow">{narrateFlow(summary)}</p>}
      <table className="data">
        <thead>
          <tr>
            <th>Moneda</th>
            <th>Gastos</th>
            <th>Ingresos</th>
            <th>Flujo neto</th>
            <th>Tasa de ahorro</th>
          </tr>
        </thead>
        <tbody>
          {summary.currencies.map((c) => (
            <tr key={c.currency}>
              <td>{c.currency}</td>
              <td className="money">{formatMinor(c.expense, c.currency)}</td>
              <td className="money">{formatMinor(c.income, c.currency)}</td>
              <td className="money">{formatMinor(c.netFlow, c.currency)}</td>
              <td>{c.savingsRate === null ? '—' : `${(c.savingsRate * 100).toFixed(1)}%`}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h4>Por categoría</h4>
      {summary.categories.length === 0 ? (
        <div className="empty">Aún no hay transacciones en este período.</div>
      ) : (
        <table className="data">
          <thead>
            <tr>
              <th>Categoría</th>
              <th>Moneda</th>
              <th>Gastos</th>
              <th>Ingresos</th>
            </tr>
          </thead>
          <tbody>
            {summary.categories.map((c) => (
              <tr key={`${c.categoryId}-${c.currency}`}>
                <td>{c.name}</td>
                <td>{c.currency}</td>
                <td className="money">{formatMinor(c.expense, c.currency)}</td>
                <td className="money">{formatMinor(c.income, c.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
