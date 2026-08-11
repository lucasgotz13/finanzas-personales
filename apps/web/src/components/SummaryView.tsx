import type { PeriodSummary } from '../types';

export interface SummaryViewProps {
  summary: PeriodSummary;
}

function formatMinor(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency }).format(amountMinor / 100);
}

/** Per-currency totals with net flow and savings rate, plus per-category breakdown (PS-1..5, IT-3). */
export default function SummaryView({ summary }: SummaryViewProps): JSX.Element {
  return (
    <div>
      <h3>{summary.period}</h3>
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
              <td>{formatMinor(c.expense, c.currency)}</td>
              <td>{formatMinor(c.income, c.currency)}</td>
              <td>{formatMinor(c.netFlow, c.currency)}</td>
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
                <td>{formatMinor(c.expense, c.currency)}</td>
                <td>{formatMinor(c.income, c.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
