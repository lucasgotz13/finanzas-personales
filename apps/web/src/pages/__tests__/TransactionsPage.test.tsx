import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { arDateString } from '@finanzas/domain';
import { api } from '../../api';
import { formatMonth } from '../../dates';
import type { ApiTransaction, CategoryNode } from '../../types';
import TransactionsPage from '../TransactionsPage';

const categories: CategoryNode[] = [{ id: 1, name: 'Food', parentId: null, children: [] }];
const transactions: ApiTransaction[] = [
  { id: 1, direction: 'expense', amountMinor: 15000, currency: 'ARS', rate: 1, date: '2026-07-15', categoryId: 1, note: 'Lunch' },
];

/** Amount assertions are scoped to the list table because the month-total
 *  money card legitimately renders the same figures (duplicate text). */
async function listTable(): Promise<HTMLElement> {
  return screen.findByTestId('transaction-list');
}

describe('TransactionsPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads the month list and shows the form', async () => {
    vi.spyOn(api, 'getCategoryTree').mockResolvedValue(categories);
    vi.spyOn(api, 'listTransactions').mockResolvedValue(transactions);
    render(<TransactionsPage />);
    expect(await screen.findByText(/Transacciones —/)).toBeInTheDocument();
    await within(await listTable()).findByText(/\$\s*150,00/);
    expect(screen.getByTestId('amount')).toBeInTheDocument();
    expect(screen.queryByText('Cargando…')).not.toBeInTheDocument();
  });

  it('shows the selected month as an es-AR month name in the heading', async () => {
    vi.spyOn(api, 'getCategoryTree').mockResolvedValue(categories);
    vi.spyOn(api, 'listTransactions').mockResolvedValue(transactions);
    render(<TransactionsPage />);
    const month = arDateString(new Date()).slice(0, 7);
    expect(await screen.findByText(`Transacciones — ${formatMonth(month)}`)).toBeInTheDocument();
    expect(screen.queryByText(`Transacciones — ${month}`)).not.toBeInTheDocument();
  });

  it('shows the month total per currency in the money card (ARS and USD)', async () => {
    const mixed: ApiTransaction[] = [
      transactions[0],
      { id: 3, direction: 'income', amountMinor: 100000, currency: 'USD', rate: 950, date: '2026-07-10', categoryId: 1, note: 'Airbnb' },
    ];
    vi.spyOn(api, 'getCategoryTree').mockResolvedValue(categories);
    vi.spyOn(api, 'listTransactions').mockResolvedValue(mixed);
    render(<TransactionsPage />);

    expect(await screen.findByText('Total del mes')).toBeInTheDocument();
    const card = screen.getByTestId('month-total');
    expect(within(card).getByText(/\$\s*150,00/)).toBeInTheDocument(); // ARS net: a single expense
    expect(within(card).getByText(/US\$\s*1\.000,00/)).toBeInTheDocument(); // USD net: a single income
  });

  it('adds the created transaction to the list immediately and reloads in the background (ET-1)', async () => {
    vi.spyOn(api, 'getCategoryTree').mockResolvedValue(categories);
    const created: ApiTransaction = { ...transactions[0], id: 2, amountMinor: 2500, note: 'Coffee' };
    const listSpy = vi
      .spyOn(api, 'listTransactions')
      .mockResolvedValueOnce(transactions)
      .mockResolvedValue([...transactions, created]);
    vi.spyOn(api, 'createTransaction').mockResolvedValue(created);

    const user = userEvent.setup();
    render(<TransactionsPage />);
    await within(await listTable()).findByText(/\$\s*150,00/);
    // List + month-total card each fetch the month (2 calls on mount).
    expect(listSpy).toHaveBeenCalledTimes(2);

    await user.type(screen.getByTestId('amount'), '25');
    await user.selectOptions(screen.getByTestId('category'), '1');
    await user.click(screen.getByTestId('submit'));

    expect(await within(await listTable()).findByText(/\$\s*25,00/)).toBeInTheDocument();
    expect(screen.queryByText('Cargando…')).not.toBeInTheDocument();
    // Both hooks reload after the create (4 calls total).
    await waitFor(() => expect(listSpy).toHaveBeenCalledTimes(4));
  });

  it('edits a row: prefills the form, PATCHes and updates the list without a Cargando… flash', async () => {
    vi.spyOn(api, 'getCategoryTree').mockResolvedValue(categories);
    vi.spyOn(api, 'listTransactions').mockResolvedValue(transactions);
    const updated: ApiTransaction = { ...transactions[0], amountMinor: 30000, note: 'Lunch with client' };
    const updateSpy = vi.spyOn(api, 'updateTransaction').mockResolvedValue(updated);

    const user = userEvent.setup();
    render(<TransactionsPage />);
    await within(await listTable()).findByText(/\$\s*150,00/);

    await user.click(screen.getByRole('button', { name: 'Editar' }));
    expect(screen.getByTestId('amount')).toHaveValue('150');
    expect(screen.getByTestId('note')).toHaveValue('Lunch');
    expect(screen.getByTestId('cancel')).toBeInTheDocument();

    await user.clear(screen.getByTestId('amount'));
    await user.type(screen.getByTestId('amount'), '300');
    await user.clear(screen.getByTestId('note'));
    await user.type(screen.getByTestId('note'), 'Lunch with client');
    await user.click(screen.getByTestId('submit'));

    await waitFor(() =>
      expect(updateSpy).toHaveBeenCalledWith(1, expect.objectContaining({ amountMinor: 30000, note: 'Lunch with client' })),
    );
    expect(await within(await listTable()).findByText(/\$\s*300,00/)).toBeInTheDocument();
    expect(within(await listTable()).queryByText(/\$\s*150,00/)).not.toBeInTheDocument();
    expect(screen.queryByText('Cargando…')).not.toBeInTheDocument();
    expect(screen.queryByTestId('cancel')).not.toBeInTheDocument();
  });

  it('deletes a row after inline confirmation', async () => {
    vi.spyOn(api, 'getCategoryTree').mockResolvedValue(categories);
    vi.spyOn(api, 'listTransactions').mockResolvedValue(transactions);
    const deleteSpy = vi.spyOn(api, 'deleteTransaction').mockResolvedValue(undefined);

    const user = userEvent.setup();
    render(<TransactionsPage />);
    await within(await listTable()).findByText(/\$\s*150,00/);

    await user.click(screen.getByRole('button', { name: 'Borrar' }));
    expect(screen.getByText('¿Borrar la transacción?')).toBeInTheDocument();
    expect(screen.getByText('Se eliminará de presupuestos y resúmenes.')).toBeInTheDocument();
    // Focus moves to the confirm action (the only Borrar while confirming).
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Borrar' }));
    // The prompt announces itself as an alert.
    expect(screen.getByRole('alert')).toHaveTextContent('¿Borrar la transacción?');

    await user.click(screen.getByRole('button', { name: 'Borrar' }));
    await waitFor(() => expect(deleteSpy).toHaveBeenCalledWith(1));
    // The only row is gone: the list falls back to its empty state.
    expect(await screen.findByText('Aún no hay transacciones en este período.')).toBeInTheDocument();
    expect(screen.queryByText('¿Borrar la transacción?')).not.toBeInTheDocument();
    expect(screen.queryByText('Cargando…')).not.toBeInTheDocument();
  });

  it('keeps the row when the delete confirmation is cancelled', async () => {
    vi.spyOn(api, 'getCategoryTree').mockResolvedValue(categories);
    vi.spyOn(api, 'listTransactions').mockResolvedValue(transactions);
    const deleteSpy = vi.spyOn(api, 'deleteTransaction').mockResolvedValue(undefined);

    const user = userEvent.setup();
    render(<TransactionsPage />);
    await within(await listTable()).findByText(/\$\s*150,00/);

    await user.click(screen.getByRole('button', { name: 'Borrar' }));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(deleteSpy).not.toHaveBeenCalled();
    expect(within(await listTable()).getByText(/\$\s*150,00/)).toBeInTheDocument();
    expect(screen.queryByText('¿Borrar la transacción?')).not.toBeInTheDocument();
    // Cancel restores focus to the row's Editar button (P3 #1).
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Editar' }));
  });

  it('shows the fetch error with role=alert and Reintentar reloads the list (P3 #4, #9)', async () => {
    vi.spyOn(api, 'getCategoryTree').mockResolvedValue(categories);
    const listSpy = vi.spyOn(api, 'listTransactions').mockRejectedValue(new Error('red caída'));

    const user = userEvent.setup();
    render(<TransactionsPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('red caída');
    await user.click(screen.getByTestId('retry-transactions'));
    // Mount fetches twice (list + month card); the retry adds a third.
    await waitFor(() => expect(listSpy).toHaveBeenCalledTimes(3));
  });

  it('marks the direction filter buttons with aria-pressed (P3 #14)', async () => {
    vi.spyOn(api, 'getCategoryTree').mockResolvedValue(categories);
    vi.spyOn(api, 'listTransactions').mockResolvedValue(transactions);

    const user = userEvent.setup();
    render(<TransactionsPage />);
    await within(await listTable()).findByText(/\$\s*150,00/);

    const todas = screen.getByRole('button', { name: 'Todas' });
    expect(todas).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Gasto' })).toHaveAttribute('aria-pressed', 'false');

    await user.click(screen.getByRole('button', { name: 'Gasto' }));
    expect(screen.getByRole('button', { name: 'Gasto' })).toHaveAttribute('aria-pressed', 'true');
    expect(todas).toHaveAttribute('aria-pressed', 'false');
  });
});
