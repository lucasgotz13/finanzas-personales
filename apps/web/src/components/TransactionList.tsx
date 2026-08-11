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
    <table className="data">
      <thead>
        <tr>
          <th>Fecha</th>
          <th>Categoría</th>
          <th>Nota</th>
          <th>Monto</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        {transactions.map((tx) => (
          <tr key={tx.id}>
            <td>{tx.date}</td>
            <td>{categoryNames.get(tx.categoryId) ?? `#${tx.categoryId}`}</td>
            <td>{tx.note || '—'}</td>
            <td>
              <span className={tx.direction === 'income' ? 'badge ok' : ''}>
                {tx.direction === 'income' ? '+' : '−'}
                {formatAmount(tx)}
              </span>
            </td>
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
