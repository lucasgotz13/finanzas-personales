import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { api } from './api';
import type { BudgetStatus, PeriodSummary } from './types';

const budgetStatus: BudgetStatus = {
  month: '2026-08',
  categories: [],
  global: { cap: 0, consumed: 0, overBudget: false },
};

const emptySummary: PeriodSummary = { period: 'month', currencies: [], categories: [] };

function mockAllApis(): void {
  vi.spyOn(api, 'listTransactions').mockResolvedValue([]);
  vi.spyOn(api, 'getCategoryTree').mockResolvedValue([]);
  vi.spyOn(api, 'getDeletedCategories').mockResolvedValue([]);
  vi.spyOn(api, 'getBudgets').mockResolvedValue({});
  vi.spyOn(api, 'getBudgetStatus').mockResolvedValue(budgetStatus);
  vi.spyOn(api, 'getSummary').mockResolvedValue(emptySummary);
  vi.spyOn(api, 'getIndicators').mockResolvedValue([]);
}

describe('App tab switching', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps every page mounted and hides inactive tabs with CSS (state survives switches)', async () => {
    mockAllApis();
    const user = userEvent.setup();
    render(<App />);

    const note = await screen.findByTestId('note');
    await user.type(note, 'rent');

    await user.click(screen.getByRole('button', { name: 'Categorías' }));

    // The transaction form is still in the DOM, just hidden (no unmount).
    expect(document.querySelector('[data-testid="note"]')).not.toBeNull();

    await user.click(screen.getByRole('button', { name: 'Transacciones' }));

    expect(screen.getByTestId('note')).toHaveValue('rent');
  });

  it('switches to every tab and back without crashing', async () => {
    mockAllApis();
    const user = userEvent.setup();
    render(<App />);

    await screen.findByTestId('note');

    for (const tab of ['Categorías', 'Presupuestos', 'Resúmenes', 'Indicadores', 'Transacciones']) {
      await user.click(screen.getByRole('button', { name: tab }));
    }

    expect(screen.getByTestId('note')).toBeInTheDocument();
  });
});
