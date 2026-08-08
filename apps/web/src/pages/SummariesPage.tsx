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
      <h2>Period summary</h2>
      <div className="filters">
        <select value={period} onChange={(e) => setPeriod(e.target.value as 'month' | 'quarter' | 'year')} aria-label="Period">
          <option value="month">Month</option>
          <option value="quarter">Quarter</option>
          <option value="year">Year</option>
        </select>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Reference date" />
      </div>
      {summary.error && <div className="error-box">{summary.error}</div>}
      {summary.loading ? <div className="empty">Loading…</div> : summary.data && <SummaryView summary={summary.data} />}
    </section>
  );
}
