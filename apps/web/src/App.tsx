import { useState } from 'react';

export type Tab = 'transactions' | 'categories' | 'budgets' | 'summaries';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'transactions', label: 'Transactions' },
  { id: 'categories', label: 'Categories' },
  { id: 'budgets', label: 'Budgets' },
  { id: 'summaries', label: 'Summaries' },
];

const PLACEHOLDERS: Record<Tab, string> = {
  transactions: 'Transactions',
  categories: 'Categories',
  budgets: 'Budgets',
  summaries: 'Summaries',
};

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
        <section className="card">{PLACEHOLDERS[tab]}</section>
      </main>
    </>
  );
}
