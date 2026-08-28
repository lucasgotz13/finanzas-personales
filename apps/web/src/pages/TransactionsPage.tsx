import { arDateString } from '@finanzas/domain';
import { useEffect, useMemo, useState } from 'react';
import { api, categoryNameMap, translateApiMessage } from '../api';
import { formatMonth } from '../dates';
import { useApi } from '../hooks/useApi';
import TransactionForm from '../components/TransactionForm';
import TransactionList from '../components/TransactionList';
import type { ApiTransaction } from '../types';

type DirectionFilter = 'all' | 'expense' | 'income';

/**
 * Transactions page: period filters, manual entry form and the period list
 * (ET-1..6, IT-1/2). Edits/deletes are applied optimistically to the local
 * list; the hook data syncs on background reloads without flashing "Loading…".
 */
export default function TransactionsPage({ active = true }: { active?: boolean }): JSX.Element {
  const [month, setMonth] = useState(arDateString(new Date()).slice(0, 7));
  const [direction, setDirection] = useState<DirectionFilter>('all');
  const [editing, setEditing] = useState<ApiTransaction | null>(null);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const categories = useApi(() => api.getCategoryTree(), [], active);
  const transactions = useApi(
    () => api.listTransactions({ month, direction: direction === 'all' ? undefined : direction }),
    [month, direction],
    active,
  );
  // Month totals come from the full month (no direction filter), so the money
  // card stays honest when the list below is filtered to a single direction.
  const monthTotals = useApi(() => api.listTransactions({ month }), [month], active);

  // Net flow per currency (income − expense), the honest "Total del mes".
  const totals = useMemo(() => {
    const net: Record<'ARS' | 'USD', number> = { ARS: 0, USD: 0 };
    let hasRows = false;
    for (const tx of monthTotals.data ?? []) {
      hasRows = true;
      net[tx.currency] += tx.direction === 'income' ? tx.amountMinor : -tx.amountMinor;
    }
    return hasRows ? (['ARS', 'USD'] as const).map((currency) => ({ currency, netMinor: net[currency] })) : [];
  }, [monthTotals.data]);

  // Local list is the render source: hook data lands here after every fetch,
  // and mutations adjust it immediately (no full-list "Loading…" flash).
  const [localTransactions, setLocalTransactions] = useState<ApiTransaction[] | null>(null);

  useEffect(() => {
    setLocalTransactions(transactions.data);
  }, [transactions.data]);

  // A filter change invalidates the stale period's list: show Loading… only then.
  useEffect(() => {
    setLocalTransactions(null);
  }, [month, direction]);

  const categoryNames = useMemo(() => categoryNameMap(categories.data ?? []), [categories.data]);

  function handleCreated(created: ApiTransaction): void {
    setLocalTransactions((prev) => (prev ? [created, ...prev] : [created]));
    // Background refetch catches backdated entries; the list stays visible.
    transactions.reload();
    monthTotals.reload();
  }

  function handleUpdate(updated: ApiTransaction): void {
    setLocalTransactions((prev) => prev?.map((t) => (t.id === updated.id ? updated : t)) ?? null);
    setEditing(null);
    monthTotals.reload();
  }

  function handleEdit(tx: ApiTransaction): void {
    setEditing(tx);
    setConfirmingId(null);
    setDeleteError(null);
  }

  function handleDelete(tx: ApiTransaction): void {
    setConfirmingId(tx.id);
    setDeleteError(null);
  }

  async function confirmDelete(): Promise<void> {
    if (confirmingId === null) return;
    try {
      await api.deleteTransaction(confirmingId);
      setLocalTransactions((prev) => prev?.filter((t) => t.id !== confirmingId) ?? prev);
      setConfirmingId(null);
      setDeleteError(null);
      monthTotals.reload();
    } catch (err) {
      setDeleteError(translateApiMessage(err instanceof Error ? err.message : 'No se pudo borrar la transacción.'));
    }
  }

  const listLoading = transactions.loading && localTransactions === null;

  return (
    <>
      <section className="card money-card" data-testid="month-total">
        <h2>Total del mes</h2>
        {totals.length === 0 ? (
          <span className="total-empty">—</span>
        ) : (
          <div className="totals">
            {totals.map((t) => (
              <div key={t.currency} className="total">
                <span className="total-currency">{t.currency}</span>
                <span className="total-amount">
                  {new Intl.NumberFormat('es-AR', { style: 'currency', currency: t.currency }).format(t.netMinor / 100)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
      <section className="card">
        <h2>{editing ? 'Editar transacción' : 'Registrar transacción'}</h2>
        <TransactionForm
          key={editing?.id ?? 'create'}
          categories={categories.data ?? []}
          initial={editing ?? undefined}
          onCreated={handleCreated}
          onUpdate={handleUpdate}
          onCancel={() => setEditing(null)}
        />
      </section>
      <section className="card">
        <h2>Transacciones — {formatMonth(month)}</h2>
        <div className="filters">
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Mes" />
          <nav className="tabs">
            {(['all', 'expense', 'income'] as const).map((d) => (
              <button
                key={d}
                className={direction === d ? 'active' : ''}
                aria-pressed={direction === d}
                onClick={() => setDirection(d)}
              >
                {d === 'all' ? 'Todas' : d === 'expense' ? 'Gasto' : 'Ingreso'}
              </button>
            ))}
          </nav>
        </div>
        {deleteError && (
          <div className="error-box" role="alert">
            {deleteError}
          </div>
        )}
        {transactions.error && !deleteError && (
          <div className="error-box" role="alert">
            {transactions.error}{' '}
            <button type="button" className="link" data-testid="retry-transactions" onClick={() => transactions.reload()}>
              Reintentar
            </button>
          </div>
        )}
        {listLoading ? (
          <div className="empty">Cargando…</div>
        ) : (
          <TransactionList
            transactions={localTransactions ?? []}
            categoryNames={categoryNames}
            onEdit={handleEdit}
            onDelete={handleDelete}
            confirmingId={confirmingId}
            onConfirmDelete={confirmDelete}
            onCancelDelete={() => setConfirmingId(null)}
            sortResetKey={`${month}:${direction}`}
          />
        )}
      </section>
    </>
  );
}
