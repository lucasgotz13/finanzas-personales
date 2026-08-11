import { arDateString } from '@finanzas/domain';
import { useState } from 'react';
import { api, flattenTree, translateApiMessage } from '../api';
import { parseEsArAmount } from '../amount';
import type { ApiTransaction, CategoryNode, CreateTransactionInput } from '../types';

export interface TransactionFormProps {
  categories: CategoryNode[];
  onCreated: (tx: ApiTransaction) => void;
  /** Edit mode: prefill every field from this transaction and PATCH on submit. */
  initial?: ApiTransaction;
  onUpdate?: (tx: ApiTransaction) => void;
  onCancel?: () => void;
}

const DIRECTION_LABELS: Record<string, string> = { expense: 'Gasto', income: 'Ingreso' };

/** Manual expense/income form (ET-1..6, IT-1/2): rate is required iff USD. */
export default function TransactionForm({ categories, onCreated, initial, onUpdate, onCancel }: TransactionFormProps): JSX.Element {
  // State seeds from `initial` on mount; the parent remounts (key) to switch
  // between create mode and editing a different row, so no sync effect is needed.
  const [direction, setDirection] = useState<'expense' | 'income'>(initial?.direction ?? 'expense');
  const [amount, setAmount] = useState(initial ? String(initial.amountMinor / 100) : '');
  const [currency, setCurrency] = useState<'ARS' | 'USD'>(initial?.currency ?? 'ARS');
  const [rate, setRate] = useState(initial && initial.currency === 'USD' ? String(initial.rate) : '');
  const [date, setDate] = useState(initial?.date ?? arDateString(new Date()));
  const [categoryId, setCategoryId] = useState(initial ? String(initial.categoryId) : '');
  const [note, setNote] = useState(initial?.note ?? '');
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const options = flattenTree(categories);

  // Live ARS conversion preview (USD only): parsed amount × FX at entry.
  // es-AR amount parsing: dot = thousands separator, comma = decimal (issue #45).
  const parsedAmount = parseEsArAmount(amount);
  const rateValue = Number(rate);
  const showConversion = currency === 'USD' && parsedAmount !== null && parsedAmount > 0 && Number.isFinite(rateValue) && rateValue > 0;
  const convertedArs = showConversion ? parsedAmount * rateValue : null;

  function resetForm(): void {
    setDirection('expense');
    setAmount('');
    setCurrency('ARS');
    setRate('');
    setDate(arDateString(new Date()));
    setCategoryId('');
    setNote('');
    setErrors([]);
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    const details: string[] = [];
    // Returns null for invalid input (e.g. "1e3"), never NaN.
    const parsed = parseEsArAmount(amount);
    if (parsed === null || parsed <= 0) details.push('El monto debe ser un número positivo.');
    const amountMinor = parsed === null ? 0 : Math.round(parsed * 100);
    if (currency === 'USD' && (!rate || Number(rate) <= 0)) details.push('El tipo de cambio es obligatorio para monedas que no son ARS.');
    if (categoryId === '') details.push('Seleccionar categoría.');
    if (details.length > 0) {
      setErrors(details);
      return;
    }
    setErrors([]);
    setSubmitting(true);
    try {
      const input: CreateTransactionInput = {
        direction,
        amountMinor,
        currency,
        rate: currency === 'USD' ? Number(rate) : undefined,
        date,
        categoryId: Number(categoryId),
        note: note.trim() === '' ? undefined : note.trim(),
      };
      if (initial) {
        const updated = await api.updateTransaction(initial.id, input);
        onUpdate?.(updated);
        resetForm();
      } else {
        const created = await api.createTransaction(input);
        onCreated(created);
        // Field memory: keep direction/currency/date/category, clear amount/rate/note (ET-1)
        setAmount('');
        setRate('');
        setNote('');
      }
    } catch (err) {
      setErrors([translateApiMessage(err instanceof Error ? err.message : 'No se pudo guardar la transacción.')]);
    } finally {
      setSubmitting(false);
    }
  }

  function handleCancel(): void {
    onCancel?.();
    resetForm();
  }

  return (
    // noValidate: the form validates with its own friendly messages (ET-2)
    <form className="transaction-form" onSubmit={handleSubmit} noValidate>
      <label>
        Tipo
        <select value={direction} onChange={(e) => setDirection(e.target.value as 'expense' | 'income')}>
          {Object.entries(DIRECTION_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Monto ({currency})
        <input
          type="text"
          inputMode="decimal"
          placeholder="1200"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          data-testid="amount"
        />
        {convertedArs !== null && (
          <span className="conversion-line" data-testid="conversion-line">
            ≈ {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(convertedArs)} ARS al tipo{' '}
            {new Intl.NumberFormat('es-AR').format(rateValue)}
          </span>
        )}
      </label>
      <label>
        Moneda
        <select value={currency} onChange={(e) => setCurrency(e.target.value as 'ARS' | 'USD')} data-testid="currency">
          <option value="ARS">ARS</option>
          <option value="USD">USD</option>
        </select>
      </label>
      {currency === 'USD' && (
        <label>
          Tipo de cambio al momento
          <input type="number" min="0.0001" step="any" value={rate} onChange={(e) => setRate(e.target.value)} data-testid="rate" />
        </label>
      )}
      <label>
        Fecha
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} data-testid="date" />
      </label>
      <label>
        Categoría
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} data-testid="category">
          <option value="">Seleccionar…</option>
          {options.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Nota
        <input type="text" value={note} onChange={(e) => setNote(e.target.value)} data-testid="note" />
      </label>
      <div className="actions">
        <button type="submit" className="primary" disabled={submitting} data-testid="submit">
          {submitting ? 'Guardando…' : 'Guardar'}
        </button>
        {initial && (
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
