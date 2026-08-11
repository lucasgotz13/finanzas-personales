import { arDateString } from '@finanzas/domain';
import { useState } from 'react';
import { api, flattenTree } from '../api';
import type { ApiTransaction, CategoryNode, CreateTransactionInput } from '../types';

export interface TransactionFormProps {
  categories: CategoryNode[];
  onCreated: (tx: ApiTransaction) => void;
  /** Edit mode: prefill every field from this transaction and PATCH on submit. */
  initial?: ApiTransaction;
  onUpdate?: (tx: ApiTransaction) => void;
  onCancel?: () => void;
}

const DIRECTION_LABELS: Record<string, string> = { expense: 'Expense', income: 'Income' };

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
    const parsed = parseFloat(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) details.push('Amount must be a positive number.');
    const amountMinor = Math.round(parsed * 100);
    if (currency === 'USD' && (!rate || Number(rate) <= 0)) details.push('FX rate is required for USD.');
    if (categoryId === '') details.push('Select a category.');
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
      setErrors([err instanceof Error ? err.message : 'Could not save the transaction.']);
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
        Type
        <select value={direction} onChange={(e) => setDirection(e.target.value as 'expense' | 'income')}>
          {Object.entries(DIRECTION_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Amount ({currency})
        <input
          type="number"
          min="0.01"
          step="0.01"
          placeholder="1200"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          data-testid="amount"
        />
      </label>
      <label>
        Currency
        <select value={currency} onChange={(e) => setCurrency(e.target.value as 'ARS' | 'USD')} data-testid="currency">
          <option value="ARS">ARS</option>
          <option value="USD">USD</option>
        </select>
      </label>
      {currency === 'USD' && (
        <label>
          FX rate at entry
          <input type="number" min="0.0001" step="any" value={rate} onChange={(e) => setRate(e.target.value)} data-testid="rate" />
        </label>
      )}
      <label>
        Date
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} data-testid="date" />
      </label>
      <label>
        Category
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} data-testid="category">
          <option value="">Select…</option>
          {options.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Note
        <input type="text" value={note} onChange={(e) => setNote(e.target.value)} data-testid="note" />
      </label>
      <div className="actions">
        <button type="submit" className="primary" disabled={submitting} data-testid="submit">
          {submitting ? 'Saving…' : 'Save'}
        </button>
        {initial && (
          <button type="button" className="link" onClick={handleCancel} disabled={submitting} data-testid="cancel">
            Cancel
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
