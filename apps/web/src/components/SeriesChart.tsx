import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { PricePoint, SeriesCurrency } from '../types';

/** La billetera palette (PC-5): ink data line — NEVER the action green —
 * hairline grid/axes, muted tick text, paper card behind. */
const INK = '#1a1815';
const HAIRLINE = '#e8e4dc';
const MUTED = '#595959';

/** es-AR currency figure for a minor-unit value (158493 → "$ 1.584,93"). */
export function formatChartMoney(valueMinor: number, currency: SeriesCurrency): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency }).format(valueMinor / 100);
}

function formatAxisMoney(valueMinor: number): string {
  return new Intl.NumberFormat('es-AR', { notation: 'compact', maximumFractionDigits: 1 }).format(valueMinor / 100);
}

function shortDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('es-AR', { month: 'short', year: '2-digit' });
}

function longDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ payload: PricePoint }>;
  currency: SeriesCurrency;
}

/** Tabular es-AR tooltip: long date + currency-formatted figure (PC-5). */
function ChartTooltip({ active, payload, currency }: TooltipProps): JSX.Element | null {
  if (active !== true || payload === undefined || payload.length === 0) return null;
  const point = payload[0].payload;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-date">{longDate(point.date)}</div>
      <div className="chart-tooltip-value" data-testid="chart-tooltip-value">
        {formatChartMoney(point.valueMinor, currency)}
      </div>
    </div>
  );
}

interface SeriesChartProps {
  points: PricePoint[];
  currency: SeriesCurrency;
}

/** Presentational line chart for one series (PC-5): ink monotone line, hairline
 * axes, muted ticks. Animations off so jsdom renders deterministically. */
export default function SeriesChart({ points, currency }: SeriesChartProps): JSX.Element {
  return (
    <div className="chart-container">
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={points} margin={{ top: 8, right: 12, bottom: 4, left: 12 }}>
          <CartesianGrid stroke={HAIRLINE} vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={shortDate}
            stroke={HAIRLINE}
            tick={{ fill: MUTED, fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            minTickGap={40}
          />
          <YAxis
            tickFormatter={formatAxisMoney}
            stroke={HAIRLINE}
            tick={{ fill: MUTED, fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={64}
            domain={['auto', 'auto']}
          />
          <Tooltip content={<ChartTooltip currency={currency} />} />
          <Line
            type="monotone"
            dataKey="valueMinor"
            stroke={INK}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3, strokeWidth: 0 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
