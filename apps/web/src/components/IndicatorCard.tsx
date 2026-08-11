import { formatRefMonth } from '../dates';
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

/** Human-relative age of an ISO timestamp, e.g. "hace 5 min" (EI-6). */
export function timeAgo(iso: string, now = Date.now()): string {
  const minutes = Math.max(0, Math.floor((now - Date.parse(iso)) / 60_000));
  if (minutes < 1) return 'recién';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.floor(hours / 24)} d`;
}

function formatValue(value: number): string {
  // es-AR grouping: 1345.5 → '1.345,5' (negative and zero pass through sane).
  if (value === 0) return '0';
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(value);
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
        {indicator.updatedAt ? `actualizado ${timeAgo(indicator.updatedAt)}` : 'sin datos aún'}
      </div>
      {indicator.referenceDate && <div className="indicator-ref">ref {formatRefMonth(indicator.referenceDate)}</div>}
      {indicator.stale && <span className="stale-badge">Vencido</span>}
      {indicator.referenceAged && <span className="aged-badge">Referencia antigua</span>}
    </div>
  );
}
