import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { PricePoint, SeriesCurrency } from '../types';

/** El Legajo palette (PC-5): ink data line on receipt paper — hairline grid,
 * muted tick text, hairline hover cursor and an ink activeDot (never a
 * recharts default blue). Colors are painted by the CSS overrides on the
 * recharts classes (index.css), so the chart flips with the theme. */

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

/** Drag-to-compare selection between two point indices (data order). */
export interface CompareSelection {
  startIdx: number;
  endIdx: number;
  deltaMinor: number;
  pct: number | null;
}

/** Pure delta between points[a] and points[b]. Null when there is nothing to
 * compare (fewer than 2 points, or both ends on the same point — the drag
 * threshold that keeps plain hovers from becoming selections). */
export function compareSelection(points: PricePoint[], a: number, b: number): CompareSelection | null {
  if (points.length < 2) return null;
  const clamp = (i: number): number => Math.min(Math.max(Math.round(i), 0), points.length - 1);
  const startIdx = Math.min(clamp(a), clamp(b));
  const endIdx = Math.max(clamp(a), clamp(b));
  if (startIdx === endIdx) return null;
  const deltaMinor = points[endIdx].valueMinor - points[startIdx].valueMinor;
  const base = points[startIdx].valueMinor;
  return { startIdx, endIdx, deltaMinor, pct: base === 0 ? null : deltaMinor / base };
}

/** es-AR percent figure with an explicit sign (+30% / -1,5% / —). */
export function formatComparePct(pct: number | null): string {
  if (pct === null || !Number.isFinite(pct)) return '—';
  const sign = pct > 0 ? '+' : '';
  return `${sign}${(pct * 100).toLocaleString('es-AR', { maximumFractionDigits: 2 })}%`;
}

/** Minimal chart-index state (recharts may hand us null/{} off-plot). */
interface ChartIndexState {
  activeTooltipIndex?: number;
}

/** Presentational line chart for one series (PC-5): ink monotone line, hairline
 * axes, muted ticks. Animations off so jsdom renders deterministically.
 *
 * Drag-to-compare: pressing and releasing on two points (mouse or touch —
 * recharts routes touchstart/touchend through the same mouse handlers)
 * commits a selection rendered as a hairline ReferenceArea band plus an
 * es-AR readout (role=status). Taps without dragging use a two-point
 * fallback (first tap anchors, second completes). Esc, a click on empty
 * plot, or "Limpiar selección" clears. A new series (points/currency —
 * range changes always refetch into a new points array) resets. */
export default function SeriesChart({ points, currency }: SeriesChartProps): JSX.Element {
  // Stable tooltip element: recharts re-renders its content on every chart
  // update, so a fresh element per render would recreate the tooltip each time.
  const tooltipContent = useMemo(() => <ChartTooltip currency={currency} />, [currency]);
  const [selection, setSelection] = useState<CompareSelection | null>(null);
  const [tapAnchor, setTapAnchor] = useState<number | null>(null);
  const [drag, setDrag] = useState<{ anchor: number; focus: number } | null>(null);
  // Ref mirror of the in-progress drag: the window mouseup finalizer (drags
  // released outside the plot never reach the chart) reads this, not state.
  const dragRef = useRef<{ anchor: number; focus: number } | null>(null);
  // The click ending a committed drag must be swallowed so it is not
  // re-read as the first tap of the two-point fallback.
  const suppressClickRef = useRef(false);
  const emptyDownRef = useRef(false);

  const clearCompare = useCallback((): void => {
    dragRef.current = null;
    suppressClickRef.current = false;
    emptyDownRef.current = false;
    setDrag(null);
    setTapAnchor(null);
    setSelection(null);
  }, []);

  useEffect(() => {
    clearCompare();
  }, [points, currency, clearCompare]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') clearCompare();
    };
    const onWindowMouseUp = (): void => {
      const current = dragRef.current;
      if (current === null) return;
      dragRef.current = null;
      setDrag(null);
      // No click follows an outside release, so the next tap stays live.
      suppressClickRef.current = false;
      if (current.anchor !== current.focus) {
        setTapAnchor(null);
        setSelection(compareSelection(points, current.anchor, current.focus));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('mouseup', onWindowMouseUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('mouseup', onWindowMouseUp);
    };
  }, [points, clearCompare]);

  const indexOf = (state: ChartIndexState | null | undefined): number | null => {
    const raw = state?.activeTooltipIndex;
    if (typeof raw !== 'number' || !Number.isFinite(raw) || points.length === 0) return null;
    return Math.min(Math.max(Math.round(raw), 0), points.length - 1);
  };

  const handleMouseDown = (state: ChartIndexState | null): void => {
    if (points.length < 2) return;
    const idx = indexOf(state);
    if (idx === null) {
      emptyDownRef.current = true;
      return;
    }
    emptyDownRef.current = false;
    dragRef.current = { anchor: idx, focus: idx };
    setDrag({ anchor: idx, focus: idx });
  };

  const handleMouseMove = (state: ChartIndexState | null): void => {
    const current = dragRef.current;
    if (current === null) return;
    const idx = indexOf(state);
    if (idx === null || idx === current.focus) return;
    const next = { anchor: current.anchor, focus: idx };
    dragRef.current = next;
    setDrag(next);
  };

  const handleMouseUp = (state: ChartIndexState | null): void => {
    const current = dragRef.current;
    if (current === null) {
      if (emptyDownRef.current) {
        emptyDownRef.current = false;
        if (indexOf(state) === null) clearCompare();
      }
      return;
    }
    dragRef.current = null;
    setDrag(null);
    const endIdx = indexOf(state) ?? current.focus;
    if (endIdx !== current.anchor) {
      setTapAnchor(null);
      setSelection(compareSelection(points, current.anchor, endIdx));
      suppressClickRef.current = true;
    } else {
      // No movement: the click that follows drives the tap fallback.
      suppressClickRef.current = false;
    }
  };

  const handleClick = (state: ChartIndexState | null): void => {
    if (points.length < 2) return;
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if (emptyDownRef.current) {
      emptyDownRef.current = false;
      clearCompare();
      return;
    }
    const idx = indexOf(state);
    if (idx === null) {
      clearCompare();
      return;
    }
    if (tapAnchor === null) {
      setSelection(null);
      setTapAnchor(idx);
    } else if (tapAnchor !== idx) {
      setSelection(compareSelection(points, tapAnchor, idx));
      setTapAnchor(null);
    } else {
      setTapAnchor(null);
    }
  };

  const validSelection =
    selection !== null && selection.endIdx < points.length && selection.startIdx < points.length
      ? selection
      : null;
  const band =
    drag !== null && drag.anchor !== drag.focus
      ? { start: Math.min(drag.anchor, drag.focus), end: Math.max(drag.anchor, drag.focus) }
      : null;
  return (
    <div className="chart-container">
      <ResponsiveContainer width="100%" height={220}>
        <LineChart
          data={points}
          margin={{ top: 8, right: 12, bottom: 4, left: 12 }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onClick={handleClick}
        >
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={shortDate}
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            minTickGap={40}
          />
          <YAxis
            tickFormatter={formatAxisMoney}
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={64}
            domain={['auto', 'auto']}
          />
          <Tooltip
            content={tooltipContent}
            cursor={{ stroke: 'var(--hairline)', strokeWidth: 1 }}
            active={drag !== null ? false : undefined}
          />
          <Line
            type="monotone"
            dataKey="valueMinor"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: 'var(--ink)', strokeWidth: 0 }}
            isAnimationActive={false}
          />
          {band !== null && (
            <ReferenceArea
              x1={points[band.start].date}
              x2={points[band.end].date}
              fill="var(--hairline)"
              fillOpacity={0.45}
              stroke="var(--ink)"
              strokeOpacity={0.25}
            />
          )}
          {validSelection !== null && (
            <ReferenceArea
              x1={points[validSelection.startIdx].date}
              x2={points[validSelection.endIdx].date}
              fill="var(--hairline)"
              fillOpacity={0.45}
              stroke="var(--ink)"
              strokeOpacity={0.25}
            />
          )}
          {validSelection === null && tapAnchor !== null && tapAnchor < points.length && (
            <ReferenceDot
              x={points[tapAnchor].date}
              y={points[tapAnchor].valueMinor}
              r={4}
              fill="var(--ink)"
              stroke="var(--card)"
            />
          )}
        </LineChart>
      </ResponsiveContainer>
      {validSelection !== null && (
        <div className="compare-readout" role="status" data-testid="compare-readout">
          <span data-testid="compare-range">
            {longDate(points[validSelection.startIdx].date)} → {longDate(points[validSelection.endIdx].date)}
          </span>
          <span data-testid="compare-delta">
            {validSelection.deltaMinor > 0 ? '+' : ''}
            {formatChartMoney(validSelection.deltaMinor, currency)} ({formatComparePct(validSelection.pct)})
          </span>
          <button type="button" className="link" data-testid="compare-clear" onClick={clearCompare}>
            Limpiar selección
          </button>
        </div>
      )}
      {validSelection === null && tapAnchor !== null && tapAnchor < points.length && (
        <div className="compare-hint" data-testid="compare-hint">
          Punto inicial: {longDate(points[tapAnchor].date)}. Elegí otro punto para comparar.
        </div>
      )}
    </div>
  );
}
