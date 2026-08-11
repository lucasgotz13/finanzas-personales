import { arDateString } from '@finanzas/domain';
import { useEffect, useMemo, useState } from 'react';
import { api, categoryNameMap } from '../api';
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
export default function TransactionsPage(): JSX.Element {
  const [month, setMonth] = useState(arDateString(new Date()).slice(0, 7));
  const [direction, setDirection] = useState<DirectionFilter>('all');
  const [editing, setEditing] = useState<ApiTransaction | null>(null);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const categories = useApi(() => api.getCategoryTree(), []);
  const transactions = useApi(
    () => api.listTransactions({ month, direction: direction === 'all' ? undefined : direction }),
    [month, direction],
  );

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
  }

  function handleUpdate(updated: ApiTransaction): void {
    setLocalTransactions((prev) => prev?.map((t) => (t.id === updated.id ? updated : t)) ?? null);
    setEditing(null);
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
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Could not delete the transaction.');
    }
  }

  const listLoading = transactions.loading && localTransactions === null;

  return (
    <>
      <section className="card">
        <h2>{editing ? 'Edit transaction' : 'Record a transaction'}</h2>
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
        <h2>Transactions — {month}</h2>
        <div className="filters">
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Month" />
          <nav className="tabs">
            {(['all', 'expense', 'income'] as const).map((d) => (
              <button key={d} className={direction === d ? 'active' : ''} onClick={() => setDirection(d)}>
                {d === 'all' ? 'All' : d[0].toUpperCase() + d.slice(1)}
              </button>
            ))}
          </nav>
        </div>
        {deleteError && (
          <div className="error-box" role="alert">
            {deleteError}
          </div>
        )}
        {transactions.error && !deleteError && <div className="error-box">{transactions.error}</div>}
        {listLoading ? (
          <div className="empty">Loading…</div>
        ) : (
          <TransactionList
            transactions={localTransactions ?? []}
            categoryNames={categoryNames}
            onEdit={handleEdit}
            onDelete={handleDelete}
            confirmingId={confirmingId}
            onConfirmDelete={confirmDelete}
            onCancelDelete={() => setConfirmingId(null)}
          />
        )}
      </section>
    </>
  );
}
