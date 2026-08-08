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
  });

  it('reloads the list after a transaction is created (ET-1)', async () => {
    vi.spyOn(api, 'getCategoryTree').mockResolvedValue(categories);
    const listSpy = vi.spyOn(api, 'listTransactions').mockResolvedValue(transactions);
    vi.spyOn(api, 'createTransaction').mockResolvedValue({ ...transactions[0], id: 2, amountMinor: 2500 });

    const user = userEvent.setup();
    render(<TransactionsPage />);
    await screen.findByText(/ARS 150\.00/);
    expect(listSpy).toHaveBeenCalledTimes(1);

    await user.type(screen.getByTestId('amount'), '25');
    await user.selectOptions(screen.getByTestId('category'), '1');
    await user.click(screen.getByTestId('submit'));

    await waitFor(() => expect(listSpy).toHaveBeenCalledTimes(2));
  });
});
