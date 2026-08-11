import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../api';
import type { PeriodSummary } from '../../types';
import SummariesPage from '../SummariesPage';

const summary: PeriodSummary = {
  period: '2026-07',
  currencies: [
    { currency: 'ARS', expense: 600000, income: 900000, netFlow: 300000, savingsRate: 0.333 },
    { currency: 'USD', expense: 0, income: 100, netFlow: 100, savingsRate: null },
  ],
  categories: [{ categoryId: 1, name: 'Food', currency: 'ARS', expense: 600000, income: 0 }],
};

describe('SummariesPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders per-currency totals, savings rate and category rows (PS-2, PS-3, PS-4)', async () => {
    vi.spyOn(api, 'getSummary').mockResolvedValue(summary);
    render(<SummariesPage />);
    expect(await screen.findByText('2026-07')).toBeInTheDocument();
    expect(screen.getByText('$ 9.000,00')).toBeInTheDocument(); // income
    expect(screen.getByText('33.3%')).toBeInTheDocument(); // savings rate
    expect(screen.getByText('Food')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument(); // USD savings rate undefined
  });
});
