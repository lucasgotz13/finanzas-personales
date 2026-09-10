import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import SeriesChart, { compareSelection, formatComparePct } from '../SeriesChart';

const points = [
  { date: '2026-06-06', valueMinor: 100000 },
  { date: '2026-06-13', valueMinor: 110000 },
  { date: '2026-06-20', valueMinor: 105000 },
  { date: '2026-06-27', valueMinor: 120000 },
  { date: '2026-07-04', valueMinor: 130000 },
];

describe('compareSelection (pure delta)', () => {
  it('computes absolute delta and ratio from valueMinor', () => {
    expect(compareSelection(points, 0, 4)).toEqual({ startIdx: 0, endIdx: 4, deltaMinor: 30000, pct: 0.3 });
  });

  it('normalizes reversed ends into data order', () => {
    expect(compareSelection(points, 4, 1)).toEqual({
      startIdx: 1,
      endIdx: 4,
      deltaMinor: 20000,
      pct: 20000 / 110000,
    });
  });

  it('returns null when both ends land on one point or data is too short', () => {
    expect(compareSelection(points, 2, 2)).toBeNull();
    expect(compareSelection([points[0]], 0, 0)).toBeNull();
    expect(compareSelection([], 0, 1)).toBeNull();
  });

  it('returns a null pct on a zero base instead of dividing', () => {
    const zeroBase = [
      { date: '2026-06-06', valueMinor: 0 },
      { date: '2026-06-13', valueMinor: 5000 },
    ];
    expect(compareSelection(zeroBase, 0, 1)).toEqual({ startIdx: 0, endIdx: 1, deltaMinor: 5000, pct: null });
  });
});

describe('formatComparePct', () => {
  it('signs es-AR percent figures and dashes the unknown', () => {
    expect(formatComparePct(0.3)).toBe('+30%');
    expect(formatComparePct(-0.015)).toBe('-1,5%');
    expect(formatComparePct(null)).toBe('—');
  });
});

describe('SeriesChart drag-to-compare', () => {
  // jsdom plot geometry: x < ~76 is the Y-axis gutter (resolves to no
  // point), 100 lands on the first point, 560 on the last of five.
  const LEFT = { clientX: 100, clientY: 60 };
  const RIGHT = { clientX: 560, clientY: 60 };

  function renderChart(): { wrapper: Element; rerender: (currency: 'ARS' | 'USD') => void } {
    const { rerender } = render(<SeriesChart points={points} currency="ARS" />);
    const wrapper = document.querySelector('.recharts-wrapper');
    if (wrapper === null) throw new Error('chart did not render');
    return { wrapper, rerender: (currency) => rerender(<SeriesChart points={points} currency={currency} />) };
  }

  function drag(wrapper: Element): void {
    fireEvent.mouseDown(wrapper, LEFT);
    fireEvent.mouseUp(wrapper, RIGHT);
  }

  it('commits a mouse drag across two points with an es-AR role=status readout', () => {
    const { wrapper } = renderChart();
    drag(wrapper);

    const readout = screen.getByTestId('compare-readout');
    expect(readout).toHaveAttribute('role', 'status');
    // Intl separates the symbol and the figure with a non-breaking space
    // (toHaveTextContent normalizes it away, so match on textContent).
    expect(screen.getByTestId('compare-delta').textContent).toContain('+$\u00A0300,00');
    expect(screen.getByTestId('compare-delta')).toHaveTextContent('+30%');
  });

  it('supports the tap-two-points fallback without a mouse drag', () => {
    const { wrapper } = renderChart();

    fireEvent.click(wrapper, LEFT);
    expect(screen.getByTestId('compare-hint')).toHaveTextContent('Punto inicial');

    fireEvent.click(wrapper, RIGHT);
    expect(screen.getByTestId('compare-readout')).toBeInTheDocument();
    expect(screen.queryByTestId('compare-hint')).not.toBeInTheDocument();
  });

  it('clears the selection on Esc and on Limpiar selección', () => {
    const { wrapper } = renderChart();
    drag(wrapper);
    expect(screen.getByTestId('compare-readout')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('compare-readout')).not.toBeInTheDocument();

    drag(wrapper);
    fireEvent.click(screen.getByTestId('compare-clear'));
    expect(screen.queryByTestId('compare-readout')).not.toBeInTheDocument();
  });

  it('resets the selection when the series currency changes', () => {
    const { wrapper, rerender } = renderChart();
    drag(wrapper);
    expect(screen.getByTestId('compare-readout')).toBeInTheDocument();

    rerender('USD');
    expect(screen.queryByTestId('compare-readout')).not.toBeInTheDocument();
  });

  it('keeps the es-AR tooltip seam working (hover without drag selects nothing)', () => {
    renderChart();
    fireEvent.mouseMove(document.querySelector('.recharts-surface') as Element, { clientX: 300, clientY: 60 });

    expect(screen.getByTestId('chart-tooltip-value')).toBeInTheDocument();
    expect(screen.queryByTestId('compare-readout')).not.toBeInTheDocument();
  });
});
