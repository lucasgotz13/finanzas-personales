import { useEffect, useRef, useState } from 'react';
import { formatDate } from '../dates';
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
  const confirmRef = useRef<HTMLButtonElement | null>(null);
  // The row's Editar button keeps focus after the prompt is cancelled; the
  // row stays mounted in both states, so the reference stays valid (P2/P3 #1).
  const restoreRef = useRef<HTMLButtonElement | null>(null);

  // Focus the confirm action when the prompt opens (two-tap stays: focus
  // moves to Borrar, Enter confirms).
  useEffect(() => {
    if (confirmingId !== null) confirmRef.current?.focus();
  }, [confirmingId]);

  async function handleConfirm(): Promise<void> {
    setBusy(true);
    try {
      await onConfirmDelete();
    } finally {
      setBusy(false);
    }
  }

  function handleDeleteClick(tx: ApiTransaction, e: React.MouseEvent<HTMLButtonElement>): void {
    restoreRef.current = e.currentTarget.closest('tr')?.querySelector('button.link') ?? null;
    onDelete(tx);
  }

  function handleCancel(): void {
    onCancelDelete();
    restoreRef.current?.focus();
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
            <td>{formatDate(tx.date)}</td>
            <td>{tx.note || '—'}</td>
            <td>{categoryNames.get(tx.categoryId) ?? `#${tx.categoryId}`}</td>
            <td className="tx-direction">{tx.direction === 'income' ? 'Ingreso' : 'Gasto'}</td>
            <td>
              <span className="row-amount">
                {tx.direction === 'income' ? '+' : '−'}
                {formatAmount(tx)}
              </span>
            </td>
            <td className="rate-cell">{tx.currency === 'USD' ? formatRate(tx.rate) : '—'}</td>
            <td className="row-actions actions-cell">
              <button type="button" className="link muted" onClick={() => onEdit(tx)} disabled={busy}>
                Editar
              </button>
              {confirmingId === tx.id ? (
                <span className="confirm-prompt" role="alert">
                  <span className="confirm-question">¿Borrar la transacción?</span>
                  <span className="confirm-note">Se eliminará de presupuestos y resúmenes.</span>
                  <button
                    type="button"
                    className="danger"
                    ref={confirmRef}
                    onClick={handleConfirm}
                    disabled={busy}
                  >
                    Borrar
                  </button>
                  <button type="button" className="link muted" onClick={handleCancel} disabled={busy}>
                    Cancelar
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  className="danger"
                  onClick={(e) => handleDeleteClick(tx, e)}
                  disabled={busy}
                >
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
