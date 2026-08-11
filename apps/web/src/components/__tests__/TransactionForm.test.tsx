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
    expect(await screen.findByText('El tipo de cambio es obligatorio para monedas que no son ARS.')).toBeInTheDocument();
  });

  it('rejects a non-positive amount without calling the API (ET-2)', async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(api, 'createTransaction').mockResolvedValue({} as never);
    render(<TransactionForm categories={categories} onCreated={vi.fn()} />);

    await user.type(screen.getByTestId('amount'), '0');
    await user.selectOptions(screen.getByTestId('category'), '1');
    await user.click(screen.getByTestId('submit'));

    expect(await screen.findByText('El monto debe ser un número positivo.')).toBeInTheDocument();
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

  it('converts a decimal amount to minor units (1200.5 → 120050)', async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(api, 'createTransaction').mockResolvedValue({} as never);
    render(<TransactionForm categories={categories} onCreated={vi.fn()} />);

    await user.type(screen.getByTestId('amount'), '1200.5');
    await user.selectOptions(screen.getByTestId('category'), '1');
    await user.click(screen.getByTestId('submit'));

    await waitFor(() => expect(spy).toHaveBeenCalledWith(expect.objectContaining({ amountMinor: 120050, currency: 'ARS' })));
  });

  it('accepts a decimal comma amount (12,50 → 1250 minor units)', async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(api, 'createTransaction').mockResolvedValue({} as never);
    render(<TransactionForm categories={categories} onCreated={vi.fn()} />);

    await user.type(screen.getByTestId('amount'), '12,50');
    await user.selectOptions(screen.getByTestId('category'), '1');
    await user.click(screen.getByTestId('submit'));

    await waitFor(() => expect(spy).toHaveBeenCalledWith(expect.objectContaining({ amountMinor: 1250, currency: 'ARS' })));
  });

  it('accepts a dot-decimal amount (12.50 → 1250 minor units)', async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(api, 'createTransaction').mockResolvedValue({} as never);
    render(<TransactionForm categories={categories} onCreated={vi.fn()} />);

    await user.type(screen.getByTestId('amount'), '12.50');
    await user.selectOptions(screen.getByTestId('category'), '1');
    await user.click(screen.getByTestId('submit'));

    await waitFor(() => expect(spy).toHaveBeenCalledWith(expect.objectContaining({ amountMinor: 1250, currency: 'ARS' })));
  });

  it('rejects a scientific-notation amount (1e3) without calling the API (P2)', async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(api, 'createTransaction').mockResolvedValue({} as never);
    render(<TransactionForm categories={categories} onCreated={vi.fn()} />);

    await user.type(screen.getByTestId('amount'), '1e3');
    await user.selectOptions(screen.getByTestId('category'), '1');
    await user.click(screen.getByTestId('submit'));

    expect(await screen.findByText('El monto debe ser un número positivo.')).toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
  });

  describe('edit mode', () => {
    const existing: ApiTransaction = {
      id: 7,
      direction: 'income',
      amountMinor: 250000,
      currency: 'USD',
      rate: 950,
      date: '2026-07-20',
      categoryId: 10,
      note: 'Freelance',
    };

    it('prefills every field with the initial transaction (amount in decimal units)', () => {
      render(<TransactionForm categories={categories} initial={existing} onCreated={vi.fn()} onUpdate={vi.fn()} onCancel={vi.fn()} />);

      expect(screen.getByTestId('amount')).toHaveValue('2500');
      expect(screen.getByLabelText('Tipo')).toHaveValue('income');
      expect(screen.getByTestId('currency')).toHaveValue('USD');
      expect(screen.getByTestId('rate')).toHaveValue(950);
      expect(screen.getByTestId('date')).toHaveValue('2026-07-20');
      expect(screen.getByTestId('category')).toHaveValue('10');
      expect(screen.getByTestId('note')).toHaveValue('Freelance');
    });

    it('submits a PATCH with the converted amount and resets to create mode', async () => {
      const user = userEvent.setup();
      const updated: ApiTransaction = { ...existing, amountMinor: 300000, note: 'Freelance retainer' };
      const spy = vi.spyOn(api, 'updateTransaction').mockResolvedValue(updated);
      const onUpdate = vi.fn();

      render(<TransactionForm categories={categories} initial={existing} onCreated={vi.fn()} onUpdate={onUpdate} onCancel={vi.fn()} />);

      await user.clear(screen.getByTestId('amount'));
      await user.type(screen.getByTestId('amount'), '3000');
      await user.clear(screen.getByTestId('note'));
      await user.type(screen.getByTestId('note'), 'Freelance retainer');
      await user.click(screen.getByTestId('submit'));

      await waitFor(() =>
        expect(spy).toHaveBeenCalledWith(7, {
          direction: 'income',
          amountMinor: 300000,
          currency: 'USD',
          rate: 950,
          date: '2026-07-20',
          categoryId: 10,
          note: 'Freelance retainer',
        }),
      );
      expect(onUpdate).toHaveBeenCalledWith(updated);
      await waitFor(() => expect(screen.getByTestId('amount')).toHaveValue(''));
      expect(screen.getByTestId('submit')).toHaveTextContent('Guardar');
    });

    it('cancels edit mode and resets the form', async () => {
      const user = userEvent.setup();
      const onCancel = vi.fn();
      render(<TransactionForm categories={categories} initial={existing} onCreated={vi.fn()} onUpdate={vi.fn()} onCancel={onCancel} />);

      await user.click(screen.getByTestId('cancel'));
      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('amount')).toHaveValue('');
      expect(screen.getByTestId('currency')).toHaveValue('ARS');
      expect(screen.getByTestId('category')).toHaveValue('');
    });

    it('still requires an FX rate when switching to USD in edit mode (W1)', async () => {
      const user = userEvent.setup();
      const spy = vi.spyOn(api, 'updateTransaction').mockResolvedValue({} as never);
      const ars: ApiTransaction = { ...existing, currency: 'ARS', rate: 1, amountMinor: 120000 };
      render(<TransactionForm categories={categories} initial={ars} onCreated={vi.fn()} onUpdate={vi.fn()} onCancel={vi.fn()} />);

      await user.selectOptions(screen.getByTestId('currency'), 'USD');
      await user.click(screen.getByTestId('submit'));

      expect(await screen.findByText('El tipo de cambio es obligatorio para monedas que no son ARS.')).toBeInTheDocument();
      expect(spy).not.toHaveBeenCalled();
    });
  });
});
