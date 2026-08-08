import { useState } from 'react';
import TransactionsPage from './pages/TransactionsPage';

export type Tab = 'transactions' | 'categories' | 'budgets' | 'summaries';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'transactions', label: 'Transactions' },
  { id: 'categories', label: 'Categories' },
  { id: 'budgets', label: 'Budgets' },
  { id: 'summaries', label: 'Summaries' },
];

export default function App(): JSX.Element {
  const [tab, setTab] = useState<Tab>('transactions');
  return (
    <>
      <header className="app-header">
        <h1>Finanzas Personales</h1>
        <nav className="tabs">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>
      </header>
      <main>
        {tab === 'transactions' && <TransactionsPage />}
        {tab !== 'transactions' && <section className="card">Coming soon.</section>}
      </main>
    </>
  );
}
