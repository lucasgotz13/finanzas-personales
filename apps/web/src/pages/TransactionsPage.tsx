import { arDateString } from '@finanzas/domain';
import { useEffect, useMemo, useState } from 'react';
import { api, categoryNameMap, translateApiMessage } from '../api';
import { formatMonth, formatRefMonth } from '../dates';
import { useApi } from '../hooks/useApi';
import TransactionForm from '../components/TransactionForm';
import TransactionList from '../components/TransactionList';
import type { ApiTransaction } from '../types';

type DirectionFilter = 'all' | 'expense' | 'income';

/** The last 4 months including the given one (oldest → newest), as 'YYYY-MM' keys. */
function recentMonths(current: string): string[] {
  const [year, month] = current.split('-').map(Number);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return [current];
  const months: string[] = [];
  for (let offset = -3; offset <= 0; offset++) {
    const date = new Date(Date.UTC(year, month - 1 + offset, 1));
    months.push(`${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return months;
}

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
  // Month totals come from the full month (no direction filter), so the money
  // card stays honest when the list below is filtered to a single direction.
  const monthTotals = useApi(() => api.listTransactions({ month }), [month]);

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
        <header className="membrete">
          <h2>Total del mes</h2>
          <span className="membrete-period">{formatMonth(month)}</span>
        </header>
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
      <section className="card card--sheet">
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
      <section className="card card--sheet">
        <h2>Transacciones — {formatMonth(month)}</h2>
        <div className="filters">
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Mes" />
          <nav className="month-tabs" aria-label="Meses recientes">
            {recentMonths(month).map((m) => (
              <button
                key={m}
                type="button"
                className={m === month ? 'active' : ''}
                aria-pressed={m === month}
                onClick={() => setMonth(m)}
              >
                {formatRefMonth(m)}
              </button>
            ))}
          </nav>
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
