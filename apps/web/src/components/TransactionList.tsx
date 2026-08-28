import { Money } from '@finanzas/domain';
import { useEffect, useMemo, useRef, useState } from 'react';
import { formatDate } from '../dates';
import type { ApiTransaction } from '../types';

export type TransactionSort = 'none' | 'ascending' | 'descending';

export interface TransactionListProps {
  transactions: ApiTransaction[];
  categoryNames: Map<number, string>;
  onEdit: (tx: ApiTransaction) => void;
  onDelete: (tx: ApiTransaction) => void;
  confirmingId: number | null;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  sortResetKey: string;
}

function formatAmount(tx: ApiTransaction): string {
  const value = tx.amountMinor / 100;
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: tx.currency }).format(value);
}

/** FX-at-entry in es-AR number format, e.g. 1.345,5 (W1: rate is captured at entry). */
function formatRate(rate: number): string {
  return new Intl.NumberFormat('es-AR').format(rate);
}

function arsMagnitude(tx: ApiTransaction): number {
  return Math.abs(new Money({ amountMinor: tx.amountMinor, currency: tx.currency, rate: tx.rate }).toArsMinor());
}

function compareTieBreakers(a: ApiTransaction, b: ApiTransaction): number {
  return a.date.localeCompare(b.date) || a.id - b.id;
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
  sortResetKey,
}: TransactionListProps): JSX.Element {
  const [sort, setSort] = useState<TransactionSort>('none');
  const [busy, setBusy] = useState(false);
  const confirmRef = useRef<HTMLButtonElement | null>(null);
  // The row's Editar button keeps focus after the prompt is cancelled; the
  // row stays mounted in both states, so the reference stays valid (P2/P3 #1).
  const restoreRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    setSort('none');
  }, [sortResetKey]);

  const visibleTransactions = useMemo(() => {
    if (sort === 'none') return transactions;

    return [...transactions].sort((a, b) => {
      const amountComparison = arsMagnitude(a) - arsMagnitude(b);
      if (amountComparison !== 0) return sort === 'ascending' ? amountComparison : -amountComparison;
      return compareTieBreakers(a, b);
    });
  }, [sort, transactions]);

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

  const nextSort: TransactionSort = sort === 'none' || sort === 'descending' ? 'ascending' : 'descending';
  const nextSortLabel = nextSort === 'ascending' ? 'menor a mayor' : 'mayor a menor';
  const sortDirectionLabel = sort === 'ascending' ? 'menor a mayor' : 'mayor a menor';
  const sortControls = sort !== 'none' && (
    <div className="transaction-sort-controls" aria-live="polite">
      <span className="sort-hint">
        Ordenado por equivalente ARS al tipo de cambio registrado ({sortDirectionLabel})
      </span>
      <button type="button" className="link sort-reset" onClick={() => setSort('none')}>
        Restablecer orden
      </button>
    </div>
  );

  if (transactions.length === 0) {
    return (
      <>
        {sortControls}
        <div className="empty">Aún no hay transacciones en este período.</div>
      </>
    );
  }

  return (
    <>
      {sortControls}
      <table className="data" data-testid="transaction-list">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Concepto</th>
            <th>Categoría</th>
            <th>Tipo</th>
            <th aria-sort={sort}>
              <button
                type="button"
                className="sort-button"
                onClick={() => setSort(nextSort)}
                aria-label={`Ordenar por equivalente ARS al tipo de cambio registrado: ${nextSortLabel}`}
              >
                Monto{' '}
                <span className="sort-indicator" aria-hidden="true">
                  {sort === 'none' ? '↕' : sort === 'ascending' ? '↑' : '↓'}
                </span>
              </button>
            </th>
            <th>Tipo de cambio</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {visibleTransactions.map((tx, index) => (
            <tr key={tx.id}>
              <td>
                {/* The folio number: every sheet in the legajo is numbered.
                    Ordinal decoration only, so it stays out of the a11y tree. */}
                <span className="folio" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="foja-date">{formatDate(tx.date)}</span>
              </td>
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
                    <span className="confirm-slip" aria-hidden="true">
                      <span className="confirm-slip-field">Foja {String(index + 1).padStart(2, '0')}</span>
                      <span className="confirm-slip-field">{formatDate(tx.date)}</span>
                      <span className="confirm-slip-field">{tx.note || '—'}</span>
                      <span className="confirm-slip-field">{formatAmount(tx)}</span>
                    </span>
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
    </>
  );
}
