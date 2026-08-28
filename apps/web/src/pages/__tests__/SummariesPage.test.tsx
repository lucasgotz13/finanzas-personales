import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
    expect(await screen.findByText('Julio 2026')).toBeInTheDocument();
    expect(screen.getByText('$ 9.000,00')).toBeInTheDocument(); // income
    expect(screen.getByText('33,3%')).toBeInTheDocument(); // savings rate (es-AR comma, S6)
    expect(screen.getByText('Food')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument(); // USD savings rate undefined
  });

  it('renders the empty state when the summary is null, loaded and error-free (P3 #11)', async () => {
    vi.spyOn(api, 'getSummary').mockResolvedValue(null as never);
    render(<SummariesPage />);

    expect(await screen.findByText('Aún no hay resúmenes para este período.')).toBeInTheDocument();
    expect(screen.queryByText('Cargando…')).not.toBeInTheDocument();
  });

  it('shows the fetch error with role=alert, no empty state, and Reintentar reloads (P3 #4, #9, #11)', async () => {
    const getSummary = vi.spyOn(api, 'getSummary').mockRejectedValue(new Error('resumen caído'));

    const user = userEvent.setup();
    render(<SummariesPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('resumen caído');
    expect(screen.queryByText('Aún no hay resúmenes para este período.')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('retry-summary'));
    await waitFor(() => expect(getSummary).toHaveBeenCalledTimes(2));
  });
});
