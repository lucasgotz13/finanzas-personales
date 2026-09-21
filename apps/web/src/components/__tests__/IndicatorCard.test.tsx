import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { IndicatorView } from '../../types';
import IndicatorCard from '../IndicatorCard';

const indicator: IndicatorView = {
  key: 'usd-blue',
  value: 1350.5,
  unit: 'ARS/USD',
  referenceDate: '2026-07-31',
  updatedAt: new Date().toISOString(),
  stale: false,
  status: 'fresh',
  referenceAged: false,
  changePercent: null,
};

describe('IndicatorCard', () => {
  it('renders the reference line with the short es-AR month (ref jul 2026)', () => {
    render(<IndicatorCard indicator={indicator} />);
    expect(screen.getByText('ref jul 2026')).toBeInTheDocument();
    expect(screen.queryByText('ref 2026-07')).not.toBeInTheDocument();
  });

  it('omits the reference line when there is no reference date', () => {
    render(<IndicatorCard indicator={{ ...indicator, referenceDate: null }} />);
    expect(screen.queryByText(/^ref /)).not.toBeInTheDocument();
  });

  it('formats values with es-AR grouping (1345.5 → "1.345,5") (P3 #7)', () => {
    render(<IndicatorCard indicator={{ ...indicator, value: 1345.5 }} />);
    expect(screen.getByText('1.345,5')).toBeInTheDocument();
  });

  it('formats negative values with es-AR grouping and zero as "0" (P3 #7)', () => {
    render(<IndicatorCard indicator={{ ...indicator, value: -0.1 }} />);
    expect(screen.getByText('-0,1')).toBeInTheDocument();
    render(<IndicatorCard indicator={{ ...indicator, value: 0 }} />);
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('renders a green signed badge with 2 decimals for a positive change', () => {
    render(<IndicatorCard indicator={{ ...indicator, changePercent: 1.2987 }} />);
    const badge = screen.getByTitle('Cambio diario');
    expect(badge).toHaveTextContent('+1,30%');
    expect(badge.className).toContain('up');
  });

  it('renders a red signed badge with 2 decimals for a negative change', () => {
    render(<IndicatorCard indicator={{ ...indicator, changePercent: -0.8 }} />);
    const badge = screen.getByTitle('Cambio diario');
    expect(badge).toHaveTextContent('-0,80%');
    expect(badge.className).toContain('down');
  });

  it('renders a zero change with 2 decimals and no sign', () => {
    render(<IndicatorCard indicator={{ ...indicator, changePercent: 0 }} />);
    const badge = screen.getByTitle('Cambio diario');
    expect(badge).toHaveTextContent('0,00%');
    expect(badge.className).toContain('up');
  });

  it('hides the badge when changePercent is null', () => {
    render(<IndicatorCard indicator={{ ...indicator, changePercent: null }} />);
    expect(screen.queryByTitle('Cambio diario')).not.toBeInTheDocument();
  });

  it('hides the badge when changePercent is undefined (old API without the field)', () => {
    const { changePercent: _omitted, ...withoutChange } = indicator;
    render(<IndicatorCard indicator={withoutChange as IndicatorView} />);
    expect(screen.queryByTitle('Cambio diario')).not.toBeInTheDocument();
  });

  it('hides the badge when changePercent is NaN', () => {
    render(<IndicatorCard indicator={{ ...indicator, changePercent: NaN }} />);
    expect(screen.queryByTitle('Cambio diario')).not.toBeInTheDocument();
  });
});
