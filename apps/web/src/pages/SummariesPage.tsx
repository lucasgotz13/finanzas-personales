import { arDateString } from '@finanzas/domain';
import { useState } from 'react';
import { api } from '../api';
import { useApi } from '../hooks/useApi';
import SummaryView from '../components/SummaryView';

const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

/** Last 24 months up to `today` (YYYY-MM-DD), plus `selected` (YYYY-MM) if outside that range. */
function monthOptions(today: string, selected: string): { value: string; label: string }[] {
  let y = Number(today.slice(0, 4));
  let m = Number(today.slice(5, 7));
  const values: string[] = [];
  for (let i = 0; i < 24; i++) {
    values.push(`${y}-${String(m).padStart(2, '0')}`);
    if (--m === 0) {
      m = 12;
      y--;
    }
  }
  if (!values.includes(selected)) values.push(selected);
  return values.map((value) => ({ value, label: `${MONTH_NAMES[Number(value.slice(5, 7)) - 1]} ${value.slice(0, 4)}` }));
}

/** Reference date for a YYYY-MM month: its last day, capped at `today`. */
function monthReferenceDate(month: string, today: string): string {
  const last = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).toISOString().slice(0, 10);
  return last > today ? today : last;
}

/** Summaries page: month/quarter/year period picker (PS-1..5, IT-3). */
export default function SummariesPage({ active = true }: { active?: boolean }): JSX.Element {
  const [period, setPeriod] = useState<'month' | 'quarter' | 'year'>('month');
  const today = arDateString(new Date());
  const [date, setDate] = useState(today);
  const summary = useApi(() => api.getSummary(period, date), [period, date], active);

  return (
    <section className="card">
      <h2>Resumen del período</h2>
      <div className="filters">
        <select value={period} onChange={(e) => setPeriod(e.target.value as 'month' | 'quarter' | 'year')} aria-label="Período">
          <option value="month">Mes</option>
          <option value="quarter">Trimestre</option>
          <option value="year">Año</option>
        </select>
        <select
          value={date.slice(0, 7)}
          onChange={(e) => setDate(monthReferenceDate(e.target.value, today))}
          aria-label="Mes"
        >
          {monthOptions(today, date.slice(0, 7)).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Fecha de referencia" />
      </div>
      {summary.error && (
        <div className="error-box" role="alert">
          {summary.error}{' '}
          <button type="button" className="link" data-testid="retry-summary" onClick={() => summary.reload()}>
            Reintentar
          </button>
        </div>
      )}
      {summary.loading ? (
        <div className="empty">Cargando…</div>
      ) : summary.data ? (
        <SummaryView summary={summary.data} />
      ) : (
        !summary.error && <div className="empty">Aún no hay resúmenes para este período.</div>
      )}
    </section>
  );
}
