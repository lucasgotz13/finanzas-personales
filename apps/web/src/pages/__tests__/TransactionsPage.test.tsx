import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../api';
import type { ApiTransaction, CategoryNode } from '../../types';
import TransactionsPage from '../TransactionsPage';

const categories: CategoryNode[] = [{ id: 1, name: 'Food', parentId: null, children: [] }];
const transactions: ApiTransaction[] = [
  { id: 1, direction: 'expense', amountMinor: 15000, currency: 'ARS', rate: 1, date: '2026-07-15', categoryId: 1, note: 'Lunch' },
];

describe('TransactionsPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads the month list and shows the form', async () => {
    vi.spyOn(api, 'getCategoryTree').mockResolvedValue(categories);
    vi.spyOn(api, 'listTransactions').mockResolvedValue(transactions);
    render(<TransactionsPage />);
    expect(await screen.findByText(/Transactions —/)).toBeInTheDocument();
    expect(await screen.findByText(/ARS 150\.00/)).toBeInTheDocument();
    expect(screen.getByTestId('amount')).toBeInTheDocument();
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
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
    await screen.findByText(/ARS 150\.00/);
    expect(listSpy).toHaveBeenCalledTimes(1);

    await user.type(screen.getByTestId('amount'), '25');
    await user.selectOptions(screen.getByTestId('category'), '1');
    await user.click(screen.getByTestId('submit'));

    expect(await screen.findByText(/ARS 25\.00/)).toBeInTheDocument();
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
    await waitFor(() => expect(listSpy).toHaveBeenCalledTimes(2));
  });

  it('edits a row: prefills the form, PATCHes and updates the list without a Loading… flash', async () => {
    vi.spyOn(api, 'getCategoryTree').mockResolvedValue(categories);
    vi.spyOn(api, 'listTransactions').mockResolvedValue(transactions);
    const updated: ApiTransaction = { ...transactions[0], amountMinor: 30000, note: 'Lunch with client' };
    const updateSpy = vi.spyOn(api, 'updateTransaction').mockResolvedValue(updated);

    const user = userEvent.setup();
    render(<TransactionsPage />);
    await screen.findByText(/ARS 150\.00/);

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByTestId('amount')).toHaveValue(150);
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
    expect(await screen.findByText(/ARS 300\.00/)).toBeInTheDocument();
    expect(screen.queryByText(/ARS 150\.00/)).not.toBeInTheDocument();
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
    expect(screen.queryByTestId('cancel')).not.toBeInTheDocument();
  });

  it('deletes a row after inline confirmation', async () => {
    vi.spyOn(api, 'getCategoryTree').mockResolvedValue(categories);
    vi.spyOn(api, 'listTransactions').mockResolvedValue(transactions);
    const deleteSpy = vi.spyOn(api, 'deleteTransaction').mockResolvedValue(undefined);

    const user = userEvent.setup();
    render(<TransactionsPage />);
    await screen.findByText(/ARS 150\.00/);

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByText('Delete permanently?')).toBeInTheDocument();
    expect(screen.getByText('Removes it from budgets and summaries.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Yes' }));
    await waitFor(() => expect(deleteSpy).toHaveBeenCalledWith(1));
    expect(screen.queryByText(/ARS 150\.00/)).not.toBeInTheDocument();
    expect(screen.queryByText('Delete permanently?')).not.toBeInTheDocument();
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
  });

  it('keeps the row when the delete confirmation is cancelled', async () => {
    vi.spyOn(api, 'getCategoryTree').mockResolvedValue(categories);
    vi.spyOn(api, 'listTransactions').mockResolvedValue(transactions);
    const deleteSpy = vi.spyOn(api, 'deleteTransaction').mockResolvedValue(undefined);

    const user = userEvent.setup();
    render(<TransactionsPage />);
    await screen.findByText(/ARS 150\.00/);

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await user.click(screen.getByRole('button', { name: 'No' }));

    expect(deleteSpy).not.toHaveBeenCalled();
    expect(screen.getByText(/ARS 150\.00/)).toBeInTheDocument();
    expect(screen.queryByText('Delete permanently?')).not.toBeInTheDocument();
  });
});
