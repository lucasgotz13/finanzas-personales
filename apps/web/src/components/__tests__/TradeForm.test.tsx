import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api } from '../../api';
import type { Trade } from '../../types';
import TradeForm from '../TradeForm';

const created: Trade = { id: 1, ticker: 'AAPL.BA', type: 'buy', date: '2026-08-01', quantity: 10, priceMinor: 18000, currency: 'USD' };

describe('TradeForm', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('submits a valid buy with es-AR amounts and calls onSaved (TH-6)', async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(api, 'createTrade').mockResolvedValue(created);
    const onSaved = vi.fn();

    render(<TradeForm onSaved={onSaved} />);
    await user.type(screen.getByTestId('trade-ticker'), 'aapl');
    fireEvent.change(screen.getByTestId('trade-date'), { target: { value: '2026-08-01' } });
    await user.type(screen.getByTestId('trade-quantity'), '10');
    await user.type(screen.getByTestId('trade-price'), '180');
    await user.click(screen.getByTestId('submit'));

    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith({ type: 'buy', ticker: 'aapl', date: '2026-08-01', quantity: 10, priceMinor: 18000, currency: 'USD' }),
    );
    expect(onSaved).toHaveBeenCalledWith(created);
  });

  it('parses the es-AR decimal comma price (12,50 → 1250 minor units)', async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(api, 'createTrade').mockResolvedValue({} as never);

    render(<TradeForm onSaved={vi.fn()} />);
    await user.type(screen.getByTestId('trade-ticker'), 'aapl');
    await user.type(screen.getByTestId('trade-quantity'), '2');
    await user.type(screen.getByTestId('trade-price'), '12,50');
    await user.click(screen.getByTestId('submit'));

    await waitFor(() => expect(spy).toHaveBeenCalledWith(expect.objectContaining({ quantity: 2, priceMinor: 1250 })));
  });

  it('validates es-AR: ticker, date, quantity and price are required', async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(api, 'createTrade').mockResolvedValue({} as never);

    render(<TradeForm onSaved={vi.fn()} />);
    await user.type(screen.getByTestId('trade-quantity'), '0');
    await user.type(screen.getByTestId('trade-price'), '0');
    await user.click(screen.getByTestId('submit'));

    expect(await screen.findByText('El ticker es obligatorio.')).toBeInTheDocument();
    expect(screen.getByText('La cantidad debe ser un número positivo.')).toBeInTheDocument();
    expect(screen.getByText('El precio debe ser un número positivo.')).toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
  });

  it('shows the rejected-sell timeline error in es-AR naming the trade (TH-6)', async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(api, 'createTrade').mockRejectedValue(
      new ApiError(
        422,
        'VALIDATION_ERROR',
        'Invalid trade timeline',
        ['sell of 10 AAPL.BA on 2026-08-10 exceeds balance 5; fix that sell first'],
        'TRADE_EXCEEDS_BALANCE',
        { type: 'sell', ticker: 'AAPL.BA', quantity: 10, date: '2026-08-10', balance: 5 },
      ),
    );

    render(<TradeForm onSaved={vi.fn()} />);
    await user.selectOptions(screen.getByTestId('trade-type'), 'sell');
    await user.type(screen.getByTestId('trade-ticker'), 'aapl');
    fireEvent.change(screen.getByTestId('trade-date'), { target: { value: '2026-08-10' } });
    await user.type(screen.getByTestId('trade-quantity'), '10');
    await user.type(screen.getByTestId('trade-price'), '250');
    await user.click(screen.getByTestId('submit'));

    expect(await screen.findByText('La venta de 10 AAPL.BA del 2026-08-10 supera el saldo de 5; corrija primero esa venta.')).toBeInTheDocument();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  describe('edit mode', () => {
    const existing: Trade = { id: 7, ticker: 'AAPL.BA', type: 'sell', date: '2026-08-05', quantity: 3, priceMinor: 25000, currency: 'USD' };

    it('prefills every field and submits a PUT', async () => {
      const user = userEvent.setup();
      const updated: Trade = { ...existing, quantity: 5 };
      const spy = vi.spyOn(api, 'updateTrade').mockResolvedValue(updated);
      const onSaved = vi.fn();

      render(<TradeForm initial={existing} onSaved={onSaved} onCancel={vi.fn()} />);

      expect(screen.getByTestId('trade-type')).toHaveValue('sell');
      expect(screen.getByTestId('trade-ticker')).toHaveValue('AAPL.BA');
      expect(screen.getByTestId('trade-date')).toHaveValue('2026-08-05');
      expect(screen.getByTestId('trade-quantity')).toHaveValue('3');
      expect(screen.getByTestId('trade-price')).toHaveValue('250');

      await user.clear(screen.getByTestId('trade-quantity'));
      await user.type(screen.getByTestId('trade-quantity'), '5');
      await user.click(screen.getByTestId('submit'));

      await waitFor(() =>
        expect(spy).toHaveBeenCalledWith(7, { type: 'sell', ticker: 'AAPL.BA', date: '2026-08-05', quantity: 5, priceMinor: 25000, currency: 'USD' }),
      );
      expect(onSaved).toHaveBeenCalledWith(updated);
    });

    it('cancels edit mode through the cancel button', async () => {
      const user = userEvent.setup();
      const onCancel = vi.fn();
      render(<TradeForm initial={existing} onSaved={vi.fn()} onCancel={onCancel} />);

      await user.click(screen.getByTestId('cancel'));
      expect(onCancel).toHaveBeenCalledTimes(1);
    });
  });
});
