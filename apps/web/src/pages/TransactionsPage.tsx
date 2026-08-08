import { arDateString } from '@finanzas/domain';
import { useMemo, useState } from 'react';
import { api, categoryNameMap } from '../api';
import { useApi } from '../hooks/useApi';
import TransactionForm from '../components/TransactionForm';
import TransactionList from '../components/TransactionList';

type DirectionFilter = 'all' | 'expense' | 'income';

/** Transactions page: period filters, manual entry form and the period list (ET-1..6, IT-1/2). */
export default function TransactionsPage(): JSX.Element {
  const [month, setMonth] = useState(arDateString(new Date()).slice(0, 7));
  const [direction, setDirection] = useState<DirectionFilter>('all');

  const categories = useApi(() => api.getCategoryTree(), []);
  const transactions = useApi(
    () => api.listTransactions({ month, direction: direction === 'all' ? undefined : direction }),
    [month, direction],
  );

  const categoryNames = useMemo(() => categoryNameMap(categories.data ?? []), [categories.data]);

  return (
    <>
      <section className="card">
        <h2>Record a transaction</h2>
        <TransactionForm categories={categories.data ?? []} onCreated={() => transactions.reload()} />
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
        {transactions.error && <div className="error-box">{transactions.error}</div>}
        {transactions.loading ? <div className="empty">Loading…</div> : <TransactionList transactions={transactions.data ?? []} categoryNames={categoryNames} />}
      </section>
    </>
  );
}
