import type { ApiTransaction } from '../types';

export interface TransactionListProps {
  transactions: ApiTransaction[];
  categoryNames: Map<number, string>;
}

function formatAmount(tx: ApiTransaction): string {
  const value = tx.amountMinor / 100;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: tx.currency }).format(value);
}

/** Read-only expense/income table for the current period. */
export default function TransactionList({ transactions, categoryNames }: TransactionListProps): JSX.Element {
  if (transactions.length === 0) {
    return <div className="empty">No transactions yet for this period.</div>;
  }
  return (
    <table className="data">
      <thead>
        <tr>
          <th>Date</th>
          <th>Category</th>
          <th>Note</th>
          <th>Amount</th>
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
          </tr>
        ))}
      </tbody>
    </table>
  );
}
