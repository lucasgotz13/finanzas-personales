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

  it('shows a live ARS conversion line while typing a USD amount with a valid rate', async () => {
    const user = userEvent.setup();
    render(<TransactionForm categories={categories} onCreated={vi.fn()} />);

    await user.selectOptions(screen.getByTestId('currency'), 'USD');
    await user.type(screen.getByTestId('amount'), '25');
    await user.type(screen.getByTestId('rate'), '950');

    expect(screen.getByText(/≈\s*\$\s*23\.750,00\s*al\s*tipo\s*950/)).toBeInTheDocument();

    // Live update as the parsed amount changes (25 USD → 30 USD @ 950).
    await user.clear(screen.getByTestId('amount'));
    await user.type(screen.getByTestId('amount'), '30');
    expect(screen.getByText(/≈\s*\$\s*28\.500,00\s*al\s*tipo\s*950/)).toBeInTheDocument();
  });

  it('hides the conversion line for ARS amounts', async () => {
    const user = userEvent.setup();
    render(<TransactionForm categories={categories} onCreated={vi.fn()} />);

    await user.type(screen.getByTestId('amount'), '25');
    expect(screen.queryByText(/al tipo/)).not.toBeInTheDocument();
  });

  it('hides the conversion line until the FX rate is valid', async () => {
    const user = userEvent.setup();
    render(<TransactionForm categories={categories} onCreated={vi.fn()} />);

    await user.selectOptions(screen.getByTestId('currency'), 'USD');
    await user.type(screen.getByTestId('amount'), '25');
    expect(screen.queryByText(/al tipo/)).not.toBeInTheDocument();

    await user.type(screen.getByTestId('rate'), '0');
    expect(screen.queryByText(/al tipo/)).not.toBeInTheDocument();
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

  it('prefills the rate with the last USD rate on the next entry, still editable (P3 #6)', async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(api, 'createTransaction').mockResolvedValue({} as never);
    render(<TransactionForm categories={categories} onCreated={vi.fn()} />);

    await user.selectOptions(screen.getByTestId('currency'), 'USD');
    await user.type(screen.getByTestId('amount'), '25');
    await user.clear(screen.getByTestId('rate'));
    await user.type(screen.getByTestId('rate'), '968.5');
    await user.selectOptions(screen.getByTestId('category'), '1');
    await user.click(screen.getByTestId('submit'));

    await waitFor(() => expect(spy).toHaveBeenCalledWith(expect.objectContaining({ currency: 'USD', rate: 968.5 })));
    // Next entry: currency memory keeps USD and the rate comes back prefilled.
    expect(screen.getByTestId('rate')).toHaveValue(968.5);
    // Still editable: the user can overwrite the remembered rate.
    await user.clear(screen.getByTestId('rate'));
    await user.type(screen.getByTestId('rate'), '970');
    expect(screen.getByTestId('rate')).toHaveValue(970);
  });

  it('keeps the remembered rate across ARS saves (P3 #6)', async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(api, 'createTransaction').mockResolvedValue({} as never);
    render(<TransactionForm categories={categories} onCreated={vi.fn()} />);

    // Save a USD entry at 900; the rate is remembered.
    await user.selectOptions(screen.getByTestId('currency'), 'USD');
    await user.type(screen.getByTestId('amount'), '10');
    await user.clear(screen.getByTestId('rate'));
    await user.type(screen.getByTestId('rate'), '900');
    await user.selectOptions(screen.getByTestId('category'), '1');
    await user.click(screen.getByTestId('submit'));
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));

    // An ARS save does not touch the memory.
    await user.selectOptions(screen.getByTestId('currency'), 'ARS');
    await user.type(screen.getByTestId('amount'), '50');
    await user.click(screen.getByTestId('submit'));
    await waitFor(() => expect(spy).toHaveBeenCalledWith(expect.objectContaining({ currency: 'ARS', rate: undefined })));

    // The next USD entry starts prefilled with the last USD rate.
    await user.selectOptions(screen.getByTestId('currency'), 'USD');
    expect(screen.getByTestId('rate')).toHaveValue(900);
  });

  it('clears the stale rate-required error when the currency changes (P3 #10)', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'createTransaction').mockResolvedValue({} as never);
    render(<TransactionForm categories={categories} onCreated={vi.fn()} />);

    await user.selectOptions(screen.getByTestId('currency'), 'USD');
    await user.clear(screen.getByTestId('rate'));
    await user.type(screen.getByTestId('amount'), '25');
    await user.selectOptions(screen.getByTestId('category'), '1');
    await user.click(screen.getByTestId('submit'));
    expect(await screen.findByText('El tipo de cambio es obligatorio para monedas que no son ARS.')).toBeInTheDocument();

    // Switching to ARS drops the FX error; the monto error, if any, stays.
    await user.selectOptions(screen.getByTestId('currency'), 'ARS');
    expect(screen.queryByText('El tipo de cambio es obligatorio para monedas que no son ARS.')).not.toBeInTheDocument();
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

  it('parses dot as the es-AR thousands separator (1.234 → 123400 minor units)', async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(api, 'createTransaction').mockResolvedValue({} as never);
    render(<TransactionForm categories={categories} onCreated={vi.fn()} />);

    await user.type(screen.getByTestId('amount'), '1.234');
    await user.selectOptions(screen.getByTestId('category'), '1');
    await user.click(screen.getByTestId('submit'));

    await waitFor(() => expect(spy).toHaveBeenCalledWith(expect.objectContaining({ amountMinor: 123400, currency: 'ARS' })));
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
