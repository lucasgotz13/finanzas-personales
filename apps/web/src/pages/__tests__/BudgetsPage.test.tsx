import { render, screen, waitFor } from '@testing-library/react';
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

  it('parses dot as the es-AR thousands separator in caps (1.500 → 150000 minor units)', async () => {
    vi.spyOn(api, 'getCategoryTree').mockResolvedValue(categories);
    const getBudgets = vi.spyOn(api, 'getBudgets').mockResolvedValue({});
    const putBudgets = vi.spyOn(api, 'putBudgets').mockResolvedValue({ 1: 150000 });
    vi.spyOn(api, 'getBudgetStatus').mockResolvedValue(status);

    const user = userEvent.setup();
    render(<BudgetsPage />);
    await screen.findByTestId('cap-1');

    await user.type(screen.getByTestId('cap-1'), '1.500');
    await user.click(screen.getByTestId('budget-save'));

    expect(putBudgets).toHaveBeenCalledWith({ 1: 150000 });
  });

  it('submits with Enter, shows and clears the success message, and exposes cap aria-labels (P2)', async () => {
    vi.spyOn(api, 'getCategoryTree').mockResolvedValue(categories);
    const getBudgets = vi.spyOn(api, 'getBudgets').mockResolvedValue({});
    const putBudgets = vi.spyOn(api, 'putBudgets').mockResolvedValue({ 1: 100000 });
    vi.spyOn(api, 'getBudgetStatus').mockResolvedValue(status);

    const user = userEvent.setup();
    render(<BudgetsPage />);
    await screen.findByTestId('cap-1');

    // Cap inputs are reachable by their Spanish aria-labels
    expect(screen.getByLabelText('Tope mensual de Food')).toBeInTheDocument();
    expect(screen.getByLabelText('Tope mensual de Transport')).toBeInTheDocument();

    await user.type(screen.getByTestId('cap-1'), '1000{Enter}');

    await waitFor(() => expect(putBudgets).toHaveBeenCalledWith({ 1: 100000 }));
    expect(await screen.findByText('Presupuestos guardados.')).toBeInTheDocument();

    // Transient success: clears on its own after ~2s
    await waitFor(() => expect(screen.queryByText('Presupuestos guardados.')).not.toBeInTheDocument(), { timeout: 3000 });
    await vi.waitFor(() => expect(getBudgets).toHaveBeenCalledTimes(2));
  });

  it('rejects a scientific-notation cap (1e3) with a validation error and does not save (P2)', async () => {
    vi.spyOn(api, 'getCategoryTree').mockResolvedValue(categories);
    vi.spyOn(api, 'getBudgets').mockResolvedValue({});
    const putBudgets = vi.spyOn(api, 'putBudgets').mockResolvedValue({});
    vi.spyOn(api, 'getBudgetStatus').mockResolvedValue(status);

    const user = userEvent.setup();
    render(<BudgetsPage />);
    await screen.findByTestId('cap-1');

    await user.type(screen.getByTestId('cap-1'), '1e3');
    await user.click(screen.getByTestId('budget-save'));

    expect(await screen.findByRole('alert')).toHaveTextContent('El tope para "Food" debe ser un monto positivo.');
    expect(putBudgets).not.toHaveBeenCalled();
  });

  it('prefills saved budget caps into the inputs after load (#105)', async () => {
    vi.spyOn(api, 'getCategoryTree').mockResolvedValue(categories);
    vi.spyOn(api, 'getBudgets').mockResolvedValue({ 1: 50000 });
    vi.spyOn(api, 'putBudgets').mockResolvedValue({});
    vi.spyOn(api, 'getBudgetStatus').mockResolvedValue(status);

    render(<BudgetsPage />);

    // Minor units (50000) render as the plain string '500' in the input.
    expect(await screen.findByTestId('cap-1')).toHaveValue('500');
  });

  it('includes untouched saved caps in the PUT map on save (#105)', async () => {
    vi.spyOn(api, 'getCategoryTree').mockResolvedValue(categories);
    vi.spyOn(api, 'getBudgets').mockResolvedValue({ 1: 50000, 2: 20000 });
    const putBudgets = vi.spyOn(api, 'putBudgets').mockResolvedValue({});
    vi.spyOn(api, 'getBudgetStatus').mockResolvedValue(status);

    const user = userEvent.setup();
    render(<BudgetsPage />);
    await screen.findByTestId('cap-1');
    expect(screen.getByTestId('cap-1')).toHaveValue('500');

    // Edit ONLY cap-1; the untouched cap-2 saved value must be sent too,
    // because PUT /budgets replaces the whole map (BM-3).
    await user.clear(screen.getByTestId('cap-1'));
    await user.type(screen.getByTestId('cap-1'), '400');
    await user.click(screen.getByTestId('budget-save'));

    expect(putBudgets).toHaveBeenCalledWith({ 1: 40000, 2: 20000 });
  });

  it('renders the over-budget status with formatted amounts and badges (BM-4)', async () => {
    vi.spyOn(api, 'getCategoryTree').mockResolvedValue(categories);
    vi.spyOn(api, 'getBudgets').mockResolvedValue({ 1: 100000 });
    vi.spyOn(api, 'getBudgetStatus').mockResolvedValue(status);

    render(<BudgetsPage />);
    // Global and per-category badges both read "Sobre el presupuesto".
    expect(await screen.findAllByText('Sobre el presupuesto')).toHaveLength(2);
    // Category name from the tree instead of the raw id: appears in the caps editor
    // table AND the status table (previously the status table rendered "1")
    expect(screen.getAllByText('Food')).toHaveLength(2);
    // Minor units (120000/100000) rendered as currency amounts ($ 1.200,00 / $ 1.000,00)
    expect(screen.getByText('Global: $ 1.200,00 / $ 1.000,00')).toBeInTheDocument();
  });

  it('never shows "Aún no hay categorías para presupuestar." while categories or budgets load (P3 #12)', async () => {
    vi.spyOn(api, 'getCategoryTree').mockReturnValue(new Promise(() => {}));
    vi.spyOn(api, 'getBudgets').mockResolvedValue({});
    vi.spyOn(api, 'getBudgetStatus').mockResolvedValue(status);

    render(<BudgetsPage />);

    expect(screen.getAllByText('Cargando…').length).toBeGreaterThan(0);
    expect(screen.queryByText('Aún no hay categorías para presupuestar.')).not.toBeInTheDocument();
  });

  it('shows the categories fetch error with role=alert and Reintentar reloads (P3 #4, #9)', async () => {
    const getTree = vi.spyOn(api, 'getCategoryTree').mockRejectedValue(new Error('árbol caído'));
    vi.spyOn(api, 'getBudgets').mockResolvedValue({});
    vi.spyOn(api, 'getBudgetStatus').mockResolvedValue(status);

    const user = userEvent.setup();
    render(<BudgetsPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('árbol caído');
    await user.click(screen.getByTestId('retry-categories'));
    await waitFor(() => expect(getTree).toHaveBeenCalledTimes(2));
  });

  it('shows the status fetch error with role=alert and Reintentar reloads (P3 #4, #9)', async () => {
    vi.spyOn(api, 'getCategoryTree').mockResolvedValue(categories);
    vi.spyOn(api, 'getBudgets').mockResolvedValue({});
    const getStatus = vi.spyOn(api, 'getBudgetStatus').mockRejectedValue(new Error('estado caído'));

    const user = userEvent.setup();
    render(<BudgetsPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('estado caído');
    await user.click(screen.getByTestId('retry-status'));
    // Mount fetches once, a second time when budgets.data settles (status
    // depends on it), and the retry adds the third.
    await waitFor(() => expect(getStatus).toHaveBeenCalledTimes(3));
  });
});
