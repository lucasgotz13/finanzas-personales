import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../api';
import type { BudgetStatus, CategoryNode } from '../../types';
import BudgetsPage from '../BudgetsPage';

const categories: CategoryNode[] = [
  { id: 1, name: 'Food', parentId: null, children: [] },
  { id: 2, name: 'Transport', parentId: null, children: [] },
];

const status: BudgetStatus = {
  month: '2026-07',
  categories: [{ categoryId: 1, cap: 100000, consumed: 120000, overBudget: true }],
  global: { cap: 100000, consumed: 120000, overBudget: true },
};

describe('BudgetsPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('saves caps through the API and shows the status (BM-1, BM-3)', async () => {
    vi.spyOn(api, 'getCategoryTree').mockResolvedValue(categories);
    const getBudgets = vi.spyOn(api, 'getBudgets').mockResolvedValue({});
    const putBudgets = vi.spyOn(api, 'putBudgets').mockResolvedValue({ 1: 100000 });
    vi.spyOn(api, 'getBudgetStatus').mockResolvedValue(status);

    const user = userEvent.setup();
    render(<BudgetsPage />);
    expect(await screen.findByTestId('cap-1')).toBeInTheDocument();

    // Decimal amount in the input → converted to minor units on save
    await user.type(screen.getByTestId('cap-1'), '1000');
    await user.click(screen.getByTestId('budget-save'));

    expect(putBudgets).toHaveBeenCalledWith({ 1: 100000 });
    await vi.waitFor(() => expect(getBudgets).toHaveBeenCalledTimes(2));
  });

  it('accepts a decimal comma cap (1000,50 → 100050 minor units)', async () => {
    vi.spyOn(api, 'getCategoryTree').mockResolvedValue(categories);
    const getBudgets = vi.spyOn(api, 'getBudgets').mockResolvedValue({});
    const putBudgets = vi.spyOn(api, 'putBudgets').mockResolvedValue({ 1: 100050 });
    vi.spyOn(api, 'getBudgetStatus').mockResolvedValue(status);

    const user = userEvent.setup();
    render(<BudgetsPage />);
    await screen.findByTestId('cap-1');

    await user.type(screen.getByTestId('cap-1'), '1000,50');
    await user.click(screen.getByTestId('budget-save'));

    expect(putBudgets).toHaveBeenCalledWith({ 1: 100050 });
  });

  it('renders the over-budget status with formatted amounts and badges (BM-4)', async () => {
    vi.spyOn(api, 'getCategoryTree').mockResolvedValue(categories);
    vi.spyOn(api, 'getBudgets').mockResolvedValue({ 1: 100000 });
    vi.spyOn(api, 'getBudgetStatus').mockResolvedValue(status);

    render(<BudgetsPage />);
    // Global and per-category badges both read "SOBRE EL PRESUPUESTO".
    expect(await screen.findAllByText('SOBRE EL PRESUPUESTO')).toHaveLength(2);
    // Category name from the tree instead of the raw id: appears in the caps editor
    // table AND the status table (previously the status table rendered "1")
    expect(screen.getAllByText('Food')).toHaveLength(2);
    // Minor units (120000/100000) rendered as currency amounts ($ 1.200,00 / $ 1.000,00)
    expect(screen.getByText('Global: $ 1.200,00 / $ 1.000,00')).toBeInTheDocument();
  });
});
