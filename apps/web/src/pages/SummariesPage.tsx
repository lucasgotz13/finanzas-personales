import { arDateString } from '@finanzas/domain';
import { useState } from 'react';
import { api } from '../api';
import { useApi } from '../hooks/useApi';
import SummaryView from '../components/SummaryView';

/** Summaries page: month/quarter/year period picker (PS-1..5, IT-3). */
export default function SummariesPage(): JSX.Element {
  const [period, setPeriod] = useState<'month' | 'quarter' | 'year'>('month');
  const [date, setDate] = useState(arDateString(new Date()));
  const summary = useApi(() => api.getSummary(period, date), [period, date]);

  return (
    <section className="card">
      <h2>Resumen del período</h2>
      <div className="filters">
        <select value={period} onChange={(e) => setPeriod(e.target.value as 'month' | 'quarter' | 'year')} aria-label="Período">
          <option value="month">Mes</option>
          <option value="quarter">Trimestre</option>
          <option value="year">Año</option>
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
