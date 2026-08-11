import { useState } from 'react';
import BudgetsPage from './pages/BudgetsPage';
import CategoriesPage from './pages/CategoriesPage';
import IndicatorsPage from './pages/IndicatorsPage';
import SummariesPage from './pages/SummariesPage';
import TransactionsPage from './pages/TransactionsPage';

export type Tab = 'transactions' | 'categories' | 'budgets' | 'summaries' | 'indicators';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'transactions', label: 'Transacciones' },
  { id: 'categories', label: 'Categorías' },
  { id: 'budgets', label: 'Presupuestos' },
  { id: 'summaries', label: 'Resúmenes' },
  { id: 'indicators', label: 'Indicadores' },
];

export default function App(): JSX.Element {
  const [tab, setTab] = useState<Tab>('transactions');
  const tabButtons = TABS.map((t) => (
    <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
      {t.label}
    </button>
  ));
  return (
    <>
      <header className="app-header">
        <h1>Finanzas Personales</h1>
        {/* Desktop tabs; hidden on mobile where the bottom bar takes over. */}
        <nav className="tabs desktop-tabs" aria-label="Secciones">
          {tabButtons}
        </nav>
      </header>
      <main>
        <div className={tab === 'transactions' ? 'tab-panel' : 'tab-panel hidden'}>
          <TransactionsPage />
        </div>
        <div className={tab === 'categories' ? 'tab-panel' : 'tab-panel hidden'}>
          <CategoriesPage />
        </div>
        <div className={tab === 'budgets' ? 'tab-panel' : 'tab-panel hidden'}>
          <BudgetsPage />
        </div>
        <div className={tab === 'summaries' ? 'tab-panel' : 'tab-panel hidden'}>
          <SummariesPage />
        </div>
        <div className={tab === 'indicators' ? 'tab-panel' : 'tab-panel hidden'}>
          <IndicatorsPage />
        </div>
      </main>
      {/* Mobile-first navigation: thumb-reachable, same buttons and state as
          the header tabs (CSS swaps them at the ≤640px breakpoint). */}
      <nav className="bottom-bar mobile-only" aria-label="Secciones">
        {tabButtons}
      </nav>
    </>
  );
}
