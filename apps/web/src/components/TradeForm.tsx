import { arDateString } from '@finanzas/domain';
import { useState } from 'react';
import { ApiError, api, translateApiMessage, translateTradeDetail } from '../api';
import { parseEsArAmount } from '../amount';
import type { Trade, TradeInput } from '../types';

export interface TradeFormProps {
  /** Edit mode: prefill every field from this trade and PUT on submit. */
  initial?: Trade;
  onSaved: (trade: Trade) => void;
  onCancel?: () => void;
}

const TYPE_LABELS: Record<'buy' | 'sell', string> = { buy: 'Compra', sell: 'Venta' };

/** Trade entry form (TH-6): type, ticker, date, quantity and price in USD.
 * Validation errors render in es-AR, including timeline rejections that name
 * the offending trade ("corregí primero esa venta"). */
export default function TradeForm({ initial, onSaved, onCancel }: TradeFormProps): JSX.Element {
  const [type, setType] = useState<'buy' | 'sell'>(initial?.type ?? 'buy');
  const [ticker, setTicker] = useState(initial?.ticker ?? '');
  const [date, setDate] = useState(initial?.date ?? arDateString(new Date()));
  const [quantity, setQuantity] = useState(initial ? String(initial.quantity) : '');
  const [price, setPrice] = useState(initial ? String(initial.priceMinor / 100) : '');
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  function resetForm(): void {
    setType('buy');
    setTicker('');
    setDate(arDateString(new Date()));
    setQuantity('');
    setPrice('');
    setErrors([]);
  }

  function errorText(err: unknown): string {
    if (err instanceof ApiError && err.details.length > 0) {
      return err.details.map(translateTradeDetail).join(' ');
    }
    return translateApiMessage(err instanceof Error ? err.message : 'No se pudo guardar la operación.');
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    const details: string[] = [];
    const qty = parseEsArAmount(quantity);
    const priceValue = parseEsArAmount(price);
    if (ticker.trim() === '') details.push('El ticker es obligatorio.');
    if (date === '') details.push('La fecha es obligatoria.');
    if (qty === null || qty <= 0) details.push('La cantidad debe ser un número positivo.');
    if (priceValue === null || priceValue <= 0) details.push('El precio debe ser un número positivo.');
    if (details.length > 0) {
      setErrors(details);
      return;
    }
    setErrors([]);
    setSubmitting(true);
    try {
      const input: TradeInput = {
        type,
        ticker: ticker.trim(),
        date,
        quantity: qty as number,
        priceMinor: Math.round((priceValue as number) * 100),
        currency: 'USD',
      };
      const saved = initial !== undefined ? await api.updateTrade(initial.id, input) : await api.createTrade(input);
      onSaved(saved);
      if (initial === undefined) {
        // Field memory: keep type, clear ticker/quantity/price for the next entry.
        setTicker('');
        setQuantity('');
        setPrice('');
      }
    } catch (err) {
      setErrors([errorText(err)]);
    } finally {
      setSubmitting(false);
    }
  }

  function handleCancel(): void {
    onCancel?.();
    resetForm();
  }

  return (
    <form className="transaction-form" onSubmit={handleSubmit} noValidate>
      <label>
        Tipo
        <select value={type} onChange={(e) => setType(e.target.value as 'buy' | 'sell')} data-testid="trade-type">
          {(Object.keys(TYPE_LABELS) as Array<'buy' | 'sell'>).map((value) => (
            <option key={value} value={value}>
              {TYPE_LABELS[value]}
            </option>
          ))}
        </select>
      </label>
      <label>
        Ticker
        <input type="text" placeholder="AAPL" value={ticker} onChange={(e) => setTicker(e.target.value)} data-testid="trade-ticker" />
      </label>
      <label>
        Fecha
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} data-testid="trade-date" />
      </label>
      <label>
        Cantidad
        <input type="text" inputMode="decimal" placeholder="10" value={quantity} onChange={(e) => setQuantity(e.target.value)} data-testid="trade-quantity" />
      </label>
      <label>
        Precio (USD)
        <input type="text" inputMode="decimal" placeholder="180" value={price} onChange={(e) => setPrice(e.target.value)} data-testid="trade-price" />
      </label>
      <div className="actions">
        <button type="submit" className="primary" disabled={submitting} data-testid="submit">
          {submitting ? 'Guardando…' : initial !== undefined ? 'Guardar cambios' : 'Registrar'}
        </button>
        {initial !== undefined && (
          <button type="button" className="link muted" onClick={handleCancel} disabled={submitting} data-testid="cancel">
            Cancelar
          </button>
        )}
      </div>
      {errors.length > 0 && (
        <div className="error-box" role="alert">
          {errors.map((err) => (
            <div key={err}>{err}</div>
          ))}
        </div>
      )}
    </form>
  );
}
