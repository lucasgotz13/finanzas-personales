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
});
