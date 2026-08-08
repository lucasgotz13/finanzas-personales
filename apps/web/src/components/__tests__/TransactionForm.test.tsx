import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../api';
import type { ApiTransaction, CategoryNode } from '../../types';
import TransactionForm from '../TransactionForm';

const categories: CategoryNode[] = [
  { id: 1, name: 'Food', parentId: null, children: [] },
  { id: 10, name: 'Salary', parentId: null, children: [] },
];

describe('TransactionForm', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('submits a valid ARS expense and calls onCreated (ET-1)', async () => {
    const user = userEvent.setup();
    const created: ApiTransaction = { id: 1, direction: 'expense', amountMinor: 120000, currency: 'ARS', rate: 1, date: '2026-07-15', categoryId: 1, note: 'Lunch' };
    const spy = vi.spyOn(api, 'createTransaction').mockResolvedValue(created);
    const onCreated = vi.fn();

    render(<TransactionForm categories={categories} onCreated={onCreated} />);
    await user.type(screen.getByTestId('amount'), '1200');
    fireEvent.change(screen.getByTestId('date'), { target: { value: '2026-07-15' } });
    await user.selectOptions(screen.getByTestId('category'), '1');
    await user.type(screen.getByTestId('note'), 'Lunch');
    await user.click(screen.getByTestId('submit'));

    await waitFor(() => expect(spy).toHaveBeenCalledWith({
      direction: 'expense',
      amountMinor: 120000,
      currency: 'ARS',
      rate: undefined,
      date: '2026-07-15',
      categoryId: 1,
      note: 'Lunch',
    }));
    expect(onCreated).toHaveBeenCalledWith(created);
  });

  it('shows the FX rate field and requires it for USD (ET-1)', async () => {
    const user = userEvent.setup();
    render(<TransactionForm categories={categories} onCreated={vi.fn()} />);

    expect(screen.queryByTestId('rate')).not.toBeInTheDocument();
    await user.selectOptions(screen.getByTestId('currency'), 'USD');
    expect(screen.getByTestId('rate')).toBeInTheDocument();

    await user.type(screen.getByTestId('amount'), '25');
    await user.selectOptions(screen.getByTestId('category'), '1');
    await user.click(screen.getByTestId('submit'));
    expect(await screen.findByText('FX rate is required for USD.')).toBeInTheDocument();
  });

  it('rejects a non-positive amount without calling the API (ET-2)', async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(api, 'createTransaction').mockResolvedValue({} as never);
    render(<TransactionForm categories={categories} onCreated={vi.fn()} />);

    await user.type(screen.getByTestId('amount'), '0');
    await user.selectOptions(screen.getByTestId('category'), '1');
    await user.click(screen.getByTestId('submit'));

    expect(await screen.findByText('Amount must be a positive number.')).toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
  });

  it('submits a USD expense with the rate captured at entry (ET-1)', async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(api, 'createTransaction').mockResolvedValue({} as never);
    render(<TransactionForm categories={categories} onCreated={vi.fn()} />);

    await user.selectOptions(screen.getByTestId('currency'), 'USD');
    await user.type(screen.getByTestId('amount'), '25');
    await user.type(screen.getByTestId('rate'), '950');
    await user.selectOptions(screen.getByTestId('category'), '1');
    await user.click(screen.getByTestId('submit'));

    await waitFor(() => expect(spy).toHaveBeenCalledWith(expect.objectContaining({ amountMinor: 2500, currency: 'USD', rate: 950 })));
  });

  it('converts a decimal amount to minor units (1200.50 → 120050)', async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(api, 'createTransaction').mockResolvedValue({} as never);
    render(<TransactionForm categories={categories} onCreated={vi.fn()} />);

    await user.type(screen.getByTestId('amount'), '1200.50');
    await user.selectOptions(screen.getByTestId('category'), '1');
    await user.click(screen.getByTestId('submit'));

    await waitFor(() => expect(spy).toHaveBeenCalledWith(expect.objectContaining({ amountMinor: 120050, currency: 'ARS' })));
  });
});
