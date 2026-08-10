import type { IndicatorView } from '../types';

const LABEL_BY_KEY: Record<string, string> = {
  'usd-blue': 'USD Blue',
  'usd-oficial': 'USD Oficial',
  'usd-tarjeta': 'USD Tarjeta',
  'usd-mep': 'USD MEP',
  'usd-ccl': 'USD CCL',
  'riesgo-pais': 'Riesgo País',
  'ipc-mensual': 'IPC Mensual',
  reservas: 'Reservas',
  badlar: 'BADLAR',
};

/** Human-relative age of an ISO timestamp, e.g. "5 min ago" (EI-6). */
export function timeAgo(iso: string, now = Date.now()): string {
  const minutes = Math.max(0, Math.floor((now - Date.parse(iso)) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} d ago`;
}

function formatValue(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/** One indicator card: label, value, unit, relative updatedAt, ref date, badges (EI-6, issue #29). */
export default function IndicatorCard({ indicator }: { indicator: IndicatorView }): JSX.Element {
  return (
    <div className={`indicator-card${indicator.stale ? ' stale' : ''}`} data-testid={`indicator-${indicator.key}`}>
      <div className="indicator-label">{LABEL_BY_KEY[indicator.key] ?? indicator.key}</div>
      <div className="indicator-value">
        {indicator.value !== null ? formatValue(indicator.value) : '—'}
        <span className="indicator-unit"> {indicator.unit}</span>
      </div>
      <div className="indicator-updated">
        {indicator.updatedAt ? `updated ${timeAgo(indicator.updatedAt)}` : 'no data yet'}
      </div>
      {indicator.referenceDate && <div className="indicator-ref">ref {indicator.referenceDate.slice(0, 7)}</div>}
      {indicator.stale && <span className="stale-badge">STALE</span>}
      {indicator.referenceAged && <span className="aged-badge">OLD REFERENCE</span>}
    </div>
  );
}
