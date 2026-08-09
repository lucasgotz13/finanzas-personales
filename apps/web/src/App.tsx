import { useState } from 'react';
import BudgetsPage from './pages/BudgetsPage';
import CategoriesPage from './pages/CategoriesPage';
import IndicatorsPage from './pages/IndicatorsPage';
import SummariesPage from './pages/SummariesPage';
import TransactionsPage from './pages/TransactionsPage';

export type Tab = 'transactions' | 'categories' | 'budgets' | 'summaries' | 'indicators';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'transactions', label: 'Transactions' },
  { id: 'categories', label: 'Categories' },
  { id: 'budgets', label: 'Budgets' },
  { id: 'summaries', label: 'Summaries' },
  { id: 'indicators', label: 'Indicators' },
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
        {tab === 'categories' && <CategoriesPage />}
        {tab === 'budgets' && <BudgetsPage />}
        {tab === 'summaries' && <SummariesPage />}
        {tab === 'indicators' && <IndicatorsPage />}
      </main>
    </>
  );
}
