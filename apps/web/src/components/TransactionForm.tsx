import { arDateString } from '@finanzas/domain';
import { useState } from 'react';
import { api, flattenTree } from '../api';
import type { ApiTransaction, CategoryNode, CreateTransactionInput } from '../types';

export interface TransactionFormProps {
  categories: CategoryNode[];
  onCreated: (tx: ApiTransaction) => void;
}

const DIRECTION_LABELS: Record<string, string> = { expense: 'Expense', income: 'Income' };

/** Manual expense/income form (ET-1..6, IT-1/2): rate is required iff USD. */
export default function TransactionForm({ categories, onCreated }: TransactionFormProps): JSX.Element {
  const [direction, setDirection] = useState<'expense' | 'income'>('expense');
  const [amountMinor, setAmountMinor] = useState('');
  const [currency, setCurrency] = useState<'ARS' | 'USD'>('ARS');
  const [rate, setRate] = useState('');
  const [date, setDate] = useState(arDateString(new Date()));
  const [categoryId, setCategoryId] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const options = flattenTree(categories);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    const details: string[] = [];
    const amount = Number(amountMinor);
    if (!Number.isInteger(amount) || amount <= 0) details.push('Amount must be a positive integer.');
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
        amountMinor: amount,
        currency,
        rate: currency === 'USD' ? Number(rate) : undefined,
        date,
        categoryId: Number(categoryId),
        note: note.trim() === '' ? undefined : note.trim(),
      };
      const created = await api.createTransaction(input);
      onCreated(created);
      setAmountMinor('');
      setRate('');
      setNote('');
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Could not save the transaction.']);
    } finally {
      setSubmitting(false);
    }
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
        Amount (minor units)
        <input
          type="number"
          min="1"
          step="1"
          value={amountMinor}
          onChange={(e) => setAmountMinor(e.target.value)}
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
