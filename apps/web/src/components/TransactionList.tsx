import { useState } from 'react';
import type { ApiTransaction } from '../types';

export interface TransactionListProps {
  transactions: ApiTransaction[];
  categoryNames: Map<number, string>;
  onEdit: (tx: ApiTransaction) => void;
  onDelete: (tx: ApiTransaction) => void;
  confirmingId: number | null;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
}

function formatAmount(tx: ApiTransaction): string {
  const value = tx.amountMinor / 100;
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: tx.currency }).format(value);
}

/** FX-at-entry in es-AR number format, e.g. 1.345,5 (W1: rate is captured at entry). */
function formatRate(rate: number): string {
  return new Intl.NumberFormat('es-AR').format(rate);
}

/** Expense/income table for the current period with per-row edit/delete actions. */
export default function TransactionList({
  transactions,
  categoryNames,
  onEdit,
  onDelete,
  confirmingId,
  onConfirmDelete,
  onCancelDelete,
}: TransactionListProps): JSX.Element {
  const [busy, setBusy] = useState(false);

  async function handleConfirm(): Promise<void> {
    setBusy(true);
    try {
      await onConfirmDelete();
    } finally {
      setBusy(false);
    }
  }

  if (transactions.length === 0) {
    return <div className="empty">Aún no hay transacciones en este período.</div>;
  }
  return (
    <table className="data" data-testid="transaction-list">
      <thead>
        <tr>
          <th>Fecha</th>
          <th>Concepto</th>
          <th>Categoría</th>
          <th>Tipo</th>
          <th>Monto</th>
          <th>Tipo de cambio</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        {transactions.map((tx) => (
          <tr key={tx.id}>
            <td>{tx.date}</td>
            <td>{tx.note || '—'}</td>
            <td>{categoryNames.get(tx.categoryId) ?? `#${tx.categoryId}`}</td>
            <td className="tx-direction">{tx.direction === 'income' ? 'Ingreso' : 'Gasto'}</td>
            <td>
              <span className={tx.direction === 'income' ? 'badge ok row-amount' : 'row-amount'}>
                {tx.direction === 'income' ? '+' : '−'}
                {formatAmount(tx)}
              </span>
            </td>
            <td className="rate-cell">{tx.currency === 'USD' ? formatRate(tx.rate) : '—'}</td>
            <td className="row-actions">
              <button type="button" className="link" onClick={() => onEdit(tx)} disabled={busy}>
                Editar
              </button>
              {confirmingId === tx.id ? (
                <span className="confirm-prompt">
                  <span className="confirm-question">¿Borrar la transacción?</span>
                  <span className="confirm-note">Se eliminará de presupuestos y resúmenes.</span>
                  <button type="button" className="danger" onClick={handleConfirm} disabled={busy}>
                    Borrar
                  </button>
                  <button type="button" className="link" onClick={onCancelDelete} disabled={busy}>
                    Cancelar
                  </button>
                </span>
              ) : (
                <button type="button" className="danger" onClick={() => onDelete(tx)} disabled={busy}>
                  Borrar
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
